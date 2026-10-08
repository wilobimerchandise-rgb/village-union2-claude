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
const WARDS = ['North ward', 'South ward', 'East ward', 'West ward'];
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
const levyOf = id => LEVIES.find(l => l.id === id) || { id, name: id, color: '#888', fixed: false };
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
  const adminTitles = ['President General', 'Financial Secretary', 'Treasurer'];
  const off = Math.floor(R() * 9);
  for (let i = 0; i < 3; i++) users.push({ id: `${code}-A${pad(i + 1)}`, name: `${FIRST[(i * 7 + off + 3) % 26]} ${LAST[(i * 3 + off + 5) % 20]}`, role: 'admin', title: adminTitles[i], ward: WARDS[i % 4], phone: `0803${Math.floor(1000000 + R() * 8999999)}`, email: '', joined: '2019-01-15', active: true });
  for (let i = 0; i < 22; i++) users.push({ id: `${code}-M${String(i + 1).padStart(3, '0')}`, name: `${FIRST[(i * 3 + off) % 26]} ${LAST[(i * 5 + off) % 20]}`, role: 'member', title: 'Member', ward: WARDS[Math.floor(R() * 4)], phone: `080${Math.floor(10000000 + R() * 89999999)}`, email: '', joined: `${2012 + Math.floor(R() * 10)}-${pad(1 + Math.floor(R() * 12))}-10`, active: i !== 21 });
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

/* ---------- Database layer (one record per village) ---------- */
const DB = {
  cache: {},
  async load(id) {
    if (this.cache[id]) return this.cache[id];
    const vil = VILLAGES.find(v => v.id === id); if (!vil) throw new Error('Unknown village.');
    let data = null; const raw = lsGet('vv_v1_' + id);
    if (raw) { try { data = JSON.parse(raw); } catch (_) { data = null; } }
    if (!data) { data = await seedVillage(vil); lsSet('vv_v1_' + id, JSON.stringify(data)); }
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
      this.data = { id: CONFIG.OWNER_ID, name: 'Platform Owner', hash: await hashPw('owner', CONFIG.OWNER_ID, CONFIG.OWNER_DEFAULT_PASSWORD), defaultPw: true, names: {}, log: [] };
      this.save();
    }
    this.data.names = this.data.names || {}; this.data.log = this.data.log || [];
    this.data.email = CONFIG.PLATFORM_OWNER_EMAIL;
    return this.data;
  },
  save() { if (!lsSet('vv_owner_v1', JSON.stringify(this.data))) warnStorage(); }
};
// Apply village names the owner has changed (read before anything is shown)
(function applyNameOverrides() {
  const o = OWN.peek(); if (!o || !o.names) return;
  VILLAGES.forEach(v => { if (o.names[v.id]) v.name = o.names[v.id]; });
})();

/* ---------- App state ---------- */
const S = { v: null, u: null, page: 'overview', f: {}, tab: 'collections', owner: false };
const isAdmin = () => !!S.u && S.u.role === 'admin';
const userById = id => S.v.users.find(u => u.id === id);
const nameOf = id => (userById(id) || { name: 'Former member' }).name;

/* ---------- Permission-checked data operations ---------- */
function requireAdmin() { if (!S.u || S.u.role !== 'admin' || !S.u.active) throw new Error('Only a village admin can do this.'); }
function log(action, target, detail) {
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
    const t = { id: nextId('tx', 'T'), memberId: S.u.id, levy: d.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref, note: d.note || '', status: 'pending', proof: d.proof, submittedAt: stamp(), submittedBy: S.u.name, updatedBy: null, updatedAt: null, history: [] };
    S.v.tx.push(t); commit(); return t;
  },
  verify(id, amount, note) {
    requireAdmin(); const t = getTx(id);
    if (t.status !== 'pending') throw new Error('Only pending payments can be verified.');
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
    t.status = 'rejected'; t.rejectReason = reason; t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp();
    stampUpdate(t, 'Rejected: ' + reason, 'reject');
    log('Rejected payment', t.id, `${levyOf(t.levy).name} ${money(t.amount)} from ${nameOf(t.memberId)}: ${reason}`);
    commit(); return t;
  },
  addTx(d) {
    requireAdmin();
    const t = { id: nextId('tx', 'T'), memberId: d.memberId, levy: d.levy, amount: d.amount, date: d.date, method: d.method, ref: d.ref, note: d.note || '', status: d.status, proof: d.proof || null, submittedAt: stamp(), submittedBy: S.u.name + ' (admin entry)', updatedBy: null, updatedAt: null, history: [] };
    if (t.status === 'verified') { t.verifiedBy = S.u.name; t.verifiedById = S.u.id; t.verifiedAt = stamp(); }
    S.v.tx.push(t);
    stampUpdate(t, `Recorded by admin as ${t.status}`, 'create');
    log('Added payment record', t.id, `${levyOf(t.levy).name} ${money(t.amount)} for ${nameOf(t.memberId)} (${t.status})`);
    commit(); return t;
  },
  editTx(id, d) {
    requireAdmin(); const t = getTx(id); const before = Object.assign({}, t);
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
    requireAdmin();
    const id = nextId('mbr', 'M'); return hashPw(S.v.id, id, d.password).then(h => {
      const u = { id, name: d.name, role: 'member', title: 'Member', ward: d.ward, phone: d.phone, email: d.email || '', joined: today(), active: true, hash: h, createdBy: S.u.name, createdAt: stamp() };
      S.v.users.push(u); log('Added member', id, `${u.name} (${u.ward})`); commit(); return u;
    });
  },
  editMember(id, d) {
    requireAdmin(); const u = userById(id); if (!u || u.role !== 'member') throw new Error('Member not found.');
    const ch = []; ['name', 'ward', 'phone', 'email'].forEach(k => { if ((u[k] || '') !== (d[k] || '')) { ch.push(`${cap(k)}: ${u[k] || 'blank'} to ${d[k] || 'blank'}`); u[k] = d[k]; } });
    const act = d.active === 'yes'; if (act !== u.active) { ch.push(act ? 'Account activated' : 'Account deactivated'); u.active = act; }
    if (!ch.length) throw new Error('Nothing was changed.');
    u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Edited member', id, `${u.name}: ${ch.join('; ')}`); commit(); return u;
  },
  resetPassword(id, pw) {
    requireAdmin(); const u = userById(id); if (!u) throw new Error('Member not found.');
    return hashPw(S.v.id, u.id, pw).then(h => { u.hash = h; u.updatedBy = S.u.name; u.updatedAt = stamp(); log('Reset member password', id, `Password reset for ${u.name}`); commit(); });
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
    LEVIES.filter(l => l.fixed).forEach(l => { const o = S.v.settings.levies[l.id], n = Number(vals[l.id]); if (o !== n) { ch.push(`${l.name}: ${money(o)} to ${money(n)}`); S.v.settings.levies[l.id] = n; } });
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
    S.u.hash = await hashPw(S.v.id, S.u.id, nw); if (isAdmin()) log('Changed own password', S.u.id, 'Admin changed their password'); commit();
  }
};

/* ---------- Money helpers ---------- */
function memberPaid(id, year) { return villageTx().filter(t => t.memberId === id && yearOf(t.date) === year); }
function memberOutstanding(id, year) {
  const paid = memberPaid(id, year); let o = 0;
  LEVIES.filter(l => l.fixed).forEach(l => { o += Math.max(0, S.v.settings.levies[l.id] - sum(paid.filter(t => t.levy === l.id))); });
  return o;
}
const expectedPerMember = () => LEVIES.filter(l => l.fixed).reduce((a, l) => a + S.v.settings.levies[l.id], 0);
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
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
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
const levyOpts = (sel, all) => (all ? opt('', all, sel) : '') + LEVIES.map(l => opt(l.id, l.name, sel)).join('');
const methodOpts = sel => METHODS.map(m => opt(m, m, sel)).join('');
const wardOpts = (sel, all) => (all ? opt('', all, sel) : '') + WARDS.map(w => opt(w, w, sel)).join('');
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
const kpi = (l, v, s, tone) => `<div class="kpi ${tone || ''}"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div>${s ? `<div class="kpi-s">${s}</div>` : ''}</div>`;
function csvDownload(name, rows) {
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
  const byLevy = LEVIES.map(l => { const a = inR.filter(t => t.levy === l.id); return { id: l.id, name: l.name, color: l.color, count: a.length, amount: sum(a) }; });
  const pend = pendingTx().filter(t => !memberId || t.memberId === memberId);
  const rep = {
    kind, year, month, memberId, start, end, periodLabel, village: v.name,
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
      const per = {}; LEVIES.forEach(l => { per[l.id] = sum(inR.filter(t => t.memberId === u.id && t.levy === l.id)); });
      return { id: u.id, name: u.name, per, total: LEVIES.reduce((a, l) => a + per[l.id], 0), active: u.active };
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
  constructor(w, h) { this.W = w || 595.28; this.H = h || 841.89; this.pages = []; this.add(); }
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
  build(title) {
    const objs = [], kids = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    let id = 5;
    this.pages.forEach(pg => {
      const pid = id++, cid = id++, stream = pg.join('\n'); kids.push(pid + ' 0 R');
      objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`;
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
  let y = 0;
  pdf.rect(0, 0, pdf.W, 118, '#1A1A4E'); pdf.rect(0, 118, pdf.W, 5, '#F5B83D');
  pdf.text('VillageVault', M, 38, { size: 10, bold: true, color: '#F5B83D' });
  pdf.text(rep.ref, pdf.W - M, 38, { size: 9, color: '#DADCF5', align: 'right' });
  pdf.text(rep.docTitle, M, 70, { size: 22, bold: true, color: '#FFFFFF' });
  pdf.text(`${rep.village} Village Union, ${rep.periodLabel}${rep.memberName ? ', ' + rep.memberName : ''}`, M, 94, { size: 12, color: '#DADCF5' });
  y = 148;
  const newPage = () => { pdf.add(); pdf.rect(0, 0, pdf.W, 26, '#1A1A4E'); pdf.text(`VillageVault | ${rep.village} | ${rep.docTitle} | ${rep.periodLabel}`, M, 17, { size: 8, color: '#DADCF5' }); y = 52; };
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
    pdf.text('Financial Secretary', M, y + 40, { size: 8.5, color: MUT }); pdf.text('President General', M + CW - 190, y + 40, { size: 8.5, color: MUT });
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
  member: [['overview', 'My dashboard', 'home'], ['village', 'Village dashboard', 'village']],
  admin: [['overview', 'Overview', 'home'], ['verify', 'Verify payments', 'check'], ['transactions', 'Transactions', 'list'], ['members', 'Members', 'users'], ['expenses', 'Expenditure', 'coin'], ['levies', 'Levy amounts', 'sliders'], ['reports', 'Reports', 'file'], ['audit', 'Activity log', 'clock']],
  owner: [['o-overview', 'All villages', 'home'], ['o-villages', 'Manage villages', 'village'], ['o-admins', 'Village admins', 'users'], ['o-sponsors', 'Sponsors', 'coin'], ['o-log', 'Owner activity', 'clock'], ['o-account', 'My account', 'user']]
};
const TITLES = { overview: 'Overview', village: 'Village dashboard', reports: 'Reports', verify: 'Verify payments', transactions: 'Transactions', members: 'Members', expenses: 'Expenditure', levies: 'Levy amounts', audit: 'Activity log', 'o-overview': 'All villages', 'o-villages': 'Manage villages', 'o-admins': 'Village admins', 'o-sponsors': 'Sponsors', 'o-log': 'Owner activity', 'o-account': 'My account' };
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
    : `<div class="side-village"><div class="vbadge" style="background:${vil.color};color:#fff">${esc(vil.code)}</div><div><b>${esc(S.v.name)}</b><small>${S.owner ? 'Owner view' : 'Village union'}</small></div></div>`;
  const who = ownerMode ? { n: OWN.data.name, s: 'Master admin' } : { n: S.u.name, s: S.owner ? 'Owner view of this village' : `${S.u.title}, ${S.u.id}` };
  const top = rk === 'member' ? '<button class="btn btn-saffron btn-sm" type="button" data-act="upload-proof">Upload proof</button>' : rk === 'admin' ? '<button class="btn btn-saffron btn-sm" type="button" data-act="add-tx">Add payment</button>' : '';
  $('#app').innerHTML = `<div class="shell">
    <aside class="side" id="side" aria-label="Sidebar">
      <a class="brand" href="#" data-act="home-link"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#F5B83D"/><path d="M16 6l8 5v10l-8 5-8-5V11z" fill="none" stroke="#1A1A4E" stroke-width="2.4"/><circle cx="16" cy="16" r="3" fill="#1A1A4E"/></svg><span>VillageVault</span></a>
      ${head}
      <nav class="navlist" id="navlist" aria-label="Dashboard"></nav>
      <div class="side-foot">
        <div class="who"><div class="avatar">${esc(initials(who.n))}</div><div><b>${esc(who.n)}</b><small>${esc(who.s)}</small></div></div>
        ${S.owner && S.v ? '<button class="btn-out" type="button" data-act="owner-back">Back to owner console</button>' : ''}
        <button class="btn-out" type="button" data-act="change-pw">Change password</button>
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
  const rk = roleKey(), pend = rk === 'admin' ? pendingTx().length : 0;
  $('#navlist').innerHTML = NAV[rk].map(n => `<button type="button" data-act="goto" data-page="${n[0]}" class="${S.page === n[0] ? 'active' : ''}"${S.page === n[0] ? ' aria-current="page"' : ''}>${icon(n[2])}${n[1]}${n[0] === 'verify' && pend ? `<span class="count">${pend}</span>` : ''}</button>`).join('');
}
function renderView() {
  const ae = document.activeElement, keep = ae && ae.dataset ? { k: ae.dataset.filter, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const rk = roleKey(), fn = (VIEWS[rk] || {})[S.page] || VIEWS[rk][NAV[rk][0][0]];
  $('#pageTitle').textContent = pageTitleText();
  $('#pageSub').textContent = rk === 'owner' ? 'Platform owner' : `${S.v.name} Village Union${S.owner ? ' (owner view)' : ''}`;
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
  const act = admin ? `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View</button>${t.status === 'pending' ? `<button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Verify</button>` : ''}${t.status === 'verified' ? `<button class="btn btn-saffron btn-sm" type="button" data-act="receipt" data-id="${t.id}">Receipt</button>` : ''}${t.status !== 'void' ? `<button class="btn btn-ghost btn-sm" type="button" data-act="edit-tx" data-id="${t.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="void-tx" data-id="${t.id}">Void</button>` : ''}</div>` : `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="view-tx" data-id="${t.id}">View</button></div>`;
  return [esc(fmtDate(t.date)), `<span class="dot" style="background:${levyOf(t.levy).color}"></span>${esc(levyOf(t.levy).name)}`]
    .concat(admin ? [`${esc(nameOf(t.memberId))}<small>${esc(t.memberId)}</small>`] : [])
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
      <div><div class="lbl" style="margin-bottom:6px">Proof of payment</div>${proofHTML(t.proof)}</div></div>
      ${adm && t.status === 'verified' ? `<div style="margin-top:14px"><button type="button" class="btn btn-saffron btn-sm" data-act="receipt" data-id="${t.id}">${t.receiptNo ? 'Open receipt ' + esc(t.receiptNo) : 'Generate receipt'}</button></div>` : ''}
      ${hist ? `<div class="sec-title">History</div><ul class="timeline">${hist}</ul>` : ''}`
  });
}

/* ---------- Member views ---------- */
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
const MEMBER = {
  overview() {
    const yr = new Date().getFullYear(), mine = myTx(), ver = mine.filter(t => t.status === 'verified' && yearOf(t.date) === yr), pend = mine.filter(t => t.status === 'pending'), rej = mine.filter(t => t.status === 'rejected');
    const rows = LEVIES.map(L => { const p = sum(ver.filter(t => t.levy === L.id)), need = L.fixed ? S.v.settings.levies[L.id] : 0; return { L, p, need }; });
    const out = memberOutstanding(S.u.id, yr), last = mine.filter(t => t.status === 'verified').sort((a, b) => b.date.localeCompare(a.date))[0];
    return `<div><h2 style="font-size:1.7rem">${greeting()}, ${esc(S.u.name.split(' ')[0])}.</h2><p class="muted">Here is where your payments stand for ${yr}.</p></div>
    ${rej.length ? `<div class="callout"><div><b>${rej.length} payment${rej.length > 1 ? 's were' : ' was'} rejected</b><p>See the reason in your payment records below, then upload the proof again.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof</button></div>` : ''}
    <div class="kpis">${kpi('Paid in ' + yr, money(sum(ver)), `${ver.length} verified payment${ver.length === 1 ? '' : 's'}`, 'hot')}${kpi('Still to pay', money(out), out ? 'Based on fixed levies' : 'You are up to date', out ? 'bad' : 'good')}${kpi('Awaiting verification', String(pend.length), pend.length ? money(sum(pend)) + ' with the admin' : 'Nothing pending')}${kpi('Last verified payment', last ? esc(fmtDate(last.date)) : 'None yet', last ? esc(levyOf(last.levy).name) : '')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Your levies this year</h2><p>Verified payments against the amount set by your village</p></div><button class="btn btn-primary btn-sm" type="button" data-act="upload-proof">Upload proof</button></div>
      <div class="progress-list">${rows.map(r => { const pc = r.need ? Math.min(100, r.p / r.need * 100) : 0; return `<div><div class="prog-top"><b>${esc(r.L.name)}</b><span>${r.L.fixed ? `${money(r.p)} of ${money(r.need)}` : `${money(r.p)} given`}</span></div><div class="bar"><i style="width:${r.L.fixed ? pc : (r.p ? 100 : 0)}%;--c:${r.L.color}"></i></div></div>`; }).join('')}</div></section>
    <section class="panel"><div class="panel-h"><h2>Recent activity</h2></div><div class="list">${mine.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6).map(t => `<div class="list-item"><div><b>${esc(levyOf(t.levy).name)}</b><small>${esc(fmtDate(t.date))}, ${money(t.amount)}</small></div>${badge(t.status)}</div>`).join('') || '<div class="empty"><b>No payments yet</b>Upload your first proof of payment.</div>'}</div></section></div>
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
    return `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><p class="muted">Read-only view of ${esc(S.v.name)}'s collections and spending. Only village admins can change records.</p><button class="btn btn-primary btn-sm" type="button" data-act="report-modal" data-scope="village">Download village report</button></div>
    <div class="kpis">${kpi('Village balance', money(bal), 'All income less all spending', 'hot')}${kpi('Collected in ' + yr, money(sum(inY)), `${inY.length} verified payments`)}${kpi('Spent in ' + yr, money(sum(exY)), `${exY.length} items`)}${kpi('Active members', String(S.v.users.filter(u => u.role === 'member' && u.active).length), '')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Collections, last 12 months</h2><p>Verified payments only</p></div></div>${barChart(monthlySeries(ver))}</section>
    <section class="panel"><div class="panel-h"><h2>Income by levy in ${yr}</h2></div>${donut(LEVIES.map(l => ({ label: l.name, color: l.color, value: sum(inY.filter(t => t.levy === l.id)) })))}</section></div>
    <section class="panel"><div class="panel-h"><div class="tabs" role="tablist"><button type="button" role="tab" data-act="tab" data-tab="collections" class="${tab === 'collections' ? 'active' : ''}" aria-selected="${tab === 'collections'}">Collections</button><button type="button" role="tab" data-act="tab" data-tab="spending" class="${tab === 'spending' ? 'active' : ''}" aria-selected="${tab === 'spending'}">Spending</button></div></div>${body}</section>`;
  }
};

function uploadBody(levyId) {
  const L = levyOf(levyId || 'annual');
  return `<div class="form-row"><div class="field"><label for="uLevy">Levy</label><select id="uLevy" name="levy" class="select" data-amount-source>${levyOpts(L.id)}</select></div>
  <div class="field"><label for="uAmt">Amount paid (naira)</label><input id="uAmt" name="amount" class="input" type="number" min="1" step="1" inputmode="numeric" value="${L.fixed ? S.v.settings.levies[L.id] : ''}" placeholder="0" required></div></div>
  <div class="form-row"><div class="field"><label for="uDate">Payment date</label><input id="uDate" name="date" class="input" type="date" max="${today()}" value="${today()}" required></div>
  <div class="field"><label for="uMethod">How did you pay?</label><select id="uMethod" name="method" class="select">${methodOpts('')}</select></div></div>
  <div class="field"><label for="uRef">Bank reference or teller number</label><input id="uRef" name="ref" class="input" type="text" placeholder="From your slip or bank alert" maxlength="60" required></div>
  ${fileField('Proof of payment')}
  <div class="field"><label for="uNote">Note for the admin (optional)</label><textarea id="uNote" name="note" class="textarea" maxlength="300" placeholder="For example: paid on behalf of my brother"></textarea></div>`;
}

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
    return `<div><h2 style="font-size:1.7rem">${greeting()}, ${esc(S.u.name.split(' ')[0])}.</h2><p class="muted">${esc(S.u.title)}, ${esc(S.v.name)} Village Union</p></div>
    ${pend.length ? `<div class="callout"><div><b>${pend.length} payment${pend.length > 1 ? 's are' : ' is'} waiting for verification</b><p>${money(sum(pend))} is not in the books until you check the proof.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="goto" data-page="verify">Review now</button></div>` : `<div class="callout ok"><div><b>Everything is verified</b><p>No payments are waiting for you.</p></div></div>`}
    <div class="kpis">${kpi('Collected in ' + yr, money(sum(inY)), `${inY.length} verified payments`, 'hot')}${kpi('Spent in ' + yr, money(sum(exY)), `${exY.length} items`)}${kpi('Village balance', money(sum(ver) - sum(ex)), 'All income less all spending', 'good')}${kpi('Members behind', String(behind.length), `${money(sum(behind, 'o'))} outstanding`, behind.length ? 'bad' : '')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-h"><div><h2>Collections, last 12 months</h2><p>Verified payments only</p></div></div>${barChart(monthlySeries(ver))}</section>
    <section class="panel"><div class="panel-h"><h2>Income by levy in ${yr}</h2></div>${donut(LEVIES.map(l => ({ label: l.name, color: l.color, value: sum(inY.filter(t => t.levy === l.id)) })))}</section></div>
    <div class="grid-2e"><section class="panel"><div class="panel-h"><h2>Waiting for verification</h2><button class="btn btn-ghost btn-sm" type="button" data-act="goto" data-page="verify">See all</button></div><div class="list">${pend.slice(0, 5).map(t => `<div class="list-item"><div><b>${esc(nameOf(t.memberId))}</b><small>${esc(levyOf(t.levy).name)}, ${money(t.amount)}, ${esc(fmtDate(t.date))}</small></div><button class="btn btn-leaf btn-sm" type="button" data-act="verify-tx" data-id="${t.id}">Review</button></div>`).join('') || '<div class="empty"><b>All clear</b>New uploads will appear here.</div>'}</div></section>
    <section class="panel"><div class="panel-h"><h2>Recent admin activity</h2><button class="btn btn-ghost btn-sm" type="button" data-act="goto" data-page="audit">Full log</button></div><div class="list">${recent.map(a => `<div class="list-item"><div><b>${esc(a.action)}</b><small>${esc(a.adminName)}, ${esc(fmtTS(a.ts))}</small></div></div>`).join('')}</div></section></div>
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
    const list = S.v.users.filter(u => u.role === 'member' && (!f.ward || u.ward === f.ward) && (!f.state || (f.state === 'active') === u.active) && (!q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    const page = paginate(list, f);
    return `<section class="panel"><div class="panel-h"><div><h2>Admin team</h2></div></div><div class="report-grid">${S.v.users.filter(u => u.role === 'admin').map(a => `<div class="rep-item"><div><b>${esc(a.name)}</b><br><small>${esc(a.title)}, ${esc(a.id)}</small></div></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-h"><div><h2>Members</h2><p>${list.length} shown, ${S.v.users.filter(u => u.role === 'member' && u.active).length} active</p></div><button class="btn btn-primary btn-sm" type="button" data-act="add-member">Add member</button></div>
    <div class="toolbar"><div class="field grow2"><label for="fq">Search</label><input id="fq" class="input" type="search" data-filter="q" value="${esc(f.q || '')}" placeholder="Name or ID"></div>
    <div class="field"><label for="fw">Ward</label><select id="fw" class="select" data-filter="ward">${wardOpts(f.ward, 'All wards')}</select></div>
    <div class="field"><label for="fst">Account</label><select id="fst" class="select" data-filter="state">${opt('', 'All accounts', f.state)}${opt('active', 'Active', f.state)}${opt('off', 'Deactivated', f.state)}</select></div></div>
    ${table(['Member', 'Ward', 'Phone', { t: 'Paid ' + yr, num: true }, { t: 'Still to pay', num: true }, 'Account', ''], page.map(u => [`${esc(u.name)}<small>${esc(u.id)}</small>`, esc(u.ward), esc(u.phone || '-'), money(sum(memberPaid(u.id, yr))), money(memberOutstanding(u.id, yr)), u.active ? '<span class="badge b-active">Active</span>' : '<span class="badge b-off">Deactivated</span>', `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="edit-member" data-id="${u.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="reset-pw" data-id="${u.id}">Reset password</button></div>`]), ['No members match', 'Try a different filter.'])}${pager(list.length, f.page, CONFIG.PER_PAGE)}</section>`;
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
function done(msg) { toast(msg, 'ok'); closeModal(); renderView(); }
const ACTIONS = {
  'add-tx'() { openModal({ title: 'Add a payment record', sub: 'Use this for payments received outside the upload flow. Your name and the time are saved on the record.', body: txFormBody({}, 'add'), submit: 'Save record', onSubmit: async fd => { const t = API.addTx(await readTxForm(fd)); done(`Record ${t.id} saved.`); } }); },
  'edit-tx'(el) { const t = getTx(el.dataset.id); openModal({ title: 'Edit payment record', sub: `Record ${esc(t.id)}. Every change is logged under your name.`, body: txFormBody(t, 'edit'), submit: 'Save changes', onSubmit: async fd => { API.editTx(t.id, await readTxForm(fd)); done('Record updated.'); } }); },
  'verify-tx'(el) {
    const t = getTx(el.dataset.id);
    openModal({ title: 'Verify payment', size: 'modal-lg', sub: `${esc(nameOf(t.memberId))} says they paid ${esc(levyOf(t.levy).name)} on ${esc(fmtDate(t.date))} by ${esc(t.method)}. Reference: ${esc(t.ref || 'none')}.`,
      body: `<div class="form-row" style="margin-top:14px"><div>${proofHTML(t.proof)}</div><div><div class="field" style="margin-top:0"><label for="vAmt">Amount confirmed in the bank (naira)</label><input id="vAmt" name="amount" class="input" type="number" min="1" value="${t.amount}" required><span class="hint">Change this only if the proof shows a different amount.</span></div><div class="field"><label for="vNote">Note (optional)</label><textarea id="vNote" name="note" class="textarea" maxlength="300">${esc(t.note || '')}</textarea></div></div></div>`,
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
    const pw = 'Vv' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Add a member', sub: 'Give the member their ID and password. They can change the password after signing in.',
      body: `<div class="field"><label for="amN">Full name</label><input id="amN" name="name" class="input" maxlength="80" required></div><div class="form-row"><div class="field"><label for="amW">Ward</label><select id="amW" name="ward" class="select">${wardOpts('')}</select></div><div class="field"><label for="amP">Phone</label><input id="amP" name="phone" class="input" type="tel" maxlength="20"></div></div><div class="field"><label for="amE">Email (optional)</label><input id="amE" name="email" class="input" type="email" maxlength="80"></div><div class="field"><label for="amPw">Starting password</label><input id="amPw" name="password" class="input" type="text" value="${pw}" minlength="6" required></div>`,
      submit: 'Add member', onSubmit: async fd => { const n = (fd.get('name') || '').trim(), p = fd.get('password') || ''; if (n.length < 3) throw new Error('Enter the member’s full name.'); if (p.length < 6) throw new Error('The password needs at least 6 characters.'); const u = await API.addMember({ name: n, ward: fd.get('ward'), phone: (fd.get('phone') || '').trim(), email: (fd.get('email') || '').trim(), password: p }); done(`${u.name} added. Their ID is ${u.id}.`); } });
  },
  'edit-member'(el) {
    const u = userById(el.dataset.id);
    openModal({ title: 'Edit member', sub: esc(u.id), body: `<div class="field"><label for="emN">Full name</label><input id="emN" name="name" class="input" value="${esc(u.name)}" required></div><div class="form-row"><div class="field"><label for="emW">Ward</label><select id="emW" name="ward" class="select">${wardOpts(u.ward)}</select></div><div class="field"><label for="emP">Phone</label><input id="emP" name="phone" class="input" type="tel" value="${esc(u.phone || '')}"></div></div><div class="form-row"><div class="field"><label for="emE">Email</label><input id="emE" name="email" class="input" type="email" value="${esc(u.email || '')}"></div><div class="field"><label for="emA">Account</label><select id="emA" name="active" class="select">${opt('yes', 'Active', u.active ? 'yes' : 'no')}${opt('no', 'Deactivated', u.active ? 'yes' : 'no')}</select></div></div>`,
      submit: 'Save changes', onSubmit: fd => { const n = (fd.get('name') || '').trim(); if (n.length < 3) throw new Error('Enter the member’s full name.'); API.editMember(u.id, { name: n, ward: fd.get('ward'), phone: (fd.get('phone') || '').trim(), email: (fd.get('email') || '').trim(), active: fd.get('active') }); done('Member updated.'); } });
  },
  'reset-pw'(el) {
    const u = userById(el.dataset.id), pw = 'Vv' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: 'Reset password', sub: `${esc(u.name)} (${esc(u.id)})`, body: `<div class="field"><label for="rpP">New password</label><input id="rpP" name="password" class="input" type="text" value="${pw}" minlength="6" required><span class="hint">Tell the member this password. It is not stored in readable form.</span></div>`, submit: 'Reset password',
      onSubmit: async fd => { const p = fd.get('password') || ''; if (p.length < 6) throw new Error('The password needs at least 6 characters.'); await API.resetPassword(u.id, p); done('Password reset.'); } });
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
  'toggle-pw'(el) { const i = $('#loginPw'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show'; el.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); },
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
    for (const l of LEVIES.filter(x => x.fixed)) { const n = Number(fd.get(l.id)); if (!(n >= 0) || fd.get(l.id) === '') return err(`Enter an amount for ${l.name}.`); vals[l.id] = n; }
    try { API.saveLevies(vals); toast('Levy amounts saved.', 'ok'); renderView(); } catch (e) { err(e.message); }
  }
};

/* ---------- Modals for member and shared actions ---------- */
function uploadModal() {
  if (isAdmin()) return;
  openModal({ title: 'Send proof of payment', sub: 'Pay first, then upload the slip. Your admin will check it against the bank statement.', body: uploadBody('annual'), submit: 'Send for verification',
    onSubmit: async fd => {
      const levy = fd.get('levy'), amount = Number(fd.get('amount')), date = fd.get('date'), ref = (fd.get('ref') || '').trim(), file = fd.get('proof');
      if (!(amount > 0)) throw new Error('Enter the amount you paid.');
      if (!date || date > today()) throw new Error('Choose the date you paid. It cannot be in the future.');
      if (ref.length < 3) throw new Error('Enter the bank reference or teller number from your slip.');
      if (!file || !file.size) throw new Error('Attach a photo or PDF of your proof of payment.');
      const proof = await readProof(file);
      API.submitProof({ levy, amount, date, method: fd.get('method'), ref, note: (fd.get('note') || '').trim(), proof });
      done('Proof sent. Your admin will verify it soon.');
    } });
}
function reportModal(scope) {
  const now = new Date(), village = scope === 'village';
  openModal({ title: village ? 'Download village report' : 'Download my statement', sub: village ? 'Collections and spending for the whole village.' : 'Your own verified payments for the period.', submit: 'Download PDF',
    body: `<div class="form-row"><div class="field"><label for="sKind">Period</label><select id="sKind" name="kind" class="select">${opt('month', 'Monthly', 'month')}${opt('year', 'Yearly', 'month')}</select></div>
    <div class="field"><label for="sYear">Year</label><select id="sYear" name="year" class="select">${yearOpts(String(now.getFullYear()))}</select></div></div>
    <div class="field"><label for="sMonth">Month</label><select id="sMonth" name="month" class="select">${MONTHS.map((m, i) => opt(i, m, now.getMonth())).join('')}</select></div>`,
    onSubmit: fd => { const kind = fd.get('kind'); downloadReport(kind, fd.get('year'), kind === 'year' ? 0 : (fd.get('month') || 0), village ? '' : S.u.id); closeModal(); } });
}
function changePwModal() {
  openModal({ title: 'Change password', body: `<div class="field"><label for="pCur">Current password</label><input id="pCur" name="cur" class="input" type="password" autocomplete="current-password" required></div>
    <div class="field"><label for="pNew">New password</label><input id="pNew" name="nw" class="input" type="password" minlength="6" autocomplete="new-password" required><span class="hint">At least 6 characters.</span></div>
    <div class="field"><label for="pNew2">Repeat new password</label><input id="pNew2" name="nw2" class="input" type="password" autocomplete="new-password" required></div>`, submit: 'Save password',
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
function villageSelectHTML(sel) { return `<option value="" disabled${sel ? '' : ' selected'}>${'Select your village'}</option>` + VILLAGES.map(v => opt(v.id, `${v.name} (${v.code})`, sel)).join(''); }
function fillVillageSelects() {
  $$('[data-village-select]').forEach(s => { s.innerHTML = villageSelectHTML(''); });
  const nav = $('#navVillage'); if (nav) nav.options[0].textContent = 'Your village';
}
function pickVillage(id) {
  const v = VILLAGES.find(x => x.id === id); if (!v) return;
  $$('[data-village-select]').forEach(s => { s.value = id; });
  $('#accessForm').hidden = false; formError('', 'loginError'); updateDemo();
  const box = $('#access'); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
  setTimeout(() => { const i = $('#loginId'); if (i) i.focus({ preventScroll: true }); }, 350);
  $('#nav').classList.remove('open');
}
function focusAccess() { const sel = $('#heroVillage'); $('#access').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => sel.focus({ preventScroll: true }), 350); }
function updateDemo() {
  const box = $('#demoBox'), id = $('#heroVillage').value, v = VILLAGES.find(x => x.id === id);
  if (!CONFIG.DEMO_MODE || !v) { box.hidden = true; return; }
  const c = v.code.toLowerCase(); box.hidden = false;
  box.innerHTML = `<b>Demo access for ${esc(v.name)}</b><br>Admin: <code>${v.code}-A02</code> password <code>${c}-admin</code><br>Member: <code>${v.code}-M001</code> password <code>${c}-member</code><div class="demo-btns"><button type="button" class="btn btn-ghost btn-sm" data-act="demo-fill" data-id="${v.code}-A02" data-pw="${c}-admin">Fill admin</button><button type="button" class="btn btn-ghost btn-sm" data-act="demo-fill" data-id="${v.code}-M001" data-pw="${c}-member">Fill member</button></div>`;
}
async function doLogin(e) {
  e.preventDefault(); const fd = new FormData(e.target), err = m => formError(m, 'loginError'); err('');
  const vid = $('#heroVillage').value, uid = (fd.get('id') || '').trim().toUpperCase(), pw = fd.get('pw') || '';
  if (!vid) return err('Choose your village first.'); if (!uid) return err('Enter your member or admin ID.'); if (!pw) return err('Enter your password.');
  if (Date.now() < lockUntil) return err(`Too many tries. Wait ${Math.ceil((lockUntil - Date.now()) / 1000)} seconds and try again.`);
  const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Opening...';
  try {
    const v = await DB.load(vid), u = v.users.find(x => x.id === uid), h = u ? await hashPw(vid, u.id, pw) : null;
    if (!u || u.hash !== h) { attempts++; if (attempts >= 5) { lockUntil = Date.now() + 30000; attempts = 0; } throw new Error('That ID and password do not match this village. Check them and try again.'); }
    if (v.status === 'suspended') throw new Error('Access to this village is paused. Contact VillageVault support.');
    if (!u.active) throw new Error('This account is deactivated. Contact your village admin.');
    attempts = 0; ssSet('vv_sess', JSON.stringify({ v: vid, u: u.id })); e.target.reset(); enterApp(v, u);
  } catch (ex) { err(ex.message || 'Could not open the dashboard.'); } finally { btn.disabled = false; btn.textContent = 'Open my dashboard'; }
}
function enterApp(v, u) {
  S.v = v; S.u = u; S.owner = false; S.page = 'overview'; S.f = {}; S.tab = 'collections';
  $('#site').hidden = true; $('#app').hidden = false; renderApp(); window.scrollTo(0, 0); toast(`Welcome, ${u.name}.`, 'ok');
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
  $('#villageGrid').innerHTML = VILLAGES.map(v => `<button type="button" class="vcard" style="--vc:${v.color}" data-act="pick-village" data-village="${v.id}"><b>${esc(v.name)}</b><span>${esc(v.code)}, ${esc(v.tag)}</span><em>Open this village</em></button>`).join('');
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
function vlog(v, action, target, detail) {
  v.seq.aud = (v.seq.aud || 0) + 1;
  v.audit.push({ id: 'L' + v.seq.aud, ts: stamp(), adminId: 'SUPPORT', adminName: 'VillageVault support', adminTitle: 'Platform support', action, target, detail });
}
function olog(action, village, detail) {
  OWN.data.log.push({ id: 'O' + (OWN.data.log.length + 1), ts: stamp(), action, village: village || 'All villages', detail });
}
function saveAll(v) { if (v && !DB.save(v)) warnStorage(); OWN.save(); }
const requireOwner = () => { if (!S.owner) throw new Error('Only the owner can do this.'); };
const ADMIN_TITLES = ['President General', 'Financial Secretary', 'Treasurer', 'Secretary', 'Auditor', 'Admin'];

const OWNER_API = {
  async changePassword(cur, nw) {
    requireOwner(); const o = OWN.data;
    if (await hashPw('owner', o.id, cur) !== o.hash) throw new Error('Your current password is not correct.');
    o.hash = await hashPw('owner', o.id, nw); o.defaultPw = false; olog('Changed owner password', '', 'Owner password changed'); OWN.save();
  },
  manageVillage(id, d) {
    requireOwner(); const v = DB.cache[id], vil = VILLAGES.find(x => x.id === id), ch = [];
    if (v.name !== d.name) { ch.push(`Name: ${v.name} to ${d.name}`); v.name = d.name; vil.name = d.name; OWN.data.names[id] = d.name; }
    const was = v.status || 'active'; if (was !== d.status) { ch.push(d.status === 'suspended' ? 'Village access paused' : 'Village access restored'); v.status = d.status; }
    if (!ch.length) throw new Error('Nothing was changed.');
    vlog(v, 'Village settings changed', v.id, ch.join('; ')); olog('Village settings changed', v.name, ch.join('; ') + (d.note ? `. Note: ${d.note}` : '')); saveAll(v);
  },
  async addAdmin(v, d) {
    requireOwner();
    const n = Math.max(0, ...v.users.filter(u => u.role === 'admin').map(u => Number(u.id.split('-A')[1]) || 0)) + 1, id = `${v.code}-A${pad(n)}`;
    const h = await hashPw(v.id, id, d.password);
    v.users.push({ id, name: d.name, role: 'admin', title: d.title, ward: WARDS[0], phone: d.phone, email: '', joined: today(), active: true, hash: h });
    vlog(v, 'Added admin', id, `${d.name} (${d.title})`); olog('Added village admin', v.name, `${d.name} (${id})`); saveAll(v); return id;
  },
  editAdmin(v, id, d) {
    requireOwner(); const u = v.users.find(x => x.id === id && x.role === 'admin'); if (!u) throw new Error('Admin not found.');
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
  S.v = v; S.u = { id: 'SUPPORT', name: 'VillageVault support', role: 'admin', title: 'Platform support', active: true, ward: '', phone: '', joined: today() };
  S.page = 'overview'; S.f = {}; olog('Opened village dashboard', v.name, 'Owner opened the admin dashboard'); OWN.save(); renderApp(); window.scrollTo(0, 0);
}

/* ---------- Owner views ---------- */
function vStats(v) {
  const yr = new Date().getFullYear(), ver = v.tx.filter(t => t.status === 'verified'), ex = v.expenses.filter(e => e.status !== 'void'), pend = v.tx.filter(t => t.status === 'pending');
  return { members: v.users.filter(u => u.role === 'member' && u.active).length, admins: v.users.filter(u => u.role === 'admin' && u.active).length, collected: sum(ver.filter(t => yearOf(t.date) === yr)), spent: sum(ex.filter(e => yearOf(e.date) === yr)), balance: sum(ver) - sum(ex), pending: pend.length, pendingAmt: sum(pend) };
}
const statusBadge = v => (v.status === 'suspended') ? '<span class="badge b-rejected">Paused</span>' : '<span class="badge b-active">Active</span>';
const vDot = vil => `<span class="dot" style="background:${vil.color}"></span>`;

const OWNERV = {
  'o-overview'() {
    const rows = VILLAGES.map(vil => ({ vil, v: DB.cache[vil.id] })).filter(r => r.v).map(r => Object.assign(r, { st: vStats(r.v) })), yr = new Date().getFullYear();
    const tot = k => rows.reduce((a, r) => a + r.st[k], 0), live = rows.filter(r => r.v.status !== 'suspended').length;
    return `${OWN.data.defaultPw ? `<div class="owner-banner"><div><b>Change the default owner password.</b> Anyone who knows it can open every village.</div><button class="btn btn-saffron btn-sm" type="button" data-act="change-pw">Change password</button></div>` : ''}
    <div class="kpis">${kpi('Collected in ' + yr, money(tot('collected')), 'All villages together', 'hot')}${kpi('Waiting for verification', String(tot('pending')), money(tot('pendingAmt')))}${kpi('Active members', String(tot('members')), `${tot('admins')} active admins`)}${kpi('Villages open', `${live} of ${rows.length}`, live < rows.length ? 'Some villages are paused' : 'All villages running')}</div>
    <section class="panel"><div class="panel-h"><div><h2>Collections by village in ${yr}</h2><p>Verified payments only</p></div></div>${barChart(rows.map(r => ({ label: r.vil.code, title: r.v.name, value: r.st.collected })))}</section>
    <section class="panel"><div class="panel-h"><div><h2>Every village at a glance</h2><p>Open any village to work in it with full admin control.</p></div></div>
    ${table(['Village', { t: 'Members', num: true }, { t: 'Collected ' + yr, num: true }, { t: 'Spent ' + yr, num: true }, { t: 'Balance', num: true }, { t: 'Waiting', num: true }, 'Status', ''], rows.map(r => [`${vDot(r.vil)}${esc(r.v.name)}<small>${esc(r.vil.code)}</small>`, String(r.st.members), money(r.st.collected), money(r.st.spent), money(r.st.balance), String(r.st.pending), statusBadge(r.v), `<div class="actions"><button class="btn btn-primary btn-sm" type="button" data-act="owner-open" data-id="${r.vil.id}">Open dashboard</button><button class="btn btn-ghost btn-sm" type="button" data-act="owner-manage" data-id="${r.vil.id}">Manage</button></div>`]), ['No villages loaded', ''])}</section>`;
  },
  'o-villages'() {
    const rows = VILLAGES.map(vil => ({ vil, v: DB.cache[vil.id] })).filter(r => r.v);
    return `<section class="panel"><div class="panel-h"><div><h2>Village settings</h2><p>Rename a village or pause its access. A paused village cannot sign in until you restore it.</p></div></div>
    ${table(['Village', 'Code', { t: 'Admins', num: true }, { t: 'Members', num: true }, 'Access', ''], rows.map(r => { const st = vStats(r.v); return [`${vDot(r.vil)}${esc(r.v.name)}`, esc(r.vil.code), String(st.admins), String(st.members), statusBadge(r.v), `<div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-act="owner-manage" data-id="${r.vil.id}">Rename or pause</button><button class="btn btn-ghost btn-sm" type="button" data-act="owner-admins" data-id="${r.vil.id}">Admins</button><button class="btn btn-primary btn-sm" type="button" data-act="owner-open" data-id="${r.vil.id}">Open</button></div>`]; }), ['No villages', ''])}</section>`;
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
    openModal({ title: `Manage ${v.name}`, sub: 'Renaming changes the name everywhere. Pausing blocks every member and admin of this village from signing in.',
      body: `<div class="field"><label for="omN">Village name</label><input id="omN" name="name" class="input" maxlength="40" value="${esc(v.name)}" required></div>
      <div class="field"><label for="omS">Access</label><select id="omS" name="status" class="select">${opt('active', 'Active', v.status || 'active')}${opt('suspended', 'Paused', v.status || 'active')}</select></div>
      <div class="field"><label for="omNote">Note for your log (optional)</label><input id="omNote" name="note" class="input" maxlength="120"></div>`, submit: 'Save changes',
      onSubmit: fd => { const n = (fd.get('name') || '').trim(); if (n.length < 2) throw new Error('Enter a village name.'); OWNER_API.manageVillage(v.id, { name: n, status: fd.get('status'), note: (fd.get('note') || '').trim() }); fillVillageSelects(); done('Village updated.'); } });
  },
  'o-add-admin'(el) {
    const v = DB.cache[el.dataset.id], pw = 'Ad' + Math.floor(100000 + Math.random() * 899999);
    openModal({ title: `Add an admin to ${v.name}`, sub: 'Give the admin their ID and password. They can change the password after signing in.',
      body: `<div class="field"><label for="oaN">Full name</label><input id="oaN" name="name" class="input" maxlength="80" required></div><div class="form-row"><div class="field"><label for="oaT">Role</label><select id="oaT" name="title" class="select">${ADMIN_TITLES.map(t => opt(t, t, 'Admin')).join('')}</select></div><div class="field"><label for="oaP">Phone</label><input id="oaP" name="phone" class="input" type="tel" maxlength="20"></div></div><div class="field"><label for="oaPw">Starting password</label><input id="oaPw" name="password" class="input" type="text" value="${pw}" minlength="6" required></div>`, submit: 'Add admin',
      onSubmit: async fd => { const n = (fd.get('name') || '').trim(), p = fd.get('password') || ''; if (n.length < 3) throw new Error('Enter the admin’s full name.'); if (p.length < 6) throw new Error('The password needs at least 6 characters.'); const id = await OWNER_API.addAdmin(v, { name: n, title: fd.get('title'), phone: (fd.get('phone') || '').trim(), password: p }); done(`Admin added. Their ID is ${id}.`); } });
  },
  'o-edit-admin'(el) {
    const v = DB.cache[el.dataset.v], u = v.users.find(x => x.id === el.dataset.id);
    openModal({ title: 'Edit admin', sub: `${esc(u.id)}, ${esc(v.name)}`,
      body: `<div class="field"><label for="oeN">Full name</label><input id="oeN" name="name" class="input" value="${esc(u.name)}" required></div><div class="form-row"><div class="field"><label for="oeT">Role</label><select id="oeT" name="title" class="select">${(ADMIN_TITLES.includes(u.title) ? ADMIN_TITLES : ADMIN_TITLES.concat([u.title])).map(t => opt(t, t, u.title)).join('')}</select></div><div class="field"><label for="oeP">Phone</label><input id="oeP" name="phone" class="input" type="tel" value="${esc(u.phone || '')}"></div></div><div class="field"><label for="oeA">Account</label><select id="oeA" name="active" class="select">${opt('yes', 'Active', u.active ? 'yes' : 'no')}${opt('no', 'Deactivated', u.active ? 'yes' : 'no')}</select></div>`, submit: 'Save changes',
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
  const m = userById(t.memberId) || { name: 'Former member', ward: '' };
  return { no: t.receiptNo, village: S.v.name, member: m.name, memberId: t.memberId, ward: m.ward || '', levy: levyOf(t.levy).name, amount: t.amount, date: t.date, method: t.method, ref: t.ref || '-', verifiedBy: t.verifiedBy || '', verifiedAt: t.verifiedAt, issuedBy: t.receiptBy, issuedAt: t.receiptAt };
}
function receiptRows(r) {
  return [['Received from', `${r.member} (${r.memberId})`], ['Levy', r.levy], ['Payment date', fmtDate(r.date)], ['Payment method', r.method], ['Bank reference', r.ref], ['Verified by', `${r.verifiedBy}, ${fmtTS(r.verifiedAt)}`], ['Receipt issued by', `${r.issuedBy}, ${fmtTS(r.issuedAt)}`]];
}

/* ----- PNG (drawn on a canvas, no libraries) ----- */
function receiptPng(r) {
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
      text(`${r.village} Village Union`, 70, 335, { w: 800, s: 38, c: '#1A1A4E', max: W - 140 });
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
      c.toBlob(b => b ? res(b) : rej(new Error('Could not create the image.')), 'image/png');
    } catch (e) { rej(e); }
  });
}

/* ----- PDF (A5, uses the same small PDF writer as the reports) ----- */
function receiptPdf(r) {
  const pdf = new PDF(419.53, 595.28), M = 34, CW = pdf.W - 68, INK = '#14142B', MUT = '#5B5F7A';
  pdf.rect(0, 0, pdf.W, 92, '#1A1A4E'); pdf.rect(0, 92, pdf.W, 5, '#F5B83D');
  pdf.text('VillageVault', M, 32, { size: 10, bold: true, color: '#F5B83D' }); pdf.text(r.no, pdf.W - M, 32, { size: 9, bold: true, color: '#F5B83D', align: 'right' });
  pdf.text('OFFICIAL RECEIPT', M, 68, { size: 22, bold: true, color: '#FFFFFF' });
  pdf.text(`${r.village} Village Union`, M, 126, { size: 14, bold: true, color: '#1A1A4E' });
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
  const t = API.issueReceipt(id), r = receiptData(t), blob = await receiptPng(r), url = URL.createObjectURL(blob);
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
init();
})();
