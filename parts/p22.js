/* =========================================================
   ROUND 9 / #9: accessibility
   skip link, focus moves to the page title on navigation, focus trap in
   dialogs, toasts announced properly, tidy semantics.
   ========================================================= */
(function a11y() {
  const sk = document.createElement('a'); sk.className = 'skip-link'; sk.href = '#top'; sk.textContent = 'Skip to main content';
  sk.addEventListener('click', e => { e.preventDefault(); const t = !$('#app').hidden && $('#view') ? $('#view') : $('#top'); if (!t) return; if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus(); t.scrollIntoView(); });
  document.body.insertBefore(sk, document.body.firstChild);
})();

/* Tab stays inside an open dialog */
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return; const root = $('#modalRoot'); if (!root || root.hidden) return;
  const f = $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', root).filter(x => x.offsetParent !== null);
  if (!f.length) return; const first = f[0], last = f[f.length - 1], a = document.activeElement;
  if (!root.contains(a)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
}, true);

/* Errors are announced at once, other messages politely */
{ const _t = toast; toast = function (msg, kind) { _t.apply(this, arguments); const box = $('#toasts'), el = box && box.lastElementChild; if (el) { el.setAttribute('role', kind === 'err' ? 'alert' : 'status'); } }; }

/* When the page changes, move focus to its title so screen-reader users hear where they are */
{
  let lastPage = null;
  const _rv = renderView;
  renderView = function () {
    _rv.apply(this, arguments);
    try {
      const key = (S.owner && !S.v ? 'o:' : (S.v ? S.v.id + ':' : '')) + S.page;
      if (lastPage !== null && key !== lastPage && $('#modalRoot').hidden) { const h = $('#pageTitle'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
      lastPage = key;
      const nm = $('#modalRoot .modal'); if (nm && !nm.hasAttribute('aria-describedby') && nm.querySelector('p.muted')) { const p = nm.querySelector('p.muted'); p.id = 'mSub'; nm.setAttribute('aria-describedby', 'mSub'); }
    } catch (_) {}
  };
}
