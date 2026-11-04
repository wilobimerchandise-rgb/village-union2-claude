/* =========================================================
   ROUND 9 / #8: safer sessions and sign-in
   - idle timeout (with a warning) and a hard 12-hour limit
   - "remember me" tokens expire after 30 days
   - warning when an account still has its default password
   - optional two-step sign-in (TOTP, works with Google Authenticator,
     Microsoft Authenticator, Authy) for the owner and each Lead Admin,
     with 8 one-time recovery codes
   DEMO NOTE: with no server, the secret lives in this browser's storage.
   ========================================================= */
const SESS_CFG = Object.assign({ idleMin: 30, warnSec: 60, absoluteHr: 12, remDays: 30, forcePwChange: false },
  (() => { try { return JSON.parse(lsGet('vv_cfg_session') || '{}'); } catch (_) { return {}; } })());

/* ---------- TOTP (RFC 6238) ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = u => { let bits = '', out = ''; u.forEach(b => { bits += b.toString(2).padStart(8, '0'); }); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const b32dec = s => { let bits = ''; String(s).toUpperCase().replace(/[^A-Z2-7]/g, '').split('').forEach(c => { bits += B32.indexOf(c).toString(2).padStart(5, '0'); }); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return new Uint8Array(out); };
const newSecret = () => b32enc(crypto.getRandomValues(new Uint8Array(20)));
async function hotp(secret, counter) {
  const key = await crypto.subtle.importKey('raw', b32dec(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']), msg = new Uint8Array(8); let c = counter; for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg)), o = h[19] & 15, n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
const stepNow = () => Math.floor(Date.now() / 30000);
async function totpCheck(rec, code) {
  code = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(code)) return false;
  for (const d of [0, -1, 1]) { const st = stepNow() + d; if (st <= (rec.last || 0)) continue; if (await hotp(rec.secret, st) === code) { rec.last = st; return true; } }
  return false;
}
const sha256 = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, '0')).join('');
const newRecovery = () => Array.from({ length: 8 }, () => { const a = Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join(''); return a.slice(0, 4) + '-' + a.slice(4); });
async function recoveryUse(rec, code) { code = String(code || '').trim().toLowerCase(); if (!/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(code)) return false; const h = await sha256(code), i = (rec.rec || []).indexOf(h); if (i < 0) return false; rec.rec.splice(i, 1); return true; }
const fmtSecret = s => s.match(/.{1,4}/g).join(' ');

/* ---------- the sign-in gate ---------- */
const GATE = { resolve: null };
function ask2fa(rec, who) {
  return new Promise(resolve => {
    let tries = 0; GATE.resolve = resolve;
    openModal({ title: 'Two-step sign-in', sub: `Open your authenticator app and enter the 6-digit code for ${esc(who)}. Lost your phone? Use one of your recovery codes instead (like a1b2-c3d4).`,
      body: `<div class="field"><label for="tfC">Code</label><input id="tfC" name="code" class="input" inputmode="text" autocomplete="one-time-code" maxlength="9" placeholder="123456"></div>`, submit: 'Verify',
      onSubmit: async fd => {
        const code = fd.get('code'); let good = await totpCheck(rec, code), usedRec = false; if (!good) { good = await recoveryUse(rec, code); usedRec = good; }
        if (!good) { if (++tries >= 5) { GATE.resolve = null; closeModal(); resolve(false); toast('Too many wrong codes. Sign in again.', 'err'); return; } throw new Error(`That code is not right. ${5 - tries} tries left.`); }
        GATE.resolve = null; closeModal(); resolve({ usedRec });
      } });
  });
}
{ const _cm = closeModal; closeModal = function () { const g = GATE.resolve; GATE.resolve = null; _cm.apply(this, arguments); if (g) g(false); }; }

const sessRead = () => { try { return JSON.parse(ssGet('vv_sess') || 'null'); } catch (_) { return null; } };
const sessPatch = p => { const s = sessRead(); if (s) ssSet('vv_sess', JSON.stringify(Object.assign(s, p))); };
{
  const _ea = enterApp;
  enterApp = async function (v, u, auto) {
    if (u.totp && u.totp.secret) {
      sessPatch({ need2fa: true });
      const ok = await ask2fa(u.totp, u.name); if (!ok) { ssDel('vv_sess'); if (!auto) toast('Sign-in cancelled.', 'err'); return; }
      sessPatch({ need2fa: false }); DB.save(v);
      if (ok.usedRec) setTimeout(() => toast(`Recovery code used. ${u.totp.rec.length} left.`, 'ok'), 400);
    }
    sessPatch({ at: Date.now(), last: Date.now() });
    return _ea.call(this, v, u, auto);
  };
  const _eo = enterOwner;
  enterOwner = async function (silent) {
    await OWN.load();
    if (!silent && OWN.data.totp && OWN.data.totp.secret) {
      sessPatch({ need2fa: true });
      const ok = await ask2fa(OWN.data.totp, 'the owner'); if (!ok) { ssDel('vv_sess'); return; }
      sessPatch({ need2fa: false }); OWN.save();
    }
    if (!silent) sessPatch({ at: Date.now(), last: Date.now() });
    return _eo.call(this, silent);
  };
}

/* ---------- remember-me expiry ---------- */
{
  const _mr = makeRemember; makeRemember = function (v, u) { _mr.call(this, v, u); try { const r = JSON.parse(lsGet(remKey(v.id))); r.at = Date.now(); lsSet(remKey(v.id), JSON.stringify(r)); } catch (_) {} };
  const _rf = rememberedFor; rememberedFor = function (vid) { const r = _rf.call(this, vid); if (r && r.at && Date.now() - r.at > SESS_CFG.remDays * 864e5) { try { localStorage.removeItem(remKey(vid)); } catch (_) {} delete mem[remKey(vid)]; return null; } return r; };
}

/* ---------- idle and absolute timeouts ---------- */
const SESS = { timer: null, warned: false, bound: false, last: Date.now() };
function touch() { SESS.last = Date.now(); if (SESS.warned) { SESS.warned = false; if (!$('#modalRoot').hidden && /Still there/.test($('#modalRoot').textContent)) closeModal(); } }
function endSession(msg) { logout(); if (msg) setTimeout(() => toast(msg, 'err'), 120); }
function tick() {
  if (!(S.owner || S.u)) return;
  const s = sessRead(), now = Date.now(), idle = now - SESS.last, idleMs = SESS_CFG.idleMin * 60000, warnMs = SESS_CFG.warnSec * 1000;
  if (s && s.at && now - s.at > SESS_CFG.absoluteHr * 3600e3) return endSession(`Signed out. Sessions last at most ${SESS_CFG.absoluteHr} hours.`);
  if (idle >= idleMs) return endSession(`Signed out after ${SESS_CFG.idleMin} minutes of no activity.`);
  if (idle >= idleMs - warnMs && !SESS.warned) {
    SESS.warned = true;
    if ($('#modalRoot').hidden) openModal({ title: 'Still there?', sub: `For your security you will be signed out in about ${SESS_CFG.warnSec} seconds.`, body: '', submit: 'Stay signed in', onSubmit: () => { touch(); closeModal(); } });
    else toast(`You will be signed out in about ${SESS_CFG.warnSec} seconds. Tap anywhere to stay.`, 'err');
  }
  if (s) sessPatch({ last: SESS.last });
}
function startSession() {
  if (!SESS.bound) { SESS.bound = true; ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(e => window.addEventListener(e, () => { if (!SESS.warned || e !== 'scroll') touch(); }, { passive: true, capture: true })); }
  if (!SESS.timer) SESS.timer = setInterval(tick, Math.min(15000, Math.max(250, SESS_CFG.warnSec * 1000 / 4)));
  const s = sessRead(); if (s && s.need2fa) return endSession(); // a page reload must not skip the code
  if (s && s.last && Date.now() - s.last > SESS_CFG.idleMin * 60000) return endSession(`Signed out after ${SESS_CFG.idleMin} minutes of no activity.`);
  if (s && s.at && Date.now() - s.at > SESS_CFG.absoluteHr * 3600e3) return endSession(`Signed out. Sessions last at most ${SESS_CFG.absoluteHr} hours.`);
  SESS.last = Date.now(); SESS.warned = false;
}
{ const _ra = renderApp; renderApp = function () { _ra.apply(this, arguments); startSession(); checkDefaultPw(); }; }

/* ---------- default password warning ---------- */
async function checkDefaultPw() {
  if (S.owner && !S.v) { S.defaultPw = !!OWN.data.defaultPw; return; }
  if (!S.u || S.owner || S.u.id === 'SUPPORT') { S.defaultPw = false; return; }
  const key = S.v.id + S.u.id + S.u.hash; if (S._dpKey === key) return; S._dpKey = key;
  try { const c = S.v.code.toLowerCase(); S.defaultPw = S.u.hash === await hashPw(S.v.id, S.u.id, c + (S.u.role === 'admin' ? '-admin' : '-member')); } catch (_) { S.defaultPw = false; }
  if (S.defaultPw && SESS_CFG.forcePwChange) { S.u.mustChange = true; setTimeout(() => changePwModal(true), 200); }
  if (S.defaultPw && S.page && $('#view')) renderView();
}
{ const _rv = renderView; renderView = function () { _rv.apply(this, arguments); if (S.defaultPw && !S.owner && $('#view') && !$('#dpwBanner')) $('#view').insertAdjacentHTML('afterbegin', '<div class="callout warn" id="dpwBanner"><div><b>You are using the standard password</b><p>Anyone who knows this village\'s demo or starter password can sign in as you. Choose your own password now.</p></div><button class="btn btn-primary btn-sm" type="button" data-act="change-pw">Change password</button></div>'); }; }
{ const _cp = API.changePassword; API.changePassword = async function () { const r = await _cp.apply(this, arguments); S.defaultPw = false; S._dpKey = null; return r; }; }

/* ---------- enrolment screens ---------- */
function twoStepPanel(holder, isOwner) {
  const on = !!(holder && holder.totp && holder.totp.secret);
  return `<section class="panel" id="twostep"${isOwner ? ' style="max-width:640px;margin-top:16px"' : ''}><div class="panel-h"><div><h2>Two-step sign-in</h2><p>${on ? `On since ${esc(fmtTS(holder.totp.at))}. Sign-in needs a 6-digit code from your authenticator app. ${holder.totp.rec.length} recovery code${holder.totp.rec.length === 1 ? '' : 's'} left.` : 'Add a second lock. Even if someone learns your password, they cannot sign in without the code on your phone.'}</p></div>${on ? '<span class="badge b-active">On</span>' : '<span class="badge b-pending">Off</span>'}</div>
  <div class="btn-row">${on ? `<button class="btn btn-ghost btn-sm" type="button" data-act="2fa-new-rec">New recovery codes</button><button class="btn btn-ghost btn-sm" type="button" data-act="2fa-off">Turn off</button>` : '<button class="btn btn-primary btn-sm" type="button" data-act="2fa-on">Turn on</button>'}</div></section>`;
}
const holder2fa = () => S.owner && !S.v ? OWN.data : S.u;
const save2fa = () => { if (S.owner && !S.v) OWN.save(); else { log('Changed two-step sign-in', S.u.id, S.u.totp ? 'Turned on or refreshed' : 'Turned off'); commit(); } };
function showRecovery(codes, then) {
  infoModal('Save your recovery codes', 'Each code works once if you lose your phone', `<div class="callout upgrade" style="margin-top:12px"><div><b>Store these somewhere safe, away from your phone.</b><p>They will not be shown again.</p></div></div><pre class="recov">${codes.join('\n')}</pre><div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="2fa-dl-rec" data-c="${esc(codes.join(','))}">Download as a text file</button></div>`);
}
Object.assign(ACTIONS, {
  '2fa-on'() {
    const h = holder2fa(), secret = newSecret(), who = S.owner && !S.v ? 'Owner' : S.u.id, issuer = 'VillageVault', uri = `otpauth://totp/${encodeURIComponent(issuer + ':' + who)}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
    openModal({ title: 'Turn on two-step sign-in', sub: 'Add this account to an authenticator app (Google Authenticator, Microsoft Authenticator or Authy), then type the code it shows.',
      body: `<ol class="steps-mini"><li>In the app choose <b>Add account</b>, then <b>Enter a setup key</b>.</li><li>Account: <b>${esc(who)}</b>. Key: <code class="seckey">${fmtSecret(secret)}</code></li><li>Type the 6-digit code the app shows below.</li></ol><details><summary>Link for apps that open it directly</summary><input class="input" readonly value="${esc(uri)}" onclick="this.select()"></details><div class="field"><label for="tfN">6-digit code</label><input id="tfN" name="code" class="input" inputmode="numeric" maxlength="6" autocomplete="off"></div>`, submit: 'Confirm and turn on',
      onSubmit: async fd => {
        const rec = { secret, last: 0 }; if (!(await totpCheck(rec, fd.get('code')))) throw new Error('That code is not right. Check the key in your app and the time on your phone, then try again.');
        const codes = newRecovery(); rec.last = 0; rec.at = stamp(); rec.rec = await Promise.all(codes.map(sha256)); h.totp = rec; save2fa(); closeModal(); renderView(); setTimeout(() => showRecovery(codes), 150);
      } });
  },
  '2fa-off'() {
    const h = holder2fa();
    openModal({ title: 'Turn off two-step sign-in?', sub: 'Enter a current code (or a recovery code) to confirm.', body: '<div class="field"><label for="tfO">Code</label><input id="tfO" name="code" class="input" maxlength="9" autocomplete="off"></div>', submit: 'Turn off', danger: true,
      onSubmit: async fd => { let g = await totpCheck(h.totp, fd.get('code')) || await recoveryUse(h.totp, fd.get('code')); if (!g) throw new Error('That code is not right.'); delete h.totp; save2fa(); closeModal(); renderView(); toast('Two-step sign-in is off.', 'ok'); } });
  },
  '2fa-new-rec'() {
    const h = holder2fa();
    openModal({ title: 'New recovery codes', sub: 'The old codes stop working. Enter a current code to confirm.', body: '<div class="field"><label for="tfR">Code from your app</label><input id="tfR" name="code" class="input" inputmode="numeric" maxlength="6" autocomplete="off"></div>', submit: 'Make new codes',
      onSubmit: async fd => { if (!(await totpCheck(h.totp, fd.get('code')))) throw new Error('That code is not right.'); const codes = newRecovery(); h.totp.rec = await Promise.all(codes.map(sha256)); save2fa(); closeModal(); renderView(); setTimeout(() => showRecovery(codes), 150); } });
  },
  '2fa-dl-rec'(el) { download('VillageVault-recovery-codes.txt', new Blob([`VillageVault recovery codes (${new Date().toISOString().slice(0, 10)})\nEach code works once.\n\n${el.dataset.c.split(',').join('\n')}\n`], { type: 'text/plain' })); },
  'o-reset-2fa'(el) { try { OWNER_API.reset2fa(el.dataset.v, el.dataset.id); toast('Two-step sign-in reset for that admin.', 'ok'); renderView(); } catch (e) { toast(e.message, 'err'); } }
});
OWNER_API.reset2fa = function (vid, uid) {
  requireOwner(); const v = DB.cache[vid], u = v && v.users.find(x => x.id === uid); if (!u || !u.totp) throw new Error('That admin has no two-step sign-in.');
  delete u.totp; u.rememberTokens = []; olog('Reset two-step sign-in', v.name, `${u.name} (${u.id}) can set it up again after signing in`); OWN.save(); DB.save(v);
};
{ const _ad = ADMIN.admins; ADMIN.admins = function () { return _ad() + (S.u && S.u.lead && !S.owner ? twoStepPanel(S.u, false) : ''); }; VIEWS.admin.admins = ADMIN.admins; }
{ const _oa = OWNERV['o-account']; OWNERV['o-account'] = function () { return _oa() + twoStepPanel(OWN.data, true); }; }
