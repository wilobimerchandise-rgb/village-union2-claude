/* =========================================================
   ROUND 14 (part 2): term-of-office tracker, agenda builder, emergency levies, community projects,
   birthdays and anniversaries, navigation and banners. All Premium.
   ========================================================= */
const isOrganiser = () => isChairman() || isSecretary() || isFinSec();
const needOrganiser = () => { requireAdmin(); if (!isOrganiser() && !isLeadAdmin()) throw new Error('Only the Chairman, Secretary or Financial Secretary can do this.'); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const waText = t => `https://wa.me/?text=${encodeURIComponent(t)}`;
const bar = (pct, tone) => `<div class="pbar" role="img" aria-label="${pct}% done"><span style="width:${Math.max(0, Math.min(100, pct))}%;background:${tone || '#12806A'}"></span></div>`;

/* ---------- Term-of-office tracker ---------- */
Object.assign(API, {
  setTerm(adminId, d) {
    requireLead(); assertFeature('terms', 'The term-of-office tracker'); const u = userById(adminId); if (!u || u.role !== 'admin') throw new Error('Admin not found.');
    if (!d.start || !d.end) throw new Error('Choose the start and end dates.'); if (d.end <= d.start) throw new Error('The term must end after it starts.');
    S.v.terms = S.v.terms || {}; S.v.terms[adminId] = { start: d.start, end: d.end, setBy: S.u.name, setAt: stamp() };
    log('Set term of office', adminId, `${u.name} (${u.title || 'Admin'}): ${fmtDate(d.start)} to ${fmtDate(d.end)}`); commit();
  }
});
function termInfo(id) {
  const t = (S.v.terms || {})[id]; if (!t) return { t: null, s: 'none', label: 'Not set' };
  const left = dayDiff(today(), t.end); if (left < 0) return { t, s: 'expired', left, label: `Expired ${-left} day${left === -1 ? '' : 's'} ago` };
  if (left <= 60) return { t, s: 'soon', left, label: `Ends in ${left} day${left === 1 ? '' : 's'}` };
  return { t, s: 'ok', left, label: `Running, ${Math.round(left / 30)} months left` };
}
function termBanner() {
  if (!planAllows('terms') || !isAdmin()) return '';
  const mine = S.v.users.filter(u => u.role === 'admin' && u.active && (isLeadAdmin() || u.id === S.u.id)).map(u => ({ u, i: termInfo(u.id) })).filter(x => x.i.s === 'expired' || x.i.s === 'soon');
  if (!mine.length) return '';
  return `<div class="callout warn"><div><b>${mine.length === 1 && !isLeadAdmin() ? 'Your term of office is ending' : 'Terms of office need attention'}</b><p>${mine.slice(0, 3).map(x => `${esc(x.u.name)} (${esc(x.u.title || 'Admin')}): ${esc(x.i.label)}`).join('. ')}.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="goto" data-page="terms">Open terms</button></div>`;
}
function termsView() {
  if (!planAllows('terms')) return premiumGate('Terms of office', 'Record when each officer’s term starts and ends, get a warning before it ends, and print a handover pack for the next officers.');
  const lead = isLeadAdmin(), admins = S.v.users.filter(u => u.role === 'admin' && u.active).sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0) || a.id.localeCompare(b.id));
  const badge = i => i.s === 'ok' ? `<span class="badge b-verified">${esc(i.label)}</span>` : i.s === 'none' ? `<span class="badge b-off">${esc(i.label)}</span>` : i.s === 'soon' ? `<span class="badge b-pending">${esc(i.label)}</span>` : `<span class="badge b-rejected">${esc(i.label)}</span>`;
  return `<section class="panel"><div class="panel-h"><div><h2>Terms of office</h2><p>${lead ? 'As Lead Admin you set each officer’s term. A warning shows 60 days before a term ends.' : 'The Lead Admin sets the terms. You are warned 60 days before yours ends.'}</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="handover-pdf">Download handover pack</button></div>
  ${table(['Officer', 'Duty', 'Started', 'Ends', 'Status', ''], admins.map(u => { const i = termInfo(u.id); return [`${esc(u.name)}<small>${esc(u.id)}${u.lead ? ' · Lead Admin' : ''}</small>`, esc(u.title || 'Admin'), i.t ? esc(fmtDate(i.t.start)) : '-', i.t ? esc(fmtDate(i.t.end)) : '-', badge(i), lead ? `<button class="btn btn-ghost btn-sm" type="button" data-act="set-term" data-id="${esc(u.id)}">${i.t ? 'Change term' : 'Set term'}</button>` : '']; }), ['No admins', ''])}</section>
  <section class="panel"><div class="panel-h"><div><h2>Handover pack</h2><p>One PDF for the incoming officers: who served and when, the balance, debts, bank accounts, open pledges, projects and emergencies.</p></div></div></section>`;
}
function handoverPdf() {
  const yr = new Date().getFullYear(), W = docWriter('Handover pack', `${S.v.name}, prepared ${fmtDate(today())}`, `HAND-${S.v.code}-${today()}`), bal = sum(villageTx()) - sum(activeExp());
  W.section('1. Officers and terms'); W.table([{ h: 'Duty', w: 120 }, { h: 'Name', w: 170 }, { h: 'Phone', w: 90 }, { h: 'Term', w: 135 }], S.v.users.filter(u => u.role === 'admin' && u.active).map(u => { const t = (S.v.terms || {})[u.id]; return [u.title || 'Admin', u.name, u.phone || '-', t ? `${fmtDate(t.start)} to ${fmtDate(t.end)}` : 'Not set']; }));
  W.section('2. Money'); W.kv([[balLabel(), naira(bal)], ['Collected in ' + yr, naira(sum(villageTx().filter(t => yearOf(t.date) === yr)))], ['Spent in ' + yr, naira(sum(activeExp().filter(e => yearOf(e.date) === yr)))]]);
  W.table([{ h: 'Bank', w: 150 }, { h: 'Account number', w: 120 }, { h: 'Account name', w: 245 }], (S.v.settings.accounts || []).map(a => [a.bank, a.number, a.name]));
  const owing = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && u.active).map(u => ({ u, o: memberOutstanding(u.id, yr) })).filter(x => x.o > 0).sort((a, b) => b.o - a.o);
  W.section('3. Debts still to collect'); W.table([{ h: 'Member', w: 255 }, { h: 'ID', w: 100 }, { h: 'Owes', w: 160, align: 'right' }], owing.map(x => [x.u.name, x.u.id, naira(x.o)]).concat([{ cells: ['Total', '', naira(owing.reduce((a, x) => a + x.o, 0))], total: true }]));
  W.section('4. Open projects and emergencies'); W.table([{ h: 'Item', w: 255 }, { h: 'Target', w: 130, align: 'right' }, { h: 'Raised', w: 130, align: 'right' }], (S.v.projects || []).filter(p => p.status !== 'completed').map(p => [p.name, naira(p.target), naira(projectRaised(p))]).concat(levyAll().filter(l => l.emergency && l.emergency.status !== 'closed').map(l => [l.name + ' (emergency)', naira((S.v.settings.levies[l.id] || 0) * S.v.users.filter(u => u.active && (u.role === 'member' || u.role === 'admin')).length), naira(sum(S.v.tx.filter(t => t.status === 'verified' && t.levy === l.id)))])));
  W.space(10); W.sign([['Outgoing officer', ''], ['Incoming officer', ''], ['Lead Admin', S.v.users.filter(u => u.lead)[0] ? S.v.users.filter(u => u.lead)[0].name : '']]);
  return W.build();
}
Object.assign(ACTIONS, {
  'set-term'(el) { requireLead(); const u = userById(el.dataset.id), t = (S.v.terms || {})[u.id] || {}; openModal({ title: `Term of office for ${u.name}`, sub: esc(u.title || 'Admin'), body: `<div class="form-row"><div class="field"><label for="tmS">Term starts</label><input id="tmS" name="start" class="input" type="date" value="${esc(t.start || today())}" required></div><div class="field"><label for="tmE">Term ends</label><input id="tmE" name="end" class="input" type="date" value="${esc(t.end || addDays(today(), 730))}" required></div></div><p class="hint">Most terms run two years. You will be warned 60 days before it ends.</p>`, submit: 'Save term', onSubmit: fd => { API.setTerm(u.id, { start: fd.get('start'), end: fd.get('end') }); done('Term saved.'); } }); },
  'handover-pdf'() { requireAdmin(); assertFeature('terms', 'The handover pack'); download(`${S.v.code}-handover-pack.pdf`, handoverPdf()); log('Downloaded handover pack', S.v.code, 'Handover pack'); commit(); toast('Handover pack downloaded.', 'ok'); }
});

/* ---------- Agenda builder ---------- */
const canAgenda = () => isChairman() || isSecretary();
const parseItems = txt => String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = l.split('|').map(x => x.trim()); return { t: p[0], who: p[1] || '', mins: Math.max(0, Math.min(240, parseInt(p[2], 10) || 0)) }; });
Object.assign(API, {
  saveAgenda(id, d) {
    requireAdmin(); assertFeature('agenda', 'The agenda builder'); if (!canAgenda()) throw new Error('Only the Secretary or the Chairman can write the agenda.');
    const t = (d.title || '').trim(); if (t.length < 3) throw new Error('Give the meeting a name.'); if (!d.date) throw new Error('Choose the meeting date.'); const items = parseItems(d.items); if (!items.length) throw new Error('Add at least one agenda item, one per line.');
    S.v.agendas = S.v.agendas || []; let a;
    if (id) { a = S.v.agendas.find(x => x.id === id); if (!a) throw new Error('Agenda not found.'); Object.assign(a, { title: t, date: d.date, time: d.time || '', venue: (d.venue || '').trim(), items, notes: (d.notes || '').trim(), updatedBy: S.u.name, updatedAt: stamp() }); log('Edited agenda', id, `${t}, ${fmtDate(d.date)}`); }
    else { a = { id: nextId('agd', 'AG'), title: t, date: d.date, time: d.time || '', venue: (d.venue || '').trim(), items, notes: (d.notes || '').trim(), status: 'draft', createdBy: S.u.name, createdById: S.u.id, createdAt: stamp() }; S.v.agendas.push(a); log('Created agenda', a.id, `${t}, ${fmtDate(d.date)}`); }
    commit(); return a;
  },
  publishAgenda(id, on) { requireAdmin(); if (!canAgenda()) throw new Error('Only the Secretary or the Chairman can publish the agenda.'); const a = (S.v.agendas || []).find(x => x.id === id); if (!a) throw new Error('Agenda not found.'); a.status = on ? 'published' : 'draft'; log(on ? 'Published agenda' : 'Withdrew agenda', id, a.title); commit(); },
  deleteAgenda(id) { requireAdmin(); if (!canAgenda()) throw new Error('Only the Secretary or the Chairman can delete an agenda.'); const a = (S.v.agendas || []).find(x => x.id === id); if (!a) throw new Error('Agenda not found.'); S.v.agendas = S.v.agendas.filter(x => x.id !== id); log('Deleted agenda', id, a.title); commit(); }
});
function agendaText(a) { return `*${S.v.name}: ${a.title}*\n${fmtDate(a.date)}${a.time ? ' at ' + a.time : ''}${a.venue ? '\nVenue: ' + a.venue : ''}\n\nAgenda:\n${a.items.map((i, n) => `${n + 1}. ${i.t}${i.who ? ' (' + i.who + ')' : ''}${i.mins ? ' - ' + i.mins + ' min' : ''}`).join('\n')}${a.notes ? '\n\n' + a.notes : ''}\n\nPlease come on time.`; }
function agendaPdf(a) {
  const W = docWriter('Meeting agenda', `${a.title}, ${fmtDate(a.date)}${a.time ? ' at ' + a.time : ''}`, a.id); if (a.venue) W.kv([['Venue', a.venue]]);
  W.section('Order of business'); W.table([{ h: 'No', w: 40 }, { h: 'Item', w: 285 }, { h: 'Led by', w: 130 }, { h: 'Minutes', w: 60, align: 'right' }], a.items.map((i, n) => [String(n + 1), i.t, i.who, i.mins ? String(i.mins) : '']).concat([{ cells: ['', 'Planned time', '', String(a.items.reduce((s, i) => s + i.mins, 0)) + ' min'], total: true }]));
  if (a.notes) { W.section('Notes'); W.para(a.notes); } W.space(8); W.sign([['Secretary', holderName('Secretary')], ['Chairman', holderName('Chairman')]]); return W.build();
}
function agendaForm(a) {
  a = a || {}; return `<div class="field"><label for="agT">Meeting name</label><input id="agT" name="title" class="input" maxlength="80" value="${esc(a.title || '')}" placeholder="Monthly general meeting" required></div>
  <div class="form-row"><div class="field"><label for="agD">Date</label><input id="agD" name="date" class="input" type="date" value="${esc(a.date || today())}" required></div><div class="field"><label for="agM">Time</label><input id="agM" name="time" class="input" type="time" value="${esc(a.time || '')}"></div></div>
  <div class="field"><label for="agV">Venue</label><input id="agV" name="venue" class="input" maxlength="80" value="${esc(a.venue || '')}"></div>
  <div class="field"><label for="agI">Agenda items, one per line: item | led by | minutes</label><textarea id="agI" name="items" class="input" rows="7" placeholder="Opening prayer | Chaplain | 5&#10;Minutes of last meeting | Secretary | 10&#10;Financial report | Financial Secretary | 15">${esc((a.items || []).map(i => [i.t, i.who, i.mins || ''].join(' | ').replace(/( \| )+$/, '')).join('\n'))}</textarea></div>
  <div class="field"><label for="agN">Notes for members (optional)</label><input id="agN" name="notes" class="input" maxlength="160" value="${esc(a.notes || '')}"></div>`;
}
function agendasView() {
  if (!planAllows('agenda')) return premiumGate('Agenda builder', 'The Secretary or Chairman builds the meeting agenda, publishes it to members, downloads it as a PDF and shares it on WhatsApp.');
  const can = canAgenda(), list = (S.v.agendas || []).filter(a => can || isAdmin() || a.status === 'published').sort((a, b) => b.date.localeCompare(a.date));
  return `<section class="panel"><div class="panel-h"><div><h2>Meeting agendas</h2><p>${can ? 'Write the agenda, publish it, then send it to members.' : isAdmin() ? 'The Secretary and Chairman write the agenda. You can read and download it.' : 'Agendas for coming meetings.'}</p></div>${can ? '<button class="btn btn-primary btn-sm" type="button" data-act="new-agenda">New agenda</button>' : ''}</div>
  ${list.length ? list.map(a => `<div class="rep-item" style="display:block;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${esc(a.title)}</b><br><small>${esc(fmtDate(a.date))}${a.time ? ' at ' + esc(a.time) : ''}${a.venue ? ' · ' + esc(a.venue) : ''} · ${a.status === 'published' ? 'Published' : 'Draft'}</small></div><div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="agenda-pdf" data-id="${esc(a.id)}">PDF</button><button class="btn btn-leaf btn-sm" type="button" data-act="share-agenda" data-id="${esc(a.id)}">Share</button>${isAdmin() ? `<a class="btn btn-leaf btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(waText(agendaText(a)))}">WhatsApp</a>` : ''}${can ? `<button class="btn btn-ghost btn-sm" type="button" data-act="edit-agenda" data-id="${esc(a.id)}">Edit</button><button class="btn btn-${a.status === 'published' ? 'ghost' : 'saffron'} btn-sm" type="button" data-act="pub-agenda" data-id="${esc(a.id)}">${a.status === 'published' ? 'Withdraw' : 'Publish'}</button><button class="btn btn-danger btn-sm" type="button" data-act="del-agenda" data-id="${esc(a.id)}">Delete</button>` : ''}</div></div>
  <ol class="agenda-list">${a.items.map(i => `<li>${esc(i.t)}${i.who ? ` <small>${esc(i.who)}</small>` : ''}${i.mins ? ` <small>${i.mins} min</small>` : ''}</li>`).join('')}</ol>${a.notes ? `<p class="hint">${esc(a.notes)}</p>` : ''}</div>`).join('') : '<p class="muted">No agenda yet.</p>'}</section>`;
}
Object.assign(ACTIONS, {
  'new-agenda'() { openModal({ title: 'New agenda', size: 'modal-lg', body: agendaForm(), submit: 'Save as draft', onSubmit: fd => { API.saveAgenda('', Object.fromEntries(fd)); done('Agenda saved. Publish it when it is ready.'); } }); },
  'edit-agenda'(el) { const a = S.v.agendas.find(x => x.id === el.dataset.id); openModal({ title: 'Edit agenda', size: 'modal-lg', sub: esc(a.id), body: agendaForm(a), submit: 'Save changes', onSubmit: fd => { API.saveAgenda(a.id, Object.fromEntries(fd)); done('Agenda updated.'); } }); },
  'pub-agenda'(el) { const a = S.v.agendas.find(x => x.id === el.dataset.id); API.publishAgenda(a.id, a.status !== 'published'); done(a.status === 'published' ? 'Published. Members can now read it.' : 'Withdrawn.'); },
  'del-agenda'(el) { const a = S.v.agendas.find(x => x.id === el.dataset.id); openModal({ title: 'Delete this agenda?', danger: true, sub: esc(a.title), body: '<p class="hint">This cannot be undone.</p>', submit: 'Delete', onSubmit: () => { API.deleteAgenda(a.id); done('Agenda deleted.'); } }); },
  'agenda-pdf'(el) { const a = (S.v.agendas || []).find(x => x.id === el.dataset.id); if (!a || (!isAdmin() && a.status !== 'published')) return toast('Not available.', 'err'); download(`${S.v.code}-agenda-${a.date}.pdf`, agendaPdf(a)); }
});

/* ---------- Emergency levies ---------- */
const emergencies = () => levyAll().filter(l => l.emergency);
const livePeople = () => S.v.users.filter(u => u.active && (u.role === 'member' || u.role === 'admin'));
Object.assign(API, {
  openEmergency(d) {
    requireAdmin(); assertFeature('emergency', 'The emergency levy workflow'); if (!isOrganiser()) throw new Error('Only the Chairman, Secretary or Financial Secretary can open an emergency levy.');
    const nm = (d.name || '').trim(), amt = Number(d.amount); if (nm.length < 3) throw new Error('Name the emergency, for example “Burial support: late Mr Okeke”.'); if (!(amt > 0)) throw new Error('Enter the amount each member pays.'); if (!d.deadline || d.deadline < today()) throw new Error('Choose a deadline that is today or later.');
    if (levyAll().some(l => !l.removed && l.name.toLowerCase() === nm.toLowerCase())) throw new Error('A levy with that name already exists.');
    S.v.seq.lev = (S.v.seq.lev || 0) + 1; const id = 'e' + S.v.seq.lev + Date.now().toString(36).slice(-3);
    S.v.levyList.push({ id, name: nm, fixed: true, color: '#D2395B', emergency: { reason: (d.reason || '').trim(), deadline: d.deadline, by: S.u.name, byId: S.u.id, byTitle: S.u.title || 'Admin', at: stamp(), status: 'open' } }); S.v.settings.levies[id] = amt;
    log('Opened emergency levy', id, `${nm}: ${money(amt)} from every member, deadline ${fmtDate(d.deadline)}`); commit(); return id;
  },
  closeEmergency(id) { requireAdmin(); if (!isOrganiser()) throw new Error('Only the Chairman, Secretary or Financial Secretary can close an emergency levy.'); const l = levyAll().find(x => x.id === id && x.emergency); if (!l) throw new Error('Emergency not found.'); l.emergency.status = 'closed'; l.emergency.closedAt = stamp(); l.emergency.closedBy = S.u.name; l.removed = true; log('Closed emergency levy', id, `${l.name}: ${money(sum(S.v.tx.filter(t => t.status === 'verified' && t.levy === id)))} collected`); commit(); }
});
function emergencyStats(l) {
  const ppl = livePeople(), amt = S.v.settings.levies[l.id] || 0, paidBy = {}; S.v.tx.filter(t => t.status === 'verified' && t.levy === l.id).forEach(t => { paidBy[t.memberId] = (paidBy[t.memberId] || 0) + t.amount; });
  const done = ppl.filter(u => (paidBy[u.id] || 0) >= amt), owing = ppl.filter(u => (paidBy[u.id] || 0) < amt), got = sum(S.v.tx.filter(t => t.status === 'verified' && t.levy === l.id));
  return { ppl, amt, paidBy, done, owing, got, target: amt * ppl.length, left: dayDiff(today(), l.emergency.deadline) };
}
function emergencyBanner() {
  if (!planAllows('emergency') || !S.u || S.owner) return ''; const yr = new Date().getFullYear();
  const mine = emergencies().filter(l => l.emergency.status !== 'closed' && !l.removed).map(l => ({ l, s: emergencyStats(l) })).filter(x => x.s.owing.some(u => u.id === S.u.id)); if (!mine.length) return '';
  return mine.map(x => `<div class="callout warn"><div><b>Emergency levy: ${esc(x.l.name)}</b><p>${money(x.s.amt)} from every member${x.l.emergency.reason ? '. ' + esc(x.l.emergency.reason) : ''}. Deadline ${esc(fmtDate(x.l.emergency.deadline))} (${x.s.left < 0 ? -x.s.left + ' days late' : x.s.left === 0 ? 'today' : x.s.left + ' days left'}).</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="emg-pay" data-id="${esc(x.l.id)}">Pay now</button></div>`).join('');
}
function emergencyView() {
  if (!planAllows('emergency')) return premiumGate('Emergency levies', 'When a member dies or the village faces an emergency, the Chairman, Secretary or Financial Secretary names a levy. Every member sees it, can pay it, and the progress is tracked.');
  const open = emergencies().filter(l => l.emergency.status !== 'closed'), closed = emergencies().filter(l => l.emergency.status === 'closed'), can = isOrganiser();
  const card = l => { const s = emergencyStats(l), pct = s.target ? Math.round(s.got * 100 / s.target) : 0, mineOwes = s.owing.some(u => S.u && u.id === S.u.id), closedL = l.emergency.status === 'closed';
    return `<section class="panel"><div class="panel-h"><div><h2>${esc(l.name)}</h2><p>${esc(l.emergency.reason || 'No details given.')}<br><small>Opened by ${esc(l.emergency.by)} (${esc(l.emergency.byTitle)}) on ${esc(fmtTS(l.emergency.at))}</small></p></div><div class="actions">${!closedL && mineOwes ? `<button class="btn btn-saffron btn-sm" type="button" data-act="emg-pay" data-id="${esc(l.id)}">Pay my ${money(s.amt)}</button>` : ''}${!closedL && can ? `<button class="btn btn-ghost btn-sm" type="button" data-act="emg-close" data-id="${esc(l.id)}">Close</button>` : ''}</div></div>
    <div class="rep-sum"><div><small>Each member</small><b>${money(s.amt)}</b></div><div><small>Collected</small><b>${money(s.got)}</b></div><div><small>Target</small><b>${money(s.target)}</b></div><div><small>${closedL ? 'Closed' : 'Deadline'}</small><b>${closedL ? esc(fmtDate((l.emergency.closedAt || '').slice(0, 10))) : s.left < 0 ? -s.left + ' days late' : s.left + ' days'}</b></div></div>${bar(pct, closedL ? '#5B5F7A' : '#D2395B')}<p class="hint">${s.done.length} of ${s.ppl.length} members have paid (${pct}%).</p>
    ${isAdmin() && !closedL && s.owing.length ? `<details class="vz-table"><summary>${s.owing.length} still to pay</summary>${table(['Member', 'Phone', ''], s.owing.map(u => [`${esc(u.name)}<small>${esc(u.id)}</small>`, esc(u.phone || '-'), u.phone ? `<a class="btn btn-leaf btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(waLinkTo(u.phone, `Dear ${u.name.split(' ')[0]}, ${S.v.name} has opened an emergency levy: ${l.name}. Please pay ${money(s.amt)} by ${fmtDate(l.emergency.deadline)}. Pay to: ${(S.v.settings.accounts || []).map(a => a.bank + ' ' + a.number + ' (' + a.name + ')').join('; ')}. Then upload your proof in VillageVault.`))}">WhatsApp</a>` : '']), ['Everyone has paid', ''])}</details>` : ''}</section>`; };
  return `${can ? `<section class="panel"><div class="panel-h"><div><h2>Emergency levies</h2><p>Name a levy for a burial or any emergency. It is added to every member’s bills at once.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="emg-new">Open an emergency levy</button></div></section>` : ''}${open.map(card).join('') || '<section class="panel"><p class="muted">No emergency levy is open.</p></section>'}${closed.length ? `<div class="sec-title">Closed</div>${closed.map(card).join('')}` : ''}`;
}
Object.assign(ACTIONS, {
  'emg-new'() { if (!isOrganiser()) return toast('Only the Chairman, Secretary or Financial Secretary can open an emergency levy.', 'err'); openModal({ title: 'Open an emergency levy', sub: 'It is added to every active member’s bills straight away.', body: `<div class="field"><label for="emN">Name of the levy</label><input id="emN" name="name" class="input" maxlength="80" placeholder="Burial support: late Mr Okeke" required></div><div class="field"><label for="emR">What happened (members will read this)</label><input id="emR" name="reason" class="input" maxlength="160"></div><div class="form-row"><div class="field"><label for="emA">Amount each member pays (naira)</label><input id="emA" name="amount" class="input" type="number" min="1" required></div><div class="field"><label for="emD">Pay by</label><input id="emD" name="deadline" class="input" type="date" min="${today()}" value="${addDays(today(), 14)}" required></div></div>`, submit: 'Open emergency levy', onSubmit: fd => { API.openEmergency({ name: fd.get('name'), reason: fd.get('reason'), amount: fd.get('amount'), deadline: fd.get('deadline') }); done('Emergency levy opened. Members can see it on their dashboard.'); } }); },
  'emg-close'(el) { const l = emergencies().find(x => x.id === el.dataset.id), s = emergencyStats(l); openModal({ title: `Close “${l.name}”?`, danger: true, sub: `${s.owing.length} member${s.owing.length === 1 ? '' : 's'} have not paid. Closing removes it from everyone’s bills. Payments already made stay in the records.`, body: '', submit: 'Close emergency levy', onSubmit: () => { API.closeEmergency(l.id); done('Emergency levy closed.'); } }); },
  'emg-pay'(el) { uploadModal('L:' + el.dataset.id); }
});

/* ---------- Community projects ---------- */
const projects = () => S.v.projects || [];
const projectRaised = p => sum(S.v.tx.filter(t => t.status === 'verified' && t.levy === p.levyId));
Object.assign(API, {
  saveProject(id, d) {
    requireAdmin(); assertFeature('projects', 'Community projects'); if (!isOrganiser() && !isLeadAdmin()) throw new Error('Only the Chairman, Secretary, Financial Secretary or Lead Admin can manage projects.');
    const nm = (d.name || '').trim(), tg = Number(d.target); if (nm.length < 3) throw new Error('Name the project.'); if (!(tg > 0)) throw new Error('Enter the target amount.');
    S.v.projects = S.v.projects || []; let p;
    if (id) { p = S.v.projects.find(x => x.id === id); if (!p) throw new Error('Project not found.'); p.name = nm; p.desc = (d.desc || '').trim(); p.target = tg; p.deadline = d.deadline || ''; p.showDonors = d.showDonors === 'yes'; const l = levyAll().find(x => x.id === p.levyId); if (l) l.name = 'Project: ' + nm; log('Edited project', id, nm); }
    else {
      if (levyAll().some(l => !l.removed && l.name.toLowerCase() === ('Project: ' + nm).toLowerCase())) throw new Error('A project with that name already exists.');
      S.v.seq.lev = (S.v.seq.lev || 0) + 1; const lid = 'p' + S.v.seq.lev + Date.now().toString(36).slice(-3); S.v.levyList.push({ id: lid, name: 'Project: ' + nm, fixed: false, color: '#0E7490', projectLevy: true }); S.v.settings.levies[lid] = 0;
      p = { id: nextId('prj', 'PR'), name: nm, desc: (d.desc || '').trim(), target: tg, deadline: d.deadline || '', status: 'active', levyId: lid, showDonors: d.showDonors !== 'no', updates: [], createdBy: S.u.name, createdAt: stamp() }; S.v.projects.push(p); log('Started project', p.id, `${nm}, target ${money(tg)}`);
    }
    commit(); return p;
  },
  projectUpdate(id, text) { requireAdmin(); if (!isOrganiser() && !isLeadAdmin()) throw new Error('Only the Chairman, Secretary, Financial Secretary or Lead Admin can post updates.'); const p = projects().find(x => x.id === id); if (!p) throw new Error('Project not found.'); const t = (text || '').trim(); if (t.length < 3) throw new Error('Write the update.'); p.updates.unshift({ at: stamp(), by: S.u.name, text: t }); log('Project update', id, `${p.name}: ${t.slice(0, 60)}`); commit(); },
  projectStatus(id, st) { requireAdmin(); if (!isOrganiser() && !isLeadAdmin()) throw new Error('Only the Chairman, Secretary, Financial Secretary or Lead Admin can change a project.'); const p = projects().find(x => x.id === id); if (!p) throw new Error('Project not found.'); p.status = st; const l = levyAll().find(x => x.id === p.levyId); if (l) { if (st === 'completed') l.removed = true; else delete l.removed; } log(st === 'completed' ? 'Completed project' : st === 'paused' ? 'Paused project' : 'Reopened project', id, p.name); commit(); }
});
function donors(p) { const m = {}; S.v.tx.filter(t => t.status === 'verified' && t.levy === p.levyId).forEach(t => { m[t.memberId] = (m[t.memberId] || 0) + t.amount; }); return Object.entries(m).map(([id, a]) => ({ id, name: nameOf(id), amount: a })).sort((x, y) => y.amount - x.amount); }
function projectPdf(p) {
  const raised = projectRaised(p), W = docWriter('Project report', p.name, p.id); W.kv([['Status', p.status === 'completed' ? 'Completed' : p.status === 'paused' ? 'Paused' : 'In progress'], ['Target', naira(p.target)], ['Raised so far', naira(raised)], ['Funded', Math.min(100, Math.round(raised * 100 / p.target)) + '%'], ['Still needed', naira(Math.max(0, p.target - raised))], ['Deadline', p.deadline ? fmtDate(p.deadline) : 'None']]);
  if (p.desc) { W.section('About the project'); W.para(p.desc); }
  if (p.showDonors) { W.section('Donors'); W.table([{ h: 'Name', w: 335 }, { h: 'Given', w: 180, align: 'right' }], donors(p).map(d => [d.name, naira(d.amount)])); }
  W.section('Progress updates'); W.table([{ h: 'Date', w: 90 }, { h: 'By', w: 120 }, { h: 'Update', w: 305 }], p.updates.map(u => [fmtDate(u.at.slice(0, 10)), u.by, u.text])); W.space(8); W.sign([['Chairman', holderName('Chairman')], ['Financial Secretary', holderName('Financial Secretary')]]); return W.build();
}
function projectsView() {
  if (!planAllows('projects')) return premiumGate('Community projects', 'Start a project such as a borehole or town hall, set a target, and watch the progress bar fill as members give. Members see the donor wall and every update.');
  const can = isOrganiser() || isLeadAdmin(), list = projects().slice().sort((a, b) => (a.status === 'completed') - (b.status === 'completed') || b.createdAt.localeCompare(a.createdAt));
  return `<section class="panel"><div class="panel-h"><div><h2>Community projects</h2><p>Projects the village is funding together. Give by uploading proof of payment against the project.</p></div>${can ? '<button class="btn btn-saffron btn-sm" type="button" data-act="prj-new">Start a project</button>' : ''}</div></section>
  ${list.map(p => { const r = projectRaised(p), pct = Math.round(r * 100 / p.target), dn = donors(p), left = p.deadline ? dayDiff(today(), p.deadline) : null;
    return `<section class="panel"><div class="panel-h"><div><h2>${esc(p.name)} ${p.status === 'completed' ? '<span class="badge b-verified">Completed</span>' : p.status === 'paused' ? '<span class="badge b-pending">Paused</span>' : ''}</h2><p>${esc(p.desc || '')}</p></div><div class="actions">${p.status === 'active' ? `<button class="btn btn-saffron btn-sm" type="button" data-act="prj-give" data-id="${esc(p.id)}">Give to this project</button>` : ''}${isAdmin() ? `<button class="btn btn-ghost btn-sm" type="button" data-act="prj-pdf" data-id="${esc(p.id)}">Report PDF</button>` : ''}</div></div>
    <div class="rep-sum"><div><small>Raised</small><b>${money(r)}</b></div><div><small>Target</small><b>${money(p.target)}</b></div><div><small>Still needed</small><b>${money(Math.max(0, p.target - r))}</b></div><div><small>Deadline</small><b>${p.deadline ? (left < 0 ? 'Passed' : left + ' days') : 'None'}</b></div></div>${bar(pct, pct >= 100 ? '#12806A' : '#0E7490')}<p class="hint">${Math.min(pct, 999)}% funded.</p>
    ${p.showDonors && dn.length ? `<div class="sec-title">Donor wall</div>${table(['Donor', { t: 'Given', num: true }], dn.slice(0, 15).map(d => [esc(d.name), money(d.amount)]), ['', ''])}` : ''}
    ${p.updates.length ? `<div class="sec-title">Progress updates</div><ul class="feed">${p.updates.slice(0, 5).map(u => `<li><b>${esc(fmtDate(u.at.slice(0, 10)))}</b> ${esc(u.text)} <small>${esc(u.by)}</small></li>`).join('')}</ul>` : ''}
    ${can ? `<div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="prj-update" data-id="${esc(p.id)}">Post an update</button><button class="btn btn-ghost btn-sm" type="button" data-act="prj-edit" data-id="${esc(p.id)}">Edit</button>${p.status === 'active' ? `<button class="btn btn-ghost btn-sm" type="button" data-act="prj-state" data-id="${esc(p.id)}" data-st="paused">Pause</button><button class="btn btn-leaf btn-sm" type="button" data-act="prj-state" data-id="${esc(p.id)}" data-st="completed">Mark completed</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-act="prj-state" data-id="${esc(p.id)}" data-st="active">Reopen</button>`}</div>` : ''}</section>`; }).join('') || '<section class="panel"><p class="muted">No project has been started yet.</p></section>'}`;
}
const projectForm = p => { p = p || {}; return `<div class="field"><label for="pjN">Project name</label><input id="pjN" name="name" class="input" maxlength="70" value="${esc(p.name || '')}" placeholder="Community borehole" required></div><div class="field"><label for="pjD">What it is for</label><input id="pjD" name="desc" class="input" maxlength="200" value="${esc(p.desc || '')}"></div><div class="form-row"><div class="field"><label for="pjT">Target (naira)</label><input id="pjT" name="target" class="input" type="number" min="1" value="${esc(p.target || '')}" required></div><div class="field"><label for="pjL">Finish by (optional)</label><input id="pjL" name="deadline" class="input" type="date" value="${esc(p.deadline || '')}"></div></div><label class="check"><input type="checkbox" name="showDonors" value="yes"${p.showDonors === false ? '' : ' checked'}> Show donor names to members</label>`; };
Object.assign(ACTIONS, {
  'prj-new'() { openModal({ title: 'Start a project', body: projectForm(), submit: 'Start project', onSubmit: fd => { API.saveProject('', { name: fd.get('name'), desc: fd.get('desc'), target: fd.get('target'), deadline: fd.get('deadline'), showDonors: fd.get('showDonors') ? 'yes' : 'no' }); done('Project started. Members can now give to it.'); } }); },
  'prj-edit'(el) { const p = projects().find(x => x.id === el.dataset.id); openModal({ title: 'Edit project', sub: esc(p.id), body: projectForm(p), submit: 'Save changes', onSubmit: fd => { API.saveProject(p.id, { name: fd.get('name'), desc: fd.get('desc'), target: fd.get('target'), deadline: fd.get('deadline'), showDonors: fd.get('showDonors') ? 'yes' : 'no' }); done('Project updated.'); } }); },
  'prj-update'(el) { const p = projects().find(x => x.id === el.dataset.id); openModal({ title: `Update on ${p.name}`, body: '<div class="field"><label for="puT">What has happened?</label><input id="puT" name="text" class="input" maxlength="200" required></div>', submit: 'Post update', onSubmit: fd => { API.projectUpdate(p.id, fd.get('text')); done('Update posted.'); } }); },
  'prj-state'(el) { API.projectStatus(el.dataset.id, el.dataset.st); done('Project updated.'); },
  'prj-give'(el) { const p = projects().find(x => x.id === el.dataset.id); uploadModal('L:' + p.levyId); },
  'prj-pdf'(el) { const p = projects().find(x => x.id === el.dataset.id); download(`${S.v.code}-project-${p.id}.pdf`, projectPdf(p)); }
});

/* ---------- Birthdays and anniversaries ---------- */
Object.assign(API, {
  saveDates(id, d) {
    if (!S.u || S.owner) throw new Error('Sign in first.'); assertFeature('celebrations', 'Birthdays and anniversaries');
    const u = userById(id); if (!u || !['member', 'admin'].includes(u.role)) throw new Error('Member not found.'); if (u.id !== S.u.id) requireAdmin();
    const ok = v => !v || /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v); if (!ok(d.dob) || !ok(d.anniv)) throw new Error('Choose a real month and day.');
    const ch = []; if ((u.dob || '') !== (d.dob || '')) { ch.push('Birthday'); u.dob = d.dob || ''; } if ((u.anniv || '') !== (d.anniv || '')) { ch.push('Anniversary'); u.anniv = d.anniv || ''; } const h = !!d.hide; if (!!u.hideDates !== h) { ch.push('Visibility'); u.hideDates = h; }
    if (!ch.length) throw new Error('Nothing was changed.'); u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Updated dates', u.id, `${u.name}: ${ch.join(', ')} changed${u.id !== S.u.id ? ' by ' + S.u.name : ''}`); commit(); return u;
  }
});
const mdNext = md => { const [m, d] = md.split('-').map(Number), now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()); let n = new Date(now.getFullYear(), m - 1, d); if (n < t0) n = new Date(now.getFullYear() + 1, m - 1, d); return Math.round((n - t0) / 86400000); };
const mdLabel = md => { const [m, d] = md.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
function celebrations() {
  const out = []; livePeople().forEach(u => { if (u.hideDates && u.id !== (S.u && S.u.id)) return;
    if (u.dob) out.push({ u, kind: 'Birthday', md: u.dob, days: mdNext(u.dob) }); if (u.anniv) out.push({ u, kind: 'Wedding anniversary', md: u.anniv, days: mdNext(u.anniv) });
    if (u.joined && u.joined.length >= 10) { const md = u.joined.slice(5, 10), yrs = new Date().getFullYear() - Number(u.joined.slice(0, 4)), dd = mdNext(md); if (yrs >= 1 || dd > 0 && yrs >= 0 && new Date(u.joined + 'T12:00:00') < new Date()) out.push({ u, kind: 'Membership anniversary', md, days: dd, years: dd === 0 ? yrs : yrs + (new Date().getFullYear() > Number(u.joined.slice(0, 4)) ? 1 : 0) }); } });
  return out.sort((a, b) => a.days - b.days || a.u.name.localeCompare(b.u.name));
}
const celeGreeting = c => (c.kind === 'Birthday' && S.v.settings && S.v.settings.wishTpl) ? wishFill(S.v.settings.wishTpl, c) : `Dear ${c.u.name.split(' ')[0]}, ${c.kind === 'Birthday' ? 'happy birthday! Wishing you good health and joy' : c.kind === 'Wedding anniversary' ? 'happy wedding anniversary! Wishing you and your family more years of love' : `happy ${c.years ? c.years + '-year ' : ''}membership anniversary! Thank you for standing with us`}. From all of us at ${S.v.name}.`;
function celebrationBanner() {
  if (!planAllows('celebrations') || !S.u || S.owner) return ''; const today0 = celebrations().filter(c => c.days === 0); if (!today0.length) return '';
  return `<div class="callout"><div><b>Celebrating today</b><p>${today0.slice(0, 5).map(c => `${esc(c.u.name)} (${esc(c.kind.toLowerCase())})`).join(', ')}${today0.length > 5 ? ` and ${today0.length - 5} more` : ''}.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="goto" data-page="celebrations">See all</button></div>`;
}
const mdPick = (p, val) => { const [m, d] = (val || '-').split('-'); return `<div class="form-row"><div class="field"><label for="${p}M">Month</label><select id="${p}M" name="${p}M" class="select">${opt('', 'Not set', m || '')}${MONTHS.map((n, i) => opt(pad(i + 1), n, m || '')).join('')}</select></div><div class="field"><label for="${p}D">Day</label><select id="${p}D" name="${p}D" class="select">${opt('', '-', d || '')}${Array.from({ length: 31 }, (_, i) => opt(pad(i + 1), String(i + 1), d || '')).join('')}</select></div></div>`; };
const mdRead = (fd, p) => fd.get(p + 'M') && fd.get(p + 'D') ? `${fd.get(p + 'M')}-${fd.get(p + 'D')}` : '';
function celebrationsView() {
  if (!planAllows('celebrations')) return premiumGate('Birthdays and anniversaries', 'See who is celebrating today and in the next 30 days, and let admins send a greeting on WhatsApp.');
  const all = celebrations(), tdy = all.filter(c => c.days === 0), soon = all.filter(c => c.days > 0 && c.days <= 30), me = S.u, admin = isAdmin();
  const row = c => [`${esc(c.u.name)}<small>${esc(c.u.id)}</small>`, esc(c.kind) + (c.years ? `<small>${c.years} year${c.years === 1 ? '' : 's'}</small>` : ''), esc(mdLabel(c.md)), c.days === 0 ? '<b>Today</b>' : c.days === 1 ? 'Tomorrow' : `In ${c.days} days`, admin && c.u.phone ? `<a class="btn btn-leaf btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(waLinkTo(c.u.phone, celeGreeting(c)))}">Greet on WhatsApp</a>` : ''];
  const heads = ['Member', 'Occasion', 'Date', 'When', ''];
  return `<section class="panel"><div class="panel-h"><div><h2>Celebrating today</h2><p>Birthdays and anniversaries. Only the day and month are shown, never the year of birth.</p></div></div>${table(heads, tdy.map(row), ['Nobody today', 'Dates appear here once members add them.'])}</section>
  <section class="panel"><div class="panel-h"><div><h2>Next 30 days</h2></div></div>${table(heads, soon.map(row), ['Nothing in the next 30 days', ''])}</section>
  <section class="panel"><div class="panel-h"><div><h2>My dates</h2><p>${esc(me.name)}: birthday ${me.dob ? esc(mdLabel(me.dob)) : 'not set'}, anniversary ${me.anniv ? esc(mdLabel(me.anniv)) : 'not set'}${me.hideDates ? ' (hidden from others)' : ''}.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="dates-edit" data-id="${esc(me.id)}">Set my dates</button></div></section>
  ${admin ? `<section class="panel"><div class="panel-h"><div><h2>Correct a member’s dates</h2><p>If a date was entered wrongly, an admin can fix it.</p></div></div><div class="toolbar"><div class="field grow2"><label for="dmX">Member</label><select id="dmX" class="select">${memberOpts('', '', true)}</select></div><button class="btn btn-ghost" type="button" data-act="dates-other">Set dates</button></div></section>` : ''}`;
}
Object.assign(ACTIONS, {
  'dates-edit'(el) { const u = userById(el.dataset.id); openModal({ title: u.id === S.u.id ? 'My dates' : `Dates for ${u.name}`, sub: 'Only the day and month are kept.', body: `<div class="sec-title">Birthday</div>${mdPick('bd', u.dob)}<div class="sec-title">Wedding anniversary (optional)</div>${mdPick('an', u.anniv)}<label class="check"><input type="checkbox" name="hide" value="1"${u.hideDates ? ' checked' : ''}> Do not show my dates to other members</label>`, submit: 'Save', onSubmit: fd => { API.saveDates(u.id, { dob: mdRead(fd, 'bd'), anniv: mdRead(fd, 'an'), hide: !!fd.get('hide') }); done('Dates saved.'); } }); },
  'dates-other'() { const id = $('#dmX') && $('#dmX').value; if (!id) return toast('Choose a member.', 'err'); ACTIONS['dates-edit']({ dataset: { id } }); }
});

/* ---------- Navigation, pages and banners ---------- */
NAV.admin.push(['terms', 'Terms of office', 'clock'], ['agendas', 'Meeting agenda', 'book'], ['emergency', 'Emergency levies', 'coin'], ['projects', 'Projects', 'village'], ['standing', 'Good standing', 'check'], ['celebrations', 'Birthdays', 'users']);
NAV.member.push(['reports', 'Reports', 'file'], ['agendas', 'Meeting agenda', 'book'], ['emergency', 'Emergency levies', 'coin'], ['projects', 'Projects', 'village'], ['standing', 'Good standing', 'check'], ['celebrations', 'Birthdays', 'users']);
Object.assign(TITLES, { terms: 'Terms of office', agendas: 'Meeting agenda', emergency: 'Emergency levies', projects: 'Community projects', standing: 'Good standing certificate', celebrations: 'Birthdays and anniversaries', reports: 'Reports' });
VIEWS.admin.terms = termsView; VIEWS.admin.agendas = VIEWS.member.agendas = agendasView; VIEWS.admin.emergency = VIEWS.member.emergency = emergencyView; VIEWS.admin.projects = VIEWS.member.projects = projectsView; VIEWS.admin.standing = VIEWS.member.standing = standingView; VIEWS.admin.celebrations = VIEWS.member.celebrations = celebrationsView;
VIEWS.member.terms = termsView;
{ const _ao = VIEWS.admin.overview, _mo = VIEWS.member.overview; VIEWS.admin.overview = function () { return termBanner() + emergencyBanner() + celebrationBanner() + _ao.apply(this, arguments); }; VIEWS.member.overview = function () { return emergencyBanner() + celebrationBanner() + _mo.apply(this, arguments); }; }
