const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}});await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)}); await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'));const errs=[];
const mk=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));return p};
const login=async(pg,v,id,pw)=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');await pg.waitForSelector('.shell');};
const A=await mk();await login(A,'umuokpu','UMK-A01','umk-admin');
ok(/Back up your records/.test(await A.textContent('#view')),'lead admin sees backup reminder');
const A2=await mk();await login(A2,'umuokpu','UMK-A02','umk-admin');ok(!/Back up your records/.test(await A2.textContent('#view')),'other admin: no reminder');await A2.click('.navlist [data-page=profile]');await A2.waitForTimeout(250);ok(!(await A2.$('#backup')),'other admin: no backup panel');
await A.click('.navlist [data-page=profile]');await A.waitForTimeout(400);ok(!!(await A.$('#backup')),'backup panel for lead');
const [d]=await Promise.all([A.waitForEvent('download'),A.click('[data-act=backup-dl][data-p="0"]')]);await d.saveAs('bk.json');const bk=JSON.parse(fs.readFileSync('bk.json','utf8'));ok(bk.kind==='villagevault-backup'&&bk.village.id==='umuokpu'&&bk.village.users.length>10,'backup file content');
await A.waitForTimeout(400);ok(/Up to date/.test(await A.textContent('#backup')),'status becomes up to date');
// change data after backup: add a pending note by renaming a member in storage via UI add-member
const before=await A.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).users.length);
await A.click('.navlist [data-page=members]');await A.waitForTimeout(250);await A.click('[data-act=add-member]');await A.waitForSelector('#amN');await A.fill('#amN','Temp Person');await A.fill('#amP','08031112222');await A.selectOption('#amF',{index:1}).catch(()=>{});await A.selectOption('#amK',{index:1}).catch(()=>{});await A.fill('#amPw','Temp1234').catch(()=>{});await A.click('#mSubmit');await A.waitForTimeout(500);
const mid=await A.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).users.length);console.log('users',before,'->',mid, (await A.textContent('#modalRoot')).replace(/\s+/g,' ').slice(0,200)); await A.keyboard.press('Escape');
// wrong-village file
const other=JSON.parse(JSON.stringify(bk));other.village.id='amakwu';fs.writeFileSync('bk-other.json',JSON.stringify(other));
fs.writeFileSync('bk-bad.json','not json');
await A.click('.navlist [data-page=profile]');await A.waitForTimeout(300);
const restore=async(file,conf)=>{await A.click('[data-act=backup-restore]');await A.waitForSelector('#bkF');await A.setInputFiles('#bkF',file);await A.fill('#bkC',conf);await A.click('#mSubmit');await A.waitForTimeout(700);return A.evaluate(()=>{const e=document.querySelector('#mError');return e&&!e.hidden?e.textContent:''})};
ok(/RESTORE in capital/.test(await restore('bk.json','no')),'needs typed confirmation');await A.keyboard.press('Escape');
ok(/belongs to/.test(await restore('bk-other.json','RESTORE')),'wrong village rejected');await A.keyboard.press('Escape');
ok(/not a valid backup/.test(await restore('bk-bad.json','RESTORE')),'garbage rejected');await A.keyboard.press('Escape');
const e=await restore('bk.json','RESTORE');ok(e==='','restore accepted '+e);await A.waitForTimeout(500);
const after=await A.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).users.length);ok(after===before,'records back to backup state ('+after+')');
ok(await A.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu')).audit.some(a=>a.action==='Restored backup')),'restore recorded in audit log');
await A.waitForTimeout(500);await A.click('.navlist [data-page=profile]');await A.waitForTimeout(500);ok(/Before restore/.test(await A.textContent('#backup')),'pre-restore snapshot listed (Premium)');
// snapshot restore
await A.click('[data-act=snap-restore] >> nth=0');await A.waitForSelector('#mSubmit');await A.click('#mSubmit');await A.waitForTimeout(700);ok(/Snapshot restored|Before restore/.test(await A.textContent('body')),'snapshot restore runs');
// basic village: no snapshots, manual works
const B=await mk();await login(B,'umuchima','UMC-A01','umc-admin');await B.click('.navlist [data-page=profile]');await B.waitForTimeout(300);ok(/Premium/.test(await B.textContent('#backup'))&&!!(await B.$('[data-act=backup-dl]')),'basic: manual backup yes, snapshots Premium');
// owner export
const O=await mk();await O.goto(U+'#owner');await O.waitForTimeout(500);await O.fill('#ownId','OWNER');await O.fill('#ownPw','owner-2026');await O.click('#ownerBtn');await O.waitForSelector('.shell');await O.click('.navlist [data-page=o-account]');await O.waitForTimeout(250);
const [d2]=await Promise.all([O.waitForEvent('download'),O.click('[data-act=o-export][data-p="0"]')]);await d2.saveAs('plat.json');const pl=JSON.parse(fs.readFileSync('plat.json','utf8'));ok(pl.villages.length>=10&&!pl.owner.hash,'platform export: villages '+pl.villages.length+', no owner hash');
console.log('ERRORS',JSON.stringify(errs));await b.close()})().catch(e=>{console.log('FATAL',e.message.slice(0,500));process.exit(1)});
