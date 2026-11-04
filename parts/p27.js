/* =========================================================
   ROUND 12: who may do what, and own login details.
   Duties (the Financial Secretary is the only one who handles the money controls):
     - records, edits and voids expenses
     - opens and closes the attendance register
     - verifies or rejects payment proofs
     - the Financial Secretary's own proofs are verified by the Chairman only
     - the Chairman's proofs are verified by the Financial Secretary
   Every member and admin may change their own username and password.
   The checks sit in the API, so they hold even if a button is shown by mistake.
   ========================================================= */
const isFinSec = () => !!S.u && !S.owner && S.u.id !== 'SUPPORT' && S.u.role === 'admin' && S.u.active && S.u.title === 'Financial Secretary';
function whoVerifies(memberId) {
  const fs = holderOf('Financial Secretary');
  return fs && memberId === fs.id ? { who: 'Chairman', ok: isChair() } : { who: 'Financial Secretary', ok: isFinSec() };
}
const canVerifyTxOf = memberId => whoVerifies(memberId).ok;
function assertCanVerify(memberId) {
  const w = whoVerifies(memberId);
  if (!w.ok) throw new Error(w.who === 'Chairman' ? 'The Financial Secretary’s own payments can only be verified by the Chairman.' : 'Only the Financial Secretary can verify payment proofs.');
}
function assertFinSec(what) { if (!isFinSec()) throw new Error(`Only the Financial Secretary can ${what}.`); }
(function dutyChecks() {
  const wrap = (name, check) => { const f = API[name]; API[name] = function () { check.apply(null, arguments); return f.apply(API, arguments); }; };
  wrap('verify', id => { requireAdmin(); assertCanVerify(getTx(id).memberId); });
  wrap('reject', id => { requireAdmin(); assertCanVerify(getTx(id).memberId); });
  wrap('addTx', d => { requireAdmin(); if (d && d.status !== 'pending') assertCanVerify(d.memberId); });
  wrap('editTx', (id, d) => { requireAdmin(); const t = getTx(id); if (d && d.status !== t.status && d.status !== 'pending') assertCanVerify(t.memberId); });
  wrap('saveExpense', () => { requireAdmin(); assertFinSec('record or change expenses'); });
  wrap('voidExpense', () => { requireAdmin(); assertFinSec('void an expense'); });
  wrap('openRegister', () => { requireAdmin(); assertFinSec('open the attendance register'); });
  wrap('closeRegister', () => { requireAdmin(); assertFinSec('close the attendance register'); });
})();

/* Hide the buttons a person is not allowed to use, so they are not offered something that will be refused. */
function dutyPass() {
  if (!S.u || S.owner || S.u.role !== 'admin') return;
  const root = $('#view'); if (!root) return;
  if (!isFinSec()) root.querySelectorAll('[data-act=add-exp],[data-act=edit-exp],[data-act=void-exp],[data-act=mtg-open],[data-act=mtg-close]').forEach(b => b.remove());
  root.querySelectorAll('[data-act=verify-tx],[data-act=reject-tx]').forEach(b => { const t = (S.v.tx || []).find(x => x.id === b.dataset.id); if (t && !canVerifyTxOf(t.memberId)) b.remove(); });
}
(function hookRender() {
  const rv = renderView; renderView = function () { const r = rv.apply(this, arguments); try { dutyPass(); } catch (_) {} return r; };
})();

/* ---------- Own username ----------
   The login ID (for example UMKM-M004) never changes, because every record points to it. A username is an extra name that
   signs in to the same account. It is unique inside the village or association. */
const USERNAME_RX = /^[a-z][a-z0-9._-]{3,23}$/;
Object.assign(API, {
  async changeUsername(cur, name) {
    if (!S.u || S.owner || S.u.id === 'SUPPORT') throw new Error('Sign in as a member or admin to change your username.'); requireWritable();
    if (await hashPw(S.v.id, S.u.id, cur) !== S.u.hash) throw new Error('Your current password is not correct.');
    const n = String(name || '').trim().toLowerCase();
    if (!USERNAME_RX.test(n)) throw new Error('A username is 4 to 24 characters: start with a letter, then letters, numbers, dot, dash or underscore.');
    if (S.v.users.some(x => x.id !== S.u.id && (x.id.toLowerCase() === n || (x.username || '').toLowerCase() === n))) throw new Error('That username is taken. Choose another.');
    if ((S.u.username || '') === n) throw new Error('That is already your username.');
    S.u.username = n; S.u.rememberTokens = []; if (isAdmin()) log('Changed own username', S.u.id, 'Admin changed their username'); commit();
  }
});
function changeUsernameModal() {
  openModal({ title: 'Change username', sub: `Your login ID ${S.u.id} always keeps working. A username is an extra name you can sign in with.`,
    body: `<div class="field"><label for="unN">New username</label><input id="unN" name="name" class="input" maxlength="24" autocomplete="username" value="${esc(S.u.username || '')}" required><span class="hint">${S.u.username ? 'Now: ' + esc(S.u.username) + '. ' : ''}4 to 24 characters, starting with a letter.</span></div>${pwField('unP', 'cur', 'Your password, to confirm it is you', 'current-password')}`,
    submit: 'Save username', onSubmit: async fd => { await API.changeUsername(fd.get('cur') || '', fd.get('name')); done('Username changed.'); } });
}
ACTIONS['change-username'] = () => changeUsernameModal();
