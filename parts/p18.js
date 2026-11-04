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
    if (!u || u.role !== 'admin' || !['Chairman', 'Financial Secretary', 'Secretary'].includes(u.title)) throw new Error('Only the Chairman, the Financial Secretary and the Secretary have signatures.');
    if (!(S.u.id === adminId || isLeadAdmin())) throw new Error('Only that admin or the Lead Admin can change this.');
    const ph = (d.phone || '').trim(); if (ph && !/^[0-9+\s-]{10,16}$/.test(ph)) throw new Error('Enter a valid phone number.');
    const ch = []; if (ph !== (u.phone || '')) { ch.push('Phone updated'); u.phone = ph; }
    if (d.signature) { ch.push('Signature uploaded'); u.signature = d.signature; } else if (d.remove && u.signature) { ch.push('Signature removed'); delete u.signature; }
    if (!ch.length) throw new Error('Nothing was changed.');
    log('Updated letterhead signatory', u.id, `${u.name} (${u.title}): ${ch.join('; ')}`); commit();
  },
  logBroadcast(n) {
    if (!canRemind()) throw new Error('Only the Chairman or the Financial Secretary can send a broadcast.'); if (S.v.plan !== 'premium') throw new Error('WhatsApp broadcast is part of the Premium plan.');
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
  let ns = 22; while (ns > 14 && A.width(r.village, ns, true) > nw) ns -= 1;
  const nl = A.width(r.village, ns, true) > nw ? wrapLines(A, r.village, nw, 15).slice(0, 2) : [r.village];   // never cut the name: shrink, then use two lines
  if (nl.length > 1) { A.text(nl[0], nx, 62, { size: 15, bold: true, color: '#FFFFFF' }); A.text(nl[1], nx, 80, { size: 15, bold: true, color: '#FFFFFF' }); }
  else A.text(nl[0], nx, 72, { size: ns, bold: true, color: '#FFFFFF' });
  if (r.motto) A.text(A.fit(r.motto, nw, 9.5), nx, nl.length > 1 ? 95 : 90, { size: 9.5, color: GOLD2 });
  if (r.address) A.text(A.fit(r.address, nw, 8.5), nx, 109, { size: 8.5, color: '#DADCF5' });
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
  const prem = S.v.plan === 'premium', roles = ['Chairman', 'Financial Secretary', 'Secretary'];
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
const canRemind = () => isChairman() || (typeof isFinSec === 'function' && isFinSec());
const broadcastBtn = () => canRemind() ? `<button class="btn btn-leaf btn-sm" type="button" data-act="wa-broadcast">WhatsApp broadcast${S.v.plan === 'premium' ? '' : ' ' + premiumBadge}</button>` : '';
function featureModal(name) { infoModal('Premium feature', name, `<div class="upgrade-box"><div class="up-badge">${premiumBadge}</div><p><b>${esc(name)}</b> is part of the Premium plan. Upgrade to switch it on. Your records stay exactly as they are.</p>${upgradeBtn()}</div>`); }
let BC = null;
Object.assign(ACTIONS, {
  'wa-broadcast'() {
    if (!canRemind()) return toast('Only the Chairman or the Financial Secretary can send a broadcast.', 'err');
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
    if (!BC || BC.i >= BC.list.length) return; if (!canRemind() || S.v.plan !== 'premium') return;
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
  <div class="medals">${list.map(b => `<div class="medal-card${b.got ? ' got' : ''}"><div class="medal" aria-hidden="true">${b.sym}</div><div class="mc-body"><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${b.got ? `<span class="badge b-verified">Earned · ${b.pts} pts</span>` : `<div class="bar"><i style="width:${Math.round(b.val / b.max * 100)}%"></i></div><small>${b.id === 'gen' ? money(b.val) + ' of ' + money(b.max) : b.id === 'present' ? b.val + '% of 80%' : b.val + ' of ' + b.max}</small>`}</div></div>`).join('')}</div></section>`;
}
VIEWS.member.achievements = achievementsView; VIEWS.admin.achievements = achievementsView;

/* ---------- Sponsors hall of fame ---------- */
function hallView() {
  const d = SPN.load(), wk = id => d.payments.filter(p => p.sponsor_id === id).reduce((a, p) => a + (Number(p.weeks) || 0), 0);
  const items = d.items.filter(s => s.scope === 'global' || s.association_id === baseId(S.v.id)).map(s => ({ s, weeks: wk(s.id), st: spStatus(s) })).sort((a, b) => b.weeks - a.weeks || a.s.shop_name.localeCompare(b.s.shop_name));
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
    body: `<div class="stars" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star" role="radio" aria-checked="false" data-act="rate-star" data-v="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div><input type="hidden" name="stars" id="rvStars" value="">
    <div class="field"><label for="rvC">Tell us more (optional)</label><textarea id="rvC" name="comment" class="textarea" maxlength="300" placeholder="What worked well? What should be better?"></textarea></div>`, submit: 'Send rating',
    onSubmit: fd => { const n = Number(fd.get('stars')); if (!(n >= 1 && n <= 5)) throw new Error('Tap a star to rate.'); const l = RV.load(); l.push({ id: 'RV' + (l.length + 1), ts: stamp(), village: S.v.name, villageId: S.v.id, role: S.u.role, name: S.u.name, stars: n, comment: (fd.get('comment') || '').trim(), trigger }); RV.save(l); lsSet(`vv_rate_${S.v.id}_${S.u.id}`, String(Date.now())); closeModal(); toast('Thank you for your rating.', 'ok'); } });
}
Object.assign(ACTIONS, { 'rate-star'(el) { const n = Number(el.dataset.v); $('#rvStars').value = String(n); $$('.star').forEach((b, i) => { b.classList.toggle('on', i < n); b.setAttribute('aria-checked', String(i + 1 === n)); }); } });
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
