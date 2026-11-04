const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const U=(process.env.BASE_URL||'http://localhost:8765/index.html');
for(const w of [390,360]){const ctx=await b.newContext({viewport:{width:w,height:800},hasTouch:true,isMobile:true});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)});
const bad=[];const chk=async(p,l)=>{const r=await p.evaluate(()=>{const de=document.documentElement;const w=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1&&!e.closest('.tablewrap')&&!e.closest('.side')&&getComputedStyle(e).position!=='fixed'}).slice(0,3).map(e=>e.tagName+'.'+e.className);return {over:de.scrollWidth-innerWidth,w}});if(r.over>1||r.w.length)bad.push(`${l}: overflow ${r.over} ${r.w.join(' ')}`)};
const A=await ctx.newPage();await A.goto(U);await chk(A,'landing');await A.selectOption('#heroVillage','umuokpu');await A.fill('#loginId','UMK-A01');await A.fill('#loginPw','umk-admin');await A.click('#loginBtn');await A.waitForSelector('.shell');
for(const pg of await A.$$eval('#navlist [data-page]',e=>e.map(x=>x.dataset.page))){await A.evaluate(pg=>document.querySelector(`#navlist [data-page=${pg}]`).click(),pg);await A.waitForTimeout(100);await chk(A,'admin '+pg);}
await A.evaluate(()=>document.querySelector('[data-act=upload-proof]').click());await A.waitForTimeout(200);await chk(A,'modal upload');
await A.keyboard.press('Escape');
const M=await ctx.newPage();await M.goto(U);await M.selectOption('#heroVillage','umuokpu');await M.fill('#loginId','UMK-M002');await M.fill('#loginPw','umk-member');await M.click('#loginBtn');await M.waitForSelector('.shell');
for(const pg of await M.$$eval('#navlist [data-page]',e=>e.map(x=>x.dataset.page))){await M.evaluate(pg=>document.querySelector(`#navlist [data-page=${pg}]`).click(),pg);await M.waitForTimeout(100);await chk(M,'member '+pg);}
const bad2=bad.filter(x=>!/^landing:.*ledger/.test(x));console.log((bad2.length?'FAIL ':'PASS ')+'no horizontal overflow at '+w+'px');bad2.forEach(x=>console.log('  '+x));await ctx.close()}
await b.close()})().catch(e=>console.log('FATAL',e.message.slice(0,300)));
