
/* ---------- Admin modal forms ---------- */
function txFormBody(t, mode) {
  const statuses = mode === 'add' ? ['verified', 'pending'] : ['pending', 'verified', 'rejected'];
  return `<div class="field"><label for="mMember">Member</label><select id="mMember" name="memberId" class="select" required>${memberOpts(t.memberId, 'Choose a member', true)}</select></div>
  <div class="form-row"><div class="field"><label for="mLevy">Levy</label><select id="mLevy" name="levy" class="select">${levyOpts(t.levy)}</select></div>
  <div class="field"><label for="mAmt">Amount (naira)</label><input id="mAmt" name="amount" class="input" type="number" min="1" step="1" value="${t.amount || ''}" required></div></div>
  <div class="form-row"><div class="field"><label for="mDate">Payment date</label><input id="mDate" name="date" class="input" type="date" max="${today()}" value="${esc(t.date || today())}" required></div>
  <div class="field"><label for="mMethod">Method</label><select id="mMethod" name="method" class="select">${methodOpts(t.method)}</select></div></div>
  <div class="form-row"><div class="field"><label for="mRef">Reference</label><input id="mRef" name="ref" class="input" type="text" maxlength="60" value="${esc(t.ref || '')}"></div>
  <div class="field"><label for="mStatus">Status</label><select id="mStatus" name="status" class="select">${statuses.map(s => opt(s, cap(s), t.status || 'verified')).join('')}</select></div></div>
  <div class="field"><label for="mReason">Rejection reason (only if rejected)</label><select id="mReason" name="reason" class="select">${opt('', 'Not rejected', t.rejectReason || '')}${REJECT_REASONS.map(r => opt(r, r, t.rejectReason)).join('')}</select></div>
  <div class="field"><label for="mNote">Note</label><textarea id="mNote" name="note" class="textarea" maxlength="300">${esc(t.note || '')}</textarea></div>
  ${fileField(mode === 'add' ? 'Proof of payment (optional)' : 'Replace proof (optional)')}`;
}
async function readTxForm(fd) {
  const d = { memberId: fd.get('memberId'), levy: fd.get('levy'), amount: Number(fd.get('amount')), date: fd.get('date'), method: fd.get('method'), ref: (fd.get('ref') || '').trim(), status: fd.get('status'), note: (fd.get('note') || '').trim(), reason: fd.get('reason') };
  if (!d.memberId) throw new Error('Choose a member.');
  if (!(d.amount > 0)) throw new Error('Enter an amount greater than zero.');
  if (!d.date) throw new Error('Choose the payment date.');
  if (d.date > today()) throw new Error('The payment date cannot be in the future.');
  if (d.status === 'rejected' && !d.reason) throw new Error('Choose a rejection reason.');
  d.proof = await readProof(fd.get('proof'));
  return d;
}
function done(msg) { toast(msg, 'ok'); closeModal(); renderView(); if (S.justVerified && S.justVerified.length) { const ids = S.justVerified; S.justVerified = null; setTimeout(() => { try { verifiedModal(ids); } catch (_) {} }, 60); } }
const ACTIONS = {
  'add-tx'() { openModal({ title: 'Add a payment record', sub: 'Use this for payments received outside the upload flow. Your name and the time are saved on the record.', body: txFormBody({}, 'add'), submit: 'Save record', onSubmit: async fd => { const t = API.addTx(await readTxForm(fd)); done(`Record ${t.id} saved.`); } }); },
  'edit-tx'(el) { const t = getTx(el.dataset.id); openModal({ title: 'Edit payment record', sub: `Record ${esc(t.id)}. Every change is logged under your name.`, body: txFormBody(t, 'edit'), submit: 'Save changes', onSubmit: async fd => { API.editTx(t.id, await readTxForm(fd)); done('Record updated.'); } }); },
  'verify-tx'(el) {
    const t = getTx(el.dataset.id);
    openModal({ title: 'Verify payment', size: 'modal-lg', sub: `${esc(nameOf(t.memberId))} says they paid ${esc(levyOf(t.levy).name)} on ${esc(fmtDate(t.date))} by ${esc(t.method)}. Reference: ${esc(t.ref || 'none')}.`,
      body: `<div class="form-row" style="margin-top:14px"><div>${proofHTML(proofOf(t))}</div><div><div class="field" style="margin-top:0"><label for="vAmt">Amount confirmed in the bank (naira)</label><input id="vAmt" name="amount" class="input" type="number" min="1" value="${t.amount}" required><span class="hint">Change this only if the proof shows a different amount.</span></div><div class="field"><label for="vNote">Note (optional)</label><textarea id="vNote" name="note" class="textarea" maxlength="300">${esc(t.note || '')}</textarea></div></div></div>`,
      submit: 'Verify and update records', onSubmit: fd => { const a = Number(fd.get('amount')); if (!(a > 0)) throw new Error('Enter the confirmed amount.'); API.verify(t.id, a, (fd.get('note') || '').trim()); done('Payment verified and the ledger updated.'); } });
  },
  'reject-tx'(el) {
    const t = getTx(el.dataset.id);
    openModal({ title: 'Reject payment', danger: true, sub: `${esc(nameOf(t.memberId))}, ${esc(levyOf(t.levy).name)}, ${money(t.amount)}. The member will see your reason.`,
      body: `<div class="field"><label for="rjR">Reason</label><select id="rjR" name="reason" class="select" required>${opt('', 'Choose a reason', '')}${REJECT_REASONS.map(r => opt(r, r, '')).join('')}</select></div>`, submit: 'Reject payment',
      onSubmit: fd => { if (!fd.get('reason')) throw new Error('Choose a reason so the member knows what to fix.'); API.reject(t.id, fd.get('reason')); done('Payment rejected.'); } });
  },
  'void-tx'(el) {
    const t = getTx(el.dataset.id);
    openModal({ title: 'Void this record?', danger: true, sub: `${esc(nameOf(t.memberId))}, ${esc(levyOf(t.levy).name)}, ${money(t.amount)}. Voided records stay in the history but no longer count in any total.`,
      body: `<div class="field"><label for="vdR">Reason</label><textarea id="vdR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Void record',
      onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Write a short reason for voiding.'); API.voidTx(t.id, r); done('Record voided.'); } });
  },
  'view-tx'(el) { txDetail(el.dataset.id); },
  'add-member'() {
    if (capReached()) return upgradeModal();
    const pw = 'Vv' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Add a member', sub: 'Give the member their ID and password. They can change the password after signing in.',
      body: `<div class="field"><label for="amN">Full name</label><input id="amN" name="name" class="input" maxlength="80" required></div><div class="form-row">${isVillageType() ? '<div class="field"><label for="amF">Family name</label><input id="amF" name="family" class="input" maxlength="40"></div><div class="field"><label for="amK">Kindred name</label><input id="amK" name="kindred" class="input" maxlength="40"></div>' : ''}<div class="field"><label for="amP">Phone</label><input id="amP" name="phone" class="input" type="tel" maxlength="20"></div></div><div class="field"><label for="amE">Email (optional)</label><input id="amE" name="email" class="input" type="email" maxlength="80"></div><div class="field"><label for="amPw">Starting password</label><input id="amPw" name="password" class="input" type="text" value="${pw}" minlength="6" required></div>`,
      submit: 'Add member', onSubmit: async fd => { const n = (fd.get('name') || '').trim(), p = fd.get('password') || ''; if (n.length < 3) throw new Error('Enter the member’s full name.'); if (p.length < 6) throw new Error('The password needs at least 6 characters.'); const u = await API.addMember({ name: n, family: (fd.get('family') || '').trim(), kindred: (fd.get('kindred') || '').trim(), phone: (fd.get('phone') || '').trim(), email: (fd.get('email') || '').trim(), password: p }); closeModal(); renderView(); toast(`${u.name} added.`, 'ok'); credModal(u.id); } });
  },
  'edit-member'(el) {
    const u = userById(el.dataset.id);
    openModal({ title: 'Edit member', sub: esc(u.id), body: `<div class="field"><label for="emN">Full name</label><input id="emN" name="name" class="input" value="${esc(u.name)}" required></div><div class="form-row">${isVillageType() ? `<div class="field"><label for="emF">Family name</label><input id="emF" name="family" class="input" maxlength="40" value="${esc(u.family || '')}"></div><div class="field"><label for="emK">Kindred name</label><input id="emK" name="kindred" class="input" maxlength="40" value="${esc(u.kindred || '')}"></div>` : ''}<div class="field"><label for="emP">Phone</label><input id="emP" name="phone" class="input" type="tel" value="${esc(u.phone || '')}"></div></div><div class="form-row"><div class="field"><label for="emE">Email</label><input id="emE" name="email" class="input" type="email" value="${esc(u.email || '')}"></div><div class="field"><label for="emA">Account</label><select id="emA" name="active" class="select">${opt('yes', 'Active', u.active ? 'yes' : 'no')}${opt('no', 'Deactivated', u.active ? 'yes' : 'no')}</select></div></div>`,
      submit: 'Save changes', onSubmit: fd => { const n = (fd.get('name') || '').trim(); if (n.length < 3) throw new Error('Enter the member’s full name.'); API.editMember(u.id, { name: n, family: isVillageType() ? (fd.get('family') || '').trim() : '', kindred: isVillageType() ? (fd.get('kindred') || '').trim() : '', phone: (fd.get('phone') || '').trim(), email: (fd.get('email') || '').trim(), active: fd.get('active') }); done('Member updated.'); } });
  },
  'reset-pw'(el) {
    const u = userById(el.dataset.id), pw = 'Vv' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Reset password', sub: `${esc(u.name)} (${esc(u.id)})`, body: `<div class="field"><label for="rpP">New password</label><input id="rpP" name="password" class="input" type="text" value="${pw}" minlength="6" required><span class="hint">Tell the member this password. It is not stored in readable form.</span></div>`, submit: 'Reset password',
      onSubmit: async fd => { const p = fd.get('password') || ''; if (p.length < 6) throw new Error('The password needs at least 6 characters.'); await API.resetPassword(u.id, p); closeModal(); renderView(); credModal(u.id); } });
  },
  'add-exp'() { expModal(null); },
  'edit-exp'(el) { expModal(S.v.expenses.find(e => e.id === el.dataset.id)); },
  'void-exp'(el) {
    const e = S.v.expenses.find(x => x.id === el.dataset.id);
    openModal({ title: 'Void this expense?', danger: true, sub: `${esc(e.category)}: ${esc(e.description)}, ${money(e.amount)}`, body: `<div class="field"><label for="veR">Reason</label><textarea id="veR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Void expense',
      onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Write a short reason for voiding.'); API.voidExpense(e.id, r); done('Expense voided.'); } });
  },
  'export-tx'() { const rows = [['Record', 'Date', 'Member', 'Levy', 'Amount', 'Status', 'Reference', 'Method', 'Checked by', 'Checked at', 'Last updated by', 'Last updated at']]; filterTx(visibleTx(), S.f).forEach(t => rows.push([t.id, t.date, nameOf(t.memberId), levyOf(t.levy).name, t.amount, t.status, t.ref, t.method, t.verifiedBy || '', t.verifiedAt ? fmtTS(t.verifiedAt) : '', t.updatedBy || '', t.updatedAt ? fmtTS(t.updatedAt) : ''])); csvDownload(`${S.v.code}-records.csv`, rows); },
  'export-audit'() { requireAdmin(); const rows = [['When', 'Admin', 'Title', 'Action', 'Record', 'Details']]; S.v.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts)).forEach(a => rows.push([fmtTS(a.ts), a.adminName, a.adminTitle, a.action, a.target, a.detail])); csvDownload(`${S.v.code}-activity-log.csv`, rows); },
  'dl-report'(el) { downloadReport(el.dataset.kind, el.dataset.y, el.dataset.m, el.dataset.member); },
  'dl-current'() { const f = S.f, now = new Date(), scope = isAdmin() ? 'village' : (f.scope || 'statement'); downloadReport(f.kind || 'month', f.year || now.getFullYear(), f.month !== undefined && f.month !== '' ? f.month : now.getMonth(), scope === 'statement' ? S.u.id : ''); },
  'goto'(el) { goto(el.dataset.page); },
  'tab'(el) { S.tab = el.dataset.tab; S.f = {}; renderView(); },
  'page'(el) { S.f.page = (S.f.page || 1) + Number(el.dataset.dir); renderView(); },
  'logout'() { logout(); },
  'open-side'() { document.body.classList.add('side-open'); },
  'close-side'() { document.body.classList.remove('side-open'); },
  'home-link'(el, e) { e.preventDefault(); if (S.v || S.owner) goto(NAV[roleKey()][0][0]); },
  'close-modal'() { closeModal(); },
  'pick-village'(el) { pickVillage(el.dataset.village); },
  'focus-access'() { focusAccess(); },
  'close-owner'() { closeOwnerLogin(); },
  'owner-back'() { ownerBack(); },
  'upload-proof'() { uploadModal(); },
  'report-modal'(el) { reportModal(el.dataset.scope); },
  'change-pw'() { changePwModal(); },
  'toggle-pw'(el) { const i = el.parentElement.querySelector('input'); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show'; el.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); },
  'toggle-nav'(el) { const n = $('#nav'); const open = n.classList.toggle('open'); el.setAttribute('aria-expanded', String(open)); },
  'scroll'(el, e) { e.preventDefault(); const t = document.getElementById(el.dataset.target); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#nav').classList.remove('open'); },
  'demo-fill'(el) { $('#loginId').value = el.dataset.id; $('#loginPw').value = el.dataset.pw; $('#loginPw').type = 'text'; const tg = $('[data-act=toggle-pw]'); if (tg) tg.textContent = 'Hide'; }
};
function expModal(e) {
  e = e || {};
  openModal({ title: e.id ? 'Edit expense' : 'Record an expense', sub: 'Your name and the time are saved with this entry.',
    body: `<div class="form-row"><div class="field"><label for="exD">Date</label><input id="exD" name="date" class="input" type="date" max="${today()}" value="${esc(e.date || today())}" required></div><div class="field"><label for="exC">Category</label><select id="exC" name="category" class="select">${EXP_CATS.map(c => opt(c, c, e.category)).join('')}</select></div></div><div class="field"><label for="exDs">What was it for?</label><input id="exDs" name="description" class="input" maxlength="120" value="${esc(e.description || '')}" required></div><div class="field"><label for="exA">Amount (naira)</label><input id="exA" name="amount" class="input" type="number" min="1" value="${e.amount || ''}" required></div>`,
    submit: e.id ? 'Save changes' : 'Save expense',
    onSubmit: fd => { const d = { date: fd.get('date'), category: fd.get('category'), description: (fd.get('description') || '').trim(), amount: Number(fd.get('amount')) }; if (!d.date) throw new Error('Choose the date.'); if (d.description.length < 3) throw new Error('Describe what the money was spent on.'); if (!(d.amount > 0)) throw new Error('Enter an amount greater than zero.'); API.saveExpense(e.id || null, d); done(e.id ? 'Expense updated.' : 'Expense recorded.'); } });
}

/* ---------- Inline forms ---------- */
const FORMS = {
  levies(form) {
    const fd = new FormData(form), vals = {}, err = m => formError(m, 'formErr'); err('');
    for (const l of levies().filter(x => x.fixed)) { const n = Number(fd.get(l.id)); if (!(n >= 0) || fd.get(l.id) === '') return err(`Enter an amount for ${l.name}.`); vals[l.id] = n; }
    try { API.saveLevies(vals); toast('Levy amounts saved.', 'ok'); renderView(); } catch (e) { err(e.message); }
  }
};

/* ---------- Modals for member and shared actions ---------- */
function reportModal(scope) {
  const now = new Date(), village = scope === 'village';
  openModal({ title: village ? 'Download village report' : 'Download my statement', sub: village ? 'Collections and spending for the whole village.' : 'Your own verified payments for the period.', submit: 'Download PDF',
    body: `<div class="form-row"><div class="field"><label for="sKind">Period</label><select id="sKind" name="kind" class="select">${opt('month', 'Monthly', 'month')}${opt('year', 'Yearly', 'month')}</select></div>
    <div class="field"><label for="sYear">Year</label><select id="sYear" name="year" class="select">${yearOpts(String(now.getFullYear()))}</select></div></div>
    <div class="field"><label for="sMonth">Month</label><select id="sMonth" name="month" class="select">${MONTHS.map((m, i) => opt(i, m, now.getMonth())).join('')}</select></div>`,
    onSubmit: fd => { const kind = fd.get('kind'); downloadReport(kind, fd.get('year'), kind === 'year' ? 0 : (fd.get('month') || 0), village ? '' : S.u.id); closeModal(); } });
}
const pwField = (id, name, label, auto, hint) => `<div class="field"><label for="${id}">${label}</label><div class="pw"><input id="${id}" name="${name}" class="input" type="password" autocomplete="${auto}" required><button class="pw-toggle" type="button" data-act="toggle-pw" aria-label="Show password">Show</button></div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
function changePwModal(force) {
  openModal({ title: force === true ? 'Choose your own password' : 'Change password', sub: force === true ? 'You signed in with login details from your admin. Set a password only you know.' : '', body: pwField('pCur', 'cur', force === true ? 'Password you were sent' : 'Current password', 'current-password') + pwField('pNew', 'nw', 'New password', 'new-password', 'At least 6 characters.') + pwField('pNew2', 'nw2', 'Repeat new password', 'new-password'), submit: 'Save password',
    onSubmit: async fd => {
      const cur = fd.get('cur') || '', nw = fd.get('nw') || '';
      if (nw.length < 6) throw new Error('The new password needs at least 6 characters.');
      if (nw !== fd.get('nw2')) throw new Error('The two new passwords do not match.');
      if (S.owner) await OWNER_API.changePassword(cur, nw); else await API.changePassword(cur, nw);
      done('Password changed.');
    } });
}

/* ---------- Village access (landing page) ---------- */
let attempts = 0, lockUntil = 0;
function villageSelectHTML(sel) { return `<option value="" disabled${sel ? '' : ' selected'}>Select your village or association</option>` + signInList().map(v => opt(v.id, `${v.name} (${v.code})`, sel)).join(''); }
function fillVillageSelects() {
  $$('[data-village-select]').forEach(s => { s.innerHTML = villageSelectHTML(''); });
  const nav = $('#navVillage'); if (nav) nav.options[0].textContent = 'Village or association'; const g = $('#villageGrid'); if (g) g.innerHTML = liveVillages().map(v => {
    if (v.type === 'association') return `<button type="button" class="vcard" style="--vc:${v.color}" data-act="pick-village" data-village="${v.id}"><b>${esc(v.name)}</b><span>${esc(v.code)}, ${esc(v.tag)}</span><em>Open this association</em></button>`;
    const w = activeWings(v); if (!w.length) return '';
    return `<div class="vcard vcard-wings" style="--vc:${v.color}"><b>${esc(v.name)}</b><span>${esc(v.code)}, ${esc(v.tag)}</span><div class="vwings">${w.map(x => `<button type="button" class="vwing" data-act="pick-village" data-village="${x.id}">${esc(wingLabel(x.wing))}</button>`).join('')}</div></div>`; }).join('');
}
function pickVillage(id) {
  const v = vilById(id); if (!v) return;
  $$('[data-village-select]').forEach(s => { s.value = id; });
  $('#accessForm').hidden = false; formError('', 'loginError'); updateDemo();
  const box = $('#access'); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
  setTimeout(() => { const i = $('#loginId'); if (i) i.focus({ preventScroll: true }); }, 350);
  $('#nav').classList.remove('open');
  if (rememberedFor(id)) tryRemembered(id);
}
function focusAccess() { const sel = $('#heroVillage'); $('#access').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => sel.focus({ preventScroll: true }), 350); }
function updateDemo() {
  const box = $('#demoBox'), id = $('#heroVillage').value, v = vilById(id);
  if (!CONFIG.DEMO_MODE || !v) { box.hidden = true; return; }
  const c = v.code.toLowerCase(); box.hidden = false;
  box.innerHTML = `<b>Demo access for ${esc(v.name)}</b><br>Admin: <code>${v.code}-A02</code> password <code>${c}-admin</code><br>Member: <code>${v.code}-M001</code> password <code>${c}-member</code><div class="demo-btns"><button type="button" class="btn btn-ghost btn-sm" data-act="demo-fill" data-id="${v.code}-A02" data-pw="${c}-admin">Fill admin</button><button type="button" class="btn btn-ghost btn-sm" data-act="demo-fill" data-id="${v.code}-M001" data-pw="${c}-member">Fill member</button></div>`;
}
const CONTACT_MSG = 'Enter correct details or contact admin.';
const failKey = (vid, uid) => `vv_fail_${vid}_${uid}`;
function failState(vid, uid) {   // kept in the browser's long-term storage so a new tab cannot reset it; repeat lockouts get longer
  let s = { n: 0, until: 0, k: 0, last: 0 }; try { s = Object.assign(s, JSON.parse(lsGet(failKey(vid, uid)) || 'null') || {}); } catch (_) {}
  if (s.last && Date.now() - s.last > 3600000) s = { n: 0, until: 0, k: 0, last: 0 }; return s;
}
const failSave = (vid, uid, s) => { s.last = Date.now(); lsSet(failKey(vid, uid), JSON.stringify(s)); };
const failClear = (vid, uid) => { delete mem[failKey(vid, uid)]; try { localStorage.removeItem(failKey(vid, uid)); } catch (_) {} };
const lockSecs = k => Math.min(900, CONFIG.LOCK_SECONDS * Math.pow(5, Math.max(0, k - 1)));

/* Remember me: a random token is saved on this device and on the member's record (never the password).
   Choosing the village again signs that member straight in. */
const remKey = vid => 'vv_rem_' + vid;
function rememberedFor(vid) { try { const r = JSON.parse(lsGet(remKey(vid)) || 'null'); return r && r.u && r.t ? r : null; } catch (_) { return null; } }
function newToken() { try { return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join(''); } catch (_) { return String(Math.random()).slice(2) + String(Date.now()); } }
function makeRemember(v, u) { const t = newToken(); u.rememberTokens = (u.rememberTokens || []).slice(-4).concat(t); DB.save(v); lsSet(remKey(v.id), JSON.stringify({ u: u.id, t })); }
function forgetRemember(vid, v) {
  const r = rememberedFor(vid); try { localStorage.removeItem(remKey(vid)); } catch (_) {} delete mem[remKey(vid)];
  if (r && v) { const u = v.users.find(x => x.id === r.u); if (u) { u.rememberTokens = (u.rememberTokens || []).filter(x => x !== r.t); DB.save(v); } }
}
async function tryRemembered(vid) {
  const r = rememberedFor(vid), vil = vilById(vid); if (!r || !vil || vil.removed) return false;
  try {
    const v = await DB.load(vid), u = v.users.find(x => x.id === r.u);
    if (!u || !u.active || v.status === 'suspended' || !(u.rememberTokens || []).includes(r.t)) { forgetRemember(vid, v); return false; }
    ssSet('vv_sess', JSON.stringify({ v: vid, u: u.id })); enterApp(v, u, true); return true;
  } catch (_) { return false; }
}

async function doLogin(e) {
  e.preventDefault(); const fd = new FormData(e.target), err = m => formError(m, 'loginError'); err('');
  const vid = $('#heroVillage').value, uid = (fd.get('id') || '').trim().toUpperCase(), pw = fd.get('pw') || '', remember = !!fd.get('remember');
  if (!vid) return err('Choose your village or association first.'); if (!uid) return err('Enter your member or admin ID.'); if (!pw) return err('Enter your password.');
  const fs = failState(vid, uid);
  if (Date.now() < fs.until) return err(CONTACT_MSG);
  const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Opening...';
  try {
    const vil = vilById(vid); if (!vil || vil.removed) throw new Error('This village or association is no longer on VillageVault. Contact your admin.');
    const v = await DB.load(vid), u = v.users.find(x => x.id === uid || (x.username && x.username.toUpperCase() === uid)), h = u ? await hashPw(vid, u.id, pw) : null;
    if (!u || u.hash !== h) {
      fs.n = (fs.n || 0) + 1;
      if (fs.n >= CONFIG.MAX_ATTEMPTS) { fs.n = 0; fs.k = (fs.k || 0) + 1; fs.until = Date.now() + lockSecs(fs.k) * 1000; failSave(vid, uid, fs); throw new Error(CONTACT_MSG); }
      failSave(vid, uid, fs); const left = CONFIG.MAX_ATTEMPTS - fs.n;
      throw new Error(`That ID and password do not match this village. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
    }
    if (v.status === 'suspended') throw new Error('Access is paused for this village or association. Contact VillageVault support.');
    if (!u.active) throw new Error('This account is deactivated. Contact your admin.');
    failClear(vid, uid);
    if (remember) makeRemember(v, u); else forgetRemember(vid, v);
    ssSet('vv_sess', JSON.stringify({ v: vid, u: u.id })); e.target.reset(); enterApp(v, u);
  } catch (ex) { err(ex.message || 'Could not open the dashboard.'); } finally { btn.disabled = false; btn.textContent = 'Open my dashboard'; }
}
function enterApp(v, u, auto) {
  S.v = v; S.u = u; S.owner = false; S.page = 'overview'; S.f = {}; S.tab = 'collections';
  $('#site').hidden = true; $('#app').hidden = false; renderApp(); window.scrollTo(0, 0); toast(auto ? `Welcome back, ${u.name}.` : `Welcome, ${u.name}.`, 'ok');
  if (u.mustChange) setTimeout(() => changePwModal(true), 300);
}
function logout() {
  ssDel('vv_sess'); S.v = null; S.u = null; S.owner = false; closeModal(); document.body.classList.remove('side-open');
  $('#app').hidden = true; $('#app').innerHTML = ''; $('#site').hidden = false; window.scrollTo(0, 0);
  if (location.hash === '#owner') history.replaceState(null, '', location.pathname + location.search);
  $$('[data-village-select]').forEach(s => { s.value = ''; }); $('#accessForm').hidden = true; $('#demoBox').hidden = true;
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (el) {
    const fn = ACTIONS[el.dataset.act]; if (fn) { try { fn(el, e); } catch (ex) { if (ex && ex.upgrade && typeof upgradeModal === 'function') upgradeModal(ex.feature); else toast(ex.message || 'Something went wrong.', 'err'); } }
    return;
  }
  if (e.target.id === 'modalRoot') closeModal();
  if (e.target.id === 'ownerModal') closeOwnerLogin();
});
let renderQueued = false;
function renderSoon() { if (renderQueued) return; renderQueued = true; setTimeout(() => { renderQueued = false; if (S.v || S.owner) renderView(); }, 0); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches && t.matches('[data-village-select]')) { if (t.value) pickVillage(t.value); return; }
  if (t.matches && t.matches('[data-filter]')) { if (t.type === 'search') return; S.f[t.dataset.filter] = t.value; S.f.page = 1; renderSoon(); return; }
  if (t.matches && t.matches('[data-amount-source]')) { const L = levyOf(t.value), a = $('#uAmt'); if (a && S.v) a.value = L.fixed ? S.v.settings.levies[L.id] : ''; return; }
  if (t.id === 'sKind') { const m = $('#sMonth'); if (m) m.disabled = t.value === 'year'; return; }
  if (t.id === 'spScope' || t.id === 'spWeeks') updateSponsorForm();
});
document.addEventListener('input', e => { const t = e.target; if (t.matches && t.matches('[data-filter][type=search]')) { S.f[t.dataset.filter] = t.value; S.f.page = 1; renderSoon(); } });
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.matches('#accessForm')) return doLogin(e);
  if (f.matches('#ownerForm')) return doOwnerLogin(e);
  if (f.matches('#mForm')) {
    e.preventDefault(); if (!MODAL.onSubmit) return closeModal();
    const btn = $('#mSubmit'); if (btn) btn.disabled = true; formError('');
    try { await MODAL.onSubmit(new FormData(f), f); } catch (ex) { formError(ex.message || 'Something went wrong.'); if (btn) btn.disabled = false; }
    return;
  }
  if (f.dataset && f.dataset.form) { e.preventDefault(); try { await FORMS[f.dataset.form](f); } catch (ex) { toast(ex.message, 'err'); } }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#modalRoot').hidden) closeModal(); else if (!$('#ownerModal').hidden) closeOwnerLogin(); else document.body.classList.remove('side-open');
});
window.addEventListener('scroll', () => { const n = $('#nav'); if (n) n.classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });
/* Routes: #owner opens the hidden owner sign-in. #/super-admin/sponsors opens the owner's sponsor page.
   Anyone who is not the platform owner is sent back to the start page. */
function handleRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'super-admin/sponsors') {
    if (platformOwnerCheck()) { S.v = null; S.u = null; if ($('#app').hidden) { $('#site').hidden = true; $('#app').hidden = false; } S.page = 'o-sponsors'; S.f = {}; renderApp(); }
    else history.replaceState(null, '', location.pathname + location.search);
  } else if (h === 'owner' && !S.v && !S.owner) openOwnerLogin();
}
window.addEventListener('hashchange', handleRoute);

/* ---------- Start ---------- */
async function init() {
  $('#year').textContent = `\u00A9 ${new Date().getFullYear()} VillageVault. Each village's records stay private to that village.`;
  fillVillageSelects();
  try {
    const raw = ssGet('vv_sess');
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess.owner) { await OWN.load(); await enterOwner(true); }
      else { const v = await DB.load(sess.v), u = v.users.find(x => x.id === sess.u); if (u && u.active && v.status !== 'suspended') { S.v = v; S.u = u; S.page = 'overview'; $('#site').hidden = true; $('#app').hidden = false; renderApp(); } else ssDel('vv_sess'); }
    }
  } catch (_) { ssDel('vv_sess'); }
  handleRoute();
}
/* ---------------------------------------------------------
   Going live: the DB and OWN objects are the only places data is
   read or written. Replace DB.load / DB.save, OWN.load / OWN.save and
   the password checks in doLogin / doOwnerLogin with calls to your
   server (for example Supabase or Firebase). Enforce "one village per
   user" and "owner only" with row-level security so isolation is
   guaranteed on the server, not just in the browser.
   --------------------------------------------------------- */
