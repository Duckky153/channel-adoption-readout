// Page one: draws the readout. Every rule lives in readout.mjs; this file only renders.
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
  const pct = R.pct;
  const plural = R.plural;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERDICT_ORDER = { adoption: 0, mixed: 1, attention: 2, early: 3, nosource: 4 };

  const state = {
    credit: R.RULES.defaultCredit,
    minRuns: R.RULES.defaultMinRuns,
    sortKey: 'visits',
    sortDir: -1,
    selected: 'launch',
    week: 3,
  };
  const base = R.computeReadout(D, { credit: R.RULES.defaultCredit, minRuns: R.RULES.defaultMinRuns });
  let view = base;
  let flips = new Map();

  function run() {
    view = R.computeReadout(D, { credit: state.credit, minRuns: state.minRuns });
    flips = R.verdictFlips(base, view);
    $('result').textContent = R.resultSentence(view);
    renderReconcile();
    renderFlipNote();
    renderTable();
    renderDetail();
    renderScatter();
    renderSpike();
    renderExceptions();
    renderRules();
  }

  // ---------- controls ----------

  $('controls').addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'credit') state.credit = t.value;
    if (t.name === 'runs') state.minRuns = Number(t.value);
    run();
  });

  function viewName(credit, minRuns) {
    return (credit === 'last' ? 'last touch' : 'first touch') + ', ' + minRuns + (minRuns === 1 ? ' run' : ' runs');
  }

  function renderReconcile() {
    const other = R.computeReadout(D, { credit: state.credit === 'last' ? 'first' : 'last', minRuns: state.minRuns });
    const rc = view.reconciliation;
    const both = rc.ok && other.reconciliation.ok && other.reconciliation.totalSignups === rc.totalSignups;
    $('reconcile').innerHTML =
      (both ? '<span class="ok">Reconciles:</span> ' : '<span class="bad">Does not reconcile:</span> ') +
      fmtInt(rc.totalSignups) + ' signups = ' + fmtInt(rc.channelCredits) + ' channel credits + ' +
      fmtInt(rc.noSource) + ' No source + ' + fmtInt(rc.held) + ' held. ' +
      (both ? 'The same total holds under first touch and last touch.' : 'Check the data.');
  }

  function renderFlipNote() {
    const isDefault = state.credit === R.RULES.defaultCredit && state.minRuns === R.RULES.defaultMinRuns;
    if (isDefault) {
      $('flip-note').textContent = 'Default view: first touch, activated = 3 or more runs in the first 7 days. Change either control and any verdict that flips is highlighted.';
      return;
    }
    if (!flips.size) {
      $('flip-note').textContent = 'No verdict changed from the default view (first touch, 3 runs).';
      return;
    }
    const names = Array.from(flips.keys()).map((id) => view.rows.find((r) => r.id === id).short);
    $('flip-note').innerHTML = '<mark>' + plural(flips.size, 'verdict') + ' flipped</mark> from the default view (first touch, 3 runs): ' + esc(names.join(', ')) + '.';
  }

  // ---------- table ----------

  function sortValue(row, key) {
    if (key === 'label') return row.label.toLowerCase();
    if (key === 'verdict') return VERDICT_ORDER[row.verdict];
    const v = row[key];
    return v == null ? -Infinity : v;
  }

  function heldBySource() {
    const map = new Map();
    view.bursts.forEach((b) => {
      if (b.sources.length === 1) map.set(b.sources[0], (map.get(b.sources[0]) || 0) + b.count);
    });
    return map;
  }

  function verdictTag(row) {
    let html = '<span class="tag v-' + row.verdict + '">' + esc(row.verdictLabel) + '</span>';
    const f = flips.get(row.id);
    if (f) html += '<span class="was">was ' + esc(f.fromLabel) + '</span>';
    return html;
  }

  function renderTable() {
    const rows = view.rows.slice().sort((a, b) => {
      const va = sortValue(a, state.sortKey);
      const vb = sortValue(b, state.sortKey);
      if (va < vb) return -1 * state.sortDir;
      if (va > vb) return 1 * state.sortDir;
      return b.visits - a.visits || (a.label < b.label ? -1 : 1);
    });
    const held = heldBySource();
    const tbody = $('source-table').querySelector('tbody');
    tbody.innerHTML = rows.map((r) => {
      const heldNote = held.get(r.id) ? '<span class="sub">+' + held.get(r.id) + ' held</span>' : '';
      return '<tr data-id="' + r.id + '" tabindex="0" class="' + (r.id === state.selected ? 'selected' : '') + '" aria-selected="' + (r.id === state.selected) + '">' +
        '<td class="src">' + esc(r.label) + '</td>' +
        '<td class="num">' + (r.visits ? fmtInt(r.visits) : 'n/a') + '</td>' +
        '<td class="num">' + fmtInt(r.signups) + heldNote + '</td>' +
        '<td class="num">' + fmtInt(r.activated) + '</td>' +
        '<td class="num">' + pct(r.activationRate) + '</td>' +
        '<td class="num">' + fmt1(r.perThousand) + '</td>' +
        '<td class="num">' + r.qualifiedDemos + '</td>' +
        '<td>' + verdictTag(r) + '</td>' +
        '</tr>';
    }).join('');
    $('source-table').querySelectorAll('th').forEach((th) => {
      const key = th.getAttribute('data-key');
      if (key === state.sortKey) th.setAttribute('aria-sort', state.sortDir === 1 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  $('source-table').querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('th');
    if (!th) return;
    const key = th.getAttribute('data-key');
    if (state.sortKey === key) state.sortDir *= -1;
    else {
      state.sortKey = key;
      state.sortDir = key === 'label' || key === 'verdict' ? 1 : -1;
    }
    renderTable();
  });

  function select(id) {
    state.selected = id;
    renderTable();
    renderDetail();
    renderScatter();
  }

  const tbodyEl = $('source-table').querySelector('tbody');
  tbodyEl.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) select(tr.getAttribute('data-id'));
  });
  tbodyEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    e.preventDefault();
    select(tr.getAttribute('data-id'));
    const again = tbodyEl.querySelector('tr[data-id="' + tr.getAttribute('data-id') + '"]');
    if (again) again.focus();
  });

  // ---------- detail panel ----------

  function verdictWhy(r) {
    const vs = pct(r.visitShare);
    const as = pct(r.activatedShare);
    switch (r.verdict) {
      case 'adoption':
        return as + ' of activated signups from ' + vs + ' of visits. That is at or above its share of visits (' + fmt1(r.perThousand) + ' per 1,000 visits against ' + fmt1(view.totals.overallRate) + ' overall), so Adoption.';
      case 'attention':
        return vs + ' of visits but only ' + as + ' of activated signups. Its visit share is at least twice its activated share, so Attention only.';
      case 'mixed':
        return vs + ' of visits and ' + as + ' of activated signups. Below its visit share, but not by 2x, so Mixed.';
      case 'early':
        return 'Only ' + plural(r.signups, 'credited signup') + ', under ' + R.RULES.tooEarlyMin + ', so no verdict yet. It started in week ' + r.startWeek + '.';
      default:
        return 'No recorded touch, so these signups are never credited to a channel. They still count in the totals and the overall rate.';
    }
  }

  function sparkline(r) {
    const W = 280, H = 78, top = 6, bottom = 16, left = 2, right = 2;
    const ph = H - top - bottom;
    const n = r.weekly.length;
    const slot = (W - left - right) / n;
    const max = Math.max(1, ...r.weekly.map((w) => w.signups));
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(r.label + ' signups by week: ' + r.weekly.map((w, i) => 'week ' + (i + 1) + ' ' + w.signups).join(', ')) + '">';
    r.weekly.forEach((w, i) => {
      const x = left + i * slot + slot * 0.15;
      const bw = slot * 0.7;
      const h = (w.signups / max) * ph;
      const ha = (w.activated / max) * ph;
      s += '<rect class="bar-rest" x="' + x.toFixed(1) + '" y="' + (top + ph - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"></rect>';
      s += '<rect class="bar-act" x="' + x.toFixed(1) + '" y="' + (top + ph - ha).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ha.toFixed(1) + '" rx="2"></rect>';
      s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" font-size="10">W' + (i + 1) + '</text>';
    });
    return s + '</svg>';
  }

  function renderDetail() {
    const r = view.rows.find((x) => x.id === state.selected) || view.rows[0];
    const paths = r.paths.length
      ? '<ol class="paths">' + r.paths.map((p) => '<li><span>' + esc(p.label) + '</span><span>' + plural(p.signups, 'signup') + ', ' + fmtInt(p.activated) + ' activated</span></li>').join('') + '</ol>'
      : '<p class="muted">No signups credited here in this view.</p>';
    $('detail').innerHTML =
      '<h3>' + esc(r.label) + '</h3>' + verdictTag(r) +
      '<dl class="kv">' +
      '<dt>Visits</dt><dd>' + (r.visits ? fmtInt(r.visits) : 'n/a') + '</dd>' +
      '<dt>Signups credited</dt><dd>' + fmtInt(r.signups) + '</dd>' +
      '<dt>Activated (' + state.minRuns + '+ runs)</dt><dd>' + fmtInt(r.activated) + '</dd>' +
      '<dt>Share of visits</dt><dd>' + pct(r.visitShare) + '</dd>' +
      '<dt>Share of activated</dt><dd>' + pct(r.activatedShare) + '</dd>' +
      '<dt>Qualified demos</dt><dd>' + r.qualifiedDemos + '</dd>' +
      '</dl>' +
      '<p class="why">' + esc(verdictWhy(r)) + '</p>' +
      '<p class="mini-title">Signups by week (dark = activated)</p>' + sparkline(r) +
      '<p class="mini-title">Top touch paths (' + (state.credit === 'last' ? 'last touch' : 'first touch') + ' credit)</p>' + paths;
  }

  // ---------- attention vs adoption chart ----------

  function placeLabels(items, reserved, bounds) {
    const charW = 7.1;
    const h = 13;
    const boxes = reserved.slice();
    const dots = items.map((p) => ({ x1: p.x - p.r - 1, y1: p.y - p.r - 1, x2: p.x + p.r + 1, y2: p.y + p.r + 1 }));
    const overlap = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
    return items.map((p, idx) => {
      const w = p.text.length * charW;
      const cands = [
        { anchor: 'start', x: p.x + p.r + 4, y: p.y + 4 },
        { anchor: 'end', x: p.x - p.r - 4, y: p.y + 4 },
        { anchor: 'middle', x: p.x, y: p.y - p.r - 5 },
        { anchor: 'middle', x: p.x, y: p.y + p.r + 13 },
        { anchor: 'start', x: p.x + p.r + 2, y: p.y - p.r - 3 },
        { anchor: 'start', x: p.x + p.r + 2, y: p.y + p.r + 11 },
        { anchor: 'end', x: p.x - p.r - 2, y: p.y - p.r - 3 },
        { anchor: 'end', x: p.x - p.r - 2, y: p.y + p.r + 11 },
      ];
      let best = null;
      cands.forEach((c, ci) => {
        const x1 = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
        const box = { x1, y1: c.y - h + 3, x2: x1 + w, y2: c.y + 3 };
        let score = 0;
        boxes.forEach((b) => { score += overlap(box, b); });
        dots.forEach((d, di) => { if (di !== idx) score += overlap(box, d) * 2; });
        const out = Math.max(0, bounds.x1 - box.x1) + Math.max(0, box.x2 - bounds.x2) + Math.max(0, bounds.y1 - box.y1) + Math.max(0, box.y2 - bounds.y2);
        score += out * 40 + ci * 0.01;
        if (!best || score < best.score) best = { score, c, box };
      });
      boxes.push(best.box);
      return best.c;
    });
  }

  function renderScatter() {
    const W = 480, H = 380;
    const m = { l: 50, r: 12, t: 14, b: 46 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const rows = view.rows.filter((r) => r.visits > 0);
    const maxShare = Math.max(0.05, ...rows.map((r) => Math.max(r.visitShare, r.activatedShare)));
    const max = Math.ceil(maxShare * 1.08 * 20) / 20;
    const sx = (v) => m.l + Math.sqrt(Math.max(0, v) / max) * pw;
    const sy = (v) => m.t + ph - Math.sqrt(Math.max(0, v) / max) * ph;
    const ticks = [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5].filter((t) => t <= max + 1e-9);

    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Share of visits against share of activated signups for each source">';
    ticks.forEach((t) => {
      s += '<line class="gridline" x1="' + sx(t) + '" y1="' + m.t + '" x2="' + sx(t) + '" y2="' + (m.t + ph) + '"></line>';
      s += '<line class="gridline" x1="' + m.l + '" y1="' + sy(t) + '" x2="' + (m.l + pw) + '" y2="' + sy(t) + '"></line>';
      s += '<text x="' + sx(t) + '" y="' + (m.t + ph + 16) + '" text-anchor="middle" font-size="11">' + Math.round(t * 100) + '%</text>';
      s += '<text x="' + (m.l - 6) + '" y="' + (sy(t) + 4) + '" text-anchor="end" font-size="11">' + Math.round(t * 100) + '%</text>';
    });
    s += '<g class="axis"><line x1="' + m.l + '" y1="' + (m.t + ph) + '" x2="' + (m.l + pw) + '" y2="' + (m.t + ph) + '"></line><line x1="' + m.l + '" y1="' + m.t + '" x2="' + m.l + '" y2="' + (m.t + ph) + '"></line></g>';
    s += '<text x="' + (m.l + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="12">Share of visits</text>';
    s += '<text transform="translate(13 ' + (m.t + ph / 2) + ') rotate(-90)" text-anchor="middle" font-size="12">Share of activated signups</text>';

    // Equal-shares line, with its label along the upper part of the line.
    const x0 = sx(0), y0 = sy(0), x1 = sx(max), y1 = sy(max);
    s += '<line class="diag" x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1 + '"></line>';
    const angle = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    const lx = x0 + (x1 - x0) * 0.74;
    const ly = y0 + (y1 - y0) * 0.74;
    s += '<text class="diag-label" font-size="12" text-anchor="middle" transform="translate(' + lx.toFixed(1) + ' ' + (ly - 6).toFixed(1) + ') rotate(' + angle.toFixed(1) + ')">above: adoption, below: attention</text>';
    // Rough box around the rotated label so dot labels avoid it.
    const reserved = [];
    for (let k = 0.54; k <= 0.94; k += 0.04) {
      const cx = x0 + (x1 - x0) * k;
      const cy = y0 + (y1 - y0) * k - 6;
      reserved.push({ x1: cx - 9, y1: cy - 9, x2: cx + 9, y2: cy + 5 });
    }

    const items = rows.map((r) => ({ id: r.id, x: sx(r.visitShare), y: sy(r.activatedShare), r: r.id === state.selected ? 7 : 5.5, text: r.short, verdict: r.verdict }));
    const spots = placeLabels(items, reserved, { x1: m.l + 2, y1: 2, x2: W - 2, y2: m.t + ph - 2 });
    items.forEach((p, i) => {
      const sel = p.id === state.selected ? ' sel' : '';
      s += '<circle class="pt v-' + p.verdict + sel + '" data-id="' + p.id + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.r + '"><title>' + esc(p.text) + '</title></circle>';
      s += '<text class="pt-label' + sel + '" data-id="' + p.id + '" x="' + spots[i].x.toFixed(1) + '" y="' + spots[i].y.toFixed(1) + '" text-anchor="' + spots[i].anchor + '">' + esc(p.text) + '</text>';
    });
    s += '</svg>';
    $('scatter').innerHTML = s;
  }

  $('scatter').addEventListener('click', (e) => {
    const el = e.target.closest('[data-id]');
    if (el) select(el.getAttribute('data-id'));
  });

  // ---------- trace the spike ----------

  function niceCeil(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * p;
  }

  function renderSpike() {
    const W = 480, H = 240;
    const m = { l: 44, r: 8, t: 22, b: 28 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const weeks = view.weeks;
    const max = niceCeil(Math.max(1, ...weeks.map((w) => w.total)));
    const sy = (v) => m.t + ph - (v / max) * ph;
    const slot = pw / weeks.length;
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Signups per week. Select a week to see its breakdown.">';
    [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
      const v = max * f;
      s += '<line class="gridline" x1="' + m.l + '" y1="' + sy(v) + '" x2="' + (m.l + pw) + '" y2="' + sy(v) + '"></line>';
      s += '<text x="' + (m.l - 6) + '" y="' + (sy(v) + 4) + '" text-anchor="end" font-size="11">' + fmtInt(v) + '</text>';
    });
    weeks.forEach((w, i) => {
      const x = m.l + i * slot + slot * 0.16;
      const bw = slot * 0.68;
      const credited = w.total - w.held;
      const yAct = sy(w.activated);
      const yCred = sy(credited);
      const yTot = sy(w.total);
      const sel = w.week === state.week;
      s += '<g class="bar-group' + (sel ? ' sel' : '') + '" data-week="' + w.week + '" tabindex="0" role="button" aria-pressed="' + sel + '" aria-label="Week ' + w.week + ': ' + fmtInt(w.total) + ' signups, ' + fmtInt(w.activated) + ' activated' + (w.held ? ', ' + w.held + ' held' : '') + '">';
      s += '<rect x="' + (m.l + i * slot) + '" y="' + m.t + '" width="' + slot + '" height="' + (ph + m.b) + '" fill="transparent"></rect>';
      s += '<rect class="bar-rest" x="' + x.toFixed(1) + '" y="' + yCred.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (sy(0) - yCred).toFixed(1) + '"></rect>';
      s += '<rect class="bar-act" x="' + x.toFixed(1) + '" y="' + yAct.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (sy(0) - yAct).toFixed(1) + '"></rect>';
      if (w.held) s += '<rect class="bar-held" x="' + x.toFixed(1) + '" y="' + yTot.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (yCred - yTot).toFixed(1) + '"></rect>';
      s += '<rect class="bar-outline" x="' + (x - 2).toFixed(1) + '" y="' + (yTot - 2).toFixed(1) + '" width="' + (bw + 4).toFixed(1) + '" height="' + (sy(0) - yTot + 2).toFixed(1) + '" rx="3"></rect>';
      s += '<text class="bar-total" x="' + (x + bw / 2).toFixed(1) + '" y="' + (yTot - 6).toFixed(1) + '" text-anchor="middle">' + fmtInt(w.total) + '</text>';
      s += '<text class="bar-week" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="12">W' + w.week + '</text>';
      s += '</g>';
    });
    s += '</svg>';
    $('spike-chart').innerHTML = s;
    renderWeek();
  }

  function renderWeek() {
    const w = view.weeks[state.week - 1];
    $('spike-sentence').textContent = R.spikeSentence(view, state.week);
    let rows = w.bySource.map((x) =>
      '<tr><td>' + esc(x.label) + '</td><td class="num">' + fmtInt(x.signups) + '</td><td class="num">' + pct(w.total ? x.signups / w.total : 0) +
      '</td><td class="num">' + fmtInt(x.activated) + '</td><td class="num">' + pct(x.signups ? x.activated / x.signups : 0) + '</td></tr>').join('');
    if (w.held) {
      rows += '<tr><td>Held burst (one team testing)</td><td class="num">' + w.held + '</td><td class="num">' + pct(w.held / w.total) +
        '</td><td class="num">' + w.heldActivated + '</td><td class="num">not rated</td></tr>';
    }
    $('week-table').querySelector('tbody').innerHTML = rows || '<tr><td colspan="5">No signups this week.</td></tr>';
  }

  function pickWeek(el) {
    state.week = Number(el.getAttribute('data-week'));
    renderSpike();
    const again = $('spike-chart').querySelector('[data-week="' + state.week + '"]');
    if (again) again.focus();
  }
  $('spike-chart').addEventListener('click', (e) => {
    const g = e.target.closest('[data-week]');
    if (g) pickWeek(g);
  });
  $('spike-chart').addEventListener('keydown', (e) => {
    const g = e.target.closest('[data-week]');
    if (!g) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickWeek(g);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = state.week + (e.key === 'ArrowRight' ? 1 : -1);
      if (next >= 1 && next <= view.weeks.length) {
        state.week = next;
        renderSpike();
        const el = $('spike-chart').querySelector('[data-week="' + state.week + '"]');
        if (el) el.focus();
      }
    }
  });

  // ---------- exceptions ----------

  function renderExceptions() {
    const items = [];
    const early = view.rows.filter((r) => r.verdict === 'early');
    if (early.length) {
      items.push('<li><strong>Too early to judge</strong>' + early.map((r) => esc(r.label) + ': ' + plural(r.signups, 'credited signup') + ', started in week ' + r.startWeek).join('. ') +
        '. Under ' + R.RULES.tooEarlyMin + ' signups, a rate swings too much on a few people to rank.</li>');
    }
    const ns = view.rows.find((r) => r.id === R.NO_SOURCE);
    if (ns) {
      items.push('<li><strong>No source</strong>' + plural(ns.signups, 'signup') + ' had no recorded touch, and ' + fmtInt(ns.activated) + ' of them activated. They stay in No source and are never spread across channels.</li>');
    }
    view.bursts.forEach((b) => {
      const srcLabel = b.sources.map((id) => view.rows.find((r) => r.id === id).label).join(', ');
      items.push('<li><strong>Held burst</strong>' + b.count + ' signups from ' + esc(b.domain) + ' in week ' + b.week + ', day ' + b.day + ', all through ' + esc(srcLabel) +
        '. Held as likely one team testing and left out of every rate. ' + fmtInt(b.activated) + ' of them reached ' + state.minRuns + (state.minRuns === 1 ? ' run' : ' runs') + '.</li>');
    });
    const nc = view.demos.notCounted;
    const notCounted = nc.personal + nc.small + nc.nouse;
    items.push('<li><strong>Demo requests not counted</strong>' + fmtInt(view.demos.requests) + ' demo requests, ' + view.demos.qualified + ' qualified. Not counted, checked in this order:' +
      '<ul><li>' + R.DEMO_REASONS.personal + ': ' + nc.personal + '</li><li>' + R.DEMO_REASONS.small + ': ' + nc.small + '</li><li>' + R.DEMO_REASONS.nouse + ': ' + nc.nouse + '</li>' +
      '<li>Repeat request from a company already counted: ' + view.demos.duplicates.length + '</li></ul>' +
      '<span class="muted">' + fmtInt(notCounted + view.demos.duplicates.length + view.demos.qualified) + ' in all, which matches the request count.</span></li>');
    if (view.demos.duplicates.length) {
      const label = (id) => view.rows.find((r) => r.id === id).label;
      items.push('<li><strong>Merged duplicates</strong>Counted once, credited to the earlier request:<ul>' +
        view.demos.duplicates.map((d) => '<li>' + esc(d.domain) + ': first request ' + d.keptId + ' (' + esc(label(d.keptSource)) + '), repeat ' + d.signupId + ' (' + esc(label(d.repeatSource)) + ')</li>').join('') +
        '</ul></li>');
    }
    $('exceptions').innerHTML = items.join('');
  }

  // ---------- open-source panel (fixed) ----------

  function miniBars(values, label) {
    const W = 260, H = 64, top = 4, bottom = 14;
    const ph = H - top - bottom;
    const slot = W / values.length;
    const max = Math.max(1, ...values);
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label + ' by week: ' + values.join(', ')) + '">';
    values.forEach((v, i) => {
      const h = (v / max) * ph;
      const x = i * slot + slot * 0.18;
      s += '<rect class="bar-rest" x="' + x.toFixed(1) + '" y="' + (top + ph - h).toFixed(1) + '" width="' + (slot * 0.64).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"></rect>';
      s += '<text x="' + (x + slot * 0.32).toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="10">W' + (i + 1) + '</text>';
    });
    return s + '</svg>';
  }

  function renderOpenSource() {
    const os = D.openSource;
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const peak = (a) => a.indexOf(Math.max(...a)) + 1;
    const card = (title, values, note) =>
      '<div class="card"><p class="mini-title" style="margin-top:0">' + esc(title) + '</p><div class="stat">+' + fmtInt(sum(values)) + '</div>' +
      '<p class="muted" style="font-size:0.85rem">' + esc(note) + ' Peak in week ' + peak(values) + '.</p>' + miniBars(values, title) + '</div>';
    $('os-panel').innerHTML =
      card('Repository stars', os.stars, 'Over Weeks 1-8.') +
      card('Self-host install pings', os.selfHostPings, 'New installs reporting in, over Weeks 1-8.') +
      '<div class="card"><p class="mini-title" style="margin-top:0">Why it stays separate</p><p style="font-size:0.9rem">A star or an install ping has no email and no signup behind it, so there is no person to credit. Adding these to signups would make the launch week look like adoption when the readout can\'t see who, if anyone, kept using it.</p></div>';
  }

  // ---------- rules with live counts ----------

  function renderRules() {
    const t = view.totals;
    const ns = view.rows.find((r) => r.id === R.NO_SOURCE);
    const early = view.rows.filter((r) => r.verdict === 'early').map((r) => r.short);
    const rules = [
      ['R1', 'Credit', 'Each signup gives exactly one credit, to its first touch by default or its last touch when you switch, so credits always add up to total signups.',
        fmtInt(view.reconciliation.channelCredits) + ' channel credits + ' + fmtInt(view.reconciliation.noSource) + ' No source + ' + view.reconciliation.held + ' held = ' + fmtInt(t.signups) + ' signups (' + viewName(state.credit, state.minRuns) + ').'],
      ['R2', 'No source', 'Signups with no recorded touch stay in No source and are never spread across channels.',
        plural(ns.signups, 'signup') + ' with no touch, ' + fmtInt(ns.activated) + ' activated.'],
      ['R3', 'Activated', 'A signup counts as activated when its workflows ran at least 3 times in its first 7 days; the selector changes 3 to 1 or 5 and highlights any verdict that flips.',
        fmtInt(t.activated) + ' activated at ' + state.minRuns + '+ runs; ' + plural(flips.size, 'verdict') + ' differ from the default view.'],
      ['R4', 'Qualified demo', 'A demo request counts only with a work email, a company of 201+ people and a stated use case, and repeat requests from one company domain count once.',
        view.demos.qualified + ' of ' + view.demos.requests + ' demo requests count.'],
      ['R5', 'Too early', 'A source with fewer than ' + R.RULES.tooEarlyMin + ' credited signups shows Too early to judge instead of a verdict.',
        early.length ? early.join(' and ') + '.' : 'No source is under the line in this view.'],
      ['R6', 'Verdict', 'Adoption when a source\'s activated per 1,000 visits is at or above the overall rate; Attention only when its share of visits is at least twice its share of activated signups; otherwise Mixed.',
        'Overall rate: ' + fmt1(t.overallRate) + ' activated per 1,000 visits.'],
      ['R7', 'Held burst', R.RULES.burstMin + ' or more signups from one company domain within one day are held as likely one team testing, left out of the rates and listed under Exceptions.',
        view.bursts.length ? plural(t.held, 'signup') + ' held from ' + plural(view.bursts.length, 'burst') + '.' : 'Nothing held.'],
      ['R8', 'Open source', 'Repository stars and self-host install pings can\'t be tied to a person, so they appear in their own panel and are never added to signups.',
        '+' + fmtInt(D.openSource.stars.reduce((a, b) => a + b, 0)) + ' stars and +' + fmtInt(D.openSource.selfHostPings.reduce((a, b) => a + b, 0)) + ' self-host pings, in no total above.'],
    ];
    $('rules').innerHTML = rules.map((r) =>
      '<li><span class="rid">' + r[0] + '</span><span><strong>' + esc(r[1]) + ':</strong> ' + esc(r[2]) + '</span><span class="live">' + esc(r[3]) + '</span></li>').join('');
  }

  // ---------- assumptions (fixed) ----------

  function renderAssumptions() {
    const items = [
      'All data is synthetic. A seeded random generator (mulberry32, seed ' + D.seed + ') builds ' + fmtInt(D.signups.length) + ' signup rows from per-source settings in data.js, so every refresh shows the same numbers.',
      'The subject is a free-to-start, open-source workflow product with a cloud signup and a demo-request form. Company domains end in .example, a reserved test domain.',
      'A signup\'s touches are the tracked posts or pages it came through before signing up, in order, up to three. Visits are counted per source per week and stay the same in both credit views; only signups, activations and demos move.',
      'Activated means workflow runs in the first 7 days after signup (3 or more by default). Qualified demo means a work email, a company of 201+ people and a stated use case, once per company domain.',
      'The overall rate and both shares count every activated signup, No source included, because those people are real. No source is never credited to a channel, but it does raise the bar every channel is measured against.',
      'Held signups are left out of every rate, share and demo count. They appear only in the reconciliation line, the spike chart and Exceptions.',
      'Not modeled: paid conversion, revenue, sales cycle length, accounts with several users, people who switch devices, or how long activated people keep using the product after week one.',
    ];
    $('assumptions').innerHTML = items.map((x) => '<li>' + esc(x) + '</li>').join('');
    $('seed-top').textContent = String(D.seed);
  }

  renderOpenSource();
  renderAssumptions();
  run();
})();
