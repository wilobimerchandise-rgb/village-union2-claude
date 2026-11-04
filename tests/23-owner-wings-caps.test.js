const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL||'http://localhost:8765/index.html';const errs=[];
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const fresh=async()=>{await p.goto(U);await p.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await p.goto(U);await p.waitForTimeout(150);};
const opts=()=>p.$$eval('#heroVillage option:not([data-test])',o=>o.map(x=>({v:x.value,t:x.textContent.trim()})));
const login=async(v,id,pw)=>{await fresh();try{await p.selectOption('#heroVillage',v,{timeout:2500})}catch(_){return false}await p.waitForTimeout(150);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(800);return !!(await p.$('.shell'))};
const owner=async()=>{await fresh();await p.goto(U+'#owner');await p.waitForTimeout(400);await p.fill('#ownId','OWNER');await p.fill('#ownPw','owner-2026');await p.click('#ownerBtn');await p.waitForSelector('.shell');};
const closeM=async()=>{if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(150)}};
// 1 a village shows only as its wings
await fresh();let o=await opts();
ok(!o.some(x=>/^Nkwo ?ibe \(/i.test(x.t)),'the village itself is not in the dropdown');
ok(o.some(x=>/Nkwo ?ibe Men’s Wing/i.test(x.t))&&o.some(x=>/Nkwo ?ibe Women’s Wing/i.test(x.t)),'Nkwo Ibe shows as its Men’s Wing and its Women’s Wing');
ok((await p.$$('#villageGrid .vcard')).length===10&&(await p.$$('#villageGrid .vwing')).length===20,'landing: 10 village cards, each with a Men’s and a Women’s wing button');
await p.click('#villageGrid .vwing >> nth=1');await p.waitForTimeout(300);ok(/~women$/.test(await p.inputValue('#heroVillage')),'a wing button picks that wing for sign-in');
// 2 owner: add an association, and wings per village
await owner();await p.click('.navlist [data-page=o-villages]');await p.waitForTimeout(250);
await p.click('[data-act=o-add-village]');await p.fill('#avN','Test Assoc');await p.fill('#avC','tas');await p.selectOption('#avY','association');await p.fill('#avL','Chair Assoc');await p.fill('#avW','assoc-pass-1');await p.click('#mSubmit');await p.waitForTimeout(600);
ok(/TAS-A01/.test(await p.textContent('#modalRoot, .toast, body')),'new association gets one Lead Admin ID');await closeM();
await p.click('.navlist [data-page=o-villages]');await p.waitForTimeout(250);
ok((await p.$$('[data-act=owner-wings]')).length===10,'owner has a Wings control on the 10 villages');
ok(!(await p.$('tr:has-text("Test Assoc") [data-act=owner-wings]')),'an association has no Wings control');
ok(/No wings/.test(await p.textContent('#view')),'association row says No wings');
await fresh();o=await opts();ok(o.filter(x=>/Test Assoc/.test(x.t)).length===1&&!o.some(x=>/Test Assoc.*Wing/.test(x.t)),'association appears once, with no wings');
// owner removes the Women's wing of Umuchima
await owner();await p.click('.navlist [data-page=o-villages]');await p.waitForTimeout(250);
await p.click('tr:has-text("Umuchima") [data-act=owner-wings]');await p.selectOption('#owwomen','off');await p.click('#mSubmit');await p.waitForTimeout(400);
ok(/Women’s Wing off/.test(await p.textContent('tr:has-text("Umuchima")'))&&/Men’s Wing on/.test(await p.textContent('tr:has-text("Umuchima")')),'owner list shows Women’s Wing off, Men’s Wing on');
await fresh();o=await opts();ok(o.some(x=>x.v==='umuchima~men')&&!o.some(x=>x.v==='umuchima~women'),'removed wing disappears from sign-in; the other stays');
ok((await p.$$('#villageGrid .vcard:has-text("Umuchima") .vwing')).length===1,'landing card shows only the remaining wing');
ok(!(await login('umuchima~women','UMCW-A02','umcw-admin')),'the removed wing cannot be signed in to');
// records kept: add it back
await owner();await p.click('.navlist [data-page=o-villages]');await p.waitForTimeout(250);
await p.click('tr:has-text("Umuchima") [data-act=owner-wings]');await p.selectOption('#owwomen','on');await p.click('#mSubmit');await p.waitForTimeout(400);
await fresh();o=await opts();ok(o.some(x=>x.v==='umuchima~women'),'owner added the wing back');
ok(await login('umuchima~women','UMCW-A02','umcw-admin'),'its records were kept and it opens again');
// both off: the village disappears
await owner();await p.click('.navlist [data-page=o-villages]');await p.waitForTimeout(250);
await p.click('tr:has-text("Umuchima") [data-act=owner-wings]');await p.selectOption('#owmen','off');await p.selectOption('#owwomen','off');await p.click('#mSubmit');await p.waitForTimeout(400);
await fresh();o=await opts();ok(!o.some(x=>/Umuchima/.test(x.t)),'both wings off: the village is not listed at all');
// 3 Basic caps
await owner();await p.click('.navlist [data-page=o-villages]');await p.waitForTimeout(250);
await p.click('tr:has-text("Umuchima") [data-act=owner-wings]');await p.selectOption('#owmen','on');await p.selectOption('#owwomen','on');await p.click('#mSubmit');await p.waitForTimeout(400);
await p.evaluate(()=>{['umuchima~men','umuchima~women'].forEach(k=>{const v=JSON.parse(localStorage.getItem('vv_v1_'+k)||'null');if(v){v.users.forEach(u=>{if(u.role==='member')u.active=true});localStorage.setItem('vv_v1_'+k,JSON.stringify(v))}})});
ok(await login('umuchima~men','UMCM-A02','umcm-admin'),'Basic Men’s Wing admin signs in');
let n=await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuchima~men')).users.filter(u=>u.role==='member'&&u.active).length);ok(n===10,'the Men’s Wing has 10 members');
await p.click('.navlist [data-page=members]');await p.waitForTimeout(300);ok(/You have reached the Basic plan limit of 10 members/.test(await p.textContent('#view')),'wing at its limit says 10 members');
await p.click('[data-act=add-member]');await p.waitForTimeout(300);ok(/up to 10 members in each wing/.test(await p.textContent('#modalRoot'))&&!(await p.$('#modalRoot input[name=name]')),'adding the 11th member is blocked, naming the 10-per-wing limit');await closeM();
ok(await login('umuchima~women','UMCW-A02','umcw-admin'),'Women’s Wing admin signs in');
await p.click('.navlist [data-page=members]');await p.waitForTimeout(300);await p.click('[data-act=add-member]');await p.waitForTimeout(300);ok(/up to 10 members in each wing/.test(await p.textContent('#modalRoot')),'the Women’s Wing has its own limit of 10');await closeM();
ok(await login('umuokpu~men','UMKM-A02','umkm-admin'),'Premium wing admin signs in');await p.click('.navlist [data-page=members]');await p.waitForTimeout(300);await p.click('[data-act=add-member]');await p.waitForSelector('#modalRoot input[name=name]');ok(true,'Premium wings have no limit');await closeM();
// association: 10 members
await p.evaluate(()=>{const id='testassoc';const v=JSON.parse(localStorage.getItem('vv_v1_'+id));for(let i=1;i<=10;i++)v.users.push({id:'TAS-M'+String(i).padStart(3,'0'),name:'Member Number '+i,role:'member',title:'Member',family:'',kindred:'',phone:'',email:'',joined:'2026-01-01',active:true,hash:'x'});localStorage.setItem('vv_v1_'+id,JSON.stringify(v));});
ok(await login('testassoc','TAS-A01','assoc-pass-1'),'association Lead Admin signs in');
if(await p.$('#modalRoot:not([hidden])'))await closeM();
await p.click('.navlist [data-page=members]');await p.waitForTimeout(300);ok(/limit of 10 members/.test(await p.textContent('#view')),'association at 10 members reaches the Basic limit');
await p.click('[data-act=add-member]');await p.waitForTimeout(300);ok(/up to 10 members/.test(await p.textContent('#modalRoot'))&&!/each wing/.test(await p.textContent('#modalRoot')),'association limit is 10 and mentions no wings');await closeM();
await p.click('.navlist [data-page=plans]');await p.waitForTimeout(300);ok(/Basic covers up to 10 members/.test(await p.textContent('#view')),'association Plans page says 10 members');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');
await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
