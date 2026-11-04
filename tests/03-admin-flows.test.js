const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx); const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
await p.goto((process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'))); await p.waitForTimeout(300);
await p.selectOption('#navVillage','umuokpu'); await p.waitForTimeout(300); await p.fill('#loginId','UMK-A02'); await p.fill('#loginPw','umk-admin'); await p.click('#loginBtn'); await p.waitForSelector('.shell');
// walk admin pages
for(const pg of ['verify','transactions','members','expenses','levies','reports','audit','overview']){ try{await p.click(`.navlist [data-page=${pg}]`,{timeout:5000})}catch(e){console.log('BLOCK',pg,await p.evaluate(()=>{const m=document.querySelector('#modalRoot');const el=document.elementFromPoint(300,300);return 'mh='+m.hidden+' '+m.textContent.slice(0,60)+' | top='+(el&&el.className)}));throw e} await p.waitForTimeout(150); ok((await p.textContent('#pageTitle')).length>0,'page '+pg); }
// filters on transactions
try{await p.click('.navlist [data-page=transactions]',{timeout:5000})}catch(e){console.log('BLOCK',await p.evaluate(()=>{const m=document.querySelector('#modalRoot');const el=document.elementFromPoint(300,300);return 'mh='+m.hidden+' '+m.textContent.slice(0,80)+' | top='+(el&&el.className)+' page='+document.querySelector('#pageTitle').textContent}));throw e}
for(const sel of ['#fm1','#fl','#fs','#fy']){ const vals=await p.$$eval(sel+' option',o=>o.map(x=>x.value)); for(const v of vals.slice(0,4)){ await p.selectOption(sel,v); } }
await p.selectOption('#fs',''); await p.selectOption('#fl',''); await p.selectOption('#fy','');await p.selectOption('#fm1','');
const nm=(await p.textContent('table.t tbody tr >> nth=0 >> td >> nth=2')).replace(/UMK-[AM]\d+/,'').trim().split(' ')[1]; await p.type('#fq',nm.slice(0,3)); await p.waitForTimeout(150); ok((await p.$$('table.t tbody tr')).length>0 && await p.evaluate(()=>document.activeElement.id)==='fq','search works & focus kept ('+nm+')');
await p.fill('#fq','');
// verify a pending
await p.click('.navlist [data-page=verify]'); const n0=(await p.$$('table.t tbody tr')).length;
await p.click('table.t tbody tr >> nth=0 >> [data-act=verify-tx]'); await p.click('#mSubmit'); await p.waitForTimeout(300);
const n1=(await p.$$('table.t tbody tr')).length; ok(n1===n0-1||n1===1,'verified one ('+n0+'->'+n1+')');
// reject one
if(n1>1||true){ const has=await p.$('[data-act=reject-tx]'); if(has){ await p.click('[data-act=reject-tx] >> nth=0'); await p.selectOption('#rjR','Proof is unclear'); await p.click('#mSubmit'); await p.waitForTimeout(200);} }
// edit a tx
await p.click('.navlist [data-page=transactions]'); await p.click('[data-act=edit-tx] >> nth=0'); await p.fill('#mRef','EDITED123'); await p.click('#mSubmit'); await p.waitForTimeout(200);
ok((await p.content()).includes('EDITED123'),'edit saved'); 
// void
await p.click('[data-act=void-tx] >> nth=1'); await p.fill('#vdR','Duplicate entry'); await p.click('#mSubmit'); await p.waitForTimeout(200);
// add tx
await p.click('.topbar [data-act=add-tx]'); await p.selectOption('#mMember',{index:6}); await p.fill('#mAmt','7000'); await p.click('#mSubmit'); await p.waitForTimeout(200);
// add member
await p.click('.navlist [data-page=members]'); await p.click('[data-act=add-member]'); await p.fill('#amN','Test Newmember'); await p.fill('#amPw','Newpass1'); await p.click('#mSubmit'); await p.waitForTimeout(300);
ok((await p.content()).includes('Test Newmember'),'member added'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.selectOption('#fw',{index:1}); await p.selectOption('#fst','active'); await p.selectOption('#fw','');await p.selectOption('#fst','');
await p.click('[data-act=edit-member] >> nth=0'); await p.fill('#emN','Renamed Person'); await p.click('#mSubmit'); await p.waitForTimeout(200);
await p.click('[data-act=reset-pw] >> nth=0'); await p.click('#mSubmit'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
// expenses
await p.click('.navlist [data-page=expenses]'); await p.click('[data-act=add-exp]'); await p.fill('#exDs','Test spend'); await p.fill('#exA','15000'); await p.selectOption('#exC','Welfare and sickness'); await p.click('#mSubmit'); await p.waitForTimeout(200);
await p.selectOption('#fc',{index:2}); await p.selectOption('#fc','');
await p.click('[data-act=edit-exp] >> nth=0'); await p.fill('#exA','16000'); await p.click('#mSubmit'); await p.waitForTimeout(200);
await p.click('[data-act=void-exp] >> nth=1'); await p.fill('#veR','Entered twice'); await p.click('#mSubmit'); await p.waitForTimeout(200);
// levies
await p.click('.navlist [data-page=levies]'); await p.waitForTimeout(200);
// audit
await p.click('.navlist [data-page=audit]'); const a0=(await p.$$('table.t tbody tr')).length;
await p.selectOption('#fa',{index:2}); await p.selectOption('#fac',{index:1}); await p.selectOption('#fa',''); await p.selectOption('#fac','');
const aud=await p.textContent('table.t tbody'); ok(aud.includes('Edited payment record')&&aud.includes('Verified payment'),'audit shows admin actions'); 
await p.screenshot({path:'audit.png'});
// reports
await p.click('.navlist [data-page=reports]');
await p.selectOption('#rKind','year'); await p.waitForTimeout(300); ok(await p.isDisabled('#rMonth'),'month disabled for yearly'); await p.selectOption('#rKind','month'); await p.selectOption('#rMonth','2'); await p.selectOption('#rYear',{index:1});
let [dl]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=dl-current]')]); await dl.saveAs('month.pdf');
[dl]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=dl-report][data-kind=year] >> nth=0')]); await dl.saveAs('year.pdf');
await p.screenshot({path:'reports.png'});

console.log('ERRORS',JSON.stringify(errs)); await b.close();})().catch(e=>{console.log('TESTFAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
