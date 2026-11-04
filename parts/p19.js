/* =========================================================
   ROUND 9 / #4: one place for plan rules.
   Every Premium-only action asks assertFeature(). The owner's plan
   registry is the source of truth: a village record that was edited
   by hand is put back to the registry value when it loads.
   NOTE: this stops casual tampering only. Real enforcement needs a server.
   ========================================================= */
const PLAN_RULES = {
  basic:   { memberCap: 20, letterhead: false, watermark: true,  broadcast: false, codeEdit: false, autoBackup: false, minutes: false },
  premium: { memberCap: Infinity,   letterhead: true,  watermark: false, broadcast: true,  codeEdit: true,  autoBackup: true, minutes: true }
};
const planKey = v => ((v || S.v || {}).plan === 'premium' ? 'premium' : 'basic');
const planAllows = (f, v) => !!PLAN_RULES[planKey(v)][f];
function assertFeature(f, label) { if (!planAllows(f)) { const e = new Error(`${label} is part of the Premium plan.`); e.upgrade = true; e.feature = label; throw e; } }
const PLAN_REG = { load() { try { return JSON.parse(lsGet('vv_plans_v1') || '{}'); } catch (_) { return {}; } }, save(r) { lsSet('vv_plans_v1', JSON.stringify(r)); } };
function enforcePlanRegistry(v) {
  const r = PLAN_REG.load();
  if (!r[v.id]) { r[v.id] = v.plan; PLAN_REG.save(r); return; }
  if (r[v.id] !== v.plan) { v.plan = r[v.id]; v.planRestored = stamp(); }
}
const setRegistryPlan = (id, plan) => { const r = PLAN_REG.load(); r[id] = plan; ['men', 'women'].forEach(k => { const wid = `${id}~${k}`; r[wid] = plan; const w = DB.cache[wid]; if (w) { w.plan = plan; DB.save(w); } }); PLAN_REG.save(r); };   // wings share their village's plan

(function wrapPlanApis() {
  const em = API.editMember;
  API.editMember = function (id, d) {
    const u = userById(id);
    if (u && u.role === 'member' && !u.active && d.active === 'yes' && capReached()) throw new Error(`The Basic plan covers up to ${basicCap()} active members here. Upgrade to Premium to switch this member back on.`);
    return em.call(API, id, d);
  };
  const sb = API.saveBranding;
  if (sb) API.saveBranding = function (d) {
    if (d && d.code !== undefined && String(d.code).trim().toUpperCase() !== S.v.code) assertFeature('codeEdit', 'Changing the village code');
    return sb.call(API, d);
  };
  const mv = OWNER_API.manageVillage;
  OWNER_API.manageVillage = function (id, d) { const r = mv.call(OWNER_API, id, d); if (DB.cache[id]) setRegistryPlan(id, DB.cache[id].plan); return r; };
  const av = OWNER_API.addVillage;
  OWNER_API.addVillage = async function (d) { const r = await av.call(OWNER_API, d); if (DB.cache[r.id]) setRegistryPlan(r.id, DB.cache[r.id].plan); return r; };
  const dv = OWNER_API.deleteVillage;
  if (dv) OWNER_API.deleteVillage = function (id) { const r = dv.apply(OWNER_API, arguments); const g = PLAN_REG.load(); delete g[id]; PLAN_REG.save(g); return r; };
})();
