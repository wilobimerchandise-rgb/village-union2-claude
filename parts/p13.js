
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
