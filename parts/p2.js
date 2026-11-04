
/* ---------- App state ---------- */
const S = { v: null, u: null, page: 'overview', f: {}, tab: 'collections', owner: false };
const isAdmin = () => !!S.u && S.u.role === 'admin';
const userById = id => S.v.users.find(u => u.id === id);
const nameOf = id => (userById(id) || { name: 'Former member' }).name;

/* ---------- Permission-checked data operations ---------- */
const isReadonly = () => !!S.v && S.v.status === 'readonly' && !S.owner;
function requireWritable() { if (isReadonly()) throw new Error('This village is in read-only mode right now. Contact VillageVault support.'); }
function requireAdmin() { if (!S.u || S.u.role !== 'admin' || !S.u.active) throw new Error('Only a village admin can do this.'); requireWritable(); }
function log(action, target, detail) {
  REV++;
  // Anything the owner does inside a village goes to the owner's private log only, so villages never see it.
  if (S.owner) { olog(action, S.v.name, `${target}: ${detail}`); OWN.save(); return; }
  S.v.seq.aud = (S.v.seq.aud || 0) + 1;
  S.v.audit.push({ id: 'L' + S.v.seq.aud, ts: stamp(), adminId: S.u.id, adminName: S.u.name, adminTitle: S.u.title, action, target, detail });
}
let REV = 0;
function commit() { REV++; if (!DB.save(S.v)) warnStorage(); }
function nextId(kind, prefix) { S.v.seq[kind] = (S.v.seq[kind] || 0) + 1; return `${S.v.code}-${prefix}${String(S.v.seq[kind]).padStart(prefix === 'T' ? 4 : 3, '0')}`; }

const visibleTx = () => isAdmin() ? S.v.tx : S.v.tx.filter(t => t.memberId === S.u.id);
const myTx = () => S.v.tx.filter(t => t.memberId === S.u.id);
/* Verified payments, indexed once per change and per member (was re-filtered for every member on every render). */
const TXC = { v: null, rev: -1, len: -1, ver: [], byM: new Map() };
function txIndex() {
  const tx = S.v.tx; if (TXC.v === S.v && TXC.rev === REV && TXC.len === tx.length) return TXC;
  TXC.v = S.v; TXC.rev = REV; TXC.len = tx.length; TXC.ver = []; TXC.byM = new Map();
  for (let i = 0; i < tx.length; i++) { const t = tx[i]; if (t.status !== 'verified') continue; TXC.ver.push(t); let a = TXC.byM.get(t.memberId); if (!a) TXC.byM.set(t.memberId, a = []); a.push(t); }
  return TXC;
}
const villageTx = () => txIndex().ver.slice();
const activeExp = () => S.v.expenses.filter(e => e.status !== 'void');
const pendingTx = () => S.v.tx.filter(t => t.status === 'pending');
const getTx = id => { const t = S.v.tx.find(x => x.id === id); if (!t) throw new Error('Record not found.'); if (!isAdmin() && t.memberId !== S.u.id) throw new Error('You can only open your own records.'); return t; };

const TX_FIELDS = { memberId: 'Member', levy: 'Levy', amount: 'Amount', date: 'Payment date', method: 'Method', ref: 'Reference', status: 'Status', note: 'Note' };
function showVal(field, v) {
  if (field === 'memberId') return nameOf(v);
  if (field === 'levy') return levyOf(v).name;
  if (field === 'amount') return money(v);
  if (field === 'date') return fmtDate(v);
  return v === '' || v == null ? 'blank' : String(v);
}
function diffTx(a, b) { return Object.keys(TX_FIELDS).filter(k => String(a[k] == null ? '' : a[k]) !== String(b[k] == null ? '' : b[k])).map(k => ({ field: k, from: a[k], to: b[k] })); }
const changeText = ch => ch.map(c => `${TX_FIELDS[c.field]}: ${showVal(c.field, c.from)} to ${showVal(c.field, c.to)}`).join('; ');

function stampUpdate(rec, changes, kind) {
  rec.updatedBy = S.u.name; rec.updatedById = S.u.id; rec.updatedAt = stamp();
  rec.history = rec.history || [];
  rec.history.push({ ts: rec.updatedAt, by: S.u.name, byTitle: S.u.title, kind, text: changes });
}

const API = {
  submitProof(d) {
    if (isAdmin()) throw new Error('Admins record payments from the Transactions page.');
    requireWritable();
    const t = { id: nextId('tx', 'T'), memberId: S.u.id, levy: d.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref, note: d.note || '', status: 'pending', proof: d.proof, submittedAt: stamp(), submittedBy: S.u.name, updatedBy: null, updatedAt: null, history: [] };
    S.v.tx.push(t); commit(); return t;
  },
  verify(id, amount, note) {
    requireAdmin(); const t = getTx(id);
    if (t.status !== 'pending') throw new Error('Only pending payments can be verified.');
    if (t.memberId === S.u.id) throw new Error('You cannot verify your own payment. Another admin must verify it.');
    const changes = []; if (Number(amount) !== Number(t.amount)) { changes.push(`Amount corrected from ${money(t.amount)} to ${money(amount)}`); t.amount = Number(amount); }
    if (note) t.note = note;
    t.status = 'verified'; t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); delete t.rejectReason;
    stampUpdate(t, ['Verified payment'].concat(changes).join('. '), 'verify');
    log('Verified payment', t.id, `${levyOf(t.levy).name} ${money(t.amount)} from ${nameOf(t.memberId)}${changes.length ? ' (' + changes.join('; ') + ')' : ''}`);
    commit(); return t;
  },
  reject(id, reason) {
    requireAdmin(); const t = getTx(id);
    if (t.status !== 'pending') throw new Error('Only pending payments can be rejected.');
    if (t.memberId === S.u.id) throw new Error('You cannot reject your own payment. Another admin must review it.');
    t.status = 'rejected'; t.rejectReason = reason; t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp();
    stampUpdate(t, 'Rejected: ' + reason, 'reject');
    log('Rejected payment', t.id, `${levyOf(t.levy).name} ${money(t.amount)} from ${nameOf(t.memberId)}: ${reason}`);
    commit(); return t;
  },
  addTx(d) {
    requireAdmin(); if (d.memberId === S.u.id && d.status === 'verified') throw new Error('You cannot record your own payment as verified. Upload your proof so another admin can verify it.');
    const t = { id: nextId('tx', 'T'), memberId: d.memberId, levy: d.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref, note: d.note || '', status: d.status, proof: d.proof || null, submittedAt: stamp(), submittedBy: S.u.name + ' (admin entry)', updatedBy: null, updatedAt: null, history: [] };
    if (t.status === 'verified') { t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); }
    S.v.tx.push(t);
    stampUpdate(t, `Recorded by admin as ${t.status}`, 'create');
    log('Added payment record', t.id, `${levyOf(t.levy).name} ${money(t.amount)} for ${nameOf(t.memberId)} (${t.status})`);
    commit(); return t;
  },
  editTx(id, d) {
    requireAdmin(); const t = getTx(id); const before = Object.assign({}, t); if (t.memberId === S.u.id && d.status === 'verified' && before.status !== 'verified') throw new Error('You cannot verify your own payment. Another admin must do it.');
    ['memberId', 'levy', 'amount', 'date', 'method', 'ref', 'note', 'status'].forEach(k => { t[k] = d[k]; });
    const ch = diffTx(before, t); if (!ch.length && !d.proof) throw new Error('Nothing was changed.');
    if (d.proof) t.proof = d.proof;
    if (t.status === 'verified' && before.status !== 'verified') { t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); delete t.rejectReason; }
    if (t.status === 'rejected') { t.rejectReason = d.reason || t.rejectReason || 'Rejected by admin'; t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); }
    const txt = (changeText(ch) || '') + (d.proof ? (ch.length ? '; ' : '') + 'Proof file replaced' : '');
    stampUpdate(t, txt, 'edit'); log('Edited payment record', t.id, txt); commit(); return t;
  },
  voidTx(id, reason) {
    requireAdmin(); const t = getTx(id); if (t.status === 'void') throw new Error('This record is already void.');
    const was = t.status; t.status = 'void'; t.voidReason = reason; t.voidedBy = S.u.name; t.voidedAt = stamp();
    stampUpdate(t, `Voided (was ${was}): ${reason}`, 'void');
    log('Voided payment record', t.id, `${levyOf(t.levy).name} ${money(t.amount)} for ${nameOf(t.memberId)}: ${reason}`); commit(); return t;
  },
  addMember(d) {
    requireAdmin(); if (capReached()) throw new Error(`The Basic plan covers up to ${basicCap()} members here. Upgrade to Premium to add more.`);
    const id = nextId('mbr', 'M'); return hashPw(S.v.id, id, d.password).then(h => {
      const u = { id, name: d.name, role: 'member', title: 'Member', family: d.family || '', kindred: d.kindred || '', phone: d.phone, email: d.email || '', joined: today(), active: true, hash: h, mustChange: true, tempPw: d.password, createdBy: S.u.name, createdAt: stamp() };
      S.v.users.push(u); S.v.credLog.push({ memberId: id, by: S.u.name, at: stamp(), kind: 'issued' }); log('Added member', id, `${u.name}${kinOf(u) ? ' (' + kinOf(u) + ')' : ''}`); commit(); return u;
    });
  },
  editMember(id, d) {
    requireAdmin(); const u = userById(id); if (!u || u.role !== 'member') throw new Error('Member not found.');
    const ch = []; ['name', 'family', 'kindred', 'phone', 'email'].forEach(k => { if ((u[k] || '') !== (d[k] || '')) { ch.push(`${cap(k)}: ${u[k] || 'blank'} to ${d[k] || 'blank'}`); u[k] = d[k]; } });
    const act = d.active === 'yes'; if (act !== u.active) { ch.push(act ? 'Account activated' : 'Account deactivated'); u.active = act; }
    if (!ch.length) throw new Error('Nothing was changed.');
    u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Edited member', id, `${u.name}: ${ch.join('; ')}`); commit(); return u;
  },
  resetPassword(id, pw) {
    requireAdmin(); const u = userById(id); if (!u) throw new Error('Member not found.');
    return hashPw(S.v.id, u.id, pw).then(h => { u.hash = h; u.mustChange = true; u.tempPw = pw; u.rememberTokens = []; S.v.credLog.push({ memberId: u.id, by: S.u.name, at: stamp(), kind: 'reset' }); u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Reset member password', id, `Password reset for ${u.name}`); commit(); });
  },
  saveExpense(id, d) {
    requireAdmin();
    if (!id) {
      const e = { id: nextId('exp', 'E'), date: d.date, category: d.category, description: d.description, amount: d.amount, status: 'active', createdBy: S.u.name, createdById: S.u.id, createdAt: stamp(), updatedBy: null, updatedAt: null };
      S.v.expenses.push(e); log('Recorded expense', e.id, `${e.category}: ${e.description}, ${money(e.amount)}`); commit(); return e;
    }
    const e = S.v.expenses.find(x => x.id === id); if (!e) throw new Error('Expense not found.');
    const ch = []; ['date', 'category', 'description', 'amount'].forEach(k => { if (String(e[k]) !== String(d[k])) { ch.push(`${cap(k)}: ${k === 'amount' ? money(e[k]) + ' to ' + money(d[k]) : e[k] + ' to ' + d[k]}`); e[k] = k === 'amount' ? Number(d[k]) : d[k]; } });
    if (!ch.length) throw new Error('Nothing was changed.');
    e.updatedBy = S.u.name; e.updatedAt = stamp(); log('Edited expense', e.id, ch.join('; ')); commit(); return e;
  },
  voidExpense(id, reason) {
    requireAdmin(); const e = S.v.expenses.find(x => x.id === id); if (!e) throw new Error('Expense not found.');
    e.status = 'void'; e.voidReason = reason; e.updatedBy = S.u.name; e.updatedAt = stamp();
    log('Voided expense', e.id, `${e.category}: ${e.description}, ${money(e.amount)}. Reason: ${reason}`); commit();
  },
  saveLevies(vals) {
    requireAdmin(); const ch = [];
    levies().filter(l => l.fixed).forEach(l => { const o = S.v.settings.levies[l.id], n = Number(vals[l.id]); if (o !== n) { ch.push(`${l.name}: ${money(o)} to ${money(n)}`); S.v.settings.levies[l.id] = n; } });
    if (!ch.length) throw new Error('No amounts were changed.');
    log('Changed levy amounts', 'Settings', ch.join('; ')); commit();
  },
  issueReceipt(id) {
    requireAdmin(); const t = getTx(id);
    if (t.status !== 'verified') throw new Error('Receipts are only issued for verified payments.');
    if (!t.receiptNo) {
      S.v.seq.rct = (S.v.seq.rct || 0) + 1;
      t.receiptNo = `RCT-${S.v.code}-${new Date().getFullYear()}-${String(S.v.seq.rct).padStart(4, '0')}`; t.receiptBy = S.u.name; t.receiptById = S.u.id; t.receiptAt = stamp();
      log('Issued receipt', t.id, `${t.receiptNo}: ${levyOf(t.levy).name} ${money(t.amount)} for ${nameOf(t.memberId)}`); commit();
    }
    return t;
  },
  async changePassword(cur, nw) {
    const h = await hashPw(S.v.id, S.u.id, cur); if (h !== S.u.hash) throw new Error('Your current password is not correct.');
    S.u.hash = await hashPw(S.v.id, S.u.id, nw); S.u.mustChange = false; delete S.u.tempPw; S.u.rememberTokens = []; if (isAdmin()) log('Changed own password', S.u.id, 'Admin changed their password'); commit();
  }
};

/* ---------- Money helpers ---------- */
function memberPaid(id, year) { return (txIndex().byM.get(id) || []).filter(t => yearOf(t.date) === year); }
function memberOutstanding(id, year) {
  const paid = memberPaid(id, year); let o = 0;
  levies().filter(l => l.fixed).forEach(l => { o += Math.max(0, (S.v.settings.levies[l.id] || 0) - sum(paid.filter(t => t.levy === l.id))); });
  return o + pledgeOwedOf(id);
}
// What a member owes, levy by levy (only verified payments count, so it updates by itself once an admin verifies)
// A pledge that is not fully paid is an outstanding debt, like an unpaid levy.
const pledgeOwedOf = id => (S.v.pledges || []).filter(p => p.memberId === id && p.status !== 'cancelled').reduce((a, p) => a + Math.max(0, p.amount - sum(S.v.tx.filter(t => t.pledgeId === p.id && t.status === 'verified'))), 0);
function owingRowsAll(id, yr) {
  const pl = (S.v.pledges || []).filter(p => p.memberId === id && p.status !== 'cancelled').map(p => { const paid = sum(S.v.tx.filter(t => t.pledgeId === p.id && t.status === 'verified')); return { L: { id: 'P:' + p.id, name: 'Pledge: ' + p.purpose, color: '#B8860B' }, need: p.amount, paid, owe: Math.max(0, p.amount - paid), pledge: true, pledgeId: p.id }; }).filter(r => r.owe > 0);
  return owingRows(id, yr).concat(pl);
}
function owingRows(id, yr) {
  const paid = memberPaid(id, yr);
  return levies().filter(l => l.fixed).map(l => { const need = S.v.settings.levies[l.id] || 0, p = sum(paid.filter(t => t.levy === l.id)); return { L: l, need, paid: p, owe: Math.max(0, need - p) }; });
}
const expectedPerMember = () => levies().filter(l => l.fixed).reduce((a, l) => a + (S.v.settings.levies[l.id] || 0), 0);
function monthlySeries(txs, months = 12) {
  const out = [], now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1), key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    out.push({ label: MON[d.getMonth()], title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, value: sum(txs.filter(t => t.date.slice(0, 7) === key)) });
  }
  return out;
}

/* ---------- Icons ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  village: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
  upload: '<path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v4h16v-4"/>',
  file: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c2.4.6 4 2.2 4 5.2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9 9h5a2 2 0 010 4H9m0 0h5.5a2 2 0 010 4H9M9 7v10"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M9 7h6M9 11h6"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

/* ---------- Toasts and modals ---------- */
function toast(msg, kind) {
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
  const box = $('#toasts'); while (box.children.length >= 3) box.firstChild.remove();
  box.appendChild(el); setTimeout(() => { el.remove(); }, kind === 'err' ? 6000 : 3600);
}
const MODAL = { onSubmit: null, opener: null };
function openModal(o) {
  const root = $('#modalRoot'); MODAL.opener = document.activeElement; MODAL.onSubmit = o.onSubmit || null;
  root.hidden = false; document.body.classList.add('no-scroll');
  root.innerHTML = `<div class="modal ${o.size || ''}" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <button class="icon-btn modal-x" type="button" data-act="close-modal" aria-label="Close">&#10005;</button>
    <h2 id="mTitle">${esc(o.title)}</h2>${o.sub ? `<p class="muted">${o.sub}</p>` : ''}
    <form id="mForm" novalidate>${o.body}
      <div class="form-error" id="mError" role="alert" hidden></div>
      <div class="modal-foot"><button type="button" class="btn btn-ghost" data-act="close-modal">${o.submit === false ? 'Close' : 'Cancel'}</button>${o.submit === false ? '' : `<button type="submit" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" id="mSubmit">${esc(o.submit || 'Save')}</button>`}</div>
    </form></div>`;
  const first = $('#mForm input:not([type=hidden]),#mForm select,#mForm textarea', root); if (first) first.focus({ preventScroll: true });
  bindFileInputs(root);
}
function closeModal() {
  const root = $('#modalRoot'); root.hidden = true; root.innerHTML = ''; MODAL.onSubmit = null;
  if (!$('#loginModal') || $('#loginModal').hidden) document.body.classList.remove('no-scroll');
  if (MODAL.opener && MODAL.opener.focus && document.contains(MODAL.opener)) { try { MODAL.opener.focus(); } catch (_) {} }
}
function formError(msg, id = 'mError') { const el = $('#' + id); if (!el) return; el.textContent = msg; el.hidden = !msg; }

/* ---------- Form pieces ---------- */
const opt = (v, l, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`;
const levyOpts = (sel, all) => (all ? opt('', all, sel) : '') + levyAll().filter(l => !l.removed || l.id === sel).map(l => opt(l.id, l.name + (l.removed ? ' (removed)' : ''), sel)).join('');
const methodOpts = sel => METHODS.map(m => opt(m, m, sel)).join('');
const isVillageType = () => !S.v || S.v.type !== 'association';
const kinOf = u => [u && u.family, u && u.kindred].filter(Boolean).join(', ');
const kindredOpts = (sel, all) => (all ? opt('', all, sel) : '') + Array.from(new Set(S.v.users.map(u => u.kindred).filter(Boolean))).sort().map(k => opt(k, k, sel)).join('');
/* Basic plan: a village has 20 members in total, 10 in the Men's Wing and 10 in the Women's Wing. An association has 10 and no wings. */
const MEMBER_CAP = 20, WING_CAP = 10, ASSOC_CAP = 10;
const basicCap = () => (S.v && S.v.type === 'association') ? ASSOC_CAP : (S.v && S.v.wing) ? WING_CAP : MEMBER_CAP;
const activeMembers = () => S.v.users.filter(u => u.role === 'member' && u.active).length, capReached = () => S.v.plan !== 'premium' && activeMembers() >= basicCap();
const orgWord = () => (S.v && S.v.type === 'association') ? 'Association' : 'Village';
const balLabel = () => orgWord() + ' balance' + ((S.v && S.v.wing) ? ` (${wingLabel(S.v.wing)})` : '');
const capWords = () => (S.v && S.v.type === 'association') ? `${ASSOC_CAP} members` : (S.v && S.v.wing) ? `${WING_CAP} members in each wing` : `${MEMBER_CAP} members, ${WING_CAP} in each wing`;
const memberOpts = (sel, all, onlyActive) => (all ? opt('', all, sel) : '') + S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && (!onlyActive || u.active || u.id === sel)).map(u => opt(u.id, `${u.name} (${u.id})`, sel)).join('');
function yearOpts(sel, all) {
  const ys = new Set([new Date().getFullYear()]); S.v.tx.forEach(t => ys.add(yearOf(t.date))); S.v.expenses.forEach(e => ys.add(yearOf(e.date)));
  return (all ? opt('', all, sel) : '') + Array.from(ys).sort((a, b) => b - a).map(y => opt(y, y, sel)).join('');
}
const fileField = (label, kind) => `<div class="field"><label class="lbl" for="fProof">${label}</label>
  <label class="drop" for="fProof"><input type="file" id="fProof" name="proof" accept="${kind === 'logo' ? 'image/png,image/jpeg,image/webp' : 'image/*,application/pdf'}"><b>${kind === 'logo' ? 'Choose a logo image' : 'Choose a photo or PDF'}</b><small>${kind === 'logo' ? 'Square works best. PNG or JPG.' : 'Photo of the bank slip or a screenshot. Large photos are shrunk automatically.'}</small></label>
  <div class="preview" id="proofPrev" hidden></div></div>`;
function bindFileInputs(root) {
  $$('input[type=file]', root).forEach(inp => inp.addEventListener('change', async () => {
    const box = $('#proofPrev', root); if (!box) return; const f = inp.files && inp.files[0];
    if (!f) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (f.type === 'application/pdf') box.innerHTML = `<div class="pdfnote">PDF selected: ${esc(f.name)}</div>`;
    else if (f.type.startsWith('image/')) { const u = URL.createObjectURL(f); box.innerHTML = `<img src="${u}" alt="Selected proof of payment">`; }
    else box.innerHTML = `<div class="pdfnote">This file type is not supported.</div>`;
  }));
}
function fileToDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsDataURL(f); }); }
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That image could not be opened.')); i.src = src; }); }
async function readProof(file) {
  if (!file || !file.size) return null;
  const isPdf = file.type === 'application/pdf';
  if (!isPdf && !/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Upload a photo (JPG, PNG or WEBP) or a PDF.');
  if (isPdf) {
    if (file.size > CONFIG.MAX_PDF_KB * 1024) throw new Error(`That PDF is too large. Keep it under ${CONFIG.MAX_PDF_KB} KB, or upload a photo of the slip instead.`);
    return { name: file.name, type: file.type, data: await fileToDataURL(file) };
  }
  const img = await loadImg(await fileToDataURL(file));
  const k = Math.min(1, CONFIG.MAX_IMAGE_PX / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return { name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', data: c.toDataURL('image/jpeg', .72) };
}
function proofHTML(p) {
  if (!p) return '<div class="proof-view"><div class="none">No proof file is attached to this record.</div></div>';
  if (p.seed) return '<div class="proof-view"><div class="none">Sample record. No proof file is stored for demo data.</div></div>';
  if (p.type === 'application/pdf') return `<div class="proof-view"><iframe title="Proof of payment" src="${p.data}"></iframe></div><p class="hint" style="margin-top:6px"><a href="${p.data}" download="${esc(p.name)}">Download the PDF</a></p>`;
  return `<div class="proof-view"><img src="${p.data}" alt="Proof of payment"></div>`;
}

/* ---------- Table, badges, charts ---------- */
const badge = s => `<span class="badge b-${esc(s)}">${esc(cap(s))}</span>`;
function table(heads, rows, empty) {
  if (!rows.length) return `<div class="tablewrap"><div class="empty"><b>${esc(empty[0])}</b>${esc(empty[1] || '')}</div></div>`;
  return `<div class="tablewrap"><table class="t"><thead><tr>${heads.map(h => `<th scope="col"${h.num ? ' class="num"' : ''}>${esc(h.t != null ? h.t : h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${heads[i] && heads[i].num ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pager(total, page, per) {
  const pages = Math.max(1, Math.ceil(total / per)); if (total <= per) return `<div class="pager"><span>${total} record${total === 1 ? '' : 's'}</span></div>`;
  return `<div class="pager"><span>Showing ${(page - 1) * per + 1} to ${Math.min(total, page * per)} of ${total}</span><div><button class="btn btn-ghost btn-sm" type="button" data-act="page" data-dir="-1"${page <= 1 ? ' disabled' : ''}>Previous</button><button class="btn btn-ghost btn-sm" type="button" data-act="page" data-dir="1"${page >= pages ? ' disabled' : ''}>Next</button></div></div>`;
}
const paginate = (arr, f) => { const per = CONFIG.PER_PAGE, pages = Math.max(1, Math.ceil(arr.length / per)); f.page = Math.min(Math.max(1, f.page || 1), pages); return arr.slice((f.page - 1) * per, f.page * per); };
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; }
function barChart(data) {
  const W = 600, H = 230, pl = 52, pb = 28, pt = 12, pr = 8, max = niceMax(Math.max(1, ...data.map(d => d.value))), bw = (W - pl - pr) / data.length;
  let g = '';
  for (let i = 0; i <= 3; i++) { const y = pt + (H - pt - pb) * (1 - i / 3); g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="#E6ECE9"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end">${short(max * i / 3)}</text>`; }
  data.forEach((d, i) => {
    const h = (H - pt - pb) * d.value / max, x = pl + i * bw + bw * .18, y = H - pb - h;
    g += `<rect class="bar-r" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${Math.max(h, d.value ? 2 : 0).toFixed(1)}" rx="5"><title>${esc(d.title || d.label)}: ${money(d.value)}</title></rect><text x="${(x + bw * .32).toFixed(1)}" y="${H - 9}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Collections by month">${g}</svg>`;
}
function donut(parts) {
  const total = sum(parts, 'value'); if (!total) return `<div class="empty"><b>No verified payments yet</b>Totals appear here after the first verification.</div>`;
  let acc = 0, segs = '';
  parts.filter(p => p.value > 0).forEach(p => { const pc = p.value / total * 100; segs += `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${p.color}" stroke-width="6" stroke-dasharray="${pc.toFixed(3)} ${(100 - pc).toFixed(3)}" stroke-dashoffset="${(25 - acc).toFixed(3)}"><title>${esc(p.label)}: ${money(p.value)}</title></circle>`; acc += pc; });
  const legend = parts.map(p => `<span><i class="dot" style="background:${p.color}"></i>${esc(p.label)} <b style="color:var(--indigo)">${money(p.value)}</b></span>`).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 42 42" width="150" height="150" role="img" aria-label="Income by levy"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E6ECE9" stroke-width="6"/>${segs}<text x="21" y="22" text-anchor="middle" font-size="5.2" font-weight="800" fill="#1A1A4E">${short(total)}</text><text x="21" y="27" text-anchor="middle" font-size="2.6" fill="#5B5F7A">verified</text></svg><div class="legend" style="flex-direction:column;margin:0">${legend}</div></div>`;
}
const kpiLink = (act, l, v, s, tone, extra) => `<button type="button" class="kpi click ${tone || ''}" data-act="${act}"${extra || ''}><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div>${s ? `<div class="kpi-s">${s}</div>` : ''}<span class="kpi-go" aria-hidden="true">View details &rsaquo;</span></button>`;
const kpi = (l, v, s, tone) => `<div class="kpi ${tone || ''}"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div>${s ? `<div class="kpi-s">${s}</div>` : ''}</div>`;
function csvDownload(name, rows) {
  if (S.v && S.v.plan === 'premium') rows = [[`${S.v.name} (${S.v.code})`], []].concat(rows);
  const txt = rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(name, new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
}
function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
