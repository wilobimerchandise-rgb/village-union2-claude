/* =========================================================
   ROUND 14 (part 1): QR codes (own encoder, no library), Premium plan rules for the new features,
   good standing certificate, member village reports and the one-tap AGM report.
   ========================================================= */

/* ---------- QR code encoder: byte mode, versions 1 to 14, error correction M (L if M is too small) ---------- */
const QR = (function () {
  // [ecPerBlock, [[blocks, dataPerBlock], ...]] for versions 1..14
  const T = { M: [null, [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]], [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]], [30, [[1, 50], [4, 51]]], [22, [[6, 36], [2, 37]]], [22, [[8, 37], [1, 38]]], [24, [[4, 40], [5, 41]]]],
    L: [null, [7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]], [20, [[1, 80]]], [26, [[1, 108]]], [18, [[2, 68]]], [20, [[2, 78]]], [24, [[2, 97]]], [30, [[2, 116]]], [18, [[2, 68], [2, 69]]], [20, [[4, 81]]], [24, [[2, 92], [2, 93]]], [26, [[4, 107]]], [30, [[3, 115], [1, 116]]]] };
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66]];
  const EXP = new Array(512), LOG = new Array(256); { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
  function rsGen(n) { let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; } return g; }
  function rsRem(data, n) { const g = rsGen(n), r = new Array(n).fill(0); data.forEach(b => { const f = b ^ r.shift(); r.push(0); if (f) for (let i = 0; i < n; i++) r[i] ^= mul(g[i + 1], f); }); return r; }
  const dataCap = (lv, v) => T[lv][v][1].reduce((a, [n, d]) => a + n * d, 0);
  function utf8(s) { return Array.from(unescape(encodeURIComponent(s))).map(c => c.charCodeAt(0)); }
  function bch(v, poly, deg) { let d = v << deg; const top = Math.floor(Math.log2(poly)); for (let i = Math.floor(Math.log2(d || 1)); i >= top; i--) if (d & (1 << i)) d ^= poly << (i - top); return d; }
  function build(text) {
    const bytes = utf8(text); let lv = 'M', ver = 0;
    for (const L of ['M', 'L']) { for (let v = 1; v <= 14; v++) { const bits = 4 + (v < 10 ? 8 : 16) + 8 * bytes.length; if (Math.ceil(bits / 8) <= dataCap(L, v)) { lv = L; ver = v; break; } } if (ver) break; }
    if (!ver) throw new Error('Too much text for the QR code.');
    const cap = dataCap(lv, ver), bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8)); put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2)); for (let pad = 0xEC; cw.length < cap; pad ^= 0xEC ^ 0x11) cw.push(pad);
    const [ec, groups] = T[lv][ver], blocks = []; let pos = 0; groups.forEach(([n, d]) => { for (let i = 0; i < n; i++) { const dd = cw.slice(pos, pos + d); pos += d; blocks.push({ d: dd, e: rsRem(dd, ec) }); } });
    const out = []; const maxD = Math.max(...blocks.map(b => b.d.length)); for (let i = 0; i < maxD; i++) blocks.forEach(b => { if (i < b.d.length) out.push(b.d[i]); }); for (let i = 0; i < ec; i++) blocks.forEach(b => out.push(b.e[i]));
    const n = 17 + 4 * ver, M = Array.from({ length: n }, () => new Array(n).fill(null)), F = Array.from({ length: n }, () => new Array(n).fill(false));
    const set = (r, c, v) => { M[r][c] = v; F[r][c] = true; };
    const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const rr = r0 + r, cc = c0 + c; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue; const d = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4); set(rr, cc, d); } };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const ap = ALIGN[ver]; ap.forEach(r => ap.forEach(c => { if ((r < 9 && c < 9) || (r < 9 && c > n - 10) || (r > n - 10 && c < 9)) return; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1); }));
    set(n - 8, 8, true);
    for (let i = 0; i < 9; i++) { if (!F[8][i]) set(8, i, false); if (!F[i][8]) set(i, 8, false); } for (let i = 0; i < 8; i++) { if (!F[8][n - 1 - i]) set(8, n - 1 - i, false); if (!F[n - 1 - i][8]) set(n - 1 - i, 8, false); }
    if (ver >= 7) { const vi = (ver << 12) | bch(ver, 0x1F25, 12); for (let i = 0; i < 18; i++) { const b = ((vi >> i) & 1) === 1, a = n - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, b); set(c, a, b); } }
    const dbits = []; out.forEach(b => { for (let i = 7; i >= 0; i--) dbits.push((b >> i) & 1); });
    const place = mask => { const Q = M.map(r => r.slice()); let k = 0, up = true; for (let c = n - 1; c > 0; c -= 2) { if (c === 6) c--; for (let i = 0; i < n; i++) { const r = up ? n - 1 - i : i; for (let j = 0; j < 2; j++) { const cc = c - j; if (F[r][cc]) continue; let bit = k < dbits.length ? dbits[k] : 0; k++; const m = [(r + cc) % 2 === 0, r % 2 === 0, cc % 3 === 0, (r + cc) % 3 === 0, (Math.floor(r / 2) + Math.floor(cc / 3)) % 2 === 0, (r * cc) % 2 + (r * cc) % 3 === 0, ((r * cc) % 2 + (r * cc) % 3) % 2 === 0, ((r + cc) % 2 + (r * cc) % 3) % 2 === 0][mask]; Q[r][cc] = m ? !bit : !!bit; } } up = !up; }
      const fmt = ((lv === 'L' ? 1 : 0) << 3 | mask), fb = ((fmt << 10) | bch(fmt, 0x537, 10)) ^ 0x5412, g = i => ((fb >> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) Q[i][8] = g(i); Q[7][8] = g(6); Q[8][8] = g(7); Q[8][7] = g(8); for (let i = 9; i < 15; i++) Q[8][14 - i] = g(i);
      for (let i = 0; i < 8; i++) Q[8][n - 1 - i] = g(i); for (let i = 8; i < 15; i++) Q[n - 15 + i][8] = g(i); Q[n - 8][8] = true; return Q; };
    const pen = Q => { let p = 0; for (let t = 0; t < 2; t++) { for (let a = 0; a < n; a++) { let run = 1; for (let b = 1; b < n; b++) { const x = t ? Q[b][a] : Q[a][b], y = t ? Q[b - 1][a] : Q[a][b - 1]; if (x === y) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } } }
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (Q[r][c] === Q[r][c + 1] && Q[r][c] === Q[r + 1][c] && Q[r][c] === Q[r + 1][c + 1]) p += 3;
      const pat = [true, false, true, true, true, false, true, false, false, false, false], pat2 = pat.slice().reverse(); for (let r = 0; r < n; r++) for (let c = 0; c <= n - 11; c++) { let a = true, b = true, a2 = true, b2 = true; for (let k = 0; k < 11; k++) { if (Q[r][c + k] !== pat[k]) a = false; if (Q[r][c + k] !== pat2[k]) b = false; if (Q[c + k][r] !== pat[k]) a2 = false; if (Q[c + k][r] !== pat2[k]) b2 = false; } if (a || b) p += 40; if (a2 || b2) p += 40; }
      let dark = 0; Q.forEach(r => r.forEach(v => { if (v) dark++; })); p += 10 * Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5); return p; };
    let best = null, bp = Infinity; for (let m = 0; m < 8; m++) { const Q = place(m), p = pen(Q); if (p < bp) { bp = p; best = Q; } }
    return { n, ver, level: lv, rows: best.map(r => r.map(v => !!v)) };
  }
  return { build };
})();
/* draws a QR through any drawing adapter (PDF or canvas): runs of dark modules become one rectangle */
function drawQR(A, text, x, y, size, ink) {
  const q = QR.build(text), quiet = 4, mod = size / (q.n + 2 * quiet); A.rect(x, y, size, size, '#FFFFFF');
  q.rows.forEach((row, r) => { let c = 0; while (c < q.n) { if (!row[c]) { c++; continue; } let e = c; while (e < q.n && row[e]) e++; A.rect(x + (quiet + c) * mod, y + (quiet + r) * mod, (e - c) * mod + 0.15, mod + 0.15, ink || '#14142B'); c = e; } });
  return q;
}

/* ---------- Plan rules for the new Premium features ---------- */
['terms', 'agenda', 'memberReports', 'agm', 'standing', 'emergency', 'projects', 'celebrations'].forEach(k => { PLAN_RULES.basic[k] = false; PLAN_RULES.premium[k] = true; });
const premiumGate = (title, text) => `<section class="panel"><div class="panel-h"><div><h2>${esc(title)} ${premiumBadge}</h2><p>${text} ${S.u && S.u.role === 'admin' ? 'Tap the Premium badge to see what you get and upgrade.' : 'Ask your admin to upgrade.'}</p></div></div>${upgradeBtn()}</section>${typeof samplePreview === 'function' ? samplePreview(title) : ''}`;
const holderName = t => { const h = holderOf(t); return h ? h.name : ''; };
async function hash12(text) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return Array.from(new Uint8Array(b)).slice(0, 6).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase(); } catch (_) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).toUpperCase().padStart(8, '0') + '0000'; } }
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- A small writer for multi-page PDF documents (AGM report, agenda, handover pack, project report) ---------- */
function docWriter(title, sub, ref) {
  const pdf = new PDF(), M = 40, CW = pdf.W - 80, INK = '#14142B', MUT = '#5B5F7A', vname = S.v.name;
  pdf.rect(0, 0, pdf.W, 118, '#1A1A4E'); pdf.rect(0, 118, pdf.W, 5, '#F5B83D');
  pdf.text(pdf.fit(`${vname} (${S.v.code})`, CW - 150, 10, true), M, 38, { size: 10, bold: true, color: '#F5B83D' });
  if (S.v.logo) pdf.img(S.v.logo, pdf.W - M - 50, 52, 50, 50);
  if (ref) pdf.text(ref, pdf.W - M, 38, { size: 9, color: '#DADCF5', align: 'right' });
  pdf.text(pdf.fit(title, CW - 60, 22, true), M, 72, { size: 22, bold: true, color: '#FFFFFF' }); pdf.text(pdf.fit(sub || '', CW - 60, 12), M, 96, { size: 12, color: '#DADCF5' });
  let y = 148;
  const newPage = () => { pdf.add(); pdf.rect(0, 0, pdf.W, 26, '#1A1A4E'); pdf.text(pdf.fit(`${vname} | ${title}`, CW, 8), M, 17, { size: 8, color: '#DADCF5' }); y = 52; };
  const ensure = h => { if (y + h > pdf.H - 56) newPage(); };
  const W = {
    section(t) { y += 8; ensure(60); pdf.text(t, M, y + 4, { size: 12.5, bold: true, color: '#1A1A4E' }); y += 14; pdf.line(M, y, M + CW, y, '#1A1A4E', 1); y += 8; },
    para(t, o) { o = o || {}; const A = pdfAdapter(pdf); wrapLines(A, t, CW, o.size || 10).forEach(l => { ensure(15); pdf.text(l, M, y + 9, { size: o.size || 10, bold: !!o.bold, color: o.color || INK }); y += (o.size || 10) + 4; }); y += 4; },
    kv(rows) { rows.forEach(([k, v]) => { ensure(17); pdf.text(k, M, y + 10, { size: 9.5, bold: true, color: MUT }); pdf.text(pdf.fit(String(v), CW - 170, 10), M + 170, y + 10, { size: 10, color: INK }); y += 17; }); y += 6; },
    table(cols, rows) {
      const rh = 17, head = () => { pdf.rect(M, y, CW, rh, '#EEF2F0'); let x = M; cols.forEach(c => { pdf.text(c.h, c.align === 'right' ? x + c.w - 6 : x + 6, y + rh - 5.5, { size: 8, bold: true, color: MUT, align: c.align === 'right' ? 'right' : 'left' }); x += c.w; }); y += rh; };
      ensure(rh * 3); head();
      if (!rows.length) { pdf.text('Nothing to show.', M + 6, y + 12, { size: 9, color: MUT }); y += rh; }
      rows.forEach((r, i) => { const cells = r.cells || r; if (y + rh > pdf.H - 56) { newPage(); head(); } if (r.total) pdf.rect(M, y, CW, rh, '#F6EFD8'); else if (i % 2) pdf.rect(M, y, CW, rh, '#FAFCFB'); let x = M; cols.forEach((c, k) => { const s = pdf.fit(String(cells[k] == null ? '' : cells[k]), c.w - 12, 8.5, !!r.total); pdf.text(s, c.align === 'right' ? x + c.w - 6 : x + 6, y + rh - 5.5, { size: 8.5, bold: !!r.total, color: INK, align: c.align === 'right' ? 'right' : 'left' }); x += c.w; }); y += rh; });
      y += 10;
    },
    sign(names) { ensure(70); const n = names.length, w = Math.min(180, (CW - 20 * (n - 1)) / n); names.forEach(([role, nm], i) => { const x = M + i * (w + 20); pdf.line(x, y + 30, x + w, y + 30, '#14142B', .8); pdf.text(pdf.fit(nm || '', w, 9, true), x, y + 42, { size: 9, bold: true, color: INK }); pdf.text(role, x, y + 54, { size: 8.5, color: MUT }); }); y += 70; },
    space(n) { y += n; },
    build() { const n = pdf.pages.length; pdf.pages.forEach((pg, i) => { pdf.p = pg; pdf.line(M, pdf.H - 42, M + CW, pdf.H - 42, '#DCE3E0'); pdf.text(pdf.fit(`Generated by ${S.u.name} (${S.u.title || 'Admin'}) on ${fmtTS(stamp())}. Verified payments only.`, CW - 70, 7.5), M, pdf.H - 28, { size: 7.5, color: MUT }); pdf.text(`Page ${i + 1} of ${n}`, M + CW, pdf.H - 28, { size: 7.5, color: MUT, align: 'right' }); }); return pdf.build(title); }
  };
  return W;
}
const naira = n => '₦' + Math.round(n).toLocaleString('en-US');

/* ---------- Good standing certificate with a QR code ---------- */
function certText(c) {
  const kin = c.kindred || c.family ? `Family:${c.family || '-'} Kindred:${c.kindred || '-'}\n` : '';
  return `VILLAGEVAULT GOOD STANDING\nNo:${c.no}\nName:${c.name}\nID:${c.memberId} (${c.title})\nOrg:${c.org} (${c.code})\n${kin}Tel:${c.phone || '-'}\nEmail:${c.email || '-'}\nJoined:${c.joined}\nPaid ${c.year}:NGN ${c.paid}  Owing:NGN 0\nIssued:${c.issuedOn}  Valid to:${c.validTo}\nCode:${c.code12}`;
}
function drawCertificate(A, c, r) {
  const W = A.W, H = A.H, M = 48, CW = W - 2 * M, NAVY = '#1A1A4E', GOLD = '#C9962B', GOLD2 = '#F5B83D', INK = '#14142B', MUT = '#5B5F7A', LINE = '#E2E2EE';
  A.strokeRect(16, 16, W - 32, H - 32, GOLD, 1.6); A.strokeRect(21, 21, W - 42, H - 42, NAVY, .5);
  A.rect(21, 21, W - 42, 116, NAVY); A.rect(21, 137, W - 42, 4, GOLD2); A.rect(M, 42, 72, 72, '#FFFFFF');
  if (r.logo) A.img(r.logo, M + 4, 46, 64, 64, 200, 200); else { A.rect(M + 4, 46, 64, 64, GOLD2); A.text(c.code, M + 36, 86, { size: 18, bold: true, color: NAVY, align: 'center' }); }
  const nx = M + 90, nw = CW - 90 - 10; let ns = 22; while (ns > 14 && A.width(c.org, ns, true) > nw) ns -= 1;
  const nl = A.width(c.org, ns, true) > nw ? wrapLines(A, c.org, nw, 15).slice(0, 2) : [c.org];
  if (nl.length > 1) { A.text(nl[0], nx, 74, { size: 15, bold: true, color: '#FFFFFF' }); A.text(nl[1], nx, 92, { size: 15, bold: true, color: '#FFFFFF' }); } else A.text(nl[0], nx, 84, { size: ns, bold: true, color: '#FFFFFF' });
  A.text(c.no, W - M, 128, { size: 9, bold: true, color: GOLD2, align: 'right' });
  A.text('CERTIFICATE OF GOOD STANDING', W / 2, 190, { size: 22, bold: true, color: NAVY, align: 'center' }); A.line(W / 2 - 90, 202, W / 2 + 90, 202, GOLD2, 2);
  let y = 232; wrapLines(A, `This is to certify that ${c.name} (${c.memberId}), ${c.title} of ${c.org}, is a member in good standing. Every levy and pledge due for ${c.year} has been paid and verified by the admins as at ${fmtDate(c.issuedOn)}.`, CW, 11.5).forEach(l => { A.text(l, M, y, { size: 11.5, color: INK }); y += 17; });
  y += 14; const cells = [['Full name', c.name], ['Member ID', c.memberId], ['Role', c.title], ['Village or association', c.org + ' (' + c.code + ')']];
  if (c.family || c.kindred) { cells.push(['Family', c.family || '-'], ['Kindred', c.kindred || '-']); }
  cells.push(['Phone', c.phone || '-'], ['Email', c.email || '-'], ['Member since', fmtDate(c.joined)], ['Paid in ' + c.year, naira(c.paid)], ['Outstanding', naira(0)], ['Issued', fmtDate(c.issuedOn)], ['Valid until', fmtDate(c.validTo)]);
  const cw = (CW - 20) / 2; cells.forEach((k, i) => { const cx = M + (i % 2) * (cw + 20), cy = y + Math.floor(i / 2) * 42; A.text(k[0], cx, cy, { size: 8, color: MUT }); A.text(A.fit(k[1], cw, 11.5, true), cx, cy + 16, { size: 11.5, bold: true, color: INK }); A.line(cx, cy + 24, cx + cw, cy + 24, LINE, .6); });
  const qy = H - 255; drawQR(A, certText(c), W - M - 150, qy, 150, NAVY); A.text('Scan for the full details', W - M - 75, qy + 160, { size: 8, color: MUT, align: 'center' });
  const sy = qy + 80, sw = 170; [['Chairman', r.chair], ['Financial Secretary', r.fin]].forEach(([role, p], i) => { const sx = M + i * 0, yy = sy + i * 0; });
  A.line(M, qy + 70, M + sw, qy + 70, INK, .8); A.text(A.fit(r.chair ? r.chair.name : '', sw, 9.5, true), M, qy + 83, { size: 9.5, bold: true, color: INK }); A.text('Chairman', M, qy + 95, { size: 8.5, color: MUT });
  A.line(M, qy + 125, M + sw, qy + 125, INK, .8); A.text(A.fit(r.fin ? r.fin.name : '', sw, 9.5, true), M, qy + 138, { size: 9.5, bold: true, color: INK }); A.text('Financial Secretary', M, qy + 150, { size: 8.5, color: MUT });
  if (r.chair && r.chair.sig) A.img(r.chair.sig, M, qy + 28, 120, 40, 360, 120); if (r.fin && r.fin.sig) A.img(r.fin.sig, M, qy + 83, 120, 40, 360, 120);
  A.line(M, H - 70, W - M, H - 70, LINE, .8); A.text(`Certificate code ${c.code12}. Check the number with the ${c.org} records. A certificate is not valid after ${fmtDate(c.validTo)} or if it has been withdrawn.`, W / 2, H - 52, { size: 7, color: MUT, align: 'center' });
}
function certView(c) {
  const ch = holderOf('Chairman'), fs = holderOf('Financial Secretary');
  return { logo: S.v.plan === 'premium' ? S.v.logo : null, chair: ch ? { name: ch.name, sig: ch.signature || null } : null, fin: fs ? { name: fs.name, sig: fs.signature || null } : null };
}
async function certPdf(c) { const pdf = new PDF(); drawCertificate(pdfAdapter(pdf), c, certView(c)); return pdf.build(`Good standing ${c.no}`); }
async function certPng(c) {
  const r = certView(c), urls = [r.logo, r.chair && r.chair.sig, r.fin && r.fin.sig].filter(Boolean), imgs = {}; for (const u of urls) { try { imgs[u] = await loadImg(u); } catch (_) {} }
  const PW = 595.28, PH = 841.89, k = 1240 / PW, cv = document.createElement('canvas'); cv.width = 1240; cv.height = Math.round(PH * k); const g = cv.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height);
  drawCertificate(canvasAdapter(g, k, PW, PH, imgs), c, r); return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('Could not create the image.')), 'image/png'));
}
const certStatus = c => c.revoked ? 'Withdrawn' : (c.validTo < today() ? 'Expired' : 'Valid');
Object.assign(API, {
  async issueCertificate(memberId) {
    if (!S.u || S.owner) throw new Error('Sign in as a member or admin.'); assertFeature('standing', 'The good standing certificate');
    if (S.u.role !== 'admin' && memberId !== S.u.id) throw new Error('You can only get your own certificate.'); if (S.u.role === 'admin') requireWritable();
    const u = userById(memberId); if (!u || !['member', 'admin'].includes(u.role) || !u.active) throw new Error('That account is not active.');
    const yr = new Date().getFullYear(), owe = memberOutstanding(u.id, yr); if (owe > 0) throw new Error(`${u.name} still owes ${money(owe)}. A good standing certificate can be issued once everything due is paid.`);
    S.v.certs = S.v.certs || []; const old = S.v.certs.find(c => c.memberId === u.id && !c.revoked && c.validTo >= today()); if (old) return old;
    S.v.seq.cert = (S.v.seq.cert || 0) + 1; const no = `GS-${S.v.code}-${yr}-${String(S.v.seq.cert).padStart(4, '0')}`, vil = vilById(baseId(S.v.id)) || {};
    const c = { no, memberId: u.id, name: u.name, title: u.role === 'admin' ? (u.title || 'Admin') : 'Member', org: S.v.name, code: S.v.code, family: u.family || '', kindred: u.kindred || '', phone: u.phone || '', email: u.email || '', joined: u.joined || '', year: yr, paid: Math.round(sum(memberPaid(u.id, yr))), issuedOn: today(), validTo: addDays(today(), 90), issuedAt: stamp(), issuedBy: S.u.name, issuedById: S.u.id };
    c.code12 = await hash12(certText(Object.assign({}, c, { code12: '' })) + '|' + S.v.id); S.v.certs.push(c); log('Issued good standing certificate', no, `${u.name}, valid to ${fmtDate(c.validTo)}`); commit(); return c;
  },
  revokeCertificate(no, reason) { requireAdmin(); const c = (S.v.certs || []).find(x => x.no === no); if (!c) throw new Error('Certificate not found.'); if ((reason || '').trim().length < 3) throw new Error('Give a short reason.'); c.revoked = true; c.revokedBy = S.u.name; c.revokedAt = stamp(); c.revokeReason = reason.trim(); log('Withdrew good standing certificate', no, `${c.name}: ${c.revokeReason}`); commit(); return c; }
});
function standingView() {
  if (!planAllows('standing')) return premiumGate('Good standing certificate', 'A members-only certificate with a QR code that carries the member’s full details. Members and admins who have paid everything due can download it as a PDF or an image.');
  const admin = isAdmin(), yr = new Date().getFullYear(), id = admin ? (S.f.cm || S.u.id) : S.u.id, u = userById(id) || S.u, owe = memberOutstanding(u.id, yr);
  const mine = (S.v.certs || []).filter(c => c.memberId === u.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const card = `<section class="panel"><div class="panel-h"><div><h2>${admin && u.id !== S.u.id ? esc(u.name) : 'My certificate'}</h2><p>${esc(u.id)} · ${esc(u.role === 'admin' ? (u.title || 'Admin') : 'Member')}</p></div></div>
    ${owe > 0 ? `<div class="callout warn"><div><b>Not in good standing yet</b><p>${esc(u.name)} still owes ${money(owe)} for ${yr}. Once it is paid and verified, the certificate can be issued.</p></div></div>` : `<div class="callout"><div><b>In good standing</b><p>Everything due for ${yr} is paid. The certificate is valid for 90 days and shows the member’s full details and a QR code.</p></div></div><div class="btn-row"><button class="btn btn-primary" type="button" data-act="cert-get" data-fmt="pdf" data-id="${esc(u.id)}">Download PDF</button><button class="btn btn-ghost" type="button" data-act="cert-get" data-fmt="png" data-id="${esc(u.id)}">Download image</button><button class="btn btn-leaf btn-sm" type="button" data-act="share-cert" data-id="${esc(u.id)}">Share (WhatsApp)</button></div>`}</section>`;
  const pick = admin ? `<section class="panel"><div class="panel-h"><div><h2>Choose a member</h2><p>Admins can issue a certificate for any member who is paid up.</p></div></div><div class="toolbar"><div class="field grow2"><label for="cm">Member</label><select id="cm" class="select" data-filter="cm">${memberOpts(u.id, '', true)}</select></div></div></section>` : '';
  const all = admin ? (S.v.certs || []).slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)) : mine;
  const list = `<section class="panel"><div class="panel-h"><div><h2>${admin ? 'Certificates issued' : 'My earlier certificates'}</h2><p>Each one has a number you can check.</p></div></div>${table(['Number', 'Member', 'Issued', 'Valid until', 'Status', ''], all.map(c => [`<span class="mono">${esc(c.no)}</span>`, esc(c.name), esc(fmtDate(c.issuedOn)), esc(fmtDate(c.validTo)), certStatus(c) === 'Valid' ? '<span class="badge b-verified">Valid</span>' : `<span class="badge b-rejected">${certStatus(c)}</span>`, admin && !c.revoked ? `<button class="btn btn-danger btn-sm" type="button" data-act="cert-revoke" data-id="${esc(c.no)}">Withdraw</button>` : '']), ['No certificates yet', 'They appear here after the first one is issued.'])}</section>`;
  const ver = admin ? `<section class="panel"><div class="panel-h"><div><h2>Check a certificate</h2><p>Type the number printed on a certificate to see if it is valid.</p></div></div><div class="toolbar"><div class="field grow2"><label for="cvN">Certificate number</label><input id="cvN" class="input mono" placeholder="GS-CODE-2026-0001"></div><button class="btn btn-primary" type="button" data-act="cert-verify">Check</button></div></section>` : '';
  return card + pick + list + ver;
}
Object.assign(ACTIONS, {
  async 'cert-get'(el) { const c = await API.issueCertificate(el.dataset.id), blob = el.dataset.fmt === 'png' ? await certPng(c) : await certPdf(c); download(`Good-standing-${c.no}.${el.dataset.fmt === 'png' ? 'png' : 'pdf'}`, blob); renderView(); toast('Certificate downloaded.', 'ok'); },
  'cert-revoke'(el) { const c = (S.v.certs || []).find(x => x.no === el.dataset.id); openModal({ title: `Withdraw ${c.no}?`, danger: true, sub: `${esc(c.name)}. The certificate will show as withdrawn when checked.`, body: '<div class="field"><label for="crR">Reason</label><input id="crR" name="reason" class="input" maxlength="120" required></div>', submit: 'Withdraw', onSubmit: fd => { API.revokeCertificate(c.no, fd.get('reason')); done('Certificate withdrawn.'); } }); },
  'cert-verify'() { const n = ($('#cvN').value || '').trim().toUpperCase(); if (!n) return toast('Type the certificate number.', 'err'); const c = (S.v.certs || []).find(x => x.no.toUpperCase() === n); if (!c) return infoModal('Certificate check', n, '<div class="callout warn"><div><b>Not found</b><p>This number was not issued by this village or association.</p></div></div>'); const st = certStatus(c); infoModal('Certificate check', c.no, `<div class="callout ${st === 'Valid' ? '' : 'warn'}"><div><b>${st}</b><p>${esc(c.name)} (${esc(c.memberId)}), issued ${esc(fmtDate(c.issuedOn))}, valid until ${esc(fmtDate(c.validTo))}.${c.revoked ? ' Withdrawn: ' + esc(c.revokeReason) : ''}</p></div></div>`); }
});

/* ---------- Members can download village reports (Premium) ---------- */
{ const _b = buildReport; buildReport = function () { const r = _b.apply(this, arguments); if (S.u && S.u.role !== 'admin' && r && r.mode === 'village' && !CONFIG.SHOW_MEMBER_NAMES_IN_VILLAGE_LEDGER) r.members = []; return r; }; }
{ const _d = downloadReport; downloadReport = function (kind, year, month, memberId) { if (S.u && S.u.role !== 'admin' && !memberId) assertFeature('memberReports', 'Downloading the village reports'); return _d.apply(this, arguments); }; }
{ const _rv = VIEWS.admin.reports; const wrap = function () { let pre = ''; if (S.u && S.u.role !== 'admin' && !planAllows('memberReports') && (S.f.scope || 'statement') === 'village') { S.f.scope = 'statement'; pre = premiumGate('Village reports for members', 'Members can download the village’s monthly and yearly financial reports.'); }
  const agm = isAdmin() ? (planAllows('agm') ? `<section class="panel"><div class="panel-h"><div><h2>One-tap AGM report</h2><p>The whole year in one PDF for the annual general meeting: money in and out, debts, pledges, attendance, projects, emergencies and officers.</p></div></div><div class="toolbar"><div class="field"><label for="agmY">Year</label><select id="agmY" class="select">${yearOpts(String(new Date().getFullYear()))}</select></div><button class="btn btn-saffron" type="button" data-act="agm-pdf">Download AGM report</button></div></section>` : premiumGate('One-tap AGM report', 'The whole year in one PDF for the annual general meeting.')) : '';
  return pre + agm + _rv(); };
  VIEWS.admin.reports = wrap; VIEWS.member.reports = wrap; }

/* ---------- One-tap AGM report ---------- */
function agmPdf(year) {
  const yr = Number(year), tx = S.v.tx.filter(t => t.status === 'verified'), inY = tx.filter(t => yearOf(t.date) === yr), before = tx.filter(t => yearOf(t.date) < yr), ex = activeExp(), exY = ex.filter(e => yearOf(e.date) === yr), exB = ex.filter(e => yearOf(e.date) < yr);
  const bf = sum(before) - sum(exB), inc = sum(inY), spent = sum(exY), W = docWriter('Annual General Meeting Report', `${S.v.name}, year ${yr}`, `AGM-${S.v.code}-${yr}`);
  W.section('1. Money in and out'); W.kv([['Brought forward', naira(bf)], ['Income in ' + yr, naira(inc)], ['Spending in ' + yr, naira(spent)], ['Carried forward', naira(bf + inc - spent)]]);
  W.table([{ h: 'Levy', w: 255 }, { h: 'Payments', w: 80, align: 'right' }, { h: 'Amount', w: 180, align: 'right' }], levyAll().filter(l => !l.removed || inY.some(t => t.levy === l.id)).map(l => { const a = inY.filter(t => t.levy === l.id); return [l.name + (l.emergency ? ' (emergency)' : ''), String(a.length), naira(sum(a))]; }).concat([{ cells: ['Total income', String(inY.length), naira(inc)], total: true }]));
  const cats = {}; exY.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
  W.table([{ h: 'Spending category', w: 335 }, { h: 'Amount', w: 180, align: 'right' }], Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, naira(v)]).concat([{ cells: ['Total spending', naira(spent)], total: true }]));
  const people = S.v.users.filter(u => (u.role === 'member' || u.role === 'admin')), act = people.filter(u => u.active), owing = act.map(u => ({ u, o: memberOutstanding(u.id, yr) })).filter(x => x.o > 0);
  W.section('2. Membership and debts'); W.kv([['Active members and admins', String(act.length)], ['Joined in ' + yr, String(people.filter(u => (u.joined || '').slice(0, 4) === String(yr)).length)], ['Fully paid up for ' + yr, String(act.length - owing.length)], ['Still owing', `${owing.length} (${naira(sum(owing.map(x => ({ amount: x.o }))))})`]]);
  const pl = (S.v.pledges || []).filter(p => yearOf(p.date) === yr && p.status !== 'cancelled'); W.section('3. Pledges made in ' + yr);
  W.kv([['Pledges', String(pl.length)], ['Total pledged', naira(sum(pl))], ['Paid so far', naira(sum(pl.map(p => ({ amount: pledgePaid(p) }))))], ['Still to be paid', naira(sum(pl.map(p => ({ amount: pledgeBal(p) }))))]]);
  const mt = (S.v.meetings || []).filter(m => yearOf(m.date) === yr); W.section('4. Meetings and attendance');
  W.table([{ h: 'Date', w: 90 }, { h: 'Meeting', w: 325 }, { h: 'Present', w: 100, align: 'right' }], mt.sort((a, b) => a.date.localeCompare(b.date)).map(m => [fmtDate(m.date), m.title, String(presentCount(m))]));
  if (mt.length) W.para(`${mt.length} meeting${mt.length === 1 ? '' : 's'} held. Average attendance ${Math.round(mt.reduce((a, m) => a + presentCount(m), 0) / mt.length)} members.`, { size: 9, color: '#5B5F7A' });
  const mins = (S.v.minutes || []).filter(m => m.status === 'approved' && yearOf(m.date) === yr); W.section('5. Approved minutes'); W.table([{ h: 'Date', w: 90 }, { h: 'Meeting', w: 325 }, { h: 'Number', w: 100 }], mins.map(m => [fmtDate(m.date), m.title, m.no || '-']));
  const pr = S.v.projects || []; W.section('6. Community projects'); W.table([{ h: 'Project', w: 195 }, { h: 'Target', w: 100, align: 'right' }, { h: 'Raised', w: 100, align: 'right' }, { h: 'Status', w: 120 }], pr.map(p => [p.name, naira(p.target), naira(projectRaised(p)), p.status === 'completed' ? 'Completed' : p.status === 'paused' ? 'Paused' : Math.min(100, Math.round(projectRaised(p) * 100 / p.target)) + '% funded']));
  const em = levyAll().filter(l => l.emergency); W.section('7. Emergency levies'); W.table([{ h: 'Emergency', w: 215 }, { h: 'Per member', w: 100, align: 'right' }, { h: 'Collected', w: 100, align: 'right' }, { h: 'Status', w: 100 }], em.map(l => [l.name, naira(S.v.settings.levies[l.id] || 0), naira(sum(tx.filter(t => t.levy === l.id))), l.emergency.status === 'closed' ? 'Closed' : 'Open']));
  const ad = S.v.users.filter(u => u.role === 'admin' && u.active); W.section('8. Officers and terms of office'); W.table([{ h: 'Duty', w: 130 }, { h: 'Name', w: 190 }, { h: 'Term', w: 195 }], ad.map(a => { const t = (S.v.terms || {})[a.id]; return [a.title || 'Admin', a.name, t ? `${fmtDate(t.start)} to ${fmtDate(t.end)}` : 'Not set']; }));
  W.space(10); W.sign([['Chairman', holderName('Chairman')], ['Secretary', holderName('Secretary')], ['Financial Secretary', holderName('Financial Secretary')]]);
  return W.build();
}
Object.assign(ACTIONS, { 'agm-pdf'() { requireAdmin(); assertFeature('agm', 'The one-tap AGM report'); const y = ($('#agmY') && $('#agmY').value) || new Date().getFullYear(); download(`${S.v.code}-AGM-report-${y}.pdf`, agmPdf(y)); log('Downloaded AGM report', String(y), 'One-tap AGM report'); commit(); toast('AGM report downloaded.', 'ok'); } });
