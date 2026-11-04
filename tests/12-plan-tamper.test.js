const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'));const errs=[];
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const login=async(pg,v,id,pw)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
// tamper: basic village edited to premium by hand
await login(p,'umuchima','UMC-A02','umc-admin');
await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vv_v1_umuchima'));v.plan='premium';localStorage.setItem('vv_v1_umuchima',JSON.stringify(v));});
await login(p,'umuchima','UMC-A02','umc-admin');
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuchima')).plan==='basic'),'hand-edited plan restored to registry value');
await p.click('.navlist [data-page=members]');await p.waitForTimeout(250);await p.click('[data-act=add-member]');await p.waitForSelector('#modalRoot .upgrade-box');ok(true,'cap still enforced after tamper');
console.log('ERRORS',JSON.stringify(errs));await b.close()})().catch(e=>{console.log('FATAL',e.message.slice(0,400));process.exit(1)});
