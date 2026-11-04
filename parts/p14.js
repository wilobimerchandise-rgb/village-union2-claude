/* =========================================================
   ROUND 5: pay several levies at once, optional reference,
   pledges, plans overview for the owner
   ========================================================= */
const proofOf = t => t.proof || (t.proofFrom && (S.v.tx.find(x => x.id === t.proofFrom) || {}).proof) || null;
const getPledge = id => { const p = (S.v.pledges || []).find(x => x.id === id); if (!p) throw new Error('Pledge not found.'); return p; };
const pledgePaid = p => sum(S.v.tx.filter(t => t.pledgeId === p.id && t.status === 'verified'));
const pledgeWaiting = p => sum(S.v.tx.filter(t => t.pledgeId === p.id && t.status === 'pending'));
const pledgeBal = p => Math.max(0, p.amount - pledgePaid(p));
const pledgeState = p => p.status === 'cancelled' ? 'cancelled' : pledgePaid(p) >= p.amount ? 'paid' : pledgePaid(p) > 0 ? 'part' : 'open';
const pledgeBadge = p => ({ cancelled: '<span class="badge b-off">Cancelled</span>', paid: '<span class="badge b-verified">Fulfilled</span>', part: '<span class="badge b-pending">Part paid</span>', open: '<span class="badge b-pending">Not yet paid</span>' })[pledgeState(p)];
const livePledges = id => (S.v.pledges || []).filter(p => p.memberId === id && p.status !== 'cancelled');

Object.assign(API, {
  /* One slip, one upload, several levies and pledges. Each ticked item becomes its own record, so every levy stays separate in reports. */
  submitPayment(d) {
    if (S.owner || !S.u || S.u.id === 'SUPPORT') throw new Error('Only members and admins can upload their own proof.');
    requireWritable();
    if (!d.items || !d.items.length) throw new Error('Tick at least one levy this payment covers.');
    const batch = d.items.length > 1 ? nextId('batch', 'B') : '', made = [];
    d.items.forEach(it => {
      if (!(it.amount > 0)) throw new Error('Enter an amount for every ticked item.');
      let levy = it.levy, pledgeId = '';
      if (it.pledgeId) { const p = getPledge(it.pledgeId); if (p.memberId !== S.u.id || p.status === 'cancelled') throw new Error('That pledge is not available.'); levy = p.levy; pledgeId = p.id; }
      else if (!levies().some(l => l.id === levy)) throw new Error('One of the levies is no longer available.');
      const t = { id: nextId('tx', 'T'), memberId: S.u.id, levy, amount: it.amount, date: d.date, method: d.method, ref: d.ref || '', note: d.note || '', status: 'pending', proof: made.length ? null : d.proof, proofFrom: made.length ? made[0].id : '', batch, pledgeId, submittedAt: stamp(), submittedBy: S.u.name, updatedBy: null, updatedAt: null, history: [] };
      if (!batch) delete t.batch; if (!pledgeId) delete t.pledgeId; if (!t.proofFrom) delete t.proofFrom;
      S.v.tx.push(t); made.push(t);
    });
    commit(); return made;
  },
  addPledge(d) {
    requireAdmin(); const u = userById(d.memberId);
    if (!u || (u.role !== 'member' && u.role !== 'admin')) throw new Error('Choose the member who made the pledge.');
    if (!(d.amount > 0)) throw new Error('Enter the pledged amount.'); if ((d.purpose || '').length < 3) throw new Error('Say what the pledge is for.');
    if (!levies().some(l => l.id === d.levy)) throw new Error('Choose the category the money will be recorded under.');
    const p = { id: nextId('pl', 'P'), memberId: u.id, amount: d.amount, levy: d.levy, purpose: d.purpose, date: d.date, due: d.due || '', note: d.note || '', status: 'open', createdBy: S.u.name, createdById: S.u.id, createdAt: stamp(), history: [] };
    S.v.pledges.push(p); log('Registered pledge', p.id, `${u.name} pledged ${money(p.amount)}: ${p.purpose}`); commit(); return p;
  },
  editPledge(id, d) {
    requireAdmin(); const p = getPledge(id); if (p.status === 'cancelled') throw new Error('A cancelled pledge cannot be edited.');
    if (!(d.amount > 0)) throw new Error('Enter the pledged amount.'); if (d.amount < pledgePaid(p)) throw new Error(`${money(pledgePaid(p))} is already paid, so the pledge cannot be less than that.`);
    if ((d.purpose || '').length < 3) throw new Error('Say what the pledge is for.');
    const ch = []; if (d.amount !== p.amount) ch.push(`amount ${money(p.amount)} to ${money(d.amount)}`); if (d.purpose !== p.purpose) ch.push('purpose'); if ((d.due || '') !== (p.due || '')) ch.push('due date');
    Object.assign(p, { amount: d.amount, purpose: d.purpose, due: d.due || '', note: d.note || '', date: d.date || p.date });
    p.history.push({ ts: stamp(), by: S.u.name, text: 'Edited: ' + (ch.join(', ') || 'details') });
    log('Edited pledge', p.id, `${nameOf(p.memberId)}: ${ch.join(', ') || 'details'}`); commit(); return p;
  },
  cancelPledge(id, reason) {
    requireAdmin(); const p = getPledge(id); p.status = 'cancelled'; p.cancelReason = reason; p.history.push({ ts: stamp(), by: S.u.name, text: 'Cancelled: ' + reason });
    log('Cancelled pledge', p.id, `${nameOf(p.memberId)}, ${money(p.amount)}: ${reason}`); commit(); return p;
  },
  payPledge(id, d) {
    requireAdmin(); const p = getPledge(id); if (p.status === 'cancelled') throw new Error('This pledge was cancelled.');
    if (!(d.amount > 0)) throw new Error('Enter the amount received.'); if (d.amount > pledgeBal(p)) throw new Error(`Only ${money(pledgeBal(p))} is still owed on this pledge.`);
    const t = API.addTx({ memberId: p.memberId, levy: p.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref || '', note: 'Pledge: ' + p.purpose, status: 'verified' });
    t.pledgeId = p.id; log('Recorded pledge payment', p.id, `${money(d.amount)} from ${nameOf(p.memberId)} towards ${p.purpose}`); commit(); return t;
  }
});

/* ----- Member: tick the levies this payment covers ----- */
function uploadBody(pre) {
  const yr = new Date().getFullYear(), owe = {}; owingRows(S.u.id, yr).forEach(r => { owe[r.L.id] = r; });
  const items = levies().map(L => ({ key: 'L:' + L.id, name: L.name, owe: L.fixed ? (owe[L.id] ? owe[L.id].owe : 0) : 0, need: L.fixed ? (S.v.settings.levies[L.id] || 0) : 0, fixed: L.fixed }))
    .concat(livePledges(S.u.id).filter(p => pledgeBal(p) > 0).map(p => ({ key: 'P:' + p.id, name: 'Pledge: ' + p.purpose, owe: pledgeBal(p), need: pledgeBal(p), fixed: true, pledge: true })));
  const first = pre || ((items.find(i => i.owe > 0) || {}).key || '');
  const rows = items.map(i => { const on = i.key === first, amt = i.owe > 0 ? i.owe : (i.fixed ? i.need : '');
    return `<label class="lv-row${on ? ' on' : ''}"><input type="checkbox" class="lv-pick" name="pick" value="${esc(i.key)}"${on ? ' checked' : ''}><span class="lv-name">${esc(i.name)}<small>${i.pledge ? 'Still to pay ' + money(i.owe) : !i.fixed ? 'Any amount you choose' : i.owe > 0 ? 'You owe ' + money(i.owe) : 'Paid up for this year'}</small></span><span class="lv-amt"><input class="input lv-in" type="number" min="1" step="1" inputmode="numeric" name="amt_${esc(i.key)}" value="${amt}" placeholder="0" aria-label="Amount for ${esc(i.name)}"${on ? '' : ' disabled'}></span></label>`; }).join('');
  return `<div class="field"><label>Tick what this payment covers</label><div class="lv-list">${rows}</div><div class="lv-total"><span>Total on your slip should be</span><b id="lvTotal">${money(0)}</b></div></div>
  <div class="form-row"><div class="field"><label for="uDate">Payment date</label><input id="uDate" name="date" class="input" type="date" max="${today()}" value="${today()}" required></div>
  <div class="field"><label for="uMethod">How did you pay?</label><select id="uMethod" name="method" class="select">${methodOpts('')}</select></div></div>
  <div class="field"><label for="uRef">Bank reference or teller number (optional)</label><input id="uRef" name="ref" class="input" type="text" placeholder="Leave empty if your slip has none" maxlength="60"></div>
  ${fileField('Proof of payment')}
  <div class="field"><label for="uNote">Note for the admin (optional)</label><textarea id="uNote" name="note" class="textarea" maxlength="300" placeholder="For example: paid on behalf of my brother"></textarea></div>`;
}
function lvUpdateTotal() { const f = $('#mForm'); if (!f || !$('#lvTotal')) return; let t = 0; $$('.lv-in', f).forEach(i => { if (!i.disabled) t += Number(i.value) || 0; }); $('#lvTotal').textContent = money(t); }
document.addEventListener('change', e => { const t = e.target; if (!t.matches || !t.matches('.lv-pick')) return; const row = t.closest('.lv-row'), inp = $('.lv-in', row); inp.disabled = !t.checked; row.classList.toggle('on', t.checked); if (t.checked && !(Number(inp.value) > 0)) inp.focus(); lvUpdateTotal(); });
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('.lv-in')) lvUpdateTotal(); });
function uploadModal(pre) {
  if (S.owner || !S.u || S.u.id === 'SUPPORT') return;
  openModal({ title: 'Send proof of payment', sub: 'Pay first, then upload the slip. Tick every levy it covers so you can pay them all at once. Your admin checks it against the bank statement.', body: uploadBody(pre), size: 'modal-lg', submit: 'Send for verification',
    onSubmit: async fd => {
      const picks = fd.getAll('pick'), date = fd.get('date'), ref = (fd.get('ref') || '').trim(), file = fd.get('proof');
      if (!picks.length) throw new Error('Tick at least one levy this payment covers.');
      const items = picks.map(k => { const amount = Number(fd.get('amt_' + k)); if (!(amount > 0)) throw new Error('Enter an amount for every ticked item.'); return k.startsWith('P:') ? { pledgeId: k.slice(2), amount } : { levy: k.slice(2), amount }; });
      if (!date || date > today()) throw new Error('Choose the date you paid. It cannot be in the future.');
      if (!file || !file.size) throw new Error('Attach a photo or PDF of your proof of payment.');
      const proof = await readProof(file);
      const made = API.submitPayment({ items, date, method: fd.get('method'), ref, note: (fd.get('note') || '').trim(), proof });
      done(made.length > 1 ? `Proof sent for ${made.length} levies. Your admin will verify it soon.` : 'Proof sent. Your admin will verify it soon.');
    }, });
  lvUpdateTotal();
}

/* ----- Admin: verify or reject a payment that covers several levies together ----- */
const _verifyTx = ACTIONS['verify-tx'], _rejectTx = ACTIONS['reject-tx'];
const batchPending = t => t.batch ? S.v.tx.filter(x => x.batch === t.batch && x.status === 'pending') : [t];
Object.assign(ACTIONS, {
  'upload-proof'(el) { uploadModal(el && el.dataset ? el.dataset.pre : ''); },
  'verify-tx'(el) {
    const t = getTx(el.dataset.id); if (t.memberId === S.u.id) return toast('You cannot verify your own payment. Another admin must verify it.', 'err'); const sib = batchPending(t); if (sib.length < 2) return _verifyTx(el);
    const rows = sib.map(x => `<tr><td><label class="check"><input type="checkbox" name="inc" value="${esc(x.id)}" checked> ${esc(levyOf(x.levy).name)}${x.pledgeId ? ' (pledge)' : ''}</label></td><td class="num"><input class="input" type="number" min="1" name="amt_${esc(x.id)}" value="${x.amount}" style="max-width:140px"></td></tr>`).join('');
    openModal({ title: 'Verify payment', size: 'modal-lg', sub: `${esc(nameOf(t.memberId))} paid ${sib.length} levies with one slip on ${esc(fmtDate(t.date))} by ${esc(t.method)}. Reference: ${esc(t.ref || 'none')}.`,
      body: `<div class="form-row" style="margin-top:14px"><div>${proofHTML(proofOf(sib.find(x => proofOf(x)) || t))}</div><div><table class="t"><thead><tr><th>Tick the items you confirm</th><th class="num">Amount in the bank</th></tr></thead><tbody>${rows}</tbody></table><span class="hint">Total on the slip: ${money(sum(sib))}. Untick anything you cannot find in the bank statement; it stays waiting.</span><div class="field"><label for="vNote">Note (optional)</label><textarea id="vNote" name="note" class="textarea" maxlength="300"></textarea></div></div></div>`,
      submit: 'Verify ticked items', onSubmit: fd => { const ids = fd.getAll('inc'); if (!ids.length) throw new Error('Tick at least one item to verify.'); const jobs = ids.map(id => ({ id, a: Number(fd.get('amt_' + id)) })); if (jobs.some(j => !(j.a > 0))) throw new Error('Enter a confirmed amount for every ticked item.'); jobs.forEach(j => API.verify(j.id, j.a, (fd.get('note') || '').trim())); done(`${jobs.length} items verified and the ledger updated.`); } });
  },
  'reject-tx'(el) {
    const t = getTx(el.dataset.id); if (t.memberId === S.u.id) return toast('You cannot reject your own payment. Another admin must review it.', 'err'); const sib = batchPending(t); if (sib.length < 2) return _rejectTx(el);
    openModal({ title: 'Reject payment', danger: true, sub: `${esc(nameOf(t.memberId))} paid ${sib.length} levies with one slip (${money(sum(sib))}). All ${sib.length} items will be rejected together and the member sees your reason.`,
      body: `<div class="field"><label for="rjR">Reason</label><select id="rjR" name="reason" class="select" required>${opt('', 'Choose a reason', '')}${REJECT_REASONS.map(r => opt(r, r, '')).join('')}</select></div>`, submit: 'Reject all items',
      onSubmit: fd => { if (!fd.get('reason')) throw new Error('Choose a reason so the member knows what to fix.'); sib.forEach(x => API.reject(x.id, fd.get('reason'))); done('Payment rejected.'); } });
  }
});

/* ----- Pledges ----- */
function pledgeForm(p) {
  const lv = levies(), def = p.levy || (lv.find(l => !l.fixed) || lv[0]).id;
  return `<div class="field"><label for="plM">Member</label><select id="plM" name="memberId" class="select" required${p.id ? ' disabled' : ''}>${memberOpts(p.memberId, 'Choose a member', true)}</select></div>
  <div class="field"><label for="plP">What is the pledge for?</label><input id="plP" name="purpose" class="input" maxlength="80" placeholder="For example: Town hall roofing" value="${esc(p.purpose || '')}" required></div>
  <div class="form-row"><div class="field"><label for="plA">Amount pledged (naira)</label><input id="plA" name="amount" class="input" type="number" min="1" step="1" value="${p.amount || ''}" required></div>
  <div class="field"><label for="plL">Record the money under</label><select id="plL" name="levy" class="select"${p.id ? ' disabled' : ''}>${lv.map(l => opt(l.id, l.name, def)).join('')}</select></div></div>
  <div class="form-row"><div class="field"><label for="plD">Date pledged</label><input id="plD" name="date" class="input" type="date" max="${today()}" value="${esc(p.date || today())}" required></div>
  <div class="field"><label for="plU">Promised by (optional)</label><input id="plU" name="due" class="input" type="date" value="${esc(p.due || '')}"></div></div>
  <div class="field"><label for="plN">Note (optional)</label><textarea id="plN" name="note" class="textarea" maxlength="300" placeholder="Where and when it was promised">${esc(p.note || '')}</textarea></div>`;
}
const readPledge = fd => ({ memberId: fd.get('memberId'), purpose: (fd.get('purpose') || '').trim(), amount: Number(fd.get('amount')), levy: fd.get('levy'), date: fd.get('date'), due: fd.get('due') || '', note: (fd.get('note') || '').trim() });
function pledgeDetail(id) {
  const p = getPledge(id), txs = S.v.tx.filter(t => t.pledgeId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const admin = isAdmin();
  infoModal('Pledge: ' + p.purpose, `${esc(nameOf(p.memberId))}, ${esc(p.memberId)}`,
    `<div class="kpis kpis-3" style="margin-top:14px">${kpi('Pledged', money(p.amount), fmtDate(p.date))}${kpi('Paid', money(pledgePaid(p)), pledgeWaiting(p) ? money(pledgeWaiting(p)) + ' waiting for verification' : '', 'good')}${kpi('Balance', money(pledgeBal(p)), p.due ? 'Promised by ' + fmtDate(p.due) : '', pledgeBal(p) ? 'bad' : '')}</div>
    <dl class="kv"><dt>Status</dt><dd>${pledgeBadge(p)}</dd><dt>Recorded under</dt><dd>${esc(levyOf(p.levy).name)}</dd><dt>Registered by</dt><dd>${esc(p.createdBy)}, ${esc(fmtTS(p.createdAt))}</dd>${p.note ? `<dt>Note</dt><dd>${esc(p.note)}</dd>` : ''}${p.cancelReason ? `<dt>Cancelled because</dt><dd>${esc(p.cancelReason)}</dd>` : ''}</dl>
    ${admin && p.status !== 'cancelled' ? `<div class="btn-row">${pledgeBal(p) ? `<button class="btn btn-primary btn-sm" type="button" data-act="pay-pledge" data-id="${esc(p.id)}">Record a payment</button><button class="btn btn-leaf btn-sm" type="button" data-act="pledge-remind" data-id="${esc(p.id)}">Send reminder</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="edit-pledge" data-id="${esc(p.id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="cancel-pledge" data-id="${esc(p.id)}">Cancel pledge</button></div>` : ''}
    ${!admin && pledgeBal(p) && p.status !== 'cancelled' ? `<div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof" data-pre="P:${esc(p.id)}">Pay towards this pledge</button></div>` : ''}
    <div class="sec-title">Payments towards it</div>${table(['Date', 'Amount', 'Status'], txs.map(t => [esc(fmtDate(t.date)), money(t.amount), badge(t.status)]), ['No payments yet', 'Payments made towards this pledge will show here.'])}`);
}
function pledgeSection(id) {
  const list = livePledges(id); if (!list.length) return '';
  return `<div class="sec-title">Pledges</div>${table(['Pledge', { t: 'Pledged', num: true }, { t: 'Paid', num: true }, { t: 'Balance', num: true }, 'Status'], list.map(p => [linkBtn('view-pledge', p.id, p.purpose), money(p.amount), money(pledgePaid(p)), money(pledgeBal(p)), pledgeBadge(p)]), ['', ''])}`;
}
function pledgePanel() {
  const list = livePledges(S.u.id); if (!list.length) return '';
  const left = sum(list.map(p => ({ amount: pledgeBal(p) })));
  return `<section class="panel" id="pledges"><div class="panel-h"><div><h2>My pledges</h2><p>Promises you made to the village, registered by your admin. ${left ? 'You still owe ' + money(left) + '.' : 'All fulfilled. Thank you.'}</p></div></div>
  ${table(['Pledge', 'Date', { t: 'Pledged', num: true }, { t: 'Paid', num: true }, { t: 'Balance', num: true }, 'Status', ''], list.map(p => [linkBtn('view-pledge', p.id, p.purpose) + `<small>Registered by ${esc(p.createdBy)}</small>`, esc(fmtDate(p.date)), money(p.amount), money(pledgePaid(p)), money(pledgeBal(p)), pledgeBadge(p), pledgeBal(p) ? `<button class="btn btn-primary btn-sm" type="button" data-act="upload-proof" data-pre="P:${esc(p.id)}">Pay</button>` : '']), ['', ''])}</section>`;
}
ADMIN.pledges = function () {
  const f = S.f, all = S.v.pledges || [], live = all.filter(p => p.status !== 'cancelled'), st = f.pst || '';
  const list = all.filter(p => !st || pledgeState(p) === st).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), page = paginate(list, f);
  const pledged = sum(live), got = live.reduce((a, p) => a + Math.min(p.amount, pledgePaid(p)), 0);
  return `<div class="kpis kpis-3">${kpi('Pledged', money(pledged), `${live.length} pledges`)}${kpi('Received', money(got), 'Verified payments', 'good')}${kpi('Still to receive', money(Math.max(0, pledged - got)), 'Follow up with members', pledged - got > 0 ? 'bad' : '')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Member pledges</h2><p>Register what a member promises. It shows on their dashboard, and payments update it after you verify them.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-pledge">Register a pledge</button></div>
  <div class="toolbar"><div class="field"><label for="plS">Show</label><select id="plS" class="select" data-filter="pst">${opt('', 'All pledges', st)}${opt('open', 'Not yet paid', st)}${opt('part', 'Part paid', st)}${opt('paid', 'Fulfilled', st)}${opt('cancelled', 'Cancelled', st)}</select></div></div>
  ${table(['Member', 'Pledge', 'Date', { t: 'Pledged', num: true }, { t: 'Paid', num: true }, { t: 'Balance', num: true }, 'Status', ''], page.map(p => [`${linkBtn('member-profile', p.memberId, nameOf(p.memberId))}<small>${esc(p.memberId)}</small>`, `${linkBtn('view-pledge', p.id, p.purpose)}<small>${esc(levyOf(p.levy).name)}</small>`, esc(fmtDate(p.date)), money(p.amount), money(pledgePaid(p)), money(pledgeBal(p)), pledgeBadge(p), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-pledge" data-id="${esc(p.id)}">Open</button>${p.status !== 'cancelled' && pledgeBal(p) ? `<button class="btn btn-leaf btn-sm" type="button" data-act="pay-pledge" data-id="${esc(p.id)}">Record payment</button><button class="btn btn-primary btn-sm" type="button" data-act="pledge-remind" data-id="${esc(p.id)}">Send reminder</button>` : ''}</div>`]), ['No pledges yet', 'When a member promises money, register it here so it shows on their dashboard.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
};
VIEWS.admin.pledges = ADMIN.pledges;
Object.assign(ACTIONS, {
  'add-pledge'() { requireAdmin(); openModal({ title: 'Register a pledge', sub: 'The member will see it on their dashboard. Your name and the time are saved.', body: pledgeForm({}), submit: 'Save pledge', onSubmit: fd => { const d = readPledge(fd); if (!d.date) throw new Error('Choose the date pledged.'); const p = API.addPledge(d); done(`Pledge ${p.id} registered.`); } }); },
  'edit-pledge'(el) { requireAdmin(); const p = getPledge(el.dataset.id); openModal({ title: 'Edit pledge', sub: `${esc(nameOf(p.memberId))}. Every change is logged under your name.`, body: pledgeForm(p), submit: 'Save changes', onSubmit: fd => { const d = readPledge(fd); API.editPledge(p.id, d); done('Pledge updated.'); } }); },
  'cancel-pledge'(el) { requireAdmin(); const p = getPledge(el.dataset.id); openModal({ title: 'Cancel this pledge?', danger: true, sub: `${esc(nameOf(p.memberId))}, ${money(p.amount)}. Payments already received stay in the records.`, body: `<div class="field"><label for="cpR">Reason</label><textarea id="cpR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Cancel pledge', onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Give a short reason.'); API.cancelPledge(p.id, r); done('Pledge cancelled.'); } }); },
  'pay-pledge'(el) {
    requireAdmin(); const p = getPledge(el.dataset.id);
    openModal({ title: 'Record a pledge payment', sub: `${esc(nameOf(p.memberId))} owes ${money(pledgeBal(p))} on "${esc(p.purpose)}". It is saved as verified and counts in the reports.`,
      body: `<div class="form-row"><div class="field"><label for="ppA">Amount received (naira)</label><input id="ppA" name="amount" class="input" type="number" min="1" max="${pledgeBal(p)}" value="${pledgeBal(p)}" required></div><div class="field"><label for="ppD">Date received</label><input id="ppD" name="date" class="input" type="date" max="${today()}" value="${today()}" required></div></div>
      <div class="form-row"><div class="field"><label for="ppM">Method</label><select id="ppM" name="method" class="select">${methodOpts('')}</select></div><div class="field"><label for="ppR">Reference (optional)</label><input id="ppR" name="ref" class="input" maxlength="60"></div></div>`,
      submit: 'Save payment', onSubmit: fd => { API.payPledge(p.id, { amount: Number(fd.get('amount')), date: fd.get('date'), method: fd.get('method'), ref: (fd.get('ref') || '').trim() }); done('Payment recorded against the pledge.'); } });
  },
  'view-pledge'(el) { pledgeDetail(el.dataset.id); }
});

/* ----- Owner: which plan every village runs on ----- */
function plansPanel(rows) {
  const by = p => rows.filter(r => (r.v.plan || 'basic') === p && !r.vil.removed);
  const col = (p, label, note) => { const l = by(p); return `<div class="plan-col"><div class="plan-h">${planBadge({ plan: p })}<b>${l.length}</b> ${l.length === 1 ? 'village' : 'villages'}</div><p class="hint">${note}</p><div class="chips">${l.length ? l.map(r => `<button type="button" class="chip" data-act="owner-manage" data-id="${esc(r.vil.id)}">${esc(r.v.name)}</button>`).join('') : '<span class="hint">None</span>'}</div></div>`; };
  return `<section class="panel"><div class="panel-h"><div><h2>Plans in use</h2><p>Which package each village or association runs on. Click a name to change its plan.</p></div></div><div class="plan-cols">${col('premium', 'Premium', 'Receipts carry the village name and logo.')}${col('basic', 'Basic', 'Standard receipts.')}</div></section>`;
}
