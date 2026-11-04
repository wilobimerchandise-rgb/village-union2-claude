/* =========================================================
   ROUND 8: membership strip, Basic plan member limit
   ========================================================= */
function membershipStrip() {
  const u = S.u, yrs = Math.floor((Date.now() - new Date(u.joined).getTime()) / (365.25 * 864e5));
  return `<div class="member-strip"><div><small>Member since</small><b>${esc(fmtDate(u.joined))}</b></div><div><small>Your ID</small><b class="mono">${esc(u.id)}</b></div>${isVillageType() && kinOf(u) ? `<div><small>Family and kindred</small><b>${esc(kinOf(u))}</b></div>` : ''}<div><small>Time with us</small><b>${yrs >= 1 ? yrs + (yrs === 1 ? ' year' : ' years') : 'Under a year'}</b></div></div>`;
}
const premiumBadge = '<span class="badge b-admin prem-badge" role="button" tabindex="0" data-act="upgrade-info" title="See what Premium adds and upgrade">Premium</span>';
function capNotice() {
  if (S.v.plan === 'premium') return '';
  const n = activeMembers(), CAP = basicCap(), left = CAP - n;
  if (n >= CAP) return `<div class="callout upgrade"><div><b>${premiumBadge} You have reached the Basic plan limit of ${CAP} members</b><p>${n} active members. Upgrade to Premium to add more members, and to get the letterhead receipts, village profile on every document and one-click WhatsApp broadcast.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="upgrade-info">How to upgrade</button></div>`;
  if (left <= Math.max(3, Math.ceil(CAP * 0.2))) return `<div class="callout upgrade"><div><b>${premiumBadge} Only ${left} member place${left === 1 ? '' : 's'} left on the Basic plan</b><p>${n} of ${CAP} places used. Basic covers up to ${capWords()}. Upgrade to Premium before you reach the limit.</p>${bar(Math.round(n * 100 / CAP), '#E8A33D')}</div><div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="upgrade-info">How to upgrade</button>${typeof trialBtn === 'function' ? trialBtn() : ''}</div></div>`;
  return '';
}
const upgradeBtn = () => (S.u && !S.owner && S.u.role === 'admin' && S.v && S.v.plan !== 'premium') ? '<div class="btn-row" style="margin-top:14px"><button class="btn btn-saffron" type="button" data-act="upgrade-start">Upgrade to Premium</button>' + (typeof trialBtn === 'function' ? trialBtn() : '') + '</div>' : '';
function upgradeModal(feature) {
  infoModal('Upgrade to Premium', capReached() ? 'Your Basic plan is full' : 'What Premium adds', `<div class="upgrade-box"><div class="up-badge">${premiumBadge}</div><p>The Basic plan covers up to <b>${capWords()}</b> and you have ${activeMembers()} here. Premium removes the limit and adds:</p>
  <ul class="ticks"><li>No member limit</li><li>Professional letterhead receipts with the Chairman and Financial Secretary signatures</li><li>Your village name, code and logo on every document</li><li>WhatsApp broadcast to everyone, with a contacts file</li><li>Notice board with "seen by 40 of 60"</li><li>Member ID card with QR check-in</li><li>Meeting minutes: the Secretary writes, the Chairman approves, both sign</li><li>Emergency levies named by the Chairman, Secretary or Financial Secretary</li><li>Community projects with a progress tracker and donor wall</li><li>Good standing certificate with a QR code</li><li>One-tap AGM report and downloadable village reports for members</li><li>Terms of office tracker, handover pack and agenda builder</li><li>Birthdays and anniversaries with an admin widget and custom wish messages</li><li>Village year in review, bulk member import and priority support</li><li>No VillageVault watermark on documents</li></ul><p class="hint">Your records stay exactly as they are when you move to Premium.</p>${upgradeBtn()}</div>`);
}
Object.assign(ACTIONS, { 'upgrade-info'() { upgradeModal(); } });
