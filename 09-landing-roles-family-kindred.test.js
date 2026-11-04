const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const errs=[]; const watch=p=>{p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});};
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html')); const mk=async()=>{const p=await ctx.newPage();watch(p);return p;};
const login=async(pg,v,id,pw)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
const closeM=async(pg)=>{ if(await pg.$('#modalRoot:not([hidden])')){ await pg.keyboard.press('Escape'); await pg.waitForTimeout(120);} };
const p=await mk(); await p.goto(U); await p.waitForTimeout(300);
ok(/Every naira your village \/ association pays, recorded by name\./.test(await p.textContent('h1')),'landing headline');
// request access (village)
await p.selectOption('#heroVillage','umuokpu'); await p.click('[data-act=request-access]'); await p.waitForSelector('#rqN'); ok(!!(await p.$('#rqF'))&&!!(await p.$('#rqK')),'village request asks family + kindred');
await p.fill('#rqN','Peter Okoro'); await p.fill('#rqP','08031112222'); await p.click('#mSubmit'); await p.waitForTimeout(200); ok(/family name and your kindred/i.test(await p.textContent('#mError')),'family/kindred mandatory');
await p.fill('#rqF','Okafor'); await p.fill('#rqK','Umuagu'); await p.click('#mSubmit'); await p.waitForTimeout(200); ok(/short message/i.test(await p.textContent('#mError')),'message mandatory'); await p.fill('#rqM','I joined in 2019'); await p.click('#mSubmit'); await p.waitForTimeout(400); ok(!(await p.$('#modalRoot:not([hidden])')),'request sent'); 
// premium village admin
const A=await mk(); await login(A,'umuokpu','UMK-A02','umk-admin'); await A.click('.navlist [data-page=members]'); await A.waitForTimeout(250);
const body=await A.textContent('#view'); ok(!/\bward\b/i.test(body),'no ward on members page'); ok(/Family \/ Kindred/.test(body),'family/kindred column');
ok(/Chairman/.test(await A.textContent('#view')),'Chairman shown in admin team'); ok(!/President General/.test(await A.content()),'no President General anywhere');
await A.click('[data-act=add-member]'); await A.waitForSelector('#amF'); await closeM(A);
// basic village cap
const B=await mk(); await login(B,'umuchima','UMC-A02','umc-admin'); await B.click('.navlist [data-page=members]'); await B.waitForTimeout(250);
ok(/Basic plan limit of 20/.test(await B.textContent('#view')),'basic: limit notice'); await B.click('[data-act=add-member]'); await B.waitForSelector('#modalRoot .upgrade-box'); ok(/Upgrade to Premium/.test(await B.textContent('#modalRoot'))&&/Premium/.test(await B.textContent('#modalRoot .badge')),'upgrade modal with Premium badge'); await closeM(B);
// member since
const M=await mk(); await login(M,'umuokpu','UMK-M001','umk-member'); ok(/Member since/.test(await M.textContent('#view')),'member dashboard shows date joined');
// owner: association
const O=await mk(); await O.goto(U+'#owner'); await O.waitForTimeout(500); await O.fill('#ownId','OWNER'); await O.fill('#ownPw','owner-2026'); await O.click('#ownerBtn'); await O.waitForSelector('.shell');
await O.click('.navlist [data-page=o-villages]'); await O.click('[data-act=o-add-village]'); await O.fill('#avN','Test Association'); await O.fill('#avC','TAS'); await O.selectOption('#avY','association'); await O.fill('#avL','Ada Lead'); await O.fill('#avW','assoc123'); await O.click('#mSubmit'); await O.waitForTimeout(600);
const AS=await mk(); await login(AS,'testassociatio','TAS-A01','assoc123'); await AS.click('.navlist [data-page=members]'); await AS.waitForTimeout(250); await AS.click('[data-act=add-member]'); await AS.waitForSelector('#amN'); ok(!(await AS.$('#amF')),'association: no family/kindred fields'); await closeM(AS);
const R=await mk(); await R.goto(U); await R.selectOption('#heroVillage','testassociatio'); await R.click('[data-act=request-access]'); await R.waitForSelector('#rqN'); ok(!(await R.$('#rqF')),'association request: no family/kindred'); await R.fill('#rqN','Paul Eze'); await R.fill('#rqP','08031112222'); await R.click('#mSubmit'); await R.waitForTimeout(200); ok(/short message/i.test(await R.textContent('#mError')),'association request still needs a message');
console.log('ERRORS',JSON.stringify(errs)); await b.close();
})().catch(e=>{console.log('FATAL',e.message.slice(0,500));process.exit(1)});
