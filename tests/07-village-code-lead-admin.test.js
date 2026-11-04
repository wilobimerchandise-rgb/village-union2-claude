const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const errs=[]; const watch=p=>{p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});};
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html')); const mk=async()=>{const p=await ctx.newPage();watch(p);return p;};
const login=async(pg,v,id,pw)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
const closeM=async(pg)=>{ if(await pg.$('#modalRoot:not([hidden])')){ await pg.keyboard.press('Escape'); await pg.waitForTimeout(120);} };
const png=await (async()=>{const p=await ctx.newPage();const d=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=80;const g=c.getContext('2d');g.fillStyle='#D2395B';g.fillRect(0,0,80,80);return c.toDataURL('image/png').split(',')[1]});await p.close();return Buffer.from(d,'base64');})();
const A1=await mk(), A2=await mk(), B=await mk();
await login(A1,'ezinkwo','EZN-A01','ezn-admin'); await login(A2,'ezinkwo','EZN-A02','ezn-admin');
const plan=await A1.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo')).plan); console.log('PLAN ezinkwo',plan);
// premium code edit
await A1.click('.navlist [data-page=profile]'); await A1.click('[data-act=edit-profile]'); await A1.waitForSelector('#vpC'); ok(true,'premium shows code field');
await A1.fill('#vpC','umk'); await A1.click('#mSubmit'); await A1.waitForTimeout(250); ok(/already uses/.test(await A1.textContent('#mError')),'duplicate code blocked');
await A1.fill('#vpC','E!'); await A1.click('#mSubmit'); await A1.waitForTimeout(250); ok(/2 to 5/.test(await A1.textContent('#mError')),'invalid code blocked');
await A1.fill('#vpC','ezx'); await A1.setInputFiles('#fProof',{name:'logo.png',mimeType:'image/png',buffer:png}); await A1.click('#mSubmit'); await A1.waitForTimeout(500);
ok(/EZX/.test(await A1.textContent('#view')),'code saved: EZX shown on profile');
await A1.reload(); await A1.waitForTimeout(600); const opts=await A1.$$eval('#navVillage option, #heroVillage option',o=>o.map(x=>x.textContent)); ok(opts.some(t=>/\(EZX[MW]\)/.test(t)),'dropdown shows new code after reload');
// documents bear profile
await A1.waitForSelector('.shell').catch(()=>{});
await A1.click('.navlist [data-page=reports]'); await A1.waitForTimeout(250);
const dl=async(sel)=>{const [d]=await Promise.all([A1.waitForEvent('download'),A1.click(sel)]);const f='/tmp/dl_'+Date.now();await d.saveAs(f);return {f,name:d.suggestedFilename(),buf:fs.readFileSync(f)};};
const rp=await dl('[data-act=dl-report] >> nth=0'); const rt=rp.buf.toString('latin1'); ok(rt.includes('Ezinkwo \\(EZX\\)')&&rt.includes('DCTDecode')&&rp.buf.slice(0,5).toString()==='%PDF-','report PDF bears village name, code and logo');
console.log('REPORT BTNS',(await A1.$$eval('#view [data-act]',b=>b.map(x=>x.dataset.act))).filter(x=>/report|stat|pdf/.test(x)).join(','));
// notice PDF
await A1.click('.navlist [data-page=outstanding]'); await A1.waitForTimeout(250); const n=await dl('[data-act=notice-all]'); const nt=n.buf.toString('latin1'); ok(nt.includes('Village code: EZX')&&nt.includes('DCTDecode'),'notice PDF bears code + logo');
const c=await dl('[data-act=owing-csv]'); ok(/Ezinkwo \(EZX\)/.test(c.buf.toString('utf8')),'CSV starts with village name and code');
// register: admins listed
await A1.click('.navlist [data-page=register]'); await A1.waitForTimeout(250); await A1.click('[data-act=rtab][data-tab=members]'); await A1.waitForTimeout(200); ok(/EZN-A01 · /.test(await A1.textContent('#view'))&&/EZN-A02 · /.test(await A1.textContent('#view')),'admin names appear in the register');
await A2.click('.navlist [data-page=register]'); await A2.waitForTimeout(250); await A2.click('[data-act=rtab][data-tab=attendance]'); await A2.click('[data-act=mtg-open]'); await A2.click('#mSubmit'); await A2.waitForTimeout(300); await A1.waitForTimeout(800); await A1.click('[data-act=rtab][data-tab=attendance]'); await A1.waitForTimeout(300);
ok(!!(await A1.$('.att-open [data-act=att-mark-admin]')),'Mark me present button on register banner'); await A1.click('.att-open [data-act=att-mark-admin]'); await A1.waitForTimeout(400); ok(/waiting for you|1 waiting|Waiting/i.test(await A1.textContent('#view')+''),'admin marked self');
await A2.waitForTimeout(600); await A2.click('.navlist [data-page=register]'); await A2.waitForTimeout(300); await A2.click('[data-act=mtg-view] >> nth=0'); await A2.waitForSelector('#modalRoot table.t'); await A2.click('#modalRoot tr:has-text("EZN-A01") [data-act=mtg-mark][data-s=verified]'); await A2.waitForTimeout(300); ok(/Present/.test(await A2.textContent('#modalRoot tr:has-text("EZN-A01")')),'one other admin verified admin attendance'); await closeM(A2);
// premium receipt includes code? (name+logo) fine. Admin-01 only
await A2.click('.navlist [data-page=admins]'); await A2.waitForTimeout(250); ok(/Only the Lead Admin|Lead Admin/.test(await A2.textContent('#view')),'A02 sees read-only message'); ok(!(await A2.$('[data-act=appoint-admin],[data-act=assign-duty],[data-act=remove-admin]')),'A02 has NO assign/remove buttons');
await A1.click('.navlist [data-page=admins]'); await A1.waitForTimeout(250); ok(!!(await A1.$('[data-act=appoint-admin]')),'A01 can appoint'); ok(!(await A1.$('tr:has-text("EZN-A01") [data-act=remove-admin]')),'A01 row cannot be removed');
await A1.click('[data-act=appoint-admin]'); await A1.selectOption('#apM','EZN-M003'); await A1.selectOption('#apT','Admin'); await A1.click('#mSubmit'); await A1.waitForTimeout(400); ok(/EZN-M003/.test(await A1.textContent('#view'))&&/Admin/.test(await A1.textContent('tr:has-text("EZN-M003")')),'member appointed admin with duty');
await A1.click('tr:has-text("EZN-M003") [data-act=assign-duty]'); await A1.selectOption('#adT','Auditor'); await A1.click('#mSubmit'); await A1.waitForTimeout(300); ok(/Auditor/.test(await A1.textContent('tr:has-text("EZN-M003")')),'duty changed');
// promoted member logs in as admin
await login(B,'ezinkwo','EZN-M003','ezn-member'); ok(!!(await B.$('.navlist [data-page=verify]')),'promoted member sees admin menu');
ok(!(await B.$('[data-act=appoint-admin]')),'promoted admin cannot appoint (not Admin-01)'); await B.click('.navlist [data-page=admins]'); ok(!(await B.$('[data-act=appoint-admin]')),'promoted admin has no admin-management buttons');
await A1.click('tr:has-text("EZN-M003") [data-act=remove-admin]'); await A1.fill('#raR','Term ended'); await A1.click('#mSubmit'); await A1.waitForTimeout(400); ok(!/EZN-M003/.test(await A1.textContent('#view')),'admin removed from list');
await B.waitForTimeout(800); ok(!(await B.$('.navlist [data-page=verify]')),'removed admin loses admin menu live');
const au=await A1.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo')).audit.map(a=>a.action)); ok(['Appointed admin','Changed admin duty','Removed admin duties'].every(x=>au.includes(x)),'all three actions logged for everyone');
// basic village has no code field
const O=await mk(); await O.goto(U+'#owner'); await O.waitForTimeout(500); await O.fill('#ownId','OWNER'); await O.fill('#ownPw','owner-2026'); await O.click('#ownerBtn'); await O.waitForSelector('.shell');
const basic=await O.$$eval('.plan-col:nth-child(2) .chip',c=>c.map(x=>x.dataset.id)); console.log('BASIC',basic.join(','));
if(basic.length){ const bv=basic[0]; const code=await O.evaluate(id=>JSON.parse(localStorage.getItem('vv_v1_'+id)).code,bv); const Bp=await mk(); await login(Bp,bv,code+'-A01',code.toLowerCase()+'-admin'); await Bp.click('.navlist [data-page=profile]'); await Bp.click('[data-act=edit-profile]'); await Bp.waitForSelector('#vpN'); ok(!(await Bp.$('#vpC')),'basic plan: no code field'); }
console.log('ERRORS',JSON.stringify(errs)); await b.close();
})().catch(e=>{console.log('FATAL',e.message.split('\n')[0]);process.exit(1)});
