const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL||'http://localhost:8765/index.html';const errs=[];
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const fresh=async()=>{await p.goto(U);await p.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await p.goto(U);await p.waitForTimeout(150);}
const login=async(v,id,pw)=>{await fresh();await p.selectOption('#heroVillage',v);await p.waitForTimeout(200);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(900);return !!(await p.$('.shell'))};
// 1 landing: Plans section, no language picker
await fresh();
ok(!!(await p.$('#plans'))&&/Two plans/.test(await p.textContent('#plans'))&&/Basic/.test(await p.textContent('#plans'))&&/Premium/.test(await p.textContent('#plans')),'landing has the Plans section');
ok(await p.$$eval('#navLinks a',a=>a.some(x=>x.textContent.trim()==='Plans')),'nav has a Plans link');
ok((await p.$('#langNav'))===null&&(await p.$('[data-lang-select]'))===null&&(await p.$('.nav-lang-m'))===null,'no language picker on the site');
const pl=await p.textContent('#plans');ok(/20 active members/.test(pl)&&/10 in the Men's Wing, 10 in the Women's Wing/.test(pl)&&/Associations: 10 active members/.test(pl),'landing Plans states the Basic limits: village 20 (10 + 10), association 10');
// 2 Premium admin
ok(await login('umuokpu','UMK-A02','umk-admin'),'Premium admin signs in');
ok(await p.$('.side-foot .lang-pick')===null,'no language picker in the app');
await p.click('.navlist [data-page=plans]');await p.waitForTimeout(400);
let v=await p.textContent('#view');ok(/is on Premium/.test(v)&&(await p.$$('#view table.plan-table tbody tr')).length===27,'Premium admin sees the Plans page (27 rows)');
ok(/Premium \(your plan\)/.test(v)&&/Association: 10/.test(v),'Premium column marked; Basic row shows the 20 and 10 limits');
// 3 Basic wing
ok(await login('umuchima~men','UMCM-A02','umcm-admin'),'Basic wing admin signs in');await p.click('.navlist [data-page=plans]');await p.waitForTimeout(400);
v=await p.textContent('#view');ok(/is on the Basic plan/.test(v)&&/10 members in each wing/.test(v)&&/Basic \(your plan\)/.test(v),'Basic wing admin sees: up to 10 members in each wing');
await p.click('[data-act=upgrade-info]');await p.waitForTimeout(300);ok(/What Premium adds|Your Basic plan is full/.test(await p.textContent('#modalRoot')),'How to upgrade opens');
await p.keyboard.press('Escape');
// 4 member has no Plans page
ok(await login('umuokpu~men','UMKM-M001','umkm-member'),'member signs in');
ok(!(await p.$('.navlist [data-page=plans]')),'members do not get the Plans page');
// 5 phone
await p.setViewportSize({width:375,height:800});await fresh();ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'phone: no horizontal overflow');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');
await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
