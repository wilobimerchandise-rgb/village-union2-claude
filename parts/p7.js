
/* =========================================================
   OWNER (MASTER ADMIN)
   Hidden from every village. Opened only by adding #owner to the
   page address. The owner can open any village with full admin
   control, pause a village, rename it and manage its admins.
   Owner changes inside a village are logged there as
   "VillageVault support" so records stay accountable without
   exposing who the owner is.
   ========================================================= */
function vlog() { /* Owner activity is never written into a village's log. It is kept only in the owner's own log (olog). */ }
function olog(action, village, detail) {
  OWN.data.log.push({ id: 'O' + (OWN.data.log.length + 1), ts: stamp(), action, village: village || 'All villages', detail });
}
function saveAll(v) { if (v && !DB.save(v)) warnStorage(); OWN.save(); }
const requireOwner = () => { if (!S.owner) throw new Error('Only the owner can do this.'); };
const ADMIN_TITLES = ['Chairman', 'Financial Secretary', 'Treasurer', 'Secretary', 'Auditor', 'Admin'];
/* Admin roles: only the owner can add or remove roles. Two people can never hold the same role in one village. */
function getRoles() { try { const r = JSON.parse(lsGet('vv_roles_v1') || 'null'); if (Array.isArray(r) && r.length) return r.map(x => x === 'President General' ? 'Chairman' : x); } catch (_) {} return ADMIN_TITLES.slice(); }
const roleHolder = (v, title, exceptId) => v.users.find(u => u.role === 'admin' && u.title === title && u.id !== exceptId);
function roleOptsFor(v, sel, exceptId) { const roles = getRoles(), list = sel && !roles.includes(sel) ? roles.concat([sel]) : roles; return list.map(t => { const h = roleHolder(v, t, exceptId); return `<option value="${esc(t)}"${t === sel ? ' selected' : ''}${h ? ' disabled' : ''}>${esc(t)}${h ? ' (held by ' + esc(h.name) + ')' : ''}</option>`; }).join(''); }
const assertRoleFree = (v, title, exceptId) => { if (!getRoles().includes(title)) throw new Error('Choose a valid admin role.'); const h = roleHolder(v, title, exceptId); if (h) throw new Error(`${title} is already held by ${h.name}. Two people cannot hold the same admin role.`); };

const OWNER_API = {
  async changePassword(cur, nw) {
    requireOwner(); const o = OWN.data;
    if (await hashPw('owner', o.id, cur) !== o.hash) throw new Error('Your current password is not correct.');
    o.hash = await hashPw('owner', o.id, nw); o.defaultPw = false; olog('Changed owner password', '', 'Owner password changed'); OWN.save();
  },
  manageVillage(id, d) {
    requireOwner(); const v = DB.cache[id], vil = VILLAGES.find(x => x.id === id), ch = [];
    if (d.name !== undefined && v.name !== d.name) { ch.push(`Name: ${v.name} to ${d.name}`); v.name = d.name; vil.name = d.name; OWN.data.names[id] = d.name; }
    const was = v.status || 'active'; if (d.status !== undefined && was !== d.status) { ch.push(d.status === 'suspended' ? 'Access paused' : d.status === 'readonly' ? 'Access restricted to read-only' : 'Access restored'); v.status = d.status; }
    if (d.plan && d.plan !== v.plan) { ch.push(`Plan: ${v.plan} to ${d.plan}`); v.plan = d.plan; }
    if (d.removed != null && !!d.removed !== !!vil.removed) { ch.push(d.removed ? 'Removed from the platform' : 'Restored to the platform'); vil.removed = !!d.removed; OWN.data.removed[id] = !!d.removed; if (!d.removed) delete OWN.data.removed[id]; }
    if (!ch.length) throw new Error('Nothing was changed.');
    if (d.name !== undefined) setPubName(id, v.name);
    olog('Village settings changed', v.name, ch.join('; ') + (d.note ? `. Note: ${d.note}` : '')); saveAll(v);
  },
  async addAdmin(v, d) {
    requireOwner(); assertRoleFree(v, d.title);
    const n = Math.max(0, ...v.users.filter(u => u.role === 'admin').map(u => Number(u.id.split('-A')[1]) || 0)) + 1, id = `${v.code}-A${pad(n)}`;
    const h = await hashPw(v.id, id, d.password);
    v.users.push({ id, name: d.name, role: 'admin', title: d.title, family: '', kindred: '', phone: d.phone, email: '', joined: today(), active: true, hash: h });
    vlog(v, 'Added admin', id, `${d.name} (${d.title})`); olog('Added village admin', v.name, `${d.name} (${id})`); saveAll(v); return id;
  },
  editAdmin(v, id, d) {
    requireOwner(); const u = v.users.find(x => x.id === id && x.role === 'admin'); if (!u) throw new Error('Admin not found.');
    if (d.title !== u.title) assertRoleFree(v, d.title, id);
    const ch = []; ['name', 'title', 'phone'].forEach(k => { if ((u[k] || '') !== (d[k] || '')) { ch.push(`${cap(k)}: ${u[k] || 'blank'} to ${d[k] || 'blank'}`); u[k] = d[k]; } });
    const act = d.active === 'yes'; if (act !== u.active) { ch.push(act ? 'Account activated' : 'Account deactivated'); u.active = act; }
    if (!ch.length) throw new Error('Nothing was changed.');
    vlog(v, 'Edited admin', id, `${u.name}: ${ch.join('; ')}`); olog('Edited village admin', v.name, `${u.name} (${id}): ${ch.join('; ')}`); saveAll(v);
  },
  async resetAdminPw(v, id, pw) {
    requireOwner(); const u = v.users.find(x => x.id === id && x.role === 'admin'); if (!u) throw new Error('Admin not found.');
    u.hash = await hashPw(v.id, id, pw); vlog(v, 'Reset admin password', id, `Password reset for ${u.name}`); olog('Reset admin password', v.name, `${u.name} (${id})`); saveAll(v);
  }
};

/* ---------- Owner sign-in ---------- */
function openOwnerLogin() { $('#ownerModal').hidden = false; document.body.classList.add('no-scroll'); formError('', 'ownerError'); setTimeout(() => { const i = $('#ownId'); if (i) i.focus(); }, 40); }
function closeOwnerLogin() {
  $('#ownerModal').hidden = true; document.body.classList.remove('no-scroll'); $('#ownerForm').reset();
  if (location.hash === '#owner') history.replaceState(null, '', location.pathname + location.search);
}
function ownFail() { let s = { n: 0, until: 0, k: 0, last: 0 }; try { s = Object.assign(s, JSON.parse(lsGet('vv_ownfail') || 'null') || {}); } catch (_) {} if (s.last && Date.now() - s.last > 3600000) s = { n: 0, until: 0, k: 0, last: 0 }; return s; }
function ownFailSave(s) { s.last = Date.now(); lsSet('vv_ownfail', JSON.stringify(s)); }
async function doOwnerLogin(e) {
  e.preventDefault(); const fd = new FormData(e.target), err = m => formError(m, 'ownerError'); err('');
  const id = (fd.get('id') || '').trim().toUpperCase(), pw = fd.get('pw') || '';
  if (!id || !pw) return err('Enter the owner ID or email and the password.');
  const ol = ownFail(); if (Date.now() < ol.until) return err(`Too many tries. Wait ${ol.until - Date.now() > 90000 ? Math.ceil((ol.until - Date.now()) / 60000) + ' minutes' : Math.ceil((ol.until - Date.now()) / 1000) + ' seconds'} and try again.`);
  const btn = $('#ownerBtn'); btn.disabled = true;
  try {
    const o = await OWN.load();
    if ((id !== o.id.toUpperCase() && id !== o.email.toUpperCase()) || await hashPw('owner', o.id, pw) !== o.hash) { const f = ownFail(); f.n++; if (f.n >= 5) { f.n = 0; f.k++; f.until = Date.now() + Math.min(900, 30 * Math.pow(10, f.k - 1)) * 1000; } ownFailSave(f); return err('The owner ID or password is not correct.'); }
    ownFailSave({ n: 0, until: 0, k: 0 }); closeOwnerLogin(); ssSet('vv_sess', JSON.stringify({ owner: true })); await enterOwner();
  } catch (ex) { err(ex.message || 'Could not sign in.'); } finally { btn.disabled = false; }
}
async function enterOwner(silent) {
  await OWN.load(); await Promise.all(allTenants().map(v => DB.load(v.id)));
  S.owner = true; S.v = null; S.u = null; S.page = 'o-overview'; S.f = {};
  $('#site').hidden = true; $('#ownerModal').hidden = true; $('#app').hidden = false; renderApp(); window.scrollTo(0, 0);
  if (!silent) toast('Owner console opened.', 'ok');
}
function ownerBack() { S.v = null; S.u = null; S.page = 'o-overview'; S.f = {}; document.body.classList.remove('side-open'); renderApp(); window.scrollTo(0, 0); }
async function openVillageAsOwner(id) {
  requireOwner(); const v = await DB.load(id);
  S.v = v; S.u = { id: 'SUPPORT', name: 'Village office', role: 'admin', title: 'Admin', active: true, phone: '', joined: today() };
  S.page = 'overview'; S.f = {}; olog('Opened village dashboard', v.name, 'Owner opened the admin dashboard'); OWN.save(); renderApp(); window.scrollTo(0, 0);
}

/* ---------- Owner views ---------- */
function vStats(v) {
  const yr = new Date().getFullYear(), ver = v.tx.filter(t => t.status === 'verified'), ex = v.expenses.filter(e => e.status !== 'void'), pend = v.tx.filter(t => t.status === 'pending');
  return { members: v.users.filter(u => u.role === 'member' && u.active).length, admins: v.users.filter(u => u.role === 'admin' && u.active).length, collected: sum(ver.filter(t => yearOf(t.date) === yr)), spent: sum(ex.filter(e => yearOf(e.date) === yr)), balance: sum(ver) - sum(ex), pending: pend.length, pendingAmt: sum(pend) };
}
const statusBadge = v => { const vil = VILLAGES.find(x => x.id === v.id); return (vil && vil.removed) ? '<span class="badge b-void">Removed</span>' : (v.status === 'suspended') ? '<span class="badge b-rejected">Paused</span>' : (v.status === 'readonly') ? '<span class="badge b-pending">Read-only</span>' : '<span class="badge b-active">Active</span>'; };
const planBadge = v => v.plan === 'premium' ? '<span class="badge b-admin">Premium</span>' : '<span class="badge b-off">Basic</span>';
const vDot = vil => `<span class="dot" style="background:${vil.color}"></span>`;

const OWNERV = {
  'o-overview'() {
    const rows = VILLAGES.map(vil => ({ vil, v: DB.cache[vil.id] })).filter(r => r.v).map(r => Object.assign(r, { st: aggStats(r.vil) })), yr = new Date().getFullYear();
    const tot = k => rows.reduce((a, r) => a + r.st[k], 0), live = rows.filter(r => r.v.status !== 'suspended' && !r.vil.removed).length;
    return `${OWN.data.defaultPw ? `<div class="owner-banner"><div><b>Change the default owner password.</b> Anyone who knows it can open every village.</div><button class="btn btn-saffron btn-sm" type="button" data-act="change-pw">Change password</button></div>` : ''}
    <div class="kpis">${kpi('Collected in ' + yr, money(tot('collected')), 'All villages together', 'hot')}${kpi('Waiting for verification', String(tot('pending')), money(tot('pendingAmt')))}${kpi('Active members', String(tot('members')), `${tot('admins')} active admins`)}${kpi('Villages open', `${live} of ${rows.length}`, live < rows.length ? 'Some villages are paused' : 'All villages running')}</div>
    <section class="panel"><div class="panel-h"><div><h2>Collections by village in ${yr}</h2><p>Verified payments only</p></div></div>${barChart(rows.map(r => ({ label: r.vil.code, title: r.v.name, value: r.st.collected })))}</section>
    ${plansPanel(rows)}
    <section class="panel"><div class="panel-h"><div><h2>Every village at a glance</h2><p>Open any village to work in it with full admin control.</p></div></div>
    ${table(['Village', { t: 'Members', num: true }, { t: 'Collected ' + yr, num: true }, { t: 'Spent ' + yr, num: true }, { t: 'Balance', num: true }, { t: 'Waiting', num: true }, 'Plan', 'Status', ''], rows.map(r => [`${vDot(r.vil)}${esc(r.v.name)}<small>${esc(r.vil.code)}</small>`, String(r.st.members), money(r.st.collected), money(r.st.spent), money(r.st.balance), String(r.st.pending), planBadge(r.v), statusBadge(r.v), `<div class="actions">${r.vil.type === 'association' ? `<button class="btn btn-primary btn-sm" type="button" data-act="owner-open" data-id="${r.vil.id}">Open dashboard</button>` : activeWings(r.vil).map(w => `<button class="btn btn-primary btn-sm" type="button" data-act="owner-open" data-id="${w.id}">${esc(wingLabel(w.wing))}</button>`).join('')}<button class="btn btn-ghost btn-sm" type="button" data-act="owner-manage" data-id="${r.vil.id}">Manage</button></div>`]), ['No villages loaded', ''])}</section>`;
  },
  'o-villages'() {
    const rows = VILLAGES.map(vil => ({ vil, v: DB.cache[vil.id] })).filter(r => r.v);
    return `<section class="panel"><div class="panel-h"><div><h2>Villages and associations</h2><p>Edit the name or plan, restrict access, or remove one from the platform. Nothing is erased: a removed village can be restored.</p></div></div>
    ${table(['Village or association', 'Code', 'Plan', { t: 'Admins', num: true }, { t: 'Members', num: true }, 'Access', ''], rows.map(r => { const st = aggStats(r.vil); return [`${vDot(r.vil)}${esc(r.v.name)}${r.vil.type === 'association' ? '<small>No wings</small>' : `<small>${['men', 'women'].map(k => wingLabel(k) + (wingOn(r.vil, k) ? ' on' : ' off')).join(' · ')}</small>`}`, esc(r.vil.code), planBadge(r.v), String(st.admins), String(st.members), statusBadge(r.v), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="owner-manage" data-id="${r.vil.id}">Edit or restrict</button>${r.vil.type === 'association' ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="owner-wings" data-id="${r.vil.id}">Wings</button>`}${r.vil.removed ? `<button class="btn btn-leaf btn-sm" type="button" data-act="owner-restore" data-id="${r.vil.id}">Restore</button>` : `<button class="btn btn-danger btn-sm" type="button" data-act="owner-remove" data-id="${r.vil.id}">Remove</button>`}<button class="btn btn-ghost btn-sm" type="button" data-act="owner-admins" data-id="${r.vil.id}">Admins</button><button class="btn btn-primary btn-sm" type="button" data-act="owner-open" data-id="${r.vil.id}">Open</button></div>`]; }), ['No villages', ''])}</section>`;
  },
  'o-admins'() {
    const f = S.f, vid = f.village || VILLAGES[0].id, v = DB.cache[vid], admins = v.users.filter(u => u.role === 'admin');
    return `<section class="panel"><div class="panel-h"><div><h2>Admins of a village</h2><p>Admins can verify, edit and record everything in their own village only.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="o-add-admin" data-id="${esc(vid)}">Add admin</button></div>
    <div class="toolbar"><div class="field"><label for="oaV">Village</label><select id="oaV" class="select" data-filter="village">${VILLAGES.map(x => opt(x.id, `${x.name} (${x.code})`, vid)).join('')}</select></div></div>
    ${table(['Admin', 'Role', 'Phone', 'Account', ''], admins.map(a => [`${esc(a.name)}<small>${esc(a.id)}</small>`, esc(a.title), esc(a.phone || '-'), a.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>', `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="o-edit-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="o-reset-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Reset password</button></div>`]), ['This village has no admins', 'Add one so the village can verify payments.'])}</section>`;
  },
  'o-log'() {
    const f = S.f, names = Array.from(new Set(OWN.data.log.map(l => l.village))).sort();
    const list = OWN.data.log.filter(l => !f.village || l.village === f.village).slice().sort((a, b) => b.ts.localeCompare(a.ts)), page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Everything you have done as owner</h2><p>Only you can see this log.</p></div></div>
    <div class="toolbar"><div class="field"><label for="olV">Village</label><select id="olV" class="select" data-filter="village">${opt('', 'All villages', f.village)}${names.map(n => opt(n, n, f.village)).join('')}</select></div></div>
    ${table(['When', 'Village', 'Action', 'Details'], page.map(l => [`<span class="nowrap">${esc(fmtTS(l.ts))}</span>`, esc(l.village), esc(l.action), esc(l.detail)]), ['Nothing yet', 'Your actions will be listed here.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
  },
  'o-account'() {
    return `<section class="panel" style="max-width:640px"><div class="panel-h"><h2>Owner account</h2></div><dl class="kv"><dt>Owner ID</dt><dd>${esc(OWN.data.id)}</dd><dt>Name</dt><dd>${esc(OWN.data.name)}</dd><dt>Visible to villages</dt><dd>No. Villages never see this account.</dd></dl>
    ${OWN.data.defaultPw ? '<div class="form-error">You are still using the default password. Change it now.</div>' : ''}<div style="margin-top:18px"><button class="btn btn-primary" type="button" data-act="change-pw">Change password</button></div></section>`;
  }
};
VIEWS.owner = OWNERV;

/* ---------- Owner actions ---------- */
Object.assign(ACTIONS, {
  'owner-open'(el) { openVillageAsOwner(el.dataset.id).catch(ex => toast(ex.message, 'err')); },
  'owner-admins'(el) { S.page = 'o-admins'; S.f = { village: el.dataset.id }; renderView(); window.scrollTo(0, 0); },
  'owner-manage'(el) {
    const v = DB.cache[el.dataset.id];
    openModal({ title: `Edit ${v.name}`, sub: 'Renaming changes the name everywhere. Paused blocks everyone from signing in. Read-only lets people look but not change anything.',
      body: `<div class="field"><label for="omN">Village or association name</label><input id="omN" name="name" class="input" maxlength="40" value="${esc(v.name)}" required></div>
      <div class="form-row"><div class="field"><label for="omS">Access</label><select id="omS" name="status" class="select">${opt('active', 'Active', v.status || 'active')}${opt('readonly', 'Restricted: read-only', v.status || 'active')}${opt('suspended', 'Paused: no sign-in', v.status || 'active')}</select></div>
      <div class="field"><label for="omPl">Plan</label><select id="omPl" name="plan" class="select">${opt('basic', 'Basic', v.plan)}${opt('premium', 'Premium (receipts carry the village name and logo)', v.plan)}</select></div></div>
      <div class="field"><label for="omNote">Note for your log (optional)</label><input id="omNote" name="note" class="input" maxlength="120"></div>`, submit: 'Save changes',
      onSubmit: fd => { const n = (fd.get('name') || '').trim(); if (n.length < 2) throw new Error('Enter a village name.'); OWNER_API.manageVillage(v.id, { name: n, status: fd.get('status'), plan: fd.get('plan'), note: (fd.get('note') || '').trim() }); fillVillageSelects(); done('Village updated.'); } });
  },
  'owner-wings'(el) {
    const vil = VILLAGES.find(x => x.id === el.dataset.id), sel = k => `<div class="field"><label for="ow${k}">${esc(wingLabel(k))}</label><select id="ow${k}" name="${k}" class="select">${opt('on', 'On: members can sign in', wingOn(vil, k) ? 'on' : 'off')}${opt('off', 'Off: hidden from sign-in, records kept', wingOn(vil, k) ? 'on' : 'off')}</select></div>`;
    openModal({ title: `Wings of ${vil.name}`, sub: 'Add or remove a wing. Switching a wing off hides it from the sign-in list; nothing is erased and you can switch it on again.', body: `<div class="form-row">${sel('men')}${sel('women')}</div>`, submit: 'Save wings',
      onSubmit: fd => { let n = 0; ['men', 'women'].forEach(k => { const on = fd.get(k) === 'on'; if (wingOn(vil, k) !== on) { OWNER_API.setWing(vil.id, k, on); n++; } }); if (!n) throw new Error('Nothing was changed.'); fillVillageSelects(); done('Wings saved.'); } });
  },
  'owner-remove'(el) {
    const v = DB.cache[el.dataset.id];
    openModal({ title: `Remove ${v.name}?`, danger: true, sub: 'It disappears from the sign-in list and nobody in it can sign in. Its records are kept safe and you can restore it at any time.', body: `<div class="field"><label for="orT">Type the name to confirm</label><input id="orT" name="confirm" class="input" autocomplete="off" required></div>`, submit: 'Remove from platform',
      onSubmit: fd => { if ((fd.get('confirm') || '').trim().toLowerCase() !== v.name.toLowerCase()) throw new Error('Type the exact name to confirm.'); OWNER_API.manageVillage(v.id, { removed: true }); fillVillageSelects(); done(`${v.name} removed.`); } });
  },
  'owner-restore'(el) { const v = DB.cache[el.dataset.id]; OWNER_API.manageVillage(v.id, { removed: false }); fillVillageSelects(); toast(`${v.name} restored.`, 'ok'); renderView(); },
  'o-add-admin'(el) {
    const v = DB.cache[el.dataset.id], pw = 'Ad' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: `Add an admin to ${v.name}`, sub: 'Give the admin their ID and password. They can change the password after signing in.',
      body: `<div class="field"><label for="oaN">Full name</label><input id="oaN" name="name" class="input" maxlength="80" required></div><div class="form-row"><div class="field"><label for="oaT">Role</label><select id="oaT" name="title" class="select">${roleOptsFor(v, '', '')}</select></div><div class="field"><label for="oaP">Phone</label><input id="oaP" name="phone" class="input" type="tel" maxlength="20"></div></div><div class="field"><label for="oaPw">Starting password</label><input id="oaPw" name="password" class="input" type="text" value="${pw}" minlength="6" required></div>`, submit: 'Add admin',
      onSubmit: async fd => { const n = (fd.get('name') || '').trim(), p = fd.get('password') || ''; if (n.length < 3) throw new Error('Enter the admin’s full name.'); if (p.length < 6) throw new Error('The password needs at least 6 characters.'); const id = await OWNER_API.addAdmin(v, { name: n, title: fd.get('title'), phone: (fd.get('phone') || '').trim(), password: p }); done(`Admin added. Their ID is ${id}.`); } });
  },
  'o-edit-admin'(el) {
    const v = DB.cache[el.dataset.v], u = v.users.find(x => x.id === el.dataset.id);
    openModal({ title: 'Edit admin', sub: `${esc(u.id)}, ${esc(v.name)}`,
      body: `<div class="field"><label for="oeN">Full name</label><input id="oeN" name="name" class="input" value="${esc(u.name)}" required></div><div class="form-row"><div class="field"><label for="oeT">Role</label><select id="oeT" name="title" class="select">${roleOptsFor(v, u.title, u.id)}</select></div><div class="field"><label for="oeP">Phone</label><input id="oeP" name="phone" class="input" type="tel" value="${esc(u.phone || '')}"></div></div><div class="field"><label for="oeA">Account</label><select id="oeA" name="active" class="select">${opt('yes', 'Active', u.active ? 'yes' : 'no')}${opt('no', 'Deactivated', u.active ? 'yes' : 'no')}</select></div>`, submit: 'Save changes',
      onSubmit: fd => { const n = (fd.get('name') || '').trim(); if (n.length < 3) throw new Error('Enter the admin’s full name.'); OWNER_API.editAdmin(v, u.id, { name: n, title: fd.get('title'), phone: (fd.get('phone') || '').trim(), active: fd.get('active') }); done('Admin updated.'); } });
  },
  'o-reset-admin'(el) {
    const v = DB.cache[el.dataset.v], u = v.users.find(x => x.id === el.dataset.id), pw = 'Ad' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Reset admin password', sub: `${esc(u.name)} (${esc(u.id)}), ${esc(v.name)}`, body: `<div class="field"><label for="orP">New password</label><input id="orP" name="password" class="input" type="text" value="${pw}" minlength="6" required><span class="hint">Tell the admin this password. It is not stored in readable form.</span></div>`, submit: 'Reset password',
      onSubmit: async fd => { const p = fd.get('password') || ''; if (p.length < 6) throw new Error('The password needs at least 6 characters.'); await OWNER_API.resetAdminPw(v, u.id, p); done('Password reset.'); } });
  }
});

