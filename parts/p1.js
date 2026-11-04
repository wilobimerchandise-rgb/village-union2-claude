/* =========================================================
   VillageVault - app.js
   Front-end demo build. Each village's data lives under its own
   storage key and every read/write goes through the signed-in
   village. For production, replace the DB object with calls to a
   real backend (see the notes at the end of this file).
   ========================================================= */
(() => {
'use strict';

/* ---------- Config ---------- */
const CONFIG = {
  DEMO_MODE: true,                       // set false to hide the demo login hints
  SHOW_MEMBER_NAMES_IN_VILLAGE_LEDGER: true,
  PER_PAGE: 12,
  MAX_ATTEMPTS: 3,                       // wrong sign-ins allowed before the member is told to contact the admin
  LOCK_SECONDS: 60,
  MAX_IMAGE_PX: 1200,
  MAX_PDF_KB: 600,
  OWNER_ID: 'OWNER',                     // master admin sign-in (hidden, opened with #owner)
  OWNER_DEFAULT_HASH: { sha: 'sha:218e97e034f23b8f64e33200dd5ef149daa268a4c661fa6c64d33e720b6e4b7c', djb: 'djb:c0c39e0e' },   // only a hash is kept here, never the password. Ask the platform owner for the starting password and change it at the first sign-in
  PLATFORM_OWNER_EMAIL: 'owner@yourdomain.com', // the only identity allowed to manage sponsors (mirror of PLATFORM_OWNER_EMAIL in your backend env)
  SPONSOR_RATE_NAIRA_PER_WEEK: { global: 18000, village: 5000 }
};

const LEVIES = [
  { id: 'annual',    name: 'Annual dues',         fixed: true,  def: 12000, color: '#1A1A4E' },
  { id: 'burial',    name: 'Burial levy',         fixed: true,  def: 5000,  color: '#D2395B' },
  { id: 'insurance', name: 'Life insurance levy', fixed: true,  def: 8000,  color: '#12806A' },
  { id: 'party',     name: 'Party donation',      fixed: false, def: 0,     color: '#F5B83D' },
  { id: 'support',   name: 'Support levy',        fixed: true,  def: 3000,  color: '#6C5CE7' }
];
const VILLAGES = [
  { id: 'umuokpu',  name: 'Umuokpu',     code: 'UMK', color: '#1A1A4E', tag: 'Founded 1952' },
  { id: 'amakwu',   name: 'Amakwu',      code: 'AMK', color: '#D2395B', tag: 'Founded 1948' },
  { id: 'ezinkwo',  name: 'Ezinkwo',     code: 'EZN', color: '#12806A', tag: 'Founded 1961' },
  { id: 'umuchima', name: 'Umuchima',    code: 'UMC', color: '#6C5CE7', tag: 'Founded 1957' },
  { id: 'obiagu',   name: 'Obiagu',      code: 'OBG', color: '#D99A18', tag: 'Founded 1944' },
  { id: 'isiala',   name: 'Isiala Ndi',  code: 'ISL', color: '#0E7490', tag: 'Founded 1966' },
  { id: 'umunze',   name: 'Umunze Ano',  code: 'UMZ', color: '#B45309', tag: 'Founded 1950' },
  { id: 'agbaja',   name: 'Agbaja',      code: 'AGB', color: '#9D174D', tag: 'Founded 1959' },
  { id: 'nkwoibe',  name: 'Nkwo Ibe',    code: 'NKW', color: '#4D7C0F', tag: 'Founded 1971' },
  { id: 'ndiakpo',  name: 'Ndiakpo',     code: 'NDK', color: '#7C3AED', tag: 'Founded 1946' }
];
const METHODS = ['Bank transfer', 'Cash deposit at bank', 'Mobile app or USSD', 'POS payment'];
const FAMILIES = ['Okafor', 'Nwosu', 'Eze', 'Obi', 'Udeh', 'Ibe', 'Anyanwu', 'Nweke'], KINDREDS = ['Umuezeani', 'Umuchukwu', 'Obiofia', 'Umuagu', 'Ezeala'];
const famKin = (i, off) => ({ family: FAMILIES[(i * 3 + off) % FAMILIES.length] + ' family', kindred: KINDREDS[(i + off) % KINDREDS.length] + ' kindred' });
const REJECT_REASONS = ['Proof is unclear', 'Amount does not match the bank statement', 'Payment not found in the account', 'Duplicate of an earlier payment', 'Wrong levy selected', 'Other'];
const EXP_CATS = ['Burial support', 'Welfare and sickness', 'Hall and maintenance', 'Community project', 'Meeting expenses', 'Insurance premium', 'Other'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON = MONTHS.map(m => m.slice(0, 3));

/* ---------- Small utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NGN = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const money = n => NGN.format(Math.round(Number(n) || 0));
const sum = (arr, k = 'amount') => arr.reduce((a, x) => a + (Number(x[k]) || 0), 0);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const yearOf = s => Number(String(s).slice(0, 4));
const fmtDate = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return `${pad(d)} ${MON[m - 1]} ${y}`; };
const fmtTS = iso => { if (!iso) return ''; const d = new Date(iso); return `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const short = n => {
  n = Number(n) || 0;
  if (n >= 1e6) return '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return '₦' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return '₦' + Math.round(n);
};
/* Levy categories live in each village's own data (levyList) so admins can add, edit and remove them. */
const levyAll = () => (typeof S !== 'undefined' && S && S.v && S.v.levyList) ? S.v.levyList : LEVIES;
const levies = () => levyAll().filter(l => !l.removed);
const levyOf = id => levyAll().find(l => l.id === id) || { id, name: id, color: '#888', fixed: false };
const liveVillages = () => VILLAGES.filter(v => !v.removed);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const stamp = () => new Date().toISOString();

/* ---------- Storage (falls back to memory if the browser blocks it) ---------- */
const mem = {};
let storageWarned = false;
function lsGet(k) { if (k in mem) return mem[k]; try { return localStorage.getItem(k); } catch (_) { return null; } }
function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, v); return true; } catch (_) { return false; } }
function ssGet(k) { try { return sessionStorage.getItem(k); } catch (_) { return mem['ss_' + k] || null; } }
function ssSet(k, v) { mem['ss_' + k] = v; try { sessionStorage.setItem(k, v); } catch (_) {} }
function ssDel(k) { delete mem['ss_' + k]; try { sessionStorage.removeItem(k); } catch (_) {} }
function warnStorage() {
  if (storageWarned) return; storageWarned = true;
  toast('Browser storage is full or blocked. Changes will be lost when this tab closes.', 'err');
}

/* ---------- Password hashing ---------- */
async function hashPw(vid, uid, pw) {
  const s = `${vid}|${uid}|${pw}|vv1`;
  try {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return 'sha:' + Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) {}
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'djb:' + (h >>> 0).toString(16);
}

/* ---------- Demo data (created the first time a village is opened) ---------- */
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FIRST = ['Chinedu','Ngozi','Emeka','Ifeoma','Obinna','Chioma','Uchenna','Adaeze','Ikenna','Nneka','Chukwuma','Amaka','Kelechi','Ebere','Nnamdi','Onyinye','Tochukwu','Ugochi','Ifeanyi','Obiageli','Somto','Nkechi','Chidi','Oluchi','Kenechukwu','Ijeoma'];
const LAST = ['Okeke','Eze','Nwosu','Obi','Okafor','Nwankwo','Chukwu','Igwe','Umeh','Onyeka','Nnadi','Okoye','Ezeani','Anyanwu','Madu','Ofor','Agu','Nweke','Uzoma','Ibe'];

async function seedVillage(vil) {
  const R = rng(vil.id), code = vil.code, now = new Date();
  const settings = { levies: {} }; LEVIES.forEach(l => settings.levies[l.id] = l.def);
  const users = [];
  const adminTitles = ['Chairman', 'Financial Secretary', 'Treasurer'];
  const off = Math.floor(R() * 9);
  const POOL = vil.wing === 'men' ? FIRST.filter((_, i) => i % 2 === 0) : vil.wing === 'women' ? FIRST.filter((_, i) => i % 2 === 1) : FIRST, NM = vil.wing ? 10 : 22;   // wings: gender-matched first names and a smaller starter register
  for (let i = 0; i < 3; i++) users.push({ id: `${code}-A${pad(i + 1)}`, name: `${POOL[(i * 7 + off + 3) % POOL.length]} ${LAST[(i * 3 + off + 5) % 20]}`, role: 'admin', title: adminTitles[i], ...famKin(i, off), phone: `0803${Math.floor(1000000 + R() * 8999999)}`, email: '', joined: '2019-01-15', active: true });
  for (let i = 0; i < NM; i++) users.push({ id: `${code}-M${String(i + 1).padStart(3, '0')}`, name: `${POOL[(i * 3 + off) % POOL.length]} ${LAST[(i * 5 + off) % 20]}`, role: 'member', title: 'Member', ...famKin(i, off), phone: `080${Math.floor(10000000 + R() * 89999999)}`, email: '', joined: `${2012 + Math.floor(R() * 10)}-${pad(1 + Math.floor(R() * 12))}-10`, active: i !== NM - 1 });
  await Promise.all(users.map(async u => { u.hash = await hashPw(vil.id, u.id, `${code.toLowerCase()}-${u.role}`); }));
  const admins = users.filter(u => u.role === 'admin'), members = users.filter(u => u.role === 'member');
  const tx = [], audit = [];
  const yNow = now.getFullYear(), mNow = now.getMonth();
  const probs = { annual: .88, burial: .8, insurance: .72, support: .78 };
  const draft = [];
  const add = (m, levy, amount, d) => draft.push({ m, levy, amount, d });
  members.forEach(m => {
    [yNow - 1, yNow].forEach(yr => LEVIES.filter(l => l.fixed).forEach(L => {
      if (R() < probs[L.id] * (yr === yNow ? .92 : 1)) {
        const mo = Math.floor(R() * ((yr === yNow ? mNow : 11) + 1));
        let d = new Date(yr, mo, 1 + Math.floor(R() * 27));
        if (d > now) d = new Date(now.getTime() - 864e5 * Math.floor(R() * 9));
        add(m, L.id, settings.levies[L.id], d);
      }
    }));
    const n = Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const yr = R() < .5 ? yNow : yNow - 1; let d = new Date(yr, Math.floor(R() * (yr === yNow ? mNow + 1 : 12)), 1 + Math.floor(R() * 27));
      if (d > now) d = new Date(now.getTime() - 864e5 * 3);
      add(m, 'party', [2000, 5000, 10000, 20000][Math.floor(R() * 4)], d);
    }
  });
  draft.sort((a, b) => a.d - b.d);
  let seq = 0, lseq = 0;
  draft.forEach(x => {
    const age = (now - x.d) / 864e5, adm = admins[1 + Math.floor(R() * 2)] || admins[0];
    const t = { id: `${code}-T${String(++seq).padStart(4, '0')}`, memberId: x.m.id, levy: x.levy, amount: x.amount, date: ymd(x.d), method: METHODS[Math.floor(R() * 4)], ref: `TRF${Math.floor(100000 + R() * 899999)}`, note: '', status: 'verified', proof: { name: 'receipt.jpg', seed: true }, submittedAt: new Date(x.d.getTime() + 36e5 * 10).toISOString(), submittedBy: x.m.name, updatedBy: null, updatedAt: null, history: [] };
    if (age < 12 && R() < .55) t.status = 'pending';
    else if (R() < .03) { t.status = 'rejected'; t.rejectReason = REJECT_REASONS[0]; t.verifiedBy = adm.name; t.verifiedById = adm.id; t.verifiedAt = new Date(Math.min(now, x.d.getTime() + 864e5 * 2)).toISOString(); }
    if (t.status === 'verified') {
      t.verifiedBy = adm.name; t.verifiedById = adm.id;
      t.verifiedAt = new Date(Math.min(now.getTime() - 6e4, x.d.getTime() + 864e5 * (1 + R() * 2))).toISOString();
      audit.push({ id: 'L' + (++lseq), ts: t.verifiedAt, adminId: adm.id, adminName: adm.name, adminTitle: adm.title, action: 'Verified payment', target: t.id, detail: `${levyOf(t.levy).name} ${money(t.amount)} from ${x.m.name}` });
    }
    tx.push(t);
  });
  const expenses = [];
  const fin = admins[1] || admins[0];
  const items = [['Burial support', 'Burial support for a member’s family', 45000], ['Hall and maintenance', 'Village hall roof repair', 120000], ['Meeting expenses', 'General meeting refreshments', 18000], ['Welfare and sickness', 'Hospital support for a member', 30000], ['Community project', 'Borehole servicing', 85000], ['Insurance premium', 'Group life insurance premium', 96000], ['Burial support', 'Burial support for a member', 45000], ['Meeting expenses', 'Executive meeting', 12000], ['Hall and maintenance', 'Generator fuel and service', 38000]];
  items.forEach((it, i) => {
    const d = new Date(now.getTime() - 864e5 * (12 + i * 41 + Math.floor(R() * 20)));
    const e = { id: `${code}-E${String(i + 1).padStart(3, '0')}`, date: ymd(d), category: it[0], description: it[1], amount: it[2], status: 'active', createdBy: fin.name, createdById: fin.id, createdAt: new Date(d.getTime() + 36e5 * 14).toISOString(), updatedBy: null, updatedAt: null };
    expenses.push(e);
    audit.push({ id: 'L' + (++lseq), ts: e.createdAt, adminId: fin.id, adminName: fin.name, adminTitle: fin.title, action: 'Recorded expense', target: e.id, detail: `${e.category}: ${e.description}, ${money(e.amount)}` });
  });
  return { id: vil.id, name: vil.name, code, settings, users, tx, expenses, audit, seq: { tx: seq, exp: items.length, aud: lseq, mbr: NM }, seededAt: stamp(), ...(vil.wing ? { type: vil.type, plan: wingPlan(vil.parent) } : {}) };
}

/* ---------- Bring older saved data up to date (adds the newer fields) ---------- */
const PALETTE = ['#1A1A4E', '#D2395B', '#12806A', '#F5B83D', '#6C5CE7', '#0E7490', '#B45309', '#9D174D', '#4D7C0F', '#7C3AED'];
const BANKS = ['First Bank of Nigeria', 'Guaranty Trust Bank', 'Access Bank', 'United Bank for Africa', 'Zenith Bank', 'Fidelity Bank'];
function migrate(v) {
  v.settings = v.settings || { levies: {} }; v.settings.levies = v.settings.levies || {};
  v.pledges = v.pledges || []; v.type = v.type || 'village';
  v.minutes = v.minutes || []; if (!v.meetingTypes) v.meetingTypes = [['General meeting', 0], ['Executive and elders meeting', 1], ['Annual general meeting', 0], ['Emergency meeting', 0]].map((t, i) => ({ id: 'T' + (i + 1), name: t[0], exec: !!t[1], removed: false }));
  v.users.forEach((u, i) => {
    if (u.title === 'President General') u.title = 'Chairman';
    if (v.type === 'village') { if (u.family === undefined && u.kindred === undefined) { Object.assign(u, famKin(i, v.id.length)); } }
  });
  (v.audit || []).forEach(a => { if (a.adminTitle === 'President General') a.adminTitle = 'Chairman'; });
  if (!v.levyList) v.levyList = LEVIES.map(l => ({ id: l.id, name: l.name, fixed: l.fixed, color: l.color }));
  if (!v.levyList.some(l => l.id === 'other')) v.levyList.push({ id: 'other', name: 'Others', fixed: false, color: '#8A8FA8' });
  { const adm = v.users.filter(u => u.role === 'admin'); if (adm.length && !adm.some(u => u.lead)) { const a1 = adm.find(u => /-A01$/.test(u.id)); if (a1) a1.lead = true; } }
  v.levyList.forEach(l => { if (v.settings.levies[l.id] == null) v.settings.levies[l.id] = 0; });
  const R = rng(v.id + 'mig');
  if (!v.settings.accounts) v.settings.accounts = [{ id: 'B1', bank: BANKS[Math.floor(R() * BANKS.length)], number: String(Math.floor(1000000000 + R() * 8999999999)), name: `${v.name} Union` }];
  if (v.settings.payNote == null) v.settings.payNote = 'Pay into the account above, then upload your proof of payment on this site. Never pay cash to anyone except the treasurer.';
  v.plan = v.plan || (['umuokpu', 'amakwu', 'ezinkwo'].indexOf(v.id) >= 0 ? 'premium' : 'basic');
  enforcePlanRegistry(v);
  if (v.logo === undefined) v.logo = null;
  v.requests = v.requests || []; v.credLog = v.credLog || []; v.seq = v.seq || {};
  if (!v.meetings) {
    const admins = v.users.filter(u => u.role === 'admin'), members = v.users.filter(u => u.role === 'member' && u.active), now = new Date(); v.meetings = [];
    [[9, 'General meeting'], [41, 'Executive and elders meeting'], [74, 'General meeting'], [118, 'Annual general meeting']].forEach((m, i) => {
      const d = new Date(now.getTime() - 864e5 * m[0]), adm = admins[1 + (i % 2)] || admins[0];
      const marks = members.filter(() => R() < .72).map(u => ({ memberId: u.id, at: new Date(d.getTime() + 36e5 * (15 + R() * 2)).toISOString(), status: 'verified', by: adm.name, byId: adm.id, byAt: new Date(d.getTime() + 36e5 * 20).toISOString() }));
      v.meetings.push({ id: `${v.code}-G${String(i + 1).padStart(3, '0')}`, title: m[1], date: ymd(d), status: 'closed', openedBy: adm.name, openedById: adm.id, openedAt: new Date(d.getTime() + 36e5 * 14).toISOString(), closedAt: new Date(d.getTime() + 36e5 * 19).toISOString(), marks });
    });
    v.seq.mtg = v.meetings.length;
  }
  v.meetings && v.meetings.forEach(m => { if (m.typeId === undefined) { const t = v.meetingTypes.find(x => x.name.toLowerCase() === String(m.title || '').trim().toLowerCase()); m.typeId = t ? t.id : ''; m.exec = !!(t && t.exec); } });
  return v;
}

/* ---------- Database layer (one record per village) ---------- */
const DB = {
  cache: {},
  async load(id) {
    if (this.cache[id]) return this.cache[id];
    const vil = vilById(id); if (!vil) throw new Error('Unknown village.');
    let data = null; const raw = lsGet('vv_v1_' + id);
    if (raw) { try { data = JSON.parse(raw); } catch (_) { data = null; } }
    if (!data) { data = vil.wing ? await seedWing(vil) : await seedVillage(vil); }
    migrate(data); if (vil.wing) syncWing(data, vil); lsSet('vv_v1_' + id, JSON.stringify(data));
    this.cache[id] = data; return data;
  },
  save(v) { return lsSet('vv_v1_' + v.id, JSON.stringify(v)); }
};

/* ---------- Owner (master admin) store: separate from every village ---------- */
const OWN = {
  data: null,
  peek() { try { const r = lsGet('vv_owner_v1'); return r ? JSON.parse(r) : null; } catch (_) { return null; } },
  async load() {
    if (this.data) return this.data;
    this.data = this.peek();
    if (!this.data) {
      this.data = { id: CONFIG.OWNER_ID, name: 'Platform Owner', hash: ((await hashPw('owner', 'x', 'x')).startsWith('sha:') ? CONFIG.OWNER_DEFAULT_HASH.sha : CONFIG.OWNER_DEFAULT_HASH.djb), defaultPw: true, names: {}, removed: {}, log: [] };
      this.save();
    }
    this.data.names = this.data.names || {}; this.data.removed = this.data.removed || {}; this.data.log = this.data.log || [];
    this.data.email = CONFIG.PLATFORM_OWNER_EMAIL;
    return this.data;
  },
  save() { if (!lsSet('vv_owner_v1', JSON.stringify(this.data))) warnStorage(); }
};
// Apply village names changed by the owner or by a village admin, and hide villages the owner removed
function readPubNames() { try { return JSON.parse(lsGet('vv_names_v1') || '{}'); } catch (_) { return {}; } }
function readPubCodes() { try { return JSON.parse(lsGet('vv_codes_v1') || '{}'); } catch (_) { return {}; } }
function setPubCode(id, code) { const p = readPubCodes(); p[id] = code; lsSet('vv_codes_v1', JSON.stringify(p)); }
function setPubName(id, name) { const p = readPubNames(); p[id] = name; lsSet('vv_names_v1', JSON.stringify(p)); }
(function loadExtraVillages() { try { JSON.parse(lsGet('vv_extra_v1') || '[]').forEach(x => { if (!VILLAGES.some(v => v.id === x.id)) VILLAGES.push(x); }); } catch (_) {} })();
function saveExtraVillages() { lsSet('vv_extra_v1', JSON.stringify(VILLAGES.filter(v => v.custom))); }
(function applyNameOverrides() {
  const o = OWN.peek() || {}, pub = readPubNames(), pc = readPubCodes();
  VILLAGES.forEach(v => { if (o.names && o.names[v.id]) v.name = o.names[v.id]; if (pub[v.id]) v.name = pub[v.id]; if (pc[v.id]) v.code = pc[v.id]; if (o.removed && o.removed[v.id]) v.removed = true; });
})();
