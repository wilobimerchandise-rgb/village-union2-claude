const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=(process.env.BASE_URL||'http://localhost:8765/index.html');const errs=[];
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const fresh=async()=>{await p.goto(U);await p.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await p.goto(U);};
const tryLogin=async(v,id,pw)=>{await fresh();await p.selectOption('#heroVillage',v);await p.waitForTimeout(200);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(700);return !!(await p.$('.shell'));};
const nav=async()=>(await p.$$eval('.navlist [data-page]',e=>e.map(x=>x.dataset.page))).join(',');
// 1 dropdown: every village is followed by its two wings
await fresh();
const opts=await p.$$eval('#heroVillage option:not([data-test])',o=>o.map(x=>({v:x.value,t:x.textContent.replace(/ /g,' ').trim()})));
ok(opts.length===21,'dropdown has the placeholder + 20 wings, no village on its own ('+opts.length+')');
ok(!opts.some(o=>o.v==='umuokpu'),'a village is not listed by itself');
const i=opts.findIndex(o=>o.v==='umuokpu~men');ok(i>0&&/^Umuokpu Men’s Wing \(UMKM\)$/.test(opts[i].t)&&opts[i+1].v==='umuokpu~women'&&/^Umuokpu Women’s Wing \(UMKW\)$/.test(opts[i+1].t),'Umuokpu shows only as its Men’s Wing and Women’s Wing');
ok((await p.$$('#villageGrid .vcard')).length===10,'landing village cards unchanged (10)');
// 2 village baseline
const vBefore=await p.evaluate(()=>localStorage.getItem('vv_v1_umuokpu'));
ok(await tryLogin('umuokpu','UMK-A02','umk-admin'),'village admin still signs in');const vNav=await nav();
const vMembers=await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).users.filter(u=>u.role==='member').length);ok(vMembers===22,'village keeps its 22 members');
// 3 Men's wing admin: same admin access, own register
ok(await tryLogin('umuokpu~men','UMKM-A02','umkm-admin'),'Men’s wing admin signs in');
ok(/Umuokpu Men’s Wing/.test(await p.textContent('.side-village'))&&/Men’s Wing/.test(await p.textContent('.side-village small')),'sidebar names the wing');
ok(await nav()===vNav,'wing admin has the same menu as a village admin');
const men=await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu~men')));
ok(men.users.filter(u=>u.role==='admin').length===3&&men.users.filter(u=>u.role==='member').length===10,'Men’s wing has 3 admins and 10 members');
const maleF=['Chinedu','Emeka','Obinna','Uchenna','Ikenna','Chukwuma','Kelechi','Nnamdi','Tochukwu','Ifeanyi','Somto','Chidi','Kenechukwu'];
ok(men.users.every(u=>maleF.includes(u.name.split(' ')[0])),'Men’s wing names are men’s names');
await p.click('.navlist [data-page=members]');await p.waitForTimeout(300);ok(/UMKM-M001/.test(await p.textContent('#view')),'wing members page lists the wing register');
ok(!/UMK-M001/.test(await p.textContent('#view')),'village members are not in the wing register');
// 4 Women's wing member
ok(await tryLogin('umuokpu~women','UMKW-M001','umkw-member'),'Women’s wing member signs in');
ok(!(await p.$('.navlist [data-page=members]')),'wing member does not get admin pages');
ok((await nav())===await (async()=>{await tryLogin('umuokpu','UMK-M001','umk-member');return nav();})(),'wing member has the same menu as a village member');
const wom=await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu~women')));
const femF=['Ngozi','Ifeoma','Chioma','Adaeze','Nneka','Amaka','Ebere','Onyinye','Ugochi','Obiageli','Nkechi','Oluchi','Ijeoma'];
ok(wom.users.every(u=>femF.includes(u.name.split(' ')[0])),'Women’s wing names are women’s names');
// 5 isolation both ways
ok(!(await tryLogin('umuokpu~men','UMK-A02','umk-admin')),'village admin ID does not open the wing');
ok(!(await tryLogin('umuokpu','UMKM-A02','umkm-admin')),'wing admin ID does not open the village');
ok(!(await tryLogin('umuokpu~women','UMKM-A02','umkm-admin')),'Men’s wing admin cannot open the Women’s wing');
ok(!(await tryLogin('amakwu~men','UMKM-A02','umkm-admin')),'wing admin cannot open another village’s wing');
ok(await p.evaluate(()=>localStorage.getItem('vv_v1_umuokpu'))!==null,'village record present');
// 6 wing admin writes stay in the wing
await tryLogin('umuokpu~men','UMKM-A02','umkm-admin');
await p.click('.navlist [data-page=members]');await p.waitForTimeout(250);await p.click('[data-act=add-member]');await p.waitForSelector('#modalRoot input[name=name]');
await p.fill('#modalRoot input[name=name]','Test Wingman');const ph=await p.$('#modalRoot input[name=phone]');if(ph)await ph.fill('08031234567');
const pw=await p.$('#modalRoot input[name=password]');if(pw)await pw.fill('wing12345');await p.click('#mSubmit');await p.waitForTimeout(700);
const after=await p.evaluate(()=>({m:JSON.parse(localStorage.getItem('vv_v1_umuokpu~men')).users.length,v:JSON.parse(localStorage.getItem('vv_v1_umuokpu')).users.length,w:JSON.parse(localStorage.getItem('vv_v1_umuokpu~women')).users.length}));
ok(after.m===14&&after.v===25&&after.w===13,'new member lands in the Men’s wing only ('+JSON.stringify(after)+')');
// 7 plans follow the village
ok((await p.evaluate(()=>[JSON.parse(localStorage.getItem('vv_v1_umuokpu~men')).plan,JSON.parse(localStorage.getItem('vv_v1_umuchima')||'{"plan":"basic"}').plan]))[0]==='premium','Premium village → Premium wing');
await tryLogin('umuchima~women','UMCW-A02','umcw-admin');ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuchima~women')).plan)==='basic','Basic village → Basic wing');
// 9 owner sees wings and a paused village pauses its wings
await fresh();await p.goto(U+'#owner');await p.waitForTimeout(400);await p.fill('#ownId','OWNER');await p.fill('#ownPw','owner-2026');await p.click('#ownerBtn');await p.waitForSelector('.shell');
await p.click('.navlist [data-page=o-admins]');await p.waitForTimeout(300);
ok((await p.$$('#oaV option')).length===20,'owner admin picker lists the 20 wings');
await p.selectOption('#oaV','umuchima~women');await p.waitForTimeout(300);ok(/UMCW-A01/.test(await p.textContent('#view')),'owner can manage a wing’s admins');
await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vv_v1_umuchima'));v.status='suspended';localStorage.setItem('vv_v1_umuchima',JSON.stringify(v));});
ok(!(await tryLogin('umuchima~men','UMCM-A02','umcm-admin')),'a paused village pauses its wings');
// 10 owner adds a village: its wings exist, start empty with one Lead Admin who must change the password
await fresh();await p.goto(U+'#owner');await p.waitForTimeout(400);await p.fill('#ownId','OWNER');await p.fill('#ownPw','owner-2026');await p.click('#ownerBtn');await p.waitForSelector('.shell');
await p.click('.navlist [data-page=o-villages]');await p.waitForTimeout(250);await p.click('[data-act=o-add-village]');await p.fill('#avN','Test Hamlet');await p.fill('#avC','tht');await p.fill('#avL','Chief Test');await p.fill('#avW','test-pass-1');await p.click('#mSubmit');await p.waitForTimeout(600);
await fresh();ok((await p.$$('#heroVillage option:not([data-test])')).length===23,'new village adds its two wings to the dropdown');
await p.selectOption('#heroVillage','testhamlet~women');await p.fill('#loginId','THTW-A01');await p.fill('#loginPw','test-pass-1');await p.click('#loginBtn');await p.waitForTimeout(900);
ok(!!(await p.$('.shell'))&&/Test Hamlet Women’s Wing/.test(await p.textContent('.side-village')),'new village’s wing opens for its Lead Admin');
ok(!!(await p.$('#modalRoot:not([hidden]) #cpNew, #modalRoot:not([hidden]) input[type=password]')),'Lead Admin is made to set a new password');
console.log('ERRORS',JSON.stringify(errs));await b.close()})().catch(e=>{console.log('FATAL',e.message.slice(0,400));process.exit(1)});
