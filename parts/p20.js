/* =========================================================
   ROUND 9 / #7: backup, restore and export
   Lead Admin (and the owner): download or restore a village's full records.
   Premium: automatic rolling snapshots kept in the browser (last 3, compressed).
   Owner: one file with every village.
   ========================================================= */
const BACKUP_KIND = 'villagevault-backup', BACKUP_VER = 1, BACKUP_STALE_DAYS = 7;
const stripProofs = v => { const c = JSON.parse(JSON.stringify(v)); (c.tx || []).forEach(t => { if (t.proof) { t.proof = null; t.proofStripped = true; } }); (c.expenses || []).forEach(e => { if (e.proof) { e.proof = null; e.proofStripped = true; } }); return c; };
function villageBackup(v, withProofs) { return { kind: BACKUP_KIND, version: BACKUP_VER, exportedAt: stamp(), exportedBy: S.owner ? 'VillageVault support' : (S.u ? S.u.name : ''), withProofs: !!withProofs, village: withProofs ? JSON.parse(JSON.stringify(v)) : stripProofs(v) }; }
const backupSummary = b => { const v = b.village || {}; return { name: v.name, id: v.id, members: (v.users || []).filter(u => u.role === 'member').length, admins: (v.users || []).filter(u => u.role === 'admin').length, tx: (v.tx || []).length, expenses: (v.expenses || []).length, audit: (v.audit || []).length }; };
function checkBackup(b) {
  if (!b || b.kind !== BACKUP_KIND) throw new Error('That is not a VillageVault backup file.');
  if (b.version > BACKUP_VER) throw new Error('That backup was made by a newer version of VillageVault.');
  const v = b.village; if (!v || typeof v !== 'object' || !Array.isArray(v.users) || !Array.isArray(v.tx) || !Array.isArray(v.audit)) throw new Error('The backup file is damaged or incomplete.');
  if (v.id !== S.v.id) throw new Error(`This backup belongs to ${v.name || 'another village'}. It cannot be restored into ${S.v.name}.`);
  if (!v.users.some(u => u.role === 'admin' && u.active !== false)) throw new Error('The backup has no active admin. It was not accepted.');
  return v;
}
async function gz(text) { const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')), buf = new Uint8Array(await new Response(cs).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); return btoa(s); }
async function ungz(b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
const SNAP = { key: id => 'vv_snap_' + id, load(id) { try { return JSON.parse(lsGet(this.key(id)) || '[]'); } catch (_) { return []; } }, save(id, l) { return lsSet(this.key(id), JSON.stringify(l)); } };
async function takeSnapshot(why) {
  if (typeof CompressionStream === 'undefined') return false;
  const v = S.v, list = SNAP.load(v.id), data = await gz(JSON.stringify(villageBackup(v, false)));
  list.unshift({ at: stamp(), why, kb: Math.round(data.length / 1024), data }); while (list.length > 3) list.pop();
  while (list.length && !SNAP.save(v.id, list)) list.pop(); return true;
}
const daysSince = iso => iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : Infinity;

/* ---- API ---- */
Object.assign(API, {
  noteBackup(kind, withProofs) { requireLead(); S.v.lastBackupAt = stamp(); S.v.lastBackupBy = S.owner ? 'VillageVault support' : S.u.name; log('Downloaded backup', S.v.code, `${kind}${withProofs ? ' with proof images' : ' without proof images'}`); commit(); },
  async restoreBackup(b) {
    requireLead(); requireWritable(); const nv = checkBackup(b);
    await takeSnapshot('Before restore');
    const keep = { plan: S.v.plan, status: S.v.status, code: S.v.code, name: S.v.name, logo: S.v.logo, type: S.v.type }, old = S.v, oldProofs = new Map(old.tx.filter(t => t.proof).map(t => [t.id, t.proof])), oldExp = new Map((old.expenses || []).filter(e => e.proof).map(e => [e.id, e.proof]));
    const data = JSON.parse(JSON.stringify(nv)); Object.assign(data, keep); migrate(data);
    data.tx.forEach(t => { if (!t.proof && oldProofs.has(t.id)) t.proof = oldProofs.get(t.id); delete t.proofStripped; }); (data.expenses || []).forEach(e => { if (!e.proof && oldExp.has(e.id)) e.proof = oldExp.get(e.id); delete e.proofStripped; });
    Object.keys(old).forEach(k => delete old[k]); Object.assign(old, data); REV++;
    if (!S.owner) { const me = old.users.find(u => u.id === S.u.id && u.active !== false); if (!me) { commit(); return { logout: true }; } S.u = me; }
    log('Restored backup', S.v.code, `Records restored from a backup made ${fmtTS(b.exportedAt)}`); old.lastBackupAt = old.lastBackupAt || stamp(); commit(); return {};
  },
  async restoreSnapshot(i) {
    requireLead(); requireWritable(); const s = SNAP.load(S.v.id)[i]; if (!s) throw new Error('That snapshot is no longer there.');
    return this.restoreBackup(JSON.parse(await ungz(s.data)));
  }
});

/* ---- village panel (Village profile page) ---- */
function backupPanel() {
  if (!S.u || !isLeadAdmin()) return '';
  const v = S.v, last = v.lastBackupAt, stale = daysSince(last) > BACKUP_STALE_DAYS, prem = planAllows('autoBackup'), snaps = SNAP.load(v.id);
  return `<section class="panel" id="backup"><div class="panel-h"><div><h2>Backup and restore</h2><p>Your records live in this browser. Keep a copy somewhere safe. ${last ? `Last backup: <b>${esc(fmtTS(last))}</b> by ${esc(v.lastBackupBy || 'an admin')}.` : '<b>No backup has been made yet.</b>'}</p></div>${stale ? '<span class="badge b-pending">Backup due</span>' : '<span class="badge b-active">Up to date</span>'}</div>
  <div class="btn-row"><button class="btn btn-primary" type="button" data-act="backup-dl" data-p="0">Download backup</button><button class="btn btn-ghost" type="button" data-act="backup-dl" data-p="1">Download with proof images</button><button class="btn btn-ghost" type="button" data-act="backup-restore">Restore from a file</button></div>
  <p class="hint" style="margin-top:10px">The file holds members, payments, expenses, attendance and the activity log. Treat it as confidential. Login passwords are stored only as scrambled hashes.</p>
  <div class="sec-title">Automatic snapshots</div>
  ${prem ? `<p class="hint">Premium keeps the last 3 snapshots in this browser and refreshes them once a day when the Lead Admin signs in.</p>${snaps.length ? table(['Taken', 'Reason', { t: 'Size', num: true }, ''], snaps.map((s, i) => [esc(fmtTS(s.at)), esc(s.why || 'Daily'), s.kb + ' KB', `<button class="btn btn-ghost btn-sm" type="button" data-act="snap-restore" data-i="${i}">Restore</button>`]), ['', '']) : '<div class="empty"><b>No snapshots yet</b>The first one is taken the next time the Lead Admin signs in.</div>'}` : `<p class="hint">${premiumBadge} Automatic daily snapshots are part of the Premium plan. Manual backups work on every plan.</p>`}</section>`;
}
{ const _p = ADMIN.profile; ADMIN.profile = function () { return _p() + backupPanel(); }; VIEWS.admin.profile = ADMIN.profile; }
{ const _o = ADMIN.overview; ADMIN.overview = function () {
  const html = _o();
  if (S.owner || !isLeadAdmin() || !(daysSince(S.v.lastBackupAt) > BACKUP_STALE_DAYS)) return html;
  return `<div class="callout upgrade"><div><b>Back up your records</b><p>${S.v.lastBackupAt ? 'Your last backup was ' + Math.floor(daysSince(S.v.lastBackupAt)) + ' days ago.' : 'You have not made a backup yet.'} It takes one click and protects you if this browser is cleared.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="goto" data-page="profile">Back up now</button></div>` + html;
}; VIEWS.admin.overview = ADMIN.overview; }

Object.assign(ACTIONS, {
  'backup-dl'(el) {
    try { const withP = el.dataset.p === '1'; const b = villageBackup(S.v, withP); download(`VillageVault-${S.v.code}-backup-${today()}.json`, new Blob([JSON.stringify(b)], { type: 'application/json' })); API.noteBackup('Full backup', withP); toast('Backup downloaded. Keep it somewhere safe.', 'ok'); renderSoon(); } catch (e) { toast(e.message, 'err'); }
  },
  'backup-restore'() {
    openModal({ title: 'Restore from a backup file', sub: `This replaces the records of ${esc(S.v.name)} with the contents of the file. A snapshot of the current records is kept first.`,
      body: `<div class="field"><label for="bkF">Backup file (.json)</label><input id="bkF" class="input" type="file" name="backup" accept=".json,application/json"></div>
      <div class="field"><label for="bkC">Type RESTORE to confirm</label><input id="bkC" name="confirm" class="input" autocomplete="off" placeholder="RESTORE"></div>`, submit: 'Restore records', danger: true,
      onSubmit: async fd => {
        const f = fd.get('backup'); if (!f || !f.size) throw new Error('Choose a backup file.'); if (f.size > 40e6) throw new Error('That file is too large.');
        if (String(fd.get('confirm') || '').trim() !== 'RESTORE') throw new Error('Type RESTORE in capital letters to confirm.');
        let b; try { b = JSON.parse(await f.text()); } catch (_) { throw new Error('That file could not be read. It is not a valid backup.'); }
        const sm = backupSummary(b), r = await API.restoreBackup(b); closeModal();
        if (r.logout) { toast('Restored. Please sign in again.', 'ok'); return ACTIONS.logout(); }
        toast(`Restored ${sm.members} members and ${sm.tx} payments.`, 'ok'); renderView();
      } });
  },
  'snap-restore'(el) {
    const i = Number(el.dataset.i), s = SNAP.load(S.v.id)[i]; if (!s) return toast('That snapshot is no longer there.', 'err');
    openModal({ title: 'Restore this snapshot?', sub: `Taken ${esc(fmtTS(s.at))}. Records changed since then will be replaced. The current records are snapshotted first.`, body: '', submit: 'Restore', danger: true,
      onSubmit: async () => { const r = await API.restoreSnapshot(i); closeModal(); if (r.logout) { toast('Restored. Please sign in again.', 'ok'); return ACTIONS.logout(); } toast('Snapshot restored.', 'ok'); renderView(); } });
  }
});

/* ---- daily automatic snapshot for Premium villages ---- */
{ const _rv = renderView; renderView = function () {
  _rv.apply(this, arguments);
  try { if (!S.owner && S.u && isLeadAdmin() && planAllows('autoBackup') && !S.snapChecked) { S.snapChecked = true; const l = SNAP.load(S.v.id); if (daysSince(l[0] && l[0].at) > 1) takeSnapshot('Daily').then(() => { if (S.page === 'profile') renderView(); }).catch(() => {}); } } catch (_) {}
}; }

/* ---- owner: every village in one file ---- */
OWNER_API.exportAll = async function (withProofs) {
  requireOwner(); const out = { kind: 'villagevault-platform-backup', version: BACKUP_VER, exportedAt: stamp(), withProofs: !!withProofs, owner: Object.assign({}, OWN.data, { hash: undefined }), villages: [] };
  for (const vil of allTenants()) { const v = await DB.load(vil.id); out.villages.push(withProofs ? JSON.parse(JSON.stringify(v)) : stripProofs(v)); }
  olog('Exported platform backup', '', `${out.villages.length} villages${withProofs ? ' with proof images' : ''}`); OWN.save(); return out;
};
{ const _acc = OWNERV['o-account']; OWNERV['o-account'] = function () { return _acc() + `<section class="panel" style="max-width:640px;margin-top:16px"><div class="panel-h"><div><h2>Platform backup</h2><p>One file with every village and association. Owner sign-in details are left out.</p></div></div><div class="btn-row"><button class="btn btn-primary" type="button" data-act="o-export" data-p="0">Download all villages</button><button class="btn btn-ghost" type="button" data-act="o-export" data-p="1">With proof images</button></div></section>`; }; }
Object.assign(ACTIONS, { 'o-export'(el) { OWNER_API.exportAll(el.dataset.p === '1').then(b => { download(`VillageVault-platform-backup-${today()}.json`, new Blob([JSON.stringify(b)], { type: 'application/json' })); toast('Platform backup downloaded.', 'ok'); }).catch(e => toast(e.message || 'Could not make the backup.', 'err')); } });
