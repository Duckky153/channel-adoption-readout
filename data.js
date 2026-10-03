/*
 * data.js: the synthetic data for the Channel Adoption Readout.
 *
 * Nothing here is real. A seeded random generator (mulberry32, seed 20261002)
 * builds every signup row from the per-source settings below, so a refresh
 * always shows the same numbers. The period is Weeks 1-8, with no calendar
 * dates. Company domains end in .example, a reserved test domain.
 *
 * It runs as a plain <script> in the browser and can be imported in Node for
 * the tests. It adds two objects to globalThis: ChannelData (the generator)
 * and CHANNEL_DATA (the generated data the pages read).
 */
(function (root) {
  'use strict';

  var SEED = 20261002;
  var WEEKS = 8;
  var SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
  var SIZE_WEIGHTS = [0.35, 0.25, 0.18, 0.13, 0.09];
  var PERSONAL_EMAIL_SHARE = 0.45;
  var USE_CASE_SHARE = 0.5;

  // One entry per source. runsAtLeast = how many of its signups ran a
  // workflow at least 1, 3 and 5 times in their first 7 days. demos = how
  // many demo requests it gets, split by what makes each one count or not.
  // later = the chance a signup also touched another page before signing up.
  var SOURCES = [
    {
      id: 'launch', label: 'Developer forum launch post', short: 'Launch post', phrase: 'the launch post',
      visits: 41000, signups: 980, runsAtLeast: [392, 78, 39],
      weeks: [0, 0, 0.80, 0.11, 0.04, 0.025, 0.015, 0.01],
      later: { p: 0.27, pActivated: 0.6, to: ['docs', 'comparison'], third: 0.2 },
      demos: { qualified: 2, personal: 5, small: 4, noUseCase: 3 },
    },
    {
      id: 'xthread', label: 'X thread', short: 'X thread', phrase: 'the X thread',
      visits: 14500, signups: 310, runsAtLeast: [130, 31, 15],
      weeks: [0.06, 0.06, 0.25, 0.22, 0.13, 0.10, 0.09, 0.09],
      later: { p: 0.27, pActivated: 0.6, to: ['docs', 'comparison'], third: 0.2 },
      demos: { qualified: 1, personal: 2, small: 2, noUseCase: 1 },
    },
    {
      id: 'youtube', label: 'YouTube walkthrough', short: 'YouTube', phrase: 'the YouTube walkthrough',
      visits: 3800, signups: 170, runsAtLeast: [119, 58, 37],
      weeks: [0, 0.05, 0.10, 0.15, 0.17, 0.17, 0.18, 0.18],
      later: { p: 0.15, to: ['docs'] },
      demos: { qualified: 4, personal: 2, small: 2, noUseCase: 1 },
    },
    {
      id: 'newsletter', label: 'Newsletter ad', short: 'Newsletter', phrase: 'the newsletter ad',
      visits: 5200, signups: 85, runsAtLeast: [38, 10, 6],
      weeks: [0, 0, 0, 0, 0.55, 0.25, 0.12, 0.08],
      later: { p: 0.10, to: ['docs'] },
      demos: { qualified: 1, personal: 1, small: 1, noUseCase: 0 },
    },
    {
      id: 'github', label: 'GitHub README link', short: 'GitHub README', phrase: 'the GitHub README link',
      visits: 7400, signups: 260, runsAtLeast: [195, 70, 23],
      weeks: [0.11, 0.11, 0.15, 0.14, 0.13, 0.12, 0.12, 0.12],
      later: { p: 0.20, to: ['docs'] },
      demos: { qualified: 2, personal: 1, small: 1, noUseCase: 1 },
    },
    {
      id: 'community', label: 'Community chat post', short: 'Community chat', phrase: 'the community chat post',
      visits: 1100, signups: 19, runsAtLeast: [11, 5, 3],
      weeks: [0, 0, 0, 0, 0, 0, 0.55, 0.45],
      later: null,
      demos: { qualified: 0, personal: 0, small: 0, noUseCase: 0 },
    },
    {
      id: 'paidsearch', label: 'Paid search test', short: 'Paid search', phrase: 'the paid search test',
      visits: 950, signups: 24, runsAtLeast: [12, 4, 2],
      weeks: [0, 0, 0, 0, 0, 0, 0.5, 0.5],
      later: null,
      demos: { qualified: 0, personal: 0, small: 1, noUseCase: 0 },
    },
    {
      id: 'integration', label: 'Integration how-to pages', short: 'Integration how-tos', phrase: 'integration how-to pages',
      visits: 6300, signups: 340, runsAtLeast: [272, 139, 102],
      weeks: [0.10, 0.11, 0.12, 0.12, 0.13, 0.14, 0.14, 0.14],
      later: { p: 0.10, to: ['docs'] },
      demos: { qualified: 6, personal: 2, small: 2, noUseCase: 1 },
    },
    {
      id: 'comparison', label: 'Comparison pages', short: 'Comparison pages', phrase: 'comparison pages',
      visits: 4100, signups: 190, runsAtLeast: [137, 63, 46],
      weeks: [0.10, 0.11, 0.12, 0.12, 0.13, 0.14, 0.14, 0.14],
      later: { p: 0.10, to: ['docs'] },
      demos: { qualified: 11, personal: 3, small: 4, noUseCase: 2 },
    },
    {
      id: 'besttools', label: 'Best-tools list articles', short: 'Best-tools lists', phrase: 'best-tools list articles',
      visits: 9800, signups: 150, runsAtLeast: [87, 23, 9],
      weeks: [0.12, 0.12, 0.13, 0.13, 0.12, 0.13, 0.12, 0.13],
      later: { p: 0.20, to: ['comparison'] },
      demos: { qualified: 1, personal: 1, small: 1, noUseCase: 1 },
    },
    {
      id: 'modelpages', label: 'Model pages', short: 'Model pages', phrase: 'model pages',
      visits: 8600, signups: 95, runsAtLeast: [33, 9, 4],
      weeks: [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125],
      later: { p: 0.10, to: ['integration'] },
      demos: { qualified: 0, personal: 1, small: 0, noUseCase: 0 },
    },
    {
      id: 'docs', label: 'Docs quickstart', short: 'Docs quickstart', phrase: 'the docs quickstart',
      visits: 5000, signups: 187, runsAtLeast: [146, 71, 47],
      weeks: [0.10, 0.11, 0.15, 0.14, 0.13, 0.13, 0.12, 0.12],
      later: { p: 0.08, to: ['comparison'] },
      demos: { qualified: 1, personal: 1, small: 1, noUseCase: 0 },
    },
    {
      id: 'nosource', label: 'No source', short: 'No source', phrase: 'signups with no recorded source',
      visits: 0, signups: 320, runsAtLeast: [176, 70, 45],
      weeks: [0.11, 0.11, 0.16, 0.14, 0.12, 0.12, 0.12, 0.12],
      later: null,
      demos: { qualified: 0, personal: 1, small: 1, noUseCase: 0 },
    },
  ];

  // 23 signups from one company domain on one day, all reading the docs
  // quickstart. The readout should hold them as one team testing.
  var BURST = { source: 'docs', week: 6, day: 3, size: '201-1000', runs: [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2], topic: 'Google Sheets cleanup' };

  // Repeat demo requests from a company that already asked. Each one copies
  // the domain of an earlier qualified request in `from` onto a later
  // signup in `to`, so the readout has duplicates to merge.
  var DUPLICATES = [
    { from: 'comparison', to: 'comparison' },
    { from: 'integration', to: 'integration' },
    { from: 'youtube', to: 'docs' },
  ];

  // Topics for the three sources whose pages each cover one use case.
  // readers = share of those pages' visits; the other two weights set how
  // often each topic shows up among signups that did and didn't activate.
  var TOPIC_SOURCES = ['youtube', 'integration', 'docs'];
  var TOPICS = [
    { name: 'Slack support replies', readers: 0.16, notActivated: 0.12, activated: 0.20, workflows: ['Draft replies to support threads', 'Daily channel summary', 'Route urgent messages'] },
    { name: 'Gmail lead follow-up', readers: 0.15, notActivated: 0.14, activated: 0.16, workflows: ['Follow up on new leads', 'Sort inbound leads', 'Draft replies to inbound email'] },
    { name: 'Google Sheets cleanup', readers: 0.17, notActivated: 0.18, activated: 0.10, workflows: ['Clean and dedupe a sheet', 'Fill missing columns', 'Weekly sheet summary'] },
    { name: 'Jira bug triage', readers: 0.10, notActivated: 0.10, activated: 0.13, workflows: ['Label and route new bugs', 'Find duplicate tickets', 'Weekly bug digest'] },
    { name: 'Notion knowledge Q&A', readers: 0.12, notActivated: 0.14, activated: 0.09, workflows: ['Answer questions from docs', 'Summarize new pages', 'Tag pages by topic'] },
    { name: 'Salesforce account notes', readers: 0.08, notActivated: 0.08, activated: 0.12, workflows: ['Write account notes after calls', 'Update fields from email', 'Account brief before a meeting'] },
    { name: 'GitHub pull request summaries', readers: 0.12, notActivated: 0.12, activated: 0.14, workflows: ['Summarize pull requests', 'Flag risky changes', 'Draft release notes'] },
    { name: 'Calendar scheduling', readers: 0.10, notActivated: 0.12, activated: 0.06, workflows: ['Find meeting times', 'Prep notes before meetings', 'Fix calendar conflicts'] },
  ];
  var WORKFLOW_WEIGHTS = [0.55, 0.30, 0.15];

  // What a comparison-page reader was comparing against. Generic categories only.
  var PAIRINGS = ['vs. a no-code automation tool', 'vs. a code-first agent framework', 'vs. building it in-house', 'vs. a chatbot builder', 'vs. an enterprise integration suite'];
  var PAIRING_WEIGHTS = [0.32, 0.26, 0.16, 0.14, 0.12];
  var PAIRING_QUALIFIED_WEIGHTS = [0.15, 0.15, 0.45, 0.05, 0.20];

  // Activity that can't be tied to a person. Shown on its own, never added to signups.
  var OPEN_SOURCE = {
    stars: [180, 210, 1450, 620, 420, 400, 420, 400],
    selfHostPings: [95, 110, 230, 190, 170, 165, 170, 170],
  };

  // Synthetic week 1 numbers for the three tests on the Next Tests page.
  var NEXT_TESTS_WEEK1 = [
    { visits: 640, signups: 31, activated: 12, qualifiedDemos: 1 },
    { visits: 410, signups: 18, activated: 6, qualifiedDemos: 2 },
    { visits: 2900, signups: 44, activated: 9, qualifiedDemos: 0 },
  ];

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Split a whole number across weights so the parts add up exactly.
  function allocate(total, weights) {
    var sum = 0;
    weights.forEach(function (w) { sum += w; });
    if (!total || !sum) return weights.map(function () { return 0; });
    var raw = weights.map(function (w) { return (total * w) / sum; });
    var parts = raw.map(Math.floor);
    var left = total - parts.reduce(function (a, b) { return a + b; }, 0);
    var order = raw.map(function (r, i) { return { i: i, frac: r - parts[i] }; })
      .sort(function (a, b) { return b.frac - a.frac || a.i - b.i; });
    for (var k = 0; k < left; k++) parts[order[k].i] += 1;
    return parts;
  }

  function pad4(n) { return ('000' + n).slice(-4); }

  function generate(seed) {
    var rand = mulberry32(seed);

    function pick(weights) {
      var sum = 0;
      weights.forEach(function (w) { sum += w; });
      var r = rand() * sum;
      for (var i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    }
    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    var pool = [];
    for (var p = 1; p <= 9999; p++) pool.push(p);
    shuffle(pool);
    var poolAt = 0;
    function newDomain() { return 'company-' + pad4(pool[poolAt++]) + '.example'; }

    function runsList(n, atLeast) {
      var list = [];
      var i;
      for (i = 0; i < n - atLeast[0]; i++) list.push(0);
      for (i = 0; i < atLeast[0] - atLeast[1]; i++) list.push(rand() < 0.65 ? 1 : 2);
      for (i = 0; i < atLeast[1] - atLeast[2]; i++) list.push(rand() < 0.6 ? 3 : 4);
      for (i = 0; i < atLeast[2]; i++) list.push(5 + Math.floor(Math.pow(rand(), 2) * 16));
      return shuffle(list);
    }

    function touchesFor(src, runs) {
      if (src.id === 'nosource') return [];
      var touches = [src.id];
      if (!src.later) return touches;
      var chance = runs >= 3 && src.later.pActivated != null ? src.later.pActivated : src.later.p;
      if (rand() < chance) {
        var second = src.later.to[Math.floor(rand() * src.later.to.length)];
        touches.push(second);
        if (src.later.third && rand() < src.later.third) {
          var rest = src.later.to.filter(function (x) { return x !== second; });
          if (rest.length) touches.push(rest[0]);
        }
      }
      return touches;
    }

    var rows = [];
    var bySource = {};
    SOURCES.forEach(function (src) {
      var weekCounts = allocate(src.signups, src.weeks);
      var weeks = [];
      weekCounts.forEach(function (c, w) { for (var k = 0; k < c; k++) weeks.push(w + 1); });
      shuffle(weeks);
      var runs = runsList(src.signups, src.runsAtLeast);
      var list = [];
      for (var i = 0; i < src.signups; i++) {
        var work = rand() >= PERSONAL_EMAIL_SHARE;
        var row = {
          id: null,
          week: weeks[i],
          day: 1 + Math.floor(rand() * 7),
          touches: null,
          emailType: work ? 'work' : 'personal',
          companyDomain: work ? newDomain() : null,
          companySize: SIZES[pick(SIZE_WEIGHTS)],
          runs7d: runs[i],
          demoRequested: false,
          useCaseStated: rand() < USE_CASE_SHARE,
          topic: null,
          firstWorkflow: null,
          pairing: null,
          _order: rows.length,
          _source: src.id,
        };
        row.touches = touchesFor(src, row.runs7d);
        list.push(row);
        rows.push(row);
      }
      bySource[src.id] = list;
    });

    // The burst: one company, one day, 23 signups.
    var burstDomain = newDomain();
    var burstRuns = shuffle(BURST.runs.slice());
    burstRuns.forEach(function (r) {
      rows.push({
        id: null, week: BURST.week, day: BURST.day, touches: [BURST.source], emailType: 'work',
        companyDomain: burstDomain, companySize: BURST.size, runs7d: r, demoRequested: false,
        useCaseStated: false, topic: BURST.topic, firstWorkflow: null, pairing: null,
        _order: rows.length, _source: BURST.source, _burst: true,
      });
    });

    // Demo requests, each built to count or to miss for one clear reason.
    function makeQualified(row) {
      row.emailType = 'work';
      if (!row.companyDomain) row.companyDomain = newDomain();
      row.companySize = SIZES[3 + pick([0.6, 0.4])];
      row.useCaseStated = true;
      row.demoRequested = true;
    }
    SOURCES.forEach(function (src) {
      var d = src.demos;
      var total = d.qualified + d.personal + d.small + d.noUseCase;
      if (!total) return;
      var picks = shuffle(bySource[src.id].slice()).slice(0, total);
      picks.forEach(function (row, i) {
        if (i < d.qualified) {
          makeQualified(row);
          row._qualified = true;
        } else if (i < d.qualified + d.personal) {
          row.emailType = 'personal';
          row.companyDomain = null;
          row.useCaseStated = true;
          row.demoRequested = true;
        } else if (i < d.qualified + d.personal + d.small) {
          row.emailType = 'work';
          if (!row.companyDomain) row.companyDomain = newDomain();
          row.companySize = SIZES[pick([0.4, 0.35, 0.25])];
          row.useCaseStated = true;
          row.demoRequested = true;
        } else {
          row.emailType = 'work';
          if (!row.companyDomain) row.companyDomain = newDomain();
          row.companySize = SIZES[3 + pick([0.6, 0.4])];
          row.useCaseStated = false;
          row.demoRequested = true;
        }
      });
    });

    DUPLICATES.forEach(function (dup) {
      var origin = bySource[dup.from]
        .filter(function (r) { return r._qualified && r.week <= WEEKS - 2; })
        .sort(function (a, b) { return a.week - b.week || a.day - b.day || a._order - b._order; })[0];
      if (!origin) return;
      var targets = bySource[dup.to].filter(function (r) { return !r.demoRequested && r.week > origin.week; });
      if (!targets.length) return;
      var target = targets[Math.floor(rand() * targets.length)];
      target.emailType = 'work';
      target.companyDomain = origin.companyDomain;
      target.companySize = SIZES[3 + pick([0.6, 0.4])];
      target.useCaseStated = true;
      target.demoRequested = true;
    });

    // Topics and first workflows.
    rows.forEach(function (row) {
      var readsTopicPage = row.touches.some(function (t) { return TOPIC_SOURCES.indexOf(t) >= 0; });
      var topicObj = null;
      if (row._burst) {
        topicObj = TOPICS.filter(function (t) { return t.name === BURST.topic; })[0];
      } else if (readsTopicPage) {
        topicObj = TOPICS[pick(TOPICS.map(function (t) { return row.runs7d >= 3 ? t.activated : t.notActivated; }))];
      }
      row.topic = topicObj ? topicObj.name : null;
      if (row.runs7d >= 1) {
        var from = topicObj || TOPICS[pick(TOPICS.map(function (t) { return t.notActivated; }))];
        row.firstWorkflow = from.workflows[pick(WORKFLOW_WEIGHTS)];
      }
    });

    // Comparison pairings.
    rows.forEach(function (row) {
      if (row.touches.indexOf('comparison') < 0) return;
      var weights = row._qualified && row.touches[0] === 'comparison' ? PAIRING_QUALIFIED_WEIGHTS : PAIRING_WEIGHTS;
      row.pairing = PAIRINGS[pick(weights)];
    });

    // Stable ids in time order.
    rows.sort(function (a, b) { return a.week - b.week || a.day - b.day || a._order - b._order; });
    var signups = rows.map(function (row, i) {
      return {
        id: 'S' + pad4(i + 1),
        week: row.week,
        day: row.day,
        touches: row.touches,
        emailType: row.emailType,
        companyDomain: row.companyDomain,
        companySize: row.companySize,
        runs7d: row.runs7d,
        demoRequested: row.demoRequested,
        useCaseStated: row.useCaseStated,
        topic: row.topic,
        firstWorkflow: row.firstWorkflow,
        pairing: row.pairing,
      };
    });

    var topicReaders = TOPICS.map(function () { return 0; });
    TOPIC_SOURCES.forEach(function (id) {
      var src = SOURCES.filter(function (s) { return s.id === id; })[0];
      allocate(src.visits, TOPICS.map(function (t) { return t.readers; })).forEach(function (n, i) { topicReaders[i] += n; });
    });

    return {
      seed: seed,
      weeks: WEEKS,
      sizes: SIZES.slice(),
      sources: SOURCES.map(function (s) {
        return {
          id: s.id, label: s.label, short: s.short, phrase: s.phrase, visits: s.visits,
          visitsByWeek: allocate(s.visits, s.weeks),
          startWeek: s.weeks.findIndex(function (w) { return w > 0; }) + 1,
        };
      }),
      targets: SOURCES.reduce(function (acc, s) {
        var d = s.demos;
        acc[s.id] = {
          visits: s.visits,
          signups: s.signups + (s.id === BURST.source ? BURST.runs.length : 0),
          activatedAt: { 1: s.runsAtLeast[0], 3: s.runsAtLeast[1], 5: s.runsAtLeast[2] },
          demoRequests: d.qualified + d.personal + d.small + d.noUseCase,
          qualifiedDemos: d.qualified,
        };
        return acc;
      }, {}),
      topicSources: TOPIC_SOURCES.slice(),
      topics: TOPICS.map(function (t, i) { return { name: t.name, readers: topicReaders[i] }; }),
      pairings: PAIRINGS.slice(),
      signups: signups,
      openSource: { stars: OPEN_SOURCE.stars.slice(), selfHostPings: OPEN_SOURCE.selfHostPings.slice() },
      nextTestsWeek1: NEXT_TESTS_WEEK1.map(function (t) { return Object.assign({}, t); }),
    };
  }

  root.ChannelData = { SEED: SEED, mulberry32: mulberry32, allocate: allocate, generate: generate };
  root.CHANNEL_DATA = generate(SEED);
})(typeof globalThis !== 'undefined' ? globalThis : window);
