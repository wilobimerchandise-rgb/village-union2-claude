/* =========================================================
   ROUND 6-7: the Lead Admin assigns and removes admin duties
   (the owner can do it too). One person per role.
   ========================================================= */
const isLeadAdmin = () => !!S.u && (S.owner || (S.u.role === 'admin' && !!S.u.lead));
const requireLead = () => { requireAdmin(); if (!isLeadAdmin()) throw new Error('Only the Lead Admin can assign or remove admin duties.'); };
Object.assign(API, {
  appointAdmin(memberId, title) {
    requireLead(); requireWritable(); const u = userById(memberId);
    if (!u || u.role !== 'member' || !u.active) throw new Error('Choose an active member to appoint.');
    assertRoleFree(S.v, title);
    u.role = 'admin'; u.title = title; log('Appointed admin', u.id, `${u.name} now serves as ${title}`); commit(); return u;
  },
  assignDuty(adminId, title) {
    requireLead(); requireWritable(); const u = userById(adminId);
    if (!u || u.role !== 'admin') throw new Error('Admin not found.');
    if (u.title === title) throw new Error('That is already their duty.'); assertRoleFree(S.v, title, adminId);
    const was = u.title; u.title = title; log('Changed admin duty', u.id, `${u.name}: ${was} to ${title}`); commit(); return u;
  },
  removeAdmin(adminId, reason) {
    requireLead(); requireWritable(); const u = userById(adminId);
    if (!u || u.role !== 'admin') throw new Error('Admin not found.'); if (u.lead) throw new Error('The Lead Admin can only be changed by the owner.');
    if (S.v.users.filter(x => x.role === 'admin' && x.active).length < 2) throw new Error('A village must keep at least one admin.');
    const was = u.title; u.role = 'member'; u.title = ''; u.rememberTokens = []; log('Removed admin duties', u.id, `${u.name} (${was}) is now an ordinary member: ${reason}`); commit(); return u;
  }
});
ADMIN.admins = function () {
  const lead = isLeadAdmin(), admins = S.v.users.filter(u => u.role === 'admin').sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0) || a.id.localeCompare(b.id));
  return `<section class="panel"><div class="panel-h"><div><h2>Admins and duties</h2><p>${lead ? 'As Lead Admin you decide who serves as an admin and what their duty is. Each duty can be held by one person only.' : 'Only the Lead Admin can appoint admins, change duties or remove them. Everyone can see who serves.'}</p></div>${lead ? '<button class="btn btn-primary btn-sm" type="button" data-act="appoint-admin">Appoint an admin</button>' : ''}</div>
  ${table(['Admin', 'Duty', 'Phone', 'Account', ''], admins.map(u => [`${linkBtn('member-profile', u.id, u.name)}<small>${esc(u.id)}${u.lead ? ' · Lead Admin' : ''}</small>`, esc(u.title || 'Admin'), esc(u.phone || '-'), u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>',
    lead ? `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="edit-admin" data-id="${esc(u.id)}">Edit details</button><button class="btn btn-ghost btn-sm" type="button" data-act="assign-duty" data-id="${esc(u.id)}">Change duty</button>${u.lead ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="remove-admin" data-id="${esc(u.id)}">Remove</button>`}</div>` : (S.u && S.u.id === u.id ? `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="edit-admin" data-id="${esc(u.id)}">Edit my details</button></div>` : '')]), ['No admins', ''])}</section>`;
};
VIEWS.admin.admins = ADMIN.admins;
Object.assign(ACTIONS, {
  'appoint-admin'() {
    requireLead(); const members = S.v.users.filter(u => u.role === 'member' && u.active).sort((a, b) => a.name.localeCompare(b.name));
    openModal({ title: 'Appoint an admin', sub: 'The member keeps their own login and gains admin access. A duty can be held by one person only.',
      body: `<div class="field"><label for="apM">Member</label><select id="apM" name="member" class="select" required>${opt('', 'Choose a member', '')}${members.map(u => opt(u.id, `${u.name} (${u.id})`, '')).join('')}</select></div><div class="field"><label for="apT">Duty</label><select id="apT" name="title" class="select">${roleOptsFor(S.v, '', '')}</select></div>`, submit: 'Appoint admin',
      onSubmit: fd => { if (!fd.get('member')) throw new Error('Choose the member.'); const u = API.appointAdmin(fd.get('member'), fd.get('title')); done(`${u.name} is now an admin.`); } });
  },
  'assign-duty'(el) {
    requireLead(); const u = userById(el.dataset.id);
    openModal({ title: 'Change duty', sub: `${esc(u.name)}, now ${esc(u.title || 'Admin')}.`, body: `<div class="field"><label for="adT">New duty</label><select id="adT" name="title" class="select">${roleOptsFor(S.v, u.title, u.id)}</select></div>`, submit: 'Save duty',
      onSubmit: fd => { API.assignDuty(u.id, fd.get('title')); done('Duty updated.'); } });
  },
  'remove-admin'(el) {
    requireLead(); const u = userById(el.dataset.id);
    openModal({ title: 'Remove admin duties?', danger: true, sub: `${esc(u.name)} becomes an ordinary member straight away and no longer appears on the admin page. They keep their login but can no longer verify, edit or record anything.`, body: `<div class="field"><label for="raR">Reason</label><textarea id="raR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Remove admin duties',
      onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Give a short reason.'); API.removeAdmin(u.id, r); done('Admin duties removed. They are now a member.'); } });
  }
});
