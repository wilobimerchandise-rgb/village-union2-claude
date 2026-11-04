const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const errs=[]; const watch=p=>{p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});};
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'));
const p=await ctx.newPage(); watch(p);
const fresh=async(pg)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear()});await pg.goto(U);await pg.waitForTimeout(250);};
const pick=async(pg,v)=>{await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);};
const login=async(pg,v,id,pw,remember)=>{await fresh(pg);await pick(pg,v);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);if(remember)await pg.check('#remember');await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
const closeM=async(pg)=>{ if(await pg.$('#modalRoot:not([hidden])')){ await pg.keyboard.press('Escape'); await pg.waitForTimeout(120);} };
// ---- landing
await fresh(p);
const labels=await p.$$eval('#heroVillage option',o=>o.map(x=>x.textContent)); ok(/village or association/i.test(labels[0]),'dropdown label: '+labels[0]);
ok(/village\/association/i.test(await p.textContent('.access-label')),'access label village/association');
await pick(p,'ezinkwo'); ok(!!(await p.$('#remember')),'remember checkbox'); 
// show password toggle
await p.fill('#loginPw','abc'); await p.click('#accessForm [data-act=toggle-pw]'); ok((await p.getAttribute('#loginPw','type'))==='text','show password works');
// 3 wrong tries
await p.fill('#loginId','EZN-M001');
for(let i=0;i<3;i++){await p.fill('#loginPw','wrong'+i);await p.click('#loginBtn');await p.waitForTimeout(250);}
const em=await p.textContent('#loginError'); ok(/Enter correct details or contact admin/i.test(em),'3 wrong -> "'+em.trim()+'"');
await p.fill('#loginPw','ezn-member'); await p.click('#loginBtn'); await p.waitForTimeout(250); ok(/contact admin/i.test(await p.textContent('#loginError')),'still blocked during lock');
// request access
await p.click('[data-act=request-access]'); await p.waitForSelector('#rqN'); await p.fill('#rqN','Chinedu Okeke'); await p.fill('#rqP','08031112222'); await p.fill('#rqF','Okeke'); await p.fill('#rqK','Umuagu'); await p.fill('#rqM','I joined in 2019'); await p.click('#mSubmit'); await p.waitForTimeout(400);
ok(!(await p.$('#modalRoot:not([hidden])')),'request sent (modal closed)');
await p.click('[data-act=request-access]'); await p.fill('#rqN','Chinedu Okeke'); await p.fill('#rqP','08031112222'); await p.fill('#rqF','Okeke'); await p.fill('#rqK','Umuagu'); await p.fill('#rqM','again'); await p.click('#mSubmit'); await p.waitForTimeout(300); ok(/already asked/i.test(await p.textContent('#mError')),'duplicate request blocked'); await closeM(p);
// ---- admin ezinkwo: see request
await login(p,'ezinkwo','EZN-A02','ezn-admin',true);
const nav=await p.$$eval('.navlist button',b=>b.map(x=>x.textContent.replace(/\d+$/,'').trim())); console.log('NAV',nav.join('|'));
ok(['Outstanding bills','Register','Levy categories','Village profile'].every(n=>nav.includes(n)),'admin nav has new pages');
ok(/asking for login details/.test(await p.textContent('#view')),'overview shows request callout');
ok((await p.$$('.kpi.click')).length===4,'4 clickable KPIs');
ok(!!(await p.$('#payinfo table.bordered')),'payment table with borders on admin overview');
ok(!!(await p.$('#payinfo [data-act=edit-accounts]')),'admin can edit payment details');
// KPIs drill-down
for(const k of ['kpi-collected','kpi-spent','kpi-balance']){ await p.click(`.kpi[data-act=${k}]`); await p.waitForSelector('#modalRoot:not([hidden]) .modal'); ok(true,'KPI '+k+' opens'); 
  if(k==='kpi-collected'){ const mp=await p.$('#modalRoot [data-act=member-profile]'); if(mp){ await mp.click(); await p.waitForSelector('#modalRoot .kv'); ok(true,'drill: member name in modal opens profile'); } }
  await closeM(p);}
// members behind -> outstanding
await p.click('.kpi[data-act=goto]'); await p.waitForTimeout(250); ok(/Outstanding bills/.test(await p.textContent('#pageTitle')),'Members behind opens Outstanding page');
const rowsN=(await p.$$('table.t tbody tr')).length; ok(rowsN>0,'owing rows '+rowsN);
await p.click('table.t tbody tr >> nth=0 >> .linkbtn'); await p.waitForSelector('#modalRoot .kv'); ok(/Still owes/.test(await p.textContent('#modalRoot')),'click name -> profile with owing');
const [dn]=await Promise.all([p.waitForEvent('download'),p.click('#modalRoot [data-act=notice-one]')]); await dn.saveAs('/tmp/n1.pdf'); const nb=fs.readFileSync('/tmp/n1.pdf'); ok(nb.slice(0,5).toString()==='%PDF-'&&nb.includes('%%EOF')&&nb.length>2500,'notice PDF valid '+nb.length+' '+dn.suggestedFilename()); await closeM(p);
const [dn2]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=notice-all]')]); await dn2.saveAs('/tmp/n2.pdf'); ok(fs.readFileSync('/tmp/n2.pdf').slice(0,5).toString()==='%PDF-','all notices PDF '+fs.statSync('/tmp/n2.pdf').size);
ok(!!(await p.$('a[href^="https://wa.me/"]')),'WhatsApp reminder link');
const [dn3]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=owing-csv]')]); ok(true,'csv '+dn3.suggestedFilename());
await p.selectOption('#fl',{index:1}); await p.selectOption('#fl','');
// payment details edit
await p.click('.navlist [data-page=profile]'); await p.waitForTimeout(200); await p.click('#payinfo [data-act=edit-accounts]'); await p.waitForSelector('input[name=bank_0]');
await p.fill('input[name=bank_1]','Zenith Bank'); await p.fill('input[name=num_1]','12345'); await p.fill('input[name=nm_1]','Test Union'); await p.click('#mSubmit'); await p.waitForTimeout(200); ok(/10 digits/.test(await p.textContent('#mError')),'account number validated');
await p.fill('input[name=num_1]','1234567890'); await p.click('#mSubmit'); await p.waitForTimeout(300); ok(/Zenith Bank/.test(await p.textContent('#view'))&&/1234567890/.test(await p.textContent('#view')),'payment details saved & shown');
// branding: name + logo
await p.click('[data-act=edit-profile]'); await p.waitForSelector('#vpN'); await p.fill('#vpN','Ezinkwo Progressive Union');
const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=80;const g=c.getContext('2d');g.fillStyle='#D2395B';g.fillRect(0,0,80,80);g.fillStyle='#fff';g.fillRect(20,20,40,40);return c.toDataURL('image/png').split(',')[1];});
await p.setInputFiles('#fProof',{name:'logo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}); await p.click('#mSubmit'); await p.waitForTimeout(500);
ok(/Ezinkwo Progressive Union/.test(await p.textContent('.side-village'))&&!!(await p.$('.side-village img.vlogo')),'name and logo updated in sidebar');
// levies CRUD
await p.click('.navlist [data-page=levies]'); await p.click('[data-act=add-levy]'); await p.fill('#lvN','Development levy'); await p.fill('#lvA','4000'); await p.click('#mSubmit'); await p.waitForTimeout(300);
ok(/Development levy/.test(await p.textContent('#view')),'levy added');
await p.click('tr:has-text("Development levy") [data-act=edit-levy]'); await p.fill('#lvA','4500'); await p.click('#mSubmit'); await p.waitForTimeout(300); ok(/4,500/.test(await p.textContent('#view')),'levy edited');
await p.click('tr:has-text("Development levy") [data-act=remove-levy]'); await p.click('#mSubmit'); await p.waitForTimeout(300); ok(/Removed/.test(await p.textContent('tr:has-text("Development levy")')),'levy removed (soft)');
await p.click('tr:has-text("Development levy") [data-act=restore-levy]'); await p.waitForTimeout(200); ok(!/Removed/.test(await p.textContent('tr:has-text("Development levy")')),'levy restored');
// register: open register
await p.click('.navlist [data-page=register]'); await p.waitForTimeout(250); await p.click('[data-act=mtg-open]'); await p.click('#mSubmit'); await p.waitForTimeout(300); ok(/Register open today/.test(await p.textContent('#view')),'register opened');
await p.click('[data-act=mtg-open]',{timeout:1500}).catch(()=>{}); 
// requests tab
await p.click('[data-act=rtab][data-tab=requests]'); await p.waitForTimeout(200); await p.click('[data-act=req-check]'); await p.waitForSelector('#rcM'); 
await p.click('#mSubmit'); await p.waitForTimeout(200); ok(/Choose the member/.test(await p.textContent('#mError')),'must choose member');
const first=await p.$eval('#rcM option:nth-child(2)',o=>o.value); await p.selectOption('#rcM',first); await p.click('#mSubmit'); await p.waitForTimeout(200); ok(/Tick the box/.test(await p.textContent('#mError')),'must confirm register check');
await p.check('input[name=confirm]'); await p.click('#mSubmit'); await p.waitForSelector('#credText'); const cm=await p.inputValue('#credText'); ok(/Temporary password: Vv\d{6}/.test(cm),'login details generated'); const tpw=cm.match(/Temporary password: (\S+)/)[1]; const mid=cm.match(/ID: (\S+)/)[1];
ok(!!(await p.$('#modalRoot a[href^="https://wa.me/2348031112222"]')),'WhatsApp link goes to the requester phone'); await closeM(p);
// credentials tab
await p.click('[data-act=rtab][data-tab=logins]'); await p.waitForTimeout(200); ok(/Temporary password stored/.test(await p.textContent('#view')),'login details section lists stored temp');
await p.click('tr:has-text("'+mid+'") [data-act=cred-send]'); await p.waitForSelector('#credText'); ok((await p.inputValue('#credText')).includes(tpw),'resend shows same stored details'); await closeM(p);
// member register tab + click name
await p.click('[data-act=rtab][data-tab=members]'); await p.waitForTimeout(200); await p.click('table.t tbody tr >> nth=0 >> .linkbtn'); await p.waitForSelector('#modalRoot .kv'); ok(/Attendance history/.test(await p.textContent('#modalRoot'))&&/Payment history/.test(await p.textContent('#modalRoot')),'register: name shows attendance + payment history'); await closeM(p);
// ---- member first-time login in 2nd page (same context)
const m=await ctx.newPage(); watch(m);
await m.goto(U);await m.evaluate(()=>{Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await login(m,'ezinkwo',mid,tpw,false); await m.waitForSelector('#pCur'); ok(/Choose your own password/.test(await m.textContent('#modalRoot')),'first login forces password change');
ok(!!(await m.$('#modalRoot [data-act=toggle-pw]')),'show password in change-pw');
await m.fill('#pCur',tpw); await m.fill('#pNew','Mypass99'); await m.fill('#pNew2','Mypass99'); await m.click('#mSubmit'); await m.waitForTimeout(400);
ok(!(await m.$('#modalRoot:not([hidden]) .modal')),'password changed');
// member views
ok(!!(await m.$('#payinfo table.bordered'))&&!(await m.$('#payinfo [data-act=edit-accounts]')),'member sees payment table, no edit');
ok(/Zenith Bank/.test(await m.textContent('#payinfo')),'member sees admin-updated bank');
ok(/The register is open/.test(await m.textContent('#view')),'member sees open register'); await m.click('[data-act=att-mark]'); await m.waitForTimeout(300); ok(/You marked attendance/.test(await m.textContent('#view')),'member marked attendance');
await m.click('.navlist [data-page=village]'); await m.waitForTimeout(250); ok(/What the admins have done/.test(await m.textContent('#view')),'village dashboard shows admin activity feed'); ok(/Attendance register/.test(await m.textContent('#view')),'village dashboard shows attendance register');
ok(/Ezinkwo Progressive Union/.test(await m.textContent('.side-village')),'renamed village visible to member');
ok(!/Village office|SUPPORT/.test(await m.textContent('#view')),'no owner traces');
await m.click('.navlist [data-page=overview]'); await m.waitForTimeout(150);
// admin verifies attendance
await p.click('.navlist [data-page=register]'); await p.click('[data-act=rtab][data-tab=attendance]'); await p.waitForTimeout(200); await p.click('[data-act=mtg-view]'); await p.waitForSelector('#modalRoot table.t'); ok(/Waiting for admin/.test(await p.textContent('#modalRoot')),'admin sees pending mark');
await p.click('#modalRoot [data-act=mtg-all]'); await p.waitForTimeout(300); ok(/Present/.test(await p.textContent('#modalRoot'))&&!/Waiting for admin/.test(await p.textContent('#modalRoot')),'verify all'); await closeM(p);
// outstanding payment flows to member dashboard automatically
await m.click('[data-act=my-owing]'); await m.waitForSelector('#modalRoot .modal'); const owe0=await m.textContent('#modalRoot'); ok(/You owe/.test(owe0)&&!!(await m.$('#modalRoot table.bordered')),'member my-owing modal with payment table'); await closeM(m);
const stillBefore=await m.textContent('.kpi.click[data-act=my-owing] .kpi-v');
await m.click('.topbar [data-act=upload-proof]');  const owed=await m.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vv_v1_ezinkwo'));const u='EZN-M010';const y=new Date().getFullYear();const out=[];for(const k in v.settings.levies){const need=v.settings.levies[k];const paid=v.tx.filter(t=>(t.userId||t.memberId)===u&&t.levy===k&&t.status==='verified').reduce((a,t)=>a+t.amount,0);if(need>paid)out.push(k)}return out}); console.log('OWED',owed);   await m.setInputFiles('#fProof',{name:'slip.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}); console.log('PRE',await m.evaluate(()=>[...document.querySelectorAll('.lv-pick')].map(c=>c.value+':'+c.checked).join()+' '+[...document.querySelectorAll('.lv-in')].map(i=>i.name+'='+i.value+(i.disabled?'(d)':'')).join())); await m.click('#mSubmit'); await m.waitForTimeout(800); console.log('M010txA',await m.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo')).tx.filter(t=>t.memberId==='EZN-M010').map(t=>t.id+t.status).join())); console.log('TOAST',await m.evaluate(()=>document.querySelector('.toasts')?.textContent)); console.log('M010txB',await m.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo')).tx.filter(t=>t.memberId==='EZN-M010').length)); console.log('M010tx',await m.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_ezinkwo')).tx.filter(t=>t.memberId==='EZN-M010').map(t=>t.status+t.amount+t.levy).join())); console.log('MODAL',await m.evaluate(()=>document.querySelector('#modalRoot').hidden+' '+document.querySelector('#modalRoot').textContent.replace(/\s+/g,' ').slice(0,300))); console.log('LAST',await m.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vv_v1_ezinkwo'));return v.tx.filter(t=>t.status==='pending').map(t=>t.memberId+t.amount).join()+' | who '+document.querySelector('.side-foot')?.textContent.slice(0,60)})); console.log('UPERR',await m.evaluate(()=>{const e=document.querySelector('#mError');return e?e.textContent:'none'}));
await p.click('.navlist [data-page=verify]'); await p.waitForTimeout(250); console.log('ROWS',await p.evaluate(()=>[...document.querySelectorAll('table.t tbody tr')].filter(r=>/M010/.test(r.textContent)).map(r=>r.textContent.replace(/\s+/g,' ').slice(0,100)))); await p.click(`table.t tbody tr:has-text("${mid}") [data-act=verify-tx]`); await p.click('#mSubmit'); await p.waitForTimeout(500);
await m.waitForTimeout(700); console.log('DBG',JSON.stringify(await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vv_v1_ezinkwo'));return v.tx.filter(t=>t.ref==='TRF778899'||t.reference==='TRF778899').map(t=>({s:t.status,l:t.levy,a:t.amount,u:t.userId||t.memberId}))}))); const stillAfter=await m.textContent('.kpi.click[data-act=my-owing] .kpi-v'); ok(stillBefore!==stillAfter,'member balance updated automatically after admin verification: '+stillBefore+' -> '+stillAfter);
// receipt on premium (ezinkwo is premium) bears village name
await p.click('.navlist [data-page=transactions]'); await p.waitForTimeout(200); await p.click('[data-act=receipt] >> nth=0'); await p.waitForSelector('.receipt-prev img'); const [r1]=await Promise.all([p.waitForEvent('download'),p.click('[data-fmt=pdf]')]); await r1.saveAs('/tmp/rp.pdf'); const rb=fs.readFileSync('/tmp/rp.pdf'); ok(rb.toString('latin1').includes('Ezinkwo Progressive Union')&&rb.toString('latin1').includes('DCTDecode'),'premium receipt PDF has village name + logo'); await closeM(p);
// admin audit includes all, public
await p.click('.navlist [data-page=audit]'); await p.waitForTimeout(200); const au=await p.textContent('#view'); ok(/Opened attendance register/.test(au)&&/Updated payment details/.test(au)&&/Added levy category/.test(au)&&/Issued login details/.test(au),'audit has the new admin actions');
console.log('ERRORS',JSON.stringify(errs)); await b.close();
})().catch(e=>{console.log('FATAL',e.message.split('\n')[0]);{console.log(e.stack.split('\n').slice(0,4).join(' | '));process.exit(1)}});
