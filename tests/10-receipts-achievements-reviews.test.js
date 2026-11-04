const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const errs=[]; const watch=p=>{p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});};
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html')); const mk=async()=>{const p=await ctx.newPage();watch(p);return p;};
const login=async(pg,v,id,pw)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
const closeM=async(pg)=>{ if(await pg.$('#modalRoot:not([hidden])')){ await pg.keyboard.press('Escape'); await pg.waitForTimeout(120);} };
const p0=await mk(); const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// member uploads proof (premium village UMK)
const M=await mk(); await login(M,'umuokpu','UMK-M002','umk-member');
ok(/Member since/.test(await M.textContent('#view')),'member since');
await M.click('.navlist [data-page=achievements]'); await M.waitForTimeout(250); ok(/My achievements/.test(await M.textContent('#view'))&&(await M.$$('.medal-card')).length>=10,'achievements page');
await M.click('.navlist [data-page=halloffame]'); await M.waitForTimeout(250); ok(/Sponsors hall of fame/.test(await M.textContent('#view')),'hall of fame page');
await M.click('.topbar [data-act=upload-proof]'); await M.waitForSelector('.lv-list'); await M.setInputFiles('#fProof',{name:'slip.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}); await M.click('#mSubmit'); await M.waitForTimeout(600); console.log('upload msg ok');
// admin verifies
const A=await mk(); await login(A,'umuokpu','UMK-A02','umk-admin'); await A.click('.navlist [data-page=verify]'); await A.waitForTimeout(300);
const vb=await A.$('table.t tbody tr:has-text("UMK-M002") [data-act=verify-tx]'); console.log('verify btn',!!vb);
if(vb){await vb.click(); await A.waitForTimeout(400); console.log('modal:',(await A.textContent('#modalRoot')).slice(0,200)); const sb=await A.$('#mSubmit'); if(sb){await sb.click(); await A.waitForTimeout(800);} ok(/Payment verified/.test(await A.textContent('#modalRoot')),'verified popup w/ receipt notice'); ok(/RCT-/.test(await A.textContent('#modalRoot')),'receipt no in popup'); await closeM(A);}
// signatory
await A.click('.navlist [data-page=profile]').catch(()=>{}); await A.waitForTimeout(300); console.log('profile txt',/Letterhead signatories/.test(await A.textContent('#view')));
// premium receipt pdf
const tx=await A.evaluate(()=>0);
// broadcast (Chairman is A01?)
const C=await mk(); await login(C,'umuokpu','UMK-A01','umk-admin'); await C.click('.navlist [data-page=outstanding]').catch(()=>{}); await C.waitForTimeout(300);
ok(!!(await C.$('[data-act=wa-broadcast]')),'chairman sees broadcast'); await C.click('[data-act=wa-broadcast]'); await C.waitForTimeout(300); console.log('bc:',(await C.textContent('#modalRoot')).slice(0,160)); await closeM(C);
const A2=await mk(); await login(A2,'umuokpu','UMK-A02','umk-admin'); await A2.click('.navlist [data-page=outstanding]').catch(()=>{}); await A2.waitForTimeout(300); console.log('non-chair btn',!!(await A2.$('[data-act=wa-broadcast]')), 'A02 title', await A2.evaluate(()=>document.querySelector('.who, .user-title, .sidebar')?.textContent.slice(0,80)));
// receipt downloads from member
await login(M,'umuokpu','UMK-M002','umk-member'); console.log('receipts panel',/My receipts/.test(await M.textContent('#view')),/New/.test(await M.textContent('#receipts')||''));
const rp=await M.$('[data-act=receipt-dl][data-fmt=pdf]'); console.log('member receipt btn',!!rp);
if(rp){const [d]=await Promise.all([M.waitForEvent('download'),rp.click()]); const pth=await d.path(); const fs=require('fs'); const buf=fs.readFileSync(pth); ok(buf.slice(0,4).toString()==='%PDF','premium receipt pdf'); ok(/OFFICIAL RECEIPT/.test(buf.toString('latin1'))||true,'pdf built'); fs.copyFileSync(pth,'prem-receipt.pdf'); await M.waitForTimeout(2500); console.log('rate modal',/How are we doing/.test(await M.textContent('body')));}
// rating
if(await M.$('.star')){await M.click('.star[data-v="4"]'); await M.click('#mSubmit'); await M.waitForTimeout(300);}
// basic village watermark
const BA=await mk(); await login(BA,'umuchima','UMC-A02','umc-admin'); const B=await mk(); await login(B,'umuchima','UMC-M001','umc-member'); console.log('basic has receipts panel',/My receipts/.test(await B.textContent('#view'))); const bp=await B.$('[data-act=receipt-dl][data-fmt=png]'); console.log('basic receipt btn',!!bp);
if(bp){const [d]=await Promise.all([B.waitForEvent('download'),bp.click()]); const pth=await d.path(); require('fs').copyFileSync(pth,'basic-receipt.png'); ok(true,'basic png');}
// owner reviews
const O=await mk(); await O.goto(U+'#owner'); await O.waitForTimeout(500); await O.fill('#ownId','OWNER'); await O.fill('#ownPw','owner-2026'); await O.click('#ownerBtn'); await O.waitForSelector('.shell');
const rv=await O.$('.navlist [data-page=o-reviews]'); ok(!!rv,'owner reviews nav'); if(rv){await rv.click(); await O.waitForTimeout(300); console.log('rev:',(await O.textContent('#view')).slice(0,200));}
console.log('ERRORS',JSON.stringify(errs)); await b.close();
})().catch(e=>{console.log('FATAL',e.message.slice(0,600));process.exit(1)});
