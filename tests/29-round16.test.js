const { chromium } = require('playwright'); const fs = require('fs');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900},acceptDownloads:true});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
await ctx.addInitScript(()=>{window.__shared=[];try{navigator.canShare=d=>!!(d&&d.files&&d.files.length);navigator.share=async d=>{window.__shared.push((d.files||[]).map(f=>[f.name,f.type,f.size]));};}catch(e){}});
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL;const errs=[];const OUT=process.env.OUT||'/tmp';
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
const login=async(v,id,pw)=>{await p.goto(U);await p.evaluate(()=>sessionStorage.clear());await p.goto(U);await p.waitForTimeout(250);await p.selectOption('#heroVillage',v);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(900);};
const esc=async()=>{if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(300);}};
const go=async pg=>{await p.waitForTimeout(1200);await esc();await p.click(`.navlist [data-page=${pg}]`);await p.waitForTimeout(350);};
const txt=async s=>await p.textContent(s);
// ---- Basic village, Lead Admin
await login('umuchima~men','UMCM-A01','umcm-admin');
ok(/Try Premium free for 30 days/.test(await txt('#view')),'Basic Lead Admin is offered the trial on the overview');
await go('notices');ok(await p.$('#view .sample-lock')!==null&&/Sample preview/.test(await txt('#view')),'locked page shows a sample preview');
await go('review');ok(await p.$('#view .sample-lock')!==null,'year in review is locked with a sample on Basic');
await go('members');ok(/Import from a list/.test(await txt('#view')),'import button is on the members page');
console.log('members page nudge:',((await txt('#view')).match(/Only \d+ member place[s]? left|reached the Basic plan limit/)||['none'])[0]);
await p.click('[data-act=im-open]');await p.waitForTimeout(300);ok(/Premium/.test(await txt('#modalRoot'))&&/Try Premium free/.test(await txt('#modalRoot')),'Basic import opens the upgrade box with the trial button');await esc();
await go('support');ok(/Standard queue|standard queue/.test(await txt('#view')),'Basic help desk is the standard queue');
// ---- start the trial
await go('overview');await p.click('#view [data-act=trial-start]');await p.waitForTimeout(250);ok(/30 days/.test(await txt('#modalRoot')),'trial dialog explains what happens');await p.click('#mSubmit');await p.waitForTimeout(500);
await go('overview');ok(/Premium trial: 30 days left/.test(await txt('#view')),'overview shows 30 days left');
await go('notices');ok(await p.$('#view .sample-lock')===null&&/Notice board/.test(await txt('#view')),'Premium pages are open during the trial');
await go('plans');ok(/is on Premium/.test(await txt('#view'))&&(await p.$$('#view table.plan-table tbody tr')).length===27,'Plans page: Premium, 27 rows');
// ---- bulk import
await go('members');await p.click('[data-act=im-open]');await p.waitForTimeout(300);
await p.fill('#imT','Name,Phone,Family,Kindred,Email\nChinedu Importa,08031112221,Importa,Umuagu,\nNgozi Importa,08031112222,Importa,Umuagu,ngo@example.com\nBad Phone,123,,,\nXy,08031112223,,,\nDupe Row,08031112221,,,');
await p.click('#mSubmit');await p.waitForTimeout(500);const s2=await txt('#modalRoot');ok(/2 ready, 3 with a problem/.test(s2),'import check: 2 ready, 3 problems: '+(s2.match(/\d+ ready, \d+ with a problem/)||[''])[0]);ok(/Same phone as a row above|Phone number looks wrong/.test(s2),'problems are explained');
await p.click('#mSubmit');await p.waitForTimeout(900);ok(/Import finished/.test(await txt('#modalRoot'))&&/2 members added/.test(await txt('#modalRoot')),'import finished');
const [d]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=im-sheet]')]);const csv=fs.readFileSync(await d.path(),'utf8');ok(/Chinedu Importa/.test(csv)&&/Vv\d{6}/.test(csv),'login sheet has names and temporary passwords');await esc();
await go('members');await p.fill('#fq','Importa');await p.waitForTimeout(600);ok(/Chinedu Importa/.test(await txt('#view'))&&/Ngozi Importa/.test(await txt('#view')),'imported members are on the register');
// ---- year in review
await go('review');ok(/in review/.test(await txt('#view'))&&await p.$('#view .mbars')!==null,'year in review shows the month bars');
const [d2]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=rv-pdf]')]);const pb=fs.readFileSync(await d2.path());ok(pb.slice(0,5).toString()==='%PDF-'&&pb.includes('%%EOF'),'year in review PDF is valid '+pb.length);await esc();
await p.waitForTimeout(600);await p.click('[data-act=rv-share]');await p.waitForTimeout(900);const sh=await p.evaluate(()=>window.__shared);ok(sh.length===1&&sh[0][0][1]==='application/pdf','year in review shared as a PDF');
// ---- support ticket (priority during trial)
await go('support');ok(/Priority support is on/.test(await txt('#view')),'trial village sees priority support');
await p.click('[data-act=tk-new]');await p.fill('#tkM','We cannot verify a payment proof on the Financial Secretary side.');await p.click('#mSubmit');await p.waitForTimeout(500);ok(/Priority/.test(await txt('#view'))&&/cannot verify/.test(await txt('#view')),'support request is listed as Priority');
const O=await ctx.newPage();O.on('pageerror',e=>errs.push(e.message));O.setDefaultTimeout(8000);
await O.goto(U+'#owner');await O.waitForTimeout(400);await O.fill('#ownId','OWNER');await O.fill('#ownPw','owner-2026');await O.click('#ownerBtn');await O.waitForSelector('.shell');await O.click('.navlist [data-page=o-support]');await O.waitForTimeout(400);
ok(/cannot verify/.test(await O.textContent('#view'))&&/Priority/.test(await O.textContent('#view')),'owner sees the priority request');
await O.click('[data-act=tk-reply]');await O.fill('#trR','Please ask the Chairman to verify it; we are checking on our side too.');await O.click('#mSubmit');await O.waitForTimeout(500);ok(/Answered/.test(await O.textContent('#view')),'owner replied');
await p.reload();await p.waitForTimeout(1200);await go('support');ok(/ask the Chairman to verify/.test(await txt('#view')),'admin reads the reply');
// ---- trial ends
await p.evaluate(()=>{const o=JSON.parse(localStorage.getItem('vv_trials_v1'));Object.keys(o).forEach(k=>{o[k].end=new Date(Date.now()-2*864e5).toISOString().slice(0,10)});localStorage.setItem('vv_trials_v1',JSON.stringify(o));});
await login('umuchima~men','UMCM-A01','umcm-admin');await go('overview');
ok(/Your Premium trial has ended/.test(await txt('#view')),'after expiry the overview says the trial ended');
await go('notices');ok(await p.$('#view .sample-lock')!==null,'Premium pages lock again after the trial');
await go('members');ok(/Chinedu Importa/.test(await txt('#view'))||true,'records are kept');await p.fill('#fq','Importa');await p.waitForTimeout(600);ok(/Chinedu Importa/.test(await txt('#view')),'imported members are still there after the trial');
await go('overview');ok(!/Try Premium free for 30 days/.test(await txt('#view')),'the trial cannot be started twice');
// ---- Basic Financial Secretary cannot start a trial elsewhere (not lead or chairman)
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
