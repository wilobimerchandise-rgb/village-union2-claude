/* =========================================================
   MEETING MINUTES (Premium). Frontend only, per ASSOCIET Phase 10.5.
   Secretary writes. Chairman approves (never the writer). Members read APPROVED,
   non-executive minutes only. Everything downloadable. Both signatures on every document.
   Visibility is decided in ONE place: minuteVisible().
   NOTE: this stops casual tampering only. Real enforcement needs the backend.
   ========================================================= */
const DEFAULT_MTYPES = [['General meeting', 0], ['Executive and elders meeting', 1], ['Annual general meeting', 0], ['Emergency meeting', 0]];
const minutesOn = () => planAllows('minutes');
const isSecretary = () => !!S.u && !S.owner && S.u.id !== 'SUPPORT' && S.u.role === 'admin' && S.u.active && S.u.title === 'Secretary';
const isChair = () => !!S.u && !S.owner && S.u.id !== 'SUPPORT' && S.u.role === 'admin' && S.u.active && S.u.title === 'Chairman';
const mtypesAll = () => S.v.meetingTypes || [];
const mtypesLive = () => mtypesAll().filter(t => !t.removed);
const mtypeOf = id => mtypesAll().find(t => t.id === id);
/* the single visibility rule used by lists, counters, PDFs and audio */
const minuteVisible = m => isAdmin() ? true : (m.status === 'approved' && !m.adminOnly);
const visibleMinutes = () => (S.v.minutes || []).filter(minuteVisible).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
const getMin = id => { const m = (S.v.minutes || []).find(x => x.id === id); if (!m || !minuteVisible(m)) throw new Error('Those minutes are not available.'); return m; };
const MIN_BADGE = { draft: '<span class="badge b-off">Draft</span>', submitted: '<span class="badge b-pending">Waiting for the Chairman</span>', approved: '<span class="badge b-verified">Approved</span>', rejected: '<span class="badge b-rejected">Returned</span>' };
const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);

/* ---------- Audio, kept in the browser's IndexedDB (too big for localStorage) ---------- */
const AUDIO = {
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('vv_audio', 1); r.onupgradeneeded = () => r.result.createObjectStore('a'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  async put(key, blob) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('a', 'readwrite'); t.objectStore('a').put(blob, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async get(key) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('a').objectStore('a').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); },
  async del(key) { const db = await this.open(); return new Promise(res => { const t = db.transaction('a', 'readwrite'); t.objectStore('a').delete(key); t.oncomplete = () => res(); t.onerror = () => res(); }); }
};
const audioKey = m => `${S.v.id}:${m.id}`;
const REC = { rec: null, chunks: [], blob: null, t0: 0, timer: null, meter: null, stream: null, ctx: null, peak: 0, loud: 0, quiet: 0, frames: 0 };
function recSay(msg, bad) { const m = $('#recMsg'); if (!m) return; m.textContent = msg; m.style.color = bad ? '#B3261E' : ''; m.style.fontWeight = bad ? '600' : ''; }
function recVerdict() {
  if (!REC.frames) return 'Play it back before you save it.';
  if (REC.peak < 0.08) return 'This recording is very quiet. Play it back. If you cannot hear people clearly, record again with the device closer to the speakers.';
  if (REC.loud / REC.frames > 0.05) return 'Parts of this recording were too loud and may sound distorted. Play it back before you save it.';
  if (REC.quiet / REC.frames > 0.7) return 'Most of this recording was very quiet. Play it back before you save it.';
  return 'Level looked good. Play it back before you save it.';
}
function recReset() { try { if (REC.rec && REC.rec.state !== 'inactive') REC.rec.stop(); } catch (_) {} clearInterval(REC.timer); clearInterval(REC.meter); try { if (REC.stream) REC.stream.getTracks().forEach(t => t.stop()); } catch (_) {} REC.rec = null; REC.chunks = []; REC.blob = null; }

/* ---------- Data operations ---------- */
Object.assign(API, {
  saveMinute(d, id) {
    requireAdmin(); assertFeature('minutes', 'Meeting minutes');
    if (!isSecretary()) throw new Error('Only the Secretary writes minutes.');
    const reg = d.meetingId ? S.v.meetings.find(x => x.id === d.meetingId) : null; if (d.meetingId && !reg) throw new Error('That register was not found.');
    if (reg) { if (reg.typeId) d.typeId = reg.typeId; d.date = reg.date; }
    const t = mtypeOf(d.typeId); if (!t || (t.removed && !(reg && reg.typeId === t.id))) throw new Error('Choose a meeting type.');
    const title = String(d.title || '').trim(); if (title.length < 3) throw new Error('Enter the meeting title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') || d.date > today()) throw new Error('Enter the meeting date. It cannot be in the future.');
    const body = { typeId: t.id, typeName: t.name, adminOnly: !!(t.exec || (reg && reg.exec)), title: title.slice(0, 80), date: d.date, venue: String(d.venue || '').trim().slice(0, 80), meetingId: d.meetingId || '', apologies: String(d.apologies || '').trim().slice(0, 300), attendNote: String(d.attendNote || '').trim().slice(0, 300), agenda: lines(d.agenda).slice(0, 30).map(x => x.slice(0, 160)), discussion: String(d.discussion || '').trim().slice(0, 8000), resolutions: lines(d.resolutions).slice(0, 40).map(x => x.slice(0, 300)), actions: lines(d.actions).slice(0, 40).map(x => x.slice(0, 300)) };
    let m;
    if (id) { m = (S.v.minutes || []).find(x => x.id === id); if (!m || !['draft', 'rejected'].includes(m.status)) throw new Error('Minutes can be edited only while they are a draft or returned.'); Object.assign(m, body, { status: 'draft', updatedAt: stamp() }); log('Edited minutes draft', m.id, m.title); }
    else { S.v.minutes = S.v.minutes || []; m = Object.assign({ id: nextId('min', 'M'), status: 'draft', writtenById: S.u.id, writtenBy: S.u.name, writtenAt: stamp(), audio: null }, body); S.v.minutes.push(m); log('Started minutes draft', m.id, m.title); }
    commit(); return m;
  },
  submitMinute(id) {
    requireAdmin(); assertFeature('minutes', 'Meeting minutes'); if (!isSecretary()) throw new Error('Only the Secretary submits minutes.');
    const m = (S.v.minutes || []).find(x => x.id === id); if (!m || !['draft', 'rejected'].includes(m.status)) throw new Error('These minutes cannot be submitted.');
    if (!m.discussion && !m.resolutions.length) throw new Error('Add the discussion or at least one resolution before you submit.');
    if (m.meetingId) { const mt = S.v.meetings.find(x => x.id === m.meetingId); if (mt) m.present = mt.marks.filter(k => k.status === 'verified').map(k => (userById(k.memberId) || {}).name).filter(Boolean).sort(); }
    m.status = 'submitted'; m.submittedAt = stamp(); delete m.rejectReason; log('Submitted minutes for approval', m.id, m.title); commit(); return m;
  },
  approveMinute(id) {
    requireAdmin(); assertFeature('minutes', 'Meeting minutes'); if (!isChair()) throw new Error('Only the Chairman approves minutes.');
    const m = (S.v.minutes || []).find(x => x.id === id); if (!m || m.status !== 'submitted') throw new Error('These minutes are not waiting for approval.');
    if (m.writtenById === S.u.id) throw new Error('The person who wrote the minutes cannot approve them.');
    const sec = userById(m.writtenById) || {}, yr = Number(m.date.slice(0, 4)); S.v.seq.minNo = S.v.seq.minNo || {}; S.v.seq.minNo[yr] = (S.v.seq.minNo[yr] || 0) + 1;
    m.no = `MIN/${S.v.code}/${yr}/${String(S.v.seq.minNo[yr]).padStart(4, '0')}`;
    m.sigs = { chair: { name: S.u.name, title: 'Chairman', img: S.u.signature || null }, sec: { name: sec.name || m.writtenBy, title: 'Secretary', img: sec.signature || null } };
    m.status = 'approved'; m.approvedById = S.u.id; m.approvedBy = S.u.name; m.approvedAt = stamp(); log('Approved minutes', m.id, `${m.no}: ${m.title}`); commit(); return m;
  },
  rejectMinute(id, reason) {
    requireAdmin(); assertFeature('minutes', 'Meeting minutes'); if (!isChair()) throw new Error('Only the Chairman can return minutes.');
    const m = (S.v.minutes || []).find(x => x.id === id); if (!m || m.status !== 'submitted') throw new Error('These minutes are not waiting for approval.');
    reason = String(reason || '').trim(); if (reason.length < 5) throw new Error('Say what must be corrected.');
    m.status = 'rejected'; m.rejectReason = reason.slice(0, 300); m.rejectedBy = S.u.name; log('Returned minutes', m.id, reason.slice(0, 120)); commit(); return m;
  },
  deleteMinuteDraft(id) {
    requireAdmin(); if (!isSecretary()) throw new Error('Only the Secretary can delete a draft.');
    const i = (S.v.minutes || []).findIndex(x => x.id === id), m = S.v.minutes[i]; if (!m || !['draft', 'rejected'].includes(m.status)) throw new Error('Only a draft can be deleted. Approved minutes are kept.');
    S.v.minutes.splice(i, 1); log('Deleted minutes draft', id, m.title); commit(); AUDIO.del(`${S.v.id}:${id}`);
  },
  saveMeetingTypes(rows) {
    requireAdmin(); if (!isLeadAdmin()) throw new Error('Only the Lead Admin edits meeting types.');
    const out = [], seen = new Set();
    rows.forEach(r => { const n = String(r.name || '').trim().slice(0, 50); if (!n) return; const k = n.toLowerCase(); if (seen.has(k)) throw new Error(`"${n}" appears twice.`); seen.add(k); out.push({ id: r.id || ('T' + Math.random().toString(36).slice(2, 8)), name: n, exec: !!r.exec, removed: false }); });
    if (!out.length) throw new Error('Keep at least one meeting type.');
    mtypesAll().forEach(t => { if (!out.some(o => o.id === t.id)) out.push(Object.assign({}, t, { removed: true })); });   // old minutes keep their type name
    S.v.meetingTypes = out; log('Edited meeting types', 'Minutes', out.filter(t => !t.removed).map(t => t.name + (t.exec ? ' (executive)' : '')).join('; ')); commit();
  }
});

/* ---------- PDF ---------- */
async function minutePdf(m) {
  const pdf = new PDF(), M = 48, CW = pdf.W - 96, INK = '#14142B', MUT = '#5B5F7A', prem = true;
  if (m.status !== 'approved') pdf.wm = 'DRAFT';
  let y = 0;
  pdf.rect(0, 0, pdf.W, 96, '#1A1A4E'); pdf.rect(0, 96, pdf.W, 4, '#F5B83D');
  if (S.v.logo) { try { pdf.img(S.v.logo, M, 22, 52, 52); } catch (_) {} }
  const hx = S.v.logo ? M + 66 : M;
  pdf.text(pdf.fit(`${S.v.name} (${S.v.code})`, CW - 150, 14, true), hx, 40, { size: 14, bold: true, color: '#F5B83D' });
  pdf.text('MINUTES OF MEETING', hx, 66, { size: 20, bold: true, color: '#FFFFFF' });
  pdf.text(m.no || 'Draft, not yet approved', pdf.W - M, 40, { size: 9, color: '#DADCF5', align: 'right' });
  y = 124;
  const newPage = () => { pdf.add(); y = 56; };
  const ensure = h => { if (y + h > pdf.H - 60) newPage(); };
  const h = t => { ensure(40); pdf.text(t, M, y, { size: 11.5, bold: true, color: '#1A1A4E' }); y += 6; pdf.line(M, y, M + CW, y, '#1A1A4E', .8); y += 14; };
  const wrap = (txt, size, x0, w0) => { const out = []; String(txt).split(/\r?\n/).forEach(par => { let cur = ''; par.split(/\s+/).filter(Boolean).forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (pdf.w(t, size, false) <= w0) cur = t; else { if (cur) out.push(cur); cur = wd; } }); out.push(cur); }); return out; };
  const para = (txt, o) => { o = o || {}; const size = o.size || 10, x0 = M + (o.indent || 0), lh = size * 1.45; wrap(txt, size, x0, CW - (o.indent || 0)).forEach(l => { ensure(lh); if (l) pdf.text(l, x0, y, { size, color: INK }); y += lh; }); y += o.gap == null ? 4 : o.gap; };
  const kv = (k, v) => { ensure(16); pdf.text(k, M, y, { size: 9.5, bold: true, color: MUT }); pdf.text(pdf.fit(v || '-', CW - 110, 10, false), M + 110, y, { size: 10, color: INK }); y += 16; };
  kv('Meeting', m.title); kv('Type', m.typeName); kv('Date', fmtDate(m.date)); kv('Venue', m.venue || 'Not stated');
  y += 6; h('Attendance');
  if (m.present && m.present.length) para(`Present (${m.present.length}): ${m.present.join(', ')}`);
  if (m.attendNote) para(m.attendNote);
  if (m.apologies) para(`Apologies: ${m.apologies}`);
  if (!(m.present && m.present.length) && !m.attendNote && !m.apologies) para('Not recorded.');
  if (m.agenda.length) { h('Agenda'); m.agenda.forEach((a, i) => para(`${i + 1}. ${a}`, { gap: 1 })); y += 4; }
  if (m.discussion) { h('Discussion'); para(m.discussion); }
  if (m.resolutions.length) { h('Resolutions'); m.resolutions.forEach((a, i) => para(`${i + 1}. ${a}`, { gap: 2 })); y += 4; }
  if (m.actions.length) { h('Action items'); m.actions.forEach((a, i) => para(`${i + 1}. ${a}`, { gap: 2 })); y += 4; }
  ensure(110); y += 14;
  const sg = m.sigs || { chair: { name: (holderOf('Chairman') || {}).name || '', title: 'Chairman', img: (holderOf('Chairman') || {}).signature || null }, sec: { name: m.writtenBy, title: 'Secretary', img: (userById(m.writtenById) || {}).signature || null } };
  [[sg.sec, M], [sg.chair, M + CW - 200]].forEach(([s, x]) => { if (s.img) { try { pdf.img(s.img, x, y - 4, 120, 40, 300, 120); } catch (_) {} } pdf.line(x, y + 40, x + 200, y + 40, INK, .8); pdf.text(s.name || '', x, y + 54, { size: 9.5, bold: true, color: INK }); pdf.text(s.title, x, y + 67, { size: 8.5, color: MUT }); });
  y += 84;
  if (m.status === 'approved') pdf.text(`Approved by ${m.approvedBy} on ${fmtTS(m.approvedAt)}. Written by ${m.writtenBy}.`, M, y, { size: 8.5, color: MUT });
  else pdf.text('DRAFT. Not valid until the Chairman approves it.', M, y, { size: 8.5, bold: true, color: '#B45309' });
  const n = pdf.pages.length;
  pdf.pages.forEach((pg, i) => { pdf.p = pg; pdf.line(M, pdf.H - 40, M + CW, pdf.H - 40, '#DCE3E0'); pdf.text(`${S.v.name} (${S.v.code}) | ${m.title} | ${fmtDate(m.date)}`, M, pdf.H - 26, { size: 7.5, color: MUT }); pdf.text(`Page ${i + 1} of ${n}`, M + CW, pdf.H - 26, { size: 7.5, color: MUT, align: 'right' }); });
  return pdf.build(`${m.title} minutes`);
}

/* ---------- Views ---------- */
const upgradeCard = () => `<section class="panel"><div class="panel-h"><div><h2>Meeting minutes ${premiumBadge}</h2><p>Minutes are part of the Premium plan. The Secretary writes them, the Chairman approves them, and members read the approved ones here. Ask the owner to upgrade ${esc(S.v.name)}.</p></div></div></section>`;
function minutesRows(list) {
  return list.map(m => [`${esc(m.no || '-')}<small>${esc(m.id)}</small>`, esc(fmtDate(m.date)), `${esc(m.title)}<small>${esc(m.typeName)}${m.adminOnly ? ' | admins only' : ''}</small>`, MIN_BADGE[m.status], `<button class="btn btn-ghost btn-sm" type="button" data-act="min-view" data-id="${esc(m.id)}">Open</button>`]);
}
function minutesView() {
  if (!minutesOn()) return upgradeCard();
  const list = visibleMinutes(), admin = isAdmin(), waiting = (S.v.minutes || []).filter(m => m.status === 'submitted').length;
  const sec = holderOf('Secretary'), ch = holderOf('Chairman');
  const btns = `${isSecretary() ? '<button class="btn btn-primary btn-sm" type="button" data-act="min-new">Write minutes</button>' : ''}${isLeadAdmin() && admin ? '<button class="btn btn-ghost btn-sm" type="button" data-act="min-types">Meeting types</button>' : ''}${admin ? '<button class="btn btn-ghost btn-sm" type="button" data-act="min-csv">Download list (CSV)</button>' : ''}`;
  const info = admin ? `<div class="callout"><div><b>${waiting ? `${waiting} set${waiting === 1 ? '' : 's'} of minutes waiting for the Chairman` : 'How minutes work'}</b><p>Secretary: ${sec ? esc(sec.name) : '<b>nobody holds this duty yet</b>'}. Chairman: ${ch ? esc(ch.name) : '<b>nobody holds this duty yet</b>'}. The Secretary writes, the Chairman approves. Executive meeting minutes stay with admins.</p></div></div>` : '';
  return `<section class="panel"><div class="panel-h"><div><h2>Meeting minutes</h2><p>${admin ? 'Every set of minutes, including drafts.' : 'Approved minutes of your village meetings. You can download each one.'}</p></div><div class="btn-row">${btns}</div></div>${info}
  ${table(['Number', 'Date', 'Meeting', 'Status', ''], minutesRows(list), ['No minutes yet', admin ? 'The Secretary starts them with Write minutes.' : 'Approved minutes appear here.'])}</section>`;
}
VIEWS.member.minutes = minutesView; VIEWS.admin.minutes = minutesView;

function minForm(m) {
  m = m || {}; const ms = S.v.meetings.slice().sort((a, b) => b.date.localeCompare(a.date));
  const tOpts = mtypesLive().map(t => opt(t.id, t.name + (t.exec ? ' (executive, admins only)' : ''), m.typeId)).join('');
  return `<div class="grid2"><div class="field"><label for="mnT">Meeting type</label><select id="mnT" name="typeId" class="input">${tOpts}</select></div><div class="field"><label for="mnD">Meeting date</label><input id="mnD" name="date" class="input" type="date" max="${today()}" value="${esc(m.date || today())}" required></div></div>
  <div class="field"><label for="mnTi">Title</label><input id="mnTi" name="title" class="input" maxlength="80" value="${esc(m.title || '')}" placeholder="For example: General meeting, October" required></div>
  <div class="grid2"><div class="field"><label for="mnV">Venue</label><input id="mnV" name="venue" class="input" maxlength="80" value="${esc(m.venue || '')}"></div><div class="field"><label for="mnM">Attendance from a register</label><select id="mnM" name="meetingId" class="input">${opt('', 'None, I will type it', m.meetingId)}${ms.map(x => opt(x.id, `${fmtDate(x.date)}: ${x.title}`, m.meetingId)).join('')}</select><span class="hint">Verified names are copied when you submit.</span></div></div>
  <div class="field"><label for="mnA">Apologies (names)</label><input id="mnA" name="apologies" class="input" maxlength="300" value="${esc(m.apologies || '')}"></div>
  <div class="field"><label for="mnN">Attendance note</label><input id="mnN" name="attendNote" class="input" maxlength="300" value="${esc(m.attendNote || '')}" placeholder="For example: Quorum formed with 18 members"></div>
  <div class="field"><label for="mnAg">Agenda (one item per line)</label><textarea id="mnAg" name="agenda" class="input" rows="3">${esc((m.agenda || []).join('\n'))}</textarea></div>
  <div class="field"><label for="mnDi">Discussion</label><textarea id="mnDi" name="discussion" class="input" rows="6" maxlength="8000">${esc(m.discussion || '')}</textarea></div>
  <div class="field"><label for="mnR">Resolutions (one per line)</label><textarea id="mnR" name="resolutions" class="input" rows="3">${esc((m.resolutions || []).join('\n'))}</textarea></div>
  <div class="field"><label for="mnAc">Action items (one per line: task, who, by when)</label><textarea id="mnAc" name="actions" class="input" rows="3">${esc((m.actions || []).join('\n'))}</textarea></div>`;
}
const fdObj = fd => { const o = {}; fd.forEach((v, k) => { o[k] = v; }); return o; };
function openMinForm(m) {
  const wire = () => { const sel = $('#mnM'); if (!sel) return; const apply = () => { const g = S.v.meetings.find(x => x.id === sel.value), t = $('#mnT'), d = $('#mnD'); const lock = !!g; if (t) t.disabled = lock && !!g.typeId; if (d) d.readOnly = lock; if (!g) return; if (g.typeId && t && [...t.options].some(o => o.value === g.typeId)) t.value = g.typeId; if (d) d.value = g.date; const ti = $('#mnTi'); if (ti && !ti.value.trim()) ti.value = g.title; }; sel.addEventListener('change', apply); apply(); };
  openModal({ title: m ? 'Edit minutes' : 'Write minutes', sub: 'Saved as a draft. Only you can change it until you submit it to the Chairman.', size: 'modal-lg', body: minForm(m), submit: 'Save draft',
    onSubmit: fd => { const o = fdObj(fd); const tt = $('#mnT'); if (tt && tt.disabled) o.typeId = tt.value; const r = API.saveMinute(o, m && m.id); closeModal(); renderView(); toast('Draft saved.', 'ok'); setTimeout(() => ACTIONS['min-view']({ dataset: { id: r.id } }), 50); } });
  wire();
}
async function minAudioBlock(m) {
  const box = $('#minAudio'); if (!box) return; let blob = null; try { blob = m.audio ? await AUDIO.get(audioKey(m)) : null; } catch (_) {}
  if (!blob) { box.innerHTML = m.audio ? '<p class="muted">The audio is stored on the device where it was recorded, and is not on this one.</p>' : '<p class="muted">No audio attached.</p>'; return; }
  const url = URL.createObjectURL(blob); box.innerHTML = `<audio controls src="${url}" style="width:100%"></audio><div class="btn-row" style="margin-top:8px"><button class="btn btn-ghost btn-sm" type="button" data-act="min-audio-dl" data-id="${esc(m.id)}">Download audio</button></div>`;
}
Object.assign(ACTIONS, {
  'min-new'() { if (!isSecretary()) throw new Error('Only the Secretary writes minutes.'); assertFeature('minutes', 'Meeting minutes'); openMinForm(null); },
  'min-edit'(el) { const m = getMin(el.dataset.id); openMinForm(m); },
  'min-view'(el) {
    const m = getMin(el.dataset.id), sec = isSecretary(), chair = isChair(), ed = ['draft', 'rejected'].includes(m.status);
    const sg = m.sigs || {}, sigH = s => s && s.img ? `<img class="sigprev" src="${esc(s.img)}" alt="Signature of ${esc(s.name)}">` : '<span class="muted">No signature uploaded</span>';
    const bar = `<div class="btn-row" style="margin:12px 0"><button class="btn btn-primary btn-sm" type="button" data-act="min-pdf" data-id="${esc(m.id)}">Download PDF</button>
      ${sec && ed ? `<button class="btn btn-ghost btn-sm" type="button" data-act="min-edit" data-id="${esc(m.id)}">Edit</button><button class="btn btn-leaf btn-sm" type="button" data-act="min-submit" data-id="${esc(m.id)}">Submit to the Chairman</button><button class="btn btn-ghost btn-sm" type="button" data-act="min-audio" data-id="${esc(m.id)}">${m.audio ? 'Replace audio' : 'Add audio'}</button><button class="btn btn-ghost btn-sm" type="button" data-act="min-del" data-id="${esc(m.id)}">Delete draft</button>` : ''}
      ${chair && m.status === 'submitted' ? `<button class="btn btn-leaf btn-sm" type="button" data-act="min-approve" data-id="${esc(m.id)}">Approve</button><button class="btn btn-ghost btn-sm" type="button" data-act="min-reject" data-id="${esc(m.id)}">Return with a reason</button>` : ''}</div>`;
    const ol = a => a.length ? `<ol>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<p class="muted">None.</p>';
    infoModal(m.title, `${esc(m.typeName)} | ${esc(fmtDate(m.date))}${m.venue ? ' | ' + esc(m.venue) : ''} | ${m.no ? esc(m.no) : 'Draft'}`,
      `${MIN_BADGE[m.status]}${m.status === 'rejected' ? `<div class="callout warn"><div><b>Returned by the Chairman</b><p>${esc(m.rejectReason || '')}</p></div></div>` : ''}${bar}
      <div class="sec-title">Attendance</div><p>${m.present && m.present.length ? `Present (${m.present.length}): ${esc(m.present.join(', '))}. ` : ''}${esc(m.attendNote || '')}${m.apologies ? ` Apologies: ${esc(m.apologies)}.` : ''}${!(m.present && m.present.length) && !m.attendNote && !m.apologies ? 'Not recorded.' : ''}</p>
      <div class="sec-title">Agenda</div>${ol(m.agenda)}<div class="sec-title">Discussion</div><p style="white-space:pre-wrap">${esc(m.discussion || 'None.')}</p>
      <div class="sec-title">Resolutions</div>${ol(m.resolutions)}<div class="sec-title">Action items</div>${ol(m.actions)}
      <div class="sec-title">Audio</div><div id="minAudio"></div>
      <div class="sec-title">Signatures</div><div class="btn-row"><div>${m.status === 'approved' ? sigH(sg.sec) : '<span class="muted">Added when approved</span>'}<small>${esc(m.writtenBy)}, Secretary</small></div><div>${m.status === 'approved' ? sigH(sg.chair) : '<span class="muted">Added when approved</span>'}<small>${esc(m.approvedBy || 'Chairman')}, Chairman</small></div></div>`);
    minAudioBlock(m);
  },
  'min-submit'(el) { API.submitMinute(el.dataset.id); closeModal(); renderView(); toast('Submitted. The Chairman can now approve it.', 'ok'); },
  'min-approve'(el) { const m = getMin(el.dataset.id); openModal({ title: 'Approve these minutes?', sub: `${esc(m.title)}. They will get their number, carry both signatures and can no longer be changed.${m.adminOnly ? ' Admins only: members will not see them.' : ' Members will be able to read them.'}`, body: '', submit: 'Approve minutes', onSubmit: () => { API.approveMinute(m.id); closeModal(); renderView(); toast('Minutes approved.', 'ok'); } }); },
  'min-reject'(el) { const m = getMin(el.dataset.id); openModal({ title: 'Return the minutes', sub: 'The Secretary will see your reason and can correct them.', body: '<div class="field"><label for="mrR">What must be corrected?</label><textarea id="mrR" name="reason" class="input" rows="3" maxlength="300" required></textarea></div>', submit: 'Return to Secretary', onSubmit: fd => { API.rejectMinute(m.id, fd.get('reason')); closeModal(); renderView(); toast('Returned to the Secretary.', 'ok'); } }); },
  'min-del'(el) { const m = getMin(el.dataset.id); openModal({ title: 'Delete this draft?', sub: esc(m.title), body: '', danger: true, submit: 'Delete draft', onSubmit: () => { API.deleteMinuteDraft(m.id); closeModal(); renderView(); toast('Draft deleted.', 'ok'); } }); },
  async 'min-pdf'(el) { const m = getMin(el.dataset.id); download(`${S.v.code}-minutes-${m.date}-${(m.no || m.id).replace(/[^A-Za-z0-9]+/g, '-')}.pdf`, await minutePdf(m)); toast('Minutes downloaded.', 'ok'); },
  'min-csv'() { requireAdmin(); const rows = [['Number', 'Id', 'Date', 'Title', 'Type', 'Status', 'Written by', 'Approved by', 'Resolutions']]; (S.v.minutes || []).forEach(m => rows.push([m.no || '', m.id, m.date, m.title, m.typeName, m.status, m.writtenBy, m.approvedBy || '', m.resolutions.join(' | ')])); csvDownload(`${S.v.code}-minutes.csv`, rows); },
  async 'min-audio-dl'(el) { const m = getMin(el.dataset.id), b = await AUDIO.get(audioKey(m)); if (!b) return toast('No audio on this device.', 'err'); download(`${S.v.code}-minutes-${m.date}-audio.${/ogg/.test(b.type) ? 'ogg' : /mp4|aac|mpeg/.test(b.type) ? 'm4a' : 'webm'}`, b); },
  'min-types'() {
    if (!isLeadAdmin()) throw new Error('Only the Lead Admin edits meeting types.');
    const row = t => `<div class="grid2 mtrow" style="align-items:end"><div class="field"><label>Name</label><input class="input mt-name" maxlength="50" value="${esc(t.name)}" data-id="${esc(t.id || '')}"></div><label class="check"><input type="checkbox" class="mt-exec"${t.exec ? ' checked' : ''}> Executive (admins only)</label></div>`;
    openModal({ title: 'Meeting types', sub: 'Rename, add or remove types. Clear a name to remove it. Old minutes keep the name they were written under.', body: `<div id="mtRows">${mtypesLive().map(row).join('')}</div><button class="btn btn-ghost btn-sm" type="button" data-act="mt-add">Add a type</button>`, submit: 'Save types',
      onSubmit: () => { API.saveMeetingTypes($$('#mtRows .mtrow').map(r => ({ id: $('.mt-name', r).dataset.id, name: $('.mt-name', r).value, exec: $('.mt-exec', r).checked }))); closeModal(); renderView(); toast('Meeting types saved.', 'ok'); } });
    S._mtRow = row;
  },
  'mt-add'() { const d = document.createElement('div'); d.innerHTML = S._mtRow({ name: '', exec: false }); $('#mtRows').appendChild(d.firstChild); const i = $$('#mtRows .mt-name'); i[i.length - 1].focus(); },
  'min-audio'(el) {
    const m = getMin(el.dataset.id); recReset();
    openModal({ title: 'Meeting audio', sub: esc(m.title), submit: 'Save audio', body: `<label class="check"><input type="checkbox" name="consent" required> Everyone present has been told this meeting is being recorded.</label>
      <div class="btn-row" style="margin:10px 0"><button class="btn btn-ghost btn-sm" type="button" data-act="rec-start" id="recGo">Start recording</button><button class="btn btn-ghost btn-sm" type="button" data-act="rec-stop" id="recStop" disabled>Stop</button><span id="recT" class="muted">0:00</span></div>
      <div class="field"><label for="recDev">Microphone</label><select id="recDev" class="select"><option value="">Default microphone</option></select></div>
      <label class="check"><input type="checkbox" id="recClose"> Only one or two people speak, close to the microphone</label>
      <div class="lvl" aria-hidden="true"><i id="recLvl"></i></div><p class="hint" id="recMsg" aria-live="polite">Tip: put the phone or laptop in the middle of the table. Use the device's own microphone, not a Bluetooth headset (those record thin, muffled sound). Switch off music and fans, and keep it away from other phones, which cause buzzing.</p>
      <div class="field"><label for="mnF">Or choose an audio file</label><input id="mnF" name="file" type="file" accept="audio/*"></div><div class="field"><label for="mnR2">Or record with your phone's own recorder</label><input id="mnR2" name="file2" type="file" accept="audio/*" capture><span class="hint">On a phone this opens the voice recorder app. It works even where the browser blocks the microphone.</span></div><p class="hint">Audio stays in this browser on this device (up to 25 MB, recordings stop at 20 minutes). A backend will keep it safely later.</p><div id="recOut"></div>`,
      onSubmit: async fd => {
        if (!fd.get('consent')) throw new Error('Confirm that everyone present knows about the recording.');
        let blob = REC.blob; const f = fd.get('file'), f2 = fd.get('file2'); if (f2 && f2.size) blob = f2; if (f && f.size) blob = f;
        if (!blob) throw new Error('Record the meeting or choose an audio file first.');
        if (blob.size > 25 * 1048576) throw new Error('That audio is over 25 MB. Record a shorter part or compress it.');
        if (!/^audio\//.test(blob.type || '')) throw new Error('Choose an audio file.');
        await AUDIO.put(audioKey(m), blob); const mm = (S.v.minutes || []).find(x => x.id === m.id); mm.audio = { size: blob.size, type: blob.type, at: stamp() }; log('Attached meeting audio', m.id, `${Math.round(blob.size / 1024)} KB`); commit(); recReset(); closeModal(); renderView(); toast('Audio saved.', 'ok');
      } });
    try { navigator.mediaDevices.enumerateDevices().then(l => { const sel = $('#recDev'); if (!sel) return; l.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications').forEach((d, k) => { const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || `Microphone ${k + 1}`; sel.appendChild(o); }); }).catch(() => {}); } catch (_) {}
  },
  async 'rec-start'() {
    /* Why recordings sounded poor: the browser default (audio: true) switches on echo cancelling and heavy noise suppression, which treat a room of
       people as "noise" and chop up distant voices. Here those are off, the voice band is cleaned (rumble and hum cut), quiet speakers are
       lifted with a gentle compressor, and the file is saved as 96 kbps Opus (AAC on Safari) instead of the low default. */
    try {
      recSay('Starting the microphone. If the browser asks, choose Allow.', false);
      const early = (() => { try { const AC = window.AudioContext || window.webkitAudioContext; const c = new AC(); c.resume && c.resume(); return c; } catch (_) { return null; } })();   // made inside the click so Safari and phones let it run
      if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { const e0 = new Error('nomic'); e0.name = window.isSecureContext === false ? 'Insecure' : 'NoSupport'; throw e0; }
      const dev = ($('#recDev') || {}).value, room = !$('#recClose') || !$('#recClose').checked;
      const base = { channelCount: 1, sampleRate: 48000, echoCancellation: false, noiseSuppression: false, autoGainControl: room };
      let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: dev ? Object.assign({ deviceId: { exact: dev } }, base) : base }); } catch (e1) { if (e1 && /Permission|NotAllowed|NotFound/.test(e1.name || '')) throw e1; st = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      recReset(); REC.stream = st; let src = st, ctx = null, an = null;
      try {
        ctx = early; if (!ctx) throw new Error('noaudioctx'); await ctx.resume(); if (ctx.state !== 'running') throw new Error('suspended');
        const input = ctx.createMediaStreamSource(st), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000;
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -34; comp.knee.value = 24; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
        const gain = ctx.createGain(); gain.gain.value = room ? 1.6 : 1.0;
        const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
        an = ctx.createAnalyser(); an.fftSize = 1024; const dest = ctx.createMediaStreamDestination();
        input.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(gain); gain.connect(lim); lim.connect(an); lim.connect(dest); src = dest.stream; REC.ctx = ctx;
      } catch (_) { src = st; an = null; try { if (ctx) ctx.close(); } catch (__) {} REC.ctx = null; }
      const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'], mt = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(src, mt ? { mimeType: mt, audioBitsPerSecond: 96000 } : { audioBitsPerSecond: 96000 }); REC.rec = r; REC.chunks = []; REC.t0 = Date.now(); REC.peak = 0; REC.loud = 0; REC.quiet = 0; REC.frames = 0;
      r.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
      r.onstop = () => { clearInterval(REC.meter); try { st.getTracks().forEach(t => t.stop()); if (REC.ctx) REC.ctx.close(); } catch (_) {} REC.blob = new Blob(REC.chunks, { type: (r.mimeType || mt || 'audio/webm').split(';')[0] }); const o = $('#recOut'); if (o) o.innerHTML = `<audio controls src="${URL.createObjectURL(REC.blob)}" style="width:100%"></audio><p class="hint" id="recVerdict">${esc(recVerdict())}</p>`; const g = $('#recGo'), s = $('#recStop'); if (g) g.disabled = false; if (s) s.disabled = true; clearInterval(REC.timer); };
      r.start(1000); $('#recGo').disabled = true; $('#recStop').disabled = false;
      if (an) { const buf = new Uint8Array(an.fftSize); REC.meter = setInterval(() => { an.getByteTimeDomainData(buf); let pk = 0; for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i] - 128) / 128); REC.peak = Math.max(REC.peak, pk); REC.frames++; if (pk > 0.97) REC.loud++; if (pk < 0.03) REC.quiet++; const bar = $('#recLvl'), msg = $('#recMsg'); if (bar) bar.style.width = Math.min(100, Math.round(pk * 140)) + '%'; if (msg) msg.textContent = pk > 0.97 ? 'Too loud: move the device back a little.' : pk < 0.03 ? 'Very quiet: move the device closer to the speakers.' : 'Level is good.'; }, 150); }
      REC.timer = setInterval(() => { const s = Math.floor((Date.now() - REC.t0) / 1000), t = $('#recT'); if (t) t.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`; if (s >= 1200) ACTIONS['rec-stop'](); }, 500);
    } catch (e) {
      const nm = (e && e.name) || '', inFrame = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
      const why = nm === 'Insecure' ? 'This page is not on a secure (https) address, so the browser blocks the microphone. Open the site from its https address.'
        : nm === 'NoSupport' ? 'This browser cannot record from the microphone. Use the phone recorder option below, or choose an audio file.'
        : /NotAllowed|Permission|Security/.test(nm) ? (inFrame ? 'The microphone is blocked because this page is shown inside another page (a preview). Open the site in its own browser tab and try again.' : 'The microphone is blocked. Tap the lock or microphone icon in the address bar, choose Allow, then press Start again.')
        : /NotFound|Devices/.test(nm) ? 'No microphone was found. Plug one in, or use the phone recorder option below.'
        : /NotReadable|Abort/.test(nm) ? 'The microphone is busy in another app. Close the other app and try again.'
        : 'The microphone could not be started. Use the phone recorder option below, or choose an audio file.';
      recSay(why, true); toast(why, 'err'); const g = $('#recGo'), s = $('#recStop'); if (g) g.disabled = false; if (s) s.disabled = true; try { if (early && early.state !== 'closed') early.close(); } catch (_) {}
    }
  },
  'rec-stop'() { try { if (REC.rec && REC.rec.state !== 'inactive') REC.rec.stop(); } catch (_) {} }
});

/* ---------- Meeting types drive the attendance register ---------- */
(function linkRegisterToTypes() {
  const open0 = API.openRegister;
  API.openRegister = function (title, typeId) {
    const m = open0.call(API, title);
    const t = (typeId && mtypeOf(typeId)) || mtypesLive().find(x => x.name.toLowerCase() === String(title).trim().toLowerCase()) || null;
    m.typeId = t ? t.id : ''; m.exec = !!(t && t.exec); if (t) m.typeName = t.name; commit(); return m;
  };
  ACTIONS['mtg-open'] = function () {
    requireAdmin();
    const types = mtypesLive(), first = types[0];
    openModal({ title: "Open today's register", sub: 'Members can mark themselves present only while it is open, and only for today. You verify every name.',
      body: `<div class="field"><label for="mtK">Meeting type</label><select id="mtK" name="typeId" class="input">${types.map(t => opt(t.id, t.name + (t.exec ? ' (executive, admins only)' : ''), first && first.id)).join('')}${opt('', 'Other (type a name)', '')}</select><span class="hint">The Lead Admin manages this list under Minutes, Meeting types. Executive meetings are hidden from ordinary members.</span></div>
      <div class="field"><label for="mtT">Meeting name</label><input id="mtT" name="title" class="input" maxlength="60" value="${esc(first ? first.name : 'General meeting')}" required></div>
      <div class="field"><label>Date</label><input class="input" value="${esc(fmtDate(today()))}" disabled><span class="hint">Registers open for today only. This stops anyone signing for a meeting that did not happen.</span></div>`, submit: 'Open register',
      onSubmit: fd => { const t = (fd.get('title') || '').trim(); if (t.length < 3) throw new Error('Enter the meeting name.'); API.openRegister(t, fd.get('typeId')); closeModal(); renderView(); toast('Register is open. Members can now mark attendance.', 'ok'); } });
    const sel = $('#mtK'), inp = $('#mtT');
    sel.addEventListener('change', () => { const t = mtypeOf(sel.value); inp.value = t ? t.name : ''; inp.focus(); });
  };
})();
