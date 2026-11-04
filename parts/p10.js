
/* =========================================================
   ROUND 4: payment details, village profile, levy categories
   ========================================================= */
const waNum = p => { const d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('234')) return d; if (d.startsWith('0')) return '234' + d.slice(1); return d.length === 10 ? '234' + d : d; };
const waLinkTo = (phone, text) => { const n = waNum(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : ''; };
const genPw = () => 'Vv' + Math.floor(100000 + Math.random() * 899999);
const infoModal = (title, sub, body, size) => openModal({ title, sub, body, submit: false, size: size || 'modal-lg' });
const linkBtn = (act, id, label, extra) => `<button type="button" class="linkbtn" data-act="${act}" data-id="${esc(id)}"${extra || ''}>${esc(label)}</button>`;

Object.assign(API, {
  saveAccounts(rows, note) {
    requireAdmin();
    S.v.settings.accounts = rows.map((r, i) => ({ id: 'B' + (i + 1), bank: r.bank, number: r.number, name: r.name }));
    S.v.settings.payNote = note;
    log('Updated payment details', 'Settings', rows.length ? rows.map(r => `${r.bank} ${r.number}`).join('; ') : 'All accounts removed'); commit();
  },
  saveBranding(d) {
    requireAdmin(); const ch = [];
    if (S.v.wing) { d.name = ''; d.code = ''; }   // a wing's name and code follow its village
    if (d.name && d.name !== S.v.name) { ch.push(`Name: ${S.v.name} to ${d.name}`); S.v.name = d.name; const vil = VILLAGES.find(x => x.id === S.v.id); if (vil) vil.name = d.name; setPubName(S.v.id, d.name); }
    if (d.code && d.code !== S.v.code) {
      if (S.v.plan !== 'premium') throw new Error('Changing the village code is part of the Premium plan.');
      if (!/^[A-Z0-9]{2,5}$/.test(d.code)) throw new Error('The code must be 2 to 5 letters or numbers.');
      if (VILLAGES.some(x => x.id !== S.v.id && x.code === d.code)) throw new Error('Another village already uses that code.');
      ch.push(`Code: ${S.v.code} to ${d.code}`); S.v.code = d.code; const vl = VILLAGES.find(x => x.id === S.v.id); if (vl) vl.code = d.code; setPubCode(S.v.id, d.code);
    }
    if (d.address !== undefined && S.v.plan === 'premium') { const a = (d.address || '').trim(), m = (d.motto || '').trim(), L = S.v.letter || {}; if (a !== (L.address || '') || m !== (L.motto || '')) { ch.push('Letterhead details updated'); S.v.letter = { address: a, motto: m }; } }
    if (d.logo) { ch.push('Logo updated'); S.v.logo = d.logo; }
    if (d.removeLogo && S.v.logo && !d.logo) { ch.push('Logo removed'); S.v.logo = null; }
    if (!ch.length) throw new Error('Nothing was changed.');
    log('Updated village profile', 'Profile', ch.join('; ')); commit();
  },
  addLevy(d) {
    requireAdmin(); const nm = d.name.trim();
    if (levyAll().some(l => !l.removed && l.name.toLowerCase() === nm.toLowerCase())) throw new Error('A levy with that name already exists.');
    S.v.seq.lev = (S.v.seq.lev || 0) + 1; const id = 'c' + S.v.seq.lev + Date.now().toString(36).slice(-3);
    S.v.levyList.push({ id, name: nm, fixed: !!d.fixed, color: PALETTE[levyAll().length % PALETTE.length] }); S.v.settings.levies[id] = d.fixed ? Number(d.amount) : 0;
    log('Added levy category', id, `${nm} (${d.fixed ? money(d.amount) + ' required from every member' : 'voluntary, no set amount'})`); commit();
  },
  editLevy(id, d) {
    requireAdmin(); const l = levyAll().find(x => x.id === id); if (!l) throw new Error('Levy not found.'); const ch = [];
    if (d.name !== l.name) { if (levyAll().some(x => x.id !== id && !x.removed && x.name.toLowerCase() === d.name.toLowerCase())) throw new Error('A levy with that name already exists.'); ch.push(`Name: ${l.name} to ${d.name}`); l.name = d.name; }
    if (!!d.fixed !== !!l.fixed) { ch.push(d.fixed ? 'Now required from every member' : 'Now voluntary'); l.fixed = !!d.fixed; }
    const amt = l.fixed ? Number(d.amount) : 0; if ((S.v.settings.levies[id] || 0) !== amt) { ch.push(`Amount: ${money(S.v.settings.levies[id] || 0)} to ${money(amt)}`); S.v.settings.levies[id] = amt; }
    if (!ch.length) throw new Error('Nothing was changed.');
    log('Edited levy category', id, `${l.name}: ${ch.join('; ')}`); commit();
  },
  removeLevy(id) {
    requireAdmin(); const l = levyAll().find(x => x.id === id); if (!l) throw new Error('Levy not found.');
    if (levies().length <= 1) throw new Error('Keep at least one levy category.');
    l.removed = true; log('Removed levy category', id, `${l.name} removed. Past payments stay in the records.`); commit();
  },
  restoreLevy(id) { requireAdmin(); const l = levyAll().find(x => x.id === id); if (!l) throw new Error('Levy not found.'); delete l.removed; log('Restored levy category', id, l.name); commit(); }
});

/* ---------- Payment details table (shown on every dashboard, edited by admins only) ---------- */
function accTable(acc) {
  if (!acc.length) return `<div class="empty"><b>No payment details yet</b>${isAdmin() ? 'Choose Edit payment details to add the village account.' : 'Your admin has not added the account yet.'}</div>`;
  return `<div class="tablewrap"><table class="t bordered" aria-label="Village bank accounts"><thead><tr><th>Bank name</th><th>Account number</th><th>Account name</th></tr></thead><tbody>${acc.map(a => `<tr><td>${esc(a.bank)}</td><td class="mono">${esc(a.number)}</td><td>${esc(a.name)}</td></tr>`).join('')}</tbody></table></div>`;
}
function paymentPanel() {
  const acc = S.v.settings.accounts || [], edit = isAdmin() ? '<button class="btn btn-ghost btn-sm" type="button" data-act="edit-accounts">Edit payment details</button>' : '';
  return `<section class="panel" id="payinfo"><div class="panel-h"><div><h2>How to pay</h2><p>Pay into the village account below, then upload your proof of payment. VillageVault never receives or holds your money.</p></div>${edit}</div>
  ${accTable(acc)}${S.v.settings.payNote ? `<p class="hint" style="margin-top:10px">${esc(S.v.settings.payNote)}</p>` : ''}</section>`;
}
ACTIONS['edit-accounts'] = function () {
  requireAdmin(); const acc = S.v.settings.accounts || [], n = Math.min(6, Math.max(3, acc.length + 1));
  const row = i => { const a = acc[i] || {}; return `<tr><td><input class="input" name="bank_${i}" maxlength="40" value="${esc(a.bank || '')}" placeholder="Bank name" aria-label="Bank name ${i + 1}"></td><td><input class="input" name="num_${i}" inputmode="numeric" maxlength="10" value="${esc(a.number || '')}" placeholder="10 digits" aria-label="Account number ${i + 1}"></td><td><input class="input" name="nm_${i}" maxlength="60" value="${esc(a.name || '')}" placeholder="Account name" aria-label="Account name ${i + 1}"></td></tr>`; };
  openModal({ title: 'Edit payment details', size: 'modal-lg', sub: 'Members see this table on every dashboard. Leave a row empty to remove it. Only admins can change it.',
    body: `<div class="tablewrap"><table class="t bordered edit"><thead><tr><th>Bank name</th><th>Account number</th><th>Account name</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => row(i)).join('')}</tbody></table></div>
    <div class="field"><label for="pnote">Instruction under the table</label><textarea id="pnote" name="note" class="textarea" maxlength="300">${esc(S.v.settings.payNote || '')}</textarea></div>`, submit: 'Save payment details',
    onSubmit: fd => {
      const rows = []; for (let i = 0; i < 6; i++) {
        if (fd.get('bank_' + i) == null) continue; const b = (fd.get('bank_' + i) || '').trim(), nu = (fd.get('num_' + i) || '').trim(), nm = (fd.get('nm_' + i) || '').trim();
        if (!b && !nu && !nm) continue; if (!b || !nu || !nm) throw new Error(`Row ${i + 1}: fill in the bank name, account number and account name.`);
        if (!/^\d{10}$/.test(nu)) throw new Error(`Row ${i + 1}: the account number must be 10 digits.`); rows.push({ bank: b, number: nu, name: nm });
      }
      API.saveAccounts(rows, (fd.get('note') || '').trim()); done('Payment details saved.');
    } });
};

/* ---------- Village profile: logo, name, plan ---------- */
ADMIN.profile = function () {
  const prem = S.v.plan === 'premium', vil = vilById(S.v.id);
  return `<section class="panel"><div class="panel-h"><div><h2>Village profile</h2><p>Your name and logo show on the sidebar${prem ? ' and on every receipt, report, statement, notice and export you issue' : ''}.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="edit-profile">${prem ? 'Edit name, code and logo' : 'Edit name and logo'}</button></div>
    <div class="profile-row">${S.v.logo ? `<img class="plogo" src="${esc(S.v.logo)}" alt="Village logo">` : `<div class="plogo ph" style="background:${vil.color}">${esc(vil.code)}</div>`}
    <dl class="kv"><dt>Name</dt><dd>${esc(S.v.name)}</dd><dt>Code</dt><dd>${esc(S.v.code)}</dd><dt>Plan</dt><dd>${prem ? '<span class="badge b-admin">Premium</span>' : '<span class="badge b-off">Basic</span>'}</dd><dt>Documents</dt><dd>${prem ? 'Every receipt, report, statement, notice and export bears the village name, code and logo' : 'Carry the VillageVault name only'}</dd></dl></div>
    ${prem ? '' : '<div class="callout" style="margin-top:16px"><div><b>Want receipts with your village name and logo?</b><p>Ask VillageVault support to move your village to the Premium plan.</p></div></div>'}</section>
  ${paymentPanel()}`;
};
ACTIONS['edit-profile'] = function () {
  requireAdmin();
  openModal({ title: S.v.plan === 'premium' ? 'Edit name, code and logo' : 'Edit name and logo', sub: 'Changes show to every member straight away.',
    body: `<div class="field"><label for="vpN">Village or association name</label><input id="vpN" name="name" class="input" maxlength="40" value="${esc(S.v.name)}"${S.v.wing ? ' readonly' : ''} required></div>${S.v.plan === 'premium' ? `<div class="field"><label for="vpC">Village code</label><input id="vpC" name="code" class="input mono" maxlength="6" value="${esc(S.v.code)}"${S.v.wing ? ' readonly' : ''} style="text-transform:uppercase" required><span class="hint">2 to 5 letters or numbers. It appears on records, receipts and reports. Existing member IDs and login IDs do not change.</span></div><div class="field"><label for="vpA">Address on the letterhead (optional)</label><input id="vpA" name="address" class="input" maxlength="90" value="${esc((S.v.letter || {}).address || '')}"></div><div class="field"><label for="vpMo">Motto or tagline (optional)</label><input id="vpMo" name="motto" class="input" maxlength="70" value="${esc((S.v.letter || {}).motto || '')}"></div>` : ''}${fileField('Logo', 'logo')}${S.v.logo ? '<label class="check"><input type="checkbox" name="removeLogo"> <span>Remove the current logo</span></label>' : ''}`, submit: 'Save profile',
    onSubmit: async fd => {
      const n = (fd.get('name') || '').trim(); if (n.length < 2) throw new Error('Enter the village or association name.');
      const logo = await readLogo(fd.get('proof')); API.saveBranding({ name: n, code: fd.get('code') ? String(fd.get('code')).trim().toUpperCase() : '', logo, removeLogo: !!fd.get('removeLogo'), address: fd.get('address'), motto: fd.get('motto') }); fillVillageSelects(); renderApp(); closeModal(); toast('Profile saved.', 'ok');
    } });
};

/* ---------- Levy categories (add, edit, remove) ---------- */
ADMIN.levies = function () {
  const yr = new Date().getFullYear(), ver = villageTx().filter(t => yearOf(t.date) === yr), all = levyAll();
  return `<section class="panel"><div class="panel-h"><div><h2>Levy categories</h2><p>Add your own levies, change amounts, or remove one. A required levy counts against every member until it is paid. Removing a levy keeps past payments.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-levy">Add levy category</button></div>
  ${table(['Levy', 'Type', { t: 'Amount per member', num: true }, { t: 'Paid in ' + yr, num: true }, 'Status', ''], all.map(l => [`<span class="dot" style="background:${l.color}"></span>${esc(l.name)}`, l.fixed ? 'Required from every member' : 'Voluntary', l.fixed ? money(S.v.settings.levies[l.id] || 0) : 'Any amount', money(sum(ver.filter(t => t.levy === l.id))), l.removed ? '<span class="badge b-void">Removed</span>' : '<span class="badge b-active">In use</span>',
    l.removed ? `<div class="actions"><button class="btn btn-leaf btn-sm" type="button" data-act="restore-levy" data-id="${l.id}">Restore</button></div>` : `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="edit-levy" data-id="${l.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="remove-levy" data-id="${l.id}">Remove</button></div>`]), ['No levies', ''])}</section>`;
};
function levyForm(l) {
  l = l || { fixed: true };
  return `<div class="field"><label for="lvN">Levy name</label><input id="lvN" name="name" class="input" maxlength="40" value="${esc(l.name || '')}" placeholder="For example Development levy" required></div>
  <div class="form-row"><div class="field"><label for="lvT">Type</label><select id="lvT" name="type" class="select">${opt('fixed', 'Required from every member', l.fixed ? 'fixed' : 'open')}${opt('open', 'Voluntary (any amount)', l.fixed ? 'fixed' : 'open')}</select></div>
  <div class="field"><label for="lvA">Amount per member (naira)</label><input id="lvA" name="amount" class="input" type="number" min="0" step="100" value="${l.id ? S.v.settings.levies[l.id] || 0 : ''}" placeholder="0"></div></div>`;
}
function readLevyForm(fd) {
  const name = (fd.get('name') || '').trim(), fixed = fd.get('type') === 'fixed', amount = Number(fd.get('amount') || 0);
  if (name.length < 2) throw new Error('Enter a name for the levy.'); if (fixed && !(amount > 0)) throw new Error('Enter the amount every member must pay.');
  return { name, fixed, amount };
}
Object.assign(ACTIONS, {
  'add-levy'() { requireAdmin(); openModal({ title: 'Add a levy category', sub: 'It appears straight away in payment forms, reports and what members owe.', body: levyForm(null), submit: 'Add levy', onSubmit: fd => { API.addLevy(readLevyForm(fd)); done('Levy added.'); } }); },
  'edit-levy'(el) { requireAdmin(); const l = levyOf(el.dataset.id); openModal({ title: 'Edit levy', sub: esc(l.name), body: levyForm(l), submit: 'Save changes', onSubmit: fd => { API.editLevy(l.id, readLevyForm(fd)); done('Levy updated.'); } }); },
  'remove-levy'(el) {
    requireAdmin(); const l = levyOf(el.dataset.id), n = S.v.tx.filter(t => t.levy === l.id).length;
    openModal({ title: `Remove ${l.name}?`, danger: true, sub: `${n} payment record${n === 1 ? '' : 's'} stay${n === 1 ? 's' : ''} in the books and in reports. Members will no longer owe this levy.`, body: '', submit: 'Remove levy', onSubmit: () => { API.removeLevy(l.id); done('Levy removed.'); } });
  },
  'restore-levy'(el) { API.restoreLevy(el.dataset.id); toast('Levy restored.', 'ok'); renderView(); }
});
