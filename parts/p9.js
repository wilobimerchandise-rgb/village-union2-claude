
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
      { const nm = r.premium ? r.village : 'Payment receipt', mw = logoImg ? W - 290 : W - 140; let s = 38; g.font = F(800, s); while (s > 24 && g.measureText(nm).width > mw) { s -= 2; g.font = F(800, s); }
        if (g.measureText(nm).width <= mw) text(nm, 70, 335, { w: 800, s, c: '#1A1A4E' });
        else { const ws = nm.split(/\s+/), ln = ['']; ws.forEach(w => { const t = ln[ln.length - 1] ? ln[ln.length - 1] + ' ' + w : w; if (g.measureText(t).width > mw && ln[ln.length - 1]) ln.push(w); else ln[ln.length - 1] = t; }); ln.slice(0, 2).forEach((l, i) => text(l, 70, 322 + i * 34, { w: 800, s: 30, c: '#1A1A4E', max: mw })); } }
      if (logoImg) { g.save(); g.beginPath(); g.roundRect ? g.roundRect(W - 170, 290, 100, 100, 18) : g.rect(W - 170, 290, 100, 100); g.clip(); g.drawImage(logoImg, W - 170, 290, 100, 100); g.restore(); g.strokeStyle = '#DCE3E0'; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(W - 170, 290, 100, 100, 18) : g.rect(W - 170, 290, 100, 100); g.stroke(); }
      text(`Issued ${fmtDate(r.issuedAt.slice(0, 10))}`, 70, 392, { w: 500, s: 24, c: '#5B5F7A' });
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
  { const nm = r.premium ? r.village : 'Payment receipt', mw = CW - (r.premium && r.logo ? 60 : 0); let s = 14; while (s > 9 && pdf.w(nm, s, true) > mw) s -= 1; pdf.text(pdf.fit(nm, mw, s, true), M, 126, { size: s, bold: true, color: '#1A1A4E' }); }
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
    <div class="receipt-actions"><button type="button" class="btn btn-primary" data-act="receipt-dl" data-fmt="png" data-id="${esc(t.id)}">Download PNG</button><button type="button" class="btn btn-saffron" data-act="receipt-dl" data-fmt="pdf" data-id="${esc(t.id)}">Download PDF</button><button type="button" class="btn btn-leaf" data-act="share-receipt" data-id="${esc(t.id)}">Share (WhatsApp)</button></div>` });
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

