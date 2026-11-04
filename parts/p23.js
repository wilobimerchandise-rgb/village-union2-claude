/* =========================================================
   ROUND 9 / #11: owner Insights
   Collection rate per village, activity, sponsor revenue by month,
   rating trend. Plain HTML/SVG, hover + keyboard tooltips, table views.
   ========================================================= */
const MON_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function lastMonths(n) { const d = new Date(), out = []; for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push({ key: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`, label: MON_NAMES[x.getMonth()], title: `${MON_NAMES[x.getMonth()]} ${x.getFullYear()}` }); } return out; }
function villageInsight(v, vil) {
  const yr = new Date().getFullYear(), fixed = (v.levyList || []).filter(l => l.fixed), members = v.users.filter(u => u.role === 'member' && u.active), paid = new Map();
  let latest = 0, recent = 0; const now = Date.now();
  v.tx.forEach(t => { const ts = new Date(t.submittedAt || t.date).getTime() || 0; if (ts > latest) latest = ts; if (now - ts < 30 * 864e5) recent++; if (t.status === 'verified' && yearOf(t.date) === yr) { const k = t.memberId + '|' + t.levy; paid.set(k, (paid.get(k) || 0) + (Number(t.amount) || 0)); } });
  let need = 0, got = 0; members.forEach(m => fixed.forEach(l => { const n = v.settings.levies[l.id] || 0; need += n; got += Math.min(n, paid.get(m.id + '|' + l.id) || 0); }));
  return { vil, v, members: members.length, need, got, rate: need ? got / need : 0, latest, recent, live: !(vil.removed) && v.status !== 'suspended', status: vil.removed ? 'Removed' : v.status === 'suspended' ? 'Paused' : v.status === 'readonly' ? 'Read-only' : 'Active', plan: v.plan === 'premium' ? 'Premium' : 'Basic' };
}
function activityBand(r) { if (!r.latest) return ['Dormant', 'No records yet']; const d = (Date.now() - r.latest) / 864e5; return d <= 30 ? ['Active', 'Activity in the last 30 days'] : d <= 90 ? ['Quiet', 'Last activity 1 to 3 months ago'] : ['Dormant', 'Nothing for over 3 months']; }

/* one shared tooltip for every chart mark (hover, focus, touch) */
(function vzTip() {
  const tip = document.createElement('div'); tip.className = 'vz-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  const show = el => { tip.innerHTML = el.dataset.tip; tip.hidden = false; const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect(); let x = r.left + r.width / 2 - t.width / 2, y = r.top - t.height - 8; if (y < 4) y = r.bottom + 8; x = Math.max(8, Math.min(innerWidth - t.width - 8, x)); tip.style.left = x + 'px'; tip.style.top = y + 'px'; };
  const hide = () => { tip.hidden = true; };
  document.addEventListener('mouseover', e => { const m = e.target.closest && e.target.closest('[data-tip]'); if (m) show(m); else hide(); });
  document.addEventListener('focusin', e => { const m = e.target.closest && e.target.closest('[data-tip]'); if (m) show(m); });
  document.addEventListener('focusout', hide); document.addEventListener('scroll', hide, true); document.addEventListener('touchstart', e => { const m = e.target.closest && e.target.closest('[data-tip]'); if (m) show(m); else hide(); }, { passive: true });
})();

const pct = n => Math.round(n * 100) + '%';
function barRows(rows, fmtTip) {
  const max = 1;
  return `<div class="vz-bars" role="list">${rows.map(r => `<div class="vz-row" role="listitem"><div class="vz-lab">${esc(r.label)}<small>${esc(r.sub || '')}</small></div><div class="vz-track"><div class="vz-bar" style="width:${Math.max(.8, r.value / max * 100).toFixed(1)}%" tabindex="0" data-tip="${esc(fmtTip(r))}" aria-label="${esc(fmtTip(r).replace(/<[^>]+>/g, ' '))}"></div></div><div class="vz-val">${pct(r.value)}</div></div>`).join('')}</div>`;
}
function columnChart(points, unit, fmt) {
  const W = 520, H = 220, L = 46, R = 8, T = 14, B = 28, max = Math.max(1, ...points.map(p => p.v)), nice = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / nice * 2) / 2 * nice || 1, bw = (W - L - R) / points.length;
  const y = v => T + (H - T - B) * (1 - v / top), grid = [0, .5, 1].map(f => f * top);
  return `<svg class="vz-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)} by month">${grid.map(g => `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="vz-grid"/><text x="${L - 6}" y="${y(g) + 4}" class="vz-ax" text-anchor="end">${esc(fmt(g, true))}</text>`).join('')}
  ${points.map((p, i) => { const x = L + i * bw + bw * .18, w = bw * .64, h = Math.max(0, (H - T - B) * p.v / top); return `<g><path d="M${x} ${T + (H - T - B)} v${-Math.max(0, h - 4)} q0 -4 4 -4 h${w - 8} q4 0 4 4 v${Math.max(0, h - 4)} z" class="vz-col" tabindex="0" data-tip="${esc(p.title)}<br><b>${esc(fmt(p.v))}</b>" aria-label="${esc(p.title + ': ' + fmt(p.v))}"/><text x="${x + w / 2}" y="${H - 8}" class="vz-ax" text-anchor="middle">${esc(p.label)}</text></g>`; }).join('')}</svg>`;
}
function lineChart(points) {
  const W = 520, H = 220, L = 34, R = 14, T = 14, B = 28, x = i => L + (W - L - R) * (points.length === 1 ? .5 : i / (points.length - 1)), y = v => T + (H - T - B) * (1 - (v - 1) / 4), have = points.filter(p => p.n);
  let d = '', pen = false; points.forEach((p, i) => { if (!p.n) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.avg).toFixed(1)} `; pen = true; });
  return `<svg class="vz-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average rating by month">${[1, 2, 3, 4, 5].map(g => `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="vz-grid"/><text x="${L - 6}" y="${y(g) + 4}" class="vz-ax" text-anchor="end">${g}</text>`).join('')}
  <path d="${d}" class="vz-line"/>${points.map((p, i) => p.n ? `<circle cx="${x(i)}" cy="${y(p.avg)}" r="5" class="vz-dot" tabindex="0" data-tip="${esc(p.title)}<br><b>${p.avg.toFixed(1)} / 5</b> from ${p.n} rating${p.n === 1 ? '' : 's'}" aria-label="${esc(p.title + ': ' + p.avg.toFixed(1) + ' from ' + p.n + ' ratings')}"/>` : '').join('')}
  ${points.map((p, i) => `<text x="${x(i)}" y="${H - 8}" class="vz-ax" text-anchor="middle">${esc(p.label)}</text>`).join('')}</svg>`;
}
const tableView = (heads, rows) => `<details class="vz-table"><summary>View as a table</summary>${table(heads, rows, ['No data', ''])}</details>`;

OWNERV['o-insights'] = function () {
  const rows = VILLAGES.map(vil => ({ vil, v: DB.cache[vil.id] })).filter(r => r.v && !r.vil.removed).map(r => villageInsight(r.v, r.vil)), live = rows.filter(r => r.live);
  const ranked = live.filter(r => r.need > 0).sort((a, b) => b.rate - a.rate), bands = rows.map(r => ({ r, b: activityBand(r) }));
  const activeN = bands.filter(x => x.b[0] === 'Active').length, totNeed = sum(live, 'need'), totGot = sum(live, 'got');
  const months = lastMonths(6), pay = SPN.load().payments, rev = months.map(m => Object.assign({}, m, { v: pay.filter(p => String(p.paid_at).slice(0, 7) === m.key).reduce((a, p) => a + (Number(p.amount_kobo) || 0) / 100, 0) }));
  const revTotal = sum(rev, 'v'), rv = RV.load(), trend = months.map(m => { const l = rv.filter(r => String(r.ts).slice(0, 7) === m.key); return Object.assign({}, m, { n: l.length, avg: l.length ? sum(l, 'stars') / l.length : 0 }); });
  const dist = [5, 4, 3, 2, 1].map(s => ({ s, n: rv.filter(r => r.stars === s).length })), avgAll = rv.length ? (sum(rv, 'stars') / rv.length).toFixed(1) : '-';
  const money0 = (n, short) => short ? (n >= 1000 ? '₦' + Math.round(n / 1000) + 'k' : '₦' + Math.round(n)) : money(n);
  return `<div class="viz-root"><div class="kpis">${kpi('Active villages', `${activeN} of ${rows.length}`, 'Activity in the last 30 days', 'hot')}${kpi('Collected so far', totNeed ? pct(totGot / totNeed) : '-', `${money(totGot)} of ${money(totNeed)} required in ${new Date().getFullYear()}`, 'good')}${kpi('Sponsor income, 6 months', money(revTotal), 'Paid to the platform')}${kpi('Average rating', avgAll === '-' ? '-' : avgAll + ' / 5', `${rv.length} rating${rv.length === 1 ? '' : 's'}`)}</div>
  <section class="panel"><div class="panel-h"><div><h2>Collection rate by village</h2><p>Share of this year's required levies that have been paid and verified. Highest first. Hover or focus a bar for the amounts.</p></div></div>
  ${ranked.length ? barRows(ranked.map(r => ({ label: r.vil.name, sub: `${r.members} members · ${r.plan}`, value: Math.min(1, r.rate), r })), x => `${x.label}<br><b>${pct(x.value)}</b> collected<br>${money(x.r.got)} of ${money(x.r.need)}`) : '<div class="empty"><b>No data yet</b></div>'}
  ${tableView(['Village', { t: 'Members', num: true }, { t: 'Required', num: true }, { t: 'Collected', num: true }, { t: 'Rate', num: true }], ranked.map(r => [esc(r.vil.name), String(r.members), money(r.need), money(r.got), pct(r.rate)]))}</section>
  <div class="grid-2e"><section class="panel"><div class="panel-h"><div><h2>Sponsor income by month</h2><p>Sponsor payments received, last 6 months.</p></div></div>${revTotal ? columnChart(rev, 'Sponsor income', money0) : '<div class="empty"><b>No sponsor payments in this period</b></div>'}${tableView(['Month', { t: 'Income', num: true }], rev.map(m => [esc(m.title), money(m.v)]))}</section>
  <section class="panel"><div class="panel-h"><div><h2>Rating trend</h2><p>Average stars from members and admins, by month.</p></div></div>${rv.length ? lineChart(trend) : '<div class="empty"><b>No ratings yet</b>They appear after members and admins finish tasks.</div>'}
  ${rv.length ? `<div class="vz-dist">${dist.map(d => `<div class="vz-drow"><span>${d.s} ★</span><div class="vz-track"><div class="vz-bar" style="width:${rv.length ? Math.max(d.n ? 2 : 0, d.n / rv.length * 100) : 0}%" data-tip="${d.n} rating${d.n === 1 ? '' : 's'}" tabindex="0"></div></div><b>${d.n}</b></div>`).join('')}</div>` : ''}${tableView(['Month', { t: 'Ratings', num: true }, { t: 'Average', num: true }], trend.map(m => [esc(m.title), String(m.n), m.n ? m.avg.toFixed(1) : '-']))}</section></div>
  <section class="panel"><div class="panel-h"><div><h2>Village activity</h2><p>Active means a payment was recorded in the last 30 days.</p></div></div>
  ${table(['Village', 'Plan', 'Access', { t: 'Members', num: true }, 'Activity', { t: 'Rate', num: true }], bands.sort((a, b) => b.r.recent - a.r.recent).map(({ r, b }) => [esc(r.vil.name), r.plan, r.status, String(r.members), `<span class="badge ${b[0] === 'Active' ? 'b-active' : b[0] === 'Quiet' ? 'b-pending' : 'b-off'}">${b[0]}</span><small>${esc(b[1])}${r.recent ? ' · ' + r.recent + ' recent' : ''}</small>`, r.need ? pct(r.rate) : '-']), ['No villages', ''])}</section></div>`;
};
