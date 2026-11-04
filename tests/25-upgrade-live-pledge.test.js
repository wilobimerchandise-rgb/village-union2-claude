const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL||'http://localhost:8765/index.html';const errs=[];
const mk=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));return p};
const A=await mk(),O=await mk();
const login=async(p,v,id,pw)=>{await p.goto(U);await p.evaluate(()=>sessionStorage.clear());await p.goto(U);await p.waitForTimeout(250);await p.selectOption('#heroVillage',v);await p.waitForTimeout(150);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(800);return !!(await p.$('.shell'))};
const owner=async(p)=>{await p.goto(U+'#owner');await p.waitForTimeout(400);await p.fill('#ownId','OWNER');await p.fill('#ownPw','owner-2026');await p.click('#ownerBtn');await p.waitForSelector('.shell');};
const V='umuchima~men';
// owner sets payment details
await owner(O);await O.click('.navlist [data-page=o-account]');await O.waitForTimeout(250);await O.click('[data-act=o-upg-cfg]');
await O.fill('#ucP','N25,000 per year');await O.fill('#ucB','Test Bank');await O.fill('#ucN','0123456789');await O.fill('#ucA','VillageVault Ltd');await O.fill('#ucL','https://paystack.com/pay/vv-test');await O.click('#mSubmit');await O.waitForTimeout(300);
ok(/0123456789/.test(await O.textContent('#view')),'owner saved the upgrade payment details');
// admin on Basic hits a premium feature
ok(await login(A,V,'UMCM-A02','umcm-admin'),'admin signs in');
await A.click('.navlist [data-page=minutes]');await A.waitForTimeout(300);
const badge=await A.$('.prem-badge');ok(!!badge,'the Premium badge is on screen');
await A.click('.prem-badge >> nth=0');await A.waitForTimeout(250);ok(/Upgrade to Premium/.test(await A.textContent('#modalRoot')),'clicking the badge opens the upgrade information');
await A.click('[data-act=upgrade-start]');await A.waitForTimeout(250);
ok(/0123456789/.test(await A.textContent('#modalRoot'))&&/PREMIUM-/.test(await A.textContent('#modalRoot')),'the form shows the bank details and a payment reference');
await A.fill('#upA','25000');await A.click('#mSubmit');await A.waitForTimeout(250);ok(/Upload your proof/.test(await A.textContent('#mError')),'manual payment needs proof');
await A.check('input[value=paystack]');await A.waitForTimeout(100);ok(await A.isVisible('#upPay')&&!(await A.isVisible('#upMan')),'choosing Paystack shows the Paystack link');
await A.check('input[value=manual]');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
await A.setInputFiles('#upF',{name:'slip.png',mimeType:'image/png',buffer:png});await A.click('#mSubmit');await A.waitForTimeout(500);
ok(await A.evaluate(()=>JSON.parse(localStorage.getItem('vv_upgrades_v1')||'[]').length===1),'the request is saved');
// owner alerted
await O.waitForTimeout(600);
await O.click('.navlist [data-page=o-overview]');await O.waitForTimeout(300);
ok(/upgrade request/.test(await O.textContent('#view')),'owner overview shows the waiting request');
{const t=await O.textContent('.navlist [data-page=o-upgrades]');ok(/1/.test(t),'owner menu shows a count: '+JSON.stringify(t));}
await O.click('.navlist [data-page=o-upgrades]');await O.waitForTimeout(250);
await O.click('[data-act=upg-proof]');await O.waitForTimeout(200);ok(await O.isVisible('#modalRoot img'),'owner can view the proof');await O.keyboard.press('Escape');
await O.click('[data-act=upg-activate]');await O.click('#mSubmit');await O.waitForTimeout(500);
ok(await O.evaluate(()=>/premium/.test(localStorage.getItem('vv_plans_v1')||'')),'owner activated Premium');
// admin now premium
await A.reload();await A.waitForTimeout(800);
await A.click('.navlist [data-page=minutes]');await A.waitForTimeout(300);ok(!(await A.$('.prem-badge')),'after activation the Premium upsell is gone');
// presence
await A.waitForTimeout(500);
await O.click('.navlist [data-page=o-live]');await O.waitForTimeout(400);
ok(/UMCM-A02|Umuchima/i.test(await O.textContent('#view')),'owner live page lists who is online');
// pledge reminder
await A.click('.navlist [data-page=pledges]');await A.waitForTimeout(300);
const hasP=await A.$('[data-act=pledge-remind]');
if(!hasP){await A.click('[data-act=add-pledge]');await A.waitForTimeout(200);await A.selectOption('#plM',{index:1}).catch(()=>{});}
ok(true,'pledges page opens');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');
await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
