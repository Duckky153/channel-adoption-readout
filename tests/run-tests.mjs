// Plain Node tests for the Channel Adoption Readout. No packages needed.
// Run from the sample folder:
//   node tests/run-tests.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await import(new URL('../data.js', import.meta.url).href);
await import(new URL('../readout.mjs', import.meta.url).href);

const R = globalThis.ChannelReadout;
const G = globalThis.ChannelData;
const D = globalThis.CHANNEL_DATA;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const view = (credit, minRuns) => R.computeReadout(D, { credit, minRuns });
const row = (readout, id) => readout.rows.find((r) => r.id === id);
const near = (actual, target, tol, label) =>
  assert.ok(Math.abs(actual - target) <= target * tol, label + ': ' + actual + ' is not within ' + Math.round(tol * 100) + '% of ' + target);
const DEFAULT = view('first', 3);
const LAST = view('last', 3);

// Spec targets for 8 weeks, first touch. [visits, signups, activation rate at 3 runs, demo requests, qualified demos]
const TARGETS = {
  launch: [41000, 980, 0.08, 14, 2],
  xthread: [14500, 310, 0.10, 6, 1],
  youtube: [3800, 170, 0.34, 9, 4],
  newsletter: [5200, 85, 0.12, 3, 1],
  github: [7400, 260, 0.27, 5, 2],
  community: [1100, 19, null, null, null],
  paidsearch: [950, 24, null, null, null],
  integration: [6300, 340, 0.41, 12, 6],
  comparison: [4100, 190, 0.33, 21, 11],
  besttools: [9800, 150, 0.15, 4, 1],
  modelpages: [8600, 95, 0.09, 1, 0],
  docs: [5000, 210, 0.38, null, null],
  nosource: [0, 320, 0.22, null, null],
};

// ---------- the data ----------

test('data is deterministic: same seed, same rows', () => {
  const again = G.generate(G.SEED);
  assert.equal(JSON.stringify(again), JSON.stringify(D));
  assert.equal(D.seed, 20261002);
  assert.notEqual(JSON.stringify(G.generate(G.SEED + 1).signups), JSON.stringify(D.signups));
});

test('mulberry32 gives the same sequence for the same seed', () => {
  const a = G.mulberry32(7);
  const b = G.mulberry32(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('allocate splits a whole number exactly', () => {
  assert.deepEqual(G.allocate(10, [1, 1, 1]), [4, 3, 3]);
  assert.equal(G.allocate(41000, [0, 0, 0.8, 0.11, 0.04, 0.025, 0.015, 0.01]).reduce((a, b) => a + b, 0), 41000);
  assert.deepEqual(G.allocate(0, [1, 2]), [0, 0]);
});

test('13 sources, 8 weeks, and weekly visits add up to each total', () => {
  assert.equal(D.sources.length, 13);
  assert.equal(D.weeks, 8);
  for (const s of D.sources) {
    assert.equal(s.visitsByWeek.length, 8, s.id);
    assert.equal(s.visitsByWeek.reduce((a, b) => a + b, 0), s.visits, s.id);
  }
});

test('every signup row has the fields the spec lists, in range', () => {
  const ids = new Set();
  const known = new Set(D.sources.map((s) => s.id));
  for (const s of D.signups) {
    ids.add(s.id);
    assert.ok(s.week >= 1 && s.week <= 8, s.id + ' week');
    assert.ok(Array.isArray(s.touches) && s.touches.length <= 3, s.id + ' touches');
    s.touches.forEach((t) => assert.ok(known.has(t) && t !== R.NO_SOURCE, s.id + ' touch ' + t));
    assert.ok(s.emailType === 'work' || s.emailType === 'personal', s.id + ' emailType');
    if (s.emailType === 'work') assert.match(s.companyDomain, /^company-\d{4}\.example$/, s.id + ' domain');
    else assert.equal(s.companyDomain, null, s.id + ' personal email has no company domain');
    assert.ok(D.sizes.includes(s.companySize), s.id + ' size');
    assert.ok(Number.isInteger(s.runs7d) && s.runs7d >= 0 && s.runs7d <= 20, s.id + ' runs7d');
    assert.equal(typeof s.demoRequested, 'boolean');
    assert.equal(typeof s.useCaseStated, 'boolean');
  }
  assert.equal(ids.size, D.signups.length, 'ids are unique');
});

test('first touch totals hit the spec targets within 10%', () => {
  for (const [id, [visits, signups, rate, demoReq, qualified]] of Object.entries(TARGETS)) {
    const src = D.sources.find((s) => s.id === id);
    assert.equal(src.visits, visits, id + ' visits');
    const rows = D.signups.filter((s) => R.creditedSource(s, 'first') === id);
    near(rows.length, signups, 0.10, id + ' signups');
    if (rate != null) {
      // Rates leave out held signups (R7), as the readout does.
      const act = row(DEFAULT, id).activationRate;
      assert.ok(Math.abs(act - rate) <= Math.max(0.02, rate * 0.10), id + ' activation ' + act.toFixed(3) + ' vs ' + rate);
    }
    if (demoReq != null) {
      const req = rows.filter((s) => s.demoRequested).length;
      assert.ok(Math.abs(req - demoReq) <= 1, id + ' demo requests ' + req + ' vs ' + demoReq);
    }
    if (qualified != null) assert.equal(row(DEFAULT, id).qualifiedDemos, qualified, id + ' qualified demos');
  }
});

test('about 30% of launch post and X thread signups later touch the docs quickstart or comparison pages', () => {
  for (const id of ['launch', 'xthread']) {
    const rows = D.signups.filter((s) => s.touches[0] === id);
    const later = rows.filter((s) => s.touches.slice(1).some((t) => t === 'docs' || t === 'comparison')).length / rows.length;
    assert.ok(later >= 0.25 && later <= 0.36, id + ' later-touch share ' + later.toFixed(3));
  }
});

test('the open-source stream totals +4,100 stars and +1,300 self-host pings', () => {
  assert.equal(D.openSource.stars.reduce((a, b) => a + b, 0), 4100);
  assert.equal(D.openSource.selfHostPings.reduce((a, b) => a + b, 0), 1300);
});

// ---------- R1 and R2: credit ----------

test('R1: first touch and last touch pick the right source', () => {
  const s = { touches: ['launch', 'docs', 'comparison'] };
  assert.equal(R.creditedSource(s, 'first'), 'launch');
  assert.equal(R.creditedSource(s, 'last'), 'comparison');
  assert.equal(R.creditedSource({ touches: ['youtube'] }, 'last'), 'youtube');
});

test('R1: total signups = total credits in every view', () => {
  for (const credit of ['first', 'last']) {
    for (const runs of R.RULES.runChoices) {
      const v = view(credit, runs);
      const rc = v.reconciliation;
      assert.ok(rc.ok, credit + ' ' + runs);
      assert.equal(rc.channelCredits + rc.noSource + rc.held, D.signups.length);
      assert.equal(v.rows.reduce((a, r) => a + r.signups, 0) + rc.held, D.signups.length);
      assert.equal(v.totals.signups, D.signups.length);
    }
  }
});

test('R1: last touch moves credit from the launch post and X thread to the docs quickstart and comparison pages', () => {
  assert.ok(row(LAST, 'launch').signups < row(DEFAULT, 'launch').signups);
  assert.ok(row(LAST, 'xthread').signups < row(DEFAULT, 'xthread').signups);
  assert.ok(row(LAST, 'docs').signups > row(DEFAULT, 'docs').signups);
  assert.ok(row(LAST, 'comparison').signups > row(DEFAULT, 'comparison').signups);
  // Visits never move between views.
  DEFAULT.rows.forEach((r) => assert.equal(row(LAST, r.id).visits, r.visits));
});

test('R2: signups with no touch stay in No source and are never spread', () => {
  const none = D.signups.filter((s) => s.touches.length === 0).length;
  assert.equal(R.creditedSource({ touches: [] }, 'first'), R.NO_SOURCE);
  assert.equal(R.creditedSource({ touches: [] }, 'last'), R.NO_SOURCE);
  assert.equal(row(DEFAULT, R.NO_SOURCE).signups, none);
  assert.equal(row(LAST, R.NO_SOURCE).signups, none);
  assert.equal(none, 320);
  assert.equal(row(DEFAULT, R.NO_SOURCE).verdict, 'nosource');
});

// ---------- R3: activated ----------

test('R3: activated means at least N runs in the first 7 days', () => {
  assert.equal(R.isActivated({ runs7d: 2 }, 3), false);
  assert.equal(R.isActivated({ runs7d: 3 }, 3), true);
  assert.equal(R.isActivated({ runs7d: 1 }, 1), true);
  assert.equal(R.isActivated({ runs7d: 0 }, 1), false);
  assert.equal(R.RULES.defaultMinRuns, 3);
  assert.ok(view('first', 1).totals.activated > DEFAULT.totals.activated);
  assert.ok(view('first', 5).totals.activated < DEFAULT.totals.activated);
});

test('R3: the 1 / 3 / 5 selector flips at least one verdict', () => {
  const at1 = R.verdictFlips(DEFAULT, view('first', 1));
  const at5 = R.verdictFlips(DEFAULT, view('first', 5));
  assert.ok(at1.size >= 1, 'switching to 1 run flips something');
  assert.ok(at5.size >= 1, 'switching to 5 runs flips something');
  assert.equal(at1.get('launch').from, 'attention');
  assert.equal(at1.get('launch').to, 'mixed');
  assert.equal(at5.get('github').to, 'mixed');
  assert.equal(R.verdictFlips(DEFAULT, DEFAULT).size, 0);
});

// ---------- R4: qualified demos ----------

test('R4: a demo counts only with a work email, 201+ people and a stated use case', () => {
  const ok = { emailType: 'work', companyDomain: 'company-0001.example', companySize: '201-1000', useCaseStated: true };
  assert.equal(R.demoReason(ok), 'qualified');
  assert.equal(R.demoReason({ ...ok, companySize: '1000+' }), 'qualified');
  assert.equal(R.demoReason({ ...ok, emailType: 'personal', companyDomain: null }), 'personal');
  assert.equal(R.demoReason({ ...ok, companySize: '51-200' }), 'small');
  assert.equal(R.demoReason({ ...ok, useCaseStated: false }), 'nouse');
});

test('R4: repeat requests from one company domain count once, keeping the earliest', () => {
  const mk = (id, week, day) => ({ id, week, day, demoRequested: true, emailType: 'work', companyDomain: 'company-0009.example', companySize: '1000+', useCaseStated: true, touches: ['comparison'] });
  const res = R.evaluateDemos([mk('S2', 4, 1), mk('S1', 2, 5)]);
  assert.equal(res.qualified.length, 1);
  assert.equal(res.qualified[0].id, 'S1');
  assert.equal(res.duplicates.length, 1);
  assert.equal(res.duplicates[0].signup.id, 'S2');
});

test('R4: 29 qualified demos, and every request is accounted for', () => {
  const d = DEFAULT.demos;
  assert.equal(d.qualified, 29);
  assert.equal(d.duplicates.length, 3);
  assert.equal(d.qualified + d.notCounted.personal + d.notCounted.small + d.notCounted.nouse + d.duplicates.length, d.requests);
  assert.equal(DEFAULT.rows.reduce((a, r) => a + r.qualifiedDemos, 0), 29);
  assert.equal(LAST.rows.reduce((a, r) => a + r.qualifiedDemos, 0), 29);
  assert.equal(row(DEFAULT, 'comparison').qualifiedDemos, 11);
});

// ---------- R5 and R6: verdicts ----------

test('R5: the two small sources show Too early to judge in both credit views', () => {
  for (const v of [DEFAULT, LAST, view('first', 1), view('last', 5)]) {
    assert.equal(row(v, 'community').verdictLabel, 'Too early to judge');
    assert.equal(row(v, 'paidsearch').verdictLabel, 'Too early to judge');
  }
  assert.equal(R.verdictFor({ id: 'x', visits: 500, signups: 29, activated: 29 }, { visits: 1000, activated: 30 }), 'early');
  assert.notEqual(R.verdictFor({ id: 'x', visits: 500, signups: 30, activated: 29 }, { visits: 1000, activated: 30 }), 'early');
});

test('R6: Adoption at or above the overall rate, Attention only at 2x or more, otherwise Mixed', () => {
  const totals = { visits: 10000, activated: 100 }; // overall rate 10 per 1,000
  const v = (visits, activated) => R.verdictFor({ id: 'x', visits, signups: 100, activated }, totals);
  assert.equal(v(1000, 10), 'adoption', 'exactly the overall rate');
  assert.equal(v(1000, 11), 'adoption');
  assert.equal(v(1000, 9), 'mixed');
  assert.equal(v(1000, 6), 'mixed');
  assert.equal(v(1000, 5), 'attention', 'visit share exactly twice the activated share');
  assert.equal(v(1000, 1), 'attention');
});

test('R6: default verdicts match the spec story', () => {
  const verdicts = Object.fromEntries(DEFAULT.rows.map((r) => [r.id, r.verdict]));
  assert.equal(verdicts.launch, 'attention');
  assert.equal(verdicts.xthread, 'attention');
  assert.equal(verdicts.modelpages, 'attention');
  ['youtube', 'github', 'integration', 'comparison', 'docs'].forEach((id) => assert.equal(verdicts[id], 'adoption', id));
});

// ---------- R7: held burst ----------

test('R7: the 23-signup burst from one domain on one day is held and left out of the rates', () => {
  assert.equal(DEFAULT.bursts.length, 1);
  const b = DEFAULT.bursts[0];
  assert.equal(b.count, 23);
  assert.deepEqual(b.sources, ['docs']);
  assert.equal(DEFAULT.totals.held, 23);
  const docsAll = D.signups.filter((s) => R.creditedSource(s, 'first') === 'docs').length;
  assert.equal(docsAll, 210);
  assert.equal(row(DEFAULT, 'docs').signups, 187);
  // The held signups appear in the week chart but in no source row.
  const wk = DEFAULT.weeks[b.week - 1];
  assert.equal(wk.held, 23);
  assert.equal(wk.bySource.reduce((a, x) => a + x.signups, 0) + wk.held, wk.total);
});

test('R7: 14 from one domain is not held, and 15 split across two days is not held', () => {
  const mk = (n, day0, split) => Array.from({ length: n }, (_, i) => ({ id: 'T' + i, week: 2, day: split && i % 2 ? day0 + 1 : day0, companyDomain: 'company-0042.example' }));
  assert.equal(R.findBursts(mk(14, 1, false)).bursts.length, 0);
  assert.equal(R.findBursts(mk(15, 1, false)).bursts.length, 1);
  assert.equal(R.findBursts(mk(15, 1, true)).bursts.length, 0);
});

// ---------- R8: open source ----------

test('R8: stars and self-host pings are never added to signups', () => {
  const visits = D.sources.reduce((a, s) => a + s.visits, 0);
  assert.equal(DEFAULT.totals.visits, visits);
  assert.equal(DEFAULT.totals.signups, D.signups.length);
  assert.ok(!('stars' in DEFAULT.totals));
});

// ---------- sentences ----------

test('the result sentence reads as the spec says with the default view', () => {
  assert.equal(R.resultSentence(DEFAULT),
    'The launch post brought 38% of visits but 12% of activated signups; integration how-to pages brought 6% of visits and 22% of activated signups, and comparison pages produced 11 of the 29 qualified demos.');
});

test('the result sentence updates when the controls change', () => {
  const seen = new Set([R.resultSentence(DEFAULT)]);
  seen.add(R.resultSentence(LAST));
  seen.add(R.resultSentence(view('first', 1)));
  seen.add(R.resultSentence(view('first', 5)));
  assert.equal(seen.size, 4);
  assert.match(R.resultSentence(LAST), /docs quickstart/);
});

test('week 3 traces the spike to the launch post', () => {
  const s = R.spikeSentence(DEFAULT, 3);
  assert.equal(s, 'Week 3: 72% of signups came from the launch post, and 8% of those signups activated.');
  const peak = DEFAULT.weeks.reduce((a, w) => (w.total > a.total ? w : a));
  assert.equal(peak.week, 3);
  assert.match(R.spikeSentence(DEFAULT, 6), /held as one team testing/);
});

test('top touch paths are listed for each source, at most three', () => {
  DEFAULT.rows.forEach((r) => assert.ok(r.paths.length <= 3, r.id));
  const launch = row(DEFAULT, 'launch');
  assert.equal(launch.paths[0].label, 'Launch post');
  assert.ok(launch.paths.some((p) => p.touches.length > 1));
});

// ---------- page two: Next Tests ----------

const PLAN = R.nextTests(D);

test('topic table covers 8 topics, sorted by activated per 1,000 readers', () => {
  const rows = PLAN.topics.rows;
  assert.equal(rows.length, 8);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].perThousand >= rows[i].perThousand);
  rows.forEach((r) => assert.ok(r.topWorkflow && r.topWorkflow.name, r.topic));
  assert.equal(PLAN.topics.totals.readers, 3800 + 6300 + 5000);
});

test('topic signups add up to the topic sources minus the held burst', () => {
  const ids = new Set(D.topicSources);
  const expected = D.signups.filter((s) => ids.has(R.creditedSource(s, 'first'))).length - DEFAULT.totals.held;
  assert.equal(PLAN.topics.totals.signups, expected);
});

test('the win bar is the median of the Adoption sources and the stop line is half', () => {
  const rates = DEFAULT.rows.filter((r) => r.verdict === 'adoption').map((r) => r.perThousand);
  assert.equal(PLAN.bar.winBar, R.median(rates));
  assert.equal(PLAN.bar.stopLine, PLAN.bar.winBar / 2);
  assert.equal(R.median([1, 3, 2]), 2);
  assert.equal(R.median([1, 2, 3, 4]), 2.5);
  assert.equal(R.median([]), null);
});

test('three test cards, each with a metric, a minimum sample, a win bar and a stop rule', () => {
  assert.equal(PLAN.cards.length, 3);
  PLAN.cards.forEach((c) => {
    ['title', 'make', 'why', 'metric', 'sample', 'win', 'stop'].forEach((k) => assert.ok(c[k] && c[k].length > 5, c.key + ' ' + k));
    assert.match(c.sample, /60 signups or 3 weeks, whichever comes later/);
  });
  assert.match(PLAN.cards[0].title, new RegExp(PLAN.topics.rows[0].topic));
  assert.match(PLAN.cards[1].title, new RegExp(PLAN.pairings.rows[0].pairing.replace(/\./g, '\\.')));
  assert.match(R.nextSentence(PLAN), /^\S.* readers activated at \d+\.\d per 1,000, the best of 8 topics/);
});

test('a test is judged only after the minimum sample, then win, stop or extend', () => {
  const bar = { winBar: 10, stopLine: 5, minSignups: 60, minWeeks: 3 };
  assert.equal(R.testStatus({ visits: 1000, signups: 80, activated: 20 }, 2, bar).code, 'early', 'enough signups, not enough weeks');
  assert.equal(R.testStatus({ visits: 1000, signups: 59, activated: 20 }, 4, bar).code, 'early', 'enough weeks, not enough signups');
  assert.equal(R.testStatus({ visits: 1000, signups: 60, activated: 10 }, 3, bar).code, 'win');
  assert.equal(R.testStatus({ visits: 1000, signups: 60, activated: 4 }, 3, bar).code, 'stop');
  assert.equal(R.testStatus({ visits: 1000, signups: 60, activated: 7 }, 3, bar).code, 'extend');
  assert.match(R.testStatus({ visits: 1000, signups: 10, activated: 1 }, 1, bar).text, /keeps running/);
});

test('the weekly check has the four numbers for each of the three tests', () => {
  const rows = R.weeklyCheck(D, PLAN);
  assert.equal(rows.length, 3);
  rows.forEach((w) => {
    ['visits', 'signups', 'activated', 'qualifiedDemos'].forEach((k) => assert.ok(Number.isInteger(w[k]), w.key + ' ' + k));
    assert.equal(w.status.code, 'early', 'nothing is judged after one week');
  });
});

// ---------- the published files ----------

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(root).filter((p) => /\.(html|js|mjs|css|md)$/.test(p));
const read = (name) => readFileSync(join(root, name), 'utf8');

test('the site files are all here', () => {
  ['index.html', 'next-tests.html', 'style.css', 'data.js', 'readout.mjs', 'app.js', 'next.js', 'README.md'].forEach((f) =>
    assert.ok(existsSync(join(root, f)), f));
});

test('pages load only local files, with no network calls', () => {
  for (const page of ['index.html', 'next-tests.html']) {
    const html = read(page);
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    refs.forEach((ref) => {
      assert.ok(!/^[a-z]+:/i.test(ref) && !ref.startsWith('//'), page + ' loads ' + ref);
      assert.ok(existsSync(join(root, ref.split('#')[0])), page + ' points at missing ' + ref);
    });
  }
  for (const f of ['data.js', 'readout.mjs', 'app.js', 'next.js']) {
    const src = read(f);
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//.test(src), f + ' makes a network call');
  }
});

test('both pages carry the synthetic data badge, the footer and their closing questions', () => {
  const one = read('index.html');
  const two = read('next-tests.html');
  for (const html of [one, two]) {
    assert.match(html, /<span class="badge">Synthetic data<\/span>/);
    assert.match(html, /Built by \S+ Raj with Claude Code and Codex\./);
  }
  [
    'What event counts as an activated user for you today, and how long after signup do you check?',
    'Do self-hosted installs send anything back, or is that usage invisible to marketing?',
    'When someone already on the free plan requests a demo, does the credit go to the page they first read or to the product?',
    'When someone reads three pages before signing up, which one does your reporting credit today?',
  ].forEach((q) => assert.ok(one.includes(q), q));
  [
    'Who records demos today, and which one led to the most real usage?',
    'Do you already use a minimum sample before calling a channel test?',
  ].forEach((q) => assert.ok(two.includes(q), q));
  assert.match(one, /href="next-tests.html"/);
});

test('the README quotes the same numbers the page computes', () => {
  const md = read('README.md');
  assert.ok(md.includes(R.fmtInt(D.signups.length) + ' synthetic signups'), 'signup count');
  assert.ok(md.includes(R.resultSentence(DEFAULT)), 'result sentence');
  assert.ok(md.includes('seed ' + D.seed), 'seed');
});

// Words kept out of the published copy, stored as the first 16 hex characters of their SHA-256.
const KEPT_OUT = new Set(['507a9a8be3d145a8', '67e5a3025bc013d0', '2d5efaf5367f80f2', 'e8f04d28391daf1c', 'e759968ca9278b8d',
  '97705e58965f7c0e', '9ecfc652f6b09c9f', '353e5d16112c5f1b', '5f44712b7d71ded7', '13d853006f71ed7b', '600ccd5e0c3fee79',
  '5e8c9902207afaeb', '5d9a17cb70b9733a', '8efdf55724c97710', '4dd7b69db8684897', '0b22f40bb71c86c9', '2fdc0177057d3a5c',
  'b0688a56fae3ddb4', '5946f7b2be60c7ea', '92d46204d8e9aeb3', '438287bf455f1f46', 'fde2b189f66a29e2', 'dda18a0e21ae47c5',
  'ba159dbf9d2f740f', '02540942346fdfbf', '320dc1c2c337e7ef', 'a83a31320d921b88', 'b67edcdb95503aae', 'bf90ace460be6649',
  'e45af5831daee567', '1fe289205936c3fd', 'fd54e5a82e36d787', '97a5e41b45ddd2b2', 'b4267ce93cbba4e4', '42aef2f386567bd5',
  '9b39fac9d311477c', '8fb58a4ac0ac96ec', 'c4d2abc915f03fdb', '84308bea454057aa', '59458508a0827cff']);
const hash16 = (w) => createHash('sha256').update(w).digest('hex').slice(0, 16);

test('copy has no em or en dashes, no local paths or addresses, and none of the kept-out words', () => {
  const homePath = new RegExp('/' + 'Users' + '/|/' + 'home' + '/');
  const shapes = [/\u2014/, /\u2013/, /&mdash;/, /&ndash;/, homePath, /CLAUDE\.md|AGENTS\.md/, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i];
  const siteFiles = files.filter((f) => !relative(root, f).startsWith('tests'));
  assert.ok(siteFiles.length >= 8);
  for (const f of siteFiles) {
    const text = readFileSync(f, 'utf8');
    shapes.forEach((re) => assert.ok(!re.test(text), relative(root, f) + ' matches ' + re));
    const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
    words.forEach((w, i) => {
      assert.ok(!KEPT_OUT.has(hash16(w)), relative(root, f) + ' uses a kept-out word near "' + words.slice(Math.max(0, i - 3), i).join(' ') + '"');
      if (i > 0) assert.ok(!KEPT_OUT.has(hash16(words[i - 1] + ' ' + w)), relative(root, f) + ' uses a kept-out phrase');
    });
  }
});

// ---------- run ----------

let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log('ok   ' + t.name);
  } catch (err) {
    failed += 1;
    console.log('FAIL ' + t.name);
    console.log('     ' + String(err && err.message ? err.message : err).split('\n').join('\n     '));
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' tests passed.');
process.exit(failed ? 1 : 0);
