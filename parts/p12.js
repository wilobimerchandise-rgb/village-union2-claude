
/* =========================================================
   ROUND 4: attendance register, access requests, login details
   ========================================================= */
const meetingSeen = m => !m.exec || isAdmin();   // executive meetings belong to admins only
const meetingOpen = m => m.status === 'open' && m.date === today();
const getMtg = id => { const m = S.v.meetings.find(x => x.id === id); if (!m) throw new Error('Meeting not found.'); return m; };
const attBadge = s => ({ verified: '<span class="badge b-verified">Present</span>', pending: '<span class="badge b-pending">Waiting for admin</span>', rejected: '<span class="badge b-rejected">Not accepted</span>', absent: '<span class="badge b-off">Absent</span>', open: '<span class="badge b-pending">Register open</span>' })[s] || '';
const meetingsDesc = () => S.v.meetings.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
function attendanceOf(id) {
  const rows = meetingsDesc().filter(meetingSeen).map(m => { const k = m.marks.find(x => x.memberId === id); return { m, k, state: k ? k.status : (meetingOpen(m) ? 'open' : 'absent') }; });
  const counted = rows.filter(r => !meetingOpen(r.m));
  return { rows, total: counted.length, present: counted.filter(r => r.state === 'verified').length };
}
const presentCount = m => m.marks.filter(k => k.status === 'verified').length;

Object.assign(API, {
  openRegister(title) {
    requireAdmin();
    S.v.meetings.forEach(m => { if (m.status === 'open' && m.date !== today()) { m.status = 'closed'; m.closedAt = stamp(); m.closedBy = 'Closed automatically at midnight'; } });
    if (S.v.meetings.some(meetingOpen)) throw new Error('A register is already open. Close it before opening another.');
    const m = { id: nextId('mtg', 'G'), title, date: today(), status: 'open', openedBy: S.u.name, openedById: S.u.id, openedAt: stamp(), marks: [] };
    S.v.meetings.push(m); log('Opened attendance register', m.id, `${title}, ${fmtDate(m.date)}`); commit(); return m;
  },
  closeRegister(id) {
    requireAdmin(); const m = getMtg(id); if (m.status !== 'open') throw new Error('This register is already closed.');
    m.status = 'closed'; m.closedAt = stamp(); m.closedBy = S.u.name; log('Closed attendance register', id, `${m.title}: ${presentCount(m)} present, ${m.marks.filter(k => k.status === 'pending').length} not yet verified`); commit();
  },
  markAttendance() {
    if (!S.u || S.u.id === 'SUPPORT' || S.owner || !['member', 'admin'].includes(S.u.role) || !S.u.active) throw new Error('Only members and admins can mark their own attendance.'); requireWritable();
    const m = S.v.meetings.find(meetingOpen); if (!m || !meetingSeen(m)) throw new Error('No register is open right now. Your admin opens it on meeting days only.');
    if (m.marks.some(k => k.memberId === S.u.id)) throw new Error('You have already marked attendance for this meeting.');
    m.marks.push({ memberId: S.u.id, at: stamp(), status: 'pending' }); commit(); return m;
  },
  setMark(mid, memberId, status) {
    requireAdmin(); const m = getMtg(mid); let k = m.marks.find(x => x.memberId === memberId);
    if (!k) {
      if (status !== 'verified') throw new Error('There is no mark to change.');
      k = { memberId, at: stamp(), status: 'pending', addedByAdmin: true, addedBy: S.u.name, addedById: S.u.id }; m.marks.push(k);
      log('Marked attendance (needs a second admin)', mid, `${nameOf(memberId)} at ${m.title}, ${fmtDate(m.date)}. Another admin must verify it`); commit(); return;
    }
    if (status === 'verified' && (k.memberId === S.u.id || k.addedById === S.u.id)) throw new Error('You cannot verify your own entry. Another admin must verify it.');
    k.status = status; k.by = S.u.name; k.byId = S.u.id; k.byAt = stamp();
    log(status === 'verified' ? 'Verified attendance' : 'Did not accept attendance', mid, `${nameOf(memberId)} at ${m.title}, ${fmtDate(m.date)}${k.addedByAdmin ? ' (added by admin)' : ''}`); commit();
  },
  verifyAll(mid) {
    requireAdmin(); const m = getMtg(mid), p = m.marks.filter(k => k.status === 'pending' && k.memberId !== S.u.id && k.addedById !== S.u.id); if (!p.length) throw new Error('Nothing is waiting for you to verify. Entries you made yourself need another admin.');
    p.forEach(k => { k.status = 'verified'; k.by = S.u.name; k.byId = S.u.id; k.byAt = stamp(); }); log('Verified attendance', mid, `${p.length} members at ${m.title}, ${fmtDate(m.date)}`); commit(); return p.length;
  },
  removeMark(mid, memberId) {
    requireAdmin(); const m = getMtg(mid); m.marks = m.marks.filter(k => k.memberId !== memberId); log('Removed attendance mark', mid, `${nameOf(memberId)} at ${m.title}, ${fmtDate(m.date)}`); commit();
  },
  logCredSent(id, how) { requireAdmin(); S.v.credLog.push({ memberId: id, by: S.u.name, at: stamp(), kind: 'sent', how }); log('Sent login details', id, `${nameOf(id)} (${how})`); commit(); },
  resolveRequest(rid, d) {
    requireAdmin(); const r = S.v.requests.find(x => x.id === rid); if (!r) throw new Error('Request not found.'); if (r.status !== 'new') throw new Error('This request was already handled.');
    r.status = d.status; r.handledBy = S.u.name; r.handledAt = stamp(); r.memberId = d.memberId || ''; r.reason = d.reason || '';
    log(d.status === 'issued' ? 'Issued login details' : 'Declined login request', rid, d.status === 'issued' ? `${r.name} confirmed on the register as ${nameOf(d.memberId)} (${d.memberId})` : `${r.name}: ${d.reason}`); commit();
  }
});

/* ----- Member side ----- */
function attendanceMember() {
  const open = S.v.meetings.find(m => meetingOpen(m) && meetingSeen(m)), att = attendanceOf(S.u.id), mine = open && open.marks.find(k => k.memberId === S.u.id), latest = meetingsDesc().filter(meetingSeen)[0];
  const top = open ? (mine
    ? `<div class="callout ok"><div><b>You marked attendance for ${esc(open.title)}</b><p>${mine.status === 'verified' ? 'Your admin has verified it.' : 'Waiting for your admin to verify it.'}</p></div></div>`
    : `<div class="callout"><div><b>The register is open: ${esc(open.title)}</b><p>Mark yourself present now. Your admin will verify it. It closes tonight.</p></div><button class="btn btn-primary" type="button" data-act="att-mark">Mark me present</button></div>`)
    : `<div class="empty" style="padding:18px"><b>No register is open right now</b>Your admin opens it on meeting days only.</div>`;
  return `<section class="panel"><div class="panel-h"><div><h2>Attendance</h2><p>${att.total ? `You were present at ${att.present} of ${att.total} meetings (${Math.round(att.present / att.total * 100)}%).` : 'Your attendance history will show here.'}</p></div>${latest ? `<button class="btn btn-ghost btn-sm" type="button" data-act="view-register" data-id="${esc(latest.id)}">View the register</button>` : ''}</div>${top}
  <div class="sec-title">My attendance history</div>${table(['Date', 'Meeting', 'Status'], att.rows.slice(0, 8).map(r => [esc(fmtDate(r.m.date)), esc(r.m.title), attBadge(r.state)]), ['No meetings yet', 'Registers opened by your admin appear here.'])}</section>`;
}
function attendanceRegisterView() {
  const list = meetingsDesc().slice(0, 8), active = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && u.active).length;
  return `<section class="panel"><div class="panel-h"><div><h2>Attendance register</h2><p>Meetings and who was verified present. Open a meeting to see the names.</p></div></div>
  ${table(['Date', 'Meeting', { t: 'Present', num: true }, { t: 'Rate', num: true }, 'Status', ''], list.map(m => [esc(fmtDate(m.date)), esc(m.title), String(presentCount(m)), active ? Math.round(presentCount(m) / active * 100) + '%' : '-', meetingOpen(m) ? '<span class="badge b-verified">Open today</span>' : '<span class="badge b-off">Closed</span>', `<button class="btn btn-ghost btn-sm" type="button" data-act="view-register" data-id="${esc(m.id)}">View register</button>`]), ['No meetings yet', 'Registers opened by admins appear here.']).replace(/<td class="num">(<button)/g, '<td>$1')}</section>`;
}
function activityFeed() {
  const list = S.v.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15);
  return `<section class="panel"><div class="panel-h"><div><h2>What the admins have done</h2><p>Every action an admin takes is shown here with their name and the time.</p></div></div>
  <div class="list">${list.map(a => `<div class="list-item"><div><b>${esc(a.action)}</b><small>${esc(a.detail)}</small><small>${esc(a.adminName)}${a.adminTitle ? ', ' + esc(a.adminTitle) : ''} on ${esc(fmtTS(a.ts))}</small></div></div>`).join('') || '<div class="empty"><b>No activity yet</b></div>'}</div></section>`;
}
Object.assign(ACTIONS, {
  'att-mark-admin'(el) { requireAdmin(); API.markAttendance(); toast('Marked. Another admin must verify your attendance.', 'ok'); if ($('#modalRoot').hidden) renderView(); else { mtgView(el.dataset.id); renderSoon(); } },
  'att-mark'() { API.markAttendance(); toast('Attendance marked. Your admin will verify it.', 'ok'); renderView(); },
  'view-register'(el) {
    const m = S.v.meetings.find(x => x.id === el.dataset.id); if (!m || !meetingSeen(m)) return;
    const here = m.marks.filter(k => k.status === 'verified').map(k => nameOf(k.memberId)).sort(), active = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && u.active).length;
    infoModal(m.title, `${esc(fmtDate(m.date))}. ${here.length} verified present of ${active} members.${meetingOpen(m) ? ' The register is open today.' : ''}`, here.length ? `<div class="namegrid">${here.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : '<div class="empty"><b>Nobody verified yet</b></div>', 'modal-md');
  }
});

/* ----- Admin: Register page with four tabs ----- */
ADMIN.register = function () {
  const tab = S.rtab || 'attendance', reqN = S.v.requests.filter(r => r.status === 'new').length, pend = S.v.meetings.reduce((a, m) => a + m.marks.filter(k => k.status === 'pending').length, 0);
  const tabs = [['attendance', 'Attendance' + (pend ? ` (${pend})` : '')], ['members', 'Member register'], ['logins', 'Login details'], ['requests', 'Login requests' + (reqN ? ` (${reqN})` : '')]];
  const body = ({ attendance: regAttendance, members: regMembers, logins: regLogins, requests: regRequests })[tab]();
  return `<div class="tabs-row"><div class="tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" data-act="rtab" data-tab="${t[0]}" class="${tab === t[0] ? 'active' : ''}" aria-selected="${tab === t[0]}">${t[1]}</button>`).join('')}</div></div>${body}`;
};
Object.assign(ACTIONS, { 'rtab'(el) { S.rtab = el.dataset.tab; S.f = {}; renderView(); } });
VIEWS.admin.register = ADMIN.register; VIEWS.admin.profile = ADMIN.profile; VIEWS.admin.levies = ADMIN.levies; VIEWS.admin.outstanding = ADMIN.outstanding;

function regAttendance() {
  const open = S.v.meetings.find(meetingOpen), list = meetingsDesc();
  const banner = open
    ? `<section class="panel att-open"><div class="panel-h"><div><span class="badge b-verified">Register open today</span><h2 style="margin-top:8px">${esc(open.title)}</h2><p>${esc(fmtDate(open.date))}. Members can mark themselves present until you close it or midnight. ${presentCount(open)} verified, ${open.marks.filter(k => k.status === 'pending').length} waiting for you.</p></div><div class="btn-row"><button class="btn btn-primary" type="button" data-act="mtg-view" data-id="${esc(open.id)}">Open the register</button>${!open.marks.some(k => k.memberId === S.u.id) && S.u.id !== 'SUPPORT' && !S.owner ? `<button class="btn btn-leaf" type="button" data-act="att-mark-admin" data-id="${esc(open.id)}">Mark me present</button>` : ''}<button class="btn btn-ghost" type="button" data-act="mtg-close" data-id="${esc(open.id)}">Close register</button></div></div></section>`
    : `<section class="panel"><div class="panel-h"><div><h2>No register is open</h2><p>Open it on meeting day only. It accepts attendance for today, so nobody can sign for a past meeting.</p></div><button class="btn btn-primary" type="button" data-act="mtg-open">Open today's register</button></div></section>`;
  return `${banner}<section class="panel"><div class="panel-h"><div><h2>Meetings</h2><p>Open a meeting to verify names, or to click a member and see their payments and attendance.</p></div></div>
  ${table(['Date', 'Meeting', { t: 'Present', num: true }, { t: 'Waiting', num: true }, 'Status', 'Opened by', ''], list.map(m => [esc(fmtDate(m.date)), esc(m.title), String(presentCount(m)), String(m.marks.filter(k => k.status === 'pending').length), meetingOpen(m) ? '<span class="badge b-verified">Open today</span>' : '<span class="badge b-off">Closed</span>', `${esc(m.openedBy)}<small>${esc(fmtTS(m.openedAt))}</small>`, `<button class="btn btn-ghost btn-sm" type="button" data-act="mtg-view" data-id="${esc(m.id)}">Open</button>`]), ['No meetings yet', 'Open a register on your next meeting day.']).replace(/<td class="num">(<button)/g, '<td>$1')}</section>`;
}
function regMembers() {
  const f = S.f, yr = new Date().getFullYear(), q = (f.q || '').toLowerCase();
  const list = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && (!f.kin || u.kindred === f.kin) && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))).sort((a, b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1) || a.name.localeCompare(b.name)), page = paginate(list, f);
  return `<section class="panel"><div class="panel-h"><div><h2>Member register</h2><p>Click a name to see that member's attendance and payment history.</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="register-csv">Download register (CSV)</button></div>
  <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div>${isVillageType() ? `<div class="field"><label for="fw">Kindred</label><select id="fw" class="select" data-filter="kin">${kindredOpts(f.kin, 'All kindreds')}</select></div>` : ''}</div>
  ${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', { t: 'Attendance', num: true }, { t: 'Paid ' + yr, num: true }, { t: 'Owes', num: true }, 'Account'], page.map(u => { const a = attendanceOf(u.id), o = memberOutstanding(u.id, yr); return [`${linkBtn('member-profile', u.id, u.name)}<small>${esc(u.id)}${u.role === 'admin' ? ' · ' + esc(u.title || 'Admin') : ''}</small>`, ...(isVillageType() ? [esc(kinOf(u) || '-')] : []), esc(u.phone || '-'), a.total ? `${a.present} of ${a.total}` : '-', money(sum(memberPaid(u.id, yr))), o ? `<b style="color:var(--hibiscus)">${money(o)}</b>` : 'Nil', u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>']; }), ['No members match', 'Try a different filter.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
}
function regLogins() {
  const f = S.f, q = (f.q || '').toLowerCase();
  const list = S.v.users.filter(u => u.role === 'member' && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name)), page = paginate(list, f);
  return `<section class="panel"><div class="panel-h"><div><h2>Member login details</h2><p>When a member forgets their login, find them here and send the details again. A member's own password is never stored. A temporary password is kept only until the member changes it.</p></div></div>
  <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div></div>
  ${table(['Member', 'Phone', 'Login', 'Last sent', ''], page.map(u => { const last = S.v.credLog.filter(c => c.memberId === u.id).pop(), waiting = u.mustChange && u.tempPw; return [`${linkBtn('member-profile', u.id, u.name)}<small>${esc(u.id)}</small>`, esc(u.phone || '-'), waiting ? '<span class="badge b-pending">Temporary password stored</span>' : '<span class="badge b-active">Has own password</span>', last ? `${esc(fmtTS(last.at))}<small>by ${esc(last.by)}</small>` : '<small>Never sent from here</small>', `<div class="actions"><button class="btn btn-primary btn-sm" type="button" data-act="cred-send" data-id="${esc(u.id)}">${waiting ? 'View and resend' : 'Send new details'}</button></div>`]; }), ['No members match', ''])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
}
function regRequests() {
  const list = S.v.requests.slice().sort((a, b) => b.at.localeCompare(a.at)), nw = list.filter(r => r.status === 'new').length;
  return `<section class="panel"><div class="panel-h"><div><h2>Login requests</h2><p>First-time members ask for login details from the sign-in page. Check each name against your register. Only then issue their details.</p></div></div>${nw ? '' : '<div class="callout ok"><div><b>Nothing waiting</b><p>New requests from members will appear here.</p></div></div>'}
  ${table(['Asked', 'Name on the request', 'Phone', ...(isVillageType() ? ['Family / Kindred'] : []), 'Message', 'Status', ''], list.map(r => [esc(fmtTS(r.at)), `<b>${esc(r.name)}</b>`, esc(r.phone), ...(isVillageType() ? [esc([r.family, r.kindred].filter(Boolean).join(', ') || '-')] : []), esc(r.note || '-'), r.status === 'new' ? '<span class="badge b-pending">Waiting</span>' : r.status === 'issued' ? `<span class="badge b-verified">Issued</span><small>${esc(r.memberId)}, by ${esc(r.handledBy)}</small>` : `<span class="badge b-rejected">Declined</span><small>${esc(r.reason)}, by ${esc(r.handledBy)}</small>`, r.status === 'new' ? `<div class="actions"><button class="btn btn-primary btn-sm" type="button" data-act="req-check" data-id="${esc(r.id)}">Check register</button><button class="btn btn-ghost btn-sm" type="button" data-act="req-decline" data-id="${esc(r.id)}">Decline</button></div>` : '']), ['No requests yet', 'Members who need login details will appear here.'])}</section>`;
}

/* ----- Register modal: verify names, add a member, click a name for their history ----- */
function mtgView(id) {
  const m = getMtg(id), open = meetingOpen(m), pend = m.marks.filter(k => k.status === 'pending').length;
  const people = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && (u.active || m.marks.some(k => k.memberId === u.id))).sort((a, b) => a.name.localeCompare(b.name));
  const rows = people.map(u => { const k = m.marks.find(x => x.memberId === u.id), st = k ? k.status : 'absent';
    const own = u.id === S.u.id, mine = k && (k.memberId === S.u.id || k.addedById === S.u.id), bt = (a, l, extra) => `<button class="btn ${extra || 'btn-ghost'} btn-sm" type="button" data-act="${a}" data-id="${esc(m.id)}" data-m="${esc(u.id)}"`;
    const vbtn = `${bt('mtg-mark', '', 'btn-leaf')} data-s="verified">Verify</button>${bt('mtg-mark')} data-s="rejected">Reject</button>`, rm = `${bt('mtg-remove')}>Remove</button>`;
    const act = st === 'pending' ? (mine ? `<small>Another admin must verify</small>${k.addedById === S.u.id && !own ? rm : ''}` : vbtn)
      : st === 'verified' ? (own ? '' : rm) : (own ? '' : `${bt('mtg-mark')} data-s="verified">Mark present</button>`);
    return [`${linkBtn('member-profile', u.id, u.name)}<small>${esc(u.id)}</small>`, k ? esc(fmtTS(k.at)) + (k.addedByAdmin ? '<small>Added by admin</small>' : '') : '-', attBadge(st === 'absent' && open ? 'absent' : st), k && k.by ? `${esc(k.by)}<small>${esc(fmtTS(k.byAt))}</small>` : '-', `<div class="actions">${act}</div>`]; });
  infoModal(m.title, `${esc(fmtDate(m.date))}. ${presentCount(m)} verified present, ${pend} waiting. ${open ? 'Register is open.' : 'Register is closed.'}`,
    `<div class="btn-row" style="margin-top:12px">${pend ? `<button class="btn btn-leaf btn-sm" type="button" data-act="mtg-all" data-id="${esc(m.id)}">Verify all ${pend} waiting</button>` : ''}${open ? `<button class="btn btn-ghost btn-sm" type="button" data-act="mtg-close" data-id="${esc(m.id)}">Close register</button>` : ''}${open && !m.marks.some(k => k.memberId === S.u.id) && S.u.id !== 'SUPPORT' && !S.owner ? `<button class="btn btn-primary btn-sm" type="button" data-act="att-mark-admin" data-id="${esc(m.id)}">Mark me present</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="mtg-csv" data-id="${esc(m.id)}">Download CSV</button></div>
    ${table(['Member', 'Marked at', 'Status', 'Checked by', ''], rows, ['No members', '']).replace(/<td>(<div class="actions">)/g, '<td>$1')}`);
}
Object.assign(ACTIONS, {
  'mtg-open'() {
    requireAdmin();
    openModal({ title: "Open today's register", sub: 'Members can mark themselves present only while it is open, and only for today. You verify every name.', body: `<div class="field"><label for="mtT">Meeting</label><input id="mtT" name="title" class="input" maxlength="60" value="General meeting" required></div><div class="field"><label>Date</label><input class="input" value="${esc(fmtDate(today()))}" disabled><span class="hint">Registers open for today only. This stops anyone signing for a meeting that did not happen.</span></div>`, submit: 'Open register',
      onSubmit: fd => { const t = (fd.get('title') || '').trim(); if (t.length < 3) throw new Error('Enter the meeting name.'); const m = API.openRegister(t); closeModal(); renderView(); toast('Register is open. Members can now mark attendance.', 'ok'); } });
  },
  'mtg-close'(el) { requireAdmin(); const m = getMtg(el.dataset.id); openModal({ title: 'Close the register?', sub: `${esc(m.title)}. Members will no longer be able to mark attendance. You can still verify names afterwards.`, body: '', submit: 'Close register', onSubmit: () => { API.closeRegister(m.id); closeModal(); renderView(); toast('Register closed.', 'ok'); } }); },
  'mtg-view'(el) { mtgView(el.dataset.id); },
  'mtg-mark'(el) { API.setMark(el.dataset.id, el.dataset.m, el.dataset.s); mtgView(el.dataset.id); renderSoon(); },
  'mtg-remove'(el) { API.removeMark(el.dataset.id, el.dataset.m); mtgView(el.dataset.id); renderSoon(); },
  'mtg-all'(el) { const n = API.verifyAll(el.dataset.id); toast(`${n} names verified.`, 'ok'); mtgView(el.dataset.id); renderSoon(); },
  'mtg-csv'(el) { requireAdmin(); const m = getMtg(el.dataset.id), rows = [['Member ID', 'Name', 'Family / Kindred', 'Status', 'Marked at', 'Checked by']]; S.v.users.filter(u => u.role === 'member' && u.active).forEach(u => { const k = m.marks.find(x => x.memberId === u.id); rows.push([u.id, u.name, kinOf(u), k ? k.status : 'absent', k ? fmtTS(k.at) : '', k && k.by ? k.by : '']); }); csvDownload(`${S.v.code}-attendance-${m.date}.csv`, rows); },
  'register-csv'() { requireAdmin(); const yr = new Date().getFullYear(), rows = [['Member ID', 'Name', 'Family / Kindred', 'Phone', 'Meetings attended', 'Meetings counted', 'Paid ' + yr, 'Owes', 'Account']]; S.v.users.filter(u => u.role === 'member').forEach(u => { const a = attendanceOf(u.id); rows.push([u.id, u.name, kinOf(u), u.phone, a.present, a.total, sum(memberPaid(u.id, yr)), memberOutstanding(u.id, yr), u.active ? 'Active' : 'Deactivated']); }); csvDownload(`${S.v.code}-member-register.csv`, rows); }
});

/* ----- Login details: show, copy, send on WhatsApp ----- */
function credMessage(u) {
  return `Hello ${u.name.split(' ')[0]}, here are your login details for ${S.v.name} on VillageVault.\nOpen the VillageVault website, choose "${S.v.name}" and sign in with:\nID: ${u.id}\nTemporary password: ${u.tempPw}\nYou will be asked to choose your own password the first time you sign in.\nFrom ${S.u.name}, ${S.u.title}.`;
}
async function credModal(id, forceNew, phone) {
  const u = userById(id); if (!u) return;
  try { if (!u.tempPw || forceNew) { await API.resetPassword(id, genPw()); renderSoon(); } } catch (e) { return toast(e.message, 'err'); }
  const msg = credMessage(u), wa = waLinkTo(phone || u.phone, msg);
  openModal({ title: 'Login details', size: 'modal-md', sub: `${esc(u.name)} (${esc(u.id)}). Send these to the member yourself. They choose their own password at first sign-in.`, submit: false,
    body: `<div class="field" style="margin-top:14px"><label for="credText">Message to send</label><textarea id="credText" class="textarea copybox" rows="7" readonly>${esc(msg)}</textarea></div>
    <div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="copy-cred" data-id="${esc(id)}">Copy message</button>${wa ? `<a class="btn btn-leaf btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" data-act="cred-sent" data-id="${esc(id)}" data-how="WhatsApp">Send on WhatsApp</a>` : '<span class="hint">Add the member\'s phone number to send on WhatsApp.</span>'}<button class="btn btn-ghost btn-sm" type="button" data-act="cred-new" data-id="${esc(id)}">Issue a new password</button></div>` });
}
Object.assign(ACTIONS, {
  'cred-send'(el) {
    requireAdmin(); const u = userById(el.dataset.id); if (!u) return;
    if (u.tempPw) return credModal(u.id);
    openModal({ title: 'Send new login details?', sub: `${esc(u.name)} already uses their own password. We never store it, so a new temporary password will be issued and their old one stops working.`, body: '', submit: 'Issue and show details', onSubmit: () => { closeModal(); credModal(u.id, true); } });
  },
  'cred-new'(el) { const u = userById(el.dataset.id); openModal({ title: 'Issue a new password?', sub: `${esc(u.name)}'s current temporary password will stop working.`, body: '', submit: 'Issue new password', onSubmit: () => { closeModal(); credModal(u.id, true); } }); },
  'cred-sent'(el) { try { API.logCredSent(el.dataset.id, el.dataset.how); renderSoon(); } catch (_) {} },
  'copy-cred'(el) {
    const ta = $('#credText'); if (!ta) return; ta.select();
    const ok = () => { try { API.logCredSent(el.dataset.id, 'Copied'); renderSoon(); } catch (_) {} toast('Message copied. Paste it into WhatsApp or SMS.', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, () => { try { document.execCommand('copy'); } catch (_) {} ok(); }); else { try { document.execCommand('copy'); } catch (_) {} ok(); }
  }
});

/* ----- First-time members: request login details from the sign-in page ----- */
async function submitAccessRequest(vid, d) {
  const vil = vilById(vid); if (!vil || vil.removed) throw new Error('This village or association is not available.');
  const v = await DB.load(vid); if (v.status === 'suspended') throw new Error('Access is paused for this village or association. Contact VillageVault support.');
  if (v.requests.some(r => r.status === 'new' && waNum(r.phone) === waNum(d.phone))) throw new Error('You already asked. Your admin will contact you on that phone number.');
  v.seq.req = (v.seq.req || 0) + 1; v.requests.push({ id: `${v.code}-R${String(v.seq.req).padStart(3, '0')}`, name: d.name, phone: d.phone, family: d.family || '', kindred: d.kindred || '', note: d.note, at: stamp(), status: 'new' });
  if (!DB.save(v)) warnStorage();
}
ACTIONS['request-access'] = function () {
  const vid = $('#heroVillage') && $('#heroVillage').value; if (!vid) return toast('Choose your village or association first.', 'err');
  const vil = vilById(vid);
  openModal({ title: 'Request your login details', sub: `${esc(vil.name)}. Your admin will check your name on the village register, then send you your own login details.`,
    body: `<div class="field"><label for="rqN">Your full name, as on the register</label><input id="rqN" name="name" class="input" maxlength="80" required></div><div class="form-row"><div class="field"><label for="rqP">Phone number</label><input id="rqP" name="phone" class="input" type="tel" maxlength="20" placeholder="0803 123 4567" required></div></div>${vil.type !== 'association' ? '<div class="form-row"><div class="field"><label for="rqF">Family name</label><input id="rqF" name="family" class="input" maxlength="40" required></div><div class="field"><label for="rqK">Kindred name</label><input id="rqK" name="kindred" class="input" maxlength="40" required></div></div>' : ''}<div class="field"><label for="rqM">Message to the admin</label><textarea id="rqM" name="note" class="textarea" maxlength="200" required placeholder="${vil.type !== 'association' ? 'For example: I live abroad and joined in 2019' : 'For example: I joined in 2019 and my membership number is 123'}"></textarea></div>`, submit: 'Send request',
    onSubmit: async fd => {
      const d = { name: (fd.get('name') || '').trim(), phone: (fd.get('phone') || '').trim(), family: (fd.get('family') || '').trim(), kindred: (fd.get('kindred') || '').trim(), note: (fd.get('note') || '').trim() };
      if (d.name.split(/\s+/).length < 2 || d.name.length < 5) throw new Error('Enter your full name as it appears on the register.'); if (waNum(d.phone).length < 12) throw new Error('Enter a valid phone number so your admin can reach you.');
      if (vil.type !== 'association' && (d.family.length < 2 || d.kindred.length < 2)) throw new Error('Enter your family name and your kindred name.'); if (d.note.length < 5) throw new Error('Write a short message to your admin.');
      await submitAccessRequest(vid, d); closeModal(); toast('Request sent. Your admin will contact you after checking the register.', 'ok');
    } });
};
function matchScore(r, u) {
  const tok = s => String(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(x => x.length > 1), a = tok(r.name), b = tok(u.name);
  return a.filter(x => b.includes(x)).length * 2 + (waNum(r.phone) && waNum(r.phone) === waNum(u.phone) ? 5 : 0) + (r.family && u.family && r.family.toLowerCase().replace(/ family$/, '') === u.family.toLowerCase().replace(/ family$/, '') ? 1 : 0) + (r.kindred && u.kindred && r.kindred.toLowerCase().replace(/ kindred$/, '') === u.kindred.toLowerCase().replace(/ kindred$/, '') ? 1 : 0);
}
Object.assign(ACTIONS, {
  'req-check'(el) {
    requireAdmin(); const r = S.v.requests.find(x => x.id === el.dataset.id); if (!r) return;
    const members = S.v.users.filter(u => u.role === 'member').map(u => ({ u, s: matchScore(r, u) })).sort((a, b) => b.s - a.s || a.u.name.localeCompare(b.u.name)), top = members.filter(x => x.s > 0).slice(0, 4);
    openModal({ title: 'Check the register', size: 'modal-lg', sub: `Request from ${esc(r.name)}, ${esc(r.phone)}${r.family ? '. Says: ' + esc(r.family) + ', ' + esc(r.kindred) + ' kindred' : ''}. Confirm this person is on your register before you send anything.`,
      body: `<div class="sec-title" style="margin-top:14px">Closest names on the register</div>${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', 'Why it matches'], top.map(x => [`${esc(x.u.name)}<small>${esc(x.u.id)}</small>`, ...(isVillageType() ? [esc(kinOf(x.u) || '-')] : []), esc(x.u.phone || '-'), waNum(r.phone) === waNum(x.u.phone) ? 'Same phone number' : 'Similar name']), ['No similar names found', 'If this person is not on the register, decline the request or add them from the Members page first.'])}
      <div class="field"><label for="rcM">Member on the register</label><select id="rcM" name="member" class="select">${opt('', 'Choose the matching member', '')}${members.map(x => opt(x.u.id, `${x.u.name} (${x.u.id})${kinOf(x.u) ? ', ' + kinOf(x.u) : ''}${x.u.active ? '' : ', deactivated'}`, '')).join('')}</select></div>
      <label class="check"><input type="checkbox" name="confirm"> <span>I have checked the village register and confirmed this person is a member.</span></label>`, submit: 'Issue login details',
      onSubmit: async fd => {
        const mid = fd.get('member'); if (!mid) throw new Error('Choose the member this request matches.'); if (!fd.get('confirm')) throw new Error('Tick the box to confirm you checked the register.');
        const u = userById(mid); if (!u || !u.active) throw new Error('That member account is not active. Edit the member first.');
        await API.resetPassword(mid, genPw()); API.resolveRequest(r.id, { status: 'issued', memberId: mid }); closeModal(); renderView(); credModal(mid, false, r.phone);
      } });
  },
  'req-decline'(el) {
    requireAdmin(); const r = S.v.requests.find(x => x.id === el.dataset.id); if (!r) return;
    openModal({ title: 'Decline this request', danger: true, sub: `${esc(r.name)}, ${esc(r.phone)}`, body: `<div class="field"><label for="rdR">Reason</label><select id="rdR" name="reason" class="select">${opt('', 'Choose a reason', '')}${['Name not found on the register', 'Details do not match our records', 'Duplicate request', 'Other'].map(x => opt(x, x, '')).join('')}</select></div>`, submit: 'Decline request',
      onSubmit: fd => { if (!fd.get('reason')) throw new Error('Choose a reason.'); API.resolveRequest(r.id, { status: 'declined', reason: fd.get('reason') }); done('Request declined.'); } });
  }
});
