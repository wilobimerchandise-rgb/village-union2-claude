const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});
await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)});
await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL||'http://localhost:8765/index.html';const errs=[];
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const login=async(v,id,pw)=>{await p.goto(U);await p.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await p.goto(U);await p.selectOption('#heroVillage',v);await p.waitForTimeout(150);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(800);return !!(await p.$('.shell'))};
const closeM=async()=>{if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(150)}};
const go=async pg=>{await closeM();await p.click(`.navlist [data-page=${pg}]`);await p.waitForTimeout(350)};
const upload=async(lvl,amt)=>{await p.click('.topbar [data-act=upload-proof]');await p.waitForSelector('.lv-list');await p.check(`.lv-pick[value="L:${lvl}"]`,{force:true});await p.fill(`input[name="amt_L:${lvl}"]`,String(amt));await p.setInputFiles('#fProof',{name:'s.png',mimeType:'image/png',buffer:png});await p.click('#mSubmit');await p.waitForTimeout(500);await closeM()};
const txOf=id=>p.evaluate(i=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).tx.filter(t=>t.memberId===i).map(t=>t.status+':'+(t.verifiedById||'')),id);
const V='umuokpu';
// A member uploads a proof
ok(await login(V,'UMK-M001','umk-member'),'member signs in');await upload('party',1500);
ok((await txOf('UMK-M001')).some(s=>s.startsWith('pending')),'member proof is waiting');
// Chairman (A01) and Treasurer (A03) are not offered verification
for(const [id,pw,who] of [['UMK-A01','umk-admin','Chairman'],['UMK-A03','umk-admin','Treasurer']]){ok(await login(V,id,pw),who+' signs in');await go('verify');
 ok((await p.$$('[data-act=verify-tx]')).length===0&&(await p.$$('[data-act=reject-tx]')).length===0,who+' sees no Verify or Reject buttons for a member’s proof');}
// Financial Secretary verifies it
ok(await login(V,'UMK-A02','umk-admin'),'Financial Secretary signs in');await go('verify');
await p.click('table.t tbody tr:has-text("UMK-M001") [data-act=verify-tx], tr:has-text("Chinedu") [data-act=verify-tx]').catch(async()=>{await p.click('[data-act=verify-tx]')});await p.waitForTimeout(250);await p.click('#mSubmit');await p.waitForTimeout(400);await closeM();
ok((await txOf('UMK-M001')).some(s=>s==='verified:UMK-A02'),'the Financial Secretary verified the member’s proof');
// Financial Secretary uploads their own proof: only the Chairman may verify
await upload('party',2000);await go('verify');
const ownBtn=await p.$('table.t tbody tr:has-text("UMK-A02") [data-act=verify-tx]');
if(ownBtn){await ownBtn.click();await p.waitForTimeout(250);ok(/cannot verify your own|only be verified by the Chairman/.test(await p.textContent('body')),'Financial Secretary cannot verify their own proof');await closeM();}else ok(true,'Financial Secretary is not offered their own proof');
ok((await txOf('UMK-A02')).some(s=>s.startsWith('pending')),'their own proof is still waiting');
ok(await login(V,'UMK-A03','umk-admin'),'Treasurer signs in');await go('verify');ok((await p.$$('table.t tbody tr:has-text("UMK-A02") [data-act=verify-tx]')).length===0,'Treasurer cannot verify the Financial Secretary’s proof');
ok(await login(V,'UMK-A01','umk-admin'),'Chairman signs in');await go('verify');
await p.click('table.t tbody tr:has-text("UMK-A02") [data-act=verify-tx]');await p.waitForTimeout(250);await p.click('#mSubmit');await p.waitForTimeout(400);await closeM();
ok((await txOf('UMK-A02')).some(s=>s==='verified:UMK-A01'),'the Chairman verified the Financial Secretary’s proof');
// Chairman uploads: the Financial Secretary verifies; the Treasurer cannot
await upload('party',2500);
ok(await login(V,'UMK-A03','umk-admin'),'Treasurer signs in again');await go('verify');ok((await p.$$('table.t tbody tr:has-text("UMK-A01") [data-act=verify-tx]')).length===0,'Treasurer cannot verify the Chairman’s proof');
ok(await login(V,'UMK-A02','umk-admin'),'Financial Secretary signs in again');await go('verify');
await p.click('table.t tbody tr:has-text("UMK-A01") [data-act=verify-tx]');await p.waitForTimeout(250);await p.click('#mSubmit');await p.waitForTimeout(400);await closeM();
ok((await txOf('UMK-A01')).some(s=>s==='verified:UMK-A02'),'the Financial Secretary verified the Chairman’s proof');
// Expenses
const exp=async(pg)=>{await go('expenses');return (await p.$$('[data-act=add-exp]')).length};
ok((await exp())===1,'Financial Secretary sees Record expense');
await p.click('[data-act=add-exp]');await p.waitForSelector('#modalRoot select, #modalRoot input');
const n0=await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).expenses.length);
const cat=await p.$('#modalRoot select[name=category]');if(cat){const o=await cat.$$eval('option',x=>x.map(y=>y.value).filter(Boolean));await cat.selectOption(o[0]);}
await p.fill('#modalRoot input[name=description]','Test chairs hire');await p.fill('#modalRoot input[name=amount]','5000');await p.click('#mSubmit');await p.waitForTimeout(400);
ok((await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).expenses.length))===n0+1,'Financial Secretary recorded an expense');
for(const [id,who] of [['UMK-A01','Chairman'],['UMK-A03','Treasurer']]){await login(V,id,'umk-admin');ok((await exp())===0&&(await p.$$('[data-act=edit-exp],[data-act=void-exp]')).length===0,who+' cannot record, edit or void expenses');}
// Register
await login(V,'UMK-A03','umk-admin');await go('register');ok((await p.$$('[data-act=mtg-open],[data-act=mtg-close]')).length===0,'Treasurer cannot open or close the register');
await login(V,'UMK-A01','umk-admin');await go('register');ok((await p.$$('[data-act=mtg-open],[data-act=mtg-close]')).length===0,'Chairman cannot open or close the register');
await login(V,'UMK-A02','umk-admin');await go('register');ok((await p.$$('[data-act=mtg-open]')).length>=1,'Financial Secretary can open the register');
await p.click('[data-act=mtg-open]');await p.waitForTimeout(300);await p.click('#mSubmit');await p.waitForTimeout(500);await closeM();
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).meetings.some(m=>m.status==='open'&&m.openedById==='UMK-A02')),'register opened by the Financial Secretary');
await p.click('[data-act=mtg-close]');await p.waitForTimeout(300);await p.click('#mSubmit');await p.waitForTimeout(500);await closeM();
ok(!(await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).meetings.some(m=>m.status==='open'))),'register closed by the Financial Secretary');
// Username and password
ok(await login(V,'UMK-M002','umk-member'),'member signs in for username change');
ok(await p.$('[data-act=change-username]')!==null&&await p.$('[data-act=change-pw]')!==null,'members see Change username and Change password');
await p.click('[data-act=change-username]');await p.fill('#unN','ada.eze');await p.fill('#unP','wrong-pass');await p.click('#mSubmit');await p.waitForTimeout(300);ok(/not correct/.test(await p.textContent('#mError')),'username change needs the right password');
await p.fill('#unP','umk-member');await p.click('#mSubmit');await p.waitForTimeout(400);
ok((await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).users.find(u=>u.id==='UMK-M002').username))==='ada.eze','username saved');
ok(await login(V,'ada.eze','umk-member'),'signs in with the new username');
ok(await login(V,'UMK-M002','umk-member'),'login ID still works');
await login(V,'UMK-M003','umk-member');await p.click('[data-act=change-username]');await p.fill('#unN','ADA.EZE');await p.fill('#unP','umk-member');await p.click('#mSubmit');await p.waitForTimeout(300);ok(/taken/.test(await p.textContent('#mError')),'a username already used is refused');
await p.fill('#unN','1bad');await p.click('#mSubmit');await p.waitForTimeout(300);ok(/4 to 24/.test(await p.textContent('#mError')),'a badly formed username is refused');await closeM();
await login(V,'UMK-A03','umk-admin');ok(await p.$('[data-act=change-username]')!==null&&await p.$('[data-act=change-pw]')!==null,'admins see Change username and Change password');
await p.click('[data-act=change-pw]');await p.waitForSelector('#pCur');await p.fill('#pCur','umk-admin');await p.fill('#pNew','newpass-77');await p.fill('#pNew2','newpass-77').catch(()=>{});
const f=await p.$$eval('#modalRoot input[type=password]',e=>e.map(x=>x.id));await p.fill(`#${f[1]}`,'newpass-77');await p.fill(`#${f[2]}`,'newpass-77');await p.click('#mSubmit');await p.waitForTimeout(400);
ok(await login(V,'UMK-A03','newpass-77'),'admin signs in with the changed password');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');
await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
