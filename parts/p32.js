
/* =========================================================
   ROUND 15: broadcast to everyone, notice board (seen by X of Y), birthday messages and
   dashboard widget, Share button (attaches the PDF in WhatsApp on phones), member ID card
   with QR check-in.
   ========================================================= */
['broadcastAll', 'notices', 'idcard'].forEach(k => { PLAN_RULES.basic[k] = false; PLAN_RULES.premium[k] = true; });
const firstName = u => String((u && u.name) || '').trim().split(/\s+/)[0] || '';
const fillTpl = (tpl, u, extra) => String(tpl).replace(/\{(first|name|village|owes|year|accounts|id)\}/g, (_, k) => {
  if (k === 'first') return firstName(u); if (k === 'name') return u.name; if (k === 'village') return S.v.name; if (k === 'id') return u.id;
  if (extra && extra[k] != null) return extra[k]; if (k === 'year') return String(new Date().getFullYear()); if (k === 'accounts') return (S.v.settings.accounts || []).map(a => `${a.bank}, ${a.number}, ${a.name}`).join('\n') || '(ask your admin for the account)'; return '';
});

/* ---------- Share a file (phones attach the PDF straight into WhatsApp) ---------- */
async function shareFile(blob, name, text) {
  let f = null; try { f = new File([blob], name, { type: blob.type || (/\.png$/.test(name) ? 'image/png' : 'application/pdf') }); } catch (_) {}
  if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: name, text: text || '' }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; }
  }
  download(name, blob); toast('This device cannot share files from the browser, so the file was downloaded. Attach it in WhatsApp.', 'ok'); return false;
}
const shareBtn = (act, id, label, extra) => `<button class="btn btn-leaf btn-sm" type="button" data-act="${act}" data-id="${esc(id)}"${extra || ''}>${label || 'Share (WhatsApp)'}</button>`;
Object.assign(ACTIONS, {
  async 'share-receipt'(el) {
    try { const t = receiptTx(el.dataset.id), r = receiptDataX(t), b = await receiptPdfAsync(r); await shareFile(b, `${r.no}.pdf`, `Receipt ${r.no} from ${S.v.name}`); } catch (ex) { toast(ex.message || 'Could not share the receipt.', 'err'); }
  },
  async 'share-cert'(el) { try { const c = await API.issueCertificate(el.dataset.id), b = await certPdf(c); await shareFile(b, `Good-standing-${c.no}.pdf`, `Good standing certificate ${c.no}, ${S.v.name}`); renderView(); } catch (ex) { toast(ex.message || 'Could not share the certificate.', 'err'); } },
  async 'share-agenda'(el) { try { const a = (S.v.agendas || []).find(x => x.id === el.dataset.id); if (!a || (!isAdmin() && a.status !== 'published')) return toast('Not available.', 'err'); await shareFile(agendaPdf(a), `${S.v.code}-agenda-${a.date}.pdf`, `Meeting agenda: ${a.title}, ${fmtDate(a.date)}`); } catch (ex) { toast(ex.message, 'err'); } },
  async 'share-pledge'(el) {
    try { requireAdmin(); const p = getPledge(el.dataset.id), it = pledgeItem(p); if (!it.u || !(it.owe > 0)) return toast('Nothing left to pay on this pledge.', 'ok'); await shareFile(noticePdf([it], new Date().getFullYear()), `Pledge-reminder-${p.id}.pdf`, pledgeRemindText(p)); try { API.logNotice([it.u.id], 'Pledge reminder PDF shared'); } catch (_) {} } catch (ex) { toast(ex.message, 'err'); }
  },
  async 'share-notice'(el) { try { requireAdmin(); const it = itemFor(el.dataset.id, new Date().getFullYear()); if (!(it.owe > 0)) return toast('This member owes nothing.', 'ok'); await shareFile(noticePdf([it], new Date().getFullYear()), `Notice-${el.dataset.id}.pdf`, reminderText(it, new Date().getFullYear())); try { API.logNotice([it.u.id], 'Notice PDF shared'); } catch (_) {} } catch (ex) { toast(ex.message, 'err'); } },
  async 'share-idcard'(el) { try { const u = userById(el.dataset.id); const b = await idCardPng(u); await shareFile(b, `ID-${u.id}.png`, `${S.v.name} member ID card`); } catch (ex) { toast(ex.message, 'err'); } }
});

/* ---------- Queue of WhatsApp chats (one chat per tap, nothing is sent until you press Send) ---------- */
let Q = null;
Object.assign(API, {
  logBulk(what, n) { requireAdmin(); log('Sent WhatsApp messages', what, `${n} chat${n === 1 ? '' : 's'} opened`); commit(); }
});
function queueModal(title, sub, items, what, intro) {
  Q = { items, i: 0, what };
  infoModal(title, sub, `<p class="hint" style="margin-top:12px">${intro || 'WhatsApp opens one chat at a time, so tap the button for each member. Nothing is sent until you press Send inside WhatsApp.'}</p>
    <div class="btn-row"><button class="btn btn-primary" type="button" id="qGo" data-act="q-next">Open first chat: ${esc(items[0].u.name)}</button><span class="hint" id="qProg">0 of ${items.length} opened</span></div>
    ${table(['Member', 'Status'], items.map((it, i) => [esc(it.u.name) + `<small>${esc(it.u.phone)}</small>`, `<span id="qS${i}" class="muted">Waiting</span>`]), ['', ''])}`);
}
ACTIONS['q-next'] = function () {
  if (!Q || Q.i >= Q.items.length || !isAdmin()) return; const it = Q.items[Q.i], url = waLinkTo(it.u.phone, it.text);
  const w = window.open(url, '_blank', 'noopener'); if (!w) return toast('Your browser blocked the chat. Allow pop-ups for this site and tap again.', 'err');
  const s = $('#qS' + Q.i); if (s) { s.textContent = 'Opened'; s.className = 'badge b-verified'; }
  Q.i++; const n = Q.items.length, p = $('#qProg'); if (p) p.textContent = `${Q.i} of ${n} opened`; const go = $('#qGo');
  if (go) { if (Q.i < n) go.textContent = `Open next chat: ${Q.items[Q.i].u.name}`; else { go.textContent = 'All chats opened'; go.disabled = true; try { API.logBulk(Q.what, n); toast('Finished and recorded in the activity log.', 'ok'); } catch (e) { toast(e.message, 'err'); } } }
};

/* ---------- 1. WhatsApp broadcast to everyone ---------- */
const BXA = { all: 'Everyone', owing: 'Members who owe', admins: 'Admins only', nodob: 'Members without a birthday on file' };
const BXT = {
  all: 'Dear {first}, greetings from {village}. ',
  owing: 'Dear {first}, a reminder from {village}: you still owe {owes} for {year}.\n\nPay to:\n{accounts}\n\nAfter paying, sign in to VillageVault and upload your proof of payment.',
  admins: 'Dear {first}, a note for the {village} admins: ',
  nodob: 'Dear {first}, please sign in to VillageVault and add your birthday (day and month only) so we can celebrate with you. Thank you.'
};
let BX = { aud: 'all', msg: BXT.all };
function bxAudience(aud) {
  const yr = new Date().getFullYear(); let list = livePeople().filter(u => u.id !== S.u.id);
  if (aud === 'admins') list = list.filter(u => u.role === 'admin'); if (aud === 'nodob') list = list.filter(u => !u.dob);
  if (aud === 'owing') list = list.filter(u => memberOutstanding(u.id, yr) > 0);
  const withPhone = list.filter(u => waNum(u.phone).length >= 12); return { list, withPhone, yr };
}
function bxText(u, yr) { return fillTpl(BX.msg, u, { owes: money(memberOutstanding(u.id, yr)), year: String(yr) }); }
function bxModal() {
  const a = bxAudience(BX.aud), skipped = a.list.length - a.withPhone.length;
  infoModal('WhatsApp broadcast', 'Send one message to many members', `<div class="sec-title">Who gets it</div><div class="radio-row">${Object.entries(BXA).map(([k, v]) => `<button type="button" class="btn ${BX.aud === k ? 'btn-primary' : 'btn-ghost'} btn-sm" data-act="bx-aud" data-a="${k}">${esc(v)}</button>`).join('')}</div>
    <p class="hint"><b>${a.withPhone.length}</b> member${a.withPhone.length === 1 ? '' : 's'} with a phone number${skipped ? `. ${skipped} more have no valid number and are skipped` : ''}.</p>
    <div class="field"><label for="bxM">Message (use {first}, {name}, {village}${BX.aud === 'owing' ? ', {owes}, {year}, {accounts}' : ''})</label><textarea id="bxM" class="input" rows="6" maxlength="900">${esc(BX.msg)}</textarea></div>
    <div class="callout"><div><b>Fastest way to reach everyone</b><p>1. Tap <b>Download contacts</b> and open the file on your phone to save them. 2. In WhatsApp choose New broadcast and select them. 3. Tap <b>Copy message</b> and paste it once. Everyone gets it in one go.</p></div></div>
    <div class="btn-row"><button class="btn btn-primary" type="button" data-act="bx-copy">Copy message</button><button class="btn btn-saffron" type="button" data-act="bx-vcf">Download contacts (.vcf)</button><button class="btn btn-leaf" type="button" data-act="bx-start">Send one chat at a time</button></div>
    <p class="hint">A website cannot send to many chats by itself without the WhatsApp Business service. That connection is added when the server side is built.</p>`);
}
function bxSync() { const m = $('#bxM'); if (m) BX.msg = m.value; }
ACTIONS['wa-broadcast'] = function () {
  if (!canRemind()) return toast('Only the Chairman or the Financial Secretary can send a broadcast.', 'err');
  if (S.v.plan !== 'premium') return featureModal('One-click WhatsApp broadcast');
  BX = { aud: 'all', msg: BXT.all }; bxModal();
};
Object.assign(ACTIONS, {
  'bx-aud'(el) { if (!canRemind() || S.v.plan !== 'premium') return; const m = $('#bxM'), untouched = !m || m.value === BXT[BX.aud]; if (!untouched) BX.msg = m.value; BX.aud = el.dataset.a; if (untouched) BX.msg = BXT[BX.aud]; bxModal(); },
  async 'bx-copy'() {
    if (!canRemind() || S.v.plan !== 'premium') return; bxSync(); const a = bxAudience(BX.aud), u = a.withPhone[0] || a.list[0] || S.u, t = BX.aud === 'owing' ? BX.msg : fillTpl(BX.msg, { name: 'everyone', id: '' }, { first: 'everyone' });
    try { await navigator.clipboard.writeText(t); toast('Message copied. Paste it in your WhatsApp broadcast.', 'ok'); } catch (_) { const m = $('#bxM'); if (m) { m.select(); try { document.execCommand('copy'); toast('Message copied.', 'ok'); } catch (e) { toast('Press and hold the message to copy it.', 'err'); } } }
  },
  'bx-vcf'() {
    if (!canRemind() || S.v.plan !== 'premium') return; bxSync(); const a = bxAudience(BX.aud); if (!a.withPhone.length) return toast('Nobody here has a valid phone number.', 'err');
    const v = a.withPhone.map(u => `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${u.name.replace(/[\r\n,;]/g, ' ')} (${S.v.code})\r\nTEL;TYPE=CELL:+${waNum(u.phone)}\r\nEND:VCARD`).join('\r\n') + '\r\n';
    download(`${S.v.code}-contacts.vcf`, new Blob([v], { type: 'text/vcard' })); try { API.logBulk(`Contacts file for broadcast (${BXA[BX.aud]})`, a.withPhone.length); } catch (_) {} toast(`${a.withPhone.length} contacts downloaded.`, 'ok');
  },
  'bx-start'() {
    if (!canRemind() || S.v.plan !== 'premium') return; bxSync(); if (BX.msg.trim().length < 3) return toast('Write a message first.', 'err'); const a = bxAudience(BX.aud);
    if (!a.withPhone.length) return toast('Nobody here has a valid phone number.', 'err');
    queueModal('WhatsApp broadcast', `${a.withPhone.length} member${a.withPhone.length === 1 ? '' : 's'}: ${BXA[BX.aud].toLowerCase()}`, a.withPhone.map(u => ({ u, text: bxText(u, a.yr) })), `Broadcast to ${BXA[BX.aud].toLowerCase()}`);
  }
});

/* ---------- 2. Notice board with "seen by X of Y" ---------- */
const notices = () => (S.v.notices = S.v.notices || []);
const canNotice = () => isAdmin() && (isOrganiser() || isLeadAdmin());
const noticeAudience = () => livePeople();
function noticeStats(n) { const all = noticeAudience(), seen = all.filter(u => n.seen && n.seen[u.id]); return { seen: seen.length, total: all.length, unseen: all.filter(u => !(n.seen && n.seen[u.id])) }; }
Object.assign(API, {
  saveNotice(id, d) {
    requireAdmin(); assertFeature('notices', 'The notice board'); if (!canNotice()) throw new Error('Only the Chairman, Secretary, Financial Secretary or Lead Admin can post notices.');
    const t = (d.title || '').trim(), b = (d.body || '').trim(); if (t.length < 3) throw new Error('Give the notice a title.'); if (b.length < 3) throw new Error('Write the notice.');
    let n; if (id) { n = notices().find(x => x.id === id); if (!n) throw new Error('Notice not found.'); n.title = t; n.body = b; n.pinned = !!d.pinned; n.seen = { [S.u.id]: stamp() }; n.editedAt = stamp(); log('Edited notice', n.id, t); }
    else { n = { id: nextId('ntc', 'N'), title: t, body: b, pinned: !!d.pinned, by: S.u.name, byTitle: S.u.title || 'Admin', at: stamp(), seen: { [S.u.id]: stamp() } }; notices().push(n); log('Posted notice', n.id, t); }
    commit(); return n;
  },
  deleteNotice(id) { requireAdmin(); if (!canNotice()) throw new Error('Only the Chairman, Secretary, Financial Secretary or Lead Admin can remove notices.'); const n = notices().find(x => x.id === id); if (!n) throw new Error('Notice not found.'); S.v.notices = notices().filter(x => x.id !== id); log('Removed notice', id, n.title); commit(); },
  markNoticesSeen() {
    if (!S.u || S.owner || S.u.id === 'SUPPORT' || !['member', 'admin'].includes(S.u.role) || !planAllows('notices')) return 0; let c = 0;
    notices().forEach(n => { n.seen = n.seen || {}; if (!n.seen[S.u.id]) { n.seen[S.u.id] = stamp(); c++; } }); if (c) commit(); return c;
  }
});
const unseenNotices = () => (!S.u || S.owner || !planAllows('notices')) ? [] : notices().filter(n => !(n.seen && n.seen[S.u.id]));
function noticesView() {
  if (!planAllows('notices')) return premiumGate('Notice board', 'Post a notice for the whole village and see exactly how many members have read it, for example seen by 40 of 60, with the names of those who have not.');
  const can = canNotice(), list = notices().slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at.localeCompare(a.at)), fresh = new Set(unseenNotices().map(n => n.id));
  const html = `<section class="panel"><div class="panel-h"><div><h2>Notice board</h2><p>${can ? 'Post notices for everyone. Each one shows how many members have read it.' : 'Notices from your village leaders.'}</p></div>${can ? '<button class="btn btn-primary btn-sm" type="button" data-act="ntc-new">Post a notice</button>' : ''}</div>
  ${list.length ? list.map(n => { const st = noticeStats(n), pct = st.total ? Math.round(st.seen * 100 / st.total) : 0;
    return `<div class="rep-item" style="display:block;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${n.pinned ? 'Pinned: ' : ''}${esc(n.title)}</b> ${fresh.has(n.id) ? '<span class="badge b-pending">New</span>' : ''}<br><small>${esc(fmtDate(n.at.slice(0, 10)))} by ${esc(n.by)}${n.byTitle ? ', ' + esc(n.byTitle) : ''}${n.editedAt ? ' (edited)' : ''}</small></div>${can ? `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="ntc-edit" data-id="${esc(n.id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="ntc-del" data-id="${esc(n.id)}">Delete</button></div>` : ''}</div>
    <p style="white-space:pre-wrap;margin:10px 0">${esc(n.body)}</p>
    ${isAdmin() ? `<div class="ntc-seen"><b>Seen by ${st.seen} of ${st.total}</b>${bar(pct)}${st.unseen.length ? `<button class="btn btn-ghost btn-sm" type="button" data-act="ntc-unseen" data-id="${esc(n.id)}">Who has not seen it (${st.unseen.length})</button>` : '<small>Everyone has seen this.</small>'}</div>` : `<small class="muted">Seen by ${st.seen} of ${st.total} members</small>`}</div>`; }).join('') : '<p class="muted">No notices yet.</p>'}</section>`;
  if (!isAdmin() || true) { try { if (API.markNoticesSeen()) { /* marked after render so the New badge shows once */ } } catch (_) {} }
  return html;
}
const noticeForm = n => { n = n || {}; return `<div class="field"><label for="ntT">Title</label><input id="ntT" name="title" class="input" maxlength="80" value="${esc(n.title || '')}" required></div><div class="field"><label for="ntB">Notice</label><textarea id="ntB" name="body" class="input" rows="6" maxlength="1200" required>${esc(n.body || '')}</textarea></div><label class="check"><input type="checkbox" name="pinned"${n.pinned ? ' checked' : ''}> <span>Pin to the top</span></label>${n.id ? '<p class="hint">Saving changes asks everyone to read it again, so the count starts over.</p>' : ''}`; };
Object.assign(ACTIONS, {
  'ntc-new'() { openModal({ title: 'Post a notice', body: noticeForm(), submit: 'Post notice', onSubmit: fd => { API.saveNotice('', { title: fd.get('title'), body: fd.get('body'), pinned: !!fd.get('pinned') }); done('Notice posted. Members see it on their dashboard.'); } }); },
  'ntc-edit'(el) { const n = notices().find(x => x.id === el.dataset.id); openModal({ title: 'Edit notice', sub: esc(n.id), body: noticeForm(n), submit: 'Save changes', onSubmit: fd => { API.saveNotice(n.id, { title: fd.get('title'), body: fd.get('body'), pinned: !!fd.get('pinned') }); done('Notice updated.'); } }); },
  'ntc-del'(el) { const n = notices().find(x => x.id === el.dataset.id); openModal({ title: 'Delete this notice?', danger: true, sub: esc(n.title), body: '<p class="hint">This cannot be undone.</p>', submit: 'Delete', onSubmit: () => { API.deleteNotice(n.id); done('Notice deleted.'); } }); },
  'ntc-unseen'(el) {
    if (!isAdmin()) return; const n = notices().find(x => x.id === el.dataset.id), st = noticeStats(n);
    infoModal('Not seen yet', `${esc(n.title)}: ${st.unseen.length} of ${st.total}`, table(['Member', ''], st.unseen.map(u => { const wa = waLinkTo(u.phone, `Dear ${firstName(u)}, there is a new notice from ${S.v.name}: "${n.title}". Please sign in to VillageVault and open the Notice board.`); return [esc(u.name) + `<small>${esc(u.id)}</small>`, wa ? `<a class="btn btn-leaf btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(wa)}">Nudge on WhatsApp</a>` : '<span class="muted">No phone</span>']; }), ['Everyone has seen it', '']));
  }
});
function noticeBanner() {
  const u = unseenNotices(); if (!u.length) return '';
  return `<div class="callout"><div><b>${u.length} new notice${u.length === 1 ? '' : 's'}</b><p>${esc(u[0].title)}${u.length > 1 ? ` and ${u.length - 1} more` : ''}.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="goto" data-page="notices">Read</button></div>`;
}

/* ---------- 3 and 4. Birthdays: wish message, dashboard widget, profile ---------- */
const WISH_DEFAULT = 'Dear {first}, happy birthday! Wishing you good health, joy and God’s blessings from all of us in {village}.';
const wishTpl = () => (S.v.settings && S.v.settings.wishTpl) || WISH_DEFAULT;
function wishFill(tpl, c) { return fillTpl(tpl, c.u); }
Object.assign(API, {
  saveWishTemplate(t) {
    requireAdmin(); assertFeature('celebrations', 'Birthday messages'); if (!isOrganiser() && !isLeadAdmin()) throw new Error('Only the Chairman, Secretary, Financial Secretary or Lead Admin can change the birthday message.');
    t = (t || '').trim(); if (t.length < 10) throw new Error('Write a longer message.'); if (t.length > 500) throw new Error('Keep it under 500 characters.'); S.v.settings.wishTpl = t === WISH_DEFAULT ? '' : t; log('Changed birthday message', 'Birthdays', 'New wording saved'); commit();
  }
});
const birthdaysSoon = n => celebrations().filter(c => c.kind === 'Birthday' && c.days <= n);
function birthdayWidget() {
  if (!planAllows('celebrations') || !isAdmin()) return ''; const soon = birthdaysSoon(14), tdy = soon.filter(c => c.days === 0), missing = livePeople().filter(u => !u.dob).length, can = isOrganiser() || isLeadAdmin();
  const row = c => [`${esc(c.u.name)}<small>${esc(c.u.id)}</small>`, esc(mdLabel(c.md)), c.days === 0 ? '<b>Today</b>' : c.days === 1 ? 'Tomorrow' : `In ${c.days} days`, c.u.phone ? `<a class="btn btn-leaf btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(waLinkTo(c.u.phone, wishFill(wishTpl(), c)))}" data-act="wish-sent" data-id="${esc(c.u.id)}">Send wish</a>` : '<span class="muted">No phone</span>'];
  return `<section class="panel" id="bdayWidget"><div class="panel-h"><div><h2>Birthdays in the next 14 days</h2><p>Tap Send wish to open WhatsApp with your birthday message ready. ${missing ? `${missing} member${missing === 1 ? ' has' : 's have'} not added a birthday yet.` : ''}</p></div><div class="actions">${tdy.length > 1 ? '<button class="btn btn-saffron btn-sm" type="button" data-act="wish-queue">Send today’s wishes</button>' : ''}${can ? '<button class="btn btn-ghost btn-sm" type="button" data-act="wish-edit">Edit message</button>' : ''}${missing && canRemind() && S.v.plan === 'premium' ? '<button class="btn btn-ghost btn-sm" type="button" data-act="wish-ask">Ask for birthdays</button>' : ''}</div></div>${table(['Member', 'Date', 'When', ''], soon.map(row), ['No birthdays in the next 14 days', 'Dates appear once members add them.'])}</section>`;
}
Object.assign(ACTIONS, {
  'wish-sent'(el) { try { log('Opened birthday wish', el.dataset.id, `Birthday message for ${nameOf(el.dataset.id)} opened in WhatsApp`); commit(); } catch (_) {} },
  'wish-queue'() { const items = birthdaysSoon(0).filter(c => waNum(c.u.phone).length >= 12).map(c => ({ u: c.u, text: wishFill(wishTpl(), c) })); if (!items.length) return toast('Nobody celebrating today has a phone number.', 'err'); queueModal('Birthday wishes for today', `${items.length} member${items.length === 1 ? '' : 's'}`, items, 'Birthday wishes'); },
  'wish-edit'() {
    if (!isOrganiser() && !isLeadAdmin()) return toast('Only the Chairman, Secretary, Financial Secretary or Lead Admin can change it.', 'err');
    openModal({ title: 'Birthday message', sub: 'Used for every birthday wish. Use {first}, {name} and {village}.', body: `<div class="field"><label for="wsT">Message</label><textarea id="wsT" name="t" class="input" rows="5" maxlength="500">${esc(wishTpl())}</textarea></div><p class="hint">Preview: ${esc(fillTpl(wishTpl(), { name: 'Chidi Okafor', id: 'X' }))}</p>`, submit: 'Save message', onSubmit: fd => { API.saveWishTemplate(fd.get('t')); done('Birthday message saved.'); } });
  },
  'wish-ask'() { if (!canRemind()) return; BX = { aud: 'nodob', msg: BXT.nodob }; bxModal(); }
});
function dobBanner() {
  if (!planAllows('celebrations') || !S.u || S.owner || S.u.id === 'SUPPORT' || S.u.dob || !['member', 'admin'].includes(S.u.role)) return '';
  return `<div class="callout"><div><b>Add your birthday</b><p>Only the day and month are kept. Your village can then send you a birthday wish.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="dates-edit" data-id="${esc(S.u.id)}">Add it</button></div>`;
}
{ const _mp = memberProfile; memberProfile = function (id) {
  _mp.apply(this, arguments); const u = userById(id); if (!u || !isAdmin() || !planAllows('celebrations')) return; const f = $('#modalRoot .kv'); if (!f) return;
  const c = u.dob ? { u, kind: 'Birthday', md: u.dob, days: mdNext(u.dob) } : null, wa = c && u.phone ? waLinkTo(u.phone, wishFill(wishTpl(), c)) : '';
  f.insertAdjacentHTML('beforeend', `<dt>Birthday</dt><dd>${c ? esc(mdLabel(u.dob)) + (c.days === 0 ? ' (today)' : c.days <= 30 ? ` (in ${c.days} days)` : '') : 'Not added yet'}${wa ? ` <a class="btn btn-leaf btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(wa)}">Send wish</a>` : ''} <button class="btn btn-ghost btn-sm" type="button" data-act="dates-edit" data-id="${esc(u.id)}">${c ? 'Change' : 'Add'}</button></dd>`);
}; }

/* ---------- 6. ID card with QR check-in ---------- */
const idPayload = async u => { const h = await hash12(`${S.v.code}|${u.id}|${u.name}`); return `VVID|${S.v.code}|${u.id}|${h.slice(0, 8)}`; };
function drawIdCard(A, u, qrText) {
  const W = A.W, H = A.H, NAVY = '#1A1A4E', GOLD = '#F5B83D', INK = '#14142B', MUT = '#5B5F7A', org = S.v.name;
  A.rect(0, 0, W, H, '#FFFFFF'); A.rect(0, 0, W, 54, NAVY); A.rect(0, 54, W, 3, GOLD);
  let s = 15; while (s > 9 && A.width(org, s, true) > W - 24) s--; const ls = A.width(org, s, true) > W - 24 ? wrapLines(A, org, W - 24, 10).slice(0, 2) : [org];
  if (ls.length > 1) { A.text(ls[0], 12, 24, { size: 10, bold: true, color: '#FFFFFF' }); A.text(ls[1], 12, 40, { size: 10, bold: true, color: '#FFFFFF' }); } else A.text(ls[0], 12, 34, { size: s, bold: true, color: '#FFFFFF' });
  A.text('MEMBER ID CARD', 12, 76, { size: 7, bold: true, color: MUT });
  A.text(A.fit(u.name, W - 150, 15, true), 12, 98, { size: 15, bold: true, color: INK });
  A.text(u.id, 12, 116, { size: 11, bold: true, color: NAVY });
  A.text(u.role === 'admin' ? (u.title || 'Admin') : 'Member', 12, 132, { size: 9, color: INK });
  A.text(`Member since ${fmtDate(u.joined)}`, 12, 146, { size: 8, color: MUT });
  const kin = typeof kinOf === 'function' ? kinOf(u) : ''; if (kin) A.text(A.fit(kin, W - 150, 8), 12, 159, { size: 8, color: MUT });
  drawQR(A, qrText, W - 116, 62, 104, NAVY); A.text('Scan at the meeting', W - 64, 172, { size: 7, color: MUT, align: 'center' });
  A.rect(0, H - 14, W, 14, '#F4F5FA'); A.text(`${S.v.code} · Valid while membership is active`, W / 2, H - 4.5, { size: 6.5, color: MUT, align: 'center' });
}
const ID_W = 300, ID_H = 192;
async function idCardPng(u) {
  const k = 4, cv = document.createElement('canvas'); cv.width = ID_W * k; cv.height = ID_H * k; const g = cv.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height);
  drawIdCard(canvasAdapter(g, k, ID_W, ID_H, {}), u, await idPayload(u)); return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('Could not create the card.')), 'image/png'));
}
async function idCardPdf(us) {
  const pdf = new PDF(), A = pdfAdapter(pdf), q = await Promise.all(us.map(idPayload)), colW = ID_W + 20;
  us.forEach((u, i) => { if (i && i % 8 === 0) pdf.add && pdf.add(); const slot = i % 8, x = 40 + (slot % 2) * colW, y = 40 + Math.floor(slot / 2) * (ID_H + 20);
    const sub = { W: ID_W, H: ID_H, text: (s, a, b, o) => A.text(s, x + a, y + b, o), rect: (a, b, w, h, f) => A.rect(x + a, y + b, w, h, f), line: (a, b, c, d, col, lw) => A.line(x + a, y + b, x + c, y + d, col, lw), strokeRect: (a, b, w, h, col, lw) => A.strokeRect(x + a, y + b, w, h, col, lw), img: () => {}, width: (s, z, b) => A.width(s, z, b), fit: (s, m, z, b) => A.fit(s, m, z, b) };
    drawIdCard(sub, u, q[i]); A.strokeRect(x, y, ID_W, ID_H, '#C9CFE0', .6); });
  return pdf.build(`${S.v.code} ID cards`);
}
function idCardView() {
  if (!planAllows('idcard')) return premiumGate('ID card and QR check-in', 'Every member gets an ID card with a QR code. At the meeting, an admin scans it to mark the member present, and the second-admin check still applies.');
  const admin = isAdmin(), id = admin ? (S.f.idm || S.u.id) : S.u.id, u = userById(id) || S.u, m = S.v.meetings.find(meetingOpen);
  const card = `<section class="panel"><div class="panel-h"><div><h2>${admin && u.id !== S.u.id ? esc(u.name) : 'My ID card'}</h2><p>${esc(u.id)} · ${esc(u.role === 'admin' ? (u.title || 'Admin') : 'Member')}${kinOf(u) ? ' · ' + esc(kinOf(u)) : ''}</p></div></div>
    <dl class="kv"><dt>Phone</dt><dd>${esc(u.phone || '-')}</dd><dt>Member since</dt><dd>${esc(fmtDate(u.joined))}</dd><dt>Birthday</dt><dd>${u.dob ? esc(mdLabel(u.dob)) : 'Not added yet'}${planAllows('celebrations') && (u.id === S.u.id || admin) ? ` <button class="btn btn-ghost btn-sm" type="button" data-act="dates-edit" data-id="${esc(u.id)}">${u.dob ? 'Change' : 'Add'}</button>` : ''}</dd></dl>
    <div class="id-prev"><img id="idImg" alt="ID card for ${esc(u.name)}" width="${ID_W}" height="${ID_H}"></div>
    <div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="id-png" data-id="${esc(u.id)}">Download image</button>${shareBtn('share-idcard', u.id, 'Share (WhatsApp)')}${admin ? `<button class="btn btn-saffron btn-sm" type="button" data-act="id-pdf-all">Print all cards (PDF)</button>` : ''}</div></section>`;
  const pick = admin ? `<section class="panel"><div class="panel-h"><div><h2>Choose a member</h2></div></div><div class="toolbar"><div class="field grow2"><label for="idm">Member</label><select id="idm" class="select" data-filter="idm">${memberOpts(u.id, '', true)}</select></div></div></section>` : '';
  const scan = admin ? `<section class="panel"><div class="panel-h"><div><h2>QR check-in</h2><p>${m ? `Register open: ${esc(m.title)}. Scanned members are marked as waiting for a second admin to verify.` : 'No register is open. The Financial Secretary opens it on the meeting day.'}</p></div></div>
    <video id="idVid" class="id-vid" playsinline muted hidden></video><div class="toolbar"><button class="btn btn-primary" type="button" data-act="id-scan" ${m ? '' : 'disabled'}>Scan with camera</button><div class="field grow2"><label for="idIn">Or type or scan the card code with a scanner</label><input id="idIn" class="input mono" placeholder="VVID|CODE|ID|..." autocomplete="off"></div><button class="btn btn-ghost" type="button" data-act="id-check" ${m ? '' : 'disabled'}>Check in</button></div><div id="idRes" class="hint" role="status"></div></section>` : '';
  return card + pick + scan;
}
async function idCheckIn(text) {
  requireAdmin(); assertFeature('idcard', 'QR check-in'); const p = String(text || '').trim().split('|'); if (p[0] !== 'VVID' || p.length < 4) throw new Error('That is not a VillageVault ID card.');
  if (p[1] !== S.v.code) throw new Error('This card belongs to a different village.'); const u = userById(p[2]); if (!u || !['member', 'admin'].includes(u.role)) throw new Error('Member not found.'); if (!u.active) throw new Error(`${u.name} is deactivated.`);
  if ((await idPayload(u)).split('|')[3] !== p[3]) throw new Error('This card code does not match the member. It may be forged or out of date.');
  const m = S.v.meetings.find(meetingOpen); if (!m) throw new Error('No register is open right now.'); const k = m.marks.find(x => x.memberId === u.id);
  if (k) return { u, m, already: true, status: k.status };
  API.setMark(m.id, u.id, 'verified'); return { u, m, already: false };
}
let SCAN = null;
function scanStop() { if (SCAN) { SCAN.on = false; try { SCAN.stream.getTracks().forEach(t => t.stop()); } catch (_) {} SCAN = null; } const v = $('#idVid'); if (v) { v.hidden = true; v.srcObject = null; } }
async function idHandle(text) {
  const out = $('#idRes'); try { const r = await idCheckIn(text); if (out) out.innerHTML = r.already ? `<b>${esc(r.u.name)}</b> is already on the register (${r.status === 'verified' ? 'verified' : 'waiting for a second admin'}).` : `<b>${esc(r.u.name)}</b> marked present. Another admin must verify it.`; toast(r.already ? `${r.u.name} is already marked.` : `${r.u.name} marked present.`, 'ok'); return true; } catch (ex) { if (out) out.textContent = ex.message; toast(ex.message, 'err'); return false; }
}
Object.assign(ACTIONS, {
  async 'id-png'(el) { try { const u = userById(el.dataset.id); download(`ID-${u.id}.png`, await idCardPng(u)); toast('ID card downloaded.', 'ok'); } catch (ex) { toast(ex.message, 'err'); } },
  async 'id-pdf-all'() { try { requireAdmin(); assertFeature('idcard', 'ID cards'); const us = livePeople(); download(`${S.v.code}-ID-cards.pdf`, await idCardPdf(us)); try { log('Printed ID cards', 'ID cards', `${us.length} cards`); commit(); } catch (_) {} toast(`${us.length} cards ready to print.`, 'ok'); } catch (ex) { toast(ex.message, 'err'); } },
  async 'id-check'() { const i = $('#idIn'); if (!i || !i.value.trim()) return toast('Type or scan a card code first.', 'err'); if (await idHandle(i.value)) { i.value = ''; i.focus(); } },
  async 'id-scan'() {
    if (SCAN) return scanStop(); if (!('BarcodeDetector' in window) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return toast('Camera scanning is not supported in this browser. Use a barcode scanner, or type the code.', 'err');
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] }), stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }), v = $('#idVid'); if (!v) { stream.getTracks().forEach(t => t.stop()); return; }
      v.srcObject = stream; v.hidden = false; await v.play(); SCAN = { on: true, stream, last: '', at: 0 };
      const loop = async () => { if (!SCAN || !SCAN.on) return; try { const r = await det.detect(v); if (r.length && (r[0].rawValue !== SCAN.last || Date.now() - SCAN.at > 4000)) { SCAN.last = r[0].rawValue; SCAN.at = Date.now(); await idHandle(r[0].rawValue); } } catch (_) {} setTimeout(loop, 400); }; loop();
    } catch (ex) { toast('Could not open the camera. Allow camera access, or type the code instead.', 'err'); }
  }
});
{ const _rv = renderView; renderView = function () { scanStop(); const r = _rv.apply(this, arguments); try { document.body.classList.toggle('prem-on', !S.owner && !!S.v && S.v.plan === 'premium'); } catch (_) {}
  const im = $('#idImg'); if (im && S.u && planAllows('idcard')) { const u = userById(isAdmin() ? (S.f.idm || S.u.id) : S.u.id) || S.u; idCardPng(u).then(b => { const el = $('#idImg'); if (el) el.src = URL.createObjectURL(b); }).catch(() => {}); } return r; }; }

/* ---------- Navigation, pages and banners ---------- */
NAV.admin.push(['notices', 'Notice board', 'book'], ['idcard', 'ID card and check-in', 'check']);
NAV.member.push(['notices', 'Notice board', 'book'], ['idcard', 'My ID card', 'check']);
Object.assign(TITLES, { notices: 'Notice board', idcard: 'ID card and check-in' });
VIEWS.admin.notices = VIEWS.member.notices = noticesView; VIEWS.admin.idcard = VIEWS.member.idcard = idCardView;
{ const _ao = VIEWS.admin.overview, _mo = VIEWS.member.overview;
  VIEWS.admin.overview = function () { return noticeBanner() + dobBanner() + _ao.apply(this, arguments) + birthdayWidget(); };
  VIEWS.member.overview = function () { return noticeBanner() + dobBanner() + _mo.apply(this, arguments); }; }
