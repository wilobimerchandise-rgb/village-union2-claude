const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const errs=[]; const watch=p=>{p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});};
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html')); const mk=async()=>{const p=await ctx.newPage();watch(p);return p;};
const login=async(pg,v,id,pw)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
const closeM=async(pg)=>{ if(await pg.$('#modalRoot:not([hidden])')){ await pg.keyboard.press('Escape'); await pg.waitForTimeout(120);} };
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const A1=await mk(), A2=await mk(), O=await mk();
await login(A1,'ezinkwo~men','EZNM-A01','eznm-admin'); await login(A2,'ezinkwo~men','EZNM-A02','eznm-admin');
// Others in pledge form
await A1.click('.navlist [data-page=pledges]'); await A1.click('[data-act=add-pledge]'); await A1.waitForSelector('#plL'); ok((await A1.$$eval('#plL option',o=>o.map(x=>x.textContent))).includes('Others'),'pledge category has Others'); await closeM(A1);
// admin uploads own proof
await A2.click('.topbar [data-act=upload-proof]'); await A2.waitForSelector('.lv-list'); ok(true,'admin sees Upload my proof');
await A2.check('.lv-pick[value="L:party"]',{force:true}); await A2.fill('input[name="amt_L:party"]','2000'); await A2.setInputFiles('#fProof',{name:'s.png',mimeType:'image/png',buffer:png}); await A2.click('#mSubmit'); await A2.waitForTimeout(500); ok(!(await A2.$('#modalRoot:not([hidden])')),'admin proof submitted');
await A2.click('.navlist [data-page=verify]'); await A2.waitForTimeout(250);
const own=await A2.$('table.t tbody tr:has-text("EZNM-A02") [data-act=verify-tx]'); if(own){ await own.click(); await A2.waitForTimeout(250); ok(/cannot verify your own/.test(await A2.textContent('body')),'admin cannot verify own payment'); } else ok(true,'own row has no Verify button');
await A1.waitForTimeout(600); await A1.click('.navlist [data-page=verify]'); await A1.waitForTimeout(250); await A1.click('table.t tbody tr:has-text("EZNM-A02") [data-act=verify-tx]'); await A1.click('#mSubmit'); await A1.waitForTimeout(400);
const st=await A1.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo~men')).tx.filter(t=>t.memberId==='EZNM-A02').map(t=>t.status+':'+t.verifiedById)); ok(st.some(s=>s==='verified:EZNM-A01'),'other admin verified it '+st);
// roles unique
await A1.click('.navlist [data-page=admins]'); await A1.waitForTimeout(250); await A1.click('[data-act=appoint-admin]'); await A1.waitForSelector('#apT');
const dis=await A1.$$eval('#apT option[disabled]',o=>o.map(x=>x.textContent)); ok(dis.length>=3&&dis.some(t=>/held by/.test(t)),'taken roles are disabled: '+dis.length);
await A1.selectOption('#apM','EZNM-M003'); const free=await A1.$eval('#apT option:not([disabled])',o=>o.value); await A1.selectOption('#apT',free); await A1.click('#mSubmit'); await A1.waitForTimeout(400); ok(/EZNM-M003/.test(await A1.textContent('#view')),'member appointed with free role '+free);
await A1.click('tr:has-text("EZNM-M003") [data-act=assign-duty]'); await A1.waitForSelector('#adT'); const taken=await A1.$eval('#adT option[disabled]',o=>o.value); ok(!!taken,'change duty offers only free roles'); await closeM(A1);
// owner
await O.goto(U+'#owner'); await O.waitForTimeout(500); await O.fill('#ownId','OWNER'); await O.fill('#ownPw','owner-2026'); await O.click('#ownerBtn'); await O.waitForSelector('.shell');
await O.click('.navlist [data-page=o-admins]'); await O.waitForTimeout(250); await O.selectOption('#oaV','ezinkwo~men'); await O.waitForTimeout(250);
ok(/Lead Admin: .*EZNM-A01/.test(await O.textContent('#view')),'owner sees Lead Admin banner');
await O.click('[data-act=o-lead][data-v="ezinkwo~men"]:not([data-id])'); await O.waitForSelector('#olP'); await O.selectOption('#olP','EZNM-M009'); const fr=await O.$eval('#olT option:not([disabled])',o=>o.value); await O.selectOption('#olT',fr); await O.click('#mSubmit'); await O.waitForTimeout(400);
ok(/Lead Admin: .*EZNM-M009/.test(await O.textContent('#view')),'owner assigned Lead Admin to a chosen member');
await O.click('tr:has-text("EZNM-M003") [data-act=o-remove-admin]'); await O.fill('#orR','Resigned'); await O.click('#mSubmit'); await O.waitForTimeout(400); ok(!/EZNM-M003/.test(await O.textContent('#view table')),'owner removed admin; gone from list');
const role=await O.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo~men')).users.find(u=>u.id==='EZNM-M003').role); ok(role==='member','removed admin turned member automatically');
// duplicate role via owner add
await O.click('[data-act=o-add-admin]'); await O.waitForSelector('#oaN'); await O.fill('#oaN','Dup Person'); const dopts=await O.$$eval('#oaT option[disabled]',o=>o.length); ok(dopts>=3,'owner add admin: taken roles disabled'); await closeM(O);
// roles
await O.click('[data-act=o-add-role]'); await O.fill('#arN','Public Relations Officer'); await O.click('#mSubmit'); await O.waitForTimeout(300); ok(/Public Relations Officer/.test(await O.textContent('#view')),'owner created a role');
await O.click('tr:has-text("Public Relations Officer") [data-act=o-remove-role]'); await O.click('#mSubmit'); await O.waitForTimeout(300); ok(!/Public Relations Officer/.test(await O.textContent('#view')),'owner removed a role');
await O.click('tr:has-text("Treasurer") [data-act=o-remove-role]'); await O.click('#mSubmit'); await O.waitForTimeout(300); ok(/held by/.test(await O.textContent('#mError')),'cannot remove a role that is held'); await closeM(O);
// villages
await O.click('.navlist [data-page=o-villages]'); await O.waitForTimeout(250); await O.click('[data-act=o-add-village]'); await O.fill('#avN','Test Hamlet'); await O.fill('#avC','tht'); await O.fill('#avL','Chief Test'); await O.click('#mSubmit'); await O.waitForTimeout(600);
ok(/Test Hamlet/.test(await O.textContent('#view')),'owner added a village');
const P=await mk(); await P.goto(U); await P.waitForTimeout(400); ok((await P.$$eval('#heroVillage option:not([data-test])',o=>o.map(x=>x.textContent))).some(t=>/Test Hamlet Men’s Wing \(THTM\)/.test(t)),'new village in public dropdown');
const pw=await O.evaluate(()=>0);
await O.click('tr:has-text("Test Hamlet") [data-act=o-delete-village]'); await O.fill('#dvN','Test Hamlet'); await O.click('#mSubmit'); await O.waitForTimeout(400); ok(!/Test Hamlet/.test(await O.textContent('#view')),'owner deleted the village');
console.log('ERRORS',JSON.stringify(errs)); await b.close();
})().catch(e=>{console.log('FATAL',e.message.slice(0,400));process.exit(1)});
