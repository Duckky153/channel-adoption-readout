// Page two: draws the Next Tests plan. Every rule lives in readout.mjs; this file only renders.
(function () {
  'use strict';

  const R = window.ChannelReadout;
  const D = window.CHANNEL_DATA;
  const $ = (id) => document.getElementById(id);

  if (!R || !D) {
    $('result').textContent = 'Could not load data.js or readout.mjs. Keep all the files in the same folder.';
    return;
  }

  const fmtInt = R.fmtInt;
  const fmt1 = R.fmt1;
  const plural = R.plural;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const plan = R.nextTests(D);
  const checks = R.weeklyCheck(D, plan);

  $('seed-top').textContent = String(D.seed);
  $('result').textContent = R.nextSentence(plan);

  // A) Topics
  const topics = plan.topics;
  $('topic-table').querySelector('tbody').innerHTML = topics.rows.map((r, i) =>
    '<tr>' +
    '<td class="num">' + (i + 1) + '</td>' +
    '<td class="src">' + esc(r.topic) + '</td>' +
    '<td class="num">' + fmtInt(r.readers) + '</td>' +
    '<td class="num">' + fmtInt(r.signups) + '</td>' +
    '<td class="num">' + fmtInt(r.activated) + '</td>' +
    '<td class="num">' + fmt1(r.perThousand) + '</td>' +
    '<td class="num">' + r.qualifiedDemos + '</td>' +
    '<td>' + (r.topWorkflow ? esc(r.topWorkflow.name) + ' <span class="muted">(' + r.topWorkflow.count + ')</span>' : 'n/a') + '</td>' +
    '</tr>').join('');
  const t = topics.totals;
  $('topic-table').querySelector('tfoot').innerHTML =
    '<tr><td></td><th scope="row">All topics</th><td class="num">' + fmtInt(t.readers) + '</td><td class="num">' + fmtInt(t.signups) +
    '</td><td class="num">' + fmtInt(t.activated) + '</td><td class="num">' + fmt1(t.readers ? (t.activated / t.readers) * 1000 : null) +
    '</td><td class="num">' + t.qualifiedDemos + '</td><td></td></tr>';

  // B) The bar and the three cards
  const bar = plan.bar;
  $('bar-strip').innerHTML =
    '<span>Win bar: <b>' + fmt1(bar.winBar) + '</b> activated per 1,000 visits (median of ' + plural(bar.adoptionSources, 'Adoption source') + ')</span>' +
    '<span>Stop line: under <b>' + fmt1(bar.stopLine) + '</b></span>' +
    '<span>Minimum sample: <b>' + bar.minSignups + '</b> signups and <b>' + bar.minWeeks + '</b> weeks</span>';

  $('cards').innerHTML = plan.cards.map((c, i) =>
    '<article class="card test-card">' +
    '<p class="step">Test ' + (i + 1) + '</p>' +
    '<h3>' + esc(c.title) + '</h3>' +
    '<dl>' +
    '<dt>What to make</dt><dd>' + esc(c.make) + '</dd>' +
    '<dt>Why this one</dt><dd>' + esc(c.why) + '</dd>' +
    '<dt>The one metric</dt><dd>' + esc(c.metric) + '</dd>' +
    '<dt>Minimum sample</dt><dd>' + esc(c.sample) + '</dd>' +
    '<dt>Win bar</dt><dd>' + esc(c.win) + '</dd>' +
    '<dt>Stop rule</dt><dd>' + esc(c.stop) + '</dd>' +
    '</dl>' +
    '</article>').join('');

  // C) Weekly check
  $('weekly-table').querySelector('tbody').innerHTML = checks.map((w) =>
    '<tr>' +
    '<td class="src">' + esc(w.title) + '</td>' +
    '<td class="num">' + fmtInt(w.visits) + '</td>' +
    '<td class="num">' + fmtInt(w.signups) + '</td>' +
    '<td class="num">' + fmtInt(w.activated) + '</td>' +
    '<td class="num">' + w.qualifiedDemos + '</td>' +
    '<td class="num">' + fmt1(w.status.rate) + '</td>' +
    '<td><span class="status ' + w.status.code + '">' + esc(w.status.text) + '</span></td>' +
    '</tr>').join('');

  // Assumptions for this page
  const items = [
    'Everything here is computed from the same synthetic data as the readout (seed ' + D.seed + '), using first touch credit and activated = ' + R.RULES.defaultMinRuns + ' or more runs in the first 7 days.',
    'Topics only exist for the three sources whose pages each cover one use case: the integration how-to pages, the YouTube walkthrough and the docs quickstart. A signup credited to one of them carries the topic it read.',
    'First workflow is the first workflow a signup ran. The count in brackets is how many signups on that topic started with it.',
    'The win bar is the median activated per 1,000 visits of the sources marked Adoption in the readout. The stop line is half of it. Both are set before a test starts and do not move while it runs.',
    'A test is judged only after both ' + R.RULES.minSampleSignups + ' signups and ' + R.RULES.minSampleWeeks + ' weeks. Under the stop line before then is noted but does not end the test.',
    'Week 1 numbers for the three tests are made up to show how the check reads. They are not predictions.',
    'Not modeled: what each test costs to make, paid conversion, revenue, or whether a winning test keeps working after the first month.',
  ];
  $('assumptions').innerHTML = items.map((x) => '<li>' + esc(x) + '</li>').join('');
})();
