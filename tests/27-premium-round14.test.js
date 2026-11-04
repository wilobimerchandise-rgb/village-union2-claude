const { chromium } = require('playwright'); const fs = require('fs');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900},acceptDownloads:true});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL;const errs=[];const OUT=process.env.OUT||'/tmp';
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
const login=async(v,id,pw)=>{await p.goto(U);await p.evaluate(()=>sessionStorage.clear());await p.goto(U);await p.waitForTimeout(250);await p.selectOption('#heroVillage',v);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(800);};
const go=async pg=>{await p.waitForTimeout(1500);if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(300);}await p.click(`.navlist [data-page=${pg}]`);await p.waitForTimeout(300);};
const dl=async(sel,name)=>{await p.waitForTimeout(700);if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(300);}const [d]=await Promise.all([p.waitForEvent('download').catch(async e=>{console.log('TOAST',await p.textContent('#toasts'),'MODAL',(await p.textContent('#modalRoot')).slice(0,200),errs.join('|'));throw e}),p.click(sel)]);const f=`${OUT}/${name}`;await d.saveAs(f);await p.waitForTimeout(500);if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(250);}return fs.readFileSync(f);};
const pdfOk=b=>b.slice(0,5).toString()==='%PDF-'&&b.includes('%%EOF');
// ---- Basic village: every new page is locked behind the Premium badge
await login('umuchima~men','UMCM-A02','umcm-admin');
for(const pg of ['terms','agendas','emergency','projects','standing','celebrations']){await go(pg);ok(await p.$('#view .prem-badge')!==null,'Basic: '+pg+' shows the Premium badge');}
await p.click('#view .prem-badge');await p.waitForTimeout(250);ok(/Upgrade to Premium/.test(await p.textContent('#modalRoot')),'Basic: badge opens the upgrade dialog');await p.keyboard.press('Escape');
// ---- Premium village, Chairman
await login('umuokpu~men','UMKM-A01','umkm-admin');
// good standing certificate: find a member who is paid up
await go('standing');const opts=await p.$$eval('#cm option',o=>o.map(x=>x.value));let got=false;
for(const id of opts){await p.selectOption('#cm',id);await p.waitForTimeout(200);if(await p.$('[data-act=cert-get][data-fmt=png]')){const png=await dl('[data-act=cert-get][data-fmt=png]','cert.png');fs.copyFileSync(`${OUT}/cert.png`,`${OUT}/cert-keep.png`);ok(png.slice(1,4).toString()==='PNG'&&png.length>20000,'certificate PNG created '+png.length);const pd=await dl('[data-act=cert-get][data-fmt=pdf]','cert.pdf');ok(pdfOk(pd),'certificate PDF is valid');got=true;break;}}
ok(got,'at least one member could get a certificate (the others owe, now including the emergency levy)');
if(got){ok(/GS-UMKM-\d{4}-0001/.test(await p.textContent('#view')),'certificate is numbered and listed');const no=(await p.textContent('#view')).match(/GS-UMKM-\d{4}-0001/)[0];await p.fill('#cvN',no);await p.click('[data-act=cert-verify]');await p.waitForTimeout(250);ok(/Valid/.test(await p.textContent('#modalRoot')),'certificate check says Valid');await p.keyboard.press('Escape');}
// term of office
await go('terms');ok(/Terms of office/.test(await p.textContent('#view')),'terms page opens');
await p.click('tr:has-text("UMKM-A02") [data-act=set-term]');const soon=new Date(Date.now()+30*864e5).toISOString().slice(0,10);await p.fill('#tmE',soon);await p.click('#mSubmit');await p.waitForTimeout(300);
ok(/Ends in 30 days/.test(await p.textContent('#view')),'term shows days left');
const hb=await dl('[data-act=handover-pdf]','handover.pdf');ok(pdfOk(hb),'handover pack PDF is valid '+hb.length);
await go('overview');ok(/Terms of office need attention|term of office is ending/.test(await p.textContent('#view')),'overview warns about the ending term');
// agenda
await go('agendas');await p.click('[data-act=new-agenda]');await p.fill('#agT','Monthly general meeting');await p.fill('#agI','Opening prayer | Chaplain | 5\nFinancial report | Financial Secretary | 15\nAny other business | Chairman | 10');await p.click('#mSubmit');await p.waitForTimeout(300);
ok(/Monthly general meeting/.test(await p.textContent('#view'))&&/Draft/.test(await p.textContent('#view')),'agenda saved as a draft');
await p.click('[data-act=pub-agenda]');await p.waitForTimeout(300);ok(/Published/.test(await p.textContent('#view')),'agenda published');
const ag=await dl('[data-act=agenda-pdf]','agenda.pdf');ok(pdfOk(ag),'agenda PDF is valid');
// emergency
await go('emergency');await p.click('[data-act=emg-new]');await p.fill('#emN','Burial support: late Mr Test');await p.fill('#emR','Sudden loss in the village');await p.fill('#emA','5000');await p.click('#mSubmit');await p.waitForTimeout(400);
ok(/Burial support: late Mr Test/.test(await p.textContent('#view'))&&/0 of/.test(await p.textContent('#view')),'emergency levy opened with progress');
// projects
await go('projects');await p.click('[data-act=prj-new]');await p.fill('#pjN','Community borehole');await p.fill('#pjD','Clean water for the village square');await p.fill('#pjT','500000');await p.click('#mSubmit');await p.waitForTimeout(400);
ok(/Community borehole/.test(await p.textContent('#view'))&&/0% funded/.test(await p.textContent('#view')),'project started at 0%');
await p.click('[data-act=prj-update]');await p.fill('#puT','Site survey done');await p.click('#mSubmit');await p.waitForTimeout(300);ok(/Site survey done/.test(await p.textContent('#view')),'project update posted');
const pj=await dl('[data-act=prj-pdf]','project.pdf');ok(pdfOk(pj),'project report PDF is valid');
// birthdays
await go('celebrations');await p.click('[data-act=dates-edit]');const t=new Date();await p.selectOption('#bdM',String(t.getMonth()+1).padStart(2,'0'));await p.selectOption('#bdD',String(t.getDate()).padStart(2,'0'));await p.click('#mSubmit');await p.waitForTimeout(300);
ok(/Today/.test(await p.textContent('#view')),'birthday today is listed');await go('overview');ok(/Celebrating today/.test(await p.textContent('#view')),'overview shows the celebrations banner');
// emergency shows on member side
// AGM
await go('reports');const agm=await dl('[data-act=agm-pdf]','agm.pdf');ok(pdfOk(agm)&&agm.length>8000,'AGM report PDF is valid '+agm.length);
// ---- Member side
await login('umuokpu~men','UMKM-M001','umkm-member');
ok(/Emergency levy: Burial support/.test(await p.textContent('#view')),'member sees the emergency levy on the dashboard');
await go('agendas');ok(/Monthly general meeting/.test(await p.textContent('#view')),'member reads the published agenda');
await go('projects');ok(/Community borehole/.test(await p.textContent('#view')),'member sees the project');
await go('reports');await p.selectOption('#rScope','village');await p.waitForTimeout(300);const mv=await dl('[data-act=dl-current]','memberreport.pdf');ok(pdfOk(mv),'member downloads the village report (Premium)');
await go('celebrations');ok(/Celebrating today|Today/.test(await p.textContent('#view')),'member sees who is celebrating');ok(!(await p.$('a[href*="wa.me"]')),'members get no WhatsApp numbers');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
