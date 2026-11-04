/* Villages are no longer in the sign-in list (people choose a Men's or Women's Wing). Most older tests exercise the village-level
   workspace directly, so this adds the village ids back to the dropdowns for the test browser only (marked data-test).
   Tests that check what real visitors see (02, 19, 21 and 22 to 24) filter those options out. */
module.exports = async ctx => ctx.addInitScript(() => {
  const ids = ['umuokpu', 'amakwu', 'ezinkwo', 'umuchima', 'obiagu', 'isiala', 'umunze', 'agbaja', 'nkwoibe', 'ndiakpo'];
  const add = s => { let extra = []; try { extra = JSON.parse(localStorage.getItem('vv_extra_v1') || '[]').map(x => x.id); } catch (_) {} const have = new Set([...s.options].map(o => o.value)); ids.concat(extra).forEach(id => { if (!have.has(id)) { const o = document.createElement('option'); o.value = id; o.textContent = id; o.setAttribute('data-test', '1'); s.appendChild(o); } }); };
  document.addEventListener('DOMContentLoaded', () => { document.querySelectorAll('[data-village-select]').forEach(s => { add(s); new MutationObserver(() => add(s)).observe(s, { childList: true }); }); });
});
