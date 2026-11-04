/* =========================================================
   ROUND 11 / step 7: "What is Premium" page (the language picker was removed).
   ========================================================= */
const PLAN_TABLE = [
  ['Active members', 'Village: 20 (10 in the Men\u2019s Wing, 10 in the Women\u2019s Wing). Association: 10', 'No limit'],
  ['Proof upload, admin verification and the full ledger', 1, 1],
  ['Receipts, monthly and yearly reports and member statements', 1, 1],
  ['Attendance register, pledges and achievements', 1, 1],
  ["Men's and Women's wings (they use the village's plan)", 1, 1],
  ['Receipts and reports', 'VillageVault watermark', 'Letterhead, signed by the Chairman and Financial Secretary'],
  ['Village name, code and logo on every document', 0, 1],
  ['Meeting minutes (Secretary writes, Chairman approves, both sign)', 0, 1],
  ['WhatsApp broadcast to everyone, members who owe, or admins, with a contacts file (Chairman or Financial Secretary)', 0, 1],
  ['Notice board with "seen by 40 of 60" and a list of who has not seen it', 0, 1],
  ['Member ID card with QR check-in at meetings', 0, 1],
  ['Emergency levies (named by Chairman, Secretary or Financial Secretary)', 0, 1],
  ['Community projects with progress tracker and donor wall', 0, 1],
  ['Good standing certificate with QR code', 0, 1],
  ['One-tap AGM report; village reports downloadable by members', 0, 1],
  ['Terms of office tracker and handover pack', 0, 1],
  ['Meeting agenda builder', 0, 1],
  ['Birthdays and anniversaries: dates on profiles, admin dashboard widget, custom wish messages', 0, 1],
  ['Share button that attaches the PDF in WhatsApp on phones (receipts, notices, reminders, certificates, agendas)', 1, 1],
  ['Try Premium free for 30 days (once, then back to Basic with every record kept)', 'Available once', 'Included'],
  ['Village year in review: totals, months, levies, meetings and projects as a PDF', 0, 1],
  ['Bulk member import from Excel or CSV, with a login sheet', 0, 1],
  ['Help desk for admins', 'Standard queue', 'Priority: answered first, plus a direct WhatsApp line'],
  ['Excel export of payments, members, the owing list, expenses and attendance', 1, 1],
  ['Install on a phone and keep working without a signal', 1, 1],
  ['Change the village code', 0, 1],
  ['Automatic backups', 0, 1]
];
function plansView() {
  const prem = S.v.plan === 'premium', n = activeMembers();
  const cell = v => v === 1 ? '<td class="yes">Included</td>' : v === 0 ? '<td class="no">Not included</td>' : `<td>${esc(v)}</td>`;
  const head = prem
    ? `<div class="callout ok"><div><b>${esc(S.v.name)} is on Premium</b><p>Everything below is switched on for your village or association.</p></div></div>`
    : `<div class="callout upgrade"><div><b>${esc(S.v.name)} is on the Basic plan</b><p>You have ${n} active member${n === 1 ? '' : 's'} and Basic covers up to ${capWords()}. Premium removes the limit and switches on the extras in the right-hand column.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="upgrade-info">How to upgrade</button></div>`;
  return `<section class="panel"><div class="panel-h"><div><h2>Plans and Premium</h2><p>What each plan includes. Moving to Premium keeps every record exactly as it is.</p></div></div>${head}
  <div class="tablewrap"><table class="t plan-table"><thead><tr><th scope="col">What you get</th><th scope="col">Basic${prem ? '' : ' (your plan)'}</th><th scope="col">Premium${prem ? ' (your plan)' : ''}</th></tr></thead><tbody>${PLAN_TABLE.map(r => `<tr><td>${esc(r[0])}</td>${cell(r[1])}${cell(r[2])}</tr>`).join('')}</tbody></table></div></section>`;
}
VIEWS.admin.plans = plansView; VIEWS.member.plans = plansView;
