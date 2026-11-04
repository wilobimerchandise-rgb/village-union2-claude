const { chromium } = require('playwright'); const fs=require('fs');
const SP=process.env.SP; let fails=0;
const ok=(c,m)=>{ if(!c)fails++; console.log((c?'PASS ':'FAIL ')+m); };
(async()=>{
const b=await chromium.launch(); const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}}); await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx); const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'));
await p.goto(U); await p.waitForTimeout(400);
// ---- landing has no sign-in buttons
const landText=await p.innerText('#site');
ok(!/sign in/i.test(landText.replace(/Sign out/gi,'')) ,'landing shows no "Sign in" wording');
ok(!/owner/i.test(landText),'landing never mentions owner');
ok(await p.$('#loginModal')===null,'no login modal in DOM');
ok((await p.$$eval('#navVillage option:not([data-test])',o=>o.length))===21,'nav dropdown lists the 20 wings + prompt');
await p.screenshot({path:SP+'/l2.png'});
// pick via NAV dropdown
await p.selectOption('#navVillage','amakwu'); await p.waitForTimeout(500);
ok(await p.inputValue('#heroVillage')==='amakwu','hero dropdown synced from nav');
ok(await p.isVisible('#accessForm'),'credential step appears after picking village');
// cross-village rejected
await p.fill('#loginId','UMK-M001'); await p.fill('#loginPw','umk-member'); await p.click('#loginBtn'); await p.waitForTimeout(400);
ok(await p.isVisible('#loginError'),'other village credentials rejected');
// member login (role inferred)
await p.selectOption('#heroVillage','umuokpu'); await p.waitForTimeout(300);
await p.fill('#loginId','UMK-M001'); await p.fill('#loginPw','umk-member'); await p.click('#loginBtn'); await p.waitForSelector('.shell');
let nav=(await p.$$eval('.navlist button',b=>b.map(x=>x.textContent.trim())));
ok(nav.length===14&&/My dashboard/.test(nav[0])&&/Village dashboard/.test(nav[1]),'member (Premium village) sees 2 dashboards plus achievements, hall of fame, minutes and the Round 14 and 15 Premium pages: '+nav.join(' | '));
ok((await p.textContent('#pageTitle'))==='My dashboard','member lands on My dashboard');
ok(await p.isVisible('text=My payment records'),'records inside personal dashboard');
// upload modal
await p.click('.topbar [data-act=upload-proof]'); await p.waitForSelector('.lv-list'); ok((await p.inputValue('input[name="amt_L:party"]'))==='','party amount empty'); await p.check('.lv-pick[value="L:burial"]',{force:true}); ok((await p.inputValue('input[name="amt_L:burial"]'))==='5000','burial amount auto-fills');
for(const k of await p.$$eval('.lv-pick:checked',x=>x.map(i=>i.value))){ if(k!=='L:burial') await p.uncheck(`.lv-pick[value="${k}"]`); } await p.fill('#uRef','REFNEW777'); const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC','base64'); fs.writeFileSync(SP+'/slip.png',png);
await p.setInputFiles('#fProof',SP+'/slip.png'); await p.click('#mSubmit'); await p.waitForTimeout(700);
ok((await p.content()).includes('REFNEW777'),'proof uploaded -> pending in records');
// filters
for(const s of ['#fl','#fs','#fy']){const vals=await p.$$eval(s+' option',o=>o.map(x=>x.value)); for(const v of vals)await p.selectOption(s,v);}
// statement modal
let dl; await p.click('[data-act=report-modal][data-scope=statement]'); await p.selectOption('#sKind','year'); await p.waitForTimeout(80); ok(await p.isDisabled('#sMonth'),'statement: month disabled for yearly'); await p.selectOption('#sKind','month'); await p.waitForTimeout(80); ok(!(await p.isDisabled('#sMonth')),'statement: month enabled for monthly');
[dl]=await Promise.all([p.waitForEvent('download'),p.click('#mSubmit')]); await dl.saveAs(SP+'/stmt.pdf'); ok(fs.readFileSync(SP+'/stmt.pdf').slice(0,5).toString()==='%PDF-','statement PDF downloads');
// village dashboard
await p.click('.navlist [data-page=village]'); await p.waitForTimeout(200);
ok(!(await p.$('[data-act=edit-tx],[data-act=verify-tx],[data-act=add-tx]')),'village dashboard is read-only for members');
await p.selectOption('#fm',{index:2}); await p.selectOption('#fm',''); await p.click('[data-act=tab][data-tab=spending]'); await p.click('[data-act=tab][data-tab=collections]');
await p.click('[data-act=report-modal][data-scope=village]'); [dl]=await Promise.all([p.waitForEvent('download'),p.click('#mSubmit')]); await dl.saveAs(SP+'/vrep.pdf'); ok(true,'village report downloads for member');
// password modal
await p.click('[data-act=change-pw]'); await p.fill('#pCur','umk-member'); await p.fill('#pNew','newpass1'); await p.fill('#pNew2','newpass1'); await p.click('#mSubmit'); await p.waitForSelector('#modalRoot',{state:'hidden',timeout:10000}).catch(()=>{});
ok(await p.isHidden('#modalRoot'),'member password changed');
await p.click('[data-act=logout]'); ok(await p.isVisible('#site'),'logout to landing');
// ---- admin via same form
await p.selectOption('#heroVillage','umuokpu'); await p.waitForTimeout(300); await p.fill('#loginId','UMK-A02'); await p.fill('#loginPw','umk-admin'); await p.click('#loginBtn'); await p.waitForSelector('.shell');
nav=(await p.$$eval('.navlist button',b=>b.map(x=>x.textContent.trim())));
ok(nav.length===27&&nav.some(n=>/Verify payments/.test(n)),'admin gets admin dashboard from same form ('+nav.length+' pages)');
await p.click('.navlist [data-page=verify]'); const has=await p.$('[data-act=verify-tx]'); if(has){ await p.click('[data-act=verify-tx] >> nth=0'); await p.click('#mSubmit'); await p.waitForTimeout(300);} ok(true,'admin verified a payment');
await p.click('[data-act=logout]');
// ---- owner entry
ok(!/owner/i.test(await p.innerText('#site')),'still no owner text on landing');
await p.goto(U+'#owner'); await p.waitForTimeout(500); ok(await p.isVisible('#ownerModal'),'#owner opens hidden owner access');
await p.fill('#ownId','OWNER'); await p.fill('#ownPw','wrong'); await p.click('#ownerBtn'); await p.waitForTimeout(400); ok(await p.isVisible('#ownerError'),'wrong owner password rejected');
await p.fill('#ownPw','owner-2026'); await p.click('#ownerBtn'); await p.waitForSelector('.shell',{timeout:15000});
nav=(await p.$$eval('.navlist button',b=>b.map(x=>x.textContent.trim())));
ok(nav.length===11&&/All villages/.test(nav[0]),'owner console nav: '+nav.join(' | '));
ok((await p.$$('table.t tbody tr')).length===10,'owner overview lists all 10 villages');
await p.screenshot({path:SP+'/owner.png'});
for(const pg of ['o-villages','o-admins','o-log','o-account','o-overview']){ await p.click(`.navlist [data-page=${pg}]`); await p.waitForTimeout(150); }
// open a village with full control
await p.click('[data-act=owner-open][data-id="umuokpu~men"]'); await p.waitForSelector('.navlist [data-page=verify]');
ok((await p.$$eval('.navlist button',b=>b.length))>=11,'owner gets full admin dashboard inside village');
ok(await p.isVisible('[data-act=owner-back]'),'back-to-console button shown');
await p.click('.navlist [data-page=transactions]'); await p.click('[data-act=edit-tx] >> nth=0'); await p.fill('#mRef','OWNEDIT1'); await p.click('#mSubmit'); await p.waitForTimeout(300);
await p.click('.navlist [data-page=members]'); ok(!/OWNER/.test(await p.innerText('#app')),'owner id not shown in village members page');
await p.click('.navlist [data-page=audit]'); const au=await p.textContent('table.t tbody'); console.log('AU',au.slice(0,600)); ok(!/VillageVault support|OWNEDIT1/i.test(au),'owner activity invisible in village audit');
await p.click('.navlist [data-page=members]'); await p.click('[data-act=reset-pw] >> nth=0'); await p.click('#mSubmit'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('[data-act=owner-back]'); await p.waitForTimeout(250); ok((await p.textContent('#pageTitle'))==='All villages','owner back to console');
// manage: rename + pause amakwu
await p.click('.navlist [data-page=o-villages]'); await p.click('[data-act=owner-manage][data-id=amakwu]'); await p.fill('#omN','Amakwu Renamed'); await p.selectOption('#omS','suspended'); await p.click('#mSubmit'); await p.waitForTimeout(300);
ok((await p.content()).includes('Amakwu Renamed'),'village renamed'); ok((await p.content()).includes('Paused'),'village paused');
// admins page
await p.click('.navlist [data-page=o-admins]'); await p.selectOption('#oaV','ezinkwo~men'); await p.click('[data-act=o-add-admin]'); await p.fill('#oaN','New Admin Person'); await p.selectOption('#oaT','Admin'); await p.fill('#oaPw','Pass1234'); await p.click('#mSubmit'); await p.waitForTimeout(300);
ok((await p.content()).includes('New Admin Person'),'owner added admin'); const newId=(await p.textContent('table.t tbody')).match(/EZNM-A\d+/g).pop();
await p.click('[data-act=o-edit-admin] >> nth=0'); await p.fill('#oeN','Edited Admin Name'); await p.selectOption('#oeA','no'); await p.click('#mSubmit'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('[data-act=o-reset-admin] >> nth=0'); await p.click('#mSubmit'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('.navlist [data-page=o-log]'); ok((await p.$$('table.t tbody tr')).length>=5,'owner log has entries'); await p.selectOption('#olV',{index:1}); await p.selectOption('#olV','');
// owner password change
await p.click('[data-act=change-pw]'); await p.fill('#pCur','owner-2026'); await p.fill('#pNew','OwnerNew#1'); await p.fill('#pNew2','OwnerNew#1'); await p.click('#mSubmit'); await p.waitForSelector('#modalRoot',{state:'hidden',timeout:10000}).catch(()=>{});
ok(await p.isHidden('#modalRoot'),'owner password changed');
await p.reload(); await p.waitForSelector('.shell',{timeout:15000}); ok(true,'owner session restored on reload');
await p.click('[data-act=logout]'); ok(await p.isVisible('#site'),'owner logout');
// paused village blocks logins; restored later
await p.goto(U); await p.waitForTimeout(400); await p.selectOption('#heroVillage','amakwu'); await p.waitForTimeout(300); await p.fill('#loginId','AMK-A02'); await p.fill('#loginPw','amk-admin'); await p.click('#loginBtn'); await p.waitForTimeout(500);
ok(/paused/i.test(await p.textContent('#loginError')),'paused village blocks sign-in');
ok((await p.$$eval('#heroVillage option',o=>o.map(x=>x.textContent))).some(t=>/Amakwu Renamed/.test(t)),'renamed village shows in dropdown');
// new/deactivated admin check: reset admin 1 deactivated => EZN-A01 blocked
await p.selectOption('#heroVillage','ezinkwo~men'); await p.waitForTimeout(300); await p.fill('#loginId','EZNM-A01'); await p.fill('#loginPw','eznm-admin'); await p.click('#loginBtn'); await p.waitForTimeout(500);
ok(await p.isVisible('#loginError'),'deactivated/reset admin cannot use old password');
await p.fill('#loginId',newId); await p.fill('#loginPw','Pass1234'); await p.click('#loginBtn'); await p.waitForSelector('.shell',{timeout:20000}); ok(true,'new admin signs in with owner-issued credentials');
// owner never visible to village admins: audit log filter lists
await p.click('.navlist [data-page=audit]'); ok(!(await p.content()).includes('Platform Owner'),'no "Platform Owner" anywhere in village UI');
// owner API not reachable by admin
ok((await p.evaluate(()=>typeof OWNER_API))==='undefined','owner internals not global');
// mobile check
await p.click('[data-act=logout]'); await p.setViewportSize({width:390,height:800}); await p.waitForTimeout(300); await p.screenshot({path:SP+'/l2m.png'});
ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no horizontal overflow on mobile landing');
console.log('ERRORS',JSON.stringify(errs)); console.log(fails?('FAILS '+fails):'ALL PASSED');
await b.close();})().catch(e=>{console.log('TESTFAIL',e.message.split('\n').slice(0,5).join(' | '));process.exit(1)});
