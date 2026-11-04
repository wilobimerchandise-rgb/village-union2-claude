/* =========================================================
   ROUND 7: owner controls admins, Lead Admin, roles and villages
   ========================================================= */
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'village';
Object.assign(OWNER_API, {
  appointAdmin(v, memberId, title) {
    requireOwner(); const u = v.users.find(x => x.id === memberId);
    if (!u || u.role !== 'member' || !u.active) throw new Error('Choose an active member.'); assertRoleFree(v, title);
    u.role = 'admin'; u.title = title; olog('Appointed village admin', v.name, `${u.name} (${u.id}) as ${title}`); saveAll(v);
  },
  removeAdmin(v, id, reason) {
    requireOwner(); const u = v.users.find(x => x.id === id && x.role === 'admin'); if (!u) throw new Error('Admin not found.');
    if (v.users.filter(x => x.role === 'admin' && x.active).length < 2) throw new Error('A village must keep at least one active admin. Add another first.');
    const was = u.title; u.role = 'member'; u.title = ''; u.lead = false; u.rememberTokens = [];
    olog('Removed village admin', v.name, `${u.name} (${u.id}, ${was}) is now a member: ${reason}`); saveAll(v);
  },
  assignLead(v, id, title) {
    requireOwner(); const u = v.users.find(x => x.id === id); if (!u || !u.active) throw new Error('Choose an active person.');
    if (u.role === 'member') { assertRoleFree(v, title); u.role = 'admin'; u.title = title; }
    v.users.forEach(x => { if (x.lead) x.lead = false; }); u.lead = true;
    olog('Assigned Lead Admin', v.name, `${u.name} (${u.id})`); saveAll(v);
  },
  removeLead(v) {
    requireOwner(); const l = v.users.find(x => x.lead); if (!l) throw new Error('This village has no Lead Admin.');
    l.lead = false; olog('Removed Lead Admin', v.name, `${l.name} (${l.id}) stays an ordinary admin`); saveAll(v);
  },
  addRole(name) {
    requireOwner(); const n = (name || '').trim(); if (n.length < 3 || n.length > 40) throw new Error('Role names need 3 to 40 characters.');
    const roles = getRoles(); if (roles.some(r => r.toLowerCase() === n.toLowerCase())) throw new Error('That role already exists.');
    roles.push(n); lsSet('vv_roles_v1', JSON.stringify(roles)); olog('Created admin role', '', n); OWN.save();
  },
  removeRole(name) {
    requireOwner(); const users = Object.values(DB.cache).flatMap(v => v.users.filter(u => u.role === 'admin' && u.title === name).map(u => `${u.name} (${v.name})`));
    if (users.length) throw new Error(`${name} is held by ${users.slice(0, 2).join(', ')}${users.length > 2 ? ' and others' : ''}. Move them to another role first.`);
    const roles = getRoles().filter(r => r !== name); if (!roles.length) throw new Error('Keep at least one role.');
    lsSet('vv_roles_v1', JSON.stringify(roles)); olog('Removed admin role', '', name); OWN.save();
  },
  async addVillage(d) {
    requireOwner(); const name = (d.name || '').trim(), code = (d.code || '').trim().toUpperCase();
    if (name.length < 2 || name.length > 40) throw new Error('Enter the village or association name (2 to 40 characters).');
    if (!/^[A-Z0-9]{2,5}$/.test(code)) throw new Error('The code must be 2 to 5 letters or numbers.');
    if (VILLAGES.some(v => v.code === code)) throw new Error('Another village already uses that code.');
    if (VILLAGES.some(v => v.name.toLowerCase() === name.toLowerCase())) throw new Error('A village with that name already exists.');
    if ((d.leadName || '').trim().length < 3) throw new Error('Enter the Lead Admin’s full name.'); if ((d.password || '').length < 6) throw new Error('The password needs at least 6 characters.');
    let id = slug(name), k = 1; while (VILLAGES.some(v => v.id === id)) id = slug(name) + (++k);
    const settings = { levies: {} }; LEVIES.forEach(l => { settings.levies[l.id] = l.def; }); settings.accounts = []; settings.payNote = 'Pay into the account above, then upload your proof of payment on this site. Never pay cash to anyone except the treasurer.';
    const uid = `${code}-A01`, hash = await hashPw(id, uid, d.password);
    const data = { id, name, code, type: d.type === 'association' ? 'association' : 'village', settings, plan: d.plan === 'premium' ? 'premium' : 'basic', status: 'active', logo: null, meetings: [], tx: [], expenses: [], audit: [], seq: { tx: 0, exp: 0, aud: 0, mbr: 0 }, seededAt: stamp(),
      users: [{ id: uid, name: d.leadName.trim(), role: 'admin', title: getRoles()[0], lead: true, family: '', kindred: '', phone: (d.phone || '').trim(), email: '', joined: today(), active: true, hash }] };
    migrate(data); if (!lsSet('vv_v1_' + id, JSON.stringify(data))) throw new Error('The browser storage is full.');
    DB.cache[id] = data; VILLAGES.push({ id, name, code, type: data.type, color: PALETTE[VILLAGES.length % PALETTE.length], tag: 'Added ' + new Date().getFullYear(), custom: true }); saveExtraVillages();
    olog('Added village', name, `${code}, ${data.type}, ${data.plan} plan, Lead Admin ${data.users[0].name} (${uid})`); OWN.save(); return { id, uid };
  },
  deleteVillage(id) {
    requireOwner(); const vil = VILLAGES.find(x => x.id === id); if (!vil || !vil.custom) throw new Error('Only villages you created can be deleted for good. Use Remove for the others.');
    VILLAGES.splice(VILLAGES.indexOf(vil), 1); saveExtraVillages(); delete DB.cache[id]; try { localStorage.removeItem('vv_v1_' + id); } catch (_) {}
    olog('Deleted village', vil.name, `${vil.code} deleted for good`); OWN.save();
  }
});
const OADM = v => v.users.filter(u => u.role === 'admin').sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0) || a.id.localeCompare(b.id));
OWNERV['o-admins'] = function () {
  const f = S.f, vid = tenantList().some(x => x.id === f.village) ? f.village : tenantList()[0].id, v = DB.cache[vid], admins = OADM(v), lead = admins.find(u => u.lead), roles = getRoles();
  const held = r => Object.values(DB.cache).reduce((a, x) => a + x.users.filter(u => u.role === 'admin' && u.title === r).length, 0);
  return `<section class="panel"><div class="panel-h"><div><h2>Admins of a village</h2><p>Create, appoint and remove admins in any village or association. Each role can be held by one person per village.</p></div><div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="o-appoint" data-id="${esc(vid)}">Appoint a member</button><button class="btn btn-primary btn-sm" type="button" data-act="o-add-admin" data-id="${esc(vid)}">Add new admin</button></div></div>
    <div class="toolbar"><div class="field"><label for="oaV">Village or association</label><select id="oaV" class="select" data-filter="village">${tenantList().map(x => opt(x.id, `${x.name} (${x.code})`, vid)).join('')}</select></div></div>
    <div class="callout${lead ? ' ok' : ''}"><div><b>Lead Admin: ${lead ? esc(lead.name) + ' (' + esc(lead.id) + ')' : 'none assigned'}</b><p>The Lead Admin appoints admins and assigns their duties inside the village. Only you can change who it is.</p></div><div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="o-lead" data-v="${esc(vid)}">${lead ? 'Change Lead Admin' : 'Assign Lead Admin'}</button>${lead ? `<button class="btn btn-ghost btn-sm" type="button" data-act="o-unlead" data-v="${esc(vid)}">Remove Lead Admin</button>` : ''}</div></div>
    ${table(['Admin', 'Role', 'Phone', 'Account', ''], admins.map(a => [`${esc(a.name)}<small>${esc(a.id)}${a.lead ? ' · Lead Admin' : ''}</small>`, esc(a.title || '-'), esc(a.phone || '-'), a.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>', `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="o-edit-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="o-reset-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Reset password</button>${a.lead ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="o-lead" data-v="${esc(vid)}" data-id="${esc(a.id)}">Make Lead</button>`}${a.totp ? `<button class="btn btn-ghost btn-sm" type="button" data-act="o-reset-2fa" data-v="${esc(vid)}" data-id="${esc(a.id)}">Reset 2-step</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="o-remove-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Remove</button></div>`]), ['This village has no admins', 'Add one so the village can verify payments.'])}</section>
  <section class="panel"><div class="panel-h"><div><h2>Admin roles</h2><p>Only you can create or remove roles. They apply to every village and association.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="o-add-role">Create a role</button></div>
    ${table(['Role', { t: 'Held by', num: true }, ''], roles.map(r => [esc(r), `${held(r)} admin${held(r) === 1 ? '' : 's'}`, `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="o-remove-role" data-name="${esc(r)}">Remove</button></div>`]), ['No roles', ''])}</section>`;
};
const _ovv = OWNERV['o-villages'];
OWNERV['o-villages'] = function () {
  const mine = VILLAGES.filter(x => x.custom);
  return `<section class="panel"><div class="panel-h"><div><h2>Add a village or association</h2><p>Creates an empty, separate record with its own Lead Admin. Nothing is shared with any other village.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="o-add-village">Add village or association</button></div>${mine.length ? table(['Created by you', 'Code', ''], mine.map(x => [esc(x.name), esc(x.code), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="o-delete-village" data-id="${esc(x.id)}">Delete for good</button></div>`]), ['', '']) : '<p class="hint">Villages you add will be listed here.</p>'}</section>` + _ovv.call(OWNERV);
};
Object.assign(ACTIONS, {
  'o-appoint'(el) {
    const v = DB.cache[el.dataset.id], members = v.users.filter(u => u.role === 'member' && u.active).sort((a, b) => a.name.localeCompare(b.name));
    openModal({ title: `Appoint an admin in ${v.name}`, sub: 'The member keeps their login and gains admin access.', body: `<div class="field"><label for="opM">Member</label><select id="opM" name="member" class="select" required>${opt('', 'Choose a member', '')}${members.map(u => opt(u.id, `${u.name} (${u.id})`, '')).join('')}</select></div><div class="field"><label for="opT">Role</label><select id="opT" name="title" class="select">${roleOptsFor(v, '', '')}</select></div>`, submit: 'Appoint admin',
      onSubmit: fd => { if (!fd.get('member')) throw new Error('Choose the member.'); OWNER_API.appointAdmin(v, fd.get('member'), fd.get('title')); done('Admin appointed.'); } });
  },
  'o-remove-admin'(el) {
    const v = DB.cache[el.dataset.v], u = v.users.find(x => x.id === el.dataset.id);
    openModal({ title: 'Remove admin role?', danger: true, sub: `${esc(u.name)} (${esc(u.id)}) becomes an ordinary member of ${esc(v.name)} and no longer appears on the admin page.`, body: `<div class="field"><label for="orR">Reason</label><textarea id="orR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Remove admin role',
      onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Give a short reason.'); OWNER_API.removeAdmin(v, u.id, r); done('Removed. They are now a member.'); } });
  },
  'o-lead'(el) {
    const v = DB.cache[el.dataset.v], pre = el.dataset.id || '', people = v.users.filter(u => u.active && (u.role === 'admin' || u.role === 'member')).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1));
    openModal({ title: `Lead Admin of ${v.name}`, sub: 'Choose any active admin or member. The current Lead Admin stays an ordinary admin.',
      body: `<div class="field"><label for="olP">Person</label><select id="olP" name="person" class="select" required>${opt('', 'Choose a person', pre)}${people.map(u => opt(u.id, `${u.name} (${u.id}${u.role === 'admin' ? ', ' + (u.title || 'Admin') : ', member'})`, pre)).join('')}</select></div><div class="field"><label for="olT">Role (only needed when you pick a member)</label><select id="olT" name="title" class="select">${roleOptsFor(v, '', '')}</select></div>`, submit: 'Assign Lead Admin',
      onSubmit: fd => { if (!fd.get('person')) throw new Error('Choose the person.'); OWNER_API.assignLead(v, fd.get('person'), fd.get('title')); done('Lead Admin assigned.'); } });
  },
  'o-unlead'(el) { const v = DB.cache[el.dataset.v]; openModal({ title: 'Remove the Lead Admin?', danger: true, sub: `They stay an ordinary admin. Until you assign a new one, nobody in ${esc(v.name)} can appoint or remove admins.`, body: '', submit: 'Remove Lead Admin', onSubmit: () => { OWNER_API.removeLead(v); done('Lead Admin removed.'); } }); },
  'o-add-role'() { openModal({ title: 'Create an admin role', sub: 'For example Assistant Secretary or PRO. It becomes available in every village and association.', body: `<div class="field"><label for="arN">Role name</label><input id="arN" name="name" class="input" maxlength="40" required></div>`, submit: 'Create role', onSubmit: fd => { OWNER_API.addRole(fd.get('name')); done('Role created.'); } }); },
  'o-remove-role'(el) { const n = el.dataset.name; openModal({ title: 'Remove this role?', danger: true, sub: `"${esc(n)}" will no longer be offered. It cannot be removed while someone holds it.`, body: '', submit: 'Remove role', onSubmit: () => { OWNER_API.removeRole(n); done('Role removed.'); } }); },
  'o-add-village'() {
    const pw = 'Vv' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Add a village or association', size: 'modal-lg', sub: 'A new, empty record with its own Lead Admin. Give the Lead Admin their ID and password.',
      body: `<div class="form-row"><div class="field"><label for="avN">Name</label><input id="avN" name="name" class="input" maxlength="40" required></div><div class="field"><label for="avC">Code (2 to 5 letters or numbers)</label><input id="avC" name="code" class="input mono" maxlength="5" style="text-transform:uppercase" required></div></div>
      <div class="form-row"><div class="field"><label for="avY">Category</label><select id="avY" name="type" class="select">${opt('village', 'Village (members have family and kindred names)', 'village')}${opt('association', 'Association (no family or kindred)', 'village')}</select></div><div class="field"><label for="avP">Plan</label><select id="avP" name="plan" class="select">${opt('basic', 'Basic', 'basic')}${opt('premium', 'Premium', 'basic')}</select></div><div class="field"><label for="avL">Lead Admin full name</label><input id="avL" name="leadName" class="input" maxlength="80" required></div></div>
      <div class="form-row"><div class="field"><label for="avT">Lead Admin phone</label><input id="avT" name="phone" class="input" type="tel" maxlength="20"></div><div class="field"><label for="avW">Starting password</label><input id="avW" name="password" class="input" type="text" value="${pw}" minlength="6" required></div></div>`, submit: 'Add village',
      onSubmit: async fd => { const r = await OWNER_API.addVillage({ name: fd.get('name'), code: fd.get('code'), type: fd.get('type'), plan: fd.get('plan'), leadName: fd.get('leadName'), phone: fd.get('phone'), password: fd.get('password') }); fillVillageSelects(); done(r.wingIds && r.wingIds.length ? `Added. The Lead Admin signs in with ${r.wingIds.map(x => x.uid + ' (' + x.label + ')').join(' and ')}.` : `Added. The Lead Admin signs in with ${r.uid}.`); } });
  },
  'o-delete-village'(el) {
    const vil = VILLAGES.find(x => x.id === el.dataset.id);
    openModal({ title: 'Delete this village for good?', danger: true, sub: `Everything in ${esc(vil.name)} is erased and cannot be restored. Type its name to confirm.`, body: `<div class="field"><label for="dvN">Village name</label><input id="dvN" name="name" class="input" autocomplete="off" required></div>`, submit: 'Delete for good',
      onSubmit: fd => { if ((fd.get('name') || '').trim().toLowerCase() !== vil.name.toLowerCase()) throw new Error('Type the village name exactly to confirm.'); OWNER_API.deleteVillage(vil.id); fillVillageSelects(); done('Village deleted.'); } });
  }
});
