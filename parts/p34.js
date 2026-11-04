
/* =========================================================
   ROUND 17 (part 1): security pass (two-step nudge, security panel for every admin), onboarding checklist,
   Excel (.xlsx) export, installable offline app (PWA).
   Persistent, escalating sign-in lockouts and the hidden owner password are in p1, p6 and p7.
   NOTE: everything here runs in the browser. It deters casual misuse only. Real protection needs the server.
   ========================================================= */

/* ---------- Security: two-step sign-in for the people who handle money ---------- */
const moneyRole = () => !!S.u && !S.owner && S.u.role === 'admin' && S.u.id !== 'SUPPORT' && (!!S.u.lead || ['Chairman', 'Financial Secretary', 'Treasurer'].includes(S.u.title));
const hasTwoStep = () => !!(S.u && S.u.totp && S.u.totp.secret);
const secSnoozeKey = () => `vv_secsnooze_${S.v.id}_${S.u.id}`;
const secSnoozed = () => { try { return Number(lsGet(secSnoozeKey()) || 0) > Date.now(); } catch (_) { return false; } };
function securityBanner() {
  if (!moneyRole() || hasTwoStep() || secSnoozed() || S.demo) return '';
  return `<div class="callout upgrade"><div><b>Protect the village money: turn on two-step sign-in</b><p>You handle payments for ${esc(S.v.name)}. With two-step sign-in a stolen password is not enough to open your account. It takes two minutes with a free authenticator app.</p></div><div class="btn-row"><button class="btn btn-saffron btn-sm" type="button" data-act="sec-open">Turn it on</button><button class="btn btn-ghost btn-sm" type="button" data-act="sec-later">Not now</button></div></div>`;
}
Object.assign(ACTIONS, {
  'sec-open'() {
    if (!S.u || S.owner) return;
    infoModal('Security', `${esc(S.u.name)}, ${esc(S.u.title || 'Admin')}`, `<ul class="ticks" style="margin-top:12px"><li>${S.defaultPw ? '<b>Change your starting password.</b> Anyone who knows the village starter password can sign in as you.' : 'You use your own password.'}</li><li>${hasTwoStep() ? 'Two-step sign-in is on.' : 'Two-step sign-in is off. Turn it on below.'}</li><li>Three wrong tries lock the account for a minute. Repeated lockouts last longer, even in a new tab.</li></ul>${S.defaultPw ? '<div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="change-pw">Change password</button></div>' : ''}${twoStepPanel(S.u, false)}`);
  },
  'sec-later'() { try { lsSet(secSnoozeKey(), String(Date.now() + 7 * 864e5)); } catch (_) {} renderView(); }
});

/* ---------- Onboarding checklist for admins ---------- */
const onbKey = () => `vv_onb_${S.v.id}_${S.u.id}`;
function onbSteps() {
  const v = S.v, prem = v.plan === 'premium', fin = typeof isFinSec === 'function' && isFinSec();
  const s = [
    { done: !S.defaultPw, t: 'Choose your own password', d: 'The starter password is known to others.', a: 'change-pw', b: 'Change password' },
    { done: hasTwoStep(), t: 'Turn on two-step sign-in', d: 'Strongly advised for the Chairman, Financial Secretary and Treasurer.', a: 'sec-open', b: 'Open security', skip: !moneyRole() },
    { done: (v.settings.accounts || []).some(a => a.number), t: 'Add the village bank account', d: 'Members need it to pay. It is also printed on notices.', a: 'edit-accounts', b: 'Add bank details' },
    { done: v.users.filter(u => u.role === 'member' && u.active).length >= 3, t: 'Add your members', d: 'One by one, or import a list from Excel (Premium).', a: 'goto', page: 'members', b: 'Open members' },
    { done: !!v.logo, t: 'Add your village logo', d: 'It appears on receipts, certificates and ID cards.', a: 'goto', page: 'profile', b: 'Open village profile' },
    { done: (v.meetings || []).length > 0, t: 'Open the first attendance register', d: fin ? 'Open it on the day of the meeting.' : 'The Financial Secretary opens the register on meeting days.', a: 'goto', page: 'register', b: 'Open register' },
    { done: v.tx.some(t => t.status === 'verified'), t: 'Verify the first payment', d: 'A member uploads proof, an admin verifies it.', a: 'goto', page: 'verify', b: 'Open verify payments' }
  ];
  if (prem) s.push({ done: (v.notices || []).length > 0, t: 'Post your first notice', d: 'Members see it on their dashboard.', a: 'goto', page: 'notices', b: 'Open notice board' });
  return s.filter(x => !x.skip);
}
function onboardCard() {
  if (!S.u || S.owner || S.u.role !== 'admin' || S.u.id === 'SUPPORT' || S.demo) return ''; let hidden = ''; try { hidden = lsGet(onbKey()) || ''; } catch (_) {}
  const st = onbSteps(), done = st.filter(x => x.done).length; if (hidden === 'hide' || (done === st.length && hidden === 'seen')) return '';
  if (done === st.length) { try { lsSet(onbKey(), 'seen'); } catch (_) {} return `<div class="callout"><div><b>Your village is set up</b><p>All ${st.length} steps are done. Well done.</p></div></div>`; }
  const next = st.find(x => !x.done);
  return `<section class="panel onb"><div class="panel-h"><div><h2>Get ${esc(S.v.name)} ready</h2><p>${done} of ${st.length} steps done. A few minutes now saves hours later.</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="onb-hide">Hide</button></div>${bar(Math.round(done * 100 / st.length))}
  <ul class="onb-list">${st.map(x => `<li class="${x.done ? 'is-done' : x === next ? 'is-next' : ''}"><span class="onb-dot" aria-hidden="true">${x.done ? '&#10003;' : ''}</span><div><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div>${x.done ? '<span class="badge b-verified">Done</span>' : `<button class="btn ${x === next ? 'btn-primary' : 'btn-ghost'} btn-sm" type="button" data-act="${x.a}"${x.page ? ` data-page="${x.page}"` : ''}>${esc(x.b)}</button>`}</li>`).join('')}</ul></section>`;
}
ACTIONS['onb-hide'] = function () { try { lsSet(onbKey(), 'hide'); } catch (_) {} renderView(); };

/* ---------- Excel (.xlsx) export, no library ---------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {
  const enc = new TextEncoder(), u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255], out = [], cd = []; let off = 0;
  files.forEach(f => {
    const nm = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data), sz = data.length;
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)]);
    out.push(lh, nm, data); cd.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
    off += lh.length + nm.length + sz;
  });
  const cdSize = cd.reduce((a, x) => a + x.length, 0);
  return new Blob([...out, ...cd, new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), 0, 0])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xe = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xcol = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const xserial = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000) : null; };
function sheetXml(sh) {
  const cols = sh.cols, rows = sh.rows, last = xcol(cols.length - 1) + (rows.length + 1);
  const hdr = `<row r="1">${cols.map((c, i) => `<c r="${xcol(i)}1" s="1" t="inlineStr"><is><t>${xe(c.h)}</t></is></c>`).join('')}</row>`;
  const body = rows.map((r, ri) => `<row r="${ri + 2}">${cols.map((c, i) => { const v = r[i], ref = xcol(i) + (ri + 2); if (v === '' || v == null) return ''; if (c.t === 'date') { const n = xserial(v); if (n != null) return `<c r="${ref}" s="3"><v>${n}</v></c>`; } if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${c.t === 'money' ? ' s="2"' : ''}><v>${v}</v></c>`; return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`; }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 16}" customWidth="1"/>`).join('')}</cols><sheetData>${hdr}${body}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}
function makeXlsx(sheets) {
  const names = sheets.map((s, i) => xe(String(s.name).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Sheet' + (i + 1)));
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1A1A4E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
  ].concat(sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })));
  return zipStore(files);
}
const XL_KINDS = {
  transactions() { return { name: 'Payments', cols: [{ h: 'Date', w: 12, t: 'date' }, { h: 'Receipt no', w: 16 }, { h: 'Member ID', w: 14 }, { h: 'Member', w: 26 }, { h: 'Levy', w: 20 }, { h: 'Amount (NGN)', w: 14, t: 'money' }, { h: 'Method', w: 20 }, { h: 'Reference', w: 16 }, { h: 'Status', w: 11 }, { h: 'Checked by', w: 22 }, { h: 'Note', w: 28 }], rows: S.v.tx.slice().sort((a, b) => String(a.date).localeCompare(b.date) || a.id.localeCompare(b.id)).map(t => [t.date, t.receiptNo || '', t.memberId, nameOf(t.memberId), levyOf(t.levy).name, t.amount, t.method || '', t.ref || '', t.status, t.verifiedBy || '', t.note || '']) }; },
  owing() { const yr = new Date().getFullYear(), list = owingList(yr, {}), lv = levyAll().filter(l => list.some(it => it.rows.some(r => r.L.id === l.id && r.owe > 0)));
    return { name: `Owing ${yr}`, cols: [{ h: 'Member ID', w: 14 }, { h: 'Member', w: 26 }, { h: 'Family', w: 18 }, { h: 'Kindred', w: 18 }, { h: 'Phone', w: 15 }].concat(lv.map(l => ({ h: l.name + ' (NGN)', w: 18, t: 'money' }))).concat([{ h: 'Total owed (NGN)', w: 16, t: 'money' }]), rows: list.map(it => [it.u.id, it.u.name, it.u.family || '', it.u.kindred || '', it.u.phone || ''].concat(lv.map(l => { const r = it.rows.find(x => x.L.id === l.id); return r && r.owe > 0 ? r.owe : ''; })).concat([it.owe])) }; },
  members() { return { name: 'Members', cols: [{ h: 'ID', w: 14 }, { h: 'Name', w: 26 }, { h: 'Role', w: 20 }, { h: 'Family', w: 18 }, { h: 'Kindred', w: 18 }, { h: 'Phone', w: 15 }, { h: 'Email', w: 26 }, { h: 'Joined', w: 12, t: 'date' }, { h: 'Account', w: 12 }], rows: S.v.users.filter(u => ['member', 'admin'].includes(u.role)).map(u => [u.id, u.name, u.role === 'admin' ? (u.title || 'Admin') : 'Member', u.family || '', u.kindred || '', u.phone || '', u.email || '', u.joined || '', u.active ? 'Active' : 'Deactivated']) }; },
  expenses() { return { name: 'Expenditure', cols: [{ h: 'Date', w: 12, t: 'date' }, { h: 'Category', w: 22 }, { h: 'Description', w: 40 }, { h: 'Amount (NGN)', w: 14, t: 'money' }, { h: 'Status', w: 10 }, { h: 'Recorded by', w: 22 }], rows: S.v.expenses.slice().sort((a, b) => String(a.date).localeCompare(b.date)).map(e => [e.date, e.category, e.description, e.amount, e.status === 'void' ? 'Voided' : 'Active', e.createdBy || '']) }; },
  attendance() { const rows = []; S.v.meetings.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(m => m.marks.forEach(k => rows.push([m.date, m.title, k.memberId, nameOf(k.memberId), k.status === 'verified' ? 'Present (verified)' : 'Waiting for a second admin', k.by || '']))); return { name: 'Attendance', cols: [{ h: 'Meeting date', w: 14, t: 'date' }, { h: 'Meeting', w: 28 }, { h: 'Member ID', w: 14 }, { h: 'Member', w: 26 }, { h: 'Status', w: 28 }, { h: 'Verified by', w: 22 }], rows }; }
};
const XL_PAGES = { transactions: 'transactions', outstanding: 'owing', members: 'members', expenses: 'expenses', register: 'attendance' };
function xlDownload(kinds, label) {
  requireAdmin(); const sheets = kinds.map(k => XL_KINDS[k]()); const n = sheets.reduce((a, s) => a + s.rows.length, 0);
  download(`${S.v.code}-${label}-${today()}.xlsx`, makeXlsx(sheets)); log('Exported to Excel', label, `${n} row${n === 1 ? '' : 's'} in ${sheets.length} sheet${sheets.length === 1 ? '' : 's'}`); commit(); return n;
}
Object.assign(ACTIONS, {
  'xl'(el) { try { const k = el.dataset.k, n = xlDownload([k], k === 'owing' ? 'owing' : k); toast(`Excel file downloaded (${n} rows).`, 'ok'); } catch (ex) { toast(ex.message, 'err'); } },
  'xl-all'() { try { const n = xlDownload(['members', 'transactions', 'owing', 'expenses', 'attendance'], 'all-records'); toast(`Excel workbook downloaded (${n} rows).`, 'ok'); } catch (ex) { toast(ex.message, 'err'); } }
});
Object.keys(XL_PAGES).forEach(pg => { const orig = VIEWS.admin[pg]; if (orig) VIEWS.admin[pg] = function () { return `<div class="export-bar"><button class="btn btn-ghost btn-sm" type="button" data-act="xl" data-k="${XL_PAGES[pg]}">Export to Excel</button></div>` + orig.apply(this, arguments); }; });
{ const orig = VIEWS.admin.reports; if (orig) VIEWS.admin.reports = function () { return `<div class="export-bar"><button class="btn btn-ghost btn-sm" type="button" data-act="xl-all">Export all records to Excel</button></div>` + orig.apply(this, arguments); }; }

/* ---------- Installable app that keeps working offline ---------- */
let INSTALL = null;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream, isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const canInstall = () => !isStandalone() && (!!INSTALL || isIOS());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL = e; try { addInstallLink(); if (S.u || S.owner) renderNavInstall(); } catch (_) {} });
window.addEventListener('appinstalled', () => { INSTALL = null; $$('[data-act=install-app]').forEach(b => b.remove()); toast('VillageVault is installed on this device.', 'ok'); });
function addInstallLink() { const f = $('.footer-in'); if (f && canInstall() && !$('#installLink')) f.insertAdjacentHTML('beforeend', '<button class="linkbtn" type="button" id="installLink" data-act="install-app" style="color:#fff">Install the app on this phone</button>'); }
function renderNavInstall() { const f = $('.side-foot'); if (f && canInstall() && !$('.side-foot [data-act=install-app]')) f.insertAdjacentHTML('afterbegin', '<button class="btn-out" type="button" data-act="install-app">Install app on this device</button>'); }
ACTIONS['install-app'] = async function () {
  if (INSTALL) { try { INSTALL.prompt(); await INSTALL.userChoice; } catch (_) {} INSTALL = null; return; }
  if (isIOS()) return infoModal('Install on iPhone or iPad', 'Two taps in Safari', '<ol class="ticks" style="margin-top:12px"><li>Tap the Share button at the bottom of Safari.</li><li>Choose <b>Add to Home Screen</b>, then tap Add.</li></ol><p class="hint">VillageVault then opens like an app and keeps working when the signal drops.</p>');
  toast('Use your browser menu and choose Install app or Add to Home screen.', 'ok');
};
function netChip(on) {
  let c = $('#netChip'); if (!c) { c = document.createElement('div'); c.id = 'netChip'; c.setAttribute('role', 'status'); document.body.appendChild(c); }
  c.textContent = on ? 'Back online' : 'You are offline. Your records are safe on this device and the app keeps working.'; c.className = on ? 'net-on' : 'net-off'; c.hidden = false; if (on) setTimeout(() => { c.hidden = true; }, 2500);
}
window.addEventListener('offline', () => netChip(false)); window.addEventListener('online', () => netChip(true));
if (typeof navigator !== 'undefined' && navigator.onLine === false) setTimeout(() => netChip(false), 500);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
setTimeout(() => { try { addInstallLink(); } catch (_) {} }, 600);
{ const _ra = renderApp; renderApp = function () { const r = _ra.apply(this, arguments); try { renderNavInstall(); } catch (_) {} return r; }; }

/* ---------- Dashboard wiring ---------- */
{ const _ao = VIEWS.admin.overview; VIEWS.admin.overview = function () { return securityBanner() + onboardCard() + _ao.apply(this, arguments); }; }
