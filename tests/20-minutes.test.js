const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const ctx=await b.newContext({viewport:{width:1360,height:900},acceptDownloads:true,permissions:['microphone']});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL||'http://localhost:8765/index.html';const errs=[];
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const fresh=async()=>{await p.goto(U);await p.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await p.goto(U);};
const login=async(v,id,pw)=>{await fresh();await p.selectOption('#heroVillage',v);await p.waitForTimeout(200);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(900);return !!(await p.$('.shell'));};
const nav=async()=>(await p.$$eval('.navlist [data-page]',e=>e.map(x=>x.dataset.page))).join(',');
const go=async pg=>{await p.click(`.navlist [data-page=${pg}]`);await p.waitForTimeout(300);};
const rec=id=>p.evaluate(i=>JSON.parse(localStorage.getItem('vv_v1_'+i)),id);
// setup: A03 becomes Secretary; both A01 and A03 get a signature
await login('umuokpu','UMK-A03','umk-admin');
await p.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,300,120);g.strokeStyle='#000';g.beginPath();g.moveTo(10,90);g.bezierCurveTo(80,0,160,150,290,30);g.stroke();const sig=c.toDataURL('image/jpeg',.9);const v=JSON.parse(localStorage.getItem('vv_v1_umuokpu'));v.users.forEach(u=>{if(u.id==='UMK-A03')u.title='Secretary';if(u.id==='UMK-A03'||u.id==='UMK-A01')u.signature=sig;});localStorage.setItem('vv_v1_umuokpu',JSON.stringify(v));});
// 1 secretary writes
ok(await login('umuokpu','UMK-A03','umk-admin'),'Secretary signs in');
ok((await nav()).includes('minutes'),'admin menu has Minutes');
await go('minutes');
ok(/Write minutes/.test(await p.textContent('#view')),'Secretary sees Write minutes');
const write=async(title,typeName)=>{await p.click('[data-act=min-new]');await p.waitForSelector('#mnTi');if(typeName){const v=await p.$$eval('#mnT option',o=>o.map(x=>[x.value,x.textContent]));const f=v.find(x=>x[1].startsWith(typeName));await p.selectOption('#mnT',f[0]);}
 await p.fill('#mnTi',title);await p.fill('#mnV','Village hall');await p.fill('#mnAg','Opening\nDues review');await p.fill('#mnDi','The dues were reviewed and the roof repair was discussed at length.');await p.fill('#mnR','Roof repair approved\nDues stay at the same level');await p.fill('#mnAc','Collect quotes, Treasurer, 30 Nov');await p.click('#mSubmit');await p.waitForTimeout(500);};
await write('General meeting, October','General meeting');
ok(/Draft/.test(await p.textContent('#modalRoot')),'draft saved and opened');
ok(!(await p.$('[data-act=min-approve]')),'Secretary has no Approve button');
// audio by file
await p.click('[data-act=min-audio]');await p.waitForSelector('#mnF');
await p.setInputFiles('#mnF',{name:'a.webm',mimeType:'audio/webm',buffer:Buffer.from('1A45DFA3'.repeat(40),'hex')});
await p.click('#mSubmit');await p.waitForTimeout(500);ok(/Confirm that everyone/.test(await p.textContent('#mError')||''),'audio needs the recording consent');
await p.check('input[name=consent]');await p.click('#mSubmit');await p.waitForTimeout(600);
let r=await rec('umuokpu');ok(r.minutes.length===1&&r.minutes[0].audio&&r.minutes[0].audio.size>0,'audio attached');
await p.click('[data-act=min-view]');await p.waitForTimeout(500);ok(!!(await p.$('#minAudio audio')),'audio plays in the minutes');
await p.click('[data-act=min-submit]');await p.waitForTimeout(400);r=await rec('umuokpu');ok(r.minutes[0].status==='submitted','submitted to the Chairman');
// executive minutes
await write('Elders closed session','Executive');
await p.click('[data-act=min-submit]');await p.waitForTimeout(400);
// third, to be returned
await write('Emergency note','Emergency');await p.click('[data-act=min-submit]');await p.waitForTimeout(400);
// 2 Chairman
ok(await login('umuokpu','UMK-A01','umk-admin'),'Chairman signs in');await go('minutes');
ok(!/Write minutes/.test(await p.textContent('#view')),'Chairman cannot write');
const openRow=async n=>{const btns=await p.$$('#view [data-act=min-view]');await btns[n].click();await p.waitForTimeout(400);};
const rows=await p.$$eval('#view tbody tr',t=>t.map(x=>x.textContent));ok(rows.length===3,'Chairman sees all 3 drafts/submitted');
// find the General meeting row
let idx=rows.findIndex(x=>/General meeting, October/.test(x));await openRow(idx);
ok(!(await p.$('[data-act=min-edit]')),'Chairman cannot edit');
await p.click('[data-act=min-approve]');await p.waitForSelector('#mSubmit');await p.click('#mSubmit');await p.waitForTimeout(500);
r=await rec('umuokpu');const gm=r.minutes.find(m=>m.title==='General meeting, October');
ok(gm.status==='approved'&&/^MIN\/UMK\/\d{4}\/0001$/.test(gm.no),'approved with number '+gm.no);
ok(gm.sigs&&gm.sigs.chair.img&&gm.sigs.sec.img&&gm.sigs.sec.name===gm.writtenBy,'both signatures stored on the minutes');
// executive approve
let rows2=await p.$$eval('#view tbody tr',t=>t.map(x=>x.textContent));idx=rows2.findIndex(x=>/Elders closed/.test(x));await openRow(idx);await p.click('[data-act=min-approve]');await p.waitForSelector('#mSubmit');await p.click('#mSubmit');await p.waitForTimeout(400);
// return third
rows2=await p.$$eval('#view tbody tr',t=>t.map(x=>x.textContent));idx=rows2.findIndex(x=>/Emergency note/.test(x));await openRow(idx);await p.click('[data-act=min-reject]');await p.waitForSelector('#mrR');
await p.fill('#mrR','abc');await p.click('#mSubmit');await p.waitForTimeout(300);ok(/Say what must be corrected/.test(await p.textContent('#mError')),'return needs a real reason');
await p.fill('#mrR','Add who proposed the resolution');await p.click('#mSubmit');await p.waitForTimeout(400);
// PDF download
rows2=await p.$$eval('#view tbody tr',t=>t.map(x=>x.textContent));idx=rows2.findIndex(x=>/General meeting, October/.test(x));await openRow(idx);
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=min-pdf]')]);const path=await dl.path();const buf=require('fs').readFileSync(path);
ok(buf.slice(0,5).toString()==='%PDF-'&&buf.length>2500&&/MINUTES OF MEETING|Page 1 of 1/.test(buf.toString('latin1')),'PDF downloads ('+buf.length+' bytes)');
ok((buf.toString('latin1').match(/\/Subtype \/Image/g)||[]).length>=2,'PDF carries both signature images');
// 3 secretary sees return reason, edits
ok(await login('umuokpu','UMK-A03','umk-admin'),'Secretary signs in again');await go('minutes');
rows2=await p.$$eval('#view tbody tr',t=>t.map(x=>x.textContent));idx=rows2.findIndex(x=>/Emergency note/.test(x));await openRow(idx);
ok(/Add who proposed/.test(await p.textContent('#modalRoot')),'Secretary sees the Chairman’s reason');
await p.click('[data-act=min-edit]');await p.waitForSelector('#mnTi');await p.fill('#mnR','Roof repair approved, proposed by Mr A');await p.click('#mSubmit');await p.waitForTimeout(500);
r=await rec('umuokpu');ok(r.minutes.find(m=>m.title==='Emergency note').status==='draft','edited and back to draft');
// approved cannot be edited
await p.keyboard.press('Escape');await p.waitForTimeout(200);await p.evaluate(()=>{const m=document.getElementById('modalRoot');m.hidden=true;m.innerHTML='';});
rows2=await p.$$eval('#view tbody tr',t=>t.map(x=>x.textContent));idx=rows2.findIndex(x=>/General meeting, October/.test(x));await openRow(idx);
ok(!(await p.$('[data-act=min-edit]'))&&!(await p.$('[data-act=min-del]')),'approved minutes cannot be edited or deleted');
// 4 members
ok(await login('umuokpu','UMK-M001','umk-member'),'member signs in');ok((await nav()).includes('minutes'),'Premium member has Minutes');await go('minutes');
const mrows=await p.$$eval('#view tbody tr',t=>t.map(x=>x.textContent));
ok(mrows.length===1&&/General meeting, October/.test(mrows[0]),'member sees only the approved general minutes');
ok(!/Elders closed|Emergency note/.test(await p.textContent('#view')),'executive and draft minutes are hidden from members');
ok(!(await p.$('[data-act=min-new]'))&&!(await p.$('[data-act=min-csv]')),'member has no write or list-export buttons');
await p.click('[data-act=min-view]');await p.waitForTimeout(400);ok(!!(await p.$('[data-act=min-pdf]')),'member can download approved minutes');
// 5 Lead admin edits meeting types
ok(await login('umuokpu','UMK-A01','umk-admin'),'Lead Admin signs in');await go('minutes');ok(!!(await p.$('[data-act=min-types]')),'Lead Admin sees Meeting types');
await p.click('[data-act=min-types]');await p.waitForSelector('#mtRows');await p.click('[data-act=mt-add]');const names=await p.$$('#mtRows .mt-name');await names[names.length-1].fill('Youth wing meeting');await p.click('#mSubmit');await p.waitForTimeout(400);
r=await rec('umuokpu');ok(r.meetingTypes.some(t=>t.name==='Youth wing meeting'&&!t.removed),'new meeting type saved');
ok(await login('umuokpu','UMK-A02','umk-admin'),'Financial Secretary signs in');await go('minutes');ok(!(await p.$('[data-act=min-types]')),'only the Lead Admin edits types');
ok(!/Write minutes/.test(await p.textContent('#view')),'Financial Secretary cannot write minutes');
// 6 Basic plan (Umuchima)
ok(await login('umuchima','UMC-M001','umc-member'),'Basic member signs in');ok(!(await nav()).includes('minutes'),'Basic member has no Minutes menu');
ok(await login('umuchima','UMC-A01','umc-admin'),'Basic admin signs in');ok((await nav()).includes('minutes'),'Basic admin sees Minutes menu');await go('minutes');
ok(/part of the Premium plan/.test(await p.textContent('#view'))&&!(await p.$('[data-act=min-new]')),'Basic admin gets the upgrade note, no write button');
// tamper: Basic village record edited by hand to hold minutes still cannot be written
// 7 wing inherits Premium and has its own minutes
ok(await login('umuokpu~men','UMKM-A03','umkm-admin'),'Men’s wing admin signs in');await go('minutes');
ok(/Meeting minutes/.test(await p.textContent('#view'))&&!/General meeting, October/.test(await p.textContent('#view')),'wing has its own empty minutes list (Premium inherited)');
// 8 meeting types drive the attendance register
ok(await login('umuokpu','UMK-A02','umk-admin'),'Financial Secretary signs in for registers');await go('register');
await p.click('[data-act=mtg-open]');await p.waitForSelector('#mtK');
const kopts=await p.$$eval('#mtK option',o=>o.map(x=>[x.value,x.textContent]));ok(kopts.length>=6&&/Youth wing meeting/.test(kopts.map(x=>x[1]).join('|')),'register uses the same meeting types (incl. the new one) plus Other');
ok(await p.inputValue('#mtT')==='General meeting','name box starts with the first type');
const ex=kopts.find(x=>/Executive/.test(x[1]));await p.selectOption('#mtK',ex[0]);ok(await p.inputValue('#mtT')==='Executive and elders meeting','choosing a type fills the name');
await p.click('#mSubmit');await p.waitForTimeout(500);
r=await rec('umuokpu');const rg=r.meetings.find(m=>m.status==='open');ok(rg&&rg.exec===true&&rg.typeId===ex[0],'register stored with the executive type');
const seeded=r.meetings.find(m=>/Executive and elders/.test(m.title)&&m.status==='closed');ok(seeded&&seeded.exec===true,'older executive meeting was tagged by its name');
// member cannot see executive registers
ok(await login('umuokpu','UMK-M001','umk-member'),'member signs in for registers');
let mt=await p.textContent('#view');ok(!/Executive and elders/.test(mt),'member does not see executive registers (open or history)');
// other meeting type: member sees it
ok(await login('umuokpu','UMK-A02','umk-admin'),'Financial Secretary again');await go('register');
const reg0=await p.$('[data-act=mtg-close]');await reg0.click();await p.waitForSelector('#mSubmit');await p.click('#mSubmit');await p.waitForTimeout(400);
await p.click('[data-act=mtg-open]');await p.waitForSelector('#mtK');await p.click('#mSubmit');await p.waitForTimeout(500);
ok(await login('umuokpu','UMK-M001','umk-member'),'member again');mt=await p.textContent('#view');ok(/The register is open: General meeting/.test(mt),'member sees a normal register');
// Secretary picks the executive register in minutes: type locks and minutes become admin-only
ok(await login('umuokpu','UMK-A03','umk-admin'),'Secretary for register link');await go('minutes');
await p.click('[data-act=min-new]');await p.waitForSelector('#mnM');
const mopts=await p.$$eval('#mnM option',o=>o.map(x=>[x.value,x.textContent]));const exm=mopts.find(x=>/Executive and elders/.test(x[1]));
await p.selectOption('#mnM',exm[0]);ok(await p.$eval('#mnT',e=>e.disabled)&&/Executive/.test(await p.$eval('#mnT',e=>e.selectedOptions[0].textContent)),'minutes type follows the register and locks');
await p.fill('#mnTi','Executive linked minutes');await p.fill('#mnDi','Closed door.');await p.click('#mSubmit');await p.waitForTimeout(500);
r=await rec('umuokpu');const lm=r.minutes.find(m=>m.title==='Executive linked minutes');ok(lm&&lm.adminOnly===true&&lm.meetingId===exm[0]&&lm.typeName==='Executive and elders meeting','linked minutes are admin-only with the register\'s type');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');
await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
