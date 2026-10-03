/*
 * readout.mjs: every rule behind the Channel Adoption Readout and its Next
 * Tests page.
 *
 * The same file runs two ways: as a plain <script> in the browser (so the
 * pages work when opened straight from disk) and as a module in Node for the
 * tests. It has no imports, no exports and no network calls. It adds one
 * object, ChannelReadout, to globalThis.
 */
(function (root) {
  'use strict';

  // Every threshold the rules use. Starting choices, meant to be argued with.
  const RULES = {
    defaultCredit: 'first',
    defaultMinRuns: 3,
    runChoices: [1, 3, 5],
    tooEarlyMin: 30,
    burstMin: 15,
    qualifiedSizes: ['201-1000', '1000+'],
    minSampleSignups: 60,
    minSampleWeeks: 3,
  };

  const NO_SOURCE = 'nosource';

  const VERDICTS = {
    adoption: 'Adoption',
    mixed: 'Mixed',
    attention: 'Attention only',
    early: 'Too early to judge',
    nosource: 'Not judged',
  };

  const DEMO_REASONS = {
    personal: 'Personal email',
    small: 'Company under 201 people',
    nouse: 'No use case stated',
  };

  // ---------- small helpers ----------

  function fmtInt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmt1(n) {
    if (n == null || !isFinite(n)) return 'n/a';
    return (Math.round(n * 10) / 10).toFixed(1);
  }
  function pct(x) {
    if (x == null || !isFinite(x)) return 'n/a';
    if (x > 0 && x < 0.005) return 'under 1%';
    return Math.round(x * 100) + '%';
  }
  function plural(n, one, many) {
    return fmtInt(n) + ' ' + (n === 1 ? one : (many || one + 's'));
  }
  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function median(values) {
    if (!values.length) return null;
    const v = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }
  function byTime(a, b) {
    return a.week - b.week || a.day - b.day || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  function sourceMap(data) {
    const map = new Map();
    data.sources.forEach((s) => map.set(s.id, s));
    return map;
  }
  function pathLabel(touches, sources) {
    if (!touches.length) return 'No recorded touch';
    return touches.map((id) => (sources.get(id) ? sources.get(id).short : id)).join(' → ');
  }

  // ---------- the rules ----------

  // R1 and R2: one credit per signup, to its first or last touch. No touch means No source.
  function creditedSource(signup, credit) {
    if (!signup.touches || !signup.touches.length) return NO_SOURCE;
    return credit === 'last' ? signup.touches[signup.touches.length - 1] : signup.touches[0];
  }

  // R3: activated means its workflows ran at least minRuns times in the first 7 days.
  function isActivated(signup, minRuns) {
    return signup.runs7d >= minRuns;
  }

  // R7: 15 or more signups from one company domain on one day are held as one team testing.
  function findBursts(signups, minCount) {
    const min = minCount == null ? RULES.burstMin : minCount;
    const groups = new Map();
    signups.forEach((s) => {
      if (!s.companyDomain) return;
      const key = s.companyDomain + '|' + s.week + '|' + s.day;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    const bursts = [];
    const heldIds = new Set();
    groups.forEach((list) => {
      if (list.length < min) return;
      list.forEach((s) => heldIds.add(s.id));
      bursts.push({ domain: list[0].companyDomain, week: list[0].week, day: list[0].day, signups: list });
    });
    bursts.sort((a, b) => a.week - b.week || a.day - b.day || (a.domain < b.domain ? -1 : 1));
    return { bursts, heldIds };
  }

  // R4: why a demo request does or doesn't count, checked in this order.
  function demoReason(signup) {
    if (signup.emailType !== 'work' || !signup.companyDomain) return 'personal';
    if (RULES.qualifiedSizes.indexOf(signup.companySize) < 0) return 'small';
    if (!signup.useCaseStated) return 'nouse';
    return 'qualified';
  }

  // R4: qualified demo requests, with repeat requests from one domain counted once (the earliest is kept).
  function evaluateDemos(signups, heldIds) {
    const held = heldIds || new Set();
    const requests = signups.filter((s) => s.demoRequested && !held.has(s.id)).sort(byTime);
    const qualified = [];
    const duplicates = [];
    const notCounted = { personal: [], small: [], nouse: [] };
    const firstByDomain = new Map();
    requests.forEach((s) => {
      const reason = demoReason(s);
      if (reason !== 'qualified') {
        notCounted[reason].push(s);
        return;
      }
      if (firstByDomain.has(s.companyDomain)) {
        duplicates.push({ signup: s, kept: firstByDomain.get(s.companyDomain), domain: s.companyDomain });
        return;
      }
      firstByDomain.set(s.companyDomain, s);
      qualified.push(s);
    });
    return { requests, qualified, duplicates, notCounted };
  }

  // R5 and R6: the verdict for one source, using whole-number comparisons so ties are exact.
  function verdictFor(row, totals) {
    if (row.id === NO_SOURCE || !row.visits) return 'nosource';
    if (row.signups < RULES.tooEarlyMin) return 'early';
    const A = totals.activated;
    const V = totals.visits;
    // Share of activated signups at least its share of visits: same as beating the overall rate.
    if (row.activated * V >= A * row.visits) return 'adoption';
    // Share of visits at least twice its share of activated signups.
    if (row.visits * A >= 2 * row.activated * V) return 'attention';
    return 'mixed';
  }

  // ---------- the readout ----------

  function computeReadout(data, options) {
    const opts = options || {};
    const credit = opts.credit === 'last' ? 'last' : 'first';
    const minRuns = opts.minRuns == null ? RULES.defaultMinRuns : opts.minRuns;
    const W = data.weeks;
    const sources = sourceMap(data);
    const burstInfo = findBursts(data.signups, RULES.burstMin);
    const heldIds = burstInfo.heldIds;

    const rows = data.sources.map((src) => ({
      id: src.id,
      label: src.label,
      short: src.short,
      phrase: src.phrase,
      startWeek: src.startWeek,
      visits: src.visits,
      visitsByWeek: src.visitsByWeek.slice(),
      signups: 0,
      activated: 0,
      qualifiedDemos: 0,
      weekly: Array.from({ length: W }, () => ({ signups: 0, activated: 0 })),
      pathCounts: new Map(),
    }));
    const rowById = new Map(rows.map((r) => [r.id, r]));

    const weeks = Array.from({ length: W }, (_, i) => ({ week: i + 1, total: 0, activated: 0, held: 0, heldActivated: 0, bySource: new Map() }));

    data.signups.forEach((s) => {
      const wk = weeks[s.week - 1];
      wk.total += 1;
      const act = isActivated(s, minRuns);
      if (heldIds.has(s.id)) {
        wk.held += 1;
        if (act) wk.heldActivated += 1;
        return;
      }
      const src = creditedSource(s, credit);
      const row = rowById.get(src);
      row.signups += 1;
      row.weekly[s.week - 1].signups += 1;
      if (act) {
        row.activated += 1;
        row.weekly[s.week - 1].activated += 1;
        wk.activated += 1;
      }
      const key = s.touches.join('>');
      const pc = row.pathCounts.get(key) || { touches: s.touches, signups: 0, activated: 0 };
      pc.signups += 1;
      if (act) pc.activated += 1;
      row.pathCounts.set(key, pc);
      const ws = wk.bySource.get(src) || { id: src, signups: 0, activated: 0 };
      ws.signups += 1;
      if (act) ws.activated += 1;
      wk.bySource.set(src, ws);
    });

    const demos = evaluateDemos(data.signups, heldIds);
    demos.qualified.forEach((s) => { rowById.get(creditedSource(s, credit)).qualifiedDemos += 1; });

    const totals = {
      signups: data.signups.length,
      visits: rows.reduce((a, r) => a + r.visits, 0),
      credited: rows.reduce((a, r) => a + r.signups, 0),
      activated: rows.reduce((a, r) => a + r.activated, 0),
      held: heldIds.size,
      qualifiedDemos: demos.qualified.length,
      demoRequests: demos.requests.length,
    };
    totals.overallRate = totals.visits ? (totals.activated / totals.visits) * 1000 : null;

    rows.forEach((r) => {
      r.activationRate = r.signups ? r.activated / r.signups : null;
      r.perThousand = r.visits ? (r.activated / r.visits) * 1000 : null;
      r.visitShare = totals.visits ? r.visits / totals.visits : 0;
      r.activatedShare = totals.activated ? r.activated / totals.activated : 0;
      r.verdict = verdictFor(r, totals);
      r.verdictLabel = VERDICTS[r.verdict];
      r.paths = Array.from(r.pathCounts.values())
        .sort((a, b) => b.signups - a.signups || a.touches.length - b.touches.length || (a.touches.join() < b.touches.join() ? -1 : 1))
        .slice(0, 3)
        .map((p) => ({ label: pathLabel(p.touches, sources), touches: p.touches, signups: p.signups, activated: p.activated }));
      delete r.pathCounts;
    });

    const noSourceRow = rowById.get(NO_SOURCE);
    const reconciliation = {
      totalSignups: totals.signups,
      channelCredits: totals.credited - (noSourceRow ? noSourceRow.signups : 0),
      noSource: noSourceRow ? noSourceRow.signups : 0,
      held: totals.held,
    };
    reconciliation.ok = reconciliation.channelCredits + reconciliation.noSource + reconciliation.held === reconciliation.totalSignups;

    const weekList = weeks.map((wk) => {
      const list = Array.from(wk.bySource.values()).sort((a, b) => b.signups - a.signups || (a.id < b.id ? -1 : 1));
      list.forEach((x) => {
        const row = rowById.get(x.id);
        x.label = row.label;
        x.short = row.short;
        x.phrase = row.phrase;
      });
      return { week: wk.week, total: wk.total, activated: wk.activated, held: wk.held, heldActivated: wk.heldActivated, bySource: list };
    });

    return {
      credit,
      minRuns,
      rows,
      totals,
      reconciliation,
      weeks: weekList,
      bursts: burstInfo.bursts.map((b) => ({
        domain: b.domain, week: b.week, day: b.day, count: b.signups.length,
        activated: b.signups.filter((s) => isActivated(s, minRuns)).length,
        sources: Array.from(new Set(b.signups.map((s) => creditedSource(s, credit)))),
      })),
      demos: {
        requests: demos.requests.length,
        qualified: demos.qualified.length,
        notCounted: {
          personal: demos.notCounted.personal.length,
          small: demos.notCounted.small.length,
          nouse: demos.notCounted.nouse.length,
        },
        duplicates: demos.duplicates.map((d) => ({
          domain: d.domain,
          signupId: d.signup.id,
          keptId: d.kept.id,
          keptSource: creditedSource(d.kept, credit),
          repeatSource: creditedSource(d.signup, credit),
        })),
      },
    };
  }

  // Which sources changed verdict between two readouts.
  function verdictFlips(base, current) {
    const before = new Map(base.rows.map((r) => [r.id, r.verdict]));
    const flips = new Map();
    current.rows.forEach((r) => {
      const was = before.get(r.id);
      if (was && was !== r.verdict) flips.set(r.id, { from: was, to: r.verdict, fromLabel: VERDICTS[was], toLabel: VERDICTS[r.verdict] });
    });
    return flips;
  }

  function judgedRows(readout) {
    return readout.rows.filter((r) => r.verdict === 'adoption' || r.verdict === 'mixed' || r.verdict === 'attention');
  }

  // The one sentence at the top of page one.
  function resultSentence(readout) {
    const withVisits = readout.rows.filter((r) => r.visits > 0);
    if (!withVisits.length) return 'No visits recorded.';
    const top = withVisits.slice().sort((a, b) => b.visits - a.visits)[0];
    const judged = judgedRows(readout).filter((r) => r.id !== top.id);
    const best = judged.sort((a, b) => b.perThousand - a.perThousand || b.activated - a.activated)[0] || null;
    const N = readout.totals.qualifiedDemos;
    const demoTop = N ? readout.rows.slice().sort((a, b) => b.qualifiedDemos - a.qualifiedDemos || (b.perThousand || 0) - (a.perThousand || 0))[0] : null;
    const demoBit = (r) => r.qualifiedDemos + ' of the ' + N + ' qualified demos';

    let s = capitalize(top.phrase) + ' brought ' + pct(top.visitShare) + ' of visits ' +
      (top.activatedShare < top.visitShare ? 'but ' : 'and ') + pct(top.activatedShare) + ' of activated signups';
    if (demoTop && demoTop.id === top.id) s += ', plus ' + demoBit(top);
    if (best) {
      s += '; ' + best.phrase + ' brought ' + pct(best.visitShare) + ' of visits and ' + pct(best.activatedShare) + ' of activated signups';
      if (demoTop && demoTop.id === best.id) s += ', plus ' + demoBit(best);
    }
    if (demoTop && demoTop.id !== top.id && (!best || demoTop.id !== best.id)) {
      s += ', and ' + demoTop.phrase + ' produced ' + demoBit(demoTop);
    }
    return s + '.';
  }

  // The sentence under the spike chart for one week.
  function spikeSentence(readout, week) {
    const wk = readout.weeks[week - 1];
    if (!wk || !wk.total) return 'Week ' + week + ': no signups.';
    const top = wk.bySource[0];
    if (!top) return 'Week ' + week + ': every signup was held.';
    const share = pct(top.signups / wk.total);
    const actRate = pct(top.signups ? top.activated / top.signups : 0);
    if (top.id === NO_SOURCE) {
      return 'Week ' + week + ': ' + share + ' of signups had no recorded source, and ' + actRate + ' of those signups activated.';
    }
    let s = 'Week ' + week + ': ' + share + ' of signups came from ' + top.phrase + ', and ' + actRate + ' of those signups activated.';
    if (wk.held) s += ' ' + plural(wk.held, 'signup') + ' that week ' + (wk.held === 1 ? 'was' : 'were') + ' held as one team testing.';
    return s;
  }

  // ---------- page two: Next Tests ----------

  function topicTable(data, options) {
    const opts = options || {};
    const credit = opts.credit === 'last' ? 'last' : 'first';
    const minRuns = opts.minRuns == null ? RULES.defaultMinRuns : opts.minRuns;
    const heldIds = findBursts(data.signups, RULES.burstMin).heldIds;
    const demos = evaluateDemos(data.signups, heldIds);
    const topicSources = new Set(data.topicSources);
    const rows = data.topics.map((t) => ({ topic: t.name, readers: t.readers, signups: 0, activated: 0, qualifiedDemos: 0, workflows: new Map() }));
    const byName = new Map(rows.map((r) => [r.topic, r]));
    const activatedWorkflows = new Map();
    const inScope = (s) => !heldIds.has(s.id) && topicSources.has(creditedSource(s, credit)) && s.topic && byName.has(s.topic);

    data.signups.forEach((s) => {
      if (!inScope(s)) return;
      const row = byName.get(s.topic);
      row.signups += 1;
      const act = isActivated(s, minRuns);
      if (act) row.activated += 1;
      if (s.firstWorkflow) {
        row.workflows.set(s.firstWorkflow, (row.workflows.get(s.firstWorkflow) || 0) + 1);
        if (act) activatedWorkflows.set(s.firstWorkflow, (activatedWorkflows.get(s.firstWorkflow) || 0) + 1);
      }
    });
    demos.qualified.forEach((s) => { if (inScope(s)) byName.get(s.topic).qualifiedDemos += 1; });

    const topOf = (map) => {
      let best = null;
      map.forEach((count, name) => {
        if (!best || count > best.count || (count === best.count && name < best.name)) best = { name, count };
      });
      return best;
    };

    rows.forEach((r) => {
      r.perThousand = r.readers ? (r.activated / r.readers) * 1000 : null;
      r.topWorkflow = topOf(r.workflows);
      delete r.workflows;
    });
    rows.sort((a, b) => (b.perThousand || 0) - (a.perThousand || 0) || b.activated - a.activated || (a.topic < b.topic ? -1 : 1));

    return {
      rows,
      totals: {
        readers: rows.reduce((a, r) => a + r.readers, 0),
        signups: rows.reduce((a, r) => a + r.signups, 0),
        activated: rows.reduce((a, r) => a + r.activated, 0),
        qualifiedDemos: rows.reduce((a, r) => a + r.qualifiedDemos, 0),
      },
      topActivatedWorkflow: topOf(activatedWorkflows),
    };
  }

  // Which comparison pairing produced the most qualified demos among signups credited to comparison pages.
  function pairingTable(data, options) {
    const opts = options || {};
    const credit = opts.credit === 'last' ? 'last' : 'first';
    const heldIds = findBursts(data.signups, RULES.burstMin).heldIds;
    const demos = evaluateDemos(data.signups, heldIds);
    const rows = data.pairings.map((p) => ({ pairing: p, signups: 0, qualifiedDemos: 0 }));
    const byName = new Map(rows.map((r) => [r.pairing, r]));
    const inScope = (s) => !heldIds.has(s.id) && creditedSource(s, credit) === 'comparison' && s.pairing && byName.has(s.pairing);
    data.signups.forEach((s) => { if (inScope(s)) byName.get(s.pairing).signups += 1; });
    demos.qualified.forEach((s) => { if (inScope(s)) byName.get(s.pairing).qualifiedDemos += 1; });
    rows.sort((a, b) => b.qualifiedDemos - a.qualifiedDemos || b.signups - a.signups || (a.pairing < b.pairing ? -1 : 1));
    return { rows, qualifiedDemos: rows.reduce((a, r) => a + r.qualifiedDemos, 0) };
  }

  // The bar every test is judged against, set before it starts.
  function testBar(readout) {
    const adoption = readout.rows.filter((r) => r.verdict === 'adoption').map((r) => r.perThousand);
    const winBar = median(adoption);
    return {
      adoptionSources: adoption.length,
      winBar,
      stopLine: winBar == null ? null : winBar / 2,
      minSignups: RULES.minSampleSignups,
      minWeeks: RULES.minSampleWeeks,
    };
  }

  function nextTests(data) {
    const readout = computeReadout(data, { credit: 'first', minRuns: RULES.defaultMinRuns });
    const topics = topicTable(data, { credit: 'first', minRuns: RULES.defaultMinRuns });
    const pairings = pairingTable(data, { credit: 'first' });
    const bar = testBar(readout);
    const launch = readout.rows.find((r) => r.id === 'launch');
    const t1 = topics.rows[0];
    const p1 = pairings.rows[0];
    const wf = topics.topActivatedWorkflow;
    const wfName = wf ? wf.name : 'most-used';
    const t1Workflow = t1 && t1.topWorkflow ? t1.topWorkflow.name : wfName;

    const common = {
      sample: RULES.minSampleSignups + ' signups or ' + RULES.minSampleWeeks + ' weeks, whichever comes later',
      win: 'At or above ' + fmt1(bar.winBar) + ' activated per 1,000 visits, the median of today\'s ' + plural(bar.adoptionSources, 'Adoption source'),
      stop: 'Under ' + fmt1(bar.stopLine) + ' per 1,000 visits once the minimum sample is in (half the win bar). In between, run two more weeks and decide once.',
    };

    const cards = [
      Object.assign({
        key: 'walkthrough',
        title: 'Walkthrough: ' + t1.topic,
        make: 'A 3-minute walkthrough video on ' + t1.topic + ' that ends on the "' + t1Workflow + '" template.',
        why: t1.topic + ' readers activated at ' + fmt1(t1.perThousand) + ' per 1,000, the best of ' + topics.rows.length + ' topics.',
        metric: 'Activated per 1,000 visits to the video',
      }, common),
      Object.assign({
        key: 'comparison',
        title: 'Comparison page: ' + p1.pairing,
        make: 'A comparison page for the pairing behind the most qualified demos, "' + p1.pairing + '", with one worked example people can run.',
        why: 'Comparison readers on this pairing produced ' + p1.qualifiedDemos + ' of the ' + pairings.qualifiedDemos + ' qualified demos credited to comparison pages.',
        metric: 'Activated per 1,000 visits to the new page',
      }, common),
      Object.assign({
        key: 'template-post',
        title: 'Forum post that opens a template',
        make: 'A launch-style forum post that links straight to a working "' + wfName + '" template instead of the home page.',
        why: 'The launch post brought ' + pct(launch.visitShare) + ' of visits but ' + pct(launch.activatedShare) + ' of activated signups. "' + wfName + '" is the most common first workflow among activated readers of the topic pages, so the post lands people on something that already runs.',
        metric: 'Activated per 1,000 visits from the post',
      }, common),
    ];
    return { readout, topics, pairings, bar, cards };
  }

  // The one sentence at the top of page two.
  function nextSentence(plan) {
    const t1 = plan.topics.rows[0];
    if (!t1 || plan.bar.winBar == null) return 'Not enough data to plan a test yet.';
    return t1.topic + ' readers activated at ' + fmt1(t1.perThousand) + ' per 1,000, the best of ' +
      plan.topics.rows.length + ' topics, so the first test is a walkthrough on it. Each test needs ' +
      plan.bar.minSignups + ' signups and ' + plan.bar.minWeeks + ' weeks before it is judged against ' +
      fmt1(plan.bar.winBar) + ' activated per 1,000 visits.';
  }

  // Status of one live test against the bar it was given.
  function testStatus(week1, weeksRun, bar) {
    const rate = week1.visits ? (week1.activated / week1.visits) * 1000 : null;
    const enough = week1.signups >= bar.minSignups && weeksRun >= bar.minWeeks;
    if (!enough) {
      let text = 'Too early: ' + week1.signups + ' of ' + bar.minSignups + ' signups, week ' + weeksRun + ' of ' + bar.minWeeks;
      if (rate != null && rate < bar.stopLine) text += '. Under the stop line so far, but it keeps running until the sample is in';
      return { code: 'early', rate, text: text + '.' };
    }
    if (rate >= bar.winBar) return { code: 'win', rate, text: 'Win: at or above the bar.' };
    if (rate < bar.stopLine) return { code: 'stop', rate, text: 'Stop: under half the bar.' };
    return { code: 'extend', rate, text: 'In between: run two more weeks, then decide.' };
  }

  function weeklyCheck(data, plan) {
    return plan.cards.map((card, i) => {
      const w = data.nextTestsWeek1[i] || { visits: 0, signups: 0, activated: 0, qualifiedDemos: 0 };
      return Object.assign({ title: card.title, key: card.key, week: 1 }, w, { status: testStatus(w, 1, plan.bar) });
    });
  }

  root.ChannelReadout = {
    RULES,
    VERDICTS,
    DEMO_REASONS,
    NO_SOURCE,
    creditedSource,
    isActivated,
    findBursts,
    demoReason,
    evaluateDemos,
    verdictFor,
    computeReadout,
    verdictFlips,
    resultSentence,
    spikeSentence,
    topicTable,
    pairingTable,
    testBar,
    nextTests,
    nextSentence,
    testStatus,
    weeklyCheck,
    median,
    fmtInt,
    fmt1,
    pct,
    plural,
    capitalize,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
