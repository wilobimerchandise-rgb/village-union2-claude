# VillageVault

Verified financial records for village unions and associations (repository: village-union2-claude).

Members pay their village or association offline, upload proof of payment, and an admin verifies it. The ledger, receipts, reports and member statements update from verified entries only. VillageVault never holds or moves village money.

> **Status: front-end prototype.** All data is stored in the visitor's own browser (localStorage). Nothing is shared between devices and there is no server yet. Do not enter real village money records until the backend is built. Demo logins and the default owner password in `app.js` are for testing only and must be changed before sharing the site.

## Live site
https://wilobimerchandise-rgb.github.io/village-union2-claude/

## What is in this repository
| File | Purpose |
|---|---|
| `index.html` | Landing page, village sign-in and the app shell |
| `styles.css` | All styling |
| `app.js` | The whole app (built from smaller parts) |
| `app.min.js` | Minified copy of `app.js` |
| `docs/` | Legal pack and village onboarding form (Terms, Privacy, Licence) |
| `supabase/` | Early backend drafts for the sponsor feature (not connected to the app yet) |

To run it locally, open `index.html` in a browser. No install or build is needed.

## Plans
**Basic:** up to 20 active members for a village (10 in the Men's Wing, 10 in the Women's Wing) or 10 for an association; proof upload and verification; full ledger; receipts, monthly and yearly reports and member statements; attendance register, pledges and achievements; Share button that attaches PDFs in WhatsApp on phones; VillageVault watermark on documents.

**Premium:** everything in Basic with no member limit, plus letterhead receipts signed by the Chairman and Financial Secretary; village name, code and logo on every document; no watermark; meeting minutes; meeting agenda builder; terms of office tracker and handover pack; one-tap AGM report and downloadable village reports for members; WhatsApp broadcast; notice board with "seen by X of Y"; birthdays and anniversaries with admin dashboard widget and custom wish messages; member ID card with QR check-in; good standing certificate with QR code; emergency levies; community projects with progress tracker; change the village code; automatic backups.

## Roles
- **Members** see their own dashboard and the village dashboard.
- **Admins** (Chairman, Secretary, Financial Secretary, Treasurer and others) verify payments, keep the register and see what each other did. Every admin action is named and time-stamped.
- **Owner** (platform) manages villages, plans, sponsors and upgrade requests. Hidden from villages.

## Known limits of the prototype
- WhatsApp links open one chat at a time. Sending to many chats in one click needs the WhatsApp Business service, added with the backend.
- The Share button attaches files on most phones, but not on every device or desktop browser. Then the file is downloaded instead.
- Camera scanning of ID cards works in Chrome on Android and desktop, not in iPhone Safari. Typing the code or a barcode scanner works everywhere.
- Plan limits, logins and the QR codes are checked in the browser only. Real enforcement and signed QR codes come with the backend.
- Automatic birthday messages need a scheduled server job.

## Roadmap
1. Backend (database with per-village isolation, real logins, server-side plan checks, audit trail).
2. Notifications (email, then WhatsApp or SMS).
3. Offline use and an installable app.
