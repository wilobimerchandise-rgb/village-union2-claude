
/* =========================================================
   ROUND 17 (part 2): live demo village with a guided five-step tour.
   A made-up village is built in the browser each time. It never touches a real village, the owner's lists,
   the upgrade queue, the support desk or the "who is online" list. Everything is removed when the demo ends.
   ========================================================= */
const DEMO_ID = 'vvdemo', demoVil = () => ({ id: DEMO_ID, name: 'Demo Village (sample data)', code: 'DEMO', color: '#12806A', tag: 'Sample village' });
const demoClean = () => { try { localStorage.removeItem('vv_v1_' + DEMO_ID); delete mem['vv_v1_' + DEMO_ID]; const r = PLAN_REG.load(); if (r[DEMO_ID] !== undefined) { delete r[DEMO_ID]; PLAN_REG.save(r); } const t = TRIAL.load(); if (t[DEMO_ID]) { delete t[DEMO_ID]; TRIAL.save(t); } } catch (_) {} delete DB.cache[DEMO_ID]; const i = VILLAGES.findIndex(x => x.id === DEMO_ID); if (i >= 0) VILLAGES.splice(i, 1); };
demoClean();   // a demo left behind by a closed tab is cleared the next time the site opens

const TOUR = [
  { role: 'member', page: 'overview', t: 'A member uploads proof', d: 'Members pay at the bank or by transfer, then tap Upload proof with a photo or PDF of the receipt. They see their own balance and nothing about other people’s money.', pulse: '[data-act=upload-proof]' },
  { role: 'admin', page: 'verify', t: 'The admin checks and verifies', d: 'The admin compares the proof with the bank, then verifies it. The member’s record and receipt update at once, and the admin’s name and time are kept forever.', pulse: '[data-act=verify-tx]' },
  { role: 'admin', page: 'notices', t: 'Notice board: seen by 40 of 60', d: 'Leaders post a notice and see exactly how many members have read it, and who has not. This is a Premium page.' },
  { role: 'admin', page: 'idcard', t: 'ID card with QR check-in', d: 'Every member gets an ID card with a QR code. At the meeting an admin scans it to mark the member present. A second admin still verifies.' },
  { role: 'admin', page: 'review', t: 'The year in review', d: 'One page that tells the village’s story: money in, money out, who is paid up, meetings and projects. Download it as a PDF or share it on WhatsApp.', last: true }
];
let TOURI = -1;

async function startDemo(role, tour) {
  if (S.demo) { demoAs(role); if (tour) tourGo(0); return; }
  demoClean(); VILLAGES.push(demoVil()); const v = await DB.load(DEMO_ID);
  v.plan = 'premium'; setRegistryPlan(DEMO_ID, 'premium');
  v.users.forEach((u, i) => { u.phone = '0800000' + String(1000 + i); u.email = ''; });
  S.v = v; S.owner = false; S.demo = true; S.f = {}; S.u = v.users.find(u => u.role === 'admin' && u.lead) || v.users.find(u => u.role === 'admin');
  try {
    const live = v.users.filter(u => ['member', 'admin'].includes(u.role)), n1 = API.saveNotice('', { title: 'Annual general meeting', body: 'Our AGM holds on the first Saturday of December at the village hall. Please come early and bring your ID card.', pinned: true });
    n1.seen = {}; live.forEach((u, i) => { if (i % 5 !== 4) n1.seen[u.id] = stamp(); });
    const n2 = API.saveNotice('', { title: 'Burial levy reminder', body: 'The burial levy for this year is due. Pay to the village account and upload your proof.', pinned: false }); n2.seen = {}; live.forEach((u, i) => { if (i % 3 === 0) n2.seen[u.id] = stamp(); });
    API.saveAgenda('', { title: 'December general meeting', date: addDays(today(), 12), time: '4:00 pm', venue: 'Village hall', items: 'Opening prayer | Chaplain | 5\nFinancial report | Financial Secretary | 15\nBurial levy update | Chairman | 10\nAny other business | Chairman | 10', notes: 'Come with your ID card.' }); API.publishAgenda(v.agendas[0].id, true);
    const t = new Date(); live.slice(0, 6).forEach((u, i) => { const d = new Date(t.getTime() + (i === 0 ? 0 : i * 2) * 864e5); API.saveDates(u.id, { dob: pad(d.getMonth() + 1) + '-' + pad(d.getDate()), anniv: '', hide: false }); });
    const p = API.saveProject('', { name: 'Community borehole', desc: 'Clean water for the village square.', target: 1500000, deadline: addDays(today(), 120), showDonors: 'yes' });
    live.slice(0, 8).forEach((u, i) => { v.tx.push({ id: nextId('tx', 'T'), memberId: u.id, levy: p.levyId, amount: [20000, 50000, 30000, 100000, 25000, 40000, 60000, 15000][i], date: addDays(today(), -(i * 6 + 2)), method: 'Bank transfer', ref: 'DEMO' + (100000 + i), note: '', status: 'verified', verifiedBy: S.u.name, verifiedById: S.u.id, verifiedAt: stamp(), receiptNo: 'DEMO-R' + (i + 1) }); });
    API.projectUpdate(p.id, 'The drilling company has been paid a deposit.');
    v.audit.push({ id: 'L' + (v.audit.length + 1), ts: stamp(), adminId: S.u.id, adminName: S.u.name, adminTitle: S.u.title, action: 'Started demo', target: DEMO_ID, detail: 'Sample village built for the demo' });
    commit();
  } catch (_) { /* the demo still opens with what was built */ }
  document.body.classList.add('demo-on'); $('#site').hidden = true; $('#app').hidden = false; closeModal();
  demoAs(role || 'admin'); if (tour) tourGo(0); else toast('Demo opened. Everything here is sample data.', 'ok');
}
function demoAs(role) {
  const v = S.v; S.u = role === 'member' ? (v.users.find(u => u.role === 'member' && u.active) || S.u) : (v.users.find(u => u.role === 'admin' && u.lead) || v.users.find(u => u.role === 'admin')); S.page = 'overview'; S.f = {}; S.demoRole = role;
  renderApp(); window.scrollTo(0, 0);
}
function demoPlan(p) { const v = S.v; v.plan = p; setRegistryPlan(DEMO_ID, p); commit(); renderApp(); if (TOURI >= 0) tourShow(); }
function exitDemo(toAccess) {
  tourStop(); { const bar = $('#demoBar'); if (bar) bar.remove(); } document.body.classList.remove('demo-on'); S.demo = false; S.demoRole = null; closeModal(); S.v = null; S.u = null; demoClean();
  $('#app').hidden = true; $('#app').innerHTML = ''; $('#site').hidden = false; window.scrollTo(0, 0);
  if (toAccess) setTimeout(() => { try { focusAccess(); } catch (_) {} }, 50);
}
function demoBar() {
  if (!S.demo) return ''; const prem = S.v.plan === 'premium', r = S.demoRole === 'member';
  return `<div class="demo-bar" id="demoBar" role="region" aria-label="Demo controls"><b class="demo-tag">DEMO &middot; sample data</b>
    <span class="demo-grp" role="group" aria-label="View as"><button type="button" class="demo-chip${r ? ' on' : ''}" data-act="demo-role" data-role="member">Member</button><button type="button" class="demo-chip${r ? '' : ' on'}" data-act="demo-role" data-role="admin">Admin</button></span>
    <span class="demo-grp" role="group" aria-label="Plan"><button type="button" class="demo-chip${prem ? '' : ' on'}" data-act="demo-plan" data-plan="basic">Basic</button><button type="button" class="demo-chip${prem ? ' on' : ''}" data-act="demo-plan" data-plan="premium">Premium</button></span>
    <button type="button" class="demo-chip" data-act="tour-start">${TOURI >= 0 ? 'Restart tour' : 'Take the tour'}</button><button type="button" class="demo-chip demo-exit" data-act="demo-exit">Exit demo</button></div>`;
}
{ const _ra = renderApp; renderApp = function () { const r = _ra.apply(this, arguments); try { if (S.demo) { const old = $('#demoBar'); if (old) old.remove(); document.body.insertAdjacentHTML('afterbegin', demoBar()); const lo = $('.side-foot [data-act=logout]'); if (lo) lo.lastChild.textContent = 'Exit demo'; } } catch (_) {} return r; }; }
{ const _rv = renderView; renderView = function () { const r = _rv.apply(this, arguments); try { if (S.demo && TOURI >= 0) tourPulse(); } catch (_) {} return r; }; }

/* ---------- Guided tour ---------- */
function tourStop() { TOURI = -1; const c = $('#tourCard'); if (c) c.remove(); $$('.tour-pulse').forEach(e => e.classList.remove('tour-pulse')); }
function tourGo(i) {
  if (i < 0 || i >= TOUR.length) return tourStop(); TOURI = i; const s = TOUR[i];
  if (s.page === 'notices' || s.page === 'idcard' || s.page === 'review') { if (S.v.plan !== 'premium') { S.v.plan = 'premium'; setRegistryPlan(DEMO_ID, 'premium'); commit(); } }
  if (S.demoRole !== s.role) demoAs(s.role); S.page = s.page; S.f = {}; document.body.classList.remove('side-open'); renderApp(); window.scrollTo(0, 0); tourShow();
}
function tourShow() {
  const s = TOUR[TOURI]; if (!s) return; let c = $('#tourCard'); if (!c) { c = document.createElement('div'); c.id = 'tourCard'; c.className = 'tour-card'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'Guided tour'); document.body.appendChild(c); }
  c.innerHTML = `<div class="tour-step">Step ${TOURI + 1} of ${TOUR.length}</div><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p>${s.last ? '<div class="tour-cta"><button class="btn btn-saffron btn-sm" type="button" data-act="demo-exit-start">Choose my village or association</button></div>' : ''}
    <div class="tour-nav"><button class="btn btn-ghost btn-sm" type="button" data-act="tour-prev"${TOURI === 0 ? ' disabled' : ''}>Back</button><button class="btn btn-primary btn-sm" type="button" data-act="tour-next">${s.last ? 'Finish' : 'Next'}</button><button class="linkbtn" type="button" data-act="tour-skip">Skip tour</button></div>`;
  tourPulse();
}
function tourPulse() { $$('.tour-pulse').forEach(e => e.classList.remove('tour-pulse')); const s = TOUR[TOURI]; if (s && s.pulse) { const e = $(`#view ${s.pulse.split(',').join(', #view ')}`) || $(s.pulse); if (e) e.classList.add('tour-pulse'); } }

/* ---------- Keep the sample village sandboxed ---------- */
const demoCta = () => infoModal('This is a demo', 'Sample data only', '<p style="margin-top:12px">Nothing here is real and nothing is sent. To use VillageVault for your own village or association, sign in with the details your admin gave you, or ask support to set you up.</p><div class="btn-row"><button class="btn btn-saffron" type="button" data-act="demo-exit-start">Choose my village or association</button></div>');
['requestUpgrade', 'sendTicket', 'startTrial'].forEach(k => { const o = API[k]; if (o) API[k] = function () { if (S.demo) throw new Error('This is a demo. Your own village can start a free trial after you sign in.'); return o.apply(this, arguments); }; });
['upgrade-start', 'trial-start', 'tk-new'].forEach(k => { const o = ACTIONS[k]; if (o) ACTIONS[k] = function () { if (S.demo) return demoCta(); return o.apply(this, arguments); }; });
{ const o = window.open; window.open = function () { if (S.demo) { toast('Demo: WhatsApp would open here with the message ready.', 'ok'); return {}; } return o.apply(window, arguments); }; }
document.addEventListener('click', e => { if (!S.demo) return; const a = e.target.closest && e.target.closest('a[href^="https://wa.me"]'); if (a) { e.preventDefault(); e.stopPropagation(); toast('Demo: WhatsApp would open here with the message ready.', 'ok'); } }, true);
{ const o = presBeat; presBeat = function () { if (S.demo) return; return o.apply(this, arguments); }; }
{ const o = maybeRate; maybeRate = function () { if (S.demo) return; return o.apply(this, arguments); }; }
{ const o = logout; logout = function () { if (S.demo) return exitDemo(false); return o.apply(this, arguments); }; }

Object.assign(ACTIONS, {
  async 'demo-start'(el) { try { await startDemo(el.dataset.role || 'admin', el.dataset.tour === '1'); } catch (ex) { toast(ex.message || 'Could not open the demo.', 'err'); demoClean(); S.demo = false; document.body.classList.remove('demo-on'); } },
  'demo-role'(el) { if (S.demo) { tourStop(); demoAs(el.dataset.role); } },
  'demo-plan'(el) { if (S.demo) demoPlan(el.dataset.plan); },
  'demo-exit'() { exitDemo(false); },
  'demo-exit-start'() { exitDemo(true); },
  'tour-start'() { if (S.demo) tourGo(0); },
  'tour-next'() { if (TOURI >= TOUR.length - 1) { tourStop(); toast('That is the tour. Keep exploring, or choose your village.', 'ok'); } else tourGo(TOURI + 1); },
  'tour-prev'() { if (TOURI > 0) tourGo(TOURI - 1); },
  'tour-skip'() { tourStop(); }
});
