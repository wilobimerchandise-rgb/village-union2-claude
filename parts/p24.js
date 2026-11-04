/* =========================================================
   ROUND 10: Men's Wing and Women's Wing for every village and association.
   A wing is its own workspace under its village: its own members, admins,
   payments, register, meetings, receipts and reports, with exactly the
   same member and admin access as a village. Wing data is stored apart
   (key "vv_v1_<village>~men" / "~women"), so nothing in the village changes.
   Wings are chosen from the same village or association dropdown.
   ========================================================= */
const WING_KINDS = { men: { suffix: 'M', label: 'Men’s Wing' }, women: { suffix: 'W', label: 'Women’s Wing' } };
const wingLabel = k => (WING_KINDS[k] || {}).label || '';
const wingCache = {};
const baseId = id => String(id == null ? '' : id).split('~')[0];
function makeWing(p, kind) {
  const K = WING_KINDS[kind];
  return { id: `${p.id}~${kind}`, parent: p.id, wing: kind, color: p.color, tag: K.label,
    get name() { return `${p.name} ${K.label}`; }, get code() { return p.code + K.suffix; }, get type() { return p.type || 'village'; },
    get removed() { return !!p.removed; }, set removed(_) {} };
}
function wingsOf(p) { return ['men', 'women'].map(k => { const id = `${p.id}~${k}`; if (!wingCache[id] || wingCache[id]._p !== p) { wingCache[id] = makeWing(p, k); Object.defineProperty(wingCache[id], '_p', { value: p, enumerable: false }); } return wingCache[id]; }); }
function vilById(id) {
  const v = VILLAGES.find(x => x.id === id); if (v) return v;
  const m = /^(.+)~(men|women)$/.exec(String(id)); if (!m) return null;
  const p = VILLAGES.find(x => x.id === m[1]); return p ? wingsOf(p).find(w => w.wing === m[2]) : null;
}
/* The owner decides, village by village, which wings exist. Both are on by default; an association never has wings.
   A village is only ever opened through its wings, so it is not listed on its own. Switching a wing off hides it from
   sign-in but keeps every record, so it can be switched on again. */
const wingOn = (p, k) => { if (!p || p.type === 'association') return false; let m = {}; try { m = JSON.parse(lsGet('vv_wings_v1') || '{}'); } catch (_) {} return !(m[p.id] && m[p.id][k] === false); };
function setWingOn(pid, k, on) { let m = {}; try { m = JSON.parse(lsGet('vv_wings_v1') || '{}'); } catch (_) {} m[pid] = Object.assign({ men: true, women: true }, m[pid], { [k]: !!on }); lsSet('vv_wings_v1', JSON.stringify(m)); }
const activeWings = p => wingsOf(p).filter(w => wingOn(p, w.wing));
// What a person can sign in to: an association, or a village's wings.
const signInList = () => liveVillages().flatMap(v => v.type === 'association' ? [v] : activeWings(v));
const allTenants = () => VILLAGES.flatMap(v => [v, ...wingsOf(v)]);
const tenantList = () => VILLAGES.filter(v => !v.removed).flatMap(v => v.type === 'association' ? [v] : wingsOf(v));

// Owner numbers for a village are its wings added together. A village is never opened on its own.
function aggStats(vil) {
  if (vil.type === 'association') return vStats(DB.cache[vil.id]);
  const out = { members: 0, admins: 0, collected: 0, spent: 0, balance: 0, pending: 0, pendingAmt: 0 };
  activeWings(vil).forEach(w => { const d = DB.cache[w.id]; if (!d) return; const s = vStats(d); Object.keys(s).forEach(k => { if (typeof s[k] === 'number') out[k] = (out[k] || 0) + s[k]; }); });
  return out;
}
function wingPlan(parentId) {
  const r = PLAN_REG.load()[parentId], c = DB.cache[parentId];
  return r || (c && c.plan) || (['umuokpu', 'amakwu', 'ezinkwo'].indexOf(parentId) >= 0 ? 'premium' : 'basic');
}
// A wing of a village that came with the demo gets a small sample register; a wing of a village the owner created starts empty with one Lead Admin.
async function seedWing(w, lead) {
  const p = VILLAGES.find(x => x.id === w.parent);
  if (!p.custom) return seedVillage(w);
  const settings = { levies: {} }; LEVIES.forEach(l => { settings.levies[l.id] = l.def; }); settings.accounts = []; settings.payNote = 'Pay into the account above, then upload your proof of payment on this site. Never pay cash to anyone except the treasurer.';
  const uid = `${w.code}-A01`, hash = await hashPw(w.id, uid, (lead && lead.password) || `${w.code.toLowerCase()}-admin`);
  return { id: w.id, name: w.name, code: w.code, type: w.type, wing: w.wing, parent: w.parent, settings, plan: wingPlan(w.parent), status: 'active', logo: null, meetings: [], tx: [], expenses: [], audit: [], seq: { tx: 0, exp: 0, aud: 0, mbr: 0 }, seededAt: stamp(),
    users: [{ id: uid, name: (lead && lead.name) || `${w.name} Lead Admin`, role: 'admin', title: getRoles()[0], lead: true, family: '', kindred: '', phone: (lead && lead.phone) || '', email: '', joined: today(), active: true, hash, mustChange: true }] };
}
// Name, code, category and access status always follow the village.
function syncWing(d, w) {
  let pd = DB.cache[w.parent]; if (!pd) { try { pd = JSON.parse(lsGet('vv_v1_' + w.parent) || 'null'); } catch (_) { pd = null; } }
  d.name = w.name; d.code = w.code; d.type = w.type; d.wing = w.wing; d.parent = w.parent; d.status = (pd && pd.status) || 'active';
}
OWNER_API.setWing = function (id, kind, on) {
  requireOwner(); const vil = VILLAGES.find(x => x.id === id); if (!vil || vil.type === 'association') throw new Error('Associations do not have wings.');
  if (!WING_KINDS[kind]) throw new Error('Choose the Men’s Wing or the Women’s Wing.');
  if (wingOn(vil, kind) === !!on) throw new Error('Nothing was changed.');
  setWingOn(id, kind, on); olog(on ? 'Wing added' : 'Wing removed', vil.name, `${WING_KINDS[kind].label} ${on ? 'switched on' : 'switched off. Records are kept and can be restored'}`); OWN.save();
};
(function wrapWingApis() {
  // A new village is opened through its wings, so the Lead Admin the owner names and the starting password go to both wings.
  const av = OWNER_API.addVillage;
  OWNER_API.addVillage = async function (d) {
    const r = await av.call(OWNER_API, d), p = VILLAGES.find(x => x.id === r.id); r.wingIds = [];
    if (p && p.type !== 'association') for (const w of wingsOf(p)) {
      const data = await seedWing(w, { name: (d.leadName || '').trim(), password: d.password, phone: (d.phone || '').trim() }); migrate(data); syncWing(data, w);
      if (!lsSet('vv_v1_' + w.id, JSON.stringify(data))) throw new Error('The browser storage is full.'); DB.cache[w.id] = data; r.wingIds.push({ label: wingLabel(w.wing), uid: data.users[0].id });
    }
    return r;
  };
  const mv = OWNER_API.manageVillage;
  OWNER_API.manageVillage = function (id, d) {
    const r = mv.call(OWNER_API, id, d), st = (DB.cache[id] || {}).status || 'active';
    wingsOf(VILLAGES.find(x => x.id === id) || { id }).forEach(w => { const wd = DB.cache[w.id]; if (wd) { wd.status = st; wd.name = w.name; DB.save(wd); } });
    return r;
  };
  const dv = OWNER_API.deleteVillage;
  OWNER_API.deleteVillage = function (id) {
    const r = dv.call(OWNER_API, id);
    ['men', 'women'].forEach(k => { const wid = `${id}~${k}`; delete DB.cache[wid]; delete wingCache[wid]; try { localStorage.removeItem('vv_v1_' + wid); } catch (_) {} const reg = PLAN_REG.load(); delete reg[wid]; PLAN_REG.save(reg); });
    try { const m = JSON.parse(lsGet('vv_wings_v1') || '{}'); delete m[id]; lsSet('vv_wings_v1', JSON.stringify(m)); } catch (_) {}
    return r;
  };
})();
