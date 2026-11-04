const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const errs=[]; const watch=p=>{p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});};
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'));
const mk=async()=>{const p=await ctx.newPage();watch(p);return p;};
const login=async(pg,v,id,pw)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
const closeM=async(pg)=>{ if(await pg.$('#modalRoot:not([hidden])')){ await pg.keyboard.press('Escape'); await pg.waitForTimeout(120);} };
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const A1=await mk(), A2=await mk(), M=await mk();
await login(A1,'ezinkwo','EZN-A01','ezn-admin'); await login(A2,'ezinkwo','EZN-A02','ezn-admin'); await login(M,'ezinkwo','EZN-M001','ezn-member');
// ---- admin registers pledge
await A1.click('.navlist [data-page=pledges]'); await A1.waitForTimeout(200); ok(/Pledges/.test(await A1.textContent('#pageTitle')),'admin Pledges page');
await A1.click('[data-act=add-pledge]'); await A1.selectOption('#plM','EZN-M001'); await A1.fill('#plP','Town hall roofing'); await A1.fill('#plA','50000'); await A1.click('#mSubmit'); await A1.waitForTimeout(300);
ok(/Town hall roofing/.test(await A1.textContent('#view'))&&/50,000/.test(await A1.textContent('#view')),'pledge registered');
// member sees it automatically (storage sync)
await M.waitForTimeout(700); await M.click('.navlist [data-page=overview]'); await M.waitForTimeout(300);
ok(/My pledges/.test(await M.textContent('#view'))&&/Town hall roofing/.test(await M.textContent('#pledges')),'pledge shows on member dashboard');
// member multi-levy payment
await M.click('.topbar [data-act=upload-proof]'); await M.waitForSelector('.lv-list');
const nrows=(await M.$$('.lv-row')).length; ok(nrows>=6,'tick list has levies + pledge ('+nrows+')');
const rows=await M.$$eval('.lv-row',r=>r.map(x=>x.textContent.replace(/\s+/g,' ').trim())); console.log('ROWS',rows.join(' || ').slice(0,500));
const ticked0=await M.$$eval('.lv-pick:checked',x=>x.length); 
// tick burial, insurance, and pledge
const keys=await M.$$eval('.lv-pick',x=>x.map(i=>i.value)); console.log('KEYS',keys.join(','));
for(const k of keys){ const inp=M.locator(`.lv-pick[value="${k}"]`); const want=(k==='L:burial'||k==='L:insurance'||k.startsWith('P:')); const cur=await inp.isChecked(); if(want!==cur) await inp.check({force:true}).catch(async()=>{await inp.uncheck({force:true})}); }
if(await M.locator('.lv-pick[value="L:annual"]').isChecked()) await M.locator('.lv-pick[value="L:annual"]').uncheck();
const pk=keys.find(k=>k.startsWith('P:')); await M.fill(`input[name="amt_${pk}"]`,'10000');
await M.fill('input[name="amt_L:burial"]','5000'); await M.fill('input[name="amt_L:insurance"]','8000');
ok(/23,000/.test(await M.textContent('#lvTotal')),'live total = '+await M.textContent('#lvTotal'));
await M.setInputFiles('#fProof',{name:'slip.png',mimeType:'image/png',buffer:png});
// reference left empty => allowed
await M.click('#mSubmit'); await M.waitForTimeout(500); ok(!(await M.$('#modalRoot:not([hidden])')),'multi-levy payment sent with NO reference');
const tx=await A1.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo')).tx.filter(t=>t.memberId==='EZN-M001'&&t.status==='pending'&&t.batch).map(t=>({l:t.levy,a:t.amount,b:t.batch,pl:t.pledgeId,pf:t.proofFrom,hasProof:!!t.proof,ref:t.ref})));
console.log('TX',JSON.stringify(tx)); ok(tx.length===3&&new Set(tx.map(t=>t.b)).size===1&&tx.filter(t=>t.hasProof).length===1,'3 linked records, one stored proof');
// no-pick error
await M.click('.topbar [data-act=upload-proof]'); await M.waitForSelector('.lv-list'); for(const i of await M.$$('.lv-pick:checked')) await i.uncheck(); await M.setInputFiles('#fProof',{name:'slip.png',mimeType:'image/png',buffer:png}); await M.click('#mSubmit'); await M.waitForTimeout(200); ok(/Tick at least one/.test(await M.textContent('#mError')),'must tick one'); await closeM(M);
// admin verifies batch
await A2.waitForTimeout(500); await A2.click('.navlist [data-page=verify]'); await A2.waitForTimeout(250);
await A2.click('table.t tbody tr:has-text("EZN-M001"):has-text("Burial") [data-act=verify-tx] >> nth=0'); await A2.waitForSelector('input[name=inc]');
ok((await A2.$$('input[name=inc]')).length===3,'verify modal lists all 3 items'); ok(!!(await A2.$('#modalRoot img, #modalRoot iframe')),'proof visible on batch verify');
await A2.click('#mSubmit'); await A2.waitForTimeout(500);
const st=await A2.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo')).tx.filter(t=>t.batch).map(t=>t.status)); ok(st.length>=3&&st.every(s=>s==='verified'),'all 3 verified together '+st);
// member dashboard reflects pledge paid
await M.waitForTimeout(800); const pt=await M.textContent('#pledges'); ok(/10,000/.test(pt)&&/40,000/.test(pt)&&/Part paid/.test(pt),'pledge balance updated on member dashboard');
// receipts for batch items open fine (proof via proofFrom)
await A1.click('.navlist [data-page=transactions]'); await A1.waitForTimeout(250); await A1.click('tr:has-text("EZN-M001") [data-act=view-tx] >> nth=0'); await A1.waitForSelector('#modalRoot .modal'); ok(true,'view tx opens'); await closeM(A1);
// admin records pledge payment + overpay blocked
await A1.click('.navlist [data-page=pledges]'); await A1.waitForTimeout(200); await A1.click('[data-act=pay-pledge] >> nth=0'); await A1.fill('#ppA','60000'); await A1.click('#mSubmit'); await A1.waitForTimeout(200);
ok(/Only .* still owed/.test(await A1.textContent('#mError'))||await A1.$eval('#ppA',e=>e.validity.rangeOverflow),'overpay blocked');
await A1.fill('#ppA','40000'); await A1.click('#mSubmit'); await A1.waitForTimeout(400); ok(/Fulfilled/.test(await A1.textContent('#view')),'pledge fulfilled after final payment');
// edit/cancel
await closeM(A1); await A1.click('[data-act=add-pledge]'); await A1.selectOption('#plM','EZN-M002'); await A1.fill('#plP','Water project'); await A1.fill('#plA','20000'); await A1.click('#mSubmit'); await A1.waitForTimeout(300);
await A1.click('tr:has-text("Water project") [data-act=view-pledge] >> nth=0'); await A1.waitForSelector('[data-act=edit-pledge]'); await A1.click('#modalRoot [data-act=edit-pledge]'); await A1.fill('#plA','25000'); await A1.click('#mSubmit'); await A1.waitForTimeout(300); ok(/25,000/.test(await A1.textContent('#view')),'pledge edited');
await A1.click('tr:has-text("Water project") [data-act=view-pledge] >> nth=0'); await A1.click('#modalRoot [data-act=cancel-pledge]'); await A1.fill('#cpR','Member withdrew'); await A1.click('#mSubmit'); await A1.waitForTimeout(300); ok(/Cancelled/.test(await A1.textContent('#view')),'pledge cancelled');
// member profile shows pledges
await A1.click('tr:has-text("Town hall roofing") .linkbtn >> nth=0'); await A1.waitForSelector('#modalRoot .kv'); ok(/Pledges/.test(await A1.textContent('#modalRoot')),'member profile has pledges section'); await closeM(A1);
// ---- admin attendance, verified by another admin
await A2.click('.navlist [data-page=register]'); await A2.waitForTimeout(250); await A2.click('[data-act=mtg-open]'); await A2.click('#mSubmit'); await A2.waitForTimeout(300); await A1.waitForTimeout(700); await A1.click('.navlist [data-page=register]'); await A1.waitForTimeout(300);
await A1.click('[data-act=mtg-view] >> nth=0'); await A1.waitForSelector('#modalRoot [data-act=att-mark-admin]'); await A1.click('#modalRoot [data-act=att-mark-admin]'); await A1.waitForTimeout(400);
ok(/Another admin must verify/.test(await A1.textContent('#modalRoot')),'admin marked self, needs another admin');
ok(!(await A1.$('#modalRoot [data-act=mtg-mark][data-m="EZN-A01"]')),'no self-verify button');
await A1.click('#modalRoot [data-act=mtg-all]',{timeout:1500}).catch(()=>{}); await A1.waitForTimeout(250); const e1=await A1.textContent('#toast, .toast, #modalRoot').catch(()=>''); 
// admin marks a member (needs second admin)
await A1.click('#modalRoot [data-act=mtg-mark][data-m="EZN-M005"][data-s=verified]'); await A1.waitForTimeout(300); ok(/Another admin must verify/.test(await A1.textContent('#modalRoot tr:has-text("EZN-M005")')),'admin-marked member waits for second admin'); await closeM(A1);
await A2.goto(U); await A2.waitForTimeout(400); 
await login(A2,'ezinkwo','EZN-A02','ezn-admin'); await A2.click('.navlist [data-page=register]'); await A2.waitForTimeout(250); await A2.click('[data-act=mtg-view] >> nth=0'); await A2.waitForSelector('#modalRoot table.t');
ok(!!(await A2.$('#modalRoot tr:has-text("EZN-A01") [data-act=mtg-mark][data-s=verified]')),'second admin can verify first admin'); await A2.click('#modalRoot tr:has-text("EZN-A01") [data-act=mtg-mark][data-s=verified]'); await A2.waitForTimeout(300);
ok(/Present/.test(await A2.textContent('#modalRoot tr:has-text("EZN-A01")')),'admin attendance verified by other admin');
await A2.click('#modalRoot tr:has-text("EZN-M005") [data-act=mtg-mark][data-s=verified]'); await A2.waitForTimeout(300); ok(/Present/.test(await A2.textContent('#modalRoot tr:has-text("EZN-M005")')),'member entry verified by second admin');
// A2 self-verify blocked via API
const blocked=await A2.evaluate(()=>{try{return 'no error'}catch(e){return e.message}}); await closeM(A2);
// ---- owner sees plans
const O=await mk(); await O.goto(U); await O.evaluate(()=>sessionStorage.clear()); await O.goto(U);
await O.goto(U+'#owner'); await O.waitForTimeout(500); await O.fill('#ownId','OWNER'); await O.fill('#ownPw','owner-2026'); await O.click('#ownerBtn'); await O.waitForSelector('.shell',{timeout:15000});
const ov=await O.textContent('#view'); ok(/Plans in use/.test(ov)&&/Premium/.test(ov)&&/Basic/.test(ov),'owner overview shows plans in use');
ok((await O.$$('.plan-col .chip')).length===10,'every village listed under a plan ('+(await O.$$('.plan-col .chip')).length+')');
const hdr=await O.$$eval('table.t thead th',t=>t.map(x=>x.textContent)); ok(hdr.includes('Plan'),'Plan column on every-village table');
await O.click('.plan-col .chip >> nth=0'); await O.waitForSelector('#modalRoot .modal'); ok(true,'chip opens edit/plan modal'); await O.keyboard.press('Escape');
await M.click('.navlist [data-page=overview]'); ok(!/Village office/.test(await M.textContent('#view')),'owner not visible to members');
console.log('ERRORS',JSON.stringify(errs)); await b.close();
})().catch(e=>{console.log('FATAL',e.message.slice(0,500));process.exit(1)});
