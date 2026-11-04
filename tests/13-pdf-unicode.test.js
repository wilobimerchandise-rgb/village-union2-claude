const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'));const errs=[];
const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));
await A.goto(U);await A.selectOption('#heroVillage','umuokpu');await A.fill('#loginId','UMK-A02');await A.fill('#loginPw','umk-admin');await A.click('#loginBtn');await A.waitForSelector('.shell');
// give a member an Igbo name with diacritics, directly in stored data
await A.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vv_v1_umuokpu'));v.users.filter(u=>u.role==='member').forEach((m,i)=>{if(i%2==0)m.name='Ọbịọma Nwọkọ Ṅdị '+i});localStorage.setItem('vv_v1_umuokpu',JSON.stringify(v));});
await A.reload();await A.waitForTimeout(500);
if(!(await A.$('.shell'))){await A.selectOption('#heroVillage','umuokpu');await A.fill('#loginId','UMK-A02');await A.fill('#loginPw','umk-admin');await A.click('#loginBtn');await A.waitForSelector('.shell');}
await A.click('.navlist [data-page=outstanding]');await A.waitForTimeout(300);
const t0=Date.now();const [d]=await Promise.all([A.waitForEvent('download'),A.click('[data-act=notice-all]')]);console.log('notice-all ms',Date.now()-t0);
const f='scratch-notice.pdf';await d.saveAs(f);const buf=fs.readFileSync(f);ok(buf.slice(0,5).toString()==='%PDF-','pdf ok');ok(buf.toString('latin1').includes('/ImageMask true'),'raster mask used for diacritics');
await A.click('.navlist [data-page=reports]');await A.waitForTimeout(300);
const [d2]=await Promise.all([A.waitForEvent('download'),A.click('[data-act=dl-report] >> nth=0')]);await d2.saveAs('scratch-report.pdf');
console.log('ERRORS',JSON.stringify(errs));await b.close()})().catch(e=>{console.log('FATAL',e.message.slice(0,400));process.exit(1)});
