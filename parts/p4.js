
/* ---------- Shell and navigation ---------- */
const NAV = {
  member: [['overview', 'My dashboard', 'home'], ['village', 'Village dashboard', 'village'], ['achievements', 'My achievements', 'check'], ['halloffame', 'Sponsors hall of fame', 'coin'], ['minutes', 'Minutes', 'book']],
  admin: [['overview', 'Overview', 'home'], ['verify', 'Verify payments', 'check'], ['transactions', 'Transactions', 'list'], ['outstanding', 'Outstanding bills', 'coin'], ['pledges', 'Pledges', 'coin'], ['members', 'Members', 'users'], ['admins', 'Admins and duties', 'users'], ['register', 'Register', 'book'], ['minutes', 'Minutes', 'book'], ['plans', 'Plans', 'coin'], ['expenses', 'Expenditure', 'coin'], ['levies', 'Levy categories', 'sliders'], ['profile', 'Village profile', 'village'], ['reports', 'Reports', 'file'], ['audit', 'Activity log', 'clock'], ['achievements', 'My achievements', 'check'], ['halloffame', 'Sponsors hall of fame', 'coin']],
  owner: [['o-overview', 'All villages', 'home'], ['o-villages', 'Manage villages', 'village'], ['o-admins', 'Village admins', 'users'], ['o-sponsors', 'Sponsors', 'coin'], ['o-insights', 'Insights', 'list'], ['o-reviews', 'Reviews', 'check'], ['o-log', 'Owner activity', 'clock'], ['o-account', 'My account', 'user']]
};
const TITLES = { overview: 'Overview', village: 'Village dashboard', reports: 'Reports', verify: 'Verify payments', transactions: 'Transactions', members: 'Members', expenses: 'Expenditure', levies: 'Levy categories', outstanding: 'Outstanding bills', pledges: 'Pledges', admins: 'Admins and duties', achievements: 'My achievements', halloffame: 'Sponsors hall of fame', minutes: 'Meeting minutes', plans: 'Plans and Premium', 'o-insights': 'Insights', 'o-reviews': 'Reviews', register: 'Register', profile: 'Village profile', audit: 'Activity log', 'o-overview': 'All villages', 'o-villages': 'Manage villages', 'o-admins': 'Village admins', 'o-sponsors': 'Sponsors', 'o-log': 'Owner activity', 'o-account': 'My account' };
const inOwnerConsole = () => S.owner && !S.v;
const roleKey = () => inOwnerConsole() ? 'owner' : (isAdmin() ? 'admin' : 'member');
function pageTitleText() {
  if (roleKey() === 'member' && S.page === 'overview') return 'My dashboard';
  return TITLES[S.page] || 'Overview';
}

function renderApp() {
  const ownerMode = inOwnerConsole(), vil = ownerMode ? null : vilById(S.v.id), rk = roleKey();
  const head = ownerMode
    ? `<div class="side-village"><div class="vbadge" style="background:#F5B83D;color:#1A1A4E">VV</div><div><b>Owner console</b><small>All villages</small></div></div>`
    : `<div class="side-village">${S.v.logo ? `<img class="vlogo" src="${esc(S.v.logo)}" alt="">` : `<div class="vbadge" style="background:${vil.color};color:#fff">${esc(vil.code)}</div>`}<div><b>${esc(S.v.name)}</b><small>${S.owner ? 'Owner view' : (S.v.wing ? wingLabel(S.v.wing) : 'Village or association')}</small></div></div>`;
  const who = ownerMode ? { n: OWN.data.name, s: 'Master admin' } : { n: S.u.name, s: S.owner ? 'Owner view of this village' : `${S.u.title}, ${S.u.id}` };
  const top = rk === 'member' ? '<button class="btn btn-saffron btn-sm" type="button" data-act="upload-proof">Upload proof</button>' : rk === 'admin' ? ('<button class="btn btn-saffron btn-sm" type="button" data-act="add-tx">Add payment</button>' + (S.u && S.u.id !== 'SUPPORT' && !S.owner ? '<button class="btn btn-ghost btn-sm" type="button" data-act="upload-proof">Upload my proof</button>' : '')) : '';
  $('#app').innerHTML = `<div class="shell">
    <aside class="side" id="side" aria-label="Sidebar">
      <a class="brand" href="#" data-act="home-link"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#F5B83D"/><path d="M16 6l8 5v10l-8 5-8-5V11z" fill="none" stroke="#1A1A4E" stroke-width="2.4"/><circle cx="16" cy="16" r="3" fill="#1A1A4E"/></svg><span>VillageVault</span></a>
      ${head}
      <nav class="navlist" id="navlist" aria-label="Dashboard"></nav>
      <div class="side-foot">
        <div class="who"><div class="avatar">${esc(initials(who.n))}</div><div><b>${esc(who.n)}</b><small>${esc(who.s)}</small></div></div>
        ${S.owner && S.v ? '<button class="btn-out" type="button" data-act="owner-back">Back to owner console</button>' : ''}
        <button class="btn-out" type="button" data-act="change-pw">Change password</button>
        ${S.v && !S.owner && S.u && S.u.id !== 'SUPPORT' ? '<button class="btn-out" type="button" data-act="change-username">Change username</button>' : ''}
        ${S.v && !S.owner && S.u && S.u.id !== 'SUPPORT' ? '<button class="btn-out" type="button" data-act="bio-manage">Fingerprint or face sign-in</button>' : ''}
        ${S.v && !S.owner && rememberedFor(S.v.id) ? '<button class="btn-out" type="button" data-act="forget-device">Forget this device</button>' : ''}
        <button class="btn-out" type="button" data-act="logout">${icon('out')}Sign out</button>
      </div>
    </aside>
    <div class="scrim" data-act="close-side"></div>
    <div class="main">
      <header class="topbar"><button class="icon-btn menu-btn" type="button" data-act="open-side" aria-label="Open menu">${icon('menu')}</button><div class="grow"><h1 id="pageTitle"></h1><div class="sub" id="pageSub"></div></div>${top}</header>
      <main class="view" id="view" tabindex="-1"></main>
    </div></div>`;
  renderView();
}
function renderNav() {
  const rk = roleKey(), pend = rk === 'admin' ? pendingTx().length : 0, regN = rk === 'admin' ? S.v.requests.filter(r => r.status === 'new').length + S.v.meetings.reduce((a, m) => a + m.marks.filter(k => k.status === 'pending').length, 0) : 0, owN = rk === 'admin' ? owingList(new Date().getFullYear(), {}).length : 0;
  $('#navlist').innerHTML = NAV[rk].filter(n => !(n[0] === 'minutes' && rk === 'member' && S.v && S.v.plan !== 'premium')).map(n => `<button type="button" data-act="goto" data-page="${n[0]}" class="${S.page === n[0] ? 'active' : ''}"${S.page === n[0] ? ' aria-current="page"' : ''}>${icon(n[2])}${n[1]}${n[0] === 'verify' && pend ? `<span class="count">${pend}</span>` : ''}${n[0] === 'register' && regN ? `<span class="count">${regN}</span>` : ''}${n[0] === 'outstanding' && owN ? `<span class="count count-soft">${owN}</span>` : ''}</button>`).join('');
}
function renderView() {
  const ae = document.activeElement, keep = ae && ae.dataset ? { k: ae.dataset.filter, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const rk = roleKey(), fn = (VIEWS[rk] || {})[S.page] || VIEWS[rk][NAV[rk][0][0]];
  $('#pageTitle').textContent = pageTitleText();
  $('#pageSub').textContent = rk === 'owner' ? 'Platform owner' : `${S.v.name}${S.owner ? ' (owner view)' : ''}`;
  renderNav();
  $('#view').innerHTML = fn();
  if (keep && keep.k) { const el = $(`[data-filter="${keep.k}"]`); if (el) { el.focus(); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (_) {} } }
}
function goto(p) { S.page = p; S.f = {}; document.body.classList.remove('side-open'); renderView(); window.scrollTo(0, 0); }

/* ---------- Shared transaction table ---------- */
function filterTx(list, f) {
  const q = (f.q || '').trim().toLowerCase();
  return list.filter(t => (!f.levy || t.levy === f.levy) && (!f.status || t.status === f.status) && (!f.year || yearOf(t.date) === Number(f.year)) && (!f.member || t.memberId === f.member) && (!f.month || Number(t.date.slice(5, 7)) === Number(f.month)) &&
    (!q || nameOf(t.memberId).toLowerCase().includes(q) || (t.ref || '').toLowerCase().includes(q) || t.id.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
const STATUS_OPTS = f => opt('', 'All statuses', f) + ['pending', 'verified', 'rejected', 'void'].map(s => opt(s, cap(s), f)).join('');
function txRow(t, admin) {
  const who = t.status === 'verified' || t.status === 'rejected' ? `${esc(t.verifiedBy || '')}<small>${esc(fmtTS(t.verifiedAt))}</small>` : '<small>Not yet checked</small>';
  const upd = t.updatedBy && (t.history || []).some(h => h.kind === 'edit') ? `<small>Edited by ${esc(t.updatedBy)}, ${esc(fmtTS(t.updatedAt))}</small>` : '';
  const act = admin ? `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View</button>${t.status === 'pending' ? (t.memberId === S.u.id ? '<small>Another admin must verify</small>' : `<button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Verify</button>`) : ''}${t.status === 'verified' ? `<button class="btn btn-saffron btn-sm" type="button" data-act="receipt" data-id="${t.id}">Receipt</button>` : ''}${t.status !== 'void' ? `<button class="btn btn-ghost btn-sm" type="button" data-act="edit-tx" data-id="${t.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="void-tx" data-id="${t.id}">Void</button>` : ''}</div>` : `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View</button></div>`;
  return [esc(fmtDate(t.date)), `<span class="dot" style="background:${levyOf(t.levy).color}"></span>${esc(levyOf(t.levy).name)}`]
    .concat(admin ? [`<button type="button" class="linkbtn" data-act="member-profile" data-id="${esc(t.memberId)}">${esc(nameOf(t.memberId))}</button><small>${esc(t.memberId)}</small>`] : [])
    .concat([esc(t.ref || '-'), money(t.amount), `${badge(t.status)}${t.status === 'rejected' && t.rejectReason ? `<small>${esc(t.rejectReason)}</small>` : ''}`, who + upd, act]);
}
function txTable(list, admin) {
  const f = S.f, page = paginate(list, f);
  const heads = ['Date', 'Levy'].concat(admin ? ['Member'] : []).concat(['Reference', { t: 'Amount', num: true }, 'Status', 'Checked by', { t: '', num: false }]);
  return table(heads, page.map(t => txRow(t, admin)), ['No records match', 'Try a different filter.']).replace(/<td class="num">(<div class="actions">)/g, '<td>$1') + pager(list.length, f.page, CONFIG.PER_PAGE);
}
function txDetail(id) {
  let t; try { t = getTx(id); } catch (e) { return toast(e.message, 'err'); }
  const adm = isAdmin(), L = levyOf(t.levy);
  const hist = (t.history || []).slice().reverse().map(h => `<li><b>${esc(h.text)}</b><small>${esc(h.by)}${h.byTitle ? ', ' + esc(h.byTitle) : ''} on ${esc(fmtTS(h.ts))}</small></li>`).join('');
  openModal({
    title: `${L.name}, ${money(t.amount)}`, size: 'modal-lg', submit: false,
    body: `<div class="form-row" style="margin-top:14px"><dl class="kv">
      ${adm ? `<dt>Member</dt><dd>${esc(nameOf(t.memberId))} (${esc(t.memberId)})</dd>` : ''}
      <dt>Record</dt><dd>${esc(t.id)}</dd><dt>Status</dt><dd>${badge(t.status)}</dd><dt>Payment date</dt><dd>${esc(fmtDate(t.date))}</dd><dt>Method</dt><dd>${esc(t.method)}</dd><dt>Reference</dt><dd>${esc(t.ref || '-')}</dd>
      <dt>Submitted</dt><dd>${esc(fmtTS(t.submittedAt))} by ${esc(t.submittedBy)}</dd>
      ${t.verifiedBy ? `<dt>${t.status === 'rejected' ? 'Rejected by' : 'Verified by'}</dt><dd>${esc(t.verifiedBy)}, ${esc(fmtTS(t.verifiedAt))}</dd>` : ''}
      ${t.rejectReason ? `<dt>Reason</dt><dd>${esc(t.rejectReason)}</dd>` : ''}${t.voidReason ? `<dt>Voided</dt><dd>${esc(t.voidedBy)}, ${esc(fmtTS(t.voidedAt))}: ${esc(t.voidReason)}</dd>` : ''}
      ${t.note ? `<dt>Note</dt><dd>${esc(t.note)}</dd>` : ''}
      ${t.updatedBy ? `<dt>Last updated</dt><dd>${esc(t.updatedBy)}, ${esc(fmtTS(t.updatedAt))}</dd>` : ''}</dl>
      <div><div class="lbl" style="margin-bottom:6px">Proof of payment</div>${proofHTML(proofOf(t))}</div></div>
      ${adm && t.status === 'verified' ? `<div style="margin-top:14px"><button type="button" class="btn btn-saffron btn-sm" data-act="receipt" data-id="${t.id}">${t.receiptNo ? 'Open receipt ' + esc(t.receiptNo) : 'Generate receipt'}</button></div>` : ''}
      ${hist ? `<div class="sec-title">History</div><ul class="timeline">${hist}</ul>` : ''}`
  });
}

/* ---------- Member views ---------- */
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
const MEMBER = {
  overview() {
    const yr = new Date().getFullYear(), mine = myTx(), ver = mine.filter(t => t.status === 'verified' && yearOf(t.date) === yr), pend = mine.filter(t => t.status === 'pending'), rej = mine.filter(t => t.status === 'rejected');
    const rows = levies().map(L => { const p = sum(ver.filter(t => t.levy === L.id)), need = L.fixed ? S.v.settings.levies[L.id] : 0; return { L, p, need }; });
    const out = memberOutstanding(S.u.id, yr), last = mine.filter(t => t.status === 'verified').sort((a, b) => b.date.localeCompare(a.date))[0];
    return `<div><h2 style="font-size:1.7rem">${greeting()}, ${esc(S.u.name.split(' ')[0])}.</h2><p class="muted">Here is where your payments stand for ${yr}.</p></div>
    ${membershipStrip()}
    ${rej.length ? `<div class="callout"><div><b>${rej.length} payment${rej.length > 1 ? 's were' : ' was'} rejected</b><p>See the reason in your payment records below, then upload the proof again.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof</button></div>` : ''}
    <div class="kpis">${kpi('Paid in ' + yr, money(sum(ver)), `${ver.length} verified payment${ver.length === 1 ? '' : 's'}`, 'hot')}${kpiLink('my-owing', 'Still to pay', money(out), out ? 'Tap to see what you owe and how to pay' : 'You are up to date', out ? 'bad' : 'good')}${kpi('Awaiting verification', String(pend.length), pend.length ? money(sum(pend)) + ' with the admin' : 'Nothing pending')}${kpi('Last verified payment', last ? esc(fmtDate(last.date)) : 'None yet', last ? esc(levyOf(last.levy).name) : '')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Your levies this year</h2><p>Verified payments against the amount set by your village</p></div><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof</button></div>
      <div class="progress-list">${rows.map(r => { const pc = r.need ? Math.min(100, r.p / r.need * 100) : 0; return `<div><div class="prog-top"><b>${esc(r.L.name)}</b><span>${r.L.fixed ? `${money(r.p)} of ${money(r.need)}` : `${money(r.p)} given`}</span></div><div class="bar"><i style="width:${r.L.fixed ? pc : (r.p ? 100 : 0)}%;--c:${r.L.color}"></i></div></div>`; }).join('')}</div></section>
    <section class="panel"><div class="panel-h"><h2>Recent activity</h2></div><div class="list">${mine.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6).map(t => `<div class="list-item"><div><b>${esc(levyOf(t.levy).name)}</b><small>${esc(fmtDate(t.date))}, ${money(t.amount)}</small></div>${badge(t.status)}</div>`).join('') || '<div class="empty"><b>No payments yet</b>Upload your first proof of payment.</div>'}</div></section></div>
    ${paymentPanel()}
    ${pledgePanel()}
    ${receiptsPanel()}
    ${attendanceMember()}
    ${sponsorsPanel()}
    ${MEMBER.records()}`;
  },
  records() {
    const f = S.f, list = filterTx(myTx(), f);
    return `<section class="panel"><div class="panel-h"><div><h2>My payment records</h2><p>Every proof you have sent and what the admin decided</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" type="button" data-act="export-tx">Download CSV</button><button class="btn btn-primary btn-sm" type="button" data-act="report-modal" data-scope="statement">Download my statement</button></div></div>
    <div class="toolbar"><div class="field"><label for="fl">Levy</label><select id="fl" class="select" data-filter="levy">${levyOpts(f.levy, 'All levies')}</select></div>
    <div class="field"><label for="fs">Status</label><select id="fs" class="select" data-filter="status">${STATUS_OPTS(f.status)}</select></div>
    <div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div></div>
    ${txTable(list, false)}</section>`;
  },
  village() {
    const f = S.f, tab = S.tab, yr = new Date().getFullYear(), ver = villageTx(), ex = activeExp();
    const inY = ver.filter(t => yearOf(t.date) === yr), exY = ex.filter(e => yearOf(e.date) === yr);
    const bal = sum(ver) - sum(ex), names = CONFIG.SHOW_MEMBER_NAMES_IN_VILLAGE_LEDGER;
    let body;
    if (tab === 'collections') {
      const list = filterTx(ver, f).map(t => t), page = paginate(list, f);
      body = `<div class="toolbar"><div class="field"><label for="fl">Levy</label><select id="fl" class="select" data-filter="levy">${levyOpts(f.levy, 'All levies')}</select></div><div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div>
        <div class="field"><label for="fm">Month</label><select id="fm" class="select" data-filter="month">${opt('', 'All months', f.month)}${MONTHS.map((m, i) => opt(i + 1, m, f.month)).join('')}</select></div></div>
        ${table(['Date', 'Levy'].concat(names ? ['Member'] : []).concat([{ t: 'Amount', num: true }]), page.map(t => [esc(fmtDate(t.date)), `<span class="dot" style="background:${levyOf(t.levy).color}"></span>${esc(levyOf(t.levy).name)}`].concat(names ? [esc(nameOf(t.memberId))] : []).concat([money(t.amount)])), ['No collections match', 'Try a different filter.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}`;
    } else {
      const list = ex.slice().sort((a, b) => b.date.localeCompare(a.date)), page = paginate(list, f);
      body = table(['Date', 'Category', 'Description', { t: 'Amount', num: true }], page.map(e => [esc(fmtDate(e.date)), esc(e.category), esc(e.description), money(e.amount)]), ['No spending recorded', '']) + pager(list.length, f.page, CONFIG.PER_PAGE);
    }
    return `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><p class="muted">Read-only view of ${esc(S.v.name)}'s collections, spending and admin activity. Only admins can change records.</p><button class="btn btn-primary btn-sm" type="button" data-act="report-modal" data-scope="village">Download village report</button></div>
    <div class="kpis">${kpi(balLabel(), money(bal), 'All income less all spending', 'hot')}${kpi('Collected in ' + yr, money(sum(inY)), `${inY.length} verified payments`)}${kpi('Spent in ' + yr, money(sum(exY)), `${exY.length} items`)}${kpi('Active members', String(S.v.users.filter(u => u.role === 'member' && u.active).length), '')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Collections, last 12 months</h2><p>Verified payments only</p></div></div>${barChart(monthlySeries(ver))}</section>
    <section class="panel"><div class="panel-h"><h2>Income by levy in ${yr}</h2></div>${donut(levyAll().map(l => ({ label: l.name, color: l.color, value: sum(inY.filter(t => t.levy === l.id)) })))}</section></div>
    ${paymentPanel()}
    ${activityFeed()}
    ${attendanceRegisterView()}
    <section class="panel"><div class="panel-h"><div class="tabs" role="tablist"><button type="button" role="tab" data-act="tab" data-tab="collections" class="${tab === 'collections' ? 'active' : ''}" aria-selected="${tab === 'collections'}">Collections</button><button type="button" role="tab" data-act="tab" data-tab="spending" class="${tab === 'spending' ? 'active' : ''}" aria-selected="${tab === 'spending'}">Spending</button></div></div>${body}</section>`;
  }
};

