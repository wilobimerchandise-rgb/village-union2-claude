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
  OWNER_DEFAULT_PASSWORD: 'owner-2026',   // change it after the first sign-in
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
  for (let i = 0; i < 3; i++) users.push({ id: `${code}-A${pad(i + 1)}`, name: `${FIRST[(i * 7 + off + 3) % 26]} ${LAST[(i * 3 + off + 5) % 20]}`, role: 'admin', title: adminTitles[i], ...famKin(i, off), phone: `0803${Math.floor(1000000 + R() * 8999999)}`, email: '', joined: '2019-01-15', active: true });
  for (let i = 0; i < 22; i++) users.push({ id: `${code}-M${String(i + 1).padStart(3, '0')}`, name: `${FIRST[(i * 3 + off) % 26]} ${LAST[(i * 5 + off) % 20]}`, role: 'member', title: 'Member', ...famKin(i, off), phone: `080${Math.floor(10000000 + R() * 89999999)}`, email: '', joined: `${2012 + Math.floor(R() * 10)}-${pad(1 + Math.floor(R() * 12))}-10`, active: i !== 21 });
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
  return { id: vil.id, name: vil.name, code, settings, users, tx, expenses, audit, seq: { tx: seq, exp: items.length, aud: lseq, mbr: 22 }, seededAt: stamp() };
}

/* ---------- Bring older saved data up to date (adds the newer fields) ---------- */
const PALETTE = ['#1A1A4E', '#D2395B', '#12806A', '#F5B83D', '#6C5CE7', '#0E7490', '#B45309', '#9D174D', '#4D7C0F', '#7C3AED'];
const BANKS = ['First Bank of Nigeria', 'Guaranty Trust Bank', 'Access Bank', 'United Bank for Africa', 'Zenith Bank', 'Fidelity Bank'];
function migrate(v) {
  v.settings = v.settings || { levies: {} }; v.settings.levies = v.settings.levies || {};
  v.pledges = v.pledges || []; v.type = v.type || 'village';
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
  return v;
}

/* ---------- Database layer (one record per village) ---------- */
const DB = {
  cache: {},
  async load(id) {
    if (this.cache[id]) return this.cache[id];
    const vil = VILLAGES.find(v => v.id === id); if (!vil) throw new Error('Unknown village.');
    let data = null; const raw = lsGet('vv_v1_' + id);
    if (raw) { try { data = JSON.parse(raw); } catch (_) { data = null; } }
    if (!data) { data = await seedVillage(vil); }
    migrate(data); lsSet('vv_v1_' + id, JSON.stringify(data));
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
      this.data = { id: CONFIG.OWNER_ID, name: 'Platform Owner', hash: await hashPw('owner', CONFIG.OWNER_ID, CONFIG.OWNER_DEFAULT_PASSWORD), defaultPw: true, names: {}, removed: {}, log: [] };
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

/* ---------- App state ---------- */
const S = { v: null, u: null, page: 'overview', f: {}, tab: 'collections', owner: false };
const isAdmin = () => !!S.u && S.u.role === 'admin';
const userById = id => S.v.users.find(u => u.id === id);
const nameOf = id => (userById(id) || { name: 'Former member' }).name;

/* ---------- Permission-checked data operations ---------- */
const isReadonly = () => !!S.v && S.v.status === 'readonly' && !S.owner;
function requireWritable() { if (isReadonly()) throw new Error('This village is in read-only mode right now. Contact VillageVault support.'); }
function requireAdmin() { if (!S.u || S.u.role !== 'admin' || !S.u.active) throw new Error('Only a village admin can do this.'); requireWritable(); }
function log(action, target, detail) {
  // Anything the owner does inside a village goes to the owner's private log only, so villages never see it.
  if (S.owner) { olog(action, S.v.name, `${target}: ${detail}`); OWN.save(); return; }
  S.v.seq.aud = (S.v.seq.aud || 0) + 1;
  S.v.audit.push({ id: 'L' + S.v.seq.aud, ts: stamp(), adminId: S.u.id, adminName: S.u.name, adminTitle: S.u.title, action, target, detail });
}
function commit() { if (!DB.save(S.v)) warnStorage(); }
function nextId(kind, prefix) { S.v.seq[kind] = (S.v.seq[kind] || 0) + 1; return `${S.v.code}-${prefix}${String(S.v.seq[kind]).padStart(prefix === 'T' ? 4 : 3, '0')}`; }

const visibleTx = () => isAdmin() ? S.v.tx : S.v.tx.filter(t => t.memberId === S.u.id);
const myTx = () => S.v.tx.filter(t => t.memberId === S.u.id);
const villageTx = () => S.v.tx.filter(t => t.status === 'verified');
const activeExp = () => S.v.expenses.filter(e => e.status !== 'void');
const pendingTx = () => S.v.tx.filter(t => t.status === 'pending');
const getTx = id => { const t = S.v.tx.find(x => x.id === id); if (!t) throw new Error('Record not found.'); if (!isAdmin() && t.memberId !== S.u.id) throw new Error('You can only open your own records.'); return t; };

const TX_FIELDS = { memberId: 'Member', levy: 'Levy', amount: 'Amount', date: 'Payment date', method: 'Method', ref: 'Reference', status: 'Status', note: 'Note' };
function showVal(field, v) {
  if (field === 'memberId') return nameOf(v);
  if (field === 'levy') return levyOf(v).name;
  if (field === 'amount') return money(v);
  if (field === 'date') return fmtDate(v);
  return v === '' || v == null ? 'blank' : String(v);
}
function diffTx(a, b) { return Object.keys(TX_FIELDS).filter(k => String(a[k] == null ? '' : a[k]) !== String(b[k] == null ? '' : b[k])).map(k => ({ field: k, from: a[k], to: b[k] })); }
const changeText = ch => ch.map(c => `${TX_FIELDS[c.field]}: ${showVal(c.field, c.from)} to ${showVal(c.field, c.to)}`).join('; ');

function stampUpdate(rec, changes, kind) {
  rec.updatedBy = S.u.name; rec.updatedById = S.u.id; rec.updatedAt = stamp();
  rec.history = rec.history || [];
  rec.history.push({ ts: rec.updatedAt, by: S.u.name, byTitle: S.u.title, kind, text: changes });
}

const API = {
  submitProof(d) {
    if (isAdmin()) throw new Error('Admins record payments from the Transactions page.');
    requireWritable();
    const t = { id: nextId('tx', 'T'), memberId: S.u.id, levy: d.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref, note: d.note || '', status: 'pending', proof: d.proof, submittedAt: stamp(), submittedBy: S.u.name, updatedBy: null, updatedAt: null, history: [] };
    S.v.tx.push(t); commit(); return t;
  },
  verify(id, amount, note) {
    requireAdmin(); const t = getTx(id);
    if (t.status !== 'pending') throw new Error('Only pending payments can be verified.');
    if (t.memberId === S.u.id) throw new Error('You cannot verify your own payment. Another admin must verify it.');
    const changes = []; if (Number(amount) !== Number(t.amount)) { changes.push(`Amount corrected from ${money(t.amount)} to ${money(amount)}`); t.amount = Number(amount); }
    if (note) t.note = note;
    t.status = 'verified'; t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); delete t.rejectReason;
    stampUpdate(t, ['Verified payment'].concat(changes).join('. '), 'verify');
    log('Verified payment', t.id, `${levyOf(t.levy).name} ${money(t.amount)} from ${nameOf(t.memberId)}${changes.length ? ' (' + changes.join('; ') + ')' : ''}`);
    commit(); return t;
  },
  reject(id, reason) {
    requireAdmin(); const t = getTx(id);
    if (t.status !== 'pending') throw new Error('Only pending payments can be rejected.');
    if (t.memberId === S.u.id) throw new Error('You cannot reject your own payment. Another admin must review it.');
    t.status = 'rejected'; t.rejectReason = reason; t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp();
    stampUpdate(t, 'Rejected: ' + reason, 'reject');
    log('Rejected payment', t.id, `${levyOf(t.levy).name} ${money(t.amount)} from ${nameOf(t.memberId)}: ${reason}`);
    commit(); return t;
  },
  addTx(d) {
    requireAdmin(); if (d.memberId === S.u.id && d.status === 'verified') throw new Error('You cannot record your own payment as verified. Upload your proof so another admin can verify it.');
    const t = { id: nextId('tx', 'T'), memberId: d.memberId, levy: d.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref, note: d.note || '', status: d.status, proof: d.proof || null, submittedAt: stamp(), submittedBy: S.u.name + ' (admin entry)', updatedBy: null, updatedAt: null, history: [] };
    if (t.status === 'verified') { t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); }
    S.v.tx.push(t);
    stampUpdate(t, `Recorded by admin as ${t.status}`, 'create');
    log('Added payment record', t.id, `${levyOf(t.levy).name} ${money(t.amount)} for ${nameOf(t.memberId)} (${t.status})`);
    commit(); return t;
  },
  editTx(id, d) {
    requireAdmin(); const t = getTx(id); const before = Object.assign({}, t); if (t.memberId === S.u.id && d.status === 'verified' && before.status !== 'verified') throw new Error('You cannot verify your own payment. Another admin must do it.');
    ['memberId', 'levy', 'amount', 'date', 'method', 'ref', 'note', 'status'].forEach(k => { t[k] = d[k]; });
    const ch = diffTx(before, t); if (!ch.length && !d.proof) throw new Error('Nothing was changed.');
    if (d.proof) t.proof = d.proof;
    if (t.status === 'verified' && before.status !== 'verified') { t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); delete t.rejectReason; }
    if (t.status === 'rejected') { t.rejectReason = d.reason || t.rejectReason || 'Rejected by admin'; t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); }
    const txt = (changeText(ch) || '') + (d.proof ? (ch.length ? '; ' : '') + 'Proof file replaced' : '');
    stampUpdate(t, txt, 'edit'); log('Edited payment record', t.id, txt); commit(); return t;
  },
  voidTx(id, reason) {
    requireAdmin(); const t = getTx(id); if (t.status === 'void') throw new Error('This record is already void.');
    const was = t.status; t.status = 'void'; t.voidReason = reason; t.voidedBy = S.u.name; t.voidedAt = stamp();
    stampUpdate(t, `Voided (was ${was}): ${reason}`, 'void');
    log('Voided payment record', t.id, `${levyOf(t.levy).name} ${money(t.amount)} for ${nameOf(t.memberId)}: ${reason}`); commit(); return t;
  },
  addMember(d) {
    requireAdmin(); if (capReached()) throw new Error('The Basic plan covers up to 20 members. Upgrade to Premium to add more.');
    const id = nextId('mbr', 'M'); return hashPw(S.v.id, id, d.password).then(h => {
      const u = { id, name: d.name, role: 'member', title: 'Member', family: d.family || '', kindred: d.kindred || '', phone: d.phone, email: d.email || '', joined: today(), active: true, hash: h, mustChange: true, tempPw: d.password, createdBy: S.u.name, createdAt: stamp() };
      S.v.users.push(u); S.v.credLog.push({ memberId: id, by: S.u.name, at: stamp(), kind: 'issued' }); log('Added member', id, `${u.name}${kinOf(u) ? ' (' + kinOf(u) + ')' : ''}`); commit(); return u;
    });
  },
  editMember(id, d) {
    requireAdmin(); const u = userById(id); if (!u || u.role !== 'member') throw new Error('Member not found.');
    const ch = []; ['name', 'family', 'kindred', 'phone', 'email'].forEach(k => { if ((u[k] || '') !== (d[k] || '')) { ch.push(`${cap(k)}: ${u[k] || 'blank'} to ${d[k] || 'blank'}`); u[k] = d[k]; } });
    const act = d.active === 'yes'; if (act !== u.active) { ch.push(act ? 'Account activated' : 'Account deactivated'); u.active = act; }
    if (!ch.length) throw new Error('Nothing was changed.');
    u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Edited member', id, `${u.name}: ${ch.join('; ')}`); commit(); return u;
  },
  resetPassword(id, pw) {
    requireAdmin(); const u = userById(id); if (!u) throw new Error('Member not found.');
    return hashPw(S.v.id, u.id, pw).then(h => { u.hash = h; u.mustChange = true; u.tempPw = pw; u.rememberTokens = []; S.v.credLog.push({ memberId: u.id, by: S.u.name, at: stamp(), kind: 'reset' }); u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Reset member password', id, `Password reset for ${u.name}`); commit(); });
  },
  saveExpense(id, d) {
    requireAdmin();
    if (!id) {
      const e = { id: nextId('exp', 'E'), date: d.date, category: d.category, description: d.description, amount: d.amount, status: 'active', createdBy: S.u.name, createdById: S.u.id, createdAt: stamp(), updatedBy: null, updatedAt: null };
      S.v.expenses.push(e); log('Recorded expense', e.id, `${e.category}: ${e.description}, ${money(e.amount)}`); commit(); return e;
    }
    const e = S.v.expenses.find(x => x.id === id); if (!e) throw new Error('Expense not found.');
    const ch = []; ['date', 'category', 'description', 'amount'].forEach(k => { if (String(e[k]) !== String(d[k])) { ch.push(`${cap(k)}: ${k === 'amount' ? money(e[k]) + ' to ' + money(d[k]) : e[k] + ' to ' + d[k]}`); e[k] = k === 'amount' ? Number(d[k]) : d[k]; } });
    if (!ch.length) throw new Error('Nothing was changed.');
    e.updatedBy = S.u.name; e.updatedAt = stamp(); log('Edited expense', e.id, ch.join('; ')); commit(); return e;
  },
  voidExpense(id, reason) {
    requireAdmin(); const e = S.v.expenses.find(x => x.id === id); if (!e) throw new Error('Expense not found.');
    e.status = 'void'; e.voidReason = reason; e.updatedBy = S.u.name; e.updatedAt = stamp();
    log('Voided expense', e.id, `${e.category}: ${e.description}, ${money(e.amount)}. Reason: ${reason}`); commit();
  },
  saveLevies(vals) {
    requireAdmin(); const ch = [];
    levies().filter(l => l.fixed).forEach(l => { const o = S.v.settings.levies[l.id], n = Number(vals[l.id]); if (o !== n) { ch.push(`${l.name}: ${money(o)} to ${money(n)}`); S.v.settings.levies[l.id] = n; } });
    if (!ch.length) throw new Error('No amounts were changed.');
    log('Changed levy amounts', 'Settings', ch.join('; ')); commit();
  },
  issueReceipt(id) {
    requireAdmin(); const t = getTx(id);
    if (t.status !== 'verified') throw new Error('Receipts are only issued for verified payments.');
    if (!t.receiptNo) {
      S.v.seq.rct = (S.v.seq.rct || 0) + 1;
      t.receiptNo = `RCT-${S.v.code}-${new Date().getFullYear()}-${String(S.v.seq.rct).padStart(4, '0')}`; t.receiptBy = S.u.name; t.receiptById = S.u.id; t.receiptAt = stamp();
      log('Issued receipt', t.id, `${t.receiptNo}: ${levyOf(t.levy).name} ${money(t.amount)} for ${nameOf(t.memberId)}`); commit();
    }
    return t;
  },
  async changePassword(cur, nw) {
    const h = await hashPw(S.v.id, S.u.id, cur); if (h !== S.u.hash) throw new Error('Your current password is not correct.');
    S.u.hash = await hashPw(S.v.id, S.u.id, nw); S.u.mustChange = false; delete S.u.tempPw; S.u.rememberTokens = []; if (isAdmin()) log('Changed own password', S.u.id, 'Admin changed their password'); commit();
  }
};

/* ---------- Money helpers ---------- */
function memberPaid(id, year) { return villageTx().filter(t => t.memberId === id && yearOf(t.date) === year); }
function memberOutstanding(id, year) {
  const paid = memberPaid(id, year); let o = 0;
  levies().filter(l => l.fixed).forEach(l => { o += Math.max(0, (S.v.settings.levies[l.id] || 0) - sum(paid.filter(t => t.levy === l.id))); });
  return o;
}
// What a member owes, levy by levy (only verified payments count, so it updates by itself once an admin verifies)
function owingRows(id, yr) {
  const paid = memberPaid(id, yr);
  return levies().filter(l => l.fixed).map(l => { const need = S.v.settings.levies[l.id] || 0, p = sum(paid.filter(t => t.levy === l.id)); return { L: l, need, paid: p, owe: Math.max(0, need - p) }; });
}
const expectedPerMember = () => levies().filter(l => l.fixed).reduce((a, l) => a + (S.v.settings.levies[l.id] || 0), 0);
function monthlySeries(txs, months = 12) {
  const out = [], now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1), key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    out.push({ label: MON[d.getMonth()], title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, value: sum(txs.filter(t => t.date.slice(0, 7) === key)) });
  }
  return out;
}

/* ---------- Icons ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  village: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>',
  upload: '<path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v4h16v-4"/>',
  file: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c2.4.6 4 2.2 4 5.2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9 9h5a2 2 0 010 4H9m0 0h5.5a2 2 0 010 4H9M9 7v10"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M9 7h6M9 11h6"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

/* ---------- Toasts and modals ---------- */
function toast(msg, kind) {
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
  const box = $('#toasts'); while (box.children.length >= 3) box.firstChild.remove();
  box.appendChild(el); setTimeout(() => { el.remove(); }, kind === 'err' ? 6000 : 3600);
}
const MODAL = { onSubmit: null, opener: null };
function openModal(o) {
  const root = $('#modalRoot'); MODAL.opener = document.activeElement; MODAL.onSubmit = o.onSubmit || null;
  root.hidden = false; document.body.classList.add('no-scroll');
  root.innerHTML = `<div class="modal ${o.size || ''}" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <button class="icon-btn modal-x" type="button" data-act="close-modal" aria-label="Close">&#10005;</button>
    <h2 id="mTitle">${esc(o.title)}</h2>${o.sub ? `<p class="muted">${o.sub}</p>` : ''}
    <form id="mForm" novalidate>${o.body}
      <div class="form-error" id="mError" role="alert" hidden></div>
      <div class="modal-foot"><button type="button" class="btn btn-ghost" data-act="close-modal">${o.submit === false ? 'Close' : 'Cancel'}</button>${o.submit === false ? '' : `<button type="submit" class="btn ${o.danger ? 'btn-danger' : 'btn-primary'}" id="mSubmit">${esc(o.submit || 'Save')}</button>`}</div>
    </form></div>`;
  const first = $('#mForm input:not([type=hidden]),#mForm select,#mForm textarea', root); if (first) first.focus({ preventScroll: true });
  bindFileInputs(root);
}
function closeModal() {
  const root = $('#modalRoot'); root.hidden = true; root.innerHTML = ''; MODAL.onSubmit = null;
  if (!$('#loginModal') || $('#loginModal').hidden) document.body.classList.remove('no-scroll');
  if (MODAL.opener && MODAL.opener.focus && document.contains(MODAL.opener)) { try { MODAL.opener.focus(); } catch (_) {} }
}
function formError(msg, id = 'mError') { const el = $('#' + id); if (!el) return; el.textContent = msg; el.hidden = !msg; }

/* ---------- Form pieces ---------- */
const opt = (v, l, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`;
const levyOpts = (sel, all) => (all ? opt('', all, sel) : '') + levyAll().filter(l => !l.removed || l.id === sel).map(l => opt(l.id, l.name + (l.removed ? ' (removed)' : ''), sel)).join('');
const methodOpts = sel => METHODS.map(m => opt(m, m, sel)).join('');
const isVillageType = () => !S.v || S.v.type !== 'association';
const kinOf = u => [u && u.family, u && u.kindred].filter(Boolean).join(', ');
const kindredOpts = (sel, all) => (all ? opt('', all, sel) : '') + Array.from(new Set(S.v.users.map(u => u.kindred).filter(Boolean))).sort().map(k => opt(k, k, sel)).join('');
const MEMBER_CAP = 20, activeMembers = () => S.v.users.filter(u => u.role === 'member' && u.active).length, capReached = () => S.v.plan !== 'premium' && activeMembers() >= MEMBER_CAP;
const memberOpts = (sel, all, onlyActive) => (all ? opt('', all, sel) : '') + S.v.users.filter(u => u.role === 'member' && (!onlyActive || u.active || u.id === sel)).map(u => opt(u.id, `${u.name} (${u.id})`, sel)).join('');
function yearOpts(sel, all) {
  const ys = new Set([new Date().getFullYear()]); S.v.tx.forEach(t => ys.add(yearOf(t.date))); S.v.expenses.forEach(e => ys.add(yearOf(e.date)));
  return (all ? opt('', all, sel) : '') + Array.from(ys).sort((a, b) => b - a).map(y => opt(y, y, sel)).join('');
}
const fileField = (label, kind) => `<div class="field"><label class="lbl" for="fProof">${label}</label>
  <label class="drop" for="fProof"><input type="file" id="fProof" name="proof" accept="${kind === 'logo' ? 'image/png,image/jpeg,image/webp' : 'image/*,application/pdf'}"><b>${kind === 'logo' ? 'Choose a logo image' : 'Choose a photo or PDF'}</b><small>${kind === 'logo' ? 'Square works best. PNG or JPG.' : 'Photo of the bank slip or a screenshot. Large photos are shrunk automatically.'}</small></label>
  <div class="preview" id="proofPrev" hidden></div></div>`;
function bindFileInputs(root) {
  $$('input[type=file]', root).forEach(inp => inp.addEventListener('change', async () => {
    const box = $('#proofPrev', root); if (!box) return; const f = inp.files && inp.files[0];
    if (!f) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    if (f.type === 'application/pdf') box.innerHTML = `<div class="pdfnote">PDF selected: ${esc(f.name)}</div>`;
    else if (f.type.startsWith('image/')) { const u = URL.createObjectURL(f); box.innerHTML = `<img src="${u}" alt="Selected proof of payment">`; }
    else box.innerHTML = `<div class="pdfnote">This file type is not supported.</div>`;
  }));
}
function fileToDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsDataURL(f); }); }
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That image could not be opened.')); i.src = src; }); }
async function readProof(file) {
  if (!file || !file.size) return null;
  const isPdf = file.type === 'application/pdf';
  if (!isPdf && !/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Upload a photo (JPG, PNG or WEBP) or a PDF.');
  if (isPdf) {
    if (file.size > CONFIG.MAX_PDF_KB * 1024) throw new Error(`That PDF is too large. Keep it under ${CONFIG.MAX_PDF_KB} KB, or upload a photo of the slip instead.`);
    return { name: file.name, type: file.type, data: await fileToDataURL(file) };
  }
  const img = await loadImg(await fileToDataURL(file));
  const k = Math.min(1, CONFIG.MAX_IMAGE_PX / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return { name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', data: c.toDataURL('image/jpeg', .72) };
}
function proofHTML(p) {
  if (!p) return '<div class="proof-view"><div class="none">No proof file is attached to this record.</div></div>';
  if (p.seed) return '<div class="proof-view"><div class="none">Sample record. No proof file is stored for demo data.</div></div>';
  if (p.type === 'application/pdf') return `<div class="proof-view"><iframe title="Proof of payment" src="${p.data}"></iframe></div><p class="hint" style="margin-top:6px"><a href="${p.data}" download="${esc(p.name)}">Download the PDF</a></p>`;
  return `<div class="proof-view"><img src="${p.data}" alt="Proof of payment"></div>`;
}

/* ---------- Table, badges, charts ---------- */
const badge = s => `<span class="badge b-${esc(s)}">${esc(cap(s))}</span>`;
function table(heads, rows, empty) {
  if (!rows.length) return `<div class="tablewrap"><div class="empty"><b>${esc(empty[0])}</b>${esc(empty[1] || '')}</div></div>`;
  return `<div class="tablewrap"><table class="t"><thead><tr>${heads.map(h => `<th${h.num ? ' class="num"' : ''}>${esc(h.t != null ? h.t : h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${heads[i] && heads[i].num ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pager(total, page, per) {
  const pages = Math.max(1, Math.ceil(total / per)); if (total <= per) return `<div class="pager"><span>${total} record${total === 1 ? '' : 's'}</span></div>`;
  return `<div class="pager"><span>Showing ${(page - 1) * per + 1} to ${Math.min(total, page * per)} of ${total}</span><div><button class="btn btn-ghost btn-sm" type="button" data-act="page" data-dir="-1"${page <= 1 ? ' disabled' : ''}>Previous</button><button class="btn btn-ghost btn-sm" type="button" data-act="page" data-dir="1"${page >= pages ? ' disabled' : ''}>Next</button></div></div>`;
}
const paginate = (arr, f) => { const per = CONFIG.PER_PAGE, pages = Math.max(1, Math.ceil(arr.length / per)); f.page = Math.min(Math.max(1, f.page || 1), pages); return arr.slice((f.page - 1) * per, f.page * per); };
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; }
function barChart(data) {
  const W = 600, H = 230, pl = 52, pb = 28, pt = 12, pr = 8, max = niceMax(Math.max(1, ...data.map(d => d.value))), bw = (W - pl - pr) / data.length;
  let g = '';
  for (let i = 0; i <= 3; i++) { const y = pt + (H - pt - pb) * (1 - i / 3); g += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="#E6ECE9"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end">${short(max * i / 3)}</text>`; }
  data.forEach((d, i) => {
    const h = (H - pt - pb) * d.value / max, x = pl + i * bw + bw * .18, y = H - pb - h;
    g += `<rect class="bar-r" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${Math.max(h, d.value ? 2 : 0).toFixed(1)}" rx="5"><title>${esc(d.title || d.label)}: ${money(d.value)}</title></rect><text x="${(x + bw * .32).toFixed(1)}" y="${H - 9}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Collections by month">${g}</svg>`;
}
function donut(parts) {
  const total = sum(parts, 'value'); if (!total) return `<div class="empty"><b>No verified payments yet</b>Totals appear here after the first verification.</div>`;
  let acc = 0, segs = '';
  parts.filter(p => p.value > 0).forEach(p => { const pc = p.value / total * 100; segs += `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${p.color}" stroke-width="6" stroke-dasharray="${pc.toFixed(3)} ${(100 - pc).toFixed(3)}" stroke-dashoffset="${(25 - acc).toFixed(3)}"><title>${esc(p.label)}: ${money(p.value)}</title></circle>`; acc += pc; });
  const legend = parts.map(p => `<span><i class="dot" style="background:${p.color}"></i>${esc(p.label)} <b style="color:var(--indigo)">${money(p.value)}</b></span>`).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 42 42" width="150" height="150" role="img" aria-label="Income by levy"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E6ECE9" stroke-width="6"/>${segs}<text x="21" y="22" text-anchor="middle" font-size="5.2" font-weight="800" fill="#1A1A4E">${short(total)}</text><text x="21" y="27" text-anchor="middle" font-size="2.6" fill="#5B5F7A">verified</text></svg><div class="legend" style="flex-direction:column;margin:0">${legend}</div></div>`;
}
const kpiLink = (act, l, v, s, tone, extra) => `<button type="button" class="kpi click ${tone || ''}" data-act="${act}"${extra || ''}><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div>${s ? `<div class="kpi-s">${s}</div>` : ''}<span class="kpi-go" aria-hidden="true">View details &rsaquo;</span></button>`;
const kpi = (l, v, s, tone) => `<div class="kpi ${tone || ''}"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div>${s ? `<div class="kpi-s">${s}</div>` : ''}</div>`;
function csvDownload(name, rows) {
  if (S.v && S.v.plan === 'premium') rows = [[`${S.v.name} (${S.v.code})`], []].concat(rows);
  const txt = rows.map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(name, new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
}
function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---------- Reports ---------- */
function buildReport(kind, year, month, memberId) {
  const v = S.v, mm = pad(month + 1);
  const start = kind === 'month' ? `${year}-${mm}-01` : `${year}-01-01`;
  const end = kind === 'month' ? `${year}-${mm}-31` : `${year}-12-31`;
  const periodLabel = kind === 'month' ? `${MONTHS[month]} ${year}` : `Year ${year}`;
  let tx = v.tx.filter(t => t.status === 'verified'); if (memberId) tx = tx.filter(t => t.memberId === memberId);
  const ex = memberId ? [] : activeExp();
  const before = tx.filter(t => t.date < start), inR = tx.filter(t => t.date >= start && t.date <= end);
  const exBefore = ex.filter(e => e.date < start), exIn = ex.filter(e => e.date >= start && e.date <= end);
  const byLevy = levyAll().filter(l => !l.removed || inR.some(t => t.levy === l.id)).map(l => { const a = inR.filter(t => t.levy === l.id); return { id: l.id, name: l.name, color: l.color, count: a.length, amount: sum(a) }; });
  const pend = pendingTx().filter(t => !memberId || t.memberId === memberId);
  const rep = {
    kind, year, month, memberId, start, end, periodLabel, village: v.name, code: v.code, premium: v.plan === 'premium', logo: v.logo || null,
    mode: memberId ? 'statement' : 'village',
    docTitle: memberId ? (kind === 'month' ? 'Member Monthly Statement' : 'Member Yearly Statement') : (kind === 'month' ? 'Monthly Financial Report' : 'Yearly Financial Report'),
    ref: `VR-${v.code}-${year}${kind === 'month' ? mm : ''}${memberId ? '-' + memberId : ''}`,
    bf: sum(before) - sum(exBefore), income: sum(inR), expense: sum(exIn), count: inR.length,
    byLevy, expenses: exIn.sort((a, b) => a.date.localeCompare(b.date)), txs: inR.sort((a, b) => a.date.localeCompare(b.date)),
    pendingCount: pend.length, pendingAmount: sum(pend),
    paidToDate: sum(tx.filter(t => t.date <= end)),
    generatedBy: S.u.name, generatedByTitle: S.u.title, generatedAt: fmtTS(stamp()),
    memberName: memberId ? nameOf(memberId) : ''
  };
  rep.cf = rep.bf + rep.income - rep.expense;
  if (!memberId) {
    rep.members = v.users.filter(u => u.role === 'member').map(u => {
      const per = {}; levyAll().forEach(l => { per[l.id] = sum(inR.filter(t => t.memberId === u.id && t.levy === l.id)); });
      return { id: u.id, name: u.name, per, total: levyAll().reduce((a, l) => a + per[l.id], 0), active: u.active };
    }).filter(m => m.active || m.total > 0).sort((a, b) => a.name.localeCompare(b.name));
  }
  if (kind === 'year') {
    rep.monthly = MON.map((l, i) => ({ label: l, title: `${MONTHS[i]} ${year}`, value: sum(inR.filter(t => Number(t.date.slice(5, 7)) === i + 1)) }));
  }
  return rep;
}

/* ---------- Minimal PDF writer (no libraries needed) ---------- */
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
class PDF {
  constructor(w, h) { this.W = w || 595.28; this.H = h || 841.89; this.pages = []; this.imgs = []; this.add(); }
  img(dataUrl, x, y, w, h, sw, sh) { try { const bin = atob(String(dataUrl).split(',')[1]); this.imgs.push({ bin, w: sw || 200, h: sh || 200 }); this.p.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} cm /Im${this.imgs.length - 1} Do Q`); } catch (_) {} }
  add() { this.p = []; this.pages.push(this.p); return this.p; }
  static a(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/₦/g, 'N').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '?'); }
  w(s, size, bold) { s = PDF.a(s); let t = 0; for (let i = 0; i < s.length; i++) t += HELV[s.charCodeAt(i) - 32] || 556; return t * size / 1000 * (bold ? 1.05 : 1); }
  fit(s, maxW, size, bold) { s = PDF.a(s); if (this.w(s, size, bold) <= maxW) return s; while (s.length > 1 && this.w(s + '..', size, bold) > maxW) s = s.slice(0, -1); return s + '..'; }
  rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(x => x.toFixed(3)).join(' '); }
  rect(x, y, w, h, fill) { this.p.push(`${this.rgb(fill)} rg ${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  line(x1, y1, x2, y2, color, lw) { this.p.push(`${lw || .6} w ${this.rgb(color || '#DCE3E0')} RG ${x1.toFixed(2)} ${(this.H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.H - y2).toFixed(2)} l S`); }
  text(s, x, y, o) {
    o = o || {}; const size = o.size || 10; s = PDF.a(s); let xx = x; const wd = this.w(s, size, o.bold);
    if (o.align === 'right') xx = x - wd; else if (o.align === 'center') xx = x - wd / 2;
    s = s.replace(/([\\()])/g, '\\$1');
    this.p.push(`BT /${o.bold ? 'F2' : 'F1'} ${size} Tf ${this.rgb(o.color || '#14142B')} rg ${xx.toFixed(2)} ${(this.H - y).toFixed(2)} Td (${s}) Tj ET`);
  }
  wmOps() {
    const t = PDF.a(this.wm), diag = Math.hypot(this.W, this.H), sz = Math.min(110, 0.66 * diag / (this.w(t, 1, true) || 1)), wd = this.w(t, sz, true), c = Math.SQRT1_2.toFixed(4);
    return `q ${c} ${c} -${c} ${c} ${(this.W / 2).toFixed(2)} ${(this.H / 2).toFixed(2)} cm BT /F2 ${sz.toFixed(1)} Tf 0.905 0.910 0.950 rg ${(-wd / 2).toFixed(2)} ${(-sz * 0.35).toFixed(2)} Td (${t.replace(/([\\()])/g, '\\$1')}) Tj ET Q`;
  }
  build(title) {
    const objs = [], kids = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    let id = 5; const xo = [];
    this.imgs.forEach((im, i) => { const oid = id++; xo.push(`/Im${i} ${oid} 0 R`); objs[oid] = `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bin.length} >>\nstream\n${im.bin}\nendstream`; });
    this.pages.forEach(pg => {
      const pid = id++, cid = id++, stream = (this.wm ? this.wmOps() + '\n' : '') + pg.join('\n'); kids.push(pid + ' 0 R');
      objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo.length ? ` /XObject << ${xo.join(' ')} >>` : ''} >> /Contents ${cid} 0 R >>`;
      objs[cid] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
    const infoId = id; objs[infoId] = `<< /Title (${PDF.a(title).replace(/([\\()])/g, '\\$1')}) /Producer (VillageVault) >>`;
    let out = '%PDF-1.4\n'; const off = [];
    for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xr = out.length; out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) out += String(off[i]).padStart(10, '0') + ' 00000 n \n';
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xr}\n%%EOF`;
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }
}
const pm = n => 'NGN ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function reportPdf(rep) {
  const pdf = new PDF(), M = 40, CW = pdf.W - 80, INK = '#14142B', MUT = '#5B5F7A';
  if (!rep.premium) pdf.wm = 'VillageVault';
  let y = 0;
  pdf.rect(0, 0, pdf.W, 118, '#1A1A4E'); pdf.rect(0, 118, pdf.W, 5, '#F5B83D');
  pdf.text(rep.premium ? pdf.fit(`${rep.village} (${rep.code})`, CW - 150, 10, true) : 'VillageVault', M, 38, { size: 10, bold: true, color: '#F5B83D' });
  if (rep.premium && rep.logo) pdf.img(rep.logo, pdf.W - M - 50, 52, 50, 50);
  pdf.text(rep.ref, pdf.W - M, 38, { size: 9, color: '#DADCF5', align: 'right' });
  pdf.text(rep.docTitle, M, 70, { size: 22, bold: true, color: '#FFFFFF' });
  pdf.text(`${rep.village} Village Union, ${rep.periodLabel}${rep.memberName ? ', ' + rep.memberName : ''}`, M, 94, { size: 12, color: '#DADCF5' });
  y = 148;
  const newPage = () => { pdf.add(); pdf.rect(0, 0, pdf.W, 26, '#1A1A4E'); pdf.text(`${rep.premium ? rep.village + ' (' + rep.code + ')' : 'VillageVault | ' + rep.village} | ${rep.docTitle} | ${rep.periodLabel}`, M, 17, { size: 8, color: '#DADCF5' }); y = 52; };
  const ensure = h => { if (y + h > pdf.H - 56) newPage(); };
  const title = t => { ensure(60); pdf.text(t, M, y + 4, { size: 12.5, bold: true, color: '#1A1A4E' }); y += 14; pdf.line(M, y, M + CW, y, '#1A1A4E', 1); y += 6; };
  const tbl = (cols, rows, opt) => {
    opt = opt || {}; const rh = opt.rh || 17;
    const head = () => { pdf.rect(M, y, CW, rh, '#EEF2F0'); let x = M; cols.forEach(c => { pdf.text(c.h, c.align === 'right' ? x + c.w - 6 : x + 6, y + rh - 5.5, { size: 8, bold: true, color: MUT, align: c.align === 'right' ? 'right' : 'left' }); x += c.w; }); y += rh; };
    ensure(rh * 3); head();
    rows.forEach((r, i) => {
      if (y + rh > pdf.H - 56) { newPage(); head(); }
      if (r.total) pdf.rect(M, y, CW, rh, '#F6EFD8'); else if (i % 2) pdf.rect(M, y, CW, rh, '#FAFCFB');
      let x = M; r.cells.forEach((c, k) => { const col = cols[k]; const s = pdf.fit(c, col.w - 12, 8.5, r.total); pdf.text(s, col.align === 'right' ? x + col.w - 6 : x + 6, y + rh - 5.5, { size: 8.5, bold: !!r.total, align: col.align === 'right' ? 'right' : 'left' }); x += col.w; });
      y += rh;
    });
    pdf.line(M, y, M + CW, y, '#DCE3E0'); y += 10;
  };
  // KPI boxes
  const kp = rep.mode === 'statement'
    ? [['Paid in period', rep.income], ['Payments counted', rep.count, true], ['Paid to date', rep.paidToDate], ['Awaiting verification', rep.pendingAmount]]
    : [['Brought forward', rep.bf], ['Income', rep.income], ['Expenditure', rep.expense], ['Carried forward', rep.cf]];
  const bw = (CW - 36) / 4;
  kp.forEach((k, i) => {
    const x = M + i * (bw + 12), hot = i === 3 && rep.mode !== 'statement';
    pdf.rect(x, y, bw, 52, hot ? '#1A1A4E' : '#EEF2F0');
    pdf.text(k[0], x + 10, y + 18, { size: 8, color: hot ? '#DADCF5' : MUT });
    pdf.text(k[2] ? String(k[1]) : pm(k[1]), x + 10, y + 38, { size: 13, bold: true, color: hot ? '#F5B83D' : '#1A1A4E' });
  });
  y += 72;
  // Income by levy
  title(rep.mode === 'statement' ? 'Payments by levy' : 'Income by levy');
  const tot = rep.income || 1;
  tbl([{ h: 'Levy', w: 190 }, { h: 'Payments', w: 70, align: 'right' }, { h: 'Amount', w: 130, align: 'right' }, { h: 'Share', w: 125, align: 'right' }],
    rep.byLevy.map(l => ({ cells: [l.name, String(l.count), pm(l.amount), (l.amount / tot * 100).toFixed(1) + '%'] })).concat([{ total: 1, cells: ['Total', String(rep.count), pm(rep.income), rep.income ? '100%' : '0%'] }]));
  // Year chart
  if (rep.monthly) {
    title('Income by month'); ensure(150);
    const max = niceMax(Math.max(1, ...rep.monthly.map(m => m.value))), ch = 100, bwid = CW / 12;
    for (let i = 0; i <= 2; i++) { const gy = y + ch - ch * i / 2; pdf.line(M + 40, gy, M + CW, gy, '#E6ECE9'); pdf.text(pm(max * i / 2).replace('NGN ', ''), M + 34, gy + 3, { size: 7, color: MUT, align: 'right' }); }
    rep.monthly.forEach((m, i) => { const h = ch * m.value / max, x = M + 40 + i * ((CW - 40) / 12) + 5; pdf.rect(x, y + ch - h, (CW - 40) / 12 - 10, h, i % 2 ? '#F5B83D' : '#1A1A4E'); pdf.text(m.label, x + ((CW - 40) / 12 - 10) / 2, y + ch + 11, { size: 7, color: MUT, align: 'center' }); });
    y += ch + 28;
  }
  if (rep.mode === 'statement') {
    title('Verified payments in this period');
    tbl([{ h: 'Date', w: 66 }, { h: 'Levy', w: 120 }, { h: 'Reference', w: 100 }, { h: 'Verified by', w: 129 }, { h: 'Amount', w: 100, align: 'right' }],
      rep.txs.map(t => ({ cells: [fmtDate(t.date), levyOf(t.levy).name, t.ref || '', t.verifiedBy || '', pm(t.amount)] })).concat(rep.txs.length ? [{ total: 1, cells: ['', 'Total', '', '', pm(rep.income)] }] : [{ cells: ['No verified payments in this period', '', '', '', ''] }]));
  } else {
    title('Member contributions');
    const cw = [62, 118, 50, 50, 50, 50, 50, 85];
    tbl([{ h: 'ID', w: cw[0] }, { h: 'Member', w: cw[1] }, { h: 'Annual', w: cw[2], align: 'right' }, { h: 'Burial', w: cw[3], align: 'right' }, { h: 'Insur.', w: cw[4], align: 'right' }, { h: 'Party', w: cw[5], align: 'right' }, { h: 'Support', w: cw[6], align: 'right' }, { h: 'Total', w: cw[7], align: 'right' }].map((c, i) => { c.w = [60, 120, 52, 52, 52, 52, 52, 75][i]; return c; }),
      rep.members.map(m => ({ cells: [m.id, m.name, ...['annual', 'burial', 'insurance', 'party', 'support'].map(k => m.per[k] ? Math.round(m.per[k]).toLocaleString('en-US') : '-'), pm(m.total).replace('NGN ', '')] }))
        .concat([{ total: 1, cells: ['', 'Total', ...['annual', 'burial', 'insurance', 'party', 'support'].map(k => Math.round(rep.byLevy.find(l => l.id === k).amount).toLocaleString('en-US')), pm(rep.income).replace('NGN ', '')] }]));
    title('Expenditure');
    tbl([{ h: 'Date', w: 66 }, { h: 'Category', w: 130 }, { h: 'Description', w: 219 }, { h: 'Amount', w: 100, align: 'right' }],
      rep.expenses.map(e => ({ cells: [fmtDate(e.date), e.category, e.description, pm(e.amount)] })).concat(rep.expenses.length ? [{ total: 1, cells: ['', 'Total', '', pm(rep.expense)] }] : [{ cells: ['No spending recorded in this period', '', '', ''] }]));
  }
  ensure(70);
  pdf.text(`Awaiting verification when this report was made: ${rep.pendingCount} payment${rep.pendingCount === 1 ? '' : 's'} (${pm(rep.pendingAmount)}). These are not counted above.`, M, y + 6, { size: 8.5, color: MUT }); y += 36;
  if (rep.mode !== 'statement') {
    ensure(70); pdf.line(M, y + 26, M + 190, y + 26, '#14142B', .8); pdf.line(M + CW - 190, y + 26, M + CW, y + 26, '#14142B', .8);
    pdf.text('Financial Secretary', M, y + 40, { size: 8.5, color: MUT }); pdf.text('Chairman', M + CW - 190, y + 40, { size: 8.5, color: MUT });
  }
  const n = pdf.pages.length;
  pdf.pages.forEach((pg, i) => {
    pdf.p = pg; pdf.line(M, pdf.H - 42, M + CW, pdf.H - 42, '#DCE3E0');
    pdf.text(`Generated by ${rep.generatedBy} (${rep.generatedByTitle}) on ${rep.generatedAt}. Only admin-verified payments are included.`, M, pdf.H - 28, { size: 7.5, color: MUT });
    pdf.text(`Page ${i + 1} of ${n}`, M + CW, pdf.H - 28, { size: 7.5, color: MUT, align: 'right' });
  });
  return pdf.build(`${rep.docTitle} ${rep.periodLabel}`);
}
function downloadReport(kind, year, month, memberId) {
  const rep = buildReport(kind, Number(year), Number(month), memberId || null);
  const blob = reportPdf(rep);
  download(`${S.v.code}-${rep.kind === 'month' ? `${year}-${pad(Number(month) + 1)}` : year}${memberId ? '-statement' : '-report'}.pdf`, blob);
  toast(`${rep.docTitle} for ${rep.periodLabel} downloaded.`, 'ok');
}

/* ---------- Shell and navigation ---------- */
const NAV = {
  member: [['overview', 'My dashboard', 'home'], ['village', 'Village dashboard', 'village'], ['achievements', 'My achievements', 'check'], ['halloffame', 'Sponsors hall of fame', 'coin']],
  admin: [['overview', 'Overview', 'home'], ['verify', 'Verify payments', 'check'], ['transactions', 'Transactions', 'list'], ['outstanding', 'Outstanding bills', 'coin'], ['pledges', 'Pledges', 'coin'], ['members', 'Members', 'users'], ['admins', 'Admins and duties', 'users'], ['register', 'Register', 'book'], ['expenses', 'Expenditure', 'coin'], ['levies', 'Levy categories', 'sliders'], ['profile', 'Village profile', 'village'], ['reports', 'Reports', 'file'], ['audit', 'Activity log', 'clock'], ['achievements', 'My achievements', 'check'], ['halloffame', 'Sponsors hall of fame', 'coin']],
  owner: [['o-overview', 'All villages', 'home'], ['o-villages', 'Manage villages', 'village'], ['o-admins', 'Village admins', 'users'], ['o-sponsors', 'Sponsors', 'coin'], ['o-reviews', 'Reviews', 'check'], ['o-log', 'Owner activity', 'clock'], ['o-account', 'My account', 'user']]
};
const TITLES = { overview: 'Overview', village: 'Village dashboard', reports: 'Reports', verify: 'Verify payments', transactions: 'Transactions', members: 'Members', expenses: 'Expenditure', levies: 'Levy categories', outstanding: 'Outstanding bills', pledges: 'Pledges', admins: 'Admins and duties', achievements: 'My achievements', halloffame: 'Sponsors hall of fame', 'o-reviews': 'Reviews', register: 'Register', profile: 'Village profile', audit: 'Activity log', 'o-overview': 'All villages', 'o-villages': 'Manage villages', 'o-admins': 'Village admins', 'o-sponsors': 'Sponsors', 'o-log': 'Owner activity', 'o-account': 'My account' };
const inOwnerConsole = () => S.owner && !S.v;
const roleKey = () => inOwnerConsole() ? 'owner' : (isAdmin() ? 'admin' : 'member');
function pageTitleText() {
  if (roleKey() === 'member' && S.page === 'overview') return 'My dashboard';
  return TITLES[S.page] || 'Overview';
}

function renderApp() {
  const ownerMode = inOwnerConsole(), vil = ownerMode ? null : VILLAGES.find(v => v.id === S.v.id), rk = roleKey();
  const head = ownerMode
    ? `<div class="side-village"><div class="vbadge" style="background:#F5B83D;color:#1A1A4E">VV</div><div><b>Owner console</b><small>All villages</small></div></div>`
    : `<div class="side-village">${S.v.logo ? `<img class="vlogo" src="${esc(S.v.logo)}" alt="">` : `<div class="vbadge" style="background:${vil.color};color:#fff">${esc(vil.code)}</div>`}<div><b>${esc(S.v.name)}</b><small>${S.owner ? 'Owner view' : 'Village or association'}</small></div></div>`;
  const who = ownerMode ? { n: OWN.data.name, s: 'Master admin' } : { n: S.u.name, s: S.owner ? 'Owner view of this village' : `${S.u.title}, ${S.u.id}` };
  const top = rk === 'member' ? '<button class="btn btn-saffron btn-sm" type="button" data-act="upload-proof">Upload proof</button>' : rk === 'admin' ? ('<button class="btn btn-saffron btn-sm" type="button" data-act="add-tx">Add payment</button>' + (S.u && S.u.id !== 'SUPPORT' && !S.owner ? '<button class="btn btn-ghost btn-sm" type="button" data-act="upload-proof">Upload my proof</button>' : '')) : '';
  $('#app').innerHTML = `<div class="shell">
    <aside class="side" id="side" aria-label="Sidebar">
      <a class="brand" href="#" data-act="home-link"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#F5B83D"/><path d="M16 6l8 5v10l-8 5-8-5V11z" fill="none" stroke="#1A1A4E" stroke-width="2.4"/><circle cx="16" cy="16" r="3" fill="#1A1A4E"/></svg><span>VillageVault</span></a>
      ${head}
      <nav class="navlist" id="navlist" aria-label="Dashboard"></nav>
      <div class="side-foot">
        <div class="who"><div class="avatar">${esc(initials(who.n))}</div><div><b>${esc(who.n)}</b><small>${esc(who.s)}</small></div></div>
        ${S.owner && S.v ? '<button class="btn-out" type="button" data-act="owner-back">Back to owner console</button>' : ''}
        <button class="btn-out" type="button" data-act="change-pw">Change password</button>
        ${S.v && !S.owner && rememberedFor(S.v.id) ? '<button class="btn-out" type="button" data-act="forget-device">Forget this device</button>' : ''}
        <button class="btn-out" type="button" data-act="logout">${icon('out')}Sign out</button>
      </div>
    </aside>
    <div class="scrim" data-act="close-side"></div>
    <div class="main">
      <header class="topbar"><button class="icon-btn menu-btn" type="button" data-act="open-side" aria-label="Open menu">${icon('menu')}</button><div class="grow"><h1 id="pageTitle"></h1><div class="sub" id="pageSub"></div></div>${top}</header>
      <main class="view" id="view" tabindex="-1"></main>
    </div></div>`;
  renderView();
}
function renderNav() {
  const rk = roleKey(), pend = rk === 'admin' ? pendingTx().length : 0, regN = rk === 'admin' ? S.v.requests.filter(r => r.status === 'new').length + S.v.meetings.reduce((a, m) => a + m.marks.filter(k => k.status === 'pending').length, 0) : 0, owN = rk === 'admin' ? owingList(new Date().getFullYear(), {}).length : 0;
  $('#navlist').innerHTML = NAV[rk].map(n => `<button type="button" data-act="goto" data-page="${n[0]}" class="${S.page === n[0] ? 'active' : ''}"${S.page === n[0] ? ' aria-current="page"' : ''}>${icon(n[2])}${n[1]}${n[0] === 'verify' && pend ? `<span class="count">${pend}</span>` : ''}${n[0] === 'register' && regN ? `<span class="count">${regN}</span>` : ''}${n[0] === 'outstanding' && owN ? `<span class="count count-soft">${owN}</span>` : ''}</button>`).join('');
}
function renderView() {
  const ae = document.activeElement, keep = ae && ae.dataset ? { k: ae.dataset.filter, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const rk = roleKey(), fn = (VIEWS[rk] || {})[S.page] || VIEWS[rk][NAV[rk][0][0]];
  $('#pageTitle').textContent = pageTitleText();
  $('#pageSub').textContent = rk === 'owner' ? 'Platform owner' : `${S.v.name}${S.owner ? ' (owner view)' : ''}`;
  renderNav();
  $('#view').innerHTML = fn();
  if (keep && keep.k) { const el = $(`[data-filter="${keep.k}"]`); if (el) { el.focus(); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (_) {} } }
}
function goto(p) { S.page = p; S.f = {}; document.body.classList.remove('side-open'); renderView(); window.scrollTo(0, 0); }

/* ---------- Shared transaction table ---------- */
function filterTx(list, f) {
  const q = (f.q || '').trim().toLowerCase();
  return list.filter(t => (!f.levy || t.levy === f.levy) && (!f.status || t.status === f.status) && (!f.year || yearOf(t.date) === Number(f.year)) && (!f.member || t.memberId === f.member) && (!f.month || Number(t.date.slice(5, 7)) === Number(f.month)) &&
    (!q || nameOf(t.memberId).toLowerCase().includes(q) || (t.ref || '').toLowerCase().includes(q) || t.id.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
const STATUS_OPTS = f => opt('', 'All statuses', f) + ['pending', 'verified', 'rejected', 'void'].map(s => opt(s, cap(s), f)).join('');
function txRow(t, admin) {
  const who = t.status === 'verified' || t.status === 'rejected' ? `${esc(t.verifiedBy || '')}<small>${esc(fmtTS(t.verifiedAt))}</small>` : '<small>Not yet checked</small>';
  const upd = t.updatedBy && (t.history || []).some(h => h.kind === 'edit') ? `<small>Edited by ${esc(t.updatedBy)}, ${esc(fmtTS(t.updatedAt))}</small>` : '';
  const act = admin ? `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View</button>${t.status === 'pending' ? (t.memberId === S.u.id ? '<small>Another admin must verify</small>' : `<button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Verify</button>`) : ''}${t.status === 'verified' ? `<button class="btn btn-saffron btn-sm" type="button" data-act="receipt" data-id="${t.id}">Receipt</button>` : ''}${t.status !== 'void' ? `<button class="btn btn-ghost btn-sm" type="button" data-act="edit-tx" data-id="${t.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="void-tx" data-id="${t.id}">Void</button>` : ''}</div>` : `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View</button></div>`;
  return [esc(fmtDate(t.date)), `<span class="dot" style="background:${levyOf(t.levy).color}"></span>${esc(levyOf(t.levy).name)}`]
    .concat(admin ? [`<button type="button" class="linkbtn" data-act="member-profile" data-id="${esc(t.memberId)}">${esc(nameOf(t.memberId))}</button><small>${esc(t.memberId)}</small>`] : [])
    .concat([esc(t.ref || '-'), money(t.amount), `${badge(t.status)}${t.status === 'rejected' && t.rejectReason ? `<small>${esc(t.rejectReason)}</small>` : ''}`, who + upd, act]);
}
function txTable(list, admin) {
  const f = S.f, page = paginate(list, f);
  const heads = ['Date', 'Levy'].concat(admin ? ['Member'] : []).concat(['Reference', { t: 'Amount', num: true }, 'Status', 'Checked by', { t: '', num: false }]);
  return table(heads, page.map(t => txRow(t, admin)), ['No records match', 'Try a different filter.']).replace(/<td class="num">(<div class="actions">)/g, '<td>$1') + pager(list.length, f.page, CONFIG.PER_PAGE);
}
function txDetail(id) {
  let t; try { t = getTx(id); } catch (e) { return toast(e.message, 'err'); }
  const adm = isAdmin(), L = levyOf(t.levy);
  const hist = (t.history || []).slice().reverse().map(h => `<li><b>${esc(h.text)}</b><small>${esc(h.by)}${h.byTitle ? ', ' + esc(h.byTitle) : ''} on ${esc(fmtTS(h.ts))}</small></li>`).join('');
  openModal({
    title: `${L.name}, ${money(t.amount)}`, size: 'modal-lg', submit: false,
    body: `<div class="form-row" style="margin-top:14px"><dl class="kv">
      ${adm ? `<dt>Member</dt><dd>${esc(nameOf(t.memberId))} (${esc(t.memberId)})</dd>` : ''}
      <dt>Record</dt><dd>${esc(t.id)}</dd><dt>Status</dt><dd>${badge(t.status)}</dd><dt>Payment date</dt><dd>${esc(fmtDate(t.date))}</dd><dt>Method</dt><dd>${esc(t.method)}</dd><dt>Reference</dt><dd>${esc(t.ref || '-')}</dd>
      <dt>Submitted</dt><dd>${esc(fmtTS(t.submittedAt))} by ${esc(t.submittedBy)}</dd>
      ${t.verifiedBy ? `<dt>${t.status === 'rejected' ? 'Rejected by' : 'Verified by'}</dt><dd>${esc(t.verifiedBy)}, ${esc(fmtTS(t.verifiedAt))}</dd>` : ''}
      ${t.rejectReason ? `<dt>Reason</dt><dd>${esc(t.rejectReason)}</dd>` : ''}${t.voidReason ? `<dt>Voided</dt><dd>${esc(t.voidedBy)}, ${esc(fmtTS(t.voidedAt))}: ${esc(t.voidReason)}</dd>` : ''}
      ${t.note ? `<dt>Note</dt><dd>${esc(t.note)}</dd>` : ''}
      ${t.updatedBy ? `<dt>Last updated</dt><dd>${esc(t.updatedBy)}, ${esc(fmtTS(t.updatedAt))}</dd>` : ''}</dl>
      <div><div class="lbl" style="margin-bottom:6px">Proof of payment</div>${proofHTML(proofOf(t))}</div></div>
      ${adm && t.status === 'verified' ? `<div style="margin-top:14px"><button type="button" class="btn btn-saffron btn-sm" data-act="receipt" data-id="${t.id}">${t.receiptNo ? 'Open receipt ' + esc(t.receiptNo) : 'Generate receipt'}</button></div>` : ''}
      ${hist ? `<div class="sec-title">History</div><ul class="timeline">${hist}</ul>` : ''}`
  });
}

/* ---------- Member views ---------- */
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
const MEMBER = {
  overview() {
    const yr = new Date().getFullYear(), mine = myTx(), ver = mine.filter(t => t.status === 'verified' && yearOf(t.date) === yr), pend = mine.filter(t => t.status === 'pending'), rej = mine.filter(t => t.status === 'rejected');
    const rows = levies().map(L => { const p = sum(ver.filter(t => t.levy === L.id)), need = L.fixed ? S.v.settings.levies[L.id] : 0; return { L, p, need }; });
    const out = memberOutstanding(S.u.id, yr), last = mine.filter(t => t.status === 'verified').sort((a, b) => b.date.localeCompare(a.date))[0];
    return `<div><h2 style="font-size:1.7rem">${greeting()}, ${esc(S.u.name.split(' ')[0])}.</h2><p class="muted">Here is where your payments stand for ${yr}.</p></div>
    ${membershipStrip()}
    ${rej.length ? `<div class="callout"><div><b>${rej.length} payment${rej.length > 1 ? 's were' : ' was'} rejected</b><p>See the reason in your payment records below, then upload the proof again.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof</button></div>` : ''}
    <div class="kpis">${kpi('Paid in ' + yr, money(sum(ver)), `${ver.length} verified payment${ver.length === 1 ? '' : 's'}`, 'hot')}${kpiLink('my-owing', 'Still to pay', money(out), out ? 'Tap to see what you owe and how to pay' : 'You are up to date', out ? 'bad' : 'good')}${kpi('Awaiting verification', String(pend.length), pend.length ? money(sum(pend)) + ' with the admin' : 'Nothing pending')}${kpi('Last verified payment', last ? esc(fmtDate(last.date)) : 'None yet', last ? esc(levyOf(last.levy).name) : '')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Your levies this year</h2><p>Verified payments against the amount set by your village</p></div><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof</button></div>
      <div class="progress-list">${rows.map(r => { const pc = r.need ? Math.min(100, r.p / r.need * 100) : 0; return `<div><div class="prog-top"><b>${esc(r.L.name)}</b><span>${r.L.fixed ? `${money(r.p)} of ${money(r.need)}` : `${money(r.p)} given`}</span></div><div class="bar"><i style="width:${r.L.fixed ? pc : (r.p ? 100 : 0)}%;--c:${r.L.color}"></i></div></div>`; }).join('')}</div></section>
    <section class="panel"><div class="panel-h"><h2>Recent activity</h2></div><div class="list">${mine.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6).map(t => `<div class="list-item"><div><b>${esc(levyOf(t.levy).name)}</b><small>${esc(fmtDate(t.date))}, ${money(t.amount)}</small></div>${badge(t.status)}</div>`).join('') || '<div class="empty"><b>No payments yet</b>Upload your first proof of payment.</div>'}</div></section></div>
    ${paymentPanel()}
    ${pledgePanel()}
    ${receiptsPanel()}
    ${attendanceMember()}
    ${sponsorsPanel()}
    ${MEMBER.records()}`;
  },
  records() {
    const f = S.f, list = filterTx(myTx(), f);
    return `<section class="panel"><div class="panel-h"><div><h2>My payment records</h2><p>Every proof you have sent and what the admin decided</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" type="button" data-act="export-tx">Download CSV</button><button class="btn btn-primary btn-sm" type="button" data-act="report-modal" data-scope="statement">Download my statement</button></div></div>
    <div class="toolbar"><div class="field"><label for="fl">Levy</label><select id="fl" class="select" data-filter="levy">${levyOpts(f.levy, 'All levies')}</select></div>
    <div class="field"><label for="fs">Status</label><select id="fs" class="select" data-filter="status">${STATUS_OPTS(f.status)}</select></div>
    <div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div></div>
    ${txTable(list, false)}</section>`;
  },
  village() {
    const f = S.f, tab = S.tab, yr = new Date().getFullYear(), ver = villageTx(), ex = activeExp();
    const inY = ver.filter(t => yearOf(t.date) === yr), exY = ex.filter(e => yearOf(e.date) === yr);
    const bal = sum(ver) - sum(ex), names = CONFIG.SHOW_MEMBER_NAMES_IN_VILLAGE_LEDGER;
    let body;
    if (tab === 'collections') {
      const list = filterTx(ver, f).map(t => t), page = paginate(list, f);
      body = `<div class="toolbar"><div class="field"><label for="fl">Levy</label><select id="fl" class="select" data-filter="levy">${levyOpts(f.levy, 'All levies')}</select></div><div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div>
        <div class="field"><label for="fm">Month</label><select id="fm" class="select" data-filter="month">${opt('', 'All months', f.month)}${MONTHS.map((m, i) => opt(i + 1, m, f.month)).join('')}</select></div></div>
        ${table(['Date', 'Levy'].concat(names ? ['Member'] : []).concat([{ t: 'Amount', num: true }]), page.map(t => [esc(fmtDate(t.date)), `<span class="dot" style="background:${levyOf(t.levy).color}"></span>${esc(levyOf(t.levy).name)}`].concat(names ? [esc(nameOf(t.memberId))] : []).concat([money(t.amount)])), ['No collections match', 'Try a different filter.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}`;
    } else {
      const list = ex.slice().sort((a, b) => b.date.localeCompare(a.date)), page = paginate(list, f);
      body = table(['Date', 'Category', 'Description', { t: 'Amount', num: true }], page.map(e => [esc(fmtDate(e.date)), esc(e.category), esc(e.description), money(e.amount)]), ['No spending recorded', '']) + pager(list.length, f.page, CONFIG.PER_PAGE);
    }
    return `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><p class="muted">Read-only view of ${esc(S.v.name)}'s collections, spending and admin activity. Only admins can change records.</p><button class="btn btn-primary btn-sm" type="button" data-act="report-modal" data-scope="village">Download village report</button></div>
    <div class="kpis">${kpi('Village balance', money(bal), 'All income less all spending', 'hot')}${kpi('Collected in ' + yr, money(sum(inY)), `${inY.length} verified payments`)}${kpi('Spent in ' + yr, money(sum(exY)), `${exY.length} items`)}${kpi('Active members', String(S.v.users.filter(u => u.role === 'member' && u.active).length), '')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Collections, last 12 months</h2><p>Verified payments only</p></div></div>${barChart(monthlySeries(ver))}</section>
    <section class="panel"><div class="panel-h"><h2>Income by levy in ${yr}</h2></div>${donut(levyAll().map(l => ({ label: l.name, color: l.color, value: sum(inY.filter(t => t.levy === l.id)) })))}</section></div>
    ${paymentPanel()}
    ${activityFeed()}
    ${attendanceRegisterView()}
    <section class="panel"><div class="panel-h"><div class="tabs" role="tablist"><button type="button" role="tab" data-act="tab" data-tab="collections" class="${tab === 'collections' ? 'active' : ''}" aria-selected="${tab === 'collections'}">Collections</button><button type="button" role="tab" data-act="tab" data-tab="spending" class="${tab === 'spending' ? 'active' : ''}" aria-selected="${tab === 'spending'}">Spending</button></div></div>${body}</section>`;
  }
};


/* ---------- Shared: reports and profile ---------- */
function closedPeriods(memberId) {
  const tx = (memberId ? myTx() : S.v.tx), now = new Date();
  let first = now.getFullYear(); tx.forEach(t => { first = Math.min(first, yearOf(t.date)); }); S.v.expenses.forEach(e => { first = Math.min(first, yearOf(e.date)); });
  const months = [], years = [];
  for (let y = now.getFullYear(); y >= first; y--) {
    years.push({ y, open: y === now.getFullYear() });
    for (let m = (y === now.getFullYear() ? now.getMonth() : 11); m >= 0; m--) months.push({ y, m, open: y === now.getFullYear() && m === now.getMonth() });
  }
  return { months: months.slice(0, 24), years };
}
function reportsView() {
  const f = S.f, now = new Date(), admin = isAdmin();
  const scope = admin ? 'village' : (f.scope || 'statement'), kind = f.kind || 'month', year = Number(f.year || now.getFullYear()), month = f.month !== undefined && f.month !== '' ? Number(f.month) : now.getMonth();
  const rep = buildReport(kind, year, month, scope === 'statement' ? S.u.id : null), per = closedPeriods(scope === 'statement' ? true : false);
  const memberFor = scope === 'statement' ? S.u.id : '';
  const mrows = rep.mode === 'village' ? rep.members.filter(m => m.total > 0) : [];
  return `<section class="panel"><div class="panel-h"><div><h2>Build a report</h2><p>Pick a period, check the figures, then download the PDF.</p></div><button class="btn btn-primary" type="button" data-act="dl-current">Download PDF</button></div>
    <div class="toolbar">
      ${admin ? '' : `<div class="field"><label for="rScope">Report for</label><select id="rScope" class="select" data-filter="scope">${opt('statement', 'My own statement', scope)}${opt('village', 'The whole village', scope)}</select></div>`}
      <div class="field"><label for="rKind">Period type</label><select id="rKind" class="select" data-filter="kind">${opt('month', 'Monthly', kind)}${opt('year', 'Yearly', kind)}</select></div>
      <div class="field"><label for="rYear">Year</label><select id="rYear" class="select" data-filter="year">${yearOpts(String(year))}</select></div>
      <div class="field"><label for="rMonth">Month</label><select id="rMonth" class="select" data-filter="month"${kind === 'year' ? ' disabled' : ''}>${MONTHS.map((m, i) => opt(i, m, month)).join('')}</select></div>
    </div>
    <div class="rep-sum">${rep.mode === 'statement'
      ? `<div><small>Paid in period</small><b>${money(rep.income)}</b></div><div><small>Payments</small><b>${rep.count}</b></div><div><small>Paid to date</small><b>${money(rep.paidToDate)}</b></div><div><small>Awaiting verification</small><b>${money(rep.pendingAmount)}</b></div>`
      : `<div><small>Brought forward</small><b>${money(rep.bf)}</b></div><div><small>Income</small><b>${money(rep.income)}</b></div><div><small>Expenditure</small><b>${money(rep.expense)}</b></div><div><small>Carried forward</small><b>${money(rep.cf)}</b></div>`}</div>
    ${table(['Levy', { t: 'Payments', num: true }, { t: 'Amount', num: true }], rep.byLevy.map(l => [`<span class="dot" style="background:${l.color}"></span>${esc(l.name)}`, String(l.count), money(l.amount)]).concat([[`<b>Total</b>`, `<b>${rep.count}</b>`, `<b>${money(rep.income)}</b>`]]), ['Nothing to show', ''])}
    ${mrows.length ? `<div class="sec-title">Top contributors in this period</div>${table(['Member', { t: 'Total paid', num: true }], mrows.slice().sort((a, b) => b.total - a.total).slice(0, 5).map(m => [`${esc(m.name)}<small>${esc(m.id)}</small>`, money(m.total)]), ['', ''])}` : ''}
  </section>
  <section class="panel"><div class="panel-h"><div><h2>Report library</h2><p>${scope === 'statement' ? 'Your statements' : 'Village reports'} for every closed month and year. The latest period is still open.</p></div></div>
    <div class="sec-title" style="margin-top:0">Yearly</div><div class="report-grid">${per.years.map(p => `<div class="rep-item"><div><b>Year ${p.y}</b><br><small>${p.open ? 'Year to date' : 'Closed'}</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="dl-report" data-kind="year" data-y="${p.y}" data-m="0" data-member="${memberFor}">Download PDF</button></div>`).join('')}</div>
    <div class="sec-title">Monthly</div><div class="report-grid">${per.months.map(p => `<div class="rep-item"><div><b>${MONTHS[p.m]} ${p.y}</b><br><small>${p.open ? 'Month to date' : 'Closed'}</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="dl-report" data-kind="month" data-y="${p.y}" data-m="${p.m}" data-member="${memberFor}">Download PDF</button></div>`).join('')}</div></section>`;
}
/* ---------- Admin views ---------- */
const ADMIN = {
  overview() {
    const yr = new Date().getFullYear(), ver = villageTx(), ex = activeExp(), inY = ver.filter(t => yearOf(t.date) === yr), exY = ex.filter(e => yearOf(e.date) === yr), pend = pendingTx();
    const behind = S.v.users.filter(u => u.role === 'member' && u.active).map(u => ({ u, o: memberOutstanding(u.id, yr) })).filter(x => x.o > 0).sort((a, b) => b.o - a.o);
    const recent = S.v.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 6);
    return `<div><h2 style="font-size:1.7rem">${greeting()}, ${esc(S.u.name.split(' ')[0])}.</h2><p class="muted">${esc(S.u.title)}, ${esc(S.v.name)}</p></div>
    ${S.v.requests.filter(r => r.status === 'new').length ? `<div class="callout"><div><b>${S.v.requests.filter(r => r.status === 'new').length} member${S.v.requests.filter(r => r.status === 'new').length > 1 ? 's are' : ' is'} asking for login details</b><p>Check each name against your register before you send anything.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="open-requests">See requests</button></div>` : ''}
    ${pend.length ? `<div class="callout"><div><b>${pend.length} payment${pend.length > 1 ? 's are' : ' is'} waiting for verification</b><p>${money(sum(pend))} is not in the books until you check the proof.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="goto" data-page="verify">Review now</button></div>` : `<div class="callout ok"><div><b>Everything is verified</b><p>No payments are waiting for you.</p></div></div>`}
    <div class="kpis">${kpiLink('kpi-collected', 'Collected in ' + yr, money(sum(inY)), `${inY.length} verified payments`, 'hot')}${kpiLink('kpi-spent', 'Spent in ' + yr, money(sum(exY)), `${exY.length} items`)}${kpiLink('kpi-balance', 'Village balance', money(sum(ver) - sum(ex)), 'All income less all spending', 'good')}${kpiLink('goto', 'Members behind', String(behind.length), `${money(sum(behind, 'o'))} outstanding. Tap to see who`, behind.length ? 'bad' : '', ' data-page="outstanding"')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Collections, last 12 months</h2><p>Verified payments only</p></div></div>${barChart(monthlySeries(ver))}</section>
    <section class="panel"><div class="panel-h"><h2>Income by levy in ${yr}</h2></div>${donut(levyAll().map(l => ({ label: l.name, color: l.color, value: sum(inY.filter(t => t.levy === l.id)) })))}</section></div>
    ${paymentPanel()}
    <div class="grid-2e"><section class="panel"><div class="panel-h"><h2>Waiting for verification</h2><button class="btn btn-ghost btn-sm" type="button" data-act="goto" data-page="verify">See all</button></div><div class="list">${pend.slice(0, 5).map(t => `<div class="list-item"><div><b>${esc(nameOf(t.memberId))}</b><small>${esc(levyOf(t.levy).name)}, ${money(t.amount)}, ${esc(fmtDate(t.date))}</small></div><button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Review</button></div>`).join('') || '<div class="empty"><b>All clear</b>New uploads will appear here.</div>'}</div></section>
    <section class="panel"><div class="panel-h"><h2>Recent admin activity</h2><button class="btn btn-ghost btn-sm" type="button" data-act="goto" data-page="audit">Full log</button></div><div class="list">${recent.map(a => `<button type="button" class="list-item rowbtn" data-act="audit-item" data-id="${esc(a.id)}"><div><b>${esc(a.action)}</b><small>${esc(a.adminName)}, ${esc(fmtTS(a.ts))}</small></div><span class="chev" aria-hidden="true">&rsaquo;</span></button>`).join('')}</div></section></div>
    ${sponsorsPanel(true)}`;
  },
  verify() {
    const list = pendingTx().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return `<section class="panel"><div class="panel-h"><div><h2>Payments waiting for you</h2><p>Compare each proof with the bank statement, then verify or reject.</p></div></div>
    ${table(['Submitted', 'Member', 'Levy', 'Reference', { t: 'Amount', num: true }, ''], list.map(t => [esc(fmtTS(t.submittedAt)), `${esc(nameOf(t.memberId))}<small>${esc(t.memberId)}</small>`, esc(levyOf(t.levy).name), esc(t.ref || '-'), money(t.amount), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View proof</button><button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Verify</button><button class="btn btn-danger btn-sm" type="button" data-act="reject-tx" data-id="${t.id}">Reject</button></div>`]), ['Nothing is waiting', 'New proofs from members will appear here.'])}</section>`;
  },
  transactions() {
    const f = S.f, list = filterTx(S.v.tx, f);
    return `<section class="panel"><div class="panel-h"><div><h2>All payment records</h2><p>Edits and voids are logged with your name and the time.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" type="button" data-act="export-tx">Download CSV</button><button class="btn btn-primary btn-sm" type="button" data-act="add-tx">Add payment</button></div></div>
    <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Member name, ID or reference"></div>
    <div class="field"><label for="fm1">Member</label><select id="fm1" class="select" data-filter="member">${memberOpts(f.member, 'All members')}</select></div>
    <div class="field"><label for="fl">Levy</label><select id="fl" class="select" data-filter="levy">${levyOpts(f.levy, 'All levies')}</select></div>
    <div class="field"><label for="fs">Status</label><select id="fs" class="select" data-filter="status">${STATUS_OPTS(f.status)}</select></div>
    <div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div></div>
    ${txTable(list, true)}</section>`;
  },
  members() {
    const f = S.f, yr = new Date().getFullYear(), q = (f.q || '').toLowerCase();
    const list = S.v.users.filter(u => u.role === 'member' && (!f.kin || u.kindred === f.kin) && (!f.state || (f.state === 'active') === u.active) && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    const page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Admin team</h2></div></div><div class="report-grid">${S.v.users.filter(u => u.role === 'admin').map(a => `<div class="rep-item"><div><b>${esc(a.name)}</b><br><small>${esc(a.title)}, ${esc(a.id)}</small></div></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-h"><div><h2>Members</h2><p>${list.length} shown, ${S.v.users.filter(u => u.role === 'member' && u.active).length} active${S.v.plan === 'premium' ? '' : ' of 20 allowed on Basic'}</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-member">Add member</button></div>
    ${capNotice()}<div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div>
    ${isVillageType() ? `<div class="field"><label for="fw">Kindred</label><select id="fw" class="select" data-filter="kin">${kindredOpts(f.kin, 'All kindreds')}</select></div>` : ''}
    <div class="field"><label for="fst">Account</label><select id="fst" class="select" data-filter="state">${opt('', 'All accounts', f.state)}${opt('active', 'Active', f.state)}${opt('off', 'Deactivated', f.state)}</select></div></div>
    ${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', { t: 'Paid ' + yr, num: true }, { t: 'Still to pay', num: true }, 'Account', ''], page.map(u => [`<button type="button" class="linkbtn" data-act="member-profile" data-id="${esc(u.id)}">${esc(u.name)}</button><small>${esc(u.id)}</small>`, ...(isVillageType() ? [esc(kinOf(u) || '-')] : []), esc(u.phone || '-'), money(sum(memberPaid(u.id, yr))), money(memberOutstanding(u.id, yr)), u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>', `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="member-profile" data-id="${u.id}">Open</button><button class="btn btn-ghost btn-sm" type="button" data-act="edit-member" data-id="${u.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="reset-pw" data-id="${u.id}">Reset password</button></div>`]), ['No members match', 'Try a different filter.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
  },
  expenses() {
    const f = S.f, list = S.v.expenses.filter(e => (!f.cat || e.category === f.cat) && (!f.year || yearOf(e.date) === Number(f.year))).sort((a, b) => b.date.localeCompare(a.date)), page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Money spent by the union</h2><p>Members can see these entries on Village records.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-exp">Record expense</button></div>
    <div class="toolbar"><div class="field"><label for="fc">Category</label><select id="fc" class="select" data-filter="cat">${opt('', 'All categories', f.cat)}${EXP_CATS.map(c => opt(c, c, f.cat)).join('')}</select></div><div class="field"><label for="fy">Year</label><select id="fy" class="select" data-filter="year">${yearOpts(f.year, 'All years')}</select></div></div>
    ${table(['Date', 'Category', 'Description', { t: 'Amount', num: true }, 'Recorded by', ''], page.map(e => [esc(fmtDate(e.date)), esc(e.category), esc(e.description) + (e.status === 'void' ? `<small>Voided: ${esc(e.voidReason)}</small>` : ''), e.status === 'void' ? `<s>${money(e.amount)}</s>` : money(e.amount), `${esc(e.createdBy)}<small>${esc(fmtTS(e.createdAt))}</small>${e.updatedBy ? `<small>Updated by ${esc(e.updatedBy)}, ${esc(fmtTS(e.updatedAt))}</small>` : ''}`, e.status === 'void' ? badge('void') : `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="edit-exp" data-id="${e.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="void-exp" data-id="${e.id}">Void</button></div>`]), ['No expenses recorded', ''])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
  },
  levies() {
    return `<section class="panel" style="max-width:640px"><div class="panel-h"><div><h2>Levy amounts for ${esc(S.v.name)}</h2><p>These amounts are used to work out what each member still owes. Party donations are voluntary and have no set amount.</p></div></div>
    <form data-form="levies" novalidate>${LEVIES.filter(l => l.fixed).map(l => `<div class="field"><label for="lv_${l.id}">${esc(l.name)} (naira)</label><input id="lv_${l.id}" name="${l.id}" class="input" type="number" min="0" step="100" value="${S.v.settings.levies[l.id]}" required></div>`).join('')}
    <div class="form-error" id="formErr" role="alert" hidden></div><div style="margin-top:20px"><button class="btn btn-primary" type="submit">Save amounts</button></div></form></section>`;
  },
  audit() {
    const f = S.f, admins = S.v.users.filter(u => u.role === 'admin'), actions = Array.from(new Set(S.v.audit.map(a => a.action))).sort();
    const list = S.v.audit.filter(a => (!f.admin || a.adminId === f.admin) && (!f.action || a.action === f.action)).sort((a, b) => b.ts.localeCompare(a.ts)), page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Who did what, and when</h2><p>Every verification, edit and change by an admin is recorded here.</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="export-audit">Download CSV</button></div>
    <div class="toolbar"><div class="field"><label for="fa">Admin</label><select id="fa" class="select" data-filter="admin">${opt('', 'All admins', f.admin)}${admins.map(a => opt(a.id, a.name, f.admin)).join('')}</select></div><div class="field"><label for="fac">Action</label><select id="fac" class="select" data-filter="action">${opt('', 'All actions', f.action)}${actions.map(a => opt(a, a, f.action)).join('')}</select></div></div>
    ${table(['When', 'Admin', 'Action', 'Record', 'Details'], page.map(a => [`<span class="nowrap">${esc(fmtTS(a.ts))}</span>`, `${esc(a.adminName)}<small>${esc(a.adminTitle || '')}</small>`, esc(a.action), esc(a.target), esc(a.detail)]), ['No activity yet', ''])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
  }
};
const VIEWS = {
  member: { overview: MEMBER.overview, village: MEMBER.village },
  admin: { overview: ADMIN.overview, verify: ADMIN.verify, transactions: ADMIN.transactions, members: ADMIN.members, expenses: ADMIN.expenses, levies: ADMIN.levies, reports: reportsView, audit: ADMIN.audit },
  owner: {}
};

/* ---------- Admin modal forms ---------- */
function txFormBody(t, mode) {
  const statuses = mode === 'add' ? ['verified', 'pending'] : ['pending', 'verified', 'rejected'];
  return `<div class="field"><label for="mMember">Member</label><select id="mMember" name="memberId" class="select" required>${memberOpts(t.memberId, 'Choose a member', true)}</select></div>
  <div class="form-row"><div class="field"><label for="mLevy">Levy</label><select id="mLevy" name="levy" class="select">${levyOpts(t.levy)}</select></div>
  <div class="field"><label for="mAmt">Amount (naira)</label><input id="mAmt" name="amount" class="input" type="number" min="1" step="1" value="${t.amount || ''}" required></div></div>
  <div class="form-row"><div class="field"><label for="mDate">Payment date</label><input id="mDate" name="date" class="input" type="date" max="${today()}" value="${esc(t.date || today())}" required></div>
  <div class="field"><label for="mMethod">Method</label><select id="mMethod" name="method" class="select">${methodOpts(t.method)}</select></div></div>
  <div class="form-row"><div class="field"><label for="mRef">Reference</label><input id="mRef" name="ref" class="input" type="text" maxlength="60" value="${esc(t.ref || '')}"></div>
  <div class="field"><label for="mStatus">Status</label><select id="mStatus" name="status" class="select">${statuses.map(s => opt(s, cap(s), t.status || 'verified')).join('')}</select></div></div>
  <div class="field"><label for="mReason">Rejection reason (only if rejected)</label><select id="mReason" name="reason" class="select">${opt('', 'Not rejected', t.rejectReason || '')}${REJECT_REASONS.map(r => opt(r, r, t.rejectReason)).join('')}</select></div>
  <div class="field"><label for="mNote">Note</label><textarea id="mNote" name="note" class="textarea" maxlength="300">${esc(t.note || '')}</textarea></div>
  ${fileField(mode === 'add' ? 'Proof of payment (optional)' : 'Replace proof (optional)')}`;
}
async function readTxForm(fd) {
  const d = { memberId: fd.get('memberId'), levy: fd.get('levy'), amount: Number(fd.get('amount')), date: fd.get('date'), method: fd.get('method'), ref: (fd.get('ref') || '').trim(), status: fd.get('status'), note: (fd.get('note') || '').trim(), reason: fd.get('reason') };
  if (!d.memberId) throw new Error('Choose a member.');
  if (!(d.amount > 0)) throw new Error('Enter an amount greater than zero.');
  if (!d.date) throw new Error('Choose the payment date.');
  if (d.date > today()) throw new Error('The payment date cannot be in the future.');
  if (d.status === 'rejected' && !d.reason) throw new Error('Choose a rejection reason.');
  d.proof = await readProof(fd.get('proof'));
  return d;
}
function done(msg) { toast(msg, 'ok'); closeModal(); renderView(); if (S.justVerified && S.justVerified.length) { const ids = S.justVerified; S.justVerified = null; setTimeout(() => { try { verifiedModal(ids); } catch (_) {} }, 60); } }
const ACTIONS = {
  'add-tx'() { openModal({ title: 'Add a payment record', sub: 'Use this for payments received outside the upload flow. Your name and the time are saved on the record.', body: txFormBody({}, 'add'), submit: 'Save record', onSubmit: async fd => { const t = API.addTx(await readTxForm(fd)); done(`Record ${t.id} saved.`); } }); },
  'edit-tx'(el) { const t = getTx(el.dataset.id); openModal({ title: 'Edit payment record', sub: `Record ${esc(t.id)}. Every change is logged under your name.`, body: txFormBody(t, 'edit'), submit: 'Save changes', onSubmit: async fd => { API.editTx(t.id, await readTxForm(fd)); done('Record updated.'); } }); },
  'verify-tx'(el) {
    const t = getTx(el.dataset.id);
    openModal({ title: 'Verify payment', size: 'modal-lg', sub: `${esc(nameOf(t.memberId))} says they paid ${esc(levyOf(t.levy).name)} on ${esc(fmtDate(t.date))} by ${esc(t.method)}. Reference: ${esc(t.ref || 'none')}.`,
      body: `<div class="form-row" style="margin-top:14px"><div>${proofHTML(proofOf(t))}</div><div><div class="field" style="margin-top:0"><label for="vAmt">Amount confirmed in the bank (naira)</label><input id="vAmt" name="amount" class="input" type="number" min="1" value="${t.amount}" required><span class="hint">Change this only if the proof shows a different amount.</span></div><div class="field"><label for="vNote">Note (optional)</label><textarea id="vNote" name="note" class="textarea" maxlength="300">${esc(t.note || '')}</textarea></div></div></div>`,
      submit: 'Verify and update records', onSubmit: fd => { const a = Number(fd.get('amount')); if (!(a > 0)) throw new Error('Enter the confirmed amount.'); API.verify(t.id, a, (fd.get('note') || '').trim()); done('Payment verified and the ledger updated.'); } });
  },
  'reject-tx'(el) {
    const t = getTx(el.dataset.id);
    openModal({ title: 'Reject payment', danger: true, sub: `${esc(nameOf(t.memberId))}, ${esc(levyOf(t.levy).name)}, ${money(t.amount)}. The member will see your reason.`,
      body: `<div class="field"><label for="rjR">Reason</label><select id="rjR" name="reason" class="select" required>${opt('', 'Choose a reason', '')}${REJECT_REASONS.map(r => opt(r, r, '')).join('')}</select></div>`, submit: 'Reject payment',
      onSubmit: fd => { if (!fd.get('reason')) throw new Error('Choose a reason so the member knows what to fix.'); API.reject(t.id, fd.get('reason')); done('Payment rejected.'); } });
  },
  'void-tx'(el) {
    const t = getTx(el.dataset.id);
    openModal({ title: 'Void this record?', danger: true, sub: `${esc(nameOf(t.memberId))}, ${esc(levyOf(t.levy).name)}, ${money(t.amount)}. Voided records stay in the history but no longer count in any total.`,
      body: `<div class="field"><label for="vdR">Reason</label><textarea id="vdR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Void record',
      onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Write a short reason for voiding.'); API.voidTx(t.id, r); done('Record voided.'); } });
  },
  'view-tx'(el) { txDetail(el.dataset.id); },
  'add-member'() {
    if (capReached()) return upgradeModal();
    const pw = 'Vv' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Add a member', sub: 'Give the member their ID and password. They can change the password after signing in.',
      body: `<div class="field"><label for="amN">Full name</label><input id="amN" name="name" class="input" maxlength="80" required></div><div class="form-row">${isVillageType() ? '<div class="field"><label for="amF">Family name</label><input id="amF" name="family" class="input" maxlength="40"></div><div class="field"><label for="amK">Kindred name</label><input id="amK" name="kindred" class="input" maxlength="40"></div>' : ''}<div class="field"><label for="amP">Phone</label><input id="amP" name="phone" class="input" type="tel" maxlength="20"></div></div><div class="field"><label for="amE">Email (optional)</label><input id="amE" name="email" class="input" type="email" maxlength="80"></div><div class="field"><label for="amPw">Starting password</label><input id="amPw" name="password" class="input" type="text" value="${pw}" minlength="6" required></div>`,
      submit: 'Add member', onSubmit: async fd => { const n = (fd.get('name') || '').trim(), p = fd.get('password') || ''; if (n.length < 3) throw new Error('Enter the member’s full name.'); if (p.length < 6) throw new Error('The password needs at least 6 characters.'); const u = await API.addMember({ name: n, family: (fd.get('family') || '').trim(), kindred: (fd.get('kindred') || '').trim(), phone: (fd.get('phone') || '').trim(), email: (fd.get('email') || '').trim(), password: p }); closeModal(); renderView(); toast(`${u.name} added.`, 'ok'); credModal(u.id); } });
  },
  'edit-member'(el) {
    const u = userById(el.dataset.id);
    openModal({ title: 'Edit member', sub: esc(u.id), body: `<div class="field"><label for="emN">Full name</label><input id="emN" name="name" class="input" value="${esc(u.name)}" required></div><div class="form-row">${isVillageType() ? `<div class="field"><label for="emF">Family name</label><input id="emF" name="family" class="input" maxlength="40" value="${esc(u.family || '')}"></div><div class="field"><label for="emK">Kindred name</label><input id="emK" name="kindred" class="input" maxlength="40" value="${esc(u.kindred || '')}"></div>` : ''}<div class="field"><label for="emP">Phone</label><input id="emP" name="phone" class="input" type="tel" value="${esc(u.phone || '')}"></div></div><div class="form-row"><div class="field"><label for="emE">Email</label><input id="emE" name="email" class="input" type="email" value="${esc(u.email || '')}"></div><div class="field"><label for="emA">Account</label><select id="emA" name="active" class="select">${opt('yes', 'Active', u.active ? 'yes' : 'no')}${opt('no', 'Deactivated', u.active ? 'yes' : 'no')}</select></div></div>`,
      submit: 'Save changes', onSubmit: fd => { const n = (fd.get('name') || '').trim(); if (n.length < 3) throw new Error('Enter the member’s full name.'); API.editMember(u.id, { name: n, family: isVillageType() ? (fd.get('family') || '').trim() : '', kindred: isVillageType() ? (fd.get('kindred') || '').trim() : '', phone: (fd.get('phone') || '').trim(), email: (fd.get('email') || '').trim(), active: fd.get('active') }); done('Member updated.'); } });
  },
  'reset-pw'(el) {
    const u = userById(el.dataset.id), pw = 'Vv' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Reset password', sub: `${esc(u.name)} (${esc(u.id)})`, body: `<div class="field"><label for="rpP">New password</label><input id="rpP" name="password" class="input" type="text" value="${pw}" minlength="6" required><span class="hint">Tell the member this password. It is not stored in readable form.</span></div>`, submit: 'Reset password',
      onSubmit: async fd => { const p = fd.get('password') || ''; if (p.length < 6) throw new Error('The password needs at least 6 characters.'); await API.resetPassword(u.id, p); closeModal(); renderView(); credModal(u.id); } });
  },
  'add-exp'() { expModal(null); },
  'edit-exp'(el) { expModal(S.v.expenses.find(e => e.id === el.dataset.id)); },
  'void-exp'(el) {
    const e = S.v.expenses.find(x => x.id === el.dataset.id);
    openModal({ title: 'Void this expense?', danger: true, sub: `${esc(e.category)}: ${esc(e.description)}, ${money(e.amount)}`, body: `<div class="field"><label for="veR">Reason</label><textarea id="veR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Void expense',
      onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Write a short reason for voiding.'); API.voidExpense(e.id, r); done('Expense voided.'); } });
  },
  'export-tx'() { const rows = [['Record', 'Date', 'Member', 'Levy', 'Amount', 'Status', 'Reference', 'Method', 'Checked by', 'Checked at', 'Last updated by', 'Last updated at']]; filterTx(visibleTx(), S.f).forEach(t => rows.push([t.id, t.date, nameOf(t.memberId), levyOf(t.levy).name, t.amount, t.status, t.ref, t.method, t.verifiedBy || '', t.verifiedAt ? fmtTS(t.verifiedAt) : '', t.updatedBy || '', t.updatedAt ? fmtTS(t.updatedAt) : ''])); csvDownload(`${S.v.code}-records.csv`, rows); },
  'export-audit'() { requireAdmin(); const rows = [['When', 'Admin', 'Title', 'Action', 'Record', 'Details']]; S.v.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts)).forEach(a => rows.push([fmtTS(a.ts), a.adminName, a.adminTitle, a.action, a.target, a.detail])); csvDownload(`${S.v.code}-activity-log.csv`, rows); },
  'dl-report'(el) { downloadReport(el.dataset.kind, el.dataset.y, el.dataset.m, el.dataset.member); },
  'dl-current'() { const f = S.f, now = new Date(), scope = isAdmin() ? 'village' : (f.scope || 'statement'); downloadReport(f.kind || 'month', f.year || now.getFullYear(), f.month !== undefined && f.month !== '' ? f.month : now.getMonth(), scope === 'statement' ? S.u.id : ''); },
  'goto'(el) { goto(el.dataset.page); },
  'tab'(el) { S.tab = el.dataset.tab; S.f = {}; renderView(); },
  'page'(el) { S.f.page = (S.f.page || 1) + Number(el.dataset.dir); renderView(); },
  'logout'() { logout(); },
  'open-side'() { document.body.classList.add('side-open'); },
  'close-side'() { document.body.classList.remove('side-open'); },
  'home-link'(el, e) { e.preventDefault(); if (S.v || S.owner) goto(NAV[roleKey()][0][0]); },
  'close-modal'() { closeModal(); },
  'pick-village'(el) { pickVillage(el.dataset.village); },
  'focus-access'() { focusAccess(); },
  'close-owner'() { closeOwnerLogin(); },
  'owner-back'() { ownerBack(); },
  'upload-proof'() { uploadModal(); },
  'report-modal'(el) { reportModal(el.dataset.scope); },
  'change-pw'() { changePwModal(); },
  'toggle-pw'(el) { const i = el.parentElement.querySelector('input'); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show'; el.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); },
  'toggle-nav'(el) { const n = $('#nav'); const open = n.classList.toggle('open'); el.setAttribute('aria-expanded', String(open)); },
  'scroll'(el, e) { e.preventDefault(); const t = document.getElementById(el.dataset.target); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#nav').classList.remove('open'); },
  'demo-fill'(el) { $('#loginId').value = el.dataset.id; $('#loginPw').value = el.dataset.pw; $('#loginPw').type = 'text'; const tg = $('[data-act=toggle-pw]'); if (tg) tg.textContent = 'Hide'; }
};
function expModal(e) {
  e = e || {};
  openModal({ title: e.id ? 'Edit expense' : 'Record an expense', sub: 'Your name and the time are saved with this entry.',
    body: `<div class="form-row"><div class="field"><label for="exD">Date</label><input id="exD" name="date" class="input" type="date" max="${today()}" value="${esc(e.date || today())}" required></div><div class="field"><label for="exC">Category</label><select id="exC" name="category" class="select">${EXP_CATS.map(c => opt(c, c, e.category)).join('')}</select></div></div><div class="field"><label for="exDs">What was it for?</label><input id="exDs" name="description" class="input" maxlength="120" value="${esc(e.description || '')}" required></div><div class="field"><label for="exA">Amount (naira)</label><input id="exA" name="amount" class="input" type="number" min="1" value="${e.amount || ''}" required></div>`,
    submit: e.id ? 'Save changes' : 'Save expense',
    onSubmit: fd => { const d = { date: fd.get('date'), category: fd.get('category'), description: (fd.get('description') || '').trim(), amount: Number(fd.get('amount')) }; if (!d.date) throw new Error('Choose the date.'); if (d.description.length < 3) throw new Error('Describe what the money was spent on.'); if (!(d.amount > 0)) throw new Error('Enter an amount greater than zero.'); API.saveExpense(e.id || null, d); done(e.id ? 'Expense updated.' : 'Expense recorded.'); } });
}

/* ---------- Inline forms ---------- */
const FORMS = {
  levies(form) {
    const fd = new FormData(form), vals = {}, err = m => formError(m, 'formErr'); err('');
    for (const l of levies().filter(x => x.fixed)) { const n = Number(fd.get(l.id)); if (!(n >= 0) || fd.get(l.id) === '') return err(`Enter an amount for ${l.name}.`); vals[l.id] = n; }
    try { API.saveLevies(vals); toast('Levy amounts saved.', 'ok'); renderView(); } catch (e) { err(e.message); }
  }
};

/* ---------- Modals for member and shared actions ---------- */
function reportModal(scope) {
  const now = new Date(), village = scope === 'village';
  openModal({ title: village ? 'Download village report' : 'Download my statement', sub: village ? 'Collections and spending for the whole village.' : 'Your own verified payments for the period.', submit: 'Download PDF',
    body: `<div class="form-row"><div class="field"><label for="sKind">Period</label><select id="sKind" name="kind" class="select">${opt('month', 'Monthly', 'month')}${opt('year', 'Yearly', 'month')}</select></div>
    <div class="field"><label for="sYear">Year</label><select id="sYear" name="year" class="select">${yearOpts(String(now.getFullYear()))}</select></div></div>
    <div class="field"><label for="sMonth">Month</label><select id="sMonth" name="month" class="select">${MONTHS.map((m, i) => opt(i, m, now.getMonth())).join('')}</select></div>`,
    onSubmit: fd => { const kind = fd.get('kind'); downloadReport(kind, fd.get('year'), kind === 'year' ? 0 : (fd.get('month') || 0), village ? '' : S.u.id); closeModal(); } });
}
const pwField = (id, name, label, auto, hint) => `<div class="field"><label for="${id}">${label}</label><div class="pw"><input id="${id}" name="${name}" class="input" type="password" autocomplete="${auto}" required><button class="pw-toggle" type="button" data-act="toggle-pw" aria-label="Show password">Show</button></div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
function changePwModal(force) {
  openModal({ title: force === true ? 'Choose your own password' : 'Change password', sub: force === true ? 'You signed in with login details from your admin. Set a password only you know.' : '', body: pwField('pCur', 'cur', force === true ? 'Password you were sent' : 'Current password', 'current-password') + pwField('pNew', 'nw', 'New password', 'new-password', 'At least 6 characters.') + pwField('pNew2', 'nw2', 'Repeat new password', 'new-password'), submit: 'Save password',
    onSubmit: async fd => {
      const cur = fd.get('cur') || '', nw = fd.get('nw') || '';
      if (nw.length < 6) throw new Error('The new password needs at least 6 characters.');
      if (nw !== fd.get('nw2')) throw new Error('The two new passwords do not match.');
      if (S.owner) await OWNER_API.changePassword(cur, nw); else await API.changePassword(cur, nw);
      done('Password changed.');
    } });
}

/* ---------- Village access (landing page) ---------- */
let attempts = 0, lockUntil = 0;
function villageSelectHTML(sel) { return `<option value="" disabled${sel ? '' : ' selected'}>Select your village or association</option>` + liveVillages().map(v => opt(v.id, `${v.name} (${v.code})`, sel)).join(''); }
function fillVillageSelects() {
  $$('[data-village-select]').forEach(s => { s.innerHTML = villageSelectHTML(''); });
  const nav = $('#navVillage'); if (nav) nav.options[0].textContent = 'Village or association'; const g = $('#villageGrid'); if (g) g.innerHTML = liveVillages().map(v => `<button type="button" class="vcard" style="--vc:${v.color}" data-act="pick-village" data-village="${v.id}"><b>${esc(v.name)}</b><span>${esc(v.code)}, ${esc(v.tag)}</span><em>Open this village</em></button>`).join('');
}
function pickVillage(id) {
  const v = VILLAGES.find(x => x.id === id); if (!v) return;
  $$('[data-village-select]').forEach(s => { s.value = id; });
  $('#accessForm').hidden = false; formError('', 'loginError'); updateDemo();
  const box = $('#access'); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
  setTimeout(() => { const i = $('#loginId'); if (i) i.focus({ preventScroll: true }); }, 350);
  $('#nav').classList.remove('open');
  if (rememberedFor(id)) tryRemembered(id);
}
function focusAccess() { const sel = $('#heroVillage'); $('#access').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => sel.focus({ preventScroll: true }), 350); }
function updateDemo() {
  const box = $('#demoBox'), id = $('#heroVillage').value, v = VILLAGES.find(x => x.id === id);
  if (!CONFIG.DEMO_MODE || !v) { box.hidden = true; return; }
  const c = v.code.toLowerCase(); box.hidden = false;
  box.innerHTML = `<b>Demo access for ${esc(v.name)}</b><br>Admin: <code>${v.code}-A02</code> password <code>${c}-admin</code><br>Member: <code>${v.code}-M001</code> password <code>${c}-member</code><div class="demo-btns"><button type="button" class="btn btn-ghost btn-sm" data-act="demo-fill" data-id="${v.code}-A02" data-pw="${c}-admin">Fill admin</button><button type="button" class="btn btn-ghost btn-sm" data-act="demo-fill" data-id="${v.code}-M001" data-pw="${c}-member">Fill member</button></div>`;
}
const CONTACT_MSG = 'Enter correct details or contact admin.';
const failKey = (vid, uid) => `vv_fail_${vid}_${uid}`;
function failState(vid, uid) { try { return JSON.parse(ssGet(failKey(vid, uid)) || 'null') || { n: 0, until: 0 }; } catch (_) { return { n: 0, until: 0 }; } }

/* Remember me: a random token is saved on this device and on the member's record (never the password).
   Choosing the village again signs that member straight in. */
const remKey = vid => 'vv_rem_' + vid;
function rememberedFor(vid) { try { const r = JSON.parse(lsGet(remKey(vid)) || 'null'); return r && r.u && r.t ? r : null; } catch (_) { return null; } }
function newToken() { try { return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join(''); } catch (_) { return String(Math.random()).slice(2) + String(Date.now()); } }
function makeRemember(v, u) { const t = newToken(); u.rememberTokens = (u.rememberTokens || []).slice(-4).concat(t); DB.save(v); lsSet(remKey(v.id), JSON.stringify({ u: u.id, t })); }
function forgetRemember(vid, v) {
  const r = rememberedFor(vid); try { localStorage.removeItem(remKey(vid)); } catch (_) {} delete mem[remKey(vid)];
  if (r && v) { const u = v.users.find(x => x.id === r.u); if (u) { u.rememberTokens = (u.rememberTokens || []).filter(x => x !== r.t); DB.save(v); } }
}
async function tryRemembered(vid) {
  const r = rememberedFor(vid), vil = VILLAGES.find(x => x.id === vid); if (!r || !vil || vil.removed) return false;
  try {
    const v = await DB.load(vid), u = v.users.find(x => x.id === r.u);
    if (!u || !u.active || v.status === 'suspended' || !(u.rememberTokens || []).includes(r.t)) { forgetRemember(vid, v); return false; }
    ssSet('vv_sess', JSON.stringify({ v: vid, u: u.id })); enterApp(v, u, true); return true;
  } catch (_) { return false; }
}

async function doLogin(e) {
  e.preventDefault(); const fd = new FormData(e.target), err = m => formError(m, 'loginError'); err('');
  const vid = $('#heroVillage').value, uid = (fd.get('id') || '').trim().toUpperCase(), pw = fd.get('pw') || '', remember = !!fd.get('remember');
  if (!vid) return err('Choose your village or association first.'); if (!uid) return err('Enter your member or admin ID.'); if (!pw) return err('Enter your password.');
  const fs = failState(vid, uid);
  if (Date.now() < fs.until) return err(CONTACT_MSG);
  const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Opening...';
  try {
    const vil = VILLAGES.find(x => x.id === vid); if (!vil || vil.removed) throw new Error('This village or association is no longer on VillageVault. Contact your admin.');
    const v = await DB.load(vid), u = v.users.find(x => x.id === uid), h = u ? await hashPw(vid, u.id, pw) : null;
    if (!u || u.hash !== h) {
      fs.n = (fs.n || 0) + 1;
      if (fs.n >= CONFIG.MAX_ATTEMPTS) { fs.n = 0; fs.until = Date.now() + CONFIG.LOCK_SECONDS * 1000; ssSet(failKey(vid, uid), JSON.stringify(fs)); throw new Error(CONTACT_MSG); }
      ssSet(failKey(vid, uid), JSON.stringify(fs)); const left = CONFIG.MAX_ATTEMPTS - fs.n;
      throw new Error(`That ID and password do not match this village. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
    }
    if (v.status === 'suspended') throw new Error('Access is paused for this village or association. Contact VillageVault support.');
    if (!u.active) throw new Error('This account is deactivated. Contact your admin.');
    ssDel(failKey(vid, uid));
    if (remember) makeRemember(v, u); else forgetRemember(vid, v);
    ssSet('vv_sess', JSON.stringify({ v: vid, u: u.id })); e.target.reset(); enterApp(v, u);
  } catch (ex) { err(ex.message || 'Could not open the dashboard.'); } finally { btn.disabled = false; btn.textContent = 'Open my dashboard'; }
}
function enterApp(v, u, auto) {
  S.v = v; S.u = u; S.owner = false; S.page = 'overview'; S.f = {}; S.tab = 'collections';
  $('#site').hidden = true; $('#app').hidden = false; renderApp(); window.scrollTo(0, 0); toast(auto ? `Welcome back, ${u.name}.` : `Welcome, ${u.name}.`, 'ok');
  if (u.mustChange) setTimeout(() => changePwModal(true), 300);
}
function logout() {
  ssDel('vv_sess'); S.v = null; S.u = null; S.owner = false; closeModal(); document.body.classList.remove('side-open');
  $('#app').hidden = true; $('#app').innerHTML = ''; $('#site').hidden = false; window.scrollTo(0, 0);
  if (location.hash === '#owner') history.replaceState(null, '', location.pathname + location.search);
  $$('[data-village-select]').forEach(s => { s.value = ''; }); $('#accessForm').hidden = true; $('#demoBox').hidden = true;
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (el) {
    const fn = ACTIONS[el.dataset.act]; if (fn) { try { fn(el, e); } catch (ex) { toast(ex.message || 'Something went wrong.', 'err'); } }
    return;
  }
  if (e.target.id === 'modalRoot') closeModal();
  if (e.target.id === 'ownerModal') closeOwnerLogin();
});
let renderQueued = false;
function renderSoon() { if (renderQueued) return; renderQueued = true; setTimeout(() => { renderQueued = false; if (S.v || S.owner) renderView(); }, 0); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches && t.matches('[data-village-select]')) { if (t.value) pickVillage(t.value); return; }
  if (t.matches && t.matches('[data-filter]')) { if (t.type === 'search') return; S.f[t.dataset.filter] = t.value; S.f.page = 1; renderSoon(); return; }
  if (t.matches && t.matches('[data-amount-source]')) { const L = levyOf(t.value), a = $('#uAmt'); if (a && S.v) a.value = L.fixed ? S.v.settings.levies[L.id] : ''; return; }
  if (t.id === 'sKind') { const m = $('#sMonth'); if (m) m.disabled = t.value === 'year'; return; }
  if (t.id === 'spScope' || t.id === 'spWeeks') updateSponsorForm();
});
document.addEventListener('input', e => { const t = e.target; if (t.matches && t.matches('[data-filter][type=search]')) { S.f[t.dataset.filter] = t.value; S.f.page = 1; renderSoon(); } });
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.matches('#accessForm')) return doLogin(e);
  if (f.matches('#ownerForm')) return doOwnerLogin(e);
  if (f.matches('#mForm')) {
    e.preventDefault(); if (!MODAL.onSubmit) return closeModal();
    const btn = $('#mSubmit'); if (btn) btn.disabled = true; formError('');
    try { await MODAL.onSubmit(new FormData(f), f); } catch (ex) { formError(ex.message || 'Something went wrong.'); if (btn) btn.disabled = false; }
    return;
  }
  if (f.dataset && f.dataset.form) { e.preventDefault(); try { await FORMS[f.dataset.form](f); } catch (ex) { toast(ex.message, 'err'); } }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#modalRoot').hidden) closeModal(); else if (!$('#ownerModal').hidden) closeOwnerLogin(); else document.body.classList.remove('side-open');
});
window.addEventListener('scroll', () => { const n = $('#nav'); if (n) n.classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });
/* Routes: #owner opens the hidden owner sign-in. #/super-admin/sponsors opens the owner's sponsor page.
   Anyone who is not the platform owner is sent back to the start page. */
function handleRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'super-admin/sponsors') {
    if (platformOwnerCheck()) { S.v = null; S.u = null; if ($('#app').hidden) { $('#site').hidden = true; $('#app').hidden = false; } S.page = 'o-sponsors'; S.f = {}; renderApp(); }
    else history.replaceState(null, '', location.pathname + location.search);
  } else if (h === 'owner' && !S.v && !S.owner) openOwnerLogin();
}
window.addEventListener('hashchange', handleRoute);

/* ---------- Start ---------- */
async function init() {
  $('#year').textContent = `\u00A9 ${new Date().getFullYear()} VillageVault. Each village's records stay private to that village.`;
  fillVillageSelects();
  try {
    const raw = ssGet('vv_sess');
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess.owner) { await OWN.load(); await enterOwner(true); }
      else { const v = await DB.load(sess.v), u = v.users.find(x => x.id === sess.u); if (u && u.active && v.status !== 'suspended') { S.v = v; S.u = u; S.page = 'overview'; $('#site').hidden = true; $('#app').hidden = false; renderApp(); } else ssDel('vv_sess'); }
    }
  } catch (_) { ssDel('vv_sess'); }
  handleRoute();
}
/* ---------------------------------------------------------
   Going live: the DB and OWN objects are the only places data is
   read or written. Replace DB.load / DB.save, OWN.load / OWN.save and
   the password checks in doLogin / doOwnerLogin with calls to your
   server (for example Supabase or Firebase). Enforce "one village per
   user" and "owner only" with row-level security so isolation is
   guaranteed on the server, not just in the browser.
   --------------------------------------------------------- */

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
async function doOwnerLogin(e) {
  e.preventDefault(); const fd = new FormData(e.target), err = m => formError(m, 'ownerError'); err('');
  const id = (fd.get('id') || '').trim().toUpperCase(), pw = fd.get('pw') || '';
  if (!id || !pw) return err('Enter the owner ID or email and the password.');
  if (Date.now() < lockUntil) return err(`Too many tries. Wait ${Math.ceil((lockUntil - Date.now()) / 1000)} seconds and try again.`);
  const btn = $('#ownerBtn'); btn.disabled = true;
  try {
    const o = await OWN.load();
    if ((id !== o.id.toUpperCase() && id !== o.email.toUpperCase()) || await hashPw('owner', o.id, pw) !== o.hash) { attempts++; if (attempts >= 5) { lockUntil = Date.now() + 30000; attempts = 0; } return err('The owner ID or password is not correct.'); }
    attempts = 0; closeOwnerLogin(); ssSet('vv_sess', JSON.stringify({ owner: true })); await enterOwner();
  } catch (ex) { err(ex.message || 'Could not sign in.'); } finally { btn.disabled = false; }
}
async function enterOwner(silent) {
  await OWN.load(); await Promise.all(VILLAGES.map(v => DB.load(v.id)));
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
    const rows = VILLAGES.map(vil => ({ vil, v: DB.cache[vil.id] })).filter(r => r.v).map(r => Object.assign(r, { st: vStats(r.v) })), yr = new Date().getFullYear();
    const tot = k => rows.reduce((a, r) => a + r.st[k], 0), live = rows.filter(r => r.v.status !== 'suspended' && !r.vil.removed).length;
    return `${OWN.data.defaultPw ? `<div class="owner-banner"><div><b>Change the default owner password.</b> Anyone who knows it can open every village.</div><button class="btn btn-saffron btn-sm" type="button" data-act="change-pw">Change password</button></div>` : ''}
    <div class="kpis">${kpi('Collected in ' + yr, money(tot('collected')), 'All villages together', 'hot')}${kpi('Waiting for verification', String(tot('pending')), money(tot('pendingAmt')))}${kpi('Active members', String(tot('members')), `${tot('admins')} active admins`)}${kpi('Villages open', `${live} of ${rows.length}`, live < rows.length ? 'Some villages are paused' : 'All villages running')}</div>
    <section class="panel"><div class="panel-h"><div><h2>Collections by village in ${yr}</h2><p>Verified payments only</p></div></div>${barChart(rows.map(r => ({ label: r.vil.code, title: r.v.name, value: r.st.collected })))}</section>
    ${plansPanel(rows)}
    <section class="panel"><div class="panel-h"><div><h2>Every village at a glance</h2><p>Open any village to work in it with full admin control.</p></div></div>
    ${table(['Village', { t: 'Members', num: true }, { t: 'Collected ' + yr, num: true }, { t: 'Spent ' + yr, num: true }, { t: 'Balance', num: true }, { t: 'Waiting', num: true }, 'Plan', 'Status', ''], rows.map(r => [`${vDot(r.vil)}${esc(r.v.name)}<small>${esc(r.vil.code)}</small>`, String(r.st.members), money(r.st.collected), money(r.st.spent), money(r.st.balance), String(r.st.pending), planBadge(r.v), statusBadge(r.v), `<div class="actions"><button class="btn btn-primary btn-sm" type="button" data-act="owner-open" data-id="${r.vil.id}">Open dashboard</button><button class="btn btn-ghost btn-sm" type="button" data-act="owner-manage" data-id="${r.vil.id}">Manage</button></div>`]), ['No villages loaded', ''])}</section>`;
  },
  'o-villages'() {
    const rows = VILLAGES.map(vil => ({ vil, v: DB.cache[vil.id] })).filter(r => r.v);
    return `<section class="panel"><div class="panel-h"><div><h2>Villages and associations</h2><p>Edit the name or plan, restrict access, or remove one from the platform. Nothing is erased: a removed village can be restored.</p></div></div>
    ${table(['Village or association', 'Code', 'Plan', { t: 'Admins', num: true }, { t: 'Members', num: true }, 'Access', ''], rows.map(r => { const st = vStats(r.v); return [`${vDot(r.vil)}${esc(r.v.name)}`, esc(r.vil.code), planBadge(r.v), String(st.admins), String(st.members), statusBadge(r.v), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="owner-manage" data-id="${r.vil.id}">Edit or restrict</button>${r.vil.removed ? `<button class="btn btn-leaf btn-sm" type="button" data-act="owner-restore" data-id="${r.vil.id}">Restore</button>` : `<button class="btn btn-danger btn-sm" type="button" data-act="owner-remove" data-id="${r.vil.id}">Remove</button>`}<button class="btn btn-ghost btn-sm" type="button" data-act="owner-admins" data-id="${r.vil.id}">Admins</button><button class="btn btn-primary btn-sm" type="button" data-act="owner-open" data-id="${r.vil.id}">Open</button></div>`]; }), ['No villages', ''])}</section>`;
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


/* =========================================================
   SPONSORS (platform-owner only)
   - Three "Community Sponsors" slots are shown to members.
   - GLOBAL sponsors show in every village. VILLAGE sponsors show in
     one village only. Only the platform owner can create, edit,
     renew, pause or delete them. Village admins see them read-only.
   - Money is stored in kobo (whole numbers), never decimals.
   - Sponsor revenue belongs to the platform owner's Paystack
     account and is kept apart from every village's dues records.
   This mirrors the Supabase tables and RLS in backend/sponsors.sql.
   ========================================================= */
const SPN = {
  data: null,
  load() {
    if (this.data) return this.data;
    const raw = lsGet('vv_sponsors_v1'); if (raw) { try { this.data = JSON.parse(raw); } catch (_) { this.data = null; } }
    if (!this.data) { this.data = seedSponsors(); this.save(); }
    this.data.items = this.data.items || []; this.data.payments = this.data.payments || [];
    return this.data;
  },
  save() { if (!lsSet('vv_sponsors_v1', JSON.stringify(this.data))) warnStorage(); }
};
function logoFor(name, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="26" fill="${color}"/><text x="60" y="77" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="700" fill="#fff">${esc(initials(name))}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function seedSponsors() {
  const now = Date.now(), day = 864e5, rate = CONFIG.SPONSOR_RATE_NAIRA_PER_WEEK, items = [], payments = []; let n = 0, pn = 0;
  const add = o => {
    const s = { id: 'SP' + String(++n).padStart(3, '0'), slot: o.slot, scope: o.scope, association_id: o.scope === 'village' ? o.village : null, shop_name: o.shop, logo: logoFor(o.shop, o.color), whatsapp: o.wa, started_at: new Date(now - o.startAgo * day).toISOString(), expires_at: new Date(now + o.endIn * day).toISOString(), is_active: true, created_by_owner_only: true, revenue_kobo: 0 };
    const amt = rate[o.scope] * o.weeks * 100; s.revenue_kobo = amt; items.push(s);
    payments.push({ id: 'PY' + String(++pn).padStart(3, '0'), sponsor_id: s.id, shop_name: s.shop_name, scope: s.scope, amount_kobo: amt, weeks: o.weeks, ref: 'PSK_DEMO_' + (1000 + pn), paid_at: s.started_at, kind: 'new' });
  };
  add({ slot: 1, scope: 'global', shop: 'Adaora Fabrics', color: '#D2395B', wa: '2348012345601', weeks: 4, startAgo: 10, endIn: 18 });
  add({ slot: 2, scope: 'global', shop: 'Lagos Fresh Market', color: '#12806A', wa: '2348012345602', weeks: 2, startAgo: 3, endIn: 11 });
  add({ slot: 3, scope: 'village', village: 'umuokpu', shop: 'Okoro Pharmacy', color: '#6C5CE7', wa: '2348012345603', weeks: 1, startAgo: 2, endIn: 5 });
  add({ slot: 3, scope: 'global', shop: 'Sunrise Auto Care', color: '#D99A18', wa: '2348012345604', weeks: 4, startAgo: 32, endIn: -4 });
  return { items, payments };
}

/* Same rule as the database policy: only active, unexpired sponsors are readable */
const spStatus = s => !s.is_active ? 'paused' : (new Date(s.expires_at) <= new Date() ? 'expired' : 'active');
function sponsorsFor(villageId) {
  const live = SPN.load().items.filter(s => spStatus(s) === 'active');
  return [1, 2, 3].map(slot => live.find(s => s.slot === slot && s.scope === 'global') || live.find(s => s.slot === slot && s.scope === 'village' && s.association_id === villageId) || null);
}
const platformOwnerCheck = () => !!S.owner && !!OWN.data && OWN.data.email === CONFIG.PLATFORM_OWNER_EMAIL;
function requirePlatformOwner() { if (!platformOwnerCheck()) throw new Error('Only the platform owner can manage sponsors.'); }
const koboMoney = k => money((Number(k) || 0) / 100);
function normalizeWhatsapp(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^0\d{10}$/.test(d)) d = '234' + d.slice(1);
  else if (/^[789]\d{9}$/.test(d)) d = '234' + d;
  return /^\d{10,14}$/.test(d) && d.startsWith('234') ? d : null;
}
const waLink = s => `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${s.shop_name}, I saw your ad on my community dashboard.`)}`;

/* Read-only cards for members and village admins */
function sponsorsPanel(readOnlyNote) {
  const slots = sponsorsFor(S.v.id);
  return `<section class="panel"><div class="panel-h"><div><h2>Community Sponsors</h2><p>${readOnlyNote ? 'Managed by VillageVault. This view is read-only.' : 'Businesses that support our community. Tap one to chat on WhatsApp.'}</p></div></div>
  <div class="sponsor-grid">${slots.map((s, i) => s
    ? `<a class="sponsor" href="${esc(waLink(s))}" target="_blank" rel="noopener noreferrer"><img class="sp-logo" src="${esc(s.logo)}" alt="${esc(s.shop_name)} logo"><div class="sp-info"><b>${esc(s.shop_name)}</b><small>${s.scope === 'global' ? 'Lagos-wide sponsor' : 'Village sponsor'}</small></div><span class="sp-cta">Chat on WhatsApp</span></a>`
    : `<div class="sponsor sponsor-empty"><div class="sp-logo sp-empty" aria-hidden="true">+</div><div class="sp-info"><b>Sponsor slot ${i + 1}</b><small>Available</small></div></div>`).join('')}</div></section>`;
}

/* ---------- Owner-only sponsor operations ---------- */
function readLogo(file) {
  return new Promise(async (res, rej) => {
    try {
      if (!file || !file.size) return res(null);
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Upload the logo as a PNG, JPG or WEBP image.');
      const img = await loadImg(await fileToDataURL(file)), S2 = 200, c = document.createElement('canvas'); c.width = c.height = S2;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S2, S2);
      const k = Math.max(S2 / img.width, S2 / img.height), w = img.width * k, h = img.height * k; g.drawImage(img, (S2 - w) / 2, (S2 - h) / 2, w, h);
      res(c.toDataURL('image/jpeg', .85));
    } catch (e) { rej(e); }
  });
}
const SPN_API = {
  price: (scope, weeks) => CONFIG.SPONSOR_RATE_NAIRA_PER_WEEK[scope] * weeks,
  slotProblem(d, ignoreId) {
    const live = SPN.load().items.filter(s => s.id !== ignoreId && spStatus(s) === 'active');
    if (d.scope === 'global') {
      const c = live.find(s => s.scope === 'global' && s.slot === d.slot);
      return c ? `Slot ${d.slot} already has a Lagos-wide sponsor (${c.shop_name}) until ${fmtDate(c.expires_at.slice(0, 10))}.` : '';
    }
    const g = live.find(s => s.scope === 'global' && s.slot === d.slot);
    if (g) return `Slot ${d.slot} is held by a Lagos-wide sponsor (${g.shop_name}), so a village sponsor there would not be shown. Choose another slot.`;
    const c = live.find(s => s.scope === 'village' && s.slot === d.slot && s.association_id === d.village);
    return c ? `Slot ${d.slot} in that village already has ${c.shop_name}.` : '';
  },
  pay(s, weeks, ref, kind) {
    const d = SPN.load(), amt = this.price(s.scope, weeks) * 100;
    s.revenue_kobo = (Number(s.revenue_kobo) || 0) + amt;
    d.payments.push({ id: 'PY' + String(d.payments.length + 1).padStart(3, '0'), sponsor_id: s.id, shop_name: s.shop_name, scope: s.scope, amount_kobo: amt, weeks, ref, paid_at: stamp(), kind });
  },
  add(d) {
    requirePlatformOwner();
    if (!['global', 'village'].includes(d.scope)) throw new Error('Choose Lagos-wide or village-specific.');
    if (d.scope === 'village' && !VILLAGES.some(v => v.id === d.village)) throw new Error('Choose the village for this sponsor.');
    if (![1, 2, 3].includes(d.slot)) throw new Error('Choose slot 1, 2 or 3.');
    if (d.shop.length < 2) throw new Error('Enter the shop name.');
    const wa = normalizeWhatsapp(d.whatsapp); if (!wa) throw new Error('Enter a valid Nigerian WhatsApp number, for example 0803 123 4567.');
    if (!(d.weeks > 0)) throw new Error('Choose how many weeks.');
    if (d.ref.length < 4) throw new Error('Enter the Paystack payment reference.');
    const problem = this.slotProblem(d); if (problem) throw new Error(problem);
    const store = SPN.load(), now = Date.now();
    const s = { id: 'SP' + String(store.items.length + 1 + Math.floor(Math.random() * 900)).padStart(3, '0'), slot: d.slot, scope: d.scope, association_id: d.scope === 'village' ? d.village : null, shop_name: d.shop, logo: d.logo || logoFor(d.shop, '#1A1A4E'), whatsapp: wa, started_at: new Date(now).toISOString(), expires_at: new Date(now + d.weeks * 7 * 864e5).toISOString(), is_active: true, created_by_owner_only: true, revenue_kobo: 0 };
    store.items.push(s); this.pay(s, d.weeks, d.ref, 'new');
    olog('Added sponsor', d.scope === 'village' ? VILLAGES.find(v => v.id === d.village).name : 'All villages', `${s.shop_name}, slot ${s.slot}, ${d.scope === 'global' ? 'Lagos-wide' : 'village'}, ${d.weeks} week(s), ${money(this.price(d.scope, d.weeks))}`);
    SPN.save(); OWN.save(); return s;
  },
  find(id) { const s = SPN.load().items.find(x => x.id === id); if (!s) throw new Error('Sponsor not found.'); return s; },
  update(id, d) {
    requirePlatformOwner(); const s = this.find(id), ch = [];
    if (d.shop.length < 2) throw new Error('Enter the shop name.');
    const wa = normalizeWhatsapp(d.whatsapp); if (!wa) throw new Error('Enter a valid Nigerian WhatsApp number, for example 0803 123 4567.');
    if (s.shop_name !== d.shop) { ch.push(`Name: ${s.shop_name} to ${d.shop}`); s.shop_name = d.shop; }
    if (s.whatsapp !== wa) { ch.push('WhatsApp number changed'); s.whatsapp = wa; }
    if (d.logo) { ch.push('Logo replaced'); s.logo = d.logo; }
    if (!ch.length) throw new Error('Nothing was changed.');
    olog('Edited sponsor', s.association_id ? VILLAGES.find(v => v.id === s.association_id).name : 'All villages', `${s.shop_name}: ${ch.join('; ')}`); SPN.save(); OWN.save();
  },
  renew(id, weeks, ref) {
    requirePlatformOwner(); const s = this.find(id);
    if (!(weeks > 0)) throw new Error('Choose how many weeks.'); if (ref.length < 4) throw new Error('Enter the Paystack payment reference.');
    if (spStatus(s) !== 'active') { const problem = this.slotProblem({ scope: s.scope, slot: s.slot, village: s.association_id }, s.id); if (problem) throw new Error(problem); }
    const base = Math.max(Date.now(), new Date(s.expires_at).getTime()); s.expires_at = new Date(base + weeks * 7 * 864e5).toISOString(); s.is_active = true;
    this.pay(s, weeks, ref, 'renewal');
    olog('Renewed sponsor', s.association_id ? VILLAGES.find(v => v.id === s.association_id).name : 'All villages', `${s.shop_name}, ${weeks} week(s), ${money(this.price(s.scope, weeks))}`); SPN.save(); OWN.save();
  },
  setActive(id, on) {
    requirePlatformOwner(); const s = this.find(id);
    if (on) { const problem = this.slotProblem({ scope: s.scope, slot: s.slot, village: s.association_id }, s.id); if (problem && new Date(s.expires_at) > new Date()) throw new Error(problem); }
    s.is_active = on; olog(on ? 'Resumed sponsor' : 'Paused sponsor', s.association_id ? VILLAGES.find(v => v.id === s.association_id).name : 'All villages', s.shop_name); SPN.save(); OWN.save();
  },
  remove(id) {
    requirePlatformOwner(); const d = SPN.load(), s = this.find(id);
    d.items = d.items.filter(x => x.id !== id); olog('Deleted sponsor', s.association_id ? VILLAGES.find(v => v.id === s.association_id).name : 'All villages', `${s.shop_name} (revenue history is kept)`); SPN.save(); OWN.save();
  }
};
function sponsorStats() {
  const d = SPN.load(), now = new Date();
  const inMonth = p => { const t = new Date(p.paid_at); return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth(); };
  return {
    monthKobo: sum(d.payments.filter(inMonth), 'amount_kobo'), totalKobo: sum(d.payments, 'amount_kobo'),
    active: d.items.filter(s => spStatus(s) === 'active').length, expired: d.items.filter(s => spStatus(s) === 'expired').length, paused: d.items.filter(s => spStatus(s) === 'paused').length,
    series: Array.from({ length: 6 }, (_, i) => { const t = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1); return { label: MON[t.getMonth()], title: `${MONTHS[t.getMonth()]} ${t.getFullYear()}`, value: sum(d.payments.filter(p => { const x = new Date(p.paid_at); return x.getFullYear() === t.getFullYear() && x.getMonth() === t.getMonth(); }), 'amount_kobo') / 100 }; })
  };
}
const spStatusBadge = s => { const st = spStatus(s); return `<span class="badge ${st === 'active' ? 'b-active' : st === 'expired' ? 'b-rejected' : 'b-void'}">${cap(st)}</span>`; };
function daysLeftText(s) { const d = Math.ceil((new Date(s.expires_at) - Date.now()) / 864e5); return d > 0 ? `${d} day${d === 1 ? '' : 's'} left` : `Expired ${-d} day${d === -1 ? '' : 's'} ago`; }

OWNERV['o-sponsors'] = function () {
  if (!platformOwnerCheck()) return '<div class="panel"><div class="empty"><b>Owner only</b>Only the platform owner can manage sponsors.</div></div>';
  const d = SPN.load(), st = sponsorStats(), f = S.f, rate = CONFIG.SPONSOR_RATE_NAIRA_PER_WEEK;
  const list = d.items.filter(s => (!f.scope || s.scope === f.scope) && (!f.status || spStatus(s) === f.status)).sort((a, b) => a.slot - b.slot || a.scope.localeCompare(b.scope));
  return `<div class="kpis">${kpi('Earned this month', koboMoney(st.monthKobo), 'Sponsor payments to your Paystack', 'hot')}${kpi('Active slots', String(st.active), `${st.paused} paused`)}${kpi('Expired', String(st.expired), st.expired ? 'Renew or replace them' : 'Nothing expired')}${kpi('All-time revenue', koboMoney(st.totalKobo), 'Kept apart from village dues')}</div>
  <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Sponsor revenue, last 6 months</h2><p>Naira received on the platform Paystack account</p></div></div>${barChart(st.series)}</section>
  <section class="panel"><div class="panel-h"><h2>Rates</h2></div><div class="list"><div class="list-item"><div><b>Lagos-wide</b><small>Shows in every village</small></div><b>${money(rate.global)} per week</b></div><div class="list-item"><div><b>One village</b><small>Shows in a single village</small></div><b>${money(rate.village)} per week</b></div></div>
  <div style="margin-top:16px"><button class="btn btn-primary btn-block" type="button" data-act="sp-add">Add sponsor</button></div></section></div>
  <section class="panel"><div class="panel-h"><div><h2>Sponsor slots</h2><p>Village admins can see these cards but cannot change them.</p></div></div>
  <div class="toolbar"><div class="field"><label for="spfS">Scope</label><select id="spfS" class="select" data-filter="scope">${opt('', 'All scopes', f.scope)}${opt('global', 'Lagos-wide', f.scope)}${opt('village', 'One village', f.scope)}</select></div>
  <div class="field"><label for="spfT">Status</label><select id="spfT" class="select" data-filter="status">${opt('', 'All statuses', f.status)}${opt('active', 'Active', f.status)}${opt('expired', 'Expired', f.status)}${opt('paused', 'Paused', f.status)}</select></div></div>
  ${table([{ t: 'Slot', num: true }, 'Scope', 'Village', 'Shop', 'Logo', 'WhatsApp', 'Expiry', { t: 'Revenue', num: true }, 'Status', ''], list.map(s => {
    const vil = s.association_id ? VILLAGES.find(v => v.id === s.association_id) : null, st2 = spStatus(s);
    return [String(s.slot), s.scope === 'global' ? '<span class="badge b-admin">Global</span>' : '<span class="badge b-pending">Village</span>', vil ? `${esc(vil.name)}<small>${esc(vil.code)}</small>` : '<small>All villages</small>', `<b>${esc(s.shop_name)}</b>`, `<img class="sp-thumb" src="${esc(s.logo)}" alt="">`, `<a href="${esc(waLink(s))}" target="_blank" rel="noopener noreferrer">+${esc(s.whatsapp)}</a>`, `${esc(fmtDate(s.expires_at.slice(0, 10)))}<small>${esc(daysLeftText(s))}</small>`, koboMoney(s.revenue_kobo), spStatusBadge(s),
      `<div class="actions"><button class="btn btn-leaf btn-sm" type="button" data-act="sp-renew" data-id="${s.id}">Renew</button><button class="btn btn-ghost btn-sm" type="button" data-act="sp-edit" data-id="${s.id}">Edit</button>${st2 === 'expired' ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="sp-toggle" data-id="${s.id}">${s.is_active ? 'Pause' : 'Resume'}</button>`}<button class="btn btn-ghost btn-sm" type="button" data-act="sp-delete" data-id="${s.id}">Delete</button></div>`];
  }), ['No sponsors match', 'Add a sponsor to fill a slot.'])}</section>`;
};

function sponsorFormHTML(s) {
  const edit = !!s;
  return `${edit ? '' : `<div class="form-row"><div class="field"><label for="spScope">Where should it show?</label><select id="spScope" name="scope" class="select"><option value="global">Lagos-wide, all villages (${money(CONFIG.SPONSOR_RATE_NAIRA_PER_WEEK.global)} per week)</option><option value="village">One village only (${money(CONFIG.SPONSOR_RATE_NAIRA_PER_WEEK.village)} per week)</option></select></div>
  <div class="field"><label for="spVillage">Village</label><select id="spVillage" name="village" class="select" disabled>${opt('', 'Choose a village', '')}${VILLAGES.map(v => opt(v.id, `${v.name} (${v.code})`, '')).join('')}</select></div></div>
  <div class="form-row"><div class="field"><label for="spSlot">Slot</label><select id="spSlot" name="slot" class="select">${[1, 2, 3].map(n => opt(n, 'Slot ' + n, 1)).join('')}</select></div>
  <div class="field"><label for="spWeeks">Weeks</label><select id="spWeeks" name="weeks" class="select">${[1, 2, 4, 8, 12].map(w => opt(w, w + (w === 1 ? ' week' : ' weeks'), 4)).join('')}</select></div></div>`}
  <div class="field"><label for="spShop">Shop name</label><input id="spShop" name="shop" class="input" maxlength="40" value="${esc(s ? s.shop_name : '')}" required></div>
  <div class="field"><label for="spWa">WhatsApp number</label><input id="spWa" name="whatsapp" class="input" type="tel" placeholder="0803 123 4567" value="${esc(s ? '0' + s.whatsapp.slice(3) : '')}" required><span class="hint">Members tap this to chat on WhatsApp.</span></div>
  ${fileField(edit ? 'Replace logo (optional)' : 'Shop logo (optional)', 'logo')}
  ${edit ? '' : `<div class="field"><label for="spRef">Paystack payment reference</label><input id="spRef" name="ref" class="input" maxlength="60" placeholder="From your platform Paystack account" required></div><div class="callout" id="spPrice" style="margin-top:16px"></div>`}`;
}
function updateSponsorForm() {
  const sc = $('#spScope'); if (!sc) return;
  const vs = $('#spVillage'); vs.disabled = sc.value !== 'village'; if (vs.disabled) vs.value = '';
  const w = Number($('#spWeeks').value) || 1, rate = CONFIG.SPONSOR_RATE_NAIRA_PER_WEEK[sc.value];
  $('#spPrice').innerHTML = `<div><b>Amount: ${money(rate * w)}</b><p>${w} week${w === 1 ? '' : 's'} at ${money(rate)} per week. Paid to your platform Paystack account, not a village account.</p></div>`;
}
function readSponsorForm(fd) { return { scope: fd.get('scope'), village: fd.get('village') || '', slot: Number(fd.get('slot')), weeks: Number(fd.get('weeks')), shop: (fd.get('shop') || '').trim(), whatsapp: fd.get('whatsapp') || '', ref: (fd.get('ref') || '').trim() }; }

Object.assign(ACTIONS, {
  'sp-add'() {
    requirePlatformOwner();
    openModal({ title: 'Add a sponsor', sub: 'Record a sponsor who has paid you. The slot goes live straight away.', body: sponsorFormHTML(null), submit: 'Add sponsor',
      onSubmit: async fd => { const d = readSponsorForm(fd); d.logo = await readLogo(fd.get('proof')); SPN_API.add(d); done('Sponsor added.'); } });
    updateSponsorForm();
  },
  'sp-edit'(el) {
    requirePlatformOwner(); const s = SPN_API.find(el.dataset.id);
    openModal({ title: 'Edit sponsor', sub: `Slot ${s.slot}, ${s.scope === 'global' ? 'Lagos-wide' : 'one village'}`, body: sponsorFormHTML(s), submit: 'Save changes',
      onSubmit: async fd => { SPN_API.update(s.id, { shop: (fd.get('shop') || '').trim(), whatsapp: fd.get('whatsapp') || '', logo: await readLogo(fd.get('proof')) }); done('Sponsor updated.'); } });
  },
  'sp-renew'(el) {
    requirePlatformOwner(); const s = SPN_API.find(el.dataset.id);
    openModal({ title: `Renew ${s.shop_name}`, sub: `Currently ${daysLeftText(s).toLowerCase()}.`, submit: 'Record payment and renew',
      body: `<div class="field"><label for="rnW">Weeks to add</label><select id="rnW" name="weeks" class="select">${[1, 2, 4, 8, 12].map(w => opt(w, w + (w === 1 ? ' week' : ' weeks'), 4)).join('')}</select></div><div class="field"><label for="rnRef">Paystack payment reference</label><input id="rnRef" name="ref" class="input" maxlength="60" required></div><div class="callout" id="rnPrice" style="margin-top:16px"></div>`,
      onSubmit: fd => { SPN_API.renew(s.id, Number(fd.get('weeks')), (fd.get('ref') || '').trim()); done('Sponsor renewed.'); } });
    const upd = () => { const w = Number($('#rnW').value) || 1, r = CONFIG.SPONSOR_RATE_NAIRA_PER_WEEK[s.scope]; $('#rnPrice').innerHTML = `<div><b>Amount: ${money(r * w)}</b><p>${w} week${w === 1 ? '' : 's'} at ${money(r)} per week.</p></div>`; };
    $('#rnW').addEventListener('change', upd); upd();
  },
  'sp-toggle'(el) { requirePlatformOwner(); const s = SPN_API.find(el.dataset.id); SPN_API.setActive(s.id, !s.is_active); toast(s.is_active ? 'Sponsor resumed.' : 'Sponsor paused.', 'ok'); renderView(); },
  'sp-delete'(el) {
    requirePlatformOwner(); const s = SPN_API.find(el.dataset.id);
    openModal({ title: 'Delete this sponsor?', danger: true, sub: `${esc(s.shop_name)} will disappear from every member dashboard. Revenue history is kept.`, body: '', submit: 'Delete sponsor', onSubmit: () => { SPN_API.remove(s.id); done('Sponsor deleted.'); } });
  }
});

/* =========================================================
   RECEIPTS (admin only, for verified payments)
   Each verified payment gets one permanent receipt number the first
   time an admin generates it. The admin's name and the time are
   saved and logged. Download as PNG or PDF.
   ========================================================= */
function nairaWords(n) {
  n = Math.round(Number(n) || 0); if (n === 0) return 'Zero naira only';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const chunk = x => {
    let s = '';
    if (x >= 100) { s += ones[Math.floor(x / 100)] + ' hundred'; x %= 100; if (x) s += ' and '; }
    if (x >= 20) { s += tens[Math.floor(x / 10)]; if (x % 10) s += '-' + ones[x % 10]; } else if (x > 0) s += ones[x];
    return s;
  };
  const parts = []; let rest = n;
  [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']].forEach(u => { if (rest >= u[0]) { parts.push(chunk(Math.floor(rest / u[0])) + ' ' + u[1]); rest %= u[0]; } });
  if (rest > 0) parts.push((parts.length && rest < 100 ? 'and ' : '') + chunk(rest));
  return cap(parts.join(' ').replace(/\s+/g, ' ').trim()) + ' naira only';
}
function receiptData(t) {
  const m = userById(t.memberId) || { name: 'Former member' };
  return { premium: S.v.plan === 'premium', logo: S.v.logo, no: t.receiptNo, village: S.v.name, member: m.name, memberId: t.memberId, levy: levyOf(t.levy).name, amount: t.amount, date: t.date, method: t.method, ref: t.ref || '-', verifiedBy: t.verifiedBy || '', verifiedAt: t.verifiedAt, issuedBy: t.receiptBy, issuedAt: t.receiptAt };
}
function receiptRows(r) {
  return [['Received from', `${r.member} (${r.memberId})`], ['Levy', r.levy], ['Payment date', fmtDate(r.date)], ['Payment method', r.method], ['Bank reference', r.ref], ['Verified by', `${r.verifiedBy}, ${fmtTS(r.verifiedAt)}`], ['Receipt issued by', `${r.issuedBy}, ${fmtTS(r.issuedAt)}`]];
}

/* ----- PNG (drawn on a canvas, no libraries) ----- */
async function receiptPngBasic(r) {
  let logoImg = null; if (r.premium && r.logo) { try { logoImg = await loadImg(r.logo); } catch (_) {} }
  return new Promise((res, rej) => {
    try {
      const W = 900, H = 1260, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const F = (w, s) => `${w} ${s}px Figtree, "Segoe UI", Arial, "DejaVu Sans", sans-serif`;
      const text = (s, x, y, o) => { o = o || {}; g.font = F(o.w || 500, o.s || 28); g.fillStyle = o.c || '#14142B'; g.textAlign = o.a || 'left'; g.textBaseline = 'alphabetic'; let t = String(s); const max = o.max || 0; if (max) { while (t.length > 2 && g.measureText(t).width > max) t = t.slice(0, -2); if (t !== String(s)) t += '...'; } g.fillText(t, x, y); };
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1A1A4E'; g.fillRect(0, 0, W, 250); g.fillStyle = '#F5B83D'; g.fillRect(0, 250, W, 12);
      // logo mark
      g.strokeStyle = '#F5B83D'; g.lineWidth = 6; g.beginPath(); [[0, -26], [24, -13], [24, 13], [0, 26], [-24, 13], [-24, -13]].forEach((p, i) => { i ? g.lineTo(96 + p[0], 82 + p[1]) : g.moveTo(96 + p[0], 82 + p[1]); }); g.closePath(); g.stroke(); g.fillStyle = '#F5B83D'; g.beginPath(); g.arc(96, 82, 8, 0, 6.2832); g.fill();
      text('VillageVault', 140, 92, { w: 800, s: 34, c: '#FFFFFF' });
      text('OFFICIAL RECEIPT', 70, 190, { w: 800, s: 58, c: '#FFFFFF' });
      text(r.no, W - 70, 92, { w: 700, s: 28, c: '#F5B83D', a: 'right' });
      text(r.premium ? r.village : 'Payment receipt', 70, 335, { w: 800, s: 38, c: '#1A1A4E', max: logoImg ? W - 290 : W - 140 });
      if (logoImg) { g.save(); g.beginPath(); g.roundRect ? g.roundRect(W - 170, 290, 100, 100, 18) : g.rect(W - 170, 290, 100, 100); g.clip(); g.drawImage(logoImg, W - 170, 290, 100, 100); g.restore(); g.strokeStyle = '#DCE3E0'; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(W - 170, 290, 100, 100, 18) : g.rect(W - 170, 290, 100, 100); g.stroke(); }
      text(`Issued ${fmtDate(r.issuedAt.slice(0, 10))}`, 70, 378, { w: 500, s: 24, c: '#5B5F7A' });
      // amount box
      g.fillStyle = '#EEF2F0'; g.beginPath(); g.roundRect ? g.roundRect(60, 410, W - 120, 190, 22) : g.rect(60, 410, W - 120, 190); g.fill();
      text('Amount received', 90, 456, { w: 600, s: 24, c: '#5B5F7A' });
      text(money(r.amount), 90, 540, { w: 800, s: 84, c: '#1A1A4E' });
      text(nairaWords(r.amount), 90, 582, { w: 500, s: 24, c: '#14142B', max: W - 180 });
      // details
      let y = 660; const rows = receiptRows(r);
      rows.forEach((row, i) => {
        text(row[0], 70, y, { w: 600, s: 22, c: '#5B5F7A' }); text(row[1], 70, y + 36, { w: 700, s: 30, c: '#14142B', max: W - 140 });
        g.strokeStyle = '#DCE3E0'; g.lineWidth = 2; g.beginPath(); g.moveTo(70, y + 58); g.lineTo(W - 70, y + 58); g.stroke(); y += 78;
      });
      // stamp
      g.save(); g.translate(W - 190, H - 150); g.rotate(-0.2); g.strokeStyle = '#12806A'; g.lineWidth = 7; g.strokeRect(-110, -38, 220, 76); g.fillStyle = '#12806A'; g.font = F(800, 44); g.textAlign = 'center'; g.fillText('VERIFIED', 0, 15); g.restore();
      text('This receipt confirms a payment that was checked', 70, H - 120, { w: 500, s: 22, c: '#5B5F7A' });
      text('against the village account. Keep it for your records.', 70, H - 90, { w: 500, s: 22, c: '#5B5F7A' });
      text('Generated by VillageVault', 70, H - 50, { w: 700, s: 22, c: '#1A1A4E' });
      g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 4); g.globalAlpha = .1; g.fillStyle = '#1A1A4E'; g.font = F(800, 170); g.textAlign = 'center'; g.fillText('VillageVault', 0, 56); g.restore();
      c.toBlob(b => b ? res(b) : rej(new Error('Could not create the image.')), 'image/png');
    } catch (e) { rej(e); }
  });
}

/* ----- PDF (A5, uses the same small PDF writer as the reports) ----- */
function receiptPdfBasic(r) {
  const pdf = new PDF(419.53, 595.28), M = 34, CW = pdf.W - 68, INK = '#14142B', MUT = '#5B5F7A'; pdf.wm = 'VillageVault';
  pdf.rect(0, 0, pdf.W, 92, '#1A1A4E'); pdf.rect(0, 92, pdf.W, 5, '#F5B83D');
  pdf.text('VillageVault', M, 32, { size: 10, bold: true, color: '#F5B83D' }); pdf.text(r.no, pdf.W - M, 32, { size: 9, bold: true, color: '#F5B83D', align: 'right' });
  pdf.text('OFFICIAL RECEIPT', M, 68, { size: 22, bold: true, color: '#FFFFFF' });
  pdf.text(pdf.fit(r.premium ? r.village : 'Payment receipt', CW - (r.premium && r.logo ? 60 : 0), 14, true), M, 126, { size: 14, bold: true, color: '#1A1A4E' });
  if (r.premium && r.logo) pdf.img(r.logo, pdf.W - M - 46, 108, 46, 46);
  pdf.text(`Issued ${fmtDate(r.issuedAt.slice(0, 10))}`, M, 142, { size: 9, color: MUT });
  pdf.rect(M, 158, CW, 76, '#EEF2F0');
  pdf.text('Amount received', M + 14, 178, { size: 9, color: MUT });
  pdf.text(pm(r.amount), M + 14, 208, { size: 26, bold: true, color: '#1A1A4E' });
  pdf.text(pdf.fit(nairaWords(r.amount), CW - 28, 8.5), M + 14, 224, { size: 8.5, color: INK });
  let y = 262;
  receiptRows(r).forEach(row => {
    pdf.text(row[0], M, y, { size: 8, color: MUT }); pdf.text(pdf.fit(row[1], CW, 11, true), M, y + 15, { size: 11, bold: true, color: INK });
    pdf.line(M, y + 24, M + CW, y + 24, '#DCE3E0'); y += 37;
  });
  const sx = pdf.W - M - 112, sy = pdf.H - 120;
  [[sx, sy, sx + 112, sy], [sx, sy + 34, sx + 112, sy + 34], [sx, sy, sx, sy + 34], [sx + 112, sy, sx + 112, sy + 34]].forEach(l => pdf.line(l[0], l[1], l[2], l[3], '#12806A', 2));
  pdf.text('VERIFIED', sx + 56, sy + 23, { size: 16, bold: true, color: '#12806A', align: 'center' });
  pdf.text('This receipt confirms a payment that was checked against the village account.', M, pdf.H - 62, { size: 7.5, color: MUT });
  pdf.text('Keep it for your records.', M, pdf.H - 51, { size: 7.5, color: MUT });
  pdf.line(M, pdf.H - 40, M + CW, pdf.H - 40, '#DCE3E0'); pdf.text('Generated by VillageVault', M, pdf.H - 26, { size: 7.5, bold: true, color: '#1A1A4E' });
  return pdf.build(`Receipt ${r.no}`);
}

/* ----- Modal and actions ----- */
async function receiptModal(id) {
  const t = receiptTx(id), r = receiptDataX(t), blob = await receiptPng(r), url = URL.createObjectURL(blob);
  openModal({ title: `Receipt ${r.no}`, size: 'modal-lg', submit: false, sub: `${esc(r.member)}, ${esc(r.levy)}, ${money(r.amount)}`,
    body: `<div class="receipt-prev"><img src="${url}" alt="Receipt ${esc(r.no)}"></div>
    <div class="receipt-actions"><button type="button" class="btn btn-primary" data-act="receipt-dl" data-fmt="png" data-id="${esc(t.id)}">Download PNG</button><button type="button" class="btn btn-saffron" data-act="receipt-dl" data-fmt="pdf" data-id="${esc(t.id)}">Download PDF</button></div>` });
  if (S.page === 'transactions' || S.page === 'verify') renderView();
}
Object.assign(ACTIONS, {
  'receipt'(el) { receiptModal(el.dataset.id).catch(ex => toast(ex.message || 'Could not create the receipt.', 'err')); },
  'receipt-dl'(el) {
    const t = API.issueReceipt(el.dataset.id), r = receiptData(t), name = `${r.no}.${el.dataset.fmt}`;
    if (el.dataset.fmt === 'pdf') { download(name, receiptPdf(r)); toast('Receipt PDF downloaded.', 'ok'); }
    else receiptPng(r).then(b => { download(name, b); toast('Receipt PNG downloaded.', 'ok'); }).catch(ex => toast(ex.message, 'err'));
  }
});

/* ---------- Start ---------- */


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
  const prem = S.v.plan === 'premium', vil = VILLAGES.find(x => x.id === S.v.id);
  return `<section class="panel"><div class="panel-h"><div><h2>Village profile</h2><p>Your name and logo show on the sidebar${prem ? ' and on every receipt, report, statement, notice and export you issue' : ''}.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="edit-profile">${prem ? 'Edit name, code and logo' : 'Edit name and logo'}</button></div>
    <div class="profile-row">${S.v.logo ? `<img class="plogo" src="${esc(S.v.logo)}" alt="Village logo">` : `<div class="plogo ph" style="background:${vil.color}">${esc(vil.code)}</div>`}
    <dl class="kv"><dt>Name</dt><dd>${esc(S.v.name)}</dd><dt>Code</dt><dd>${esc(S.v.code)}</dd><dt>Plan</dt><dd>${prem ? '<span class="badge b-admin">Premium</span>' : '<span class="badge b-off">Basic</span>'}</dd><dt>Documents</dt><dd>${prem ? 'Every receipt, report, statement, notice and export bears the village name, code and logo' : 'Carry the VillageVault name only'}</dd></dl></div>
    ${prem ? '' : '<div class="callout" style="margin-top:16px"><div><b>Want receipts with your village name and logo?</b><p>Ask VillageVault support to move your village to the Premium plan.</p></div></div>'}</section>
  ${paymentPanel()}`;
};
ACTIONS['edit-profile'] = function () {
  requireAdmin();
  openModal({ title: S.v.plan === 'premium' ? 'Edit name, code and logo' : 'Edit name and logo', sub: 'Changes show to every member straight away.',
    body: `<div class="field"><label for="vpN">Village or association name</label><input id="vpN" name="name" class="input" maxlength="40" value="${esc(S.v.name)}" required></div>${S.v.plan === 'premium' ? `<div class="field"><label for="vpC">Village code</label><input id="vpC" name="code" class="input mono" maxlength="5" value="${esc(S.v.code)}" style="text-transform:uppercase" required><span class="hint">2 to 5 letters or numbers. It appears on records, receipts and reports. Existing member IDs and login IDs do not change.</span></div><div class="field"><label for="vpA">Address on the letterhead (optional)</label><input id="vpA" name="address" class="input" maxlength="90" value="${esc((S.v.letter || {}).address || '')}"></div><div class="field"><label for="vpMo">Motto or tagline (optional)</label><input id="vpMo" name="motto" class="input" maxlength="70" value="${esc((S.v.letter || {}).motto || '')}"></div>` : ''}${fileField('Logo', 'logo')}${S.v.logo ? '<label class="check"><input type="checkbox" name="removeLogo"> <span>Remove the current logo</span></label>' : ''}`, submit: 'Save profile',
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

/* =========================================================
   ROUND 4: outstanding bills, notices, member profile, clickable drill-downs
   ========================================================= */
function owingList(yr, f) {
  f = f || {}; const q = (f.q || '').toLowerCase();
  return S.v.users.filter(u => u.role === 'member' && u.active && (!f.kin || u.kindred === f.kin) && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)))
    .map(u => { const rows = owingRows(u.id, yr); return { u, rows, owe: sum(rows, 'owe') }; })
    .filter(x => x.owe > 0 && (!f.levy || x.rows.some(r => r.L.id === f.levy && r.owe > 0))).sort((a, b) => b.owe - a.owe);
}
function reminderText(it, yr) {
  const lines = it.rows.filter(r => r.owe > 0).map(r => `- ${r.L.name}: ${money(r.owe)}`).join('\n'), acc = (S.v.settings.accounts || []).map(a => `${a.bank}, ${a.number}, ${a.name}`).join('\n');
  return `Dear ${it.u.name.split(' ')[0]}, this is a payment reminder from ${S.v.name}.\nStill unpaid for ${yr}:\n${lines}\nTotal: ${money(it.owe)}\n\nPay to:\n${acc || '(ask your admin for the account)'}\n\nAfter paying, sign in to VillageVault, choose ${S.v.name} and upload your proof of payment.`;
}
const itemFor = (id, yr) => { const u = userById(id), rows = owingRows(id, yr); return { u, rows, owe: sum(rows, 'owe') }; };

/* ----- Notice PDF (one page per member, with payment instructions) ----- */
function wrapText(pdf, s, maxW, size, bold) {
  const words = String(s).split(/\s+/), lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (pdf.w(t, size, bold) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur); return lines;
}
function drawNotice(pdf, it, yr) {
  const M = 48, CW = pdf.W - 96, INK = '#14142B', MUT = '#5B5F7A', u = it.u, acc = S.v.settings.accounts || []; let y = 0;
  const ensure = h => { if (y + h > pdf.H - 56) { pdf.add(); y = 60; } };
  pdf.rect(0, 0, pdf.W, 104, '#1A1A4E'); pdf.rect(0, 104, pdf.W, 5, '#F5B83D');
  const prem = S.v.plan === 'premium'; if (prem && S.v.logo) pdf.img(S.v.logo, pdf.W - M - 52, 26, 52, 52);
  pdf.text(pdf.fit(S.v.name, CW - 70, 20, true), M, 48, { size: 20, bold: true, color: '#FFFFFF' });
  pdf.text('OUTSTANDING PAYMENT NOTICE', M, 74, { size: 11, bold: true, color: '#F5B83D' });
  pdf.text(prem ? `Village code: ${S.v.code}` : 'Records kept on VillageVault', M, 92, { size: 8, color: '#C9CBEA' });
  y = 140; pdf.text(`Notice NT-${S.v.code}-${yr}-${u.id}`, M, y, { size: 9, color: MUT }); pdf.text(`Date: ${fmtDate(today())}`, pdf.W - M, y, { size: 9, color: MUT, align: 'right' });
  y += 28; pdf.text('To', M, y, { size: 9, color: MUT }); y += 17; pdf.text(pdf.fit(u.name, CW, 15, true), M, y, { size: 15, bold: true, color: '#1A1A4E' });
  y += 16; pdf.text(`${u.id}${kinOf(u) ? '   |   ' + kinOf(u) : ''}${u.phone ? '   |   ' + u.phone : ''}`, M, y, { size: 10, color: MUT });
  y += 28; wrapText(pdf, `Dear ${u.name.split(' ')[0]}, our records for ${yr} show that the amounts below are still unpaid. Only payments verified by an admin are counted. If you have already paid, upload your proof of payment and we will update your record.`, CW, 10.5).forEach(l => { pdf.text(l, M, y, { size: 10.5, color: INK }); y += 15; });
  y += 8; const c2 = M + CW * .56, c3 = M + CW * .78, c4 = M + CW - 10;
  pdf.rect(M, y, CW, 24, '#EEF2F0'); pdf.text('Levy', M + 10, y + 16, { size: 9, bold: true, color: MUT }); pdf.text('Amount due', c2, y + 16, { size: 9, bold: true, color: MUT, align: 'right' }); pdf.text('Paid', c3, y + 16, { size: 9, bold: true, color: MUT, align: 'right' }); pdf.text('Outstanding', c4, y + 16, { size: 9, bold: true, color: MUT, align: 'right' }); y += 24;
  it.rows.filter(r => r.need > 0).forEach(r => {
    ensure(26); pdf.text(pdf.fit(r.L.name, CW * .5, 10.5), M + 10, y + 17, { size: 10.5, color: INK }); pdf.text(pm(r.need), c2, y + 17, { size: 10.5, color: INK, align: 'right' }); pdf.text(pm(r.paid), c3, y + 17, { size: 10.5, color: INK, align: 'right' }); pdf.text(pm(r.owe), c4, y + 17, { size: 10.5, bold: true, color: r.owe ? '#D2395B' : '#12806A', align: 'right' }); y += 25; pdf.line(M, y, M + CW, y, '#DCE3E0');
  });
  ensure(34); pdf.rect(M, y, CW, 28, '#1A1A4E'); pdf.text('TOTAL OUTSTANDING', M + 10, y + 18, { size: 10, bold: true, color: '#FFFFFF' }); pdf.text(pm(it.owe), c4, y + 19, { size: 12, bold: true, color: '#F5B83D', align: 'right' }); y += 48;
  ensure(40 + Math.max(1, acc.length) * 26); pdf.text('How to pay', M, y, { size: 12, bold: true, color: '#1A1A4E' }); y += 12;
  const b2 = M + CW * .42, b3 = M + CW * .68, rowH = 26, top = y, rows = acc.length ? acc : [{ bank: 'Ask your admin for the account', number: '', name: '' }];
  pdf.rect(M, y, CW, rowH, '#EEF2F0'); pdf.text('Bank name', M + 8, y + 17, { size: 9, bold: true, color: MUT }); pdf.text('Account number', b2 + 8, y + 17, { size: 9, bold: true, color: MUT }); pdf.text('Account name', b3 + 8, y + 17, { size: 9, bold: true, color: MUT }); y += rowH;
  rows.forEach(a => { pdf.text(pdf.fit(a.bank, b2 - M - 14, 10.5, true), M + 8, y + 17, { size: 10.5, bold: true, color: INK }); pdf.text(a.number, b2 + 8, y + 17, { size: 11, bold: true, color: INK }); pdf.text(pdf.fit(a.name, M + CW - b3 - 14, 10.5), b3 + 8, y + 17, { size: 10.5, color: INK }); y += rowH; });
  const bot = y; for (let k = 0; k <= rows.length + 1; k++) pdf.line(M, top + k * rowH, M + CW, top + k * rowH, '#5B5F7A', .8);
  [M, b2, b3, M + CW].forEach(x => pdf.line(x, top, x, bot, '#5B5F7A', .8)); y += 24;
  ensure(120); pdf.text('Steps', M, y, { size: 11, bold: true, color: '#1A1A4E' }); y += 8;
  ['Pay the exact amount outstanding into the account above. VillageVault does not receive your money.', 'Keep your bank slip or transfer alert.', `Open VillageVault, choose ${S.v.name}, sign in and tap Upload proof. Your admin will verify it and your balance updates by itself.`].forEach((s, i) => {
    wrapText(pdf, s, CW - 20, 10).forEach((l, j) => { y += 15; pdf.text(j === 0 ? `${i + 1}.` : '', M, y, { size: 10, bold: true, color: '#1A1A4E' }); pdf.text(l, M + 20, y, { size: 10, color: INK }); });
  });
  if (S.v.settings.payNote) { y += 8; wrapText(pdf, S.v.settings.payNote, CW, 9).forEach(l => { y += 13; pdf.text(l, M, y, { size: 9, color: MUT }); }); }
  ensure(70); y += 30; pdf.line(M, y, M + 200, y, '#14142B', .8); pdf.text(`${S.u.name}, ${S.u.title}`, M, y + 14, { size: 10, bold: true, color: INK }); pdf.text(`${S.v.name}. Issued ${fmtTS(stamp())}`, M, y + 27, { size: 8.5, color: MUT });
}
function noticePdf(items, yr) {
  const pdf = new PDF(); if (S.v.plan !== 'premium') pdf.wm = 'VillageVault'; items.forEach((it, i) => { if (i) pdf.add(); drawNotice(pdf, it, yr); }); return pdf.build('Outstanding payment notice');
}
Object.assign(API, {
  logNotice(ids, how) { requireAdmin(); log('Issued payment notice', ids.length === 1 ? ids[0] : `${ids.length} members`, `${how}: ${ids.length === 1 ? 'outstanding notice for ' + ids[0] : ids.length + ' outstanding notices'}`); commit(); }
});

/* ----- Outstanding bills page ----- */
ADMIN.outstanding = function () {
  const f = S.f, yr = new Date().getFullYear(), list = owingList(yr, f), all = owingList(yr, {}), active = S.v.users.filter(u => u.role === 'member' && u.active).length, exp = expectedPerMember() * active, page = paginate(list, f);
  const owes = it => it.rows.filter(r => r.owe > 0).map(r => `${esc(r.L.name)} ${money(r.owe)}`).join('<br>');
  return `<div class="kpis">${kpi('Members owing', String(all.length), `of ${active} active members`, all.length ? 'bad' : 'good')}${kpi('Total outstanding', money(sum(all, 'owe')), `for ${yr}`, 'hot')}${kpi('Required for ' + yr, money(exp), 'All required levies')}${kpi('Collected so far', exp ? Math.max(0, Math.round((1 - sum(all, 'owe') / exp) * 100)) + '%' : '-', 'of what is required', 'good')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Members who owe</h2><p>Open a member to see their history. Download a notice with the payment instructions and send it to them.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${broadcastBtn()}<button class="btn btn-ghost btn-sm" type="button" data-act="owing-csv">Download list (CSV)</button><button class="btn btn-primary btn-sm" type="button" data-act="notice-all"${list.length ? '' : ' disabled'}>Download all notices (PDF)</button></div></div>
  <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div>${isVillageType() ? `<div class="field"><label for="fw">Kindred</label><select id="fw" class="select" data-filter="kin">${kindredOpts(f.kin, 'All kindreds')}</select></div>` : ''}<div class="field"><label for="fl">Owing levy</label><select id="fl" class="select" data-filter="levy">${opt('', 'Any levy', f.levy)}${levies().filter(l => l.fixed).map(l => opt(l.id, l.name, f.levy)).join('')}</select></div></div>
  ${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', 'What they owe', { t: 'Total owed', num: true }, ''], page.map(it => { const wa = waLinkTo(it.u.phone, reminderText(it, yr)); return [`${linkBtn('member-profile', it.u.id, it.u.name)}<small>${esc(it.u.id)}</small>`, ...(isVillageType() ? [esc(kinOf(it.u) || '-')] : []), esc(it.u.phone || '-'), `<small style="color:var(--ink)">${owes(it)}</small>`, `<b>${money(it.owe)}</b>`, `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="member-profile" data-id="${esc(it.u.id)}">Open</button><button class="btn btn-primary btn-sm" type="button" data-act="notice-one" data-id="${esc(it.u.id)}">Notice PDF</button>${wa ? `<a class="btn btn-leaf btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" data-act="notice-wa" data-id="${esc(it.u.id)}">WhatsApp</a>` : ''}</div>`]; }), ['Nobody owes anything', 'Everyone is up to date for ' + yr + '.']).replace(/<td class="num"><div class="actions">/g, '<td><div class="actions">')}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
};
Object.assign(ACTIONS, {
  'notice-one'(el) { requireAdmin(); const yr = new Date().getFullYear(), it = itemFor(el.dataset.id, yr); if (!it.u) return; if (!(it.owe > 0)) return toast(`${it.u.name} owes nothing.`, 'ok'); download(`Notice-${it.u.id}.pdf`, noticePdf([it], yr)); API.logNotice([it.u.id], 'PDF downloaded'); toast('Notice downloaded. Send it to the member.', 'ok'); renderSoon(); },
  'notice-all'() { requireAdmin(); const yr = new Date().getFullYear(), list = owingList(yr, S.f); if (!list.length) return toast('Nobody owes anything.', 'ok'); download(`Notices-${S.v.code}-${yr}.pdf`, noticePdf(list, yr)); API.logNotice(list.map(x => x.u.id), 'PDF downloaded'); toast(`${list.length} notices downloaded.`, 'ok'); renderSoon(); },
  'notice-wa'(el) { try { API.logNotice([el.dataset.id], 'WhatsApp reminder opened'); } catch (_) {} },
  'owing-csv'() { requireAdmin(); const yr = new Date().getFullYear(), rows = [['Member ID', 'Name', 'Family / Kindred', 'Phone', 'Owes', 'Total owed']]; owingList(yr, S.f).forEach(it => rows.push([it.u.id, it.u.name, kinOf(it.u), it.u.phone, it.rows.filter(r => r.owe > 0).map(r => `${r.L.name} ${r.owe}`).join('; '), it.owe])); csvDownload(`${S.v.code}-outstanding-${yr}.csv`, rows); }
});

/* ----- Member profile (admin): details, owing, payments, attendance ----- */
function memberProfile(id) {
  if (!isAdmin()) return; const u = userById(id); if (!u) return toast('Member not found.', 'err');
  const yr = new Date().getFullYear(), it = itemFor(id, yr), paid = sum(memberPaid(id, yr)), att = attendanceOf(id), txs = S.v.tx.filter(t => t.memberId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const wa = it.owe > 0 ? waLinkTo(u.phone, reminderText(it, yr)) : '', pend = u.mustChange && u.tempPw;
  infoModal(u.name, `${esc(u.id)}${kinOf(u) ? ', ' + esc(kinOf(u)) : ''}`, `<div class="kpis kpis-3" style="margin-top:14px">${kpi('Paid in ' + yr, money(paid), '', 'good')}${kpi('Still owes', money(it.owe), it.owe ? 'Send a notice below' : 'Up to date', it.owe ? 'bad' : '')}${kpi('Meetings attended', att.total ? `${att.present} of ${att.total}` : 'None yet', att.total ? Math.round(att.present / att.total * 100) + '% present' : '')}</div>
  <dl class="kv"><dt>Phone</dt><dd>${esc(u.phone || '-')}</dd><dt>Email</dt><dd>${esc(u.email || '-')}</dd><dt>Joined</dt><dd>${esc(fmtDate(u.joined))}</dd><dt>Account</dt><dd>${u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>'}</dd><dt>Login</dt><dd>${pend ? 'Temporary password sent, not yet used' : 'Member uses their own password'}</dd></dl>
  <div class="btn-row">${it.owe > 0 ? `<button class="btn btn-primary btn-sm" type="button" data-act="notice-one" data-id="${esc(id)}">Download notice (PDF)</button>` : ''}${wa ? `<a class="btn btn-leaf btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" data-act="notice-wa" data-id="${esc(id)}">Send reminder on WhatsApp</a>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="cred-send" data-id="${esc(id)}">Send login details</button><button class="btn btn-ghost btn-sm" type="button" data-act="edit-member" data-id="${esc(id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="member-tx" data-id="${esc(id)}">All payments</button></div>
  <div class="sec-title">What they owe in ${yr}</div>${table(['Levy', { t: 'Required', num: true }, { t: 'Paid', num: true }, { t: 'Owes', num: true }], it.rows.map(r => [esc(r.L.name), money(r.need), money(r.paid), r.owe ? `<b style="color:var(--hibiscus)">${money(r.owe)}</b>` : '<span class="badge b-verified">Paid</span>']), ['No required levies', ''])}
  <div class="sec-title">Payment history</div>${table(['Date', 'Levy', { t: 'Amount', num: true }, 'Status', ''], txs.slice(0, 8).map(t => [esc(fmtDate(t.date)), esc(levyOf(t.levy).name), money(t.amount), badge(t.status), `<button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">Open</button>`]), ['No payments yet', ''])}
  <div class="sec-title">Attendance history</div>${table(['Date', 'Meeting', 'Status'], att.rows.slice(0, 8).map(r => [esc(fmtDate(r.m.date)), esc(r.m.title), attBadge(r.state)]), ['No meetings yet', ''])}${pledgeSection(id)}`);
}
Object.assign(ACTIONS, {
  'member-profile'(el) { memberProfile(el.dataset.id); },
  'member-tx'(el) { closeModal(); S.page = 'transactions'; S.f = { member: el.dataset.id }; renderView(); window.scrollTo(0, 0); },
  'tx-filter'(el) { closeModal(); S.page = 'transactions'; S.f = { levy: el.dataset.id, status: 'verified', year: String(new Date().getFullYear()) }; renderView(); window.scrollTo(0, 0); },
  'exp-filter'(el) { closeModal(); S.page = 'expenses'; S.f = { cat: el.dataset.id, year: String(new Date().getFullYear()) }; renderView(); window.scrollTo(0, 0); },
  'go-page'(el) { closeModal(); goto(el.dataset.page); },
  'open-requests'() { S.rtab = 'requests'; goto('register'); },
  'forget-device'() { forgetRemember(S.v.id, S.v); logout(); toast('This device has been forgotten.', 'ok'); }
});

/* ----- Clickable dashboard cards: each opens detail, and the detail is clickable too ----- */
const dotName = l => `<span class="dot" style="background:${l.color}"></span>${esc(l.name)}`;
Object.assign(ACTIONS, {
  'kpi-collected'() {
    const yr = new Date().getFullYear(), inY = villageTx().filter(t => yearOf(t.date) === yr), by = levyAll().map(l => ({ l, a: inY.filter(t => t.levy === l.id) })).filter(x => x.a.length), latest = inY.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    infoModal(`Collected in ${yr}`, `${inY.length} verified payments, ${money(sum(inY))}`, `${table(['Levy', { t: 'Payments', num: true }, { t: 'Amount', num: true }, ''], by.map(x => [`${dotName(x.l)}`, String(x.a.length), money(sum(x.a)), `<button class="btn btn-ghost btn-sm" type="button" data-act="tx-filter" data-id="${x.l.id}">See payments</button>`]), ['Nothing collected yet', 'Verified payments appear here.']).replace(/<td class="num"><button/g, '<td><button')}
    <div class="sec-title">Latest verified payments</div>${table(['Date', 'Member', 'Levy', { t: 'Amount', num: true }], latest.map(t => [esc(fmtDate(t.date)), linkBtn('member-profile', t.memberId, nameOf(t.memberId)), esc(levyOf(t.levy).name), money(t.amount)]), ['None yet', ''])}`);
  },
  'kpi-spent'() {
    const yr = new Date().getFullYear(), exY = activeExp().filter(e => yearOf(e.date) === yr), cats = Array.from(new Set(exY.map(e => e.category))).map(c => ({ c, a: exY.filter(e => e.category === c) })), latest = exY.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    infoModal(`Spent in ${yr}`, `${exY.length} items, ${money(sum(exY))}`, `${table(['Category', { t: 'Items', num: true }, { t: 'Amount', num: true }, ''], cats.map(x => [esc(x.c), String(x.a.length), money(sum(x.a)), `<button class="btn btn-ghost btn-sm" type="button" data-act="exp-filter" data-id="${esc(x.c)}">See items</button>`]), ['Nothing spent yet', '']).replace(/<td class="num"><button/g, '<td><button')}
    <div class="sec-title">Latest spending</div>${table(['Date', 'Description', { t: 'Amount', num: true }, 'Recorded by'], latest.map(e => [esc(fmtDate(e.date)), esc(e.description), money(e.amount), esc(e.createdBy)]), ['None yet', ''])}`);
  },
  'kpi-balance'() {
    const inc = sum(villageTx()), spent = sum(activeExp());
    infoModal('Village balance', 'All verified income less all recorded spending', `${table(['', { t: 'Amount', num: true }, ''], [['Verified income, all time', money(inc), '<button class="btn btn-ghost btn-sm" type="button" data-act="tx-filter" data-id="">See income</button>'], ['Spending, all time', money(spent), '<button class="btn btn-ghost btn-sm" type="button" data-act="exp-filter" data-id="">See spending</button>'], ['<b>Balance</b>', `<b>${money(inc - spent)}</b>`, '']]).replace(/<td class="num"><button/g, '<td><button')}
    <div class="sec-title">Waiting for verification</div><p class="muted">${money(sum(pendingTx()))} from ${pendingTx().length} payment${pendingTx().length === 1 ? '' : 's'} is not in the balance yet.</p><div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="go-page" data-page="verify">Review payments</button><button class="btn btn-ghost btn-sm" type="button" data-act="go-page" data-page="reports">Open reports</button></div>`, 'modal-lg');
  },
  'my-owing'() {
    const yr = new Date().getFullYear(), rows = owingRows(S.u.id, yr), owe = sum(rows, 'owe');
    infoModal('What you owe', `${esc(S.v.name)}, ${yr}`, `${table(['Levy', { t: 'Required', num: true }, { t: 'Paid', num: true }, { t: 'You owe', num: true }], rows.map(r => [esc(r.L.name), money(r.need), money(r.paid), r.owe ? `<b style="color:var(--hibiscus)">${money(r.owe)}</b>` : 'Paid']).concat([['<b>Total</b>', '', '', `<b>${money(owe)}</b>`]]), ['No required levies', ''])}
    <div class="sec-title">How to pay</div>${accTable(S.v.settings.accounts || [])}<p class="hint" style="margin-top:8px">${esc(S.v.settings.payNote || '')}</p><p class="hint">After you pay, upload your proof. Your balance drops by itself once the admin verifies it.</p><div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof of payment</button></div>`);
  },
  'audit-item'(el) {
    const a = S.v.audit.find(x => x.id === el.dataset.id); if (!a) return;
    infoModal(a.action, 'Recorded by an admin', `<dl class="kv" style="margin-top:14px"><dt>When</dt><dd>${esc(fmtTS(a.ts))}</dd><dt>Admin</dt><dd>${esc(a.adminName)}${a.adminTitle ? ', ' + esc(a.adminTitle) : ''}</dd><dt>Record</dt><dd>${esc(a.target)}</dd><dt>Details</dt><dd>${esc(a.detail)}</dd></dl>
    <div class="btn-row">${S.v.tx.some(t => t.id === a.target) ? `<button class="btn btn-primary btn-sm" type="button" data-act="view-tx" data-id="${esc(a.target)}">Open this record</button>` : ''}${userById(a.target) && userById(a.target).role === 'member' ? `<button class="btn btn-primary btn-sm" type="button" data-act="member-profile" data-id="${esc(a.target)}">Open this member</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="go-page" data-page="audit">Full activity log</button></div>`, 'modal-md');
  }
});

/* =========================================================
   ROUND 4: attendance register, access requests, login details
   ========================================================= */
const meetingOpen = m => m.status === 'open' && m.date === today();
const getMtg = id => { const m = S.v.meetings.find(x => x.id === id); if (!m) throw new Error('Meeting not found.'); return m; };
const attBadge = s => ({ verified: '<span class="badge b-verified">Present</span>', pending: '<span class="badge b-pending">Waiting for admin</span>', rejected: '<span class="badge b-rejected">Not accepted</span>', absent: '<span class="badge b-off">Absent</span>', open: '<span class="badge b-pending">Register open</span>' })[s] || '';
const meetingsDesc = () => S.v.meetings.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
function attendanceOf(id) {
  const rows = meetingsDesc().map(m => { const k = m.marks.find(x => x.memberId === id); return { m, k, state: k ? k.status : (meetingOpen(m) ? 'open' : 'absent') }; });
  const counted = rows.filter(r => !meetingOpen(r.m));
  return { rows, total: counted.length, present: counted.filter(r => r.state === 'verified').length };
}
const presentCount = m => m.marks.filter(k => k.status === 'verified').length;

Object.assign(API, {
  openRegister(title) {
    requireAdmin();
    S.v.meetings.forEach(m => { if (m.status === 'open' && m.date !== today()) { m.status = 'closed'; m.closedAt = stamp(); m.closedBy = 'Closed automatically at midnight'; } });
    if (S.v.meetings.some(meetingOpen)) throw new Error('A register is already open. Close it before opening another.');
    const m = { id: nextId('mtg', 'G'), title, date: today(), status: 'open', openedBy: S.u.name, openedById: S.u.id, openedAt: stamp(), marks: [] };
    S.v.meetings.push(m); log('Opened attendance register', m.id, `${title}, ${fmtDate(m.date)}`); commit(); return m;
  },
  closeRegister(id) {
    requireAdmin(); const m = getMtg(id); if (m.status !== 'open') throw new Error('This register is already closed.');
    m.status = 'closed'; m.closedAt = stamp(); m.closedBy = S.u.name; log('Closed attendance register', id, `${m.title}: ${presentCount(m)} present, ${m.marks.filter(k => k.status === 'pending').length} not yet verified`); commit();
  },
  markAttendance() {
    if (!S.u || S.u.id === 'SUPPORT' || S.owner || !['member', 'admin'].includes(S.u.role) || !S.u.active) throw new Error('Only members and admins can mark their own attendance.'); requireWritable();
    const m = S.v.meetings.find(meetingOpen); if (!m) throw new Error('No register is open right now. Your admin opens it on meeting days only.');
    if (m.marks.some(k => k.memberId === S.u.id)) throw new Error('You have already marked attendance for this meeting.');
    m.marks.push({ memberId: S.u.id, at: stamp(), status: 'pending' }); commit(); return m;
  },
  setMark(mid, memberId, status) {
    requireAdmin(); const m = getMtg(mid); let k = m.marks.find(x => x.memberId === memberId);
    if (!k) {
      if (status !== 'verified') throw new Error('There is no mark to change.');
      k = { memberId, at: stamp(), status: 'pending', addedByAdmin: true, addedBy: S.u.name, addedById: S.u.id }; m.marks.push(k);
      log('Marked attendance (needs a second admin)', mid, `${nameOf(memberId)} at ${m.title}, ${fmtDate(m.date)}. Another admin must verify it`); commit(); return;
    }
    if (status === 'verified' && (k.memberId === S.u.id || k.addedById === S.u.id)) throw new Error('You cannot verify your own entry. Another admin must verify it.');
    k.status = status; k.by = S.u.name; k.byId = S.u.id; k.byAt = stamp();
    log(status === 'verified' ? 'Verified attendance' : 'Did not accept attendance', mid, `${nameOf(memberId)} at ${m.title}, ${fmtDate(m.date)}${k.addedByAdmin ? ' (added by admin)' : ''}`); commit();
  },
  verifyAll(mid) {
    requireAdmin(); const m = getMtg(mid), p = m.marks.filter(k => k.status === 'pending' && k.memberId !== S.u.id && k.addedById !== S.u.id); if (!p.length) throw new Error('Nothing is waiting for you to verify. Entries you made yourself need another admin.');
    p.forEach(k => { k.status = 'verified'; k.by = S.u.name; k.byId = S.u.id; k.byAt = stamp(); }); log('Verified attendance', mid, `${p.length} members at ${m.title}, ${fmtDate(m.date)}`); commit(); return p.length;
  },
  removeMark(mid, memberId) {
    requireAdmin(); const m = getMtg(mid); m.marks = m.marks.filter(k => k.memberId !== memberId); log('Removed attendance mark', mid, `${nameOf(memberId)} at ${m.title}, ${fmtDate(m.date)}`); commit();
  },
  logCredSent(id, how) { requireAdmin(); S.v.credLog.push({ memberId: id, by: S.u.name, at: stamp(), kind: 'sent', how }); log('Sent login details', id, `${nameOf(id)} (${how})`); commit(); },
  resolveRequest(rid, d) {
    requireAdmin(); const r = S.v.requests.find(x => x.id === rid); if (!r) throw new Error('Request not found.'); if (r.status !== 'new') throw new Error('This request was already handled.');
    r.status = d.status; r.handledBy = S.u.name; r.handledAt = stamp(); r.memberId = d.memberId || ''; r.reason = d.reason || '';
    log(d.status === 'issued' ? 'Issued login details' : 'Declined login request', rid, d.status === 'issued' ? `${r.name} confirmed on the register as ${nameOf(d.memberId)} (${d.memberId})` : `${r.name}: ${d.reason}`); commit();
  }
});

/* ----- Member side ----- */
function attendanceMember() {
  const open = S.v.meetings.find(meetingOpen), att = attendanceOf(S.u.id), mine = open && open.marks.find(k => k.memberId === S.u.id), latest = meetingsDesc()[0];
  const top = open ? (mine
    ? `<div class="callout ok"><div><b>You marked attendance for ${esc(open.title)}</b><p>${mine.status === 'verified' ? 'Your admin has verified it.' : 'Waiting for your admin to verify it.'}</p></div></div>`
    : `<div class="callout"><div><b>The register is open: ${esc(open.title)}</b><p>Mark yourself present now. Your admin will verify it. It closes tonight.</p></div><button class="btn btn-primary" type="button" data-act="att-mark">Mark me present</button></div>`)
    : `<div class="empty" style="padding:18px"><b>No register is open right now</b>Your admin opens it on meeting days only.</div>`;
  return `<section class="panel"><div class="panel-h"><div><h2>Attendance</h2><p>${att.total ? `You were present at ${att.present} of ${att.total} meetings (${Math.round(att.present / att.total * 100)}%).` : 'Your attendance history will show here.'}</p></div>${latest ? `<button class="btn btn-ghost btn-sm" type="button" data-act="view-register" data-id="${esc(latest.id)}">View the register</button>` : ''}</div>${top}
  <div class="sec-title">My attendance history</div>${table(['Date', 'Meeting', 'Status'], att.rows.slice(0, 8).map(r => [esc(fmtDate(r.m.date)), esc(r.m.title), attBadge(r.state)]), ['No meetings yet', 'Registers opened by your admin appear here.'])}</section>`;
}
function attendanceRegisterView() {
  const list = meetingsDesc().slice(0, 8), active = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && u.active).length;
  return `<section class="panel"><div class="panel-h"><div><h2>Attendance register</h2><p>Meetings and who was verified present. Open a meeting to see the names.</p></div></div>
  ${table(['Date', 'Meeting', { t: 'Present', num: true }, { t: 'Rate', num: true }, 'Status', ''], list.map(m => [esc(fmtDate(m.date)), esc(m.title), String(presentCount(m)), active ? Math.round(presentCount(m) / active * 100) + '%' : '-', meetingOpen(m) ? '<span class="badge b-verified">Open today</span>' : '<span class="badge b-off">Closed</span>', `<button class="btn btn-ghost btn-sm" type="button" data-act="view-register" data-id="${esc(m.id)}">View register</button>`]), ['No meetings yet', 'Registers opened by admins appear here.']).replace(/<td class="num">(<button)/g, '<td>$1')}</section>`;
}
function activityFeed() {
  const list = S.v.audit.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15);
  return `<section class="panel"><div class="panel-h"><div><h2>What the admins have done</h2><p>Every action an admin takes is shown here with their name and the time.</p></div></div>
  <div class="list">${list.map(a => `<div class="list-item"><div><b>${esc(a.action)}</b><small>${esc(a.detail)}</small><small>${esc(a.adminName)}${a.adminTitle ? ', ' + esc(a.adminTitle) : ''} on ${esc(fmtTS(a.ts))}</small></div></div>`).join('') || '<div class="empty"><b>No activity yet</b></div>'}</div></section>`;
}
Object.assign(ACTIONS, {
  'att-mark-admin'(el) { requireAdmin(); API.markAttendance(); toast('Marked. Another admin must verify your attendance.', 'ok'); if ($('#modalRoot').hidden) renderView(); else { mtgView(el.dataset.id); renderSoon(); } },
  'att-mark'() { API.markAttendance(); toast('Attendance marked. Your admin will verify it.', 'ok'); renderView(); },
  'view-register'(el) {
    const m = S.v.meetings.find(x => x.id === el.dataset.id); if (!m) return;
    const here = m.marks.filter(k => k.status === 'verified').map(k => nameOf(k.memberId)).sort(), active = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && u.active).length;
    infoModal(m.title, `${esc(fmtDate(m.date))}. ${here.length} verified present of ${active} members.${meetingOpen(m) ? ' The register is open today.' : ''}`, here.length ? `<div class="namegrid">${here.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : '<div class="empty"><b>Nobody verified yet</b></div>', 'modal-md');
  }
});

/* ----- Admin: Register page with four tabs ----- */
ADMIN.register = function () {
  const tab = S.rtab || 'attendance', reqN = S.v.requests.filter(r => r.status === 'new').length, pend = S.v.meetings.reduce((a, m) => a + m.marks.filter(k => k.status === 'pending').length, 0);
  const tabs = [['attendance', 'Attendance' + (pend ? ` (${pend})` : '')], ['members', 'Member register'], ['logins', 'Login details'], ['requests', 'Login requests' + (reqN ? ` (${reqN})` : '')]];
  const body = ({ attendance: regAttendance, members: regMembers, logins: regLogins, requests: regRequests })[tab]();
  return `<div class="tabs-row"><div class="tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" data-act="rtab" data-tab="${t[0]}" class="${tab === t[0] ? 'active' : ''}" aria-selected="${tab === t[0]}">${t[1]}</button>`).join('')}</div></div>${body}`;
};
Object.assign(ACTIONS, { 'rtab'(el) { S.rtab = el.dataset.tab; S.f = {}; renderView(); } });
VIEWS.admin.register = ADMIN.register; VIEWS.admin.profile = ADMIN.profile; VIEWS.admin.levies = ADMIN.levies; VIEWS.admin.outstanding = ADMIN.outstanding;

function regAttendance() {
  const open = S.v.meetings.find(meetingOpen), list = meetingsDesc();
  const banner = open
    ? `<section class="panel att-open"><div class="panel-h"><div><span class="badge b-verified">Register open today</span><h2 style="margin-top:8px">${esc(open.title)}</h2><p>${esc(fmtDate(open.date))}. Members can mark themselves present until you close it or midnight. ${presentCount(open)} verified, ${open.marks.filter(k => k.status === 'pending').length} waiting for you.</p></div><div class="btn-row"><button class="btn btn-primary" type="button" data-act="mtg-view" data-id="${esc(open.id)}">Open the register</button>${!open.marks.some(k => k.memberId === S.u.id) && S.u.id !== 'SUPPORT' && !S.owner ? `<button class="btn btn-leaf" type="button" data-act="att-mark-admin" data-id="${esc(open.id)}">Mark me present</button>` : ''}<button class="btn btn-ghost" type="button" data-act="mtg-close" data-id="${esc(open.id)}">Close register</button></div></div></section>`
    : `<section class="panel"><div class="panel-h"><div><h2>No register is open</h2><p>Open it on meeting day only. It accepts attendance for today, so nobody can sign for a past meeting.</p></div><button class="btn btn-primary" type="button" data-act="mtg-open">Open today's register</button></div></section>`;
  return `${banner}<section class="panel"><div class="panel-h"><div><h2>Meetings</h2><p>Open a meeting to verify names, or to click a member and see their payments and attendance.</p></div></div>
  ${table(['Date', 'Meeting', { t: 'Present', num: true }, { t: 'Waiting', num: true }, 'Status', 'Opened by', ''], list.map(m => [esc(fmtDate(m.date)), esc(m.title), String(presentCount(m)), String(m.marks.filter(k => k.status === 'pending').length), meetingOpen(m) ? '<span class="badge b-verified">Open today</span>' : '<span class="badge b-off">Closed</span>', `${esc(m.openedBy)}<small>${esc(fmtTS(m.openedAt))}</small>`, `<button class="btn btn-ghost btn-sm" type="button" data-act="mtg-view" data-id="${esc(m.id)}">Open</button>`]), ['No meetings yet', 'Open a register on your next meeting day.']).replace(/<td class="num">(<button)/g, '<td>$1')}</section>`;
}
function regMembers() {
  const f = S.f, yr = new Date().getFullYear(), q = (f.q || '').toLowerCase();
  const list = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && (!f.kin || u.kindred === f.kin) && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))).sort((a, b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1) || a.name.localeCompare(b.name)), page = paginate(list, f);
  return `<section class="panel"><div class="panel-h"><div><h2>Member register</h2><p>Click a name to see that member's attendance and payment history.</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="register-csv">Download register (CSV)</button></div>
  <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div>${isVillageType() ? `<div class="field"><label for="fw">Kindred</label><select id="fw" class="select" data-filter="kin">${kindredOpts(f.kin, 'All kindreds')}</select></div>` : ''}</div>
  ${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', { t: 'Attendance', num: true }, { t: 'Paid ' + yr, num: true }, { t: 'Owes', num: true }, 'Account'], page.map(u => { const a = attendanceOf(u.id), o = memberOutstanding(u.id, yr); return [`${linkBtn('member-profile', u.id, u.name)}<small>${esc(u.id)}${u.role === 'admin' ? ' · ' + esc(u.title || 'Admin') : ''}</small>`, ...(isVillageType() ? [esc(kinOf(u) || '-')] : []), esc(u.phone || '-'), a.total ? `${a.present} of ${a.total}` : '-', money(sum(memberPaid(u.id, yr))), o ? `<b style="color:var(--hibiscus)">${money(o)}</b>` : 'Nil', u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>']; }), ['No members match', 'Try a different filter.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
}
function regLogins() {
  const f = S.f, q = (f.q || '').toLowerCase();
  const list = S.v.users.filter(u => u.role === 'member' && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name)), page = paginate(list, f);
  return `<section class="panel"><div class="panel-h"><div><h2>Member login details</h2><p>When a member forgets their login, find them here and send the details again. A member's own password is never stored. A temporary password is kept only until the member changes it.</p></div></div>
  <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div></div>
  ${table(['Member', 'Phone', 'Login', 'Last sent', ''], page.map(u => { const last = S.v.credLog.filter(c => c.memberId === u.id).pop(), waiting = u.mustChange && u.tempPw; return [`${linkBtn('member-profile', u.id, u.name)}<small>${esc(u.id)}</small>`, esc(u.phone || '-'), waiting ? '<span class="badge b-pending">Temporary password stored</span>' : '<span class="badge b-active">Has own password</span>', last ? `${esc(fmtTS(last.at))}<small>by ${esc(last.by)}</small>` : '<small>Never sent from here</small>', `<div class="actions"><button class="btn btn-primary btn-sm" type="button" data-act="cred-send" data-id="${esc(u.id)}">${waiting ? 'View and resend' : 'Send new details'}</button></div>`]; }), ['No members match', ''])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
}
function regRequests() {
  const list = S.v.requests.slice().sort((a, b) => b.at.localeCompare(a.at)), nw = list.filter(r => r.status === 'new').length;
  return `<section class="panel"><div class="panel-h"><div><h2>Login requests</h2><p>First-time members ask for login details from the sign-in page. Check each name against your register. Only then issue their details.</p></div></div>${nw ? '' : '<div class="callout ok"><div><b>Nothing waiting</b><p>New requests from members will appear here.</p></div></div>'}
  ${table(['Asked', 'Name on the request', 'Phone', ...(isVillageType() ? ['Family / Kindred'] : []), 'Message', 'Status', ''], list.map(r => [esc(fmtTS(r.at)), `<b>${esc(r.name)}</b>`, esc(r.phone), ...(isVillageType() ? [esc([r.family, r.kindred].filter(Boolean).join(', ') || '-')] : []), esc(r.note || '-'), r.status === 'new' ? '<span class="badge b-pending">Waiting</span>' : r.status === 'issued' ? `<span class="badge b-verified">Issued</span><small>${esc(r.memberId)}, by ${esc(r.handledBy)}</small>` : `<span class="badge b-rejected">Declined</span><small>${esc(r.reason)}, by ${esc(r.handledBy)}</small>`, r.status === 'new' ? `<div class="actions"><button class="btn btn-primary btn-sm" type="button" data-act="req-check" data-id="${esc(r.id)}">Check register</button><button class="btn btn-ghost btn-sm" type="button" data-act="req-decline" data-id="${esc(r.id)}">Decline</button></div>` : '']), ['No requests yet', 'Members who need login details will appear here.'])}</section>`;
}

/* ----- Register modal: verify names, add a member, click a name for their history ----- */
function mtgView(id) {
  const m = getMtg(id), open = meetingOpen(m), pend = m.marks.filter(k => k.status === 'pending').length;
  const people = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin') && (u.active || m.marks.some(k => k.memberId === u.id))).sort((a, b) => a.name.localeCompare(b.name));
  const rows = people.map(u => { const k = m.marks.find(x => x.memberId === u.id), st = k ? k.status : 'absent';
    const own = u.id === S.u.id, mine = k && (k.memberId === S.u.id || k.addedById === S.u.id), bt = (a, l, extra) => `<button class="btn ${extra || 'btn-ghost'} btn-sm" type="button" data-act="${a}" data-id="${esc(m.id)}" data-m="${esc(u.id)}"`;
    const vbtn = `${bt('mtg-mark', '', 'btn-leaf')} data-s="verified">Verify</button>${bt('mtg-mark')} data-s="rejected">Reject</button>`, rm = `${bt('mtg-remove')}>Remove</button>`;
    const act = st === 'pending' ? (mine ? `<small>Another admin must verify</small>${k.addedById === S.u.id && !own ? rm : ''}` : vbtn)
      : st === 'verified' ? (own ? '' : rm) : (own ? '' : `${bt('mtg-mark')} data-s="verified">Mark present</button>`);
    return [`${linkBtn('member-profile', u.id, u.name)}<small>${esc(u.id)}</small>`, k ? esc(fmtTS(k.at)) + (k.addedByAdmin ? '<small>Added by admin</small>' : '') : '-', attBadge(st === 'absent' && open ? 'absent' : st), k && k.by ? `${esc(k.by)}<small>${esc(fmtTS(k.byAt))}</small>` : '-', `<div class="actions">${act}</div>`]; });
  infoModal(m.title, `${esc(fmtDate(m.date))}. ${presentCount(m)} verified present, ${pend} waiting. ${open ? 'Register is open.' : 'Register is closed.'}`,
    `<div class="btn-row" style="margin-top:12px">${pend ? `<button class="btn btn-leaf btn-sm" type="button" data-act="mtg-all" data-id="${esc(m.id)}">Verify all ${pend} waiting</button>` : ''}${open ? `<button class="btn btn-ghost btn-sm" type="button" data-act="mtg-close" data-id="${esc(m.id)}">Close register</button>` : ''}${open && !m.marks.some(k => k.memberId === S.u.id) && S.u.id !== 'SUPPORT' && !S.owner ? `<button class="btn btn-primary btn-sm" type="button" data-act="att-mark-admin" data-id="${esc(m.id)}">Mark me present</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="mtg-csv" data-id="${esc(m.id)}">Download CSV</button></div>
    ${table(['Member', 'Marked at', 'Status', 'Checked by', ''], rows, ['No members', '']).replace(/<td>(<div class="actions">)/g, '<td>$1')}`);
}
Object.assign(ACTIONS, {
  'mtg-open'() {
    requireAdmin();
    openModal({ title: "Open today's register", sub: 'Members can mark themselves present only while it is open, and only for today. You verify every name.', body: `<div class="field"><label for="mtT">Meeting</label><input id="mtT" name="title" class="input" maxlength="60" value="General meeting" required></div><div class="field"><label>Date</label><input class="input" value="${esc(fmtDate(today()))}" disabled><span class="hint">Registers open for today only. This stops anyone signing for a meeting that did not happen.</span></div>`, submit: 'Open register',
      onSubmit: fd => { const t = (fd.get('title') || '').trim(); if (t.length < 3) throw new Error('Enter the meeting name.'); const m = API.openRegister(t); closeModal(); renderView(); toast('Register is open. Members can now mark attendance.', 'ok'); } });
  },
  'mtg-close'(el) { requireAdmin(); const m = getMtg(el.dataset.id); openModal({ title: 'Close the register?', sub: `${esc(m.title)}. Members will no longer be able to mark attendance. You can still verify names afterwards.`, body: '', submit: 'Close register', onSubmit: () => { API.closeRegister(m.id); closeModal(); renderView(); toast('Register closed.', 'ok'); } }); },
  'mtg-view'(el) { mtgView(el.dataset.id); },
  'mtg-mark'(el) { API.setMark(el.dataset.id, el.dataset.m, el.dataset.s); mtgView(el.dataset.id); renderSoon(); },
  'mtg-remove'(el) { API.removeMark(el.dataset.id, el.dataset.m); mtgView(el.dataset.id); renderSoon(); },
  'mtg-all'(el) { const n = API.verifyAll(el.dataset.id); toast(`${n} names verified.`, 'ok'); mtgView(el.dataset.id); renderSoon(); },
  'mtg-csv'(el) { requireAdmin(); const m = getMtg(el.dataset.id), rows = [['Member ID', 'Name', 'Family / Kindred', 'Status', 'Marked at', 'Checked by']]; S.v.users.filter(u => u.role === 'member' && u.active).forEach(u => { const k = m.marks.find(x => x.memberId === u.id); rows.push([u.id, u.name, kinOf(u), k ? k.status : 'absent', k ? fmtTS(k.at) : '', k && k.by ? k.by : '']); }); csvDownload(`${S.v.code}-attendance-${m.date}.csv`, rows); },
  'register-csv'() { requireAdmin(); const yr = new Date().getFullYear(), rows = [['Member ID', 'Name', 'Family / Kindred', 'Phone', 'Meetings attended', 'Meetings counted', 'Paid ' + yr, 'Owes', 'Account']]; S.v.users.filter(u => u.role === 'member').forEach(u => { const a = attendanceOf(u.id); rows.push([u.id, u.name, kinOf(u), u.phone, a.present, a.total, sum(memberPaid(u.id, yr)), memberOutstanding(u.id, yr), u.active ? 'Active' : 'Deactivated']); }); csvDownload(`${S.v.code}-member-register.csv`, rows); }
});

/* ----- Login details: show, copy, send on WhatsApp ----- */
function credMessage(u) {
  return `Hello ${u.name.split(' ')[0]}, here are your login details for ${S.v.name} on VillageVault.\nOpen the VillageVault website, choose "${S.v.name}" and sign in with:\nID: ${u.id}\nTemporary password: ${u.tempPw}\nYou will be asked to choose your own password the first time you sign in.\nFrom ${S.u.name}, ${S.u.title}.`;
}
async function credModal(id, forceNew, phone) {
  const u = userById(id); if (!u) return;
  try { if (!u.tempPw || forceNew) { await API.resetPassword(id, genPw()); renderSoon(); } } catch (e) { return toast(e.message, 'err'); }
  const msg = credMessage(u), wa = waLinkTo(phone || u.phone, msg);
  openModal({ title: 'Login details', size: 'modal-md', sub: `${esc(u.name)} (${esc(u.id)}). Send these to the member yourself. They choose their own password at first sign-in.`, submit: false,
    body: `<div class="field" style="margin-top:14px"><label for="credText">Message to send</label><textarea id="credText" class="textarea copybox" rows="7" readonly>${esc(msg)}</textarea></div>
    <div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="copy-cred" data-id="${esc(id)}">Copy message</button>${wa ? `<a class="btn btn-leaf btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer" data-act="cred-sent" data-id="${esc(id)}" data-how="WhatsApp">Send on WhatsApp</a>` : '<span class="hint">Add the member\'s phone number to send on WhatsApp.</span>'}<button class="btn btn-ghost btn-sm" type="button" data-act="cred-new" data-id="${esc(id)}">Issue a new password</button></div>` });
}
Object.assign(ACTIONS, {
  'cred-send'(el) {
    requireAdmin(); const u = userById(el.dataset.id); if (!u) return;
    if (u.tempPw) return credModal(u.id);
    openModal({ title: 'Send new login details?', sub: `${esc(u.name)} already uses their own password. We never store it, so a new temporary password will be issued and their old one stops working.`, body: '', submit: 'Issue and show details', onSubmit: () => { closeModal(); credModal(u.id, true); } });
  },
  'cred-new'(el) { const u = userById(el.dataset.id); openModal({ title: 'Issue a new password?', sub: `${esc(u.name)}'s current temporary password will stop working.`, body: '', submit: 'Issue new password', onSubmit: () => { closeModal(); credModal(u.id, true); } }); },
  'cred-sent'(el) { try { API.logCredSent(el.dataset.id, el.dataset.how); renderSoon(); } catch (_) {} },
  'copy-cred'(el) {
    const ta = $('#credText'); if (!ta) return; ta.select();
    const ok = () => { try { API.logCredSent(el.dataset.id, 'Copied'); renderSoon(); } catch (_) {} toast('Message copied. Paste it into WhatsApp or SMS.', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, () => { try { document.execCommand('copy'); } catch (_) {} ok(); }); else { try { document.execCommand('copy'); } catch (_) {} ok(); }
  }
});

/* ----- First-time members: request login details from the sign-in page ----- */
async function submitAccessRequest(vid, d) {
  const vil = VILLAGES.find(x => x.id === vid); if (!vil || vil.removed) throw new Error('This village or association is not available.');
  const v = await DB.load(vid); if (v.status === 'suspended') throw new Error('Access is paused for this village or association. Contact VillageVault support.');
  if (v.requests.some(r => r.status === 'new' && waNum(r.phone) === waNum(d.phone))) throw new Error('You already asked. Your admin will contact you on that phone number.');
  v.seq.req = (v.seq.req || 0) + 1; v.requests.push({ id: `${v.code}-R${String(v.seq.req).padStart(3, '0')}`, name: d.name, phone: d.phone, family: d.family || '', kindred: d.kindred || '', note: d.note, at: stamp(), status: 'new' });
  if (!DB.save(v)) warnStorage();
}
ACTIONS['request-access'] = function () {
  const vid = $('#heroVillage') && $('#heroVillage').value; if (!vid) return toast('Choose your village or association first.', 'err');
  const vil = VILLAGES.find(x => x.id === vid);
  openModal({ title: 'Request your login details', sub: `${esc(vil.name)}. Your admin will check your name on the village register, then send you your own login details.`,
    body: `<div class="field"><label for="rqN">Your full name, as on the register</label><input id="rqN" name="name" class="input" maxlength="80" required></div><div class="form-row"><div class="field"><label for="rqP">Phone number</label><input id="rqP" name="phone" class="input" type="tel" maxlength="20" placeholder="0803 123 4567" required></div></div>${vil.type !== 'association' ? '<div class="form-row"><div class="field"><label for="rqF">Family name</label><input id="rqF" name="family" class="input" maxlength="40" required></div><div class="field"><label for="rqK">Kindred name</label><input id="rqK" name="kindred" class="input" maxlength="40" required></div></div>' : ''}<div class="field"><label for="rqM">Message to the admin</label><textarea id="rqM" name="note" class="textarea" maxlength="200" required placeholder="${vil.type !== 'association' ? 'For example: I live abroad and joined in 2019' : 'For example: I joined in 2019 and my membership number is 123'}"></textarea></div>`, submit: 'Send request',
    onSubmit: async fd => {
      const d = { name: (fd.get('name') || '').trim(), phone: (fd.get('phone') || '').trim(), family: (fd.get('family') || '').trim(), kindred: (fd.get('kindred') || '').trim(), note: (fd.get('note') || '').trim() };
      if (d.name.split(/\s+/).length < 2 || d.name.length < 5) throw new Error('Enter your full name as it appears on the register.'); if (waNum(d.phone).length < 12) throw new Error('Enter a valid phone number so your admin can reach you.');
      if (vil.type !== 'association' && (d.family.length < 2 || d.kindred.length < 2)) throw new Error('Enter your family name and your kindred name.'); if (d.note.length < 5) throw new Error('Write a short message to your admin.');
      await submitAccessRequest(vid, d); closeModal(); toast('Request sent. Your admin will contact you after checking the register.', 'ok');
    } });
};
function matchScore(r, u) {
  const tok = s => String(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(x => x.length > 1), a = tok(r.name), b = tok(u.name);
  return a.filter(x => b.includes(x)).length * 2 + (waNum(r.phone) && waNum(r.phone) === waNum(u.phone) ? 5 : 0) + (r.family && u.family && r.family.toLowerCase().replace(/ family$/, '') === u.family.toLowerCase().replace(/ family$/, '') ? 1 : 0) + (r.kindred && u.kindred && r.kindred.toLowerCase().replace(/ kindred$/, '') === u.kindred.toLowerCase().replace(/ kindred$/, '') ? 1 : 0);
}
Object.assign(ACTIONS, {
  'req-check'(el) {
    requireAdmin(); const r = S.v.requests.find(x => x.id === el.dataset.id); if (!r) return;
    const members = S.v.users.filter(u => u.role === 'member').map(u => ({ u, s: matchScore(r, u) })).sort((a, b) => b.s - a.s || a.u.name.localeCompare(b.u.name)), top = members.filter(x => x.s > 0).slice(0, 4);
    openModal({ title: 'Check the register', size: 'modal-lg', sub: `Request from ${esc(r.name)}, ${esc(r.phone)}${r.family ? '. Says: ' + esc(r.family) + ', ' + esc(r.kindred) + ' kindred' : ''}. Confirm this person is on your register before you send anything.`,
      body: `<div class="sec-title" style="margin-top:14px">Closest names on the register</div>${table(['Member', ...(isVillageType() ? ['Family / Kindred'] : []), 'Phone', 'Why it matches'], top.map(x => [`${esc(x.u.name)}<small>${esc(x.u.id)}</small>`, ...(isVillageType() ? [esc(kinOf(x.u) || '-')] : []), esc(x.u.phone || '-'), waNum(r.phone) === waNum(x.u.phone) ? 'Same phone number' : 'Similar name']), ['No similar names found', 'If this person is not on the register, decline the request or add them from the Members page first.'])}
      <div class="field"><label for="rcM">Member on the register</label><select id="rcM" name="member" class="select">${opt('', 'Choose the matching member', '')}${members.map(x => opt(x.u.id, `${x.u.name} (${x.u.id})${kinOf(x.u) ? ', ' + kinOf(x.u) : ''}${x.u.active ? '' : ', deactivated'}`, '')).join('')}</select></div>
      <label class="check"><input type="checkbox" name="confirm"> <span>I have checked the village register and confirmed this person is a member.</span></label>`, submit: 'Issue login details',
      onSubmit: async fd => {
        const mid = fd.get('member'); if (!mid) throw new Error('Choose the member this request matches.'); if (!fd.get('confirm')) throw new Error('Tick the box to confirm you checked the register.');
        const u = userById(mid); if (!u || !u.active) throw new Error('That member account is not active. Edit the member first.');
        await API.resetPassword(mid, genPw()); API.resolveRequest(r.id, { status: 'issued', memberId: mid }); closeModal(); renderView(); credModal(mid, false, r.phone);
      } });
  },
  'req-decline'(el) {
    requireAdmin(); const r = S.v.requests.find(x => x.id === el.dataset.id); if (!r) return;
    openModal({ title: 'Decline this request', danger: true, sub: `${esc(r.name)}, ${esc(r.phone)}`, body: `<div class="field"><label for="rdR">Reason</label><select id="rdR" name="reason" class="select">${opt('', 'Choose a reason', '')}${['Name not found on the register', 'Details do not match our records', 'Duplicate request', 'Other'].map(x => opt(x, x, '')).join('')}</select></div>`, submit: 'Decline request',
      onSubmit: fd => { if (!fd.get('reason')) throw new Error('Choose a reason.'); API.resolveRequest(r.id, { status: 'declined', reason: fd.get('reason') }); done('Request declined.'); } });
  }
});
/* =========================================================
   ROUND 5: pay several levies at once, optional reference,
   pledges, plans overview for the owner
   ========================================================= */
const proofOf = t => t.proof || (t.proofFrom && (S.v.tx.find(x => x.id === t.proofFrom) || {}).proof) || null;
const getPledge = id => { const p = (S.v.pledges || []).find(x => x.id === id); if (!p) throw new Error('Pledge not found.'); return p; };
const pledgePaid = p => sum(S.v.tx.filter(t => t.pledgeId === p.id && t.status === 'verified'));
const pledgeWaiting = p => sum(S.v.tx.filter(t => t.pledgeId === p.id && t.status === 'pending'));
const pledgeBal = p => Math.max(0, p.amount - pledgePaid(p));
const pledgeState = p => p.status === 'cancelled' ? 'cancelled' : pledgePaid(p) >= p.amount ? 'paid' : pledgePaid(p) > 0 ? 'part' : 'open';
const pledgeBadge = p => ({ cancelled: '<span class="badge b-off">Cancelled</span>', paid: '<span class="badge b-verified">Fulfilled</span>', part: '<span class="badge b-pending">Part paid</span>', open: '<span class="badge b-pending">Not yet paid</span>' })[pledgeState(p)];
const livePledges = id => (S.v.pledges || []).filter(p => p.memberId === id && p.status !== 'cancelled');

Object.assign(API, {
  /* One slip, one upload, several levies and pledges. Each ticked item becomes its own record, so every levy stays separate in reports. */
  submitPayment(d) {
    if (S.owner || !S.u || S.u.id === 'SUPPORT') throw new Error('Only members and admins can upload their own proof.');
    requireWritable();
    if (!d.items || !d.items.length) throw new Error('Tick at least one levy this payment covers.');
    const batch = d.items.length > 1 ? nextId('batch', 'B') : '', made = [];
    d.items.forEach(it => {
      if (!(it.amount > 0)) throw new Error('Enter an amount for every ticked item.');
      let levy = it.levy, pledgeId = '';
      if (it.pledgeId) { const p = getPledge(it.pledgeId); if (p.memberId !== S.u.id || p.status === 'cancelled') throw new Error('That pledge is not available.'); levy = p.levy; pledgeId = p.id; }
      else if (!levies().some(l => l.id === levy)) throw new Error('One of the levies is no longer available.');
      const t = { id: nextId('tx', 'T'), memberId: S.u.id, levy, amount: it.amount, date: d.date, method: d.method, ref: d.ref || '', note: d.note || '', status: 'pending', proof: made.length ? null : d.proof, proofFrom: made.length ? made[0].id : '', batch, pledgeId, submittedAt: stamp(), submittedBy: S.u.name, updatedBy: null, updatedAt: null, history: [] };
      if (!batch) delete t.batch; if (!pledgeId) delete t.pledgeId; if (!t.proofFrom) delete t.proofFrom;
      S.v.tx.push(t); made.push(t);
    });
    commit(); return made;
  },
  addPledge(d) {
    requireAdmin(); const u = userById(d.memberId);
    if (!u || u.role !== 'member') throw new Error('Choose the member who made the pledge.');
    if (!(d.amount > 0)) throw new Error('Enter the pledged amount.'); if ((d.purpose || '').length < 3) throw new Error('Say what the pledge is for.');
    if (!levies().some(l => l.id === d.levy)) throw new Error('Choose the category the money will be recorded under.');
    const p = { id: nextId('pl', 'P'), memberId: u.id, amount: d.amount, levy: d.levy, purpose: d.purpose, date: d.date, due: d.due || '', note: d.note || '', status: 'open', createdBy: S.u.name, createdById: S.u.id, createdAt: stamp(), history: [] };
    S.v.pledges.push(p); log('Registered pledge', p.id, `${u.name} pledged ${money(p.amount)}: ${p.purpose}`); commit(); return p;
  },
  editPledge(id, d) {
    requireAdmin(); const p = getPledge(id); if (p.status === 'cancelled') throw new Error('A cancelled pledge cannot be edited.');
    if (!(d.amount > 0)) throw new Error('Enter the pledged amount.'); if (d.amount < pledgePaid(p)) throw new Error(`${money(pledgePaid(p))} is already paid, so the pledge cannot be less than that.`);
    if ((d.purpose || '').length < 3) throw new Error('Say what the pledge is for.');
    const ch = []; if (d.amount !== p.amount) ch.push(`amount ${money(p.amount)} to ${money(d.amount)}`); if (d.purpose !== p.purpose) ch.push('purpose'); if ((d.due || '') !== (p.due || '')) ch.push('due date');
    Object.assign(p, { amount: d.amount, purpose: d.purpose, due: d.due || '', note: d.note || '', date: d.date || p.date });
    p.history.push({ ts: stamp(), by: S.u.name, text: 'Edited: ' + (ch.join(', ') || 'details') });
    log('Edited pledge', p.id, `${nameOf(p.memberId)}: ${ch.join(', ') || 'details'}`); commit(); return p;
  },
  cancelPledge(id, reason) {
    requireAdmin(); const p = getPledge(id); p.status = 'cancelled'; p.cancelReason = reason; p.history.push({ ts: stamp(), by: S.u.name, text: 'Cancelled: ' + reason });
    log('Cancelled pledge', p.id, `${nameOf(p.memberId)}, ${money(p.amount)}: ${reason}`); commit(); return p;
  },
  payPledge(id, d) {
    requireAdmin(); const p = getPledge(id); if (p.status === 'cancelled') throw new Error('This pledge was cancelled.');
    if (!(d.amount > 0)) throw new Error('Enter the amount received.'); if (d.amount > pledgeBal(p)) throw new Error(`Only ${money(pledgeBal(p))} is still owed on this pledge.`);
    const t = API.addTx({ memberId: p.memberId, levy: p.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref || '', note: 'Pledge: ' + p.purpose, status: 'verified' });
    t.pledgeId = p.id; log('Recorded pledge payment', p.id, `${money(d.amount)} from ${nameOf(p.memberId)} towards ${p.purpose}`); commit(); return t;
  }
});

/* ----- Member: tick the levies this payment covers ----- */
function uploadBody(pre) {
  const yr = new Date().getFullYear(), owe = {}; owingRows(S.u.id, yr).forEach(r => { owe[r.L.id] = r; });
  const items = levies().map(L => ({ key: 'L:' + L.id, name: L.name, owe: L.fixed ? (owe[L.id] ? owe[L.id].owe : 0) : 0, need: L.fixed ? (S.v.settings.levies[L.id] || 0) : 0, fixed: L.fixed }))
    .concat(livePledges(S.u.id).filter(p => pledgeBal(p) > 0).map(p => ({ key: 'P:' + p.id, name: 'Pledge: ' + p.purpose, owe: pledgeBal(p), need: pledgeBal(p), fixed: true, pledge: true })));
  const first = pre || ((items.find(i => i.owe > 0) || {}).key || '');
  const rows = items.map(i => { const on = i.key === first, amt = i.owe > 0 ? i.owe : (i.fixed ? i.need : '');
    return `<label class="lv-row${on ? ' on' : ''}"><input type="checkbox" class="lv-pick" name="pick" value="${esc(i.key)}"${on ? ' checked' : ''}><span class="lv-name">${esc(i.name)}<small>${i.pledge ? 'Still to pay ' + money(i.owe) : !i.fixed ? 'Any amount you choose' : i.owe > 0 ? 'You owe ' + money(i.owe) : 'Paid up for this year'}</small></span><span class="lv-amt"><input class="input lv-in" type="number" min="1" step="1" inputmode="numeric" name="amt_${esc(i.key)}" value="${amt}" placeholder="0" aria-label="Amount for ${esc(i.name)}"${on ? '' : ' disabled'}></span></label>`; }).join('');
  return `<div class="field"><label>Tick what this payment covers</label><div class="lv-list">${rows}</div><div class="lv-total"><span>Total on your slip should be</span><b id="lvTotal">${money(0)}</b></div></div>
  <div class="form-row"><div class="field"><label for="uDate">Payment date</label><input id="uDate" name="date" class="input" type="date" max="${today()}" value="${today()}" required></div>
  <div class="field"><label for="uMethod">How did you pay?</label><select id="uMethod" name="method" class="select">${methodOpts('')}</select></div></div>
  <div class="field"><label for="uRef">Bank reference or teller number (optional)</label><input id="uRef" name="ref" class="input" type="text" placeholder="Leave empty if your slip has none" maxlength="60"></div>
  ${fileField('Proof of payment')}
  <div class="field"><label for="uNote">Note for the admin (optional)</label><textarea id="uNote" name="note" class="textarea" maxlength="300" placeholder="For example: paid on behalf of my brother"></textarea></div>`;
}
function lvUpdateTotal() { const f = $('#mForm'); if (!f || !$('#lvTotal')) return; let t = 0; $$('.lv-in', f).forEach(i => { if (!i.disabled) t += Number(i.value) || 0; }); $('#lvTotal').textContent = money(t); }
document.addEventListener('change', e => { const t = e.target; if (!t.matches || !t.matches('.lv-pick')) return; const row = t.closest('.lv-row'), inp = $('.lv-in', row); inp.disabled = !t.checked; row.classList.toggle('on', t.checked); if (t.checked && !(Number(inp.value) > 0)) inp.focus(); lvUpdateTotal(); });
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('.lv-in')) lvUpdateTotal(); });
function uploadModal(pre) {
  if (S.owner || !S.u || S.u.id === 'SUPPORT') return;
  openModal({ title: 'Send proof of payment', sub: 'Pay first, then upload the slip. Tick every levy it covers so you can pay them all at once. Your admin checks it against the bank statement.', body: uploadBody(pre), size: 'modal-lg', submit: 'Send for verification',
    onSubmit: async fd => {
      const picks = fd.getAll('pick'), date = fd.get('date'), ref = (fd.get('ref') || '').trim(), file = fd.get('proof');
      if (!picks.length) throw new Error('Tick at least one levy this payment covers.');
      const items = picks.map(k => { const amount = Number(fd.get('amt_' + k)); if (!(amount > 0)) throw new Error('Enter an amount for every ticked item.'); return k.startsWith('P:') ? { pledgeId: k.slice(2), amount } : { levy: k.slice(2), amount }; });
      if (!date || date > today()) throw new Error('Choose the date you paid. It cannot be in the future.');
      if (!file || !file.size) throw new Error('Attach a photo or PDF of your proof of payment.');
      const proof = await readProof(file);
      const made = API.submitPayment({ items, date, method: fd.get('method'), ref, note: (fd.get('note') || '').trim(), proof });
      done(made.length > 1 ? `Proof sent for ${made.length} levies. Your admin will verify it soon.` : 'Proof sent. Your admin will verify it soon.');
    }, });
  lvUpdateTotal();
}

/* ----- Admin: verify or reject a payment that covers several levies together ----- */
const _verifyTx = ACTIONS['verify-tx'], _rejectTx = ACTIONS['reject-tx'];
const batchPending = t => t.batch ? S.v.tx.filter(x => x.batch === t.batch && x.status === 'pending') : [t];
Object.assign(ACTIONS, {
  'upload-proof'(el) { uploadModal(el && el.dataset ? el.dataset.pre : ''); },
  'verify-tx'(el) {
    const t = getTx(el.dataset.id); if (t.memberId === S.u.id) return toast('You cannot verify your own payment. Another admin must verify it.', 'err'); const sib = batchPending(t); if (sib.length < 2) return _verifyTx(el);
    const rows = sib.map(x => `<tr><td><label class="check"><input type="checkbox" name="inc" value="${esc(x.id)}" checked> ${esc(levyOf(x.levy).name)}${x.pledgeId ? ' (pledge)' : ''}</label></td><td class="num"><input class="input" type="number" min="1" name="amt_${esc(x.id)}" value="${x.amount}" style="max-width:140px"></td></tr>`).join('');
    openModal({ title: 'Verify payment', size: 'modal-lg', sub: `${esc(nameOf(t.memberId))} paid ${sib.length} levies with one slip on ${esc(fmtDate(t.date))} by ${esc(t.method)}. Reference: ${esc(t.ref || 'none')}.`,
      body: `<div class="form-row" style="margin-top:14px"><div>${proofHTML(proofOf(sib.find(x => proofOf(x)) || t))}</div><div><table class="t"><thead><tr><th>Tick the items you confirm</th><th class="num">Amount in the bank</th></tr></thead><tbody>${rows}</tbody></table><span class="hint">Total on the slip: ${money(sum(sib))}. Untick anything you cannot find in the bank statement; it stays waiting.</span><div class="field"><label for="vNote">Note (optional)</label><textarea id="vNote" name="note" class="textarea" maxlength="300"></textarea></div></div></div>`,
      submit: 'Verify ticked items', onSubmit: fd => { const ids = fd.getAll('inc'); if (!ids.length) throw new Error('Tick at least one item to verify.'); const jobs = ids.map(id => ({ id, a: Number(fd.get('amt_' + id)) })); if (jobs.some(j => !(j.a > 0))) throw new Error('Enter a confirmed amount for every ticked item.'); jobs.forEach(j => API.verify(j.id, j.a, (fd.get('note') || '').trim())); done(`${jobs.length} items verified and the ledger updated.`); } });
  },
  'reject-tx'(el) {
    const t = getTx(el.dataset.id); if (t.memberId === S.u.id) return toast('You cannot reject your own payment. Another admin must review it.', 'err'); const sib = batchPending(t); if (sib.length < 2) return _rejectTx(el);
    openModal({ title: 'Reject payment', danger: true, sub: `${esc(nameOf(t.memberId))} paid ${sib.length} levies with one slip (${money(sum(sib))}). All ${sib.length} items will be rejected together and the member sees your reason.`,
      body: `<div class="field"><label for="rjR">Reason</label><select id="rjR" name="reason" class="select" required>${opt('', 'Choose a reason', '')}${REJECT_REASONS.map(r => opt(r, r, '')).join('')}</select></div>`, submit: 'Reject all items',
      onSubmit: fd => { if (!fd.get('reason')) throw new Error('Choose a reason so the member knows what to fix.'); sib.forEach(x => API.reject(x.id, fd.get('reason'))); done('Payment rejected.'); } });
  }
});

/* ----- Pledges ----- */
function pledgeForm(p) {
  const lv = levies(), def = p.levy || (lv.find(l => !l.fixed) || lv[0]).id;
  return `<div class="field"><label for="plM">Member</label><select id="plM" name="memberId" class="select" required${p.id ? ' disabled' : ''}>${memberOpts(p.memberId, 'Choose a member', true)}</select></div>
  <div class="field"><label for="plP">What is the pledge for?</label><input id="plP" name="purpose" class="input" maxlength="80" placeholder="For example: Town hall roofing" value="${esc(p.purpose || '')}" required></div>
  <div class="form-row"><div class="field"><label for="plA">Amount pledged (naira)</label><input id="plA" name="amount" class="input" type="number" min="1" step="1" value="${p.amount || ''}" required></div>
  <div class="field"><label for="plL">Record the money under</label><select id="plL" name="levy" class="select"${p.id ? ' disabled' : ''}>${lv.map(l => opt(l.id, l.name, def)).join('')}</select></div></div>
  <div class="form-row"><div class="field"><label for="plD">Date pledged</label><input id="plD" name="date" class="input" type="date" max="${today()}" value="${esc(p.date || today())}" required></div>
  <div class="field"><label for="plU">Promised by (optional)</label><input id="plU" name="due" class="input" type="date" value="${esc(p.due || '')}"></div></div>
  <div class="field"><label for="plN">Note (optional)</label><textarea id="plN" name="note" class="textarea" maxlength="300" placeholder="Where and when it was promised">${esc(p.note || '')}</textarea></div>`;
}
const readPledge = fd => ({ memberId: fd.get('memberId'), purpose: (fd.get('purpose') || '').trim(), amount: Number(fd.get('amount')), levy: fd.get('levy'), date: fd.get('date'), due: fd.get('due') || '', note: (fd.get('note') || '').trim() });
function pledgeDetail(id) {
  const p = getPledge(id), txs = S.v.tx.filter(t => t.pledgeId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const admin = isAdmin();
  infoModal('Pledge: ' + p.purpose, `${esc(nameOf(p.memberId))}, ${esc(p.memberId)}`,
    `<div class="kpis kpis-3" style="margin-top:14px">${kpi('Pledged', money(p.amount), fmtDate(p.date))}${kpi('Paid', money(pledgePaid(p)), pledgeWaiting(p) ? money(pledgeWaiting(p)) + ' waiting for verification' : '', 'good')}${kpi('Balance', money(pledgeBal(p)), p.due ? 'Promised by ' + fmtDate(p.due) : '', pledgeBal(p) ? 'bad' : '')}</div>
    <dl class="kv"><dt>Status</dt><dd>${pledgeBadge(p)}</dd><dt>Recorded under</dt><dd>${esc(levyOf(p.levy).name)}</dd><dt>Registered by</dt><dd>${esc(p.createdBy)}, ${esc(fmtTS(p.createdAt))}</dd>${p.note ? `<dt>Note</dt><dd>${esc(p.note)}</dd>` : ''}${p.cancelReason ? `<dt>Cancelled because</dt><dd>${esc(p.cancelReason)}</dd>` : ''}</dl>
    ${admin && p.status !== 'cancelled' ? `<div class="btn-row">${pledgeBal(p) ? `<button class="btn btn-primary btn-sm" type="button" data-act="pay-pledge" data-id="${esc(p.id)}">Record a payment</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="edit-pledge" data-id="${esc(p.id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="cancel-pledge" data-id="${esc(p.id)}">Cancel pledge</button></div>` : ''}
    ${!admin && pledgeBal(p) && p.status !== 'cancelled' ? `<div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof" data-pre="P:${esc(p.id)}">Pay towards this pledge</button></div>` : ''}
    <div class="sec-title">Payments towards it</div>${table(['Date', 'Amount', 'Status'], txs.map(t => [esc(fmtDate(t.date)), money(t.amount), badge(t.status)]), ['No payments yet', 'Payments made towards this pledge will show here.'])}`);
}
function pledgeSection(id) {
  const list = livePledges(id); if (!list.length) return '';
  return `<div class="sec-title">Pledges</div>${table(['Pledge', { t: 'Pledged', num: true }, { t: 'Paid', num: true }, { t: 'Balance', num: true }, 'Status'], list.map(p => [linkBtn('view-pledge', p.id, p.purpose), money(p.amount), money(pledgePaid(p)), money(pledgeBal(p)), pledgeBadge(p)]), ['', ''])}`;
}
function pledgePanel() {
  const list = livePledges(S.u.id); if (!list.length) return '';
  const left = sum(list.map(p => ({ amount: pledgeBal(p) })));
  return `<section class="panel" id="pledges"><div class="panel-h"><div><h2>My pledges</h2><p>Promises you made to the village, registered by your admin. ${left ? 'You still owe ' + money(left) + '.' : 'All fulfilled. Thank you.'}</p></div></div>
  ${table(['Pledge', 'Date', { t: 'Pledged', num: true }, { t: 'Paid', num: true }, { t: 'Balance', num: true }, 'Status', ''], list.map(p => [linkBtn('view-pledge', p.id, p.purpose) + `<small>Registered by ${esc(p.createdBy)}</small>`, esc(fmtDate(p.date)), money(p.amount), money(pledgePaid(p)), money(pledgeBal(p)), pledgeBadge(p), pledgeBal(p) ? `<button class="btn btn-primary btn-sm" type="button" data-act="upload-proof" data-pre="P:${esc(p.id)}">Pay</button>` : '']), ['', ''])}</section>`;
}
ADMIN.pledges = function () {
  const f = S.f, all = S.v.pledges || [], live = all.filter(p => p.status !== 'cancelled'), st = f.pst || '';
  const list = all.filter(p => !st || pledgeState(p) === st).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), page = paginate(list, f);
  const pledged = sum(live), got = live.reduce((a, p) => a + Math.min(p.amount, pledgePaid(p)), 0);
  return `<div class="kpis kpis-3">${kpi('Pledged', money(pledged), `${live.length} pledges`)}${kpi('Received', money(got), 'Verified payments', 'good')}${kpi('Still to receive', money(Math.max(0, pledged - got)), 'Follow up with members', pledged - got > 0 ? 'bad' : '')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Member pledges</h2><p>Register what a member promises. It shows on their dashboard, and payments update it after you verify them.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-pledge">Register a pledge</button></div>
  <div class="toolbar"><div class="field"><label for="plS">Show</label><select id="plS" class="select" data-filter="pst">${opt('', 'All pledges', st)}${opt('open', 'Not yet paid', st)}${opt('part', 'Part paid', st)}${opt('paid', 'Fulfilled', st)}${opt('cancelled', 'Cancelled', st)}</select></div></div>
  ${table(['Member', 'Pledge', 'Date', { t: 'Pledged', num: true }, { t: 'Paid', num: true }, { t: 'Balance', num: true }, 'Status', ''], page.map(p => [`${linkBtn('member-profile', p.memberId, nameOf(p.memberId))}<small>${esc(p.memberId)}</small>`, `${linkBtn('view-pledge', p.id, p.purpose)}<small>${esc(levyOf(p.levy).name)}</small>`, esc(fmtDate(p.date)), money(p.amount), money(pledgePaid(p)), money(pledgeBal(p)), pledgeBadge(p), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-pledge" data-id="${esc(p.id)}">Open</button>${p.status !== 'cancelled' && pledgeBal(p) ? `<button class="btn btn-leaf btn-sm" type="button" data-act="pay-pledge" data-id="${esc(p.id)}">Record payment</button>` : ''}</div>`]), ['No pledges yet', 'When a member promises money, register it here so it shows on their dashboard.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
};
VIEWS.admin.pledges = ADMIN.pledges;
Object.assign(ACTIONS, {
  'add-pledge'() { requireAdmin(); openModal({ title: 'Register a pledge', sub: 'The member will see it on their dashboard. Your name and the time are saved.', body: pledgeForm({}), submit: 'Save pledge', onSubmit: fd => { const d = readPledge(fd); if (!d.date) throw new Error('Choose the date pledged.'); const p = API.addPledge(d); done(`Pledge ${p.id} registered.`); } }); },
  'edit-pledge'(el) { requireAdmin(); const p = getPledge(el.dataset.id); openModal({ title: 'Edit pledge', sub: `${esc(nameOf(p.memberId))}. Every change is logged under your name.`, body: pledgeForm(p), submit: 'Save changes', onSubmit: fd => { const d = readPledge(fd); API.editPledge(p.id, d); done('Pledge updated.'); } }); },
  'cancel-pledge'(el) { requireAdmin(); const p = getPledge(el.dataset.id); openModal({ title: 'Cancel this pledge?', danger: true, sub: `${esc(nameOf(p.memberId))}, ${money(p.amount)}. Payments already received stay in the records.`, body: `<div class="field"><label for="cpR">Reason</label><textarea id="cpR" name="reason" class="textarea" maxlength="200" required></textarea></div>`, submit: 'Cancel pledge', onSubmit: fd => { const r = (fd.get('reason') || '').trim(); if (r.length < 3) throw new Error('Give a short reason.'); API.cancelPledge(p.id, r); done('Pledge cancelled.'); } }); },
  'pay-pledge'(el) {
    requireAdmin(); const p = getPledge(el.dataset.id);
    openModal({ title: 'Record a pledge payment', sub: `${esc(nameOf(p.memberId))} owes ${money(pledgeBal(p))} on "${esc(p.purpose)}". It is saved as verified and counts in the reports.`,
      body: `<div class="form-row"><div class="field"><label for="ppA">Amount received (naira)</label><input id="ppA" name="amount" class="input" type="number" min="1" max="${pledgeBal(p)}" value="${pledgeBal(p)}" required></div><div class="field"><label for="ppD">Date received</label><input id="ppD" name="date" class="input" type="date" max="${today()}" value="${today()}" required></div></div>
      <div class="form-row"><div class="field"><label for="ppM">Method</label><select id="ppM" name="method" class="select">${methodOpts('')}</select></div><div class="field"><label for="ppR">Reference (optional)</label><input id="ppR" name="ref" class="input" maxlength="60"></div></div>`,
      submit: 'Save payment', onSubmit: fd => { API.payPledge(p.id, { amount: Number(fd.get('amount')), date: fd.get('date'), method: fd.get('method'), ref: (fd.get('ref') || '').trim() }); done('Payment recorded against the pledge.'); } });
  },
  'view-pledge'(el) { pledgeDetail(el.dataset.id); }
});

/* ----- Owner: which plan every village runs on ----- */
function plansPanel(rows) {
  const by = p => rows.filter(r => (r.v.plan || 'basic') === p && !r.vil.removed);
  const col = (p, label, note) => { const l = by(p); return `<div class="plan-col"><div class="plan-h">${planBadge({ plan: p })}<b>${l.length}</b> ${l.length === 1 ? 'village' : 'villages'}</div><p class="hint">${note}</p><div class="chips">${l.length ? l.map(r => `<button type="button" class="chip" data-act="owner-manage" data-id="${esc(r.vil.id)}">${esc(r.v.name)}</button>`).join('') : '<span class="hint">None</span>'}</div></div>`; };
  return `<section class="panel"><div class="panel-h"><div><h2>Plans in use</h2><p>Which package each village or association runs on. Click a name to change its plan.</p></div></div><div class="plan-cols">${col('premium', 'Premium', 'Receipts carry the village name and logo.')}${col('basic', 'Basic', 'Standard receipts.')}</div></section>`;
}
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
    lead ? `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="assign-duty" data-id="${esc(u.id)}">Change duty</button>${u.lead ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="remove-admin" data-id="${esc(u.id)}">Remove</button>`}</div>` : '']), ['No admins', ''])}</section>`;
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
  const f = S.f, vid = VILLAGES.some(x => x.id === f.village) ? f.village : VILLAGES[0].id, v = DB.cache[vid], admins = OADM(v), lead = admins.find(u => u.lead), roles = getRoles();
  const held = r => Object.values(DB.cache).reduce((a, x) => a + x.users.filter(u => u.role === 'admin' && u.title === r).length, 0);
  return `<section class="panel"><div class="panel-h"><div><h2>Admins of a village</h2><p>Create, appoint and remove admins in any village or association. Each role can be held by one person per village.</p></div><div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="o-appoint" data-id="${esc(vid)}">Appoint a member</button><button class="btn btn-primary btn-sm" type="button" data-act="o-add-admin" data-id="${esc(vid)}">Add new admin</button></div></div>
    <div class="toolbar"><div class="field"><label for="oaV">Village or association</label><select id="oaV" class="select" data-filter="village">${VILLAGES.filter(x => !x.removed).map(x => opt(x.id, `${x.name} (${x.code})`, vid)).join('')}</select></div></div>
    <div class="callout${lead ? ' ok' : ''}"><div><b>Lead Admin: ${lead ? esc(lead.name) + ' (' + esc(lead.id) + ')' : 'none assigned'}</b><p>The Lead Admin appoints admins and assigns their duties inside the village. Only you can change who it is.</p></div><div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="o-lead" data-v="${esc(vid)}">${lead ? 'Change Lead Admin' : 'Assign Lead Admin'}</button>${lead ? `<button class="btn btn-ghost btn-sm" type="button" data-act="o-unlead" data-v="${esc(vid)}">Remove Lead Admin</button>` : ''}</div></div>
    ${table(['Admin', 'Role', 'Phone', 'Account', ''], admins.map(a => [`${esc(a.name)}<small>${esc(a.id)}${a.lead ? ' · Lead Admin' : ''}</small>`, esc(a.title || '-'), esc(a.phone || '-'), a.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>', `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="o-edit-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="o-reset-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Reset password</button>${a.lead ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="o-lead" data-v="${esc(vid)}" data-id="${esc(a.id)}">Make Lead</button>`}<button class="btn btn-ghost btn-sm" type="button" data-act="o-remove-admin" data-v="${esc(vid)}" data-id="${esc(a.id)}">Remove</button></div>`]), ['This village has no admins', 'Add one so the village can verify payments.'])}</section>
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
      onSubmit: async fd => { const r = await OWNER_API.addVillage({ name: fd.get('name'), code: fd.get('code'), type: fd.get('type'), plan: fd.get('plan'), leadName: fd.get('leadName'), phone: fd.get('phone'), password: fd.get('password') }); fillVillageSelects(); done(`Added. The Lead Admin signs in with ${r.uid}.`); } });
  },
  'o-delete-village'(el) {
    const vil = VILLAGES.find(x => x.id === el.dataset.id);
    openModal({ title: 'Delete this village for good?', danger: true, sub: `Everything in ${esc(vil.name)} is erased and cannot be restored. Type its name to confirm.`, body: `<div class="field"><label for="dvN">Village name</label><input id="dvN" name="name" class="input" autocomplete="off" required></div>`, submit: 'Delete for good',
      onSubmit: fd => { if ((fd.get('name') || '').trim().toLowerCase() !== vil.name.toLowerCase()) throw new Error('Type the village name exactly to confirm.'); OWNER_API.deleteVillage(vil.id); fillVillageSelects(); done('Village deleted.'); } });
  }
});
/* =========================================================
   ROUND 8: membership strip, Basic plan member limit
   ========================================================= */
function membershipStrip() {
  const u = S.u, yrs = Math.floor((Date.now() - new Date(u.joined).getTime()) / (365.25 * 864e5));
  return `<div class="member-strip"><div><small>Member since</small><b>${esc(fmtDate(u.joined))}</b></div><div><small>Your ID</small><b class="mono">${esc(u.id)}</b></div>${isVillageType() && kinOf(u) ? `<div><small>Family and kindred</small><b>${esc(kinOf(u))}</b></div>` : ''}<div><small>Time with us</small><b>${yrs >= 1 ? yrs + (yrs === 1 ? ' year' : ' years') : 'Under a year'}</b></div></div>`;
}
const premiumBadge = '<span class="badge b-admin">Premium</span>';
function capNotice() {
  if (S.v.plan === 'premium') return '';
  const n = activeMembers(), left = MEMBER_CAP - n;
  if (n >= MEMBER_CAP) return `<div class="callout upgrade"><div><b>${premiumBadge} You have reached the Basic plan limit of ${MEMBER_CAP} members</b><p>${n} active members. Upgrade to Premium to add more members, and to get the letterhead receipts, village profile on every document and one-click WhatsApp broadcast.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="upgrade-info">How to upgrade</button></div>`;
  if (left <= 3) return `<div class="callout upgrade"><div><b>${premiumBadge} ${left} member place${left === 1 ? '' : 's'} left on the Basic plan</b><p>Basic covers up to ${MEMBER_CAP} members. Upgrade to Premium before you reach the limit.</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="upgrade-info">How to upgrade</button></div>`;
  return '';
}
function upgradeModal() {
  infoModal('Upgrade to Premium', 'Your Basic plan is full', `<div class="upgrade-box"><div class="up-badge">${premiumBadge}</div><p>The Basic plan covers up to <b>${MEMBER_CAP} members</b> and you have ${activeMembers()}. Premium removes the limit and adds:</p>
  <ul class="ticks"><li>No member limit</li><li>Professional letterhead receipts with the Chairman and Financial Secretary signatures</li><li>Your village name, code and logo on every document</li><li>One-click WhatsApp broadcast to members who owe</li><li>No VillageVault watermark on documents</li></ul><p class="hint">Ask VillageVault support to move your village or association to Premium. Your records stay exactly as they are.</p></div>`);
}
Object.assign(ACTIONS, { 'upgrade-info'() { upgradeModal(); } });
/* =========================================================
   ROUND 8B: automatic receipts, premium letterhead, watermark,
   signatories, WhatsApp broadcast, achievements, hall of fame,
   rate us
   ========================================================= */
const holderOf = title => S.v.users.find(u => u.role === 'admin' && u.title === title && u.active) || null;
function readFitImage(file, W, H) {
  return new Promise(async (res, rej) => {
    try {
      if (!file || !file.size) return res(null);
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Upload a PNG, JPG or WEBP image.');
      const img = await loadImg(await fileToDataURL(file)), c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      const k = Math.min(W / img.width, H / img.height), w = img.width * k, h = img.height * k; g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      res(c.toDataURL('image/jpeg', .9));
    } catch (e) { rej(e); }
  });
}
async function toJpeg(dataUrl, size) {
  const img = await loadImg(dataUrl), c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  const k = Math.min(size / img.width, size / img.height), w = img.width * k, h = img.height * k; g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h); return c.toDataURL('image/jpeg', .9);
}

/* ---------- API ---------- */
const _verifyApi = API.verify;
Object.assign(API, {
  verify(id, amount, note) {
    const t = _verifyApi.call(API, id, amount, note);
    try { API.issueReceipt(id); t.receiptSentAt = stamp(); t.receiptSeen = false; commit(); } catch (_) {}
    (S.justVerified = S.justVerified || []).push(id); return t;
  },
  saveSignatory(adminId, d) {
    requireAdmin(); requireWritable(); const u = userById(adminId);
    if (!u || u.role !== 'admin' || !['Chairman', 'Financial Secretary'].includes(u.title)) throw new Error('Only the Chairman and the Financial Secretary sign receipts.');
    if (!(S.u.id === adminId || isLeadAdmin())) throw new Error('Only that admin or the Lead Admin can change this.');
    const ph = (d.phone || '').trim(); if (ph && !/^[0-9+\s-]{10,16}$/.test(ph)) throw new Error('Enter a valid phone number.');
    const ch = []; if (ph !== (u.phone || '')) { ch.push('Phone updated'); u.phone = ph; }
    if (d.signature) { ch.push('Signature uploaded'); u.signature = d.signature; } else if (d.remove && u.signature) { ch.push('Signature removed'); delete u.signature; }
    if (!ch.length) throw new Error('Nothing was changed.');
    log('Updated letterhead signatory', u.id, `${u.name} (${u.title}): ${ch.join('; ')}`); commit();
  },
  logBroadcast(n) {
    if (!isChairman()) throw new Error('Only the Chairman can send a broadcast.'); if (S.v.plan !== 'premium') throw new Error('WhatsApp broadcast is part of the Premium plan.');
    log('Sent WhatsApp broadcast', 'Outstanding bills', `Reminder opened for ${n} member${n === 1 ? '' : 's'} who owe`); commit();
  }
});
const receiptTx = id => {
  if (isAdmin()) return API.issueReceipt(id);
  const t = getTx(id); if (t.memberId !== S.u.id || !t.receiptNo || t.status !== 'verified') throw new Error('That receipt is not available.');
  if (!t.receiptSeen) { t.receiptSeen = true; commit(); } return t;
};
function receiptDataX(t) {
  const r = receiptData(t), vu = userById(t.verifiedById) || {}, ch = holderOf('Chairman'), fs = holderOf('Financial Secretary'), L = S.v.letter || {};
  return Object.assign(r, { code: S.v.code, address: L.address || '', motto: L.motto || '', verifiedTitle: vu.title || '', chair: ch ? { name: ch.name, phone: ch.phone || '', sig: ch.signature || null } : null, fin: fs ? { name: fs.name, phone: fs.phone || '', sig: fs.signature || null } : null,
    sponsors: sponsorsFor(S.v.id).filter(Boolean).map(s => ({ name: s.shop_name, logo: s.logo })) });
}
async function prepReceipt(r) {
  r.sponsorImgs = []; for (const s of r.sponsors || []) { try { r.sponsorImgs.push({ name: s.name, jpg: await toJpeg(s.logo, 120) }); } catch (_) {} }
}

/* ---------- Premium letterhead layout, shared by the PDF and the PNG ---------- */
function wrapLines(A, s, maxW, size) { const words = String(s).split(/\s+/), lines = []; let cur = ''; words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (A.width(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return lines; }
function drawLetterhead(A, r) {
  const W = A.W, H = A.H, M = 48, CW = W - 2 * M, NAVY = '#1A1A4E', GOLD = '#C9962B', GOLD2 = '#F5B83D', INK = '#14142B', MUT = '#5B5F7A', LINE = '#E2E2EE';
  A.strokeRect(16, 16, W - 32, H - 32, GOLD, 1.6); A.strokeRect(21, 21, W - 42, H - 42, NAVY, .5);
  A.rect(21, 21, W - 42, 116, NAVY); A.rect(21, 137, W - 42, 4, GOLD2);
  A.rect(M, 42, 72, 72, '#FFFFFF');
  if (r.logo) A.img(r.logo, M + 4, 46, 64, 64, 200, 200); else { A.rect(M + 4, 46, 64, 64, GOLD2); A.text(r.code, M + 36, 86, { size: 18, bold: true, color: NAVY, align: 'center' }); }
  const nx = M + 90, nw = CW - 90 - 150;
  A.text(A.fit(r.village, nw, 22, true), nx, 72, { size: 22, bold: true, color: '#FFFFFF' });
  if (r.motto) A.text(A.fit(r.motto, nw, 9.5), nx, 90, { size: 9.5, color: GOLD2 });
  if (r.address) A.text(A.fit(r.address, nw, 8.5), nx, 106, { size: 8.5, color: '#DADCF5' });
  A.text('OFFICIAL RECEIPT', W - M, 62, { size: 9.5, bold: true, color: GOLD2, align: 'right' });
  A.text(r.no, W - M, 82, { size: 13, bold: true, color: '#FFFFFF', align: 'right' });
  A.text('Issued ' + fmtDate(r.issuedAt.slice(0, 10)), W - M, 100, { size: 8.5, color: '#DADCF5', align: 'right' });
  let y = 178;
  A.text('RECEIPT OF PAYMENT', M, y, { size: 9, bold: true, color: GOLD });
  y += 22; A.text('Thank you, ' + r.member.split(' ')[0], M, y, { size: 20, bold: true, color: NAVY });
  y += 22;
  wrapLines(A, `This is to acknowledge, with thanks, the receipt of the sum of ${pm(r.amount)} (${nairaWords(r.amount)}) from ${r.member} (${r.memberId}), being payment for ${r.levy}, received on ${fmtDate(r.date)} by ${r.method}.`, CW, 10.5).forEach(l => { A.text(l, M, y, { size: 10.5, color: INK }); y += 15; });
  y += 8; A.rect(M, y, CW, 82, '#FBF5E4'); A.strokeRect(M, y, CW, 82, GOLD, .9);
  A.text('AMOUNT RECEIVED', M + 16, y + 22, { size: 8, bold: true, color: MUT }); A.text(pm(r.amount), M + 16, y + 56, { size: 30, bold: true, color: NAVY });
  A.strokeRect(W - M - 124, y + 18, 108, 46, '#12806A', 1.8); A.text('VERIFIED', W - M - 70, y + 48, { size: 16, bold: true, color: '#12806A', align: 'center' });
  y += 106;
  const cells = [['Payment for', r.levy], ['Payment date', fmtDate(r.date)], ['Payment method', r.method], ['Bank reference', r.ref && r.ref !== '-' ? r.ref : 'None given'], ['Verified by', `${r.verifiedBy}${r.verifiedTitle ? ', ' + r.verifiedTitle : ''}`], ['Verified on', fmtTS(r.verifiedAt)]];
  const cw = (CW - 20) / 2; cells.forEach((c, i) => { const cx = M + (i % 2) * (cw + 20), cy = y + Math.floor(i / 2) * 40; A.text(c[0], cx, cy, { size: 7.5, color: MUT }); A.text(A.fit(c[1], cw, 11, true), cx, cy + 15, { size: 11, bold: true, color: INK }); A.line(cx, cy + 24, cx + cw, cy + 24, LINE, .8); });
  y += 3 * 40 + 6;
  wrapLines(A, `Verified by ${r.verifiedBy}${r.verifiedTitle ? ' (' + r.verifiedTitle + ')' : ''} against the ${r.village} account and issued automatically. Keep this receipt for your records.`, CW, 8.5).forEach(l => { A.text(l, M, y, { size: 8.5, color: MUT }); y += 12; });
  // signatures
  const sy = H - 250; A.line(M, sy - 14, W - M, sy - 14, GOLD, .9);
  [[r.chair, 'Chairman', M], [r.fin, 'Financial Secretary', W - M - 200]].forEach(([p, role, x]) => {
    if (p && p.sig) A.img(p.sig, x, sy, 125, 50, 300, 120);
    A.line(x, sy + 56, x + 200, sy + 56, NAVY, .9);
    A.text(A.fit(p ? p.name : role, 200, 10.5, true), x, sy + 71, { size: 10.5, bold: true, color: INK }); A.text(role, x, sy + 84, { size: 8.5, color: MUT });
    A.text(p && p.phone ? 'Tel: ' + p.phone : 'Tel: not added', x, sy + 97, { size: 8.5, color: INK });
  });
  // sponsors
  const sp = r.sponsorImgs || [], by = H - 118; A.line(M, by - 12, W - M, by - 12, LINE, .8);
  A.text('PROUDLY SUPPORTED BY OUR COMMUNITY SPONSORS', W / 2, by + 2, { size: 7, bold: true, color: MUT, align: 'center' });
  const slot = 120, sx0 = W / 2 - (sp.length * slot) / 2; sp.forEach((s, i) => { const cx = sx0 + i * slot + slot / 2; A.img(s.jpg, cx - 17, by + 10, 34, 34, 120, 120); A.text(A.fit(s.name, slot - 8, 7), cx, by + 56, { size: 7, color: INK, align: 'center' }); });
  if (!sp.length) A.text('Sponsor slots are open. Ask your admin.', W / 2, by + 30, { size: 8, color: MUT, align: 'center' });
  A.text(`${r.village} (${r.code})  |  Valid when it appears in the village records`, W / 2, H - 34, { size: 7, color: MUT, align: 'center' });
}
const pdfAdapter = pdf => ({ W: pdf.W, H: pdf.H, text: (s, x, y, o) => pdf.text(s, x, y, o), rect: (x, y, w, h, f) => pdf.rect(x, y, w, h, f), line: (a, b, c, d, col, lw) => pdf.line(a, b, c, d, col, lw),
  strokeRect(x, y, w, h, col, lw) { pdf.line(x, y, x + w, y, col, lw); pdf.line(x + w, y, x + w, y + h, col, lw); pdf.line(x + w, y + h, x, y + h, col, lw); pdf.line(x, y + h, x, y, col, lw); },
  img: (u, x, y, w, h, sw, sh) => pdf.img(u, x, y, w, h, sw, sh), width: (s, sz, b) => pdf.w(s, sz, b), fit: (s, m, sz, b) => pdf.fit(s, m, sz, b) });
function canvasAdapter(g, k, W, H, imgs) {
  const F = (b, s) => `${b ? 800 : 500} ${s * k}px Figtree, "Segoe UI", Arial, "DejaVu Sans", sans-serif`;
  return { W, H, text(s, x, y, o) { o = o || {}; g.font = F(o.bold, o.size || 10); g.fillStyle = o.color || '#14142B'; g.textAlign = o.align || 'left'; g.textBaseline = 'alphabetic'; g.fillText(String(s), x * k, y * k); },
    rect(x, y, w, h, f) { g.fillStyle = f; g.fillRect(x * k, y * k, w * k, h * k); },
    line(a, b, c, d, col, lw) { g.strokeStyle = col || '#DCE3E0'; g.lineWidth = (lw || .6) * k; g.beginPath(); g.moveTo(a * k, b * k); g.lineTo(c * k, d * k); g.stroke(); },
    strokeRect(x, y, w, h, col, lw) { g.strokeStyle = col; g.lineWidth = lw * k; g.strokeRect(x * k, y * k, w * k, h * k); },
    img(u, x, y, w, h) { const im = imgs[u]; if (im) g.drawImage(im, x * k, y * k, w * k, h * k); },
    width(s, sz, b) { g.font = F(b, sz); return g.measureText(String(s)).width / k; },
    fit(s, m, sz, b) { s = String(s); while (s.length > 2 && this.width(s, sz, b) > m) s = s.slice(0, -2); return s; } };
}
async function receiptPngPremium(r) {
  await prepReceipt(r);
  const urls = [r.logo, r.chair && r.chair.sig, r.fin && r.fin.sig].concat((r.sponsorImgs || []).map(s => s.jpg)).filter(Boolean), imgs = {};
  for (const u of urls) { try { imgs[u] = await loadImg(u); } catch (_) {} }
  const PW = 595.28, PH = 841.89, k = 1240 / PW, c = document.createElement('canvas'); c.width = 1240; c.height = Math.round(PH * k); const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
  drawLetterhead(canvasAdapter(g, k, PW, PH, imgs), r);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Could not create the image.')), 'image/png'));
}
const receiptPng = r => r.premium ? receiptPngPremium(r) : receiptPngBasic(r);
async function receiptPdfAsync(r) {
  if (!r.premium) return receiptPdfBasic(r);
  await prepReceipt(r); const pdf = new PDF(); drawLetterhead(pdfAdapter(pdf), r); return pdf.build(`Receipt ${r.no}`);
}

/* ---------- Actions: receipts, verified popup ---------- */
Object.assign(ACTIONS, {
  'receipt-dl'(el) {
    let t; try { t = receiptTx(el.dataset.id); } catch (e) { return toast(e.message, 'err'); }
    const r = receiptDataX(t), name = `${r.no}.${el.dataset.fmt}`;
    (el.dataset.fmt === 'pdf' ? receiptPdfAsync(r).then(b => { download(name, b); toast('Receipt PDF downloaded.', 'ok'); }) : receiptPng(r).then(b => { download(name, b); toast('Receipt PNG downloaded.', 'ok'); })).catch(ex => toast(ex.message || 'Could not create the receipt.', 'err'));
  },
  'receipt'(el) { receiptModal(el.dataset.id).catch(ex => toast(ex.message || 'Could not create the receipt.', 'err')); }
});
function verifiedModal(ids) {
  const ts = ids.map(getTx), u = userById(ts[0].memberId) || { name: 'the member', phone: '' }, first = u.name.split(' ')[0];
  const text = `Hello ${first}, your payment to ${S.v.name} has been verified by ${S.u.name} (${S.u.title || 'Admin'}).\n${ts.map(t => `- ${levyOf(t.levy).name}: ${money(t.amount)} (Receipt ${t.receiptNo})`).join('\n')}\nTotal: ${money(sum(ts))}\nPaid on: ${fmtDate(ts[0].date)}\n\nYour receipt is on your ${S.v.name} dashboard. Thank you.`;
  const wa = waLinkTo(u.phone, text);
  infoModal('Payment verified', `${esc(u.name)}`, `<div class="callout ok" style="margin-top:14px"><div><b>Receipt sent to ${esc(first)}'s dashboard</b><p>It names you, ${esc(S.u.name)}, as the admin who verified the payment, and lists the details. ${esc(first)} can open or download it any time.</p></div></div>
  ${table(['Receipt', 'Levy', { t: 'Amount', num: true }, ''], ts.map(t => [esc(t.receiptNo || '-'), esc(levyOf(t.levy).name), money(t.amount), `<button class="btn btn-ghost btn-sm" type="button" data-act="receipt" data-id="${esc(t.id)}">Open</button>`]), ['', ''])}
  ${wa ? `<div class="btn-row" style="margin-top:12px"><a class="btn btn-leaf" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Also send on WhatsApp</a></div>` : ''}`);
}
function receiptsPanel() {
  const mine = S.v.tx.filter(t => t.memberId === S.u.id && t.status === 'verified' && t.receiptNo).sort((a, b) => b.receiptNo.localeCompare(a.receiptNo)); if (!mine.length) return '';
  const fresh = mine.filter(t => !t.receiptSeen).length;
  return `<section class="panel" id="receipts"><div class="panel-h"><div><h2>My receipts</h2><p>${fresh ? `<b>${fresh} new</b>. ` : ''}Every verified payment gets a receipt automatically. It names the admin who verified it.</p></div></div>
  ${table(['Receipt', 'Date', 'Levy', { t: 'Amount', num: true }, 'Verified by', ''], mine.slice(0, 6).map(t => [`${esc(t.receiptNo)}${t.receiptSeen ? '' : ' <span class="badge b-verified">New</span>'}`, esc(fmtDate(t.date)), esc(levyOf(t.levy).name), money(t.amount), esc(t.verifiedBy || '-'), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="receipt" data-id="${esc(t.id)}">View</button><button class="btn btn-saffron btn-sm" type="button" data-act="receipt-dl" data-fmt="pdf" data-id="${esc(t.id)}">PDF</button></div>`]), ['', ''])}</section>`;
}

/* ---------- Letterhead signatories (Village profile) ---------- */
const _profile = ADMIN.profile;
ADMIN.profile = function () {
  const prem = S.v.plan === 'premium', roles = ['Chairman', 'Financial Secretary'];
  const rows = roles.map(role => { const u = holderOf(role), can = u && (S.u.id === u.id || isLeadAdmin());
    return [esc(role), u ? esc(u.name) : '<span class="muted">Nobody holds this duty yet</span>', u ? esc(u.phone || 'Not added') : '-', u && u.signature ? `<img class="sigprev" src="${esc(u.signature)}" alt="Signature of ${esc(u.name)}">` : '<span class="muted">No signature</span>', can ? `<button class="btn btn-ghost btn-sm" type="button" data-act="edit-signatory" data-id="${esc(u.id)}">Edit</button>` : '']; });
  return _profile() + `<section class="panel"><div class="panel-h"><div><h2>Letterhead signatories</h2><p>${prem ? 'Premium receipts are issued on a letterhead. The Chairman and the Financial Secretary appear in the footer with their phone and signature.' : 'Premium receipts are issued on a letterhead signed by the Chairman and the Financial Secretary. ' + premiumBadge}</p></div></div>${table(['Duty', 'Name', 'Phone', 'Signature', ''], rows, ['', ''])}</section>`;
};
VIEWS.admin.profile = ADMIN.profile;
Object.assign(ACTIONS, {
  'edit-signatory'(el) {
    requireAdmin(); const u = userById(el.dataset.id);
    openModal({ title: `${esc(u.title)}: phone and signature`, sub: `${esc(u.name)}. Shown in the footer of Premium receipts.`,
      body: `<div class="field"><label for="sgP">Phone number</label><input id="sgP" name="phone" class="input" type="tel" maxlength="16" value="${esc(u.phone || '')}"></div>${fileField('Signature image (PNG or JPG, dark ink on white works best)', 'logo')}${u.signature ? '<label class="check"><input type="checkbox" name="remove"> <span>Remove the current signature</span></label>' : ''}`, submit: 'Save',
      onSubmit: async fd => { const sig = await readFitImage(fd.get('proof'), 300, 120); API.saveSignatory(u.id, { phone: fd.get('phone'), signature: sig, remove: !!fd.get('remove') }); done('Saved.'); } });
  }
});

/* ---------- WhatsApp broadcast (Chairman only, Premium) ---------- */
const isChairman = () => !!S.u && !S.owner && S.u.id !== 'SUPPORT' && S.u.role === 'admin' && S.u.title === 'Chairman';
const broadcastBtn = () => isChairman() ? `<button class="btn btn-leaf btn-sm" type="button" data-act="wa-broadcast">WhatsApp broadcast${S.v.plan === 'premium' ? '' : ' ' + premiumBadge}</button>` : '';
function featureModal(name) { infoModal('Premium feature', name, `<div class="upgrade-box"><div class="up-badge">${premiumBadge}</div><p><b>${esc(name)}</b> is part of the Premium plan. Ask VillageVault support to move your village or association to Premium. Your records stay exactly as they are.</p></div>`); }
let BC = null;
Object.assign(ACTIONS, {
  'wa-broadcast'() {
    if (!isChairman()) return toast('Only the Chairman can send a broadcast.', 'err');
    if (S.v.plan !== 'premium') return featureModal('One-click WhatsApp broadcast');
    const yr = new Date().getFullYear(), list = owingList(yr, S.f).filter(it => waNum(it.u.phone).length >= 12);
    if (!list.length) return toast('Nobody who owes has a phone number on record.', 'err');
    BC = { list, i: 0, yr };
    infoModal('WhatsApp broadcast', `${list.length} member${list.length === 1 ? '' : 's'} who owe, with a phone number`, `<p class="hint" style="margin-top:12px">Each message carries that member's own balance and the payment details. WhatsApp opens one chat at a time, so press the button for each one. Nothing is sent until you press Send in WhatsApp.</p>
    <div class="field"><label for="bcN">Opening line (optional)</label><input id="bcN" class="input" maxlength="140" value="Greetings from your Chairman."></div>
    <div class="btn-row"><button class="btn btn-primary" type="button" id="bcGo" data-act="wa-next">Open first chat: ${esc(list[0].u.name)}</button><span class="hint" id="bcProg">0 of ${list.length} opened</span></div>
    ${table(['Member', { t: 'Owes', num: true }, 'Status'], list.map((it, i) => [esc(it.u.name) + `<small>${esc(it.u.phone)}</small>`, money(it.owe), `<span id="bcS${i}" class="muted">Waiting</span>`]), ['', ''])}`);
  },
  'wa-next'() {
    if (!BC || BC.i >= BC.list.length) return; if (!isChairman() || S.v.plan !== 'premium') return;
    const it = BC.list[BC.i], note = ($('#bcN') && $('#bcN').value || '').trim(), url = waLinkTo(it.u.phone, (note ? note + '\n\n' : '') + reminderText(it, BC.yr));
    const w = window.open(url, '_blank', 'noopener'); if (!w) return toast('Your browser blocked the chat. Allow pop-ups for this site and press the button again.', 'err');
    const s = $('#bcS' + BC.i); if (s) { s.textContent = 'Opened'; s.className = 'badge b-verified'; }
    BC.i++; const n = BC.list.length; $('#bcProg').textContent = `${BC.i} of ${n} opened`;
    const go = $('#bcGo'); if (BC.i < n) go.textContent = `Open next chat: ${BC.list[BC.i].u.name}`; else { go.textContent = 'All chats opened'; go.disabled = true; try { API.logBroadcast(n); toast('Broadcast finished and recorded in the activity log.', 'ok'); } catch (e) { toast(e.message, 'err'); } }
  }
});

/* ---------- My achievements ---------- */
function achievementsOf(u) {
  const yr = new Date().getFullYear(), mine = S.v.tx.filter(t => t.memberId === u.id && t.status === 'verified'), thisYear = mine.filter(t => yearOf(t.date) === yr), owed = memberOutstanding(u.id, yr), att = attendanceOf(u.id);
  const years = Math.floor((Date.now() - new Date(u.joined).getTime()) / (365.25 * 864e5)), months = new Set(thisYear.map(t => t.date.slice(0, 7))).size, total = sum(mine);
  const pl = (S.v.pledges || []).filter(p => p.memberId === u.id && p.status !== 'cancelled'), kept = pl.filter(p => pledgeState(p) === 'paid').length, donated = mine.some(t => !levyOf(t.levy).fixed);
  const early = mine.some(t => t.levy === 'annual' && t.date >= `${yr}-01-01` && t.date <= `${yr}-03-31`), rate = att.total ? att.present / att.total : 0;
  const act = a => S.v.audit.filter(x => x.adminId === u.id && x.action === a).length;
  const B = (id, name, desc, got, val, max, pts, sym) => ({ id, name, desc, got, val: Math.min(val, max), max, pts, sym });
  const list = [
    B('paidup', 'Paid up', `No balance owing for ${yr}`, owed === 0 && thisYear.length > 0, owed === 0 && thisYear.length ? 1 : 0, 1, 20, '✓'),
    B('early', 'Early bird', `Paid annual dues by 31 March ${yr}`, early, early ? 1 : 0, 1, 15, '☀'),
    B('steady', 'Steady giver', `Paid in 6 different months of ${yr}`, months >= 6, months, 6, 20, '↻'),
    B('helper', 'Helping hand', 'Gave to a donation or voluntary levy', donated, donated ? 1 : 0, 1, 10, '♥'),
    B('kept', 'Pledge keeper', 'Fulfilled a pledge in full', kept > 0, Math.min(kept, 1), 1, 20, '★'),
    B('regular', 'Regular face', 'Attended 5 meetings', att.present >= 5, att.present, 5, 15, '☺'),
    B('present', 'Always present', 'Present at 80% of meetings (at least 3)', att.total >= 3 && rate >= .8, Math.round(rate * 100), 80, 25, '◉'),
    B('y1', 'One year strong', 'A member for a year', years >= 1, years, 1, 10, '1'),
    B('y5', 'Pillar of the community', 'A member for five years', years >= 5, years, 5, 30, '5'),
    B('gen', 'Generous heart', 'Over ₦100,000 given in verified payments', total >= 100000, Math.min(total, 100000), 100000, 25, '₦')
  ];
  if (u.role === 'admin') list.push(B('ver', 'Trusted verifier', 'Verified 10 payments', act('Verified payment') >= 10, act('Verified payment'), 10, 25, '✔'), B('att', 'Register keeper', 'Verified 10 attendance entries', act('Verified attendance') >= 10, act('Verified attendance'), 10, 20, '☰'), B('open', 'Meeting master', 'Opened 2 registers', act('Opened attendance register') >= 2, act('Opened attendance register'), 2, 15, '⌂'));
  return list;
}
function achievementsView() {
  const u = S.u, list = achievementsOf(u), got = list.filter(b => b.got), pts = got.reduce((a, b) => a + b.pts, 0), lvl = pts >= 120 ? 'Gold' : pts >= 70 ? 'Silver' : pts >= 30 ? 'Bronze' : 'Starter', next = pts >= 120 ? 0 : pts >= 70 ? 120 : pts >= 30 ? 70 : 30;
  return `<div class="kpis kpis-3">${kpi('Achievements earned', `${got.length} of ${list.length}`, 'Keep going', 'hot')}${kpi('Points', String(pts), next ? `${next - pts} more for the next level` : 'Top level reached', 'good')}${kpi('Level', lvl, `As a member of ${esc(S.v.name)}`)}</div>
  <section class="panel"><div class="panel-h"><div><h2>My achievements</h2><p>Earned from your payments, attendance and years of service. The same badges apply in every village and association.</p></div></div>
  <div class="medals">${list.map(b => `<div class="medal-card${b.got ? ' got' : ''}"><div class="medal">${b.sym}</div><div class="mc-body"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${b.got ? `<span class="badge b-verified">Earned · ${b.pts} pts</span>` : `<div class="bar"><i style="width:${Math.round(b.val / b.max * 100)}%"></i></div><small>${b.id === 'gen' ? money(b.val) + ' of ' + money(b.max) : b.id === 'present' ? b.val + '% of 80%' : b.val + ' of ' + b.max}</small>`}</div></div>`).join('')}</div></section>`;
}
VIEWS.member.achievements = achievementsView; VIEWS.admin.achievements = achievementsView;

/* ---------- Sponsors hall of fame ---------- */
function hallView() {
  const d = SPN.load(), wk = id => d.payments.filter(p => p.sponsor_id === id).reduce((a, p) => a + (Number(p.weeks) || 0), 0);
  const items = d.items.filter(s => s.scope === 'global' || s.association_id === S.v.id).map(s => ({ s, weeks: wk(s.id), st: spStatus(s) })).sort((a, b) => b.weeks - a.weeks || a.s.shop_name.localeCompare(b.s.shop_name));
  const tier = w => w >= 16 ? ['Platinum', '#7C3AED'] : w >= 8 ? ['Gold', '#D99A18'] : w >= 4 ? ['Silver', '#6B7280'] : ['Bronze', '#B45309'];
  return `<section class="panel"><div class="panel-h"><div><h2>Sponsors hall of fame</h2><p>Local businesses that keep this community running. The longer they support us, the higher their tier. Please thank them with your custom.</p></div></div>
  ${items.length ? `<div class="hall">${items.map((x, i) => { const t = tier(x.weeks); return `<div class="hall-card"><div class="hall-rank">${i + 1}</div><img class="sp-logo" src="${esc(x.s.logo)}" alt="${esc(x.s.shop_name)} logo"><div class="hall-body"><b>${esc(x.s.shop_name)}</b><span class="tier" style="--tc:${t[1]}">${t[0]}</span><small>${x.weeks} week${x.weeks === 1 ? '' : 's'} of support, since ${esc(fmtDate(String(x.s.started_at).slice(0, 10)))}</small><small>${x.s.scope === 'global' ? 'Lagos-wide sponsor' : 'Sponsor of this community'} · ${x.st === 'active' ? '<span class="badge b-verified">Featured now</span>' : '<span class="badge b-off">Past sponsor</span>'}</small>${x.st === 'active' ? `<a class="btn btn-leaf btn-sm" href="${esc(waLink(x.s))}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>` : ''}</div></div>`; }).join('')}</div>` : '<div class="empty"><b>No sponsors yet</b>Sponsors will be honoured here.</div>'}</section>`;
}
VIEWS.member.halloffame = hallView; VIEWS.admin.halloffame = hallView;

/* ---------- Rate us ---------- */
const RV = { load() { try { return JSON.parse(lsGet('vv_reviews_v1') || '[]'); } catch (_) { return []; } }, save(l) { lsSet('vv_reviews_v1', JSON.stringify(l)); } };
function maybeRate(trigger, tries) {
  try {
    if (S.owner || !S.u || !S.v || S.u.id === 'SUPPORT' || S.rateAsked) return;
    const key = `vv_rate_${S.v.id}_${S.u.id}`; if (Date.now() - Number(lsGet(key) || 0) < 14 * 864e5) return;
    S.rateAsked = true;
    const go = n => { if (!S.u) return; if (!$('#modalRoot').hidden && n < 4) return setTimeout(() => go(n + 1), 2000); if (!$('#modalRoot').hidden) { S.rateAsked = false; return; } lsSet(key, String(Date.now() - 13 * 864e5)); openRate(trigger); };
    setTimeout(() => go(0), 1500);
  } catch (_) {}
}
function openRate(trigger) {
  openModal({ title: 'How are we doing?', sub: `You just finished ${esc(trigger)}. Rate VillageVault so we can keep improving it.`,
    body: `<div class="stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star" data-act="rate-star" data-v="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div><input type="hidden" name="stars" id="rvStars" value="">
    <div class="field"><label for="rvC">Tell us more (optional)</label><textarea id="rvC" name="comment" class="textarea" maxlength="300" placeholder="What worked well? What should be better?"></textarea></div>`, submit: 'Send rating',
    onSubmit: fd => { const n = Number(fd.get('stars')); if (!(n >= 1 && n <= 5)) throw new Error('Tap a star to rate.'); const l = RV.load(); l.push({ id: 'RV' + (l.length + 1), ts: stamp(), village: S.v.name, villageId: S.v.id, role: S.u.role, name: S.u.name, stars: n, comment: (fd.get('comment') || '').trim(), trigger }); RV.save(l); lsSet(`vv_rate_${S.v.id}_${S.u.id}`, String(Date.now())); closeModal(); toast('Thank you for your rating.', 'ok'); } });
}
Object.assign(ACTIONS, { 'rate-star'(el) { const n = Number(el.dataset.v); $('#rvStars').value = String(n); $$('.star').forEach((b, i) => b.classList.toggle('on', i < n)); } });
const _toastRaw = toast;
toast = function (msg, kind) {
  _toastRaw(msg, kind);
  if (kind === 'ok' && typeof msg === 'string') { if (/^Proof sent/.test(msg)) maybeRate('uploading your proof of payment'); else if (/^(Attendance marked|Marked\.)/.test(msg)) maybeRate('marking attendance'); else if (/downloaded/i.test(msg)) maybeRate('downloading a document'); }
};
const _renderViewRaw = renderView;
renderView = function () { _renderViewRaw.apply(this, arguments); if (!S.owner && S.u && (S.page === 'village' || S.page === 'profile')) maybeRate('viewing the village profile'); };
OWNERV['o-reviews'] = function () {
  const l = RV.load().slice().sort((a, b) => b.ts.localeCompare(a.ts)), avg = l.length ? (l.reduce((a, r) => a + r.stars, 0) / l.length).toFixed(1) : '-';
  return `<div class="kpis kpis-3">${kpi('Average rating', avg + (l.length ? ' / 5' : ''), `${l.length} rating${l.length === 1 ? '' : 's'}`, 'hot')}${kpi('Five stars', String(l.filter(r => r.stars === 5).length), 'Happy users', 'good')}${kpi('One or two stars', String(l.filter(r => r.stars <= 2).length), 'Worth a look', l.some(r => r.stars <= 2) ? 'bad' : '')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Reviews from members and admins</h2><p>Only you can see these. Villages never see ratings.</p></div></div>
  ${table(['When', 'Village', 'From', { t: 'Rating', num: true }, 'Comment', 'After'], l.map(r => [`<span class="nowrap">${esc(fmtTS(r.ts))}</span>`, esc(r.village), `${esc(r.name)}<small>${esc(r.role)}</small>`, `<span class="rstars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span>`, esc(r.comment || '-'), esc(r.trigger)]), ['No ratings yet', 'Ratings appear here after members and admins finish tasks.'])}</section>`;
};

/* ---------- Keep open tabs in step: when another tab (for example the admin verifying a payment) saves
   a village, this tab picks up the change by itself ---------- */
window.addEventListener('storage', e => {
  if (!e.key || e.key.indexOf('vv_v1_') !== 0 || !e.newValue) return;
  try {
    const id = e.key.slice(6), d = JSON.parse(e.newValue); migrate(d); DB.cache[id] = d;
    if (S.v && S.v.id === id) { S.v = d; if (S.u && S.u.id !== 'SUPPORT') { const nu = d.users.find(x => x.id === S.u.id); if (nu) { if (nu.role !== S.u.role) S.page = 'overview'; S.u = nu; } } if ($('#modalRoot').hidden) renderSoon(); }
  } catch (_) {}
});

/* ---------- Start ---------- */
init();
})();
