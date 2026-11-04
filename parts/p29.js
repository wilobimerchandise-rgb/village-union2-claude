/* =========================================================
   ROUND 13: pledge reminders, owner live view (who is online), and the upgrade request flow.
   Front end only: requests, presence and payment settings live in this browser (keys vv_upgrades_v1, vv_presence_v1,
   vv_upgrade_cfg_v1). The backend later moves them to the database and Paystack's webhook, so activation can be automatic.
   ========================================================= */

/* ---------- Pledge reminder: PDF and WhatsApp ---------- */
function pledgeRemindText(p) {
  const u = userById(p.memberId) || { name: 'member' }, acc = (S.v.settings.accounts || []).map(a => `${a.bank}, ${a.number}, ${a.name}`).join('\n');
  return `Dear ${u.name.split(' ')[0]}, this is a reminder from ${S.v.name}.\nYou pledged ${money(p.amount)} on ${fmtDate(p.date)} for "${p.purpose}"${p.due ? ' (promised by ' + fmtDate(p.due) + ')' : ''}.\nPaid so far: ${money(pledgePaid(p))}\nBalance: ${money(pledgeBal(p))}\n\nPay to:\n${acc || '(ask your admin for the account)'}\n\nAfter paying, sign in to VillageVault and upload your proof of payment.`;
}
const pledgeItem = p => { const u = userById(p.memberId), yr = new Date().getFullYear(), rows = owingRowsAll(p.memberId, yr).filter(r => r.pledgeId === p.id); return { u, rows, owe: sum(rows, 'owe') }; };
Object.assign(ACTIONS, {
  'pledge-remind'(el) {
    requireAdmin(); const p = getPledge(el.dataset.id), u = userById(p.memberId);
    if (p.status === 'cancelled' || !pledgeBal(p)) return toast('This pledge has nothing left to pay.', 'ok');
    const wa = waLinkTo(u && u.phone, pledgeRemindText(p));
    infoModal('Pledge reminder', `${esc(nameOf(p.memberId))}: ${money(pledgeBal(p))} still to pay`, `<pre class="remind-text">${esc(pledgeRemindText(p))}</pre>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-act="pledge-remind-pdf" data-id="${esc(p.id)}">Download reminder (PDF)</button><button class="btn btn-leaf" type="button" data-act="share-pledge" data-id="${esc(p.id)}">Share PDF on WhatsApp</button>${wa ? `<a class="btn btn-leaf" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" data-act="pledge-remind-wa" data-id="${esc(p.id)}">Send on WhatsApp</a>` : '<span class="hint">No phone number on record, so WhatsApp is not available.</span>'}</div>
      <p class="hint">On a phone, Share PDF attaches the file straight into WhatsApp. On a computer, download the PDF and attach it in the chat.</p>`);
  },
  'pledge-remind-pdf'(el) { requireAdmin(); const p = getPledge(el.dataset.id), it = pledgeItem(p); if (!it.u || !(it.owe > 0)) return toast('Nothing left to pay on this pledge.', 'ok'); download(`Pledge-reminder-${p.id}.pdf`, noticePdf([it], new Date().getFullYear())); try { API.logNotice([it.u.id], 'Pledge reminder PDF downloaded'); } catch (_) {} toast('Reminder downloaded. Attach it in WhatsApp.', 'ok'); },
  'pledge-remind-wa'(el) { try { API.logNotice([getPledge(el.dataset.id).memberId], 'Pledge reminder opened in WhatsApp'); } catch (_) {} }
});

/* ---------- Who is online (heard from every signed-in browser tab) ---------- */
const PRES_KEY = 'vv_presence_v1', PRES_TTL = 40000;
const presRead = () => { try { return JSON.parse(lsGet(PRES_KEY) || '{}') || {}; } catch (_) { return {}; } };
function presBeat() {
  if (!S.u || S.owner || !S.v || S.u.id === 'SUPPORT') return;
  const o = presRead(), k = `${S.v.id}|${S.u.id}`, old = o[k];
  o[k] = { vid: S.v.id, vn: S.v.name, uid: S.u.id, name: S.u.name, role: S.u.role === 'admin' ? (S.u.title || 'Admin') : 'Member', page: S.page, at: Date.now(), since: (old && Date.now() - old.at < PRES_TTL * 3) ? old.since : Date.now() };
  Object.keys(o).forEach(x => { if (Date.now() - o[x].at > PRES_TTL * 6) delete o[x]; });
  lsSet(PRES_KEY, JSON.stringify(o));
}
function presGone() { if (!S.u || !S.v) return; const o = presRead(); delete o[`${S.v.id}|${S.u.id}`]; lsSet(PRES_KEY, JSON.stringify(o)); }
const presOnline = () => Object.values(presRead()).filter(x => Date.now() - x.at < PRES_TTL).sort((a, b) => a.vn.localeCompare(b.vn) || a.name.localeCompare(b.name));
setInterval(() => { try { presBeat(); if (S.owner && !S.v && (S.page === 'o-live') && $('#modalRoot').hidden) renderView(); } catch (_) {} }, 5000);
window.addEventListener('beforeunload', () => { try { presGone(); } catch (_) {} });
{ const _lo = logout; logout = function () { try { presGone(); } catch (_) {} return _lo.apply(this, arguments); }; }
{ const _rv = renderView; renderView = function () { const r = _rv.apply(this, arguments); try { presBeat(); } catch (_) {} return r; }; }
const ago = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min`; };
OWNERV['o-live'] = function () {
  const on = presOnline(), vils = new Set(on.map(x => x.vid)).size;
  const acts = []; Object.values(DB.cache).forEach(v => (v.audit || []).slice(-25).forEach(a => acts.push({ v, a })));
  acts.sort((x, y) => y.a.ts.localeCompare(x.a.ts));
  return `<div class="kpis kpis-3">${kpi('Online now', String(on.length), on.length ? 'Signed in and active in the last 40 seconds' : 'Nobody is signed in right now', on.length ? 'good' : '')}${kpi('Villages and associations active', String(vils), 'With someone online')}${kpi('Actions today', String(acts.filter(x => x.a.ts.slice(0, 10) === today()).length), 'Across every village')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Who is online</h2><p>Updates by itself every few seconds. Until the backend is added this shows people signed in on this device's browser.</p></div></div>
  ${table(['Person', 'Role', 'Village or association', 'Viewing', 'Online for'], on.map(x => [`<b>${esc(x.name)}</b><small>${esc(x.uid)}</small>`, esc(x.role), esc(x.vn), esc(TITLES[x.page] || x.page || '-'), esc(ago(Date.now() - x.since))]), ['Nobody online', 'People appear here the moment they sign in and disappear when they sign out or close the page.'])}</section>
  <section class="panel"><div class="panel-h"><div><h2>Latest activity</h2><p>The newest actions by admins in every village and association.</p></div></div>
  ${table(['When', 'Village', 'Admin', 'Action', 'Details'], acts.slice(0, 40).map(x => [`<span class="nowrap">${esc(fmtTS(x.a.ts))}</span>`, esc(x.v.name), esc(x.a.adminName || '-'), esc(x.a.action), esc(x.a.detail || '')]), ['No activity yet', 'Admin actions will appear here.'])}</section>`;
};

/* ---------- Upgrade requests ---------- */
const UPG = {
  key: 'vv_upgrades_v1', cfgKey: 'vv_upgrade_cfg_v1',
  load() { try { return JSON.parse(lsGet(this.key) || '[]') || []; } catch (_) { return []; } },
  save(l) { lsSet(this.key, JSON.stringify(l)); },
  cfg() { const d = { price: '', bank: '', number: '', name: '', paystack: '', note: '' }; try { return Object.assign(d, JSON.parse(lsGet(this.cfgKey) || '{}')); } catch (_) { return d; } },
  saveCfg(c) { lsSet(this.cfgKey, JSON.stringify(c)); },
  pending() { return this.load().filter(r => r.status === 'pending'); },
  forOrg(pid) { return this.load().filter(r => r.pid === pid).sort((a, b) => b.at.localeCompare(a.at)); }
};
Object.assign(API, {
  async requestUpgrade(d) {
    requireAdmin(); if (S.v.plan === 'premium') throw new Error('This village or association is already on Premium.');
    const pid = baseId(S.v.id), l = UPG.load();
    if (l.some(r => r.pid === pid && r.status === 'pending')) throw new Error('An upgrade request is already waiting for the owner.');
    if (!['manual', 'paystack'].includes(d.method)) throw new Error('Choose how you paid.');
    if (!(d.amount > 0)) throw new Error('Enter the amount you paid.'); if (!d.date) throw new Error('Choose the date you paid.');
    if (d.method === 'manual' && !d.proof) throw new Error('Upload your proof of payment (a photo of the slip or a PDF).');
    if (d.method === 'paystack' && (d.ref || '').length < 4 && !d.proof) throw new Error('Enter the Paystack reference from your payment receipt, or upload the receipt.');
    const vil = vilById(pid) || { name: S.v.name, code: S.v.code, type: S.v.type };
    const r = { id: 'U' + Date.now().toString(36) + Math.floor(Math.random() * 1000), pid, orgName: vil.name, code: vil.code, type: vil.type || 'village', from: S.v.name, byId: S.u.id, byName: S.u.name, byTitle: S.u.title || 'Admin', method: d.method, amount: Number(d.amount), date: d.date, ref: (d.ref || '').trim(), note: (d.note || '').trim(), proof: d.proof || null, at: stamp(), status: 'pending' };
    l.push(r); UPG.save(l); log('Requested Premium upgrade', r.id, `${money(r.amount)} by ${d.method === 'paystack' ? 'Paystack' : 'bank transfer'}. Waiting for the owner to confirm`); commit(); return r;
  }
});
Object.assign(OWNER_API, {
  decideUpgrade(id, decision, note) {
    requireOwner(); const l = UPG.load(), r = l.find(x => x.id === id); if (!r) throw new Error('Request not found.'); if (r.status !== 'pending') throw new Error('This request was already decided.');
    if (decision === 'activate') {
      const v = DB.cache[r.pid]; if (v && v.plan !== 'premium') OWNER_API.manageVillage(r.pid, { plan: 'premium', note: `Upgrade request ${r.id}: payment checked` + (note ? '. ' + note : '') });
      else setRegistryPlan(r.pid, 'premium');
      r.status = 'activated';
    } else { if ((note || '').trim().length < 3) throw new Error('Give a short reason so the admin knows what to fix.'); r.status = 'rejected'; }
    r.decidedAt = stamp(); r.decision = (note || '').trim(); UPG.save(l);
    olog(decision === 'activate' ? 'Premium activated' : 'Upgrade request declined', r.orgName, `${r.id}: ${money(r.amount)} by ${r.method}${note ? '. ' + note : ''}`); OWN.save();
  }
});
function upgradeStatusBox(pid) {
  const last = UPG.forOrg(pid)[0]; if (!last) return '';
  if (last.status === 'pending') return `<div class="callout upgrade"><div><b>Your upgrade request is waiting for the owner</b><p>Sent ${esc(fmtTS(last.at))} by ${esc(last.byName)}. The owner checks the payment and then switches Premium on. This page updates by itself.</p></div></div>`;
  if (last.status === 'rejected') return `<div class="callout warn"><div><b>Your last upgrade request was not accepted</b><p>${esc(last.decision || 'No reason given.')} You can send a new request below.</p></div></div>`;
  return '';
}
function upgradeRequestModal() {
  if (!S.u || S.owner) return toast('Sign in as a village or association admin to upgrade.', 'err');
  if (S.u.role !== 'admin') return infoModal('Upgrade to Premium', 'Ask your admin', '<p class="hint" style="margin-top:12px">Only an admin can upgrade. Ask your admin to open Plans and choose Upgrade.</p>');
  if (S.v.plan === 'premium') return toast('Already on Premium.', 'ok');
  const c = UPG.cfg(), pid = baseId(S.v.id), pend = UPG.forOrg(pid)[0] && UPG.forOrg(pid)[0].status === 'pending', refCode = `PREMIUM-${baseId(S.v.id).toUpperCase().slice(0, 8)}`;
  const acct = c.number ? `<dl class="kv"><dt>Bank</dt><dd>${esc(c.bank)}</dd><dt>Account number</dt><dd class="mono">${esc(c.number)}</dd><dt>Account name</dt><dd>${esc(c.name)}</dd><dt>Use this reference</dt><dd class="mono">${esc(refCode)}</dd></dl>` : '<p class="hint">The owner has not entered the bank account yet. Contact VillageVault support for the account details.</p>';
  openModal({ title: 'Upgrade to Premium', size: 'modal-lg', sub: `${esc(S.v.name)}${c.price ? ' · ' + esc(c.price) : ''}`, submit: pend ? false : 'Send upgrade request',
    body: `${upgradeStatusBox(pid)}${c.note ? `<p class="hint">${esc(c.note)}</p>` : ''}
    ${pend ? '' : `<div class="sec-title">How will you pay?</div>
    <div class="radio-row"><label class="check"><input type="radio" name="method" value="manual" checked> Pay manually (bank transfer)</label><label class="check"><input type="radio" name="method" value="paystack"> Pay with Paystack</label></div>
    <div id="upMan"><div class="sec-title">Pay into this account</div>${acct}</div>
    <div id="upPay" hidden><div class="sec-title">Pay with Paystack</div>${c.paystack ? `<p><a class="btn btn-leaf" href="${esc(c.paystack)}" target="_blank" rel="noopener noreferrer">Open Paystack payment page</a></p><p class="hint">Pay there, then come back and enter the Paystack reference from your receipt below.</p>` : '<p class="hint">The owner has not added a Paystack payment link yet. Pay by bank transfer instead, or contact support.</p>'}</div>
    <div class="sec-title">After you have paid</div>
    <div class="form-row"><div class="field"><label for="upA">Amount paid (naira)</label><input id="upA" name="amount" class="input" type="number" min="1" required></div><div class="field"><label for="upD">Date paid</label><input id="upD" name="date" class="input" type="date" max="${today()}" value="${today()}" required></div></div>
    <div class="field" id="upRefF"><label for="upR">Reference (the Paystack reference, or the sender name on the transfer)</label><input id="upR" name="ref" class="input" maxlength="60"></div>
    <div class="field"><label for="upF">Proof of payment <span id="upFreq">(required for bank transfer)</span></label><input id="upF" name="proof" type="file" accept="image/*,application/pdf"></div>
    <div class="field"><label for="upN">Note for the owner (optional)</label><input id="upN" name="note" class="input" maxlength="140"></div>
    <p class="hint">The owner is alerted on their dashboard, checks the payment, and then switches Premium on. Your records stay exactly as they are. Automatic activation arrives when the backend and Paystack webhook are connected.</p>`}`,
    onSubmit: async fd => { const proof = await readProof(fd.get('proof')); await API.requestUpgrade({ method: fd.get('method'), amount: Number(fd.get('amount')), date: fd.get('date'), ref: fd.get('ref'), note: fd.get('note'), proof }); closeModal(); toast('Upgrade request sent. The owner has been alerted.', 'ok'); renderView(); } });
}
document.addEventListener('change', e => { const t = e.target; if (t && t.name === 'method' && $('#upMan')) { const pay = t.value === 'paystack'; $('#upMan').hidden = pay; $('#upPay').hidden = !pay; const q = $('#upFreq'); if (q) q.textContent = pay ? '(optional for Paystack)' : '(required for bank transfer)'; } });
document.addEventListener('keydown', e => { const t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('prem-badge')) { e.preventDefault(); t.click(); } });
ACTIONS['upgrade-start'] = () => { closeModal(); upgradeRequestModal(); };
{ const _ui = ACTIONS['upgrade-info']; }

/* Owner side */
NAV.owner.splice(1, 0, ['o-live', 'Live activity', 'clock'], ['o-upgrades', 'Upgrade requests', 'coin']);
Object.assign(TITLES, { 'o-live': 'Live activity', 'o-upgrades': 'Upgrade requests' });
{ const _rn = renderNav; renderNav = function () { _rn.apply(this, arguments); try { if (roleKey() === 'owner') { const n = UPG.pending().length, o = presOnline().length, add = (pg, c, cls) => { const b = $(`#navlist [data-page="${pg}"]`); if (b && c) b.insertAdjacentHTML('beforeend', `<span class="count${cls || ''}">${c}</span>`); }; add('o-upgrades', n); add('o-live', o, ' count-soft'); } } catch (_) {} }; }
OWNERV['o-upgrades'] = function () {
  const l = UPG.load().sort((a, b) => b.at.localeCompare(a.at)), pend = l.filter(r => r.status === 'pending').length, st = r => r.status === 'pending' ? '<span class="badge b-pending">Waiting</span>' : r.status === 'activated' ? '<span class="badge b-verified">Activated</span>' : '<span class="badge b-rejected">Declined</span>';
  return `<div class="kpis kpis-3">${kpi('Waiting for you', String(pend), pend ? 'Check the payment, then activate' : 'Nothing waiting', pend ? 'bad' : 'good')}${kpi('Activated', String(l.filter(r => r.status === 'activated').length), 'Premium switched on')}${kpi('Declined', String(l.filter(r => r.status === 'rejected').length), '')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Upgrade requests</h2><p>An admin pays, uploads proof, and asks for Premium. Verify the money in your bank or Paystack first, then activate.</p></div></div>
  ${table(['Sent', 'Village or association', 'Asked by', 'Paid by', { t: 'Amount', num: true }, 'Reference', 'Status', ''], l.map(r => [`<span class="nowrap">${esc(fmtTS(r.at))}</span>`, `<b>${esc(r.orgName)}</b><small>${esc(r.code)}${r.from !== r.orgName ? ' · from ' + esc(r.from) : ''}</small>`, `${esc(r.byName)}<small>${esc(r.byTitle)} · ${esc(r.byId)}</small>`, r.method === 'paystack' ? 'Paystack' : 'Bank transfer', money(r.amount) + `<small>${esc(fmtDate(r.date))}</small>`, esc(r.ref || '-'), st(r) + (r.decision ? `<small>${esc(r.decision)}</small>` : ''), `<div class="actions">${r.proof ? `<button class="btn btn-ghost btn-sm" type="button" data-act="upg-proof" data-id="${esc(r.id)}">View proof</button>` : ''}${r.status === 'pending' ? `<button class="btn btn-leaf btn-sm" type="button" data-act="upg-activate" data-id="${esc(r.id)}">Activate</button><button class="btn btn-danger btn-sm" type="button" data-act="upg-decline" data-id="${esc(r.id)}">Decline</button>` : ''}</div>`]), ['No requests yet', 'When an admin asks to upgrade, it appears here and in the menu.'])}</section>`;
};
Object.assign(ACTIONS, {
  'upg-proof'(el) { const r = UPG.load().find(x => x.id === el.dataset.id); if (r && r.proof) infoModal('Proof of payment', `${esc(r.orgName)}, ${money(r.amount)}`, proofHTML(r.proof)); },
  'upg-activate'(el) {
    const r = UPG.load().find(x => x.id === el.dataset.id);
    openModal({ title: `Activate Premium for ${r.orgName}?`, sub: `${money(r.amount)} by ${r.method === 'paystack' ? 'Paystack' : 'bank transfer'}. Only activate after you have seen the money.`, body: `<div class="field"><label for="uaN">Note for your log (optional)</label><input id="uaN" name="note" class="input" maxlength="120"></div>`, submit: 'Activate Premium', onSubmit: fd => { OWNER_API.decideUpgrade(r.id, 'activate', (fd.get('note') || '').trim()); done('Premium is now on.'); } });
  },
  'upg-decline'(el) {
    const r = UPG.load().find(x => x.id === el.dataset.id);
    openModal({ title: `Decline the request from ${r.orgName}?`, danger: true, sub: 'The admin will see your reason.', body: `<div class="field"><label for="udR">Reason</label><input id="udR" name="note" class="input" maxlength="140" required placeholder="For example: payment not received"></div>`, submit: 'Decline', onSubmit: fd => { OWNER_API.decideUpgrade(r.id, 'decline', (fd.get('note') || '').trim()); done('Request declined.'); } });
  },
  'o-upg-cfg'() {
    const c = UPG.cfg();
    openModal({ title: 'Upgrade payment details', size: 'modal-lg', sub: 'Shown to admins who ask to upgrade.', submit: 'Save', body: `<div class="form-row"><div class="field"><label for="ucP">Price shown (for example ₦25,000 per year)</label><input id="ucP" name="price" class="input" maxlength="60" value="${esc(c.price)}"></div><div class="field"><label for="ucB">Bank</label><input id="ucB" name="bank" class="input" maxlength="60" value="${esc(c.bank)}"></div></div>
      <div class="form-row"><div class="field"><label for="ucN">Account number</label><input id="ucN" name="number" class="input mono" inputmode="numeric" maxlength="12" value="${esc(c.number)}"></div><div class="field"><label for="ucA">Account name</label><input id="ucA" name="name" class="input" maxlength="80" value="${esc(c.name)}"></div></div>
      <div class="field"><label for="ucL">Paystack payment link (a payment page you made in your Paystack dashboard)</label><input id="ucL" name="paystack" class="input" type="url" maxlength="200" value="${esc(c.paystack)}" placeholder="https://paystack.com/pay/..."></div>
      <div class="field"><label for="ucT">Short note to admins (optional)</label><input id="ucT" name="note" class="input" maxlength="140" value="${esc(c.note)}"></div>`,
      onSubmit: fd => { const u = (fd.get('paystack') || '').trim(); if (u && !/^https:\/\//i.test(u)) throw new Error('The Paystack link must start with https://'); const n = (fd.get('number') || '').trim(); if (n && !/^\d{10}$/.test(n)) throw new Error('A bank account number has 10 digits.'); UPG.saveCfg({ price: (fd.get('price') || '').trim(), bank: (fd.get('bank') || '').trim(), number: n, name: (fd.get('name') || '').trim(), paystack: u, note: (fd.get('note') || '').trim() }); olog('Changed upgrade payment details', '', 'Updated'); OWN.save(); done('Saved.'); } });
  }
});
{ const _oa2 = OWNERV['o-account']; OWNERV['o-account'] = function () { const c = UPG.cfg(); return _oa2() + `<section class="panel" style="max-width:640px;margin-top:16px"><div class="panel-h"><div><h2>Upgrade payment details</h2><p>What admins see when they ask for Premium.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="o-upg-cfg">Edit</button></div><dl class="kv"><dt>Price</dt><dd>${esc(c.price || 'Not set')}</dd><dt>Bank account</dt><dd>${c.number ? esc(`${c.bank}, ${c.number}, ${c.name}`) : 'Not set'}</dd><dt>Paystack link</dt><dd>${c.paystack ? 'Set' : 'Not set'}</dd></dl></section>`; }; }
// Owner alert: new request while the owner console is open (same browser); also a banner at the top of the owner overview
{ const _oo = OWNERV['o-overview']; OWNERV['o-overview'] = function () { const n = UPG.pending().length; return (n ? `<div class="owner-banner"><div><b>${n} upgrade request${n === 1 ? '' : 's'} waiting.</b> Check the payment and activate Premium.</div><button class="btn btn-saffron btn-sm" type="button" data-act="goto" data-page="o-upgrades">Open requests</button></div>` : '') + _oo(); }; }
window.addEventListener('storage', e => {
  if (!e.key) return;
  if (e.key === UPG.key && S.owner && !S.v) { toast('New upgrade request. Open Upgrade requests to check the payment.', 'ok'); renderSoon(); }
  else if (e.key === UPG.key && S.v && !S.owner) renderSoon();
  else if (e.key === PRES_KEY && S.owner && !S.v && S.page === 'o-live' && $('#modalRoot').hidden) renderSoon();
});

/* ---------- Admin details can be corrected too (ROUND 14) ---------- */
// The Lead Admin (or the owner) can correct any admin's details; an admin can correct their own. Duty, account status and login stay as they are.
Object.assign(API, {
  editAdmin(id, d) {
    requireAdmin(); const u = userById(id); if (!u || u.role !== 'admin') throw new Error('Admin not found.');
    if (!(isLeadAdmin() || S.u.id === id)) throw new Error('Only the Lead Admin can correct another admin’s details.');
    const n = (d.name || '').trim(); if (n.length < 3) throw new Error('Enter the full name.');
    const ch = []; [['name', n], ['family', d.family || ''], ['kindred', d.kindred || ''], ['phone', d.phone || ''], ['email', d.email || '']].forEach(([k, v]) => { if ((u[k] || '') !== v) { ch.push(`${cap(k)}: ${u[k] || 'blank'} to ${v || 'blank'}`); u[k] = v; } });
    if (!ch.length) throw new Error('Nothing was changed.');
    u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Corrected admin details', id, `${u.name}: ${ch.join('; ')}`); commit(); return u;
  }
});
ACTIONS['edit-admin'] = function (el) {
  const u = userById(el.dataset.id); if (!u || u.role !== 'admin') return toast('Admin not found.', 'err');
  openModal({ title: 'Correct admin details', sub: `${esc(u.id)} · ${esc(u.title || 'Admin')}`, body: `<div class="field"><label for="eaN">Full name</label><input id="eaN" name="name" class="input" value="${esc(u.name)}" required></div><div class="form-row">${isVillageType() ? `<div class="field"><label for="eaF">Family name</label><input id="eaF" name="family" class="input" maxlength="40" value="${esc(u.family || '')}"></div><div class="field"><label for="eaK">Kindred name</label><input id="eaK" name="kindred" class="input" maxlength="40" value="${esc(u.kindred || '')}"></div>` : ''}<div class="field"><label for="eaP">Phone</label><input id="eaP" name="phone" class="input" type="tel" value="${esc(u.phone || '')}"></div></div><div class="field"><label for="eaE">Email</label><input id="eaE" name="email" class="input" type="email" value="${esc(u.email || '')}"></div><p class="hint">Duty and login stay the same. Every correction is recorded with your name.</p>`,
    submit: 'Save changes', onSubmit: fd => { API.editAdmin(u.id, { name: fd.get('name'), family: isVillageType() ? (fd.get('family') || '').trim() : '', kindred: isVillageType() ? (fd.get('kindred') || '').trim() : '', phone: (fd.get('phone') || '').trim(), email: (fd.get('email') || '').trim() }); done('Admin details updated.'); } });
};
