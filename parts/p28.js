/* =========================================================
   ROUND 12: fingerprint or face sign-in (WebAuthn platform authenticator).
   How it works: the phone or computer's own fingerprint, face or screen-lock check creates a key pair inside the device's secure
   hardware. Only the PUBLIC key is kept here. To sign in, the device must prove it holds the private key, after the person passes
   the fingerprint, face or PIN check ("user verification" is required, never optional). No fingerprint or face data ever leaves the
   device and VillageVault never sees it. A new random challenge is used every time, so a recording of an earlier sign-in is useless.
   Admins who have two-step sign-in switched on are still asked for their code afterwards.
   Honest limit of a site with no server: the signature is checked in this browser. When the backend is added, the same
   challenge and signature are verified on the server, which is what makes it bank grade. This file is built so that move is a swap, not a rewrite.
   ========================================================= */
const BIO_KEY = 'vv_bio_v1';
const b64u = {
  enc: buf => { const b = new Uint8Array(buf); let s = ''; b.forEach(x => { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: str => { str = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
};
const bioStore = () => { try { return JSON.parse(lsGet(BIO_KEY) || '{}') || {}; } catch (_) { return {}; } };
const bioSave = o => lsSet(BIO_KEY, JSON.stringify(o));
const bioSupported = () => !!(window.isSecureContext && window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && window.crypto && crypto.subtle);
const bioRpId = () => location.hostname;
const bioEnrolled = (vid, uid) => { const o = bioStore()[vid]; return !!(o && o[uid]); };
async function bioPlatformReady() { try { return bioSupported() && !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (_) { return false; } }
const bioSha = async data => new Uint8Array(await crypto.subtle.digest('SHA-256', data));
const bioChallenge = () => crypto.getRandomValues(new Uint8Array(32));
function derToRaw(der) {
  const b = new Uint8Array(der); let i = 2; if (b[1] & 0x80) i += (b[1] & 0x7f);
  const rd = () => { i++; let l = b[i++]; let v = b.slice(i, i + l); i += l; while (v.length > 32 && v[0] === 0) v = v.slice(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
  const r = rd(), s = rd(), out = new Uint8Array(64); out.set(r, 0); out.set(s, 32); return out;
}
const bioEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/* Turn it on for the signed-in person, after they type their password again. */
async function bioEnrol(cur) {
  if (!S.u || S.owner || S.u.id === 'SUPPORT') throw new Error('Sign in as a member or admin first.');
  if (!(await bioPlatformReady())) throw new Error('This device has no fingerprint, face or screen-lock sign-in available, or the page is not on a secure (https) address.');
  if (await hashPw(S.v.id, S.u.id, cur) !== S.u.hash) throw new Error('Your password is not correct.');
  let cred;
  try {
    cred = await navigator.credentials.create({ publicKey: { rp: { name: 'VillageVault', id: bioRpId() }, user: { id: new TextEncoder().encode(`${S.v.id}|${S.u.id}`), name: S.u.id, displayName: S.u.name },
      challenge: bioChallenge(), pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 60000, attestation: 'none',
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' } } });
  } catch (e) { throw new Error(e && e.name === 'NotAllowedError' ? 'The fingerprint or face check was cancelled or timed out.' : 'This device could not set up fingerprint or face sign-in.'); }
  const pk = cred.response.getPublicKey && cred.response.getPublicKey();
  if (!pk) throw new Error('This browser cannot keep the key it needs. Update the browser and try again.');
  const o = bioStore(); o[S.v.id] = o[S.v.id] || {}; o[S.v.id][S.u.id] = { cid: b64u.enc(cred.rawId), pub: b64u.enc(pk), counter: 0, epoch: S.u.bioEpoch || 0, at: Date.now() }; bioSave(o);
  if (isAdmin()) log('Switched on fingerprint or face sign-in', S.u.id, 'On one device'); commit();
}
function bioRemove(vid, uid) { const o = bioStore(); if (o[vid]) { delete o[vid][uid]; if (!Object.keys(o[vid]).length) delete o[vid]; bioSave(o); } }

/* Sign in: the device proves it holds the key, the signature is checked, then the normal sign-in (and two-step for admins) continues. */
async function bioLogin(vid) {
  const o = (bioStore()[vid]) || {}, ids = Object.keys(o); if (!ids.length) throw new Error('No fingerprint or face sign-in is set up for this village on this device. Sign in with your password, then switch it on from the menu.');
  const fails = Number(ssGet('vv_bio_fail') || 0); if (fails >= 5) throw new Error('Too many fingerprint or face attempts. Sign in with your password.');
  const challenge = bioChallenge(); let a;
  try { a = await navigator.credentials.get({ publicKey: { challenge, rpId: bioRpId(), timeout: 60000, userVerification: 'required', allowCredentials: ids.map(id => ({ type: 'public-key', id: b64u.dec(o[id].cid) })) } }); }
  catch (e) { throw new Error(e && e.name === 'NotAllowedError' ? 'The fingerprint or face check was cancelled or did not match.' : 'Fingerprint or face sign-in is not available right now. Use your password.'); }
  const bad = () => { ssSet('vv_bio_fail', String(fails + 1)); return new Error('That fingerprint or face sign-in could not be confirmed. Use your password.'); };
  const uid = ids.find(id => o[id].cid === b64u.enc(a.rawId)); if (!uid) throw bad();
  const rec = o[uid], r = a.response, cd = new Uint8Array(r.clientDataJSON), ad = new Uint8Array(r.authenticatorData);
  let c; try { c = JSON.parse(new TextDecoder().decode(cd)); } catch (_) { throw bad(); }
  if (c.type !== 'webauthn.get' || c.origin !== location.origin || !bioEq(b64u.dec(c.challenge), challenge)) throw bad();
  if (!bioEq(ad.slice(0, 32), await bioSha(new TextEncoder().encode(bioRpId())))) throw bad();
  const flags = ad[32]; if (!(flags & 1) || !(flags & 4)) throw bad();               // user present AND user verified (fingerprint, face or PIN)
  const counter = ((ad[33] << 24) | (ad[34] << 16) | (ad[35] << 8) | ad[36]) >>> 0; if ((counter || rec.counter) && counter <= rec.counter) throw bad();   // a replayed or cloned key
  const key = await crypto.subtle.importKey('spki', b64u.dec(rec.pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const signed = new Uint8Array(ad.length + 32); signed.set(ad, 0); signed.set(await bioSha(cd), ad.length);
  if (!(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(r.signature), signed))) throw bad();
  const vil = vilById(vid); if (!vil || vil.removed) throw new Error('This village or association is no longer on VillageVault. Contact your admin.');
  const v = await DB.load(vid), u = v.users.find(x => x.id === uid);
  if (!u || !u.active) { bioRemove(vid, uid); throw new Error('This account is not active. Contact your admin.'); }
  if ((u.bioEpoch || 0) !== (rec.epoch || 0)) { bioRemove(vid, uid); throw new Error('Your login details were reset by an admin, so fingerprint or face sign-in was switched off on this device. Sign in with your password and switch it on again.'); }
  if (v.status === 'suspended') throw new Error('Access is paused for this village or association. Contact VillageVault support.');
  rec.counter = counter; const all = bioStore(); all[vid][uid] = rec; bioSave(all); ssDel('vv_bio_fail');
  ssSet('vv_sess', JSON.stringify({ v: vid, u: u.id })); enterApp(v, u);
}

/* A password reset by an admin or the owner switches the device sign-in off until the person turns it on again. */
(function bioEpochs() {
  const rp = API.resetPassword; API.resetPassword = function (id) { const u = userById(id); if (u) u.bioEpoch = (u.bioEpoch || 0) + 1; return rp.apply(API, arguments); };
  const ra = OWNER_API.resetAdminPw; OWNER_API.resetAdminPw = function (v, id) { const u = v.users.find(x => x.id === id); if (u) u.bioEpoch = (u.bioEpoch || 0) + 1; return ra.apply(OWNER_API, arguments); };
})();

function bioModal() {
  const on = bioEnrolled(S.v.id, S.u.id);
  openModal({ title: 'Fingerprint or face sign-in', sub: on ? 'This device can open your account with your fingerprint, face or screen lock.' : 'Use your phone or computer’s own fingerprint, face or screen-lock check instead of typing your password on this device.',
    body: `<p class="hint">Your fingerprint or face never leaves this device and VillageVault never sees it. You can still sign in with your password. Switching it on only works on this device.${S.u.role === 'admin' ? ' Your two-step code, if you use one, is still asked for.' : ''}</p>${on ? '' : pwField('bioP', 'cur', 'Your password, to confirm it is you', 'current-password')}`,
    submit: on ? 'Switch off on this device' : 'Switch on', danger: on,
    onSubmit: async fd => { if (on) { bioRemove(S.v.id, S.u.id); done('Fingerprint or face sign-in switched off on this device.'); } else { await bioEnrol(fd.get('cur') || ''); done('Fingerprint or face sign-in is on for this device.'); } } });
}
Object.assign(ACTIONS, {
  'bio-manage'() { bioModal(); },
  async 'bio-login'() {
    const vid = ($('#heroVillage') || {}).value, err = m => formError(m, 'loginError'); err('');
    if (!vid) return err('Choose your village or association first.');
    const btn = $('#bioBtn'); if (btn) btn.disabled = true;
    try { await bioLogin(vid); } catch (ex) { err(ex.message || 'Fingerprint or face sign-in did not work. Use your password.'); } finally { if (btn) btn.disabled = false; }
  }
});
(async function bioInit() { const b = $('#bioBtn'); if (b && (await bioPlatformReady())) b.hidden = false; })();
