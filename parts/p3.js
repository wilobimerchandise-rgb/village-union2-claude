
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
  /* Text with letters Helvetica cannot draw (Igbo dot-below, tone marks, the naira sign) is drawn as a sharp 1-bit mask in the right colour,
     with an invisible plain copy underneath so the PDF stays searchable. */
  static norm(s) { return String(s == null ? '' : s).normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-'); }
  static needs(s) { return /[^\x20-\x7E]/.test(PDF.norm(s).replace(/₦/g, 'N')); }
  static ctx() { if (!PDF._c) { PDF._c = document.createElement('canvas'); PDF._g = PDF._c.getContext('2d', { willReadFrequently: true }); } return PDF._g; }
  static font(size, bold, k) { return `${bold ? 700 : 400} ${size * k}px Arial, "Segoe UI", "Noto Sans", "DejaVu Sans", Helvetica, sans-serif`; }
  rasterText(s, x, y, o, size, wd) {
    const k = 6, g = PDF.ctx(), c = PDF._c, pad = 2, hpt = size * 1.5, base = size * 1.15, key = `${s}|${size}|${o.bold ? 1 : 0}`;
    this._rc = this._rc || new Map(); let idx = this._rc.get(key), wpx;
    if (idx != null) { wpx = this.imgs[idx].w; } else {
    wpx = Math.max(1, Math.ceil((wd + 2 * pad) * k)); const hpx = Math.ceil(hpt * k); c.width = wpx; c.height = hpx;
    g.clearRect(0, 0, wpx, hpx); g.font = PDF.font(size, o.bold, k); g.fillStyle = '#000'; g.textBaseline = 'alphabetic'; g.fillText(PDF.norm(s), pad * k, base * k);
    const d = g.getImageData(0, 0, wpx, hpx).data, rb = Math.ceil(wpx / 8); let bin = '';
    for (let r = 0; r < hpx; r++) for (let b = 0; b < rb; b++) { let v = 0xFF; for (let bit = 0; bit < 8; bit++) { const px = b * 8 + bit; if (px < wpx && d[(r * wpx + px) * 4 + 3] >= 110) v &= ~(0x80 >> bit); } bin += String.fromCharCode(v); }
    this.imgs.push({ mask: true, bin, w: wpx, h: hpx }); idx = this.imgs.length - 1; this._rc.set(key, idx); }
    const X = x - pad, Y = this.H - y - (hpt - base);
    this.p.push(`q ${this.rgb(o.color || '#14142B')} rg ${(wpx / k).toFixed(2)} 0 0 ${hpt.toFixed(2)} ${X.toFixed(2)} ${Y.toFixed(2)} cm /Im${idx} Do Q`);
    this.p.push(`BT 3 Tr /${o.bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${(this.H - y).toFixed(2)} Td (${PDF.a(s).replace(/([\\()])/g, '\\$1')}) Tj 0 Tr ET`);
  }
  static a(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/₦/g, 'N').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '?'); }
  w(s, size, bold) { if (PDF.needs(s)) { const g = PDF.ctx(); g.font = PDF.font(size, bold, 10); return g.measureText(PDF.norm(s)).width / 10; } s = PDF.a(s); let t = 0; for (let i = 0; i < s.length; i++) t += HELV[s.charCodeAt(i) - 32] || 556; return t * size / 1000 * (bold ? 1.05 : 1); }
  fit(s, maxW, size, bold) { if (PDF.needs(s) || /₦/.test(s)) { s = PDF.norm(s); if (this.w(s, size, bold) <= maxW) return s; while (s.length > 1 && this.w(s + '..', size, bold) > maxW) s = s.slice(0, -1); return s + '..'; } s = PDF.a(s); if (this.w(s, size, bold) <= maxW) return s; while (s.length > 1 && this.w(s + '..', size, bold) > maxW) s = s.slice(0, -1); return s + '..'; }
  rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(x => x.toFixed(3)).join(' '); }
  rect(x, y, w, h, fill) { this.p.push(`${this.rgb(fill)} rg ${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  line(x1, y1, x2, y2, color, lw) { this.p.push(`${lw || .6} w ${this.rgb(color || '#DCE3E0')} RG ${x1.toFixed(2)} ${(this.H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.H - y2).toFixed(2)} l S`); }
  text(s, x, y, o) {
    o = o || {}; const size = o.size || 10; const wd = this.w(s, size, o.bold); let xx = x;
    if (o.align === 'right') xx = x - wd; else if (o.align === 'center') xx = x - wd / 2;
    if (PDF.needs(s)) return this.rasterText(s, xx, y, o, size, wd);
    if (/₦/.test(s)) { let cx = xx; PDF.norm(s).split(/(₦)/).forEach(seg => { if (!seg) return; const sw = this.w(seg, size, o.bold); if (seg === '₦') this.rasterText('₦', cx, y, o, size, sw); else this.text(seg, cx, y, Object.assign({}, o, { align: 'left' })); cx += sw; }); return; }
    s = PDF.a(s);
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
    this.imgs.forEach((im, i) => { const oid = id++; xo.push(`/Im${i} ${oid} 0 R`); objs[oid] = im.mask ? `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ImageMask true /BitsPerComponent 1 /Length ${im.bin.length} >>\nstream\n${im.bin}\nendstream` : `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bin.length} >>\nstream\n${im.bin}\nendstream`; });
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
const pm = n => '₦' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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
    for (let i = 0; i <= 2; i++) { const gy = y + ch - ch * i / 2; pdf.line(M + 40, gy, M + CW, gy, '#E6ECE9'); pdf.text(pm(max * i / 2).replace('₦', ''), M + 34, gy + 3, { size: 7, color: MUT, align: 'right' }); }
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
      rep.members.map(m => ({ cells: [m.id, m.name, ...['annual', 'burial', 'insurance', 'party', 'support'].map(k => m.per[k] ? Math.round(m.per[k]).toLocaleString('en-US') : '-'), pm(m.total).replace('₦', '')] }))
        .concat([{ total: 1, cells: ['', 'Total', ...['annual', 'burial', 'insurance', 'party', 'support'].map(k => Math.round(rep.byLevy.find(l => l.id === k).amount).toLocaleString('en-US')), pm(rep.income).replace('₦', '')] }]));
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
