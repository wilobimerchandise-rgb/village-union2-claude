
/* =========================================================
   ROUND 4: outstanding bills, notices, member profile, clickable drill-downs
   ========================================================= */
function owingList(yr, f) {
  f = f || {}; const q = (f.q || '').toLowerCase();
  return S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && u.active && (!f.kin || u.kindred === f.kin) && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)))
    .map(u => { const rows = owingRowsAll(u.id, yr); return { u, rows, owe: sum(rows, 'owe') }; })
    .filter(x => x.owe > 0 && (!f.levy || x.rows.some(r => r.L.id === f.levy && r.owe > 0))).sort((a, b) => b.owe - a.owe);
}
function reminderText(it, yr) {
  const lines = it.rows.filter(r => r.owe > 0).map(r => `- ${r.L.name}: ${money(r.owe)}`).join('\n'), acc = (S.v.settings.accounts || []).map(a => `${a.bank}, ${a.number}, ${a.name}`).join('\n');
  return `Dear ${it.u.name.split(' ')[0]}, this is a payment reminder from ${S.v.name}.\nStill unpaid for ${yr}:\n${lines}\nTotal: ${money(it.owe)}\n\nPay to:\n${acc || '(ask your admin for the account)'}\n\nAfter paying, sign in to VillageVault, choose ${S.v.name} and upload your proof of payment.`;
}
const itemFor = (id, yr) => { const u = userById(id), rows = owingRowsAll(id, yr); return { u, rows, owe: sum(rows, 'owe') }; };

/* ----- Notice PDF (one page per member, with payment instructions) ----- */
function wrapText(pdf, s, maxW, size, bold) {
  const words = String(s).split(/\s+/), lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (pdf.w(t, size, bold) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur); return lines;
}
function drawNotice(pdf, it, yr) {
  const M = 48, CW = pdf.W - 96, INK = '#14142B', MUT = '#5B5F7A', u = it.u, acc = S.v.settings.accounts || []; let y = 0;
  const ensure = h => { if (y + h > pdf.H - 56) { pdf.add(); y = 60; } };
  pdf.rect(0, 0, pdf.W, 104, '#1A1A4E'); pdf.rect(0, 104, pdf.W, 5, '#F5B83D');
  const prem = S.v.plan === 'premium'; if (prem && S.v.logo) pdf.img(S.v.logo, pdf.W - M - 52, 26, 52, 52);
  pdf.text(pdf.fit(S.v.name, CW - 70, 20, true), M, 48, { size: 20, bold: true, color: '#FFFFFF' });
  pdf.text('OUTSTANDING PAYMENT NOTICE', M, 74, { size: 11, bold: true, color: '#F5B83D' });
  pdf.text(prem ? `Village code: ${S.v.code}` : 'Records kept on VillageVault', M, 92, { size: 8, color: '#C9CBEA' });
  y = 140; pdf.text(`Notice NT-${S.v.code}-${yr}-${u.id}`, M, y, { size: 9, color: MUT }); pdf.text(`Date: ${fmtDate(today())}`, pdf.W - M, y, { size: 9, color: MUT, align: 'right' });
  y += 28; pdf.text('To', M, y, { size: 9, color: MUT }); y += 17; pdf.text(pdf.fit(u.name, CW, 15, true), M, y, { size: 15, bold: true, color: '#1A1A4E' });
  y += 16; pdf.text(`${u.id}${kinOf(u) ? '   |   ' + kinOf(u) : ''}${u.phone ? '   |   ' + u.phone : ''}`, M, y, { size: 10, color: MUT });
  y += 28; wrapText(pdf, `Dear ${u.name.split(' ')[0]}, our records for ${yr} show that the amounts below are still unpaid. Only payments verified by an admin are counted. If you have already paid, upload your proof of payment and we will update your record.`, CW, 10.5).forEach(l => { pdf.text(l, M, y, { size: 10.5, color: INK }); y += 15; });
  y += 8; const c2 = M + CW * .56, c3 = M + CW * .78, c4 = M + CW - 10;
  pdf.rect(M, y, CW, 24, '#EEF2F0'); pdf.text('Levy', M + 10, y + 16, { size: 9, bold: true, color: MUT }); pdf.text('Amount due', c2, y + 16, { size: 9, bold: true, color: MUT, align: 'right' }); pdf.text('Paid', c3, y + 16, { size: 9, bold: true, color: MUT, align: 'right' }); pdf.text('Outstanding', c4, y + 16, { size: 9, bold: true, color: MUT, align: 'right' }); y += 24;
  it.rows.filter(r => r.need > 0).forEach(r => {
    ensure(26); pdf.text(pdf.fit(r.L.name, CW * .5, 10.5), M + 10, y + 17, { size: 10.5, color: INK }); pdf.text(pm(r.need), c2, y + 17, { size: 10.5, color: INK, align: 'right' }); pdf.text(pm(r.paid), c3, y + 17, { size: 10.5, color: INK, align: 'right' }); pdf.text(pm(r.owe), c4, y + 17, { size: 10.5, bold: true, color: r.owe ? '#D2395B' : '#12806A', align: 'right' }); y += 25; pdf.line(M, y, M + CW, y, '#DCE3E0');
  });
  ensure(34); pdf.rect(M, y, CW, 28, '#1A1A4E'); pdf.text('TOTAL OUTSTANDING', M + 10, y + 18, { size: 10, bold: true, color: '#FFFFFF' }); pdf.text(pm(it.owe), c4, y + 19, { size: 12, bold: true, color: '#F5B83D', align: 'right' }); y += 48;
  ensure(40 + Math.max(1, acc.length) * 26); pdf.text('How to pay', M, y, { size: 12, bold: true, color: '#1A1A4E' }); y += 12;
  const b2 = M + CW * .42, b3 = M + CW * .68, rowH = 26, top = y, rows = acc.length ? acc : [{ bank: 'Ask your admin for the account', number: '', name: '' }];
  pdf.rect(M, y, CW, rowH, '#EEF2F0'); pdf.text('Bank name', M + 8, y + 17, { size: 9, bold: true, color: MUT }); pdf.text('Account number', b2 + 8, y + 17, { size: 9, bold: true, color: MUT }); pdf.text('Account name', b3 + 8, y + 17, { size: 9, bold: true, color: MUT }); y += rowH;
  rows.forEach(a => { pdf.text(pdf.fit(a.bank, b2 - M - 14, 10.5, true), M + 8, y + 17, { size: 10.5, bold: true, color: INK }); pdf.text(a.number, b2 + 8, y + 17, { size: 11, bold: true, color: INK }); pdf.text(pdf.fit(a.name, M + CW - b3 - 14, 10.5), b3 + 8, y + 17, { size: 10.5, color: INK }); y += rowH; });
  const bot = y; for (let k = 0; k <= rows.length + 1; k++) pdf.line(M, top + k * rowH, M + CW, top + k * rowH, '#5B5F7A', .8);
  [M, b2, b3, M + CW].forEach(x => pdf.line(x, top, x, bot, '#5B5F7A', .8)); y += 24;
  ensure(120); pdf.text('Steps', M, y, { size: 11, bold: true, color: '#1A1A4E' }); y += 8;
  ['Pay the exact amount outstanding into the account above. VillageVault does not receive your money.', 'Keep your bank slip or transfer alert.', `Open VillageVault, choose ${S.v.name}, sign in and tap Upload proof. Your admin will verify it and your balance updates by itself.`].forEach((s, i) => {
    wrapText(pdf, s, CW - 20, 10).forEach((l, j) => { y += 15; pdf.text(j === 0 ? `${i + 1}.` : '', M, y, { size: 10, bold: true, color: '#1A1A4E' }); pdf.text(l, M + 20, y, { size: 10, color: INK }); });
  });
  if (S.v.settings.payNote) { y += 8; wrapText(pdf, S.v.settings.payNote, CW, 9).forEach(l => { y += 13; pdf.text(l, M, y, { size: 9, color: MUT }); }); }
  ensure(70); y += 30; pdf.line(M, y, M + 200, y, '#14142B', .8); pdf.text(`${S.u.name}, ${S.u.title}`, M, y + 14, { size: 10, bold: true, color: INK }); pdf.text(`${S.v.name}. Issued ${fmtTS(stamp())}`, M, y + 27, { size: 8.5, color: MUT });
}
function noticePdf(items, yr) {
  const pdf = new PDF(); if (S.v.plan !== 'premium') pdf.wm = 'VillageVault'; items.forEach((it, i) => { if (i) pdf.add(); drawNotice(pdf, it, yr); }); return pdf.build('Outstanding payment notice');
}
Object.assign(API, {
  logNotice(ids, how) { requireAdmin(); log('Issued payment notice', ids.length === 1 ? ids[0] : `${ids.length} members`, `${how}: ${ids.length === 1 ? 'outstanding notice for ' + ids[0] : ids.length + ' outstanding notices'}`); commit(); }
});

/* ----- Outstanding bills page ----- */
ADMIN.outstanding = function () {
  const f = S.f, yr = new Date().getFullYear(), list = owingList(yr, f), all = owingList(yr, {}), active = S.v.users.filter(u => u.role === 'member' && u.active).length, exp = expectedPerMember() * active, page = paginate(list, f);
  const owes = it => it.rows.filter(r => r.owe > 0).map(r => `${esc(r.L.name)} ${money(r.owe)}`).join('<br>');
  return `<div class="kpis">${kpi('Members owing', String(all.length), `of ${active} active members`, all.length ? 'bad' : 'good')}${kpi('Total outstanding', money(sum(all, 'owe')), `for ${yr}`, 'hot')}${kpi('Required for ' + yr, money(exp), 'All required levies')}${kpi('Collected so far', exp ? Math.max(0, Math.round((1 - sum(all, 'owe') / exp) * 100)) + '%' : '-', 'of what is required', 'good')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Members who owe</h2><p>Open a member to see their history. Download a notice with the payment instructions and send it to them.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${broadcastBtn()}<button class="btn btn-ghost btn-sm" type="button" data-act="owing-csv">Download list (CSV)</button><button class="btn btn-primary btn-sm" type="button" data-act="notice-all"${list.length ? '' : ' disabled'}>Download all notices (PDF)</button></div></div>
  <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div>${isVillageType() ? `<div class="field"><label for="fw">Kindred</label><select id="fw" class="select" data-filter="kin">${kindredOpts(f.kin, 'All kindreds')}</select></div>` : ''}<div class="field"><label for="fl">Owing levy</label><select id="fl" class="select" data-filter="levy">${opt('', 'Any levy', f.levy)}${levies().filter(l => l.fixed).map(l => opt(l.id, l.name, f.levy)).join('')}</select></div></div>
  ${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', 'What they owe', { t: 'Total owed', num: true }, ''], page.map(it => { const wa = waLinkTo(it.u.phone, reminderText(it, yr)); return [`${linkBtn('member-profile', it.u.id, it.u.name)}<small>${esc(it.u.id)}</small>`, ...(isVillageType() ? [esc(kinOf(it.u) || '-')] : []), esc(it.u.phone || '-'), `<small style="color:var(--ink)">${owes(it)}</small>`, `<b>${money(it.owe)}</b>`, `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="member-profile" data-id="${esc(it.u.id)}">Open</button><button class="btn btn-primary btn-sm" type="button" data-act="notice-one" data-id="${esc(it.u.id)}">Notice PDF</button><button class="btn btn-ghost btn-sm" type="button" data-act="share-notice" data-id="${esc(it.u.id)}">Share</button>${wa ? `<a class="btn btn-leaf btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" data-act="notice-wa" data-id="${esc(it.u.id)}">WhatsApp</a>` : ''}</div>`]; }), ['Nobody owes anything', 'Everyone is up to date for ' + yr + '.']).replace(/<td class="num"><div class="actions">/g, '<td><div class="actions">')}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
};
Object.assign(ACTIONS, {
  'notice-one'(el) { requireAdmin(); const yr = new Date().getFullYear(), it = itemFor(el.dataset.id, yr); if (!it.u) return; if (!(it.owe > 0)) return toast(`${it.u.name} owes nothing.`, 'ok'); download(`Notice-${it.u.id}.pdf`, noticePdf([it], yr)); API.logNotice([it.u.id], 'PDF downloaded'); toast('Notice downloaded. Send it to the member.', 'ok'); renderSoon(); },
  'notice-all'() { requireAdmin(); const yr = new Date().getFullYear(), list = owingList(yr, S.f); if (!list.length) return toast('Nobody owes anything.', 'ok'); const go = () => { try { download(`Notices-${S.v.code}-${yr}.pdf`, noticePdf(list, yr)); API.logNotice(list.map(x => x.u.id), 'PDF downloaded'); toast(`${list.length} notices downloaded.`, 'ok'); renderSoon(); } catch (e) { toast(e.message || 'Could not build the notices.', 'err'); } };
    if (list.length > 25) { toast(`Preparing ${list.length} notices. This can take a few seconds.`, 'ok'); setTimeout(go, 80); } else go(); },
  'notice-wa'(el) { try { API.logNotice([el.dataset.id], 'WhatsApp reminder opened'); } catch (_) {} },
  'owing-csv'() { requireAdmin(); const yr = new Date().getFullYear(), rows = [['Member ID', 'Name', 'Family / Kindred', 'Phone', 'Owes', 'Total owed']]; owingList(yr, S.f).forEach(it => rows.push([it.u.id, it.u.name, kinOf(it.u), it.u.phone, it.rows.filter(r => r.owe > 0).map(r => `${r.L.name} ${r.owe}`).join('; '), it.owe])); csvDownload(`${S.v.code}-outstanding-${yr}.csv`, rows); }
});

/* ----- Member profile (admin): details, owing, payments, attendance ----- */
function memberProfile(id) {
  if (!isAdmin()) return; const u = userById(id); if (!u) return toast('Member not found.', 'err');
  const yr = new Date().getFullYear(), it = itemFor(id, yr), paid = sum(memberPaid(id, yr)), att = attendanceOf(id), txs = S.v.tx.filter(t => t.memberId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const wa = it.owe > 0 ? waLinkTo(u.phone, reminderText(it, yr)) : '', pend = u.mustChange && u.tempPw;
  infoModal(u.name, `${esc(u.id)}${kinOf(u) ? ', ' + esc(kinOf(u)) : ''}`, `<div class="kpis kpis-3" style="margin-top:14px">${kpi('Paid in ' + yr, money(paid), '', 'good')}${kpi('Still owes', money(it.owe), it.owe ? 'Send a notice below' : 'Up to date', it.owe ? 'bad' : '')}${kpi('Meetings attended', att.total ? `${att.present} of ${att.total}` : 'None yet', att.total ? Math.round(att.present / att.total * 100) + '% present' : '')}</div>
  <dl class="kv"><dt>Phone</dt><dd>${esc(u.phone || '-')}</dd><dt>Email</dt><dd>${esc(u.email || '-')}</dd><dt>Joined</dt><dd>${esc(fmtDate(u.joined))}</dd><dt>Account</dt><dd>${u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>'}</dd><dt>Login</dt><dd>${pend ? 'Temporary password sent, not yet used' : 'Member uses their own password'}</dd></dl>
  <div class="btn-row">${it.owe > 0 ? `<button class="btn btn-primary btn-sm" type="button" data-act="notice-one" data-id="${esc(id)}">Download notice (PDF)</button><button class="btn btn-leaf btn-sm" type="button" data-act="share-notice" data-id="${esc(id)}">Share notice (WhatsApp)</button>` : ''}${wa ? `<a class="btn btn-leaf btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" data-act="notice-wa" data-id="${esc(id)}">Send reminder on WhatsApp</a>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="cred-send" data-id="${esc(id)}">Send login details</button><button class="btn btn-ghost btn-sm" type="button" data-act="edit-member" data-id="${esc(id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="member-tx" data-id="${esc(id)}">All payments</button></div>
  <div class="sec-title">What they owe in ${yr}</div>${table(['Levy', { t: 'Required', num: true }, { t: 'Paid', num: true }, { t: 'Owes', num: true }], it.rows.map(r => [esc(r.L.name), money(r.need), money(r.paid), r.owe ? `<b style="color:var(--hibiscus)">${money(r.owe)}</b>` : '<span class="badge b-verified">Paid</span>']), ['No required levies', ''])}
  <div class="sec-title">Payment history</div>${table(['Date', 'Levy', { t: 'Amount', num: true }, 'Status', ''], txs.slice(0, 8).map(t => [esc(fmtDate(t.date)), esc(levyOf(t.levy).name), money(t.amount), badge(t.status), `<button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">Open</button>`]), ['No payments yet', ''])}
  <div class="sec-title">Attendance history</div>${table(['Date', 'Meeting', 'Status'], att.rows.slice(0, 8).map(r => [esc(fmtDate(r.m.date)), esc(r.m.title), attBadge(r.state)]), ['No meetings yet', ''])}${pledgeSection(id)}`);
}
Object.assign(ACTIONS, {
  'member-profile'(el) { memberProfile(el.dataset.id); },
  'member-tx'(el) { closeModal(); S.page = 'transactions'; S.f = { member: el.dataset.id }; renderView(); window.scrollTo(0, 0); },
  'tx-filter'(el) { closeModal(); S.page = 'transactions'; S.f = { levy: el.dataset.id, status: 'verified', year: String(new Date().getFullYear()) }; renderView(); window.scrollTo(0, 0); },
  'exp-filter'(el) { closeModal(); S.page = 'expenses'; S.f = { cat: el.dataset.id, year: String(new Date().getFullYear()) }; renderView(); window.scrollTo(0, 0); },
  'go-page'(el) { closeModal(); goto(el.dataset.page); },
  'open-requests'() { S.rtab = 'requests'; goto('register'); },
  'forget-device'() { forgetRemember(S.v.id, S.v); logout(); toast('This device has been forgotten.', 'ok'); }
});

/* ----- Clickable dashboard cards: each opens detail, and the detail is clickable too ----- */
const dotName = l => `<span class="dot" style="background:${l.color}"></span>${esc(l.name)}`;
Object.assign(ACTIONS, {
  'kpi-collected'() {
    const yr = new Date().getFullYear(), inY = villageTx().filter(t => yearOf(t.date) === yr), by = levyAll().map(l => ({ l, a: inY.filter(t => t.levy === l.id) })).filter(x => x.a.length), latest = inY.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    infoModal(`Collected in ${yr}`, `${inY.length} verified payments, ${money(sum(inY))}`, `${table(['Levy', { t: 'Payments', num: true }, { t: 'Amount', num: true }, ''], by.map(x => [`${dotName(x.l)}`, String(x.a.length), money(sum(x.a)), `<button class="btn btn-ghost btn-sm" type="button" data-act="tx-filter" data-id="${x.l.id}">See payments</button>`]), ['Nothing collected yet', 'Verified payments appear here.']).replace(/<td class="num"><button/g, '<td><button')}
    <div class="sec-title">Latest verified payments</div>${table(['Date', 'Member', 'Levy', { t: 'Amount', num: true }], latest.map(t => [esc(fmtDate(t.date)), linkBtn('member-profile', t.memberId, nameOf(t.memberId)), esc(levyOf(t.levy).name), money(t.amount)]), ['None yet', ''])}`);
  },
  'kpi-spent'() {
    const yr = new Date().getFullYear(), exY = activeExp().filter(e => yearOf(e.date) === yr), cats = Array.from(new Set(exY.map(e => e.category))).map(c => ({ c, a: exY.filter(e => e.category === c) })), latest = exY.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    infoModal(`Spent in ${yr}`, `${exY.length} items, ${money(sum(exY))}`, `${table(['Category', { t: 'Items', num: true }, { t: 'Amount', num: true }, ''], cats.map(x => [esc(x.c), String(x.a.length), money(sum(x.a)), `<button class="btn btn-ghost btn-sm" type="button" data-act="exp-filter" data-id="${esc(x.c)}">See items</button>`]), ['Nothing spent yet', '']).replace(/<td class="num"><button/g, '<td><button')}
    <div class="sec-title">Latest spending</div>${table(['Date', 'Description', { t: 'Amount', num: true }, 'Recorded by'], latest.map(e => [esc(fmtDate(e.date)), esc(e.description), money(e.amount), esc(e.createdBy)]), ['None yet', ''])}`);
  },
  'kpi-balance'() {
    const inc = sum(villageTx()), spent = sum(activeExp());
    infoModal(balLabel(), 'All verified income less all recorded spending', `${table(['', { t: 'Amount', num: true }, ''], [['Verified income, all time', money(inc), '<button class="btn btn-ghost btn-sm" type="button" data-act="tx-filter" data-id="">See income</button>'], ['Spending, all time', money(spent), '<button class="btn btn-ghost btn-sm" type="button" data-act="exp-filter" data-id="">See spending</button>'], ['<b>Balance</b>', `<b>${money(inc - spent)}</b>`, '']]).replace(/<td class="num"><button/g, '<td><button')}
    <div class="sec-title">Waiting for verification</div><p class="muted">${money(sum(pendingTx()))} from ${pendingTx().length} payment${pendingTx().length === 1 ? '' : 's'} is not in the balance yet.</p><div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="go-page" data-page="verify">Review payments</button><button class="btn btn-ghost btn-sm" type="button" data-act="go-page" data-page="reports">Open reports</button></div>`, 'modal-lg');
  },
  'my-owing'() {
    const yr = new Date().getFullYear(), rows = owingRows(S.u.id, yr), owe = sum(rows, 'owe');
    infoModal('What you owe', `${esc(S.v.name)}, ${yr}`, `${table(['Levy', { t: 'Required', num: true }, { t: 'Paid', num: true }, { t: 'You owe', num: true }], rows.map(r => [esc(r.L.name), money(r.need), money(r.paid), r.owe ? `<b style="color:var(--hibiscus)">${money(r.owe)}</b>` : 'Paid']).concat([['<b>Total</b>', '', '', `<b>${money(owe)}</b>`]]), ['No required levies', ''])}
    <div class="sec-title">How to pay</div>${accTable(S.v.settings.accounts || [])}<p class="hint" style="margin-top:8px">${esc(S.v.settings.payNote || '')}</p><p class="hint">After you pay, upload your proof. Your balance drops by itself once the admin verifies it.</p><div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof of payment</button></div>`);
  },
  'audit-item'(el) {
    const a = S.v.audit.find(x => x.id === el.dataset.id); if (!a) return;
    infoModal(a.action, 'Recorded by an admin', `<dl class="kv" style="margin-top:14px"><dt>When</dt><dd>${esc(fmtTS(a.ts))}</dd><dt>Admin</dt><dd>${esc(a.adminName)}${a.adminTitle ? ', ' + esc(a.adminTitle) : ''}</dd><dt>Record</dt><dd>${esc(a.target)}</dd><dt>Details</dt><dd>${esc(a.detail)}</dd></dl>
    <div class="btn-row">${S.v.tx.some(t => t.id === a.target) ? `<button class="btn btn-primary btn-sm" type="button" data-act="view-tx" data-id="${esc(a.target)}">Open this record</button>` : ''}${userById(a.target) && userById(a.target).role === 'member' ? `<button class="btn btn-primary btn-sm" type="button" data-act="member-profile" data-id="${esc(a.target)}">Open this member</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="go-page" data-page="audit">Full activity log</button></div>`, 'modal-md');
  }
});
