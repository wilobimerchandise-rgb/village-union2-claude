
/* ---------- Shared: reports and profile ---------- */
function closedPeriods(memberId) {
  const tx = (memberId ? myTx() : S.v.tx), now = new Date();
  let first = now.getFullYear(); tx.forEach(t => { first = Math.min(first, yearOf(t.date)); }); S.v.expenses.forEach(e => { first = Math.min(first, yearOf(e.date)); });
  const months = [], years = [];
  for (let y = now.getFullYear(); y >= first; y--) {
    years.push({ y, open: y === now.getFullYear() });
    for (let m = (y === now.getFullYear() ? now.getMonth() : 11); m >= 0; m--) months.push({ y, m, open: y === now.getFullYear() && m === now.getMonth() });
  }
  return { months: months.slice(0, 24), years };
}
function reportsView() {
  const f = S.f, now = new Date(), admin = isAdmin();
  const scope = admin ? 'village' : (f.scope || 'statement'), kind = f.kind || 'month', year = Number(f.year || now.getFullYear()), month = f.month !== undefined && f.month !== '' ? Number(f.month) : now.getMonth();
  const rep = buildReport(kind, year, month, scope === 'statement' ? S.u.id : null), per = closedPeriods(scope === 'statement' ? true : false);
  const memberFor = scope === 'statement' ? S.u.id : '';
  const mrows = rep.mode === 'village' ? rep.members.filter(m => m.total > 0) : [];
  return `<section class="panel"><div class="panel-h"><div><h2>Build a report</h2><p>Pick a period, check the figures, then download the PDF.</p></div><button class="btn btn-primary" type="button" data-act="dl-current">Download PDF</button></div>
    <div class="toolbar">
      ${admin ? '' : `<div class="field"><label for="rScope">Report for</label><select id="rScope" class="select" data-filter="scope">${opt('statement', 'My own statement', scope)}${opt('village', 'The whole village', scope)}</select></div>`}
      <div class="field"><label for="rKind">Period type</label><select id="rKind" class="select" data-filter="kind">${opt('month', 'Monthly', kind)}${opt('year', 'Yearly', kind)}</select></div>
      <div class="field"><label for="rYear">Year</label><select id="rYear" class="select" data-filter="year">${yearOpts(String(year))}</select></div>
      <div class="field"><label for="rMonth">Month</label><select id="rMonth" class="select" data-filter="month"${kind === 'year' ? ' disabled' : ''}>${MONTHS.map((m, i) => opt(i, m, month)).join('')}</select></div>
    </div>
    <div class="rep-sum">${rep.mode === 'statement'
      ? `<div><small>Paid in period</small><b>${money(rep.income)}</b></div><div><small>Payments</small><b>${rep.count}</b></div><div><small>Paid to date</small><b>${money(rep.paidToDate)}</b></div><div><small>Awaiting verification</small><b>${money(rep.pendingAmount)}</b></div>`
      : `<div><small>Brought forward</small><b>${money(rep.bf)}</b></div><div><small>Income</small><b>${money(rep.income)}</b></div><div><small>Expenditure</small><b>${money(rep.expense)}</b></div><div><small>Carried forward</small><b>${money(rep.cf)}</b></div>`}</div>
    ${table(['Levy', { t: 'Payments', num: true }, { t: 'Amount', num: true }], rep.byLevy.map(l => [`<span class="dot" style="background:${l.color}"></span>${esc(l.name)}`, String(l.count), money(l.amount)]).concat([[`<b>Total</b>`, `<b>${rep.count}</b>`, `<b>${money(rep.income)}</b>`]]), ['Nothing to show', ''])}
    ${mrows.length ? `<div class="sec-title">Top contributors in this period</div>${table(['Member', { t: 'Total paid', num: true }], mrows.slice().sort((a, b) => b.total - a.total).slice(0, 5).map(m => [`${esc(m.name)}<small>${esc(m.id)}</small>`, money(m.total)]), ['', ''])}` : ''}
  </section>
  <section class="panel"><div class="panel-h"><div><h2>Report library</h2><p>${scope === 'statement' ? 'Your statements' : 'Village reports'} for every closed month and year. The latest period is still open.</p></div></div>
    <div class="sec-title" style="margin-top:0">Yearly</div><div class="report-grid">${per.years.map(p => `<div class="rep-item"><div><b>Year ${p.y}</b><br><small>${p.open ? 'Year to date' : 'Closed'}</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="dl-report" data-kind="year" data-y="${p.y}" data-m="0" data-member="${memberFor}">Download PDF</button></div>`).join('')}</div>
    <div class="sec-title">Monthly</div><div class="report-grid">${per.months.map(p => `<div class="rep-item"><div><b>${MONTHS[p.m]} ${p.y}</b><br><small>${p.open ? 'Month to date' : 'Closed'}</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="dl-report" data-kind="month" data-y="${p.y}" data-m="${p.m}" data-member="${memberFor}">Download PDF</button></div>`).join('')}</div></section>`;
}
/* ---------- Admin views ---------- */
const ADMIN = {
  overview() {
    const yr = new Date().getFullYear(), ver = villageTx(), ex = activeExp(), inY = ver.filter(t => yearOf(t.date) === yr), exY = ex.filter(e => yearOf(e.date) === yr), pend = pendingTx();
    const behind = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && u.active).map(u => ({ u, o: memberOutstanding(u.id, yr) })).filter(x => x.o > 0).sort((a, b) => b.o - a.o);
    const recent = S.v.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 6);
    return `<div><h2 style="font-size:1.7rem">${greeting()}, ${esc(S.u.name.split(' ')[0])}.</h2><p class="muted">${esc(S.u.title)}, ${esc(S.v.name)}</p></div>
    ${S.v.requests.filter(r => r.status === 'new').length ? `<div class="callout"><div><b>${S.v.requests.filter(r => r.status === 'new').length} member${S.v.requests.filter(r => r.status === 'new').length > 1 ? 's are' : ' is'} asking for login details</b><p>Check each name against your register before you send anything.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="open-requests">See requests</button></div>` : ''}
    ${pend.length ? `<div class="callout"><div><b>${pend.length} payment${pend.length > 1 ? 's are' : ' is'} waiting for verification</b><p>${money(sum(pend))} is not in the books until you check the proof.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="goto" data-page="verify">Review now</button></div>` : `<div class="callout ok"><div><b>Everything is verified</b><p>No payments are waiting for you.</p></div></div>`}
    <div class="kpis">${kpiLink('kpi-collected', 'Collected in ' + yr, money(sum(inY)), `${inY.length} verified payments`, 'hot')}${kpiLink('kpi-spent', 'Spent in ' + yr, money(sum(exY)), `${exY.length} items`)}${kpiLink('kpi-balance', balLabel(), money(sum(ver) - sum(ex)), 'All income less all spending', 'good')}${kpiLink('goto', 'Members behind', String(behind.length), `${money(sum(behind, 'o'))} outstanding. Tap to see who`, behind.length ? 'bad' : '', ' data-page="outstanding"')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Collections, last 12 months</h2><p>Verified payments only</p></div></div>${barChart(monthlySeries(ver))}</section>
    <section class="panel"><div class="panel-h"><h2>Income by levy in ${yr}</h2></div>${donut(levyAll().map(l => ({ label: l.name, color: l.color, value: sum(inY.filter(t => t.levy === l.id)) })))}</section></div>
    ${paymentPanel()}
    <div class="grid-2e"><section class="panel"><div class="panel-h"><h2>Waiting for verification</h2><button class="btn btn-ghost btn-sm" type="button" data-act="goto" data-page="verify">See all</button></div><div class="list">${pend.slice(0, 5).map(t => `<div class="list-item"><div><b>${esc(nameOf(t.memberId))}</b><small>${esc(levyOf(t.levy).name)}, ${money(t.amount)}, ${esc(fmtDate(t.date))}</small></div><button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Review</button></div>`).join('') || '<div class="empty"><b>All clear</b>New uploads will appear here.</div>'}</div></section>
    <section class="panel"><div class="panel-h"><h2>Recent admin activity</h2><button class="btn btn-ghost btn-sm" type="button" data-act="goto" data-page="audit">Full log</button></div><div class="list">${recent.map(a => `<button type="button" class="list-item rowbtn" data-act="audit-item" data-id="${esc(a.id)}"><div><b>${esc(a.action)}</b><small>${esc(a.adminName)}, ${esc(fmtTS(a.ts))}</small></div><span class="chev" aria-hidden="true">&rsaquo;</span></button>`).join('')}</div></section></div>
    ${sponsorsPanel(true)}`;
  },
  verify() {
    const list = pendingTx().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return `<section class="panel"><div class="panel-h"><div><h2>Payments waiting for you</h2><p>Compare each proof with the bank statement, then verify or reject.</p></div></div>
    ${table(['Submitted', 'Member', 'Levy', 'Reference', { t: 'Amount', num: true }, ''], list.map(t => [esc(fmtTS(t.submittedAt)), `${esc(nameOf(t.memberId))}<small>${esc(t.memberId)}</small>`, esc(levyOf(t.levy).name), esc(t.ref || '-'), money(t.amount), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View proof</button><button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Verify</button><button class="btn btn-danger btn-sm" type="button" data-act="reject-tx" data-id="${t.id}">Reject</button></div>`]), ['Nothing is waiting', 'New proofs from members will appear here.'])}</section>`;
  },
  transactions() {
    const f = S.f, list = filterTx(S.v.tx, f);
    return `<section class="panel"><div class="panel-h"><div><h2>All payment records</h2><p>Edits and voids are logged with your name and the time.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" type="button" data-act="export-tx">Download CSV</button><button class="btn btn-primary btn-sm" type="button" data-act="add-tx">Add payment</button></div></div>
    <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Member name, ID or reference"></div>
    <div class="field"><label for="fm1">Member</label><select id="fm1" class="select" data-filter="member">${memberOpts(f.member, 'All members')}</select></div>
    <div class="field"><label for="fl">Levy</label><select id="fl" class="select" data-filter="levy">${levyOpts(f.levy, 'All levies')}</select></div>
    <div class="field"><label for="fs">Status</label><select id="fs" class="select" data-filter="status">${STATUS_OPTS(f.status)}</select></div>
    <div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div></div>
    ${txTable(list, true)}</section>`;
  },
  members() {
    const f = S.f, yr = new Date().getFullYear(), q = (f.q || '').toLowerCase();
    const list = S.v.users.filter(u => u.role === 'member' && (!f.kin || u.kindred === f.kin) && (!f.state || (f.state === 'active') === u.active) && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    const page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Admin team</h2></div></div><div class="report-grid">${S.v.users.filter(u => u.role === 'admin').map(a => `<div class="rep-item"><div><b>${esc(a.name)}</b><br><small>${esc(a.title)}, ${esc(a.id)}</small></div></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-h"><div><h2>Members</h2><p>${list.length} shown, ${S.v.users.filter(u => u.role === 'member' && u.active).length} active${S.v.plan === 'premium' ? '' : ' of 20 allowed on Basic'}</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-member">Add member</button><button class="btn btn-ghost btn-sm" type="button" data-act="im-open">Import from a list${S.v.plan === 'premium' ? '' : ' ' + premiumBadge}</button></div>
    ${capNotice()}<div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div>
    ${isVillageType() ? `<div class="field"><label for="fw">Kindred</label><select id="fw" class="select" data-filter="kin">${kindredOpts(f.kin, 'All kindreds')}</select></div>` : ''}
    <div class="field"><label for="fst">Account</label><select id="fst" class="select" data-filter="state">${opt('', 'All accounts', f.state)}${opt('active', 'Active', f.state)}${opt('off', 'Deactivated', f.state)}</select></div></div>
    ${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', { t: 'Paid ' + yr, num: true }, { t: 'Still to pay', num: true }, 'Account', ''], page.map(u => [`<button type="button" class="linkbtn" data-act="member-profile" data-id="${esc(u.id)}">${esc(u.name)}</button><small>${esc(u.id)}</small>`, ...(isVillageType() ? [esc(kinOf(u) || '-')] : []), esc(u.phone || '-'), money(sum(memberPaid(u.id, yr))), money(memberOutstanding(u.id, yr)), u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>', `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="member-profile" data-id="${u.id}">Open</button><button class="btn btn-ghost btn-sm" type="button" data-act="edit-member" data-id="${u.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="reset-pw" data-id="${u.id}">Reset password</button></div>`]), ['No members match', 'Try a different filter.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
  },
  expenses() {
    const f = S.f, list = S.v.expenses.filter(e => (!f.cat || e.category === f.cat) && (!f.year || yearOf(e.date) === Number(f.year))).sort((a, b) => b.date.localeCompare(a.date)), page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Money spent by the union</h2><p>Members can see these entries on Village records.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-exp">Record expense</button></div>
    <div class="toolbar"><div class="field"><label for="fc">Category</label><select id="fc" class="select" data-filter="cat">${opt('', 'All categories', f.cat)}${EXP_CATS.map(c => opt(c, c, f.cat)).join('')}</select></div><div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div></div>
    ${table(['Date', 'Category', 'Description', { t: 'Amount', num: true }, 'Recorded by', ''], page.map(e => [esc(fmtDate(e.date)), esc(e.category), esc(e.description) + (e.status === 'void' ? `<small>Voided: ${esc(e.voidReason)}</small>` : ''), e.status === 'void' ? `<s>${money(e.amount)}</s>` : money(e.amount), `${esc(e.createdBy)}<small>${esc(fmtTS(e.createdAt))}</small>${e.updatedBy ? `<small>Updated by ${esc(e.updatedBy)}, ${esc(fmtTS(e.updatedAt))}</small>` : ''}`, e.status === 'void' ? badge('void') : `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="edit-exp" data-id="${e.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="void-exp" data-id="${e.id}">Void</button></div>`]), ['No expenses recorded', ''])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
  },
  levies() {
    return `<section class="panel" style="max-width:640px"><div class="panel-h"><div><h2>Levy amounts for ${esc(S.v.name)}</h2><p>These amounts are used to work out what each member still owes. Party donations are voluntary and have no set amount.</p></div></div>
    <form data-form="levies" novalidate>${LEVIES.filter(l => l.fixed).map(l => `<div class="field"><label for="lv_${l.id}">${esc(l.name)} (naira)</label><input id="lv_${l.id}" name="${l.id}" class="input" type="number" min="0" step="100" value="${S.v.settings.levies[l.id]}" required></div>`).join('')}
    <div class="form-error" id="formErr" role="alert" hidden></div><div style="margin-top:20px"><button class="btn btn-primary" type="submit">Save amounts</button></div></form></section>`;
  },
  audit() {
    const f = S.f, admins = S.v.users.filter(u => u.role === 'admin'), actions = Array.from(new Set(S.v.audit.map(a => a.action))).sort();
    const list = S.v.audit.filter(a => (!f.admin || a.adminId === f.admin) && (!f.action || a.action === f.action)).sort((a, b) => b.ts.localeCompare(a.ts)), page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Who did what, and when</h2><p>Every verification, edit and change by an admin is recorded here.</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="export-audit">Download CSV</button></div>
    <div class="toolbar"><div class="field"><label for="fa">Admin</label><select id="fa" class="select" data-filter="admin">${opt('', 'All admins', f.admin)}${admins.map(a => opt(a.id, a.name, f.admin)).join('')}</select></div><div class="field"><label for="fac">Action</label><select id="fac" class="select" data-filter="action">${opt('', 'All actions', f.action)}${actions.map(a => opt(a, a, f.action)).join('')}</select></div></div>
    ${table(['When', 'Admin', 'Action', 'Record', 'Details'], page.map(a => [`<span class="nowrap">${esc(fmtTS(a.ts))}</span>`, `${esc(a.adminName)}<small>${esc(a.adminTitle || '')}</small>`, esc(a.action), esc(a.target), esc(a.detail)]), ['No activity yet', ''])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
  }
};
const VIEWS = {
  member: { overview: MEMBER.overview, village: MEMBER.village },
  admin: { overview: ADMIN.overview, verify: ADMIN.verify, transactions: ADMIN.transactions, members: ADMIN.members, expenses: ADMIN.expenses, levies: ADMIN.levies, reports: reportsView, audit: ADMIN.audit },
  owner: {}
};
