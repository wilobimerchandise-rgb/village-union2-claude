# VillageVault

Three files go live: `index.html`, `styles.css`, `app.js` (and optionally the smaller `app.min.js`: point the `<script>` tag at it).

## Working on the code
- Source lives in `parts/p1.js … p28.js`. `sh build.sh` joins them into `app.js` (and `app.min.js` if esbuild is installed). `p13.js` must stay last.
- Never edit `app.js` by hand; edit the part and rebuild.

## Tests
```
npm install
npx playwright install chromium
npm test            # all end-to-end checks (about 8 minutes)
npm run test:quick  # the fast ones
node tests/run-all.js 14 15   # only files starting with 14 or 15
```
Each file prints PASS/FAIL lines. The runner starts its own web server, so nothing else is needed.
`tests/perf-stress.manual.js` builds a 425-member, 6,000-payment village and times every page (run it by hand).

## Demo logins
`<CODE>-A01` (Lead Admin), `-A02`, `-A03` / `<code>-admin`; `<CODE>-M001…` / `<code>-member`; owner at `#owner` (ID `OWNER`; the starting password is not published, ask the platform owner).

## Round 12 notes
- Villages are opened only through their Men's Wing and Women's Wing (`vv_wings_v1` holds the owner's on/off choice per village). Associations are opened directly and have no wings.
- Basic plan: village 20 members (10 per wing), association 10. See `basicCap()` in p2.
- Duties (p27): only the Financial Secretary verifies payments, records expenses and opens/closes the register. The Financial Secretary's own proofs go to the Chairman; the Chairman's go to the Financial Secretary.
- Username and password change for every member and admin (p27). Fingerprint or face sign-in (p28, WebAuthn): checked in the browser for now; the backend must verify the same challenge and signature to make it bank grade.
- Tests: `tests/_parent-options.js` adds hidden village ids to the sign-in lists for older tests only.

## Round 14: Premium additions (parts p30, p31)
- p30: QR encoder (own code, byte mode, versions 1-14, verified by decoding), plan rules for the new features, good standing certificate (PDF and PNG with QR), member village reports, one-tap AGM report, `docWriter` (multi-page PDF helper).
- p31: term-of-office tracker and handover pack, agenda builder, emergency levies, community projects, birthdays and anniversaries, navigation and dashboard banners.
- Also: admin details can be corrected (p29), upgrade requests and owner activation (p29), receipt names never cut off (p9, p18).
- Tests 25 (upgrade, live, pledge reminder), 26 (edit admin), 27 (all Round 14 Premium features).
- Playbook v2.7 phases 10.19 to 10.28 describe the server side of everything above.

## Round 15
- WhatsApp broadcast to everyone (audiences, placeholders, copy message, contacts .vcf, one-chat-per-tap queue). Premium.
- Notice board with "seen by X of Y", unseen list and nudge. Premium.
- Birthday on profile, admin dashboard widget (next 14 days), custom wish message, ask-for-birthdays. Premium.
- Share button (Web Share with the PDF attached) on receipts, notices, pledge reminders, certificates, agendas, ID cards.
- Member ID card (PNG, printable PDF sheet) with QR check-in; creates a normal pending attendance mark. Premium.
- New part parts/p32.js (before p13). Test 28 added; test 02 counts updated.

## Round 15b
- Plans table now has 21 rows (notice board, ID card, wider broadcast, birthday widget, Share button).
- Landing page Premium card lists all 16 Premium features; upgrade dialog updated.
- Premium button motion (landing and dashboards), disabled under reduced motion. Test 21 updated to 21 rows.

## Round 16
- 30-day Premium trial (once per village or association; Lead Admin or Chairman starts it; returns to Basic with every record kept).
- Member-cap nudge at 80 percent with a progress bar and the trial button.
- Locked pages show a sample preview with made-up data.
- Village year in review (PDF, share, WhatsApp summary).
- Help desk for admins with an owner queue; Premium and trial villages are answered first.
- Bulk member import from CSV or pasted Excel cells, with a check step and a login sheet.
- New part parts/p33.js; test 29 added; tests 02 and 21 counts updated.

## Round 17
- Security pass: the owner default password is stored as a hash only; failed sign-ins lock the account and the lock survives new tabs and escalates; the owner lock escalates to 15 minutes; money roles (Chairman, Financial Secretary, Treasurer, Lead Admin) are asked to turn on two-step sign-in (snooze 7 days); security panel. This only deters casual misuse in a browser; real protection needs the backend.
- Installable app that works offline: manifest.webmanifest, sw.js, icon-192.png, icon-512.png, icon-512-maskable.png (upload all five to the repository root), install button, offline chip.
- Excel (.xlsx) export of payments, owing list, members, expenses and attendance, per page and as one workbook (parts/p34.js).
- Setup checklist for new admins on the dashboard.
- Live demo village with role switch, Basic/Premium switch and a five-step tour (parts/p35.js). Sample data only, nothing is sent or saved, deleted on exit.
- Landing page: "Live demo" link, section and updated Basic and Premium feature lists.
- Tests: 30 added; 16 (accessibility) fixed for the demo card.
