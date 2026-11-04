
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
  villageId = baseId(villageId);
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
