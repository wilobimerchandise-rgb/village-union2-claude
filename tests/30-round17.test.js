const { chromium } = require('playwright'); const fs = require('fs'); const cp = require('child_process');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900},acceptDownloads:true});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL;const errs=[];const OUT=process.env.OUT||'/tmp';
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
const login=async(v,id,pw,pg)=>{const q=pg||p;await q.goto(U);await q.evaluate(()=>sessionStorage.clear());await q.goto(U);await q.waitForTimeout(250);await q.selectOption('#heroVillage',v);await q.fill('#loginId',id);await q.fill('#loginPw',pw);await q.click('#loginBtn');await q.waitForTimeout(900);};
const esc=async()=>{if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(300);}};
const go=async pg=>{await p.waitForTimeout(1200);await esc();await p.click(`.navlist [data-page=${pg}]`);await p.waitForTimeout(350);};
const txt=async s=>await p.textContent(s);
const py=(code)=>cp.execFileSync('python3',['-c',code]).toString().trim();
// ================= SECURITY
await p.goto(U);const src=await p.evaluate(async u=>await (await fetch(u.replace(/index\.html.*/,'app.js'))).text(),U);
ok(!src.includes('owner-2026'),'the owner password is not written in app.js');
const O=await ctx.newPage();O.on('pageerror',e=>errs.push(e.message));O.setDefaultTimeout(8000);
await O.goto(U+'#owner');await O.waitForTimeout(400);await O.fill('#ownId','OWNER');await O.fill('#ownPw','owner-2026');await O.click('#ownerBtn');await O.waitForSelector('.shell');ok(true,'the owner can still sign in with the starting password');await O.close();
// lockout survives a new tab
await p.goto(U);await p.evaluate(()=>sessionStorage.clear());await p.waitForTimeout(250);await p.selectOption('#heroVillage','umuchima~men');
for(let i=0;i<3;i++){await p.fill('#loginId','UMCM-M001');await p.fill('#loginPw','wrong'+i);await p.click('#loginBtn');await p.waitForTimeout(350);}
ok(/contact admin/i.test(await txt('#loginError')),'three wrong tries lock the account');
const k=await p.evaluate(()=>Object.keys(localStorage).filter(x=>x.startsWith('vv_fail_')).map(x=>JSON.parse(localStorage.getItem(x))));ok(k.length===1&&k[0].k===1&&k[0].until>Date.now(),'the lock is kept in long-term storage with a strike count');
const P2=await ctx.newPage();await P2.goto(U);await P2.waitForTimeout(300);await P2.selectOption('#heroVillage','umuchima~men');await P2.fill('#loginId','UMCM-M001');await P2.fill('#loginPw','umcm-member');await P2.click('#loginBtn');await P2.waitForTimeout(600);
ok(/contact admin/i.test(await P2.textContent('#loginError'))&&await P2.$('.shell')===null,'a new tab does not reset the lock');await P2.close();
await p.evaluate(()=>Object.keys(localStorage).filter(x=>x.startsWith('vv_fail_')).forEach(x=>localStorage.removeItem(x)));
// two-step nudge for the money roles
await login('umuokpu~men','UMKM-A01','umkm-admin');
ok(/Protect the village money/i.test(await txt('#view')),'the Chairman is asked to turn on two-step sign-in');
await p.click('[data-act=sec-open]');await p.waitForTimeout(300);ok(/Two-step sign-in/.test(await txt('#modalRoot'))&&/Three wrong tries/.test(await txt('#modalRoot')),'security panel opens for a non-lead admin');await esc();
await p.click('[data-act=sec-later]');await p.waitForTimeout(300);ok(!/Protect the village money/i.test(await txt('#view')),'Not now hides the banner for a week');
// ================= ONBOARDING
await login('umuchima~men','UMCM-A02','umcm-admin');
ok(/Get .* ready/.test(await txt('#view'))&&/Choose your own password/.test(await txt('#view')),'onboarding checklist is shown to a new admin');
await p.click('[data-act=onb-hide]');await p.waitForTimeout(300);ok(!/Get .* ready/.test(await txt('#view')),'the checklist can be hidden');
// ================= EXCEL
await login('umuokpu~men','UMKM-A02','umkm-admin');await go('transactions');
const nTx=await p.evaluate(()=>{const k=Object.keys(localStorage).find(x=>x==='vv_v1_umuokpu~men');return JSON.parse(localStorage.getItem(k)).tx.length;});
const [d]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=xl][data-k=transactions]')]);await d.saveAs(`${OUT}/tx.xlsx`);
const r1=py(`import openpyxl;wb=openpyxl.load_workbook('${OUT}/tx.xlsx');ws=wb['Payments'];print(wb.sheetnames,ws.max_row-1,[c.value for c in ws[1]][:6],type(ws['A2'].value).__name__,type(ws['F2'].value).__name__)`);
ok(r1.includes("['Payments']")&&r1.includes(`] ${nTx} [`)&&/datetime/.test(r1)&&/int|float/.test(r1.split(' ').slice(-1)[0]),'Payments .xlsx opens in a spreadsheet reader with all '+nTx+' rows: '+r1.slice(0,120));
await go('outstanding');const [d2]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=xl][data-k=owing]')]);await d2.saveAs(`${OUT}/owing.xlsx`);
ok(/Owing/.test(py(`import openpyxl;print(openpyxl.load_workbook('${OUT}/owing.xlsx').sheetnames)`)),'owing list exports');
await go('reports');const [d3]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=xl-all]')]);await d3.saveAs(`${OUT}/all.xlsx`);
const r3=py(`import openpyxl;print(openpyxl.load_workbook('${OUT}/all.xlsx').sheetnames)`);ok(/Members/.test(r3)&&/Payments/.test(r3)&&/Expenditure/.test(r3)&&/Attendance/.test(r3),'the whole-village workbook has all sheets: '+r3);
await go('audit');ok(/Exported to Excel/.test(await txt('#view')),'every export is written in the activity log');
// ================= PWA
ok(await p.evaluate(()=>!!document.querySelector('link[rel=manifest]')),'manifest is linked');
const mf=await p.evaluate(async()=>{const r=await fetch('manifest.webmanifest');return await r.json()});ok(mf.name==='VillageVault'&&mf.icons.length>=2&&mf.display==='standalone','manifest is valid');
await p.goto(U);await p.waitForTimeout(1500);const sw=await p.evaluate(async()=>{try{const r=await navigator.serviceWorker.ready;return !!r.active}catch(e){return false}});ok(sw,'the service worker is active');
await p.reload();await p.waitForTimeout(800);const cached=await p.evaluate(async()=>{const ks=await caches.keys();const c=await caches.open(ks[0]);return (await c.keys()).map(r=>new URL(r.url).pathname)});ok(cached.some(x=>/app\.js$/.test(x))&&cached.some(x=>/styles\.css$/.test(x)),'app files are saved for offline use: '+cached.length+' files');
await ctx.setOffline(true);await p.waitForTimeout(400);ok(await p.$eval('#netChip',e=>!e.hidden&&/offline/i.test(e.textContent)).catch(()=>false),'an offline notice appears');
await p.reload().catch(()=>{});await p.waitForTimeout(1000);ok(/VillageVault/.test(await p.title())&&await p.$('#heroVillage')!==null,'the app opens with no signal');
await ctx.setOffline(false);await p.waitForTimeout(400);
// ================= LIVE DEMO
await p.evaluate(()=>sessionStorage.clear());await p.goto(U);await p.waitForTimeout(500);
const opts=await p.$$eval('#heroVillage option',o=>o.map(x=>x.textContent));ok(!opts.some(x=>/Demo/.test(x)),'the demo village is not in the sign-in list');
const before=await p.evaluate(()=>({u:localStorage.getItem('vv_upgrades_v1'),o:localStorage.getItem('vv_owner_v1'),s:localStorage.getItem('vv_support_v1')}));
await p.evaluate(()=>{window.__opened=[];window.open=u=>{window.__opened.push(u);return {};};});
await p.click('[data-act=demo-start][data-tour="1"]');await p.waitForSelector('#demoBar',{timeout:15000});await p.waitForTimeout(800);
ok(/DEMO/.test(await txt('#demoBar')),'the demo bar says this is sample data');
ok(/Step 1 of 5/.test(await txt('#tourCard'))&&/uploads proof/.test(await txt('#tourCard')),'tour step 1 (member)');
ok(await p.$('#view .tour-pulse')!==null,'the Upload proof button is highlighted');
await p.click('[data-act=tour-next]');await p.waitForTimeout(900);ok(/Step 2 of 5/.test(await txt('#tourCard'))&&/Waiting for verification|Verify payments/.test(await txt('#pageTitle')+await txt('#view')),'tour step 2 (admin verifies)');
await p.click('[data-act=tour-next]');await p.waitForTimeout(900);ok(/Seen by \d+ of \d+/.test(await txt('#view')),'tour step 3 shows "Seen by X of Y": '+((await txt('#view')).match(/Seen by \d+ of \d+/)||[''])[0]);
await p.click('[data-act=tour-next]');await p.waitForTimeout(1200);ok(/ID card/.test(await txt('#view'))&&await p.$('#idImg')!==null,'tour step 4 shows the ID card');
await p.click('[data-act=tour-next]');await p.waitForTimeout(900);ok(/in review/.test(await txt('#view'))&&/Choose my village/.test(await txt('#tourCard')),'tour step 5 shows the year in review and the call to action');
await p.click('[data-act=tour-next]');await p.waitForTimeout(400);ok(await p.$('#tourCard')===null,'the tour can be finished');
await p.click('[data-act=demo-plan][data-plan=basic]');await p.waitForTimeout(500);await p.click('.navlist [data-page=notices]');await p.waitForTimeout(500);ok(await p.$('#view .sample-lock')!==null,'switching to Basic locks the Premium pages with a sample');
await p.click('[data-act=demo-plan][data-plan=premium]');await p.waitForTimeout(500);
await p.click('.navlist [data-page=overview]');await p.waitForTimeout(500);
const wa=await p.$('#bdayWidget a[href*="wa.me"]');if(wa){await wa.click();await p.waitForTimeout(300);ok((await p.evaluate(()=>window.__opened)).length===0,'WhatsApp does not open from the demo');}else ok(true,'(no birthday link on this day)');
await p.click('[data-act=demo-role][data-role=member]');await p.waitForTimeout(600);ok(/My dashboard/.test(await txt('#pageTitle')),'the role switch shows the member dashboard');
const after=await p.evaluate(()=>({u:localStorage.getItem('vv_upgrades_v1'),o:localStorage.getItem('vv_owner_v1'),s:localStorage.getItem('vv_support_v1'),pr:localStorage.getItem('vv_presence_v1')||''}));
ok(after.u===before.u&&after.s===before.s&&!/vvdemo/.test(after.pr),'the demo leaves the upgrade queue, support desk and online list alone');
await p.click('[data-act=demo-exit]');await p.waitForTimeout(600);ok(await p.$('#demoBar')===null&&await p.$('#heroVillage')!==null,'exiting returns to the landing page');
ok(await p.evaluate(()=>localStorage.getItem('vv_v1_vvdemo'))===null,'the sample village is deleted when the demo ends');
ok(/Live demo/.test(await txt('.nav, header nav, nav')),'the landing page links to the live demo');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
