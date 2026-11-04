const { chromium } = require('playwright'); const fs = require('fs'); const cp = require('child_process');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900},acceptDownloads:true});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
await ctx.addInitScript(()=>{window.__shared=[];try{navigator.canShare=d=>!!(d&&d.files&&d.files.length);navigator.share=async d=>{window.__shared.push((d.files||[]).map(f=>[f.name,f.type,f.size]));};}catch(e){}window.open=(u)=>{(window.__opened=window.__opened||[]).push(u);return {};};});
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=process.env.BASE_URL;const errs=[];const OUT=process.env.OUT||'/tmp';
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.setDefaultTimeout(8000);
const login=async(v,id,pw)=>{await p.goto(U);await p.evaluate(()=>sessionStorage.clear());await p.goto(U);await p.waitForTimeout(250);await p.selectOption('#heroVillage',v);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(900);};
const esc=async()=>{if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(300);}};
const go=async pg=>{await p.waitForTimeout(1200);await esc();await p.click(`.navlist [data-page=${pg}]`);await p.waitForTimeout(350);};
const txt=async s=>await p.textContent(s);
// ---- Basic village: locked
await login('umuchima~men','UMCM-A02','umcm-admin');
for(const pg of ['notices','idcard']){await go(pg);ok(await p.$('#view .prem-badge')!==null,'Basic: '+pg+' shows the Premium badge');}
// ---- Premium village, Chairman posts a notice
await login('umuokpu~men','UMKM-A01','umkm-admin');
await go('notices');await p.click('[data-act=ntc-new]');await p.fill('#ntT','Annual general meeting date');await p.fill('#ntB','The AGM holds on the first Saturday of December at the town hall.');await p.click('#mSubmit');await p.waitForTimeout(400);
ok(/Annual general meeting date/.test(await txt('#view')),'notice posted');ok(/Seen by 1 of \d+/.test(await txt('#view')),'admin sees "Seen by 1 of N": '+((await txt('#view')).match(/Seen by \d+ of \d+/)||[''])[0]);
// member reads it
await login('umuokpu~men','UMKM-M001','umkm-member');
ok(/1 new notice/.test(await txt('#view')),'member sees a new-notice banner');
await go('notices');ok(/Annual general meeting date/.test(await txt('#view')),'member reads the notice');
// member adds birthday = today
const md=new Date();const mm=String(md.getMonth()+1).padStart(2,'0'),dd=String(md.getDate()).padStart(2,'0');
await go('overview');ok(/Add your birthday/.test(await txt('#view')),'member is asked to add a birthday');
await p.click('[data-act=dates-edit]');await p.waitForTimeout(250);await p.selectOption('#bdM',mm);await p.selectOption('#bdD',dd);await p.click('#mSubmit');await p.waitForTimeout(400);
await go('idcard');ok(/Birthday/.test(await txt('#view'))&&new RegExp(String(+dd)+' ').test(await txt('#view')),'birthday shows on the member profile card');
// share ID card with a mocked share sheet
await p.waitForTimeout(800);await p.click('[data-act=share-idcard]');await p.waitForTimeout(800);
const sh=await p.evaluate(()=>window.__shared);ok(sh.length===1&&sh[0][0][1]==='image/png'&&sh[0][0][2]>2000,'ID card shared as a PNG file: '+JSON.stringify(sh));
// download the card and decode its QR
await p.waitForTimeout(700);const [d]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=id-png]')]);await d.saveAs(`${OUT}/idcard.png`);
fs.writeFileSync(`${OUT}/dec.py`,"import cv2,sys\nim=cv2.imread(sys.argv[1]);d=cv2.QRCodeDetectorAruco();t,_,_=d.detectAndDecode(im);print(t)\n");
const qr=cp.execSync(`python3 ${OUT}/dec.py ${OUT}/idcard.png`).toString().trim();ok(/^VVID\|UMKM\|UMKM-M001\|[0-9A-F]{8}$/.test(qr),'ID card QR decodes: '+qr);
// chairman sees dashboard widget + notice seen 2
await login('umuokpu~men','UMKM-A01','umkm-admin');await go('overview');
ok(/Birthdays in the next 14 days/.test(await txt('#view')),'admin dashboard shows the birthday widget');
const href=await p.$eval('#bdayWidget a[href*="wa.me"]',a=>decodeURIComponent(a.href));ok(/happy birthday/i.test(href),'Send wish link carries the birthday message');
await p.click('#bdayWidget [data-act=wish-edit]');await p.fill('#wsT','Happy birthday {first}! From all of us at {village}.');await p.click('#mSubmit');await p.waitForTimeout(400);
const href2=await p.$eval('#bdayWidget a[href*="wa.me"]',a=>decodeURIComponent(a.href));ok(/From all of us at/.test(href2),'custom birthday message is used');
await go('notices');ok(/Seen by 2 of \d+/.test(await txt('#view')),'seen count rises to 2: '+((await txt('#view')).match(/Seen by \d+ of \d+/)||[''])[0]);
await p.click('[data-act=ntc-unseen]');await p.waitForTimeout(250);ok(/Nudge on WhatsApp|No phone/.test(await txt('#modalRoot')),'unseen list is shown');await esc();
// member profile shows birthday
await go('members');await p.click('table.t tbody tr >> nth=0 >> .linkbtn');await p.waitForSelector('#modalRoot .kv');ok(/Birthday/.test(await txt('#modalRoot')),'admin sees the birthday on a member profile');await esc();
// share agenda
await go('agendas');await p.click('[data-act=new-agenda]');await p.fill('#agT','Share test');await p.fill('#agI','Prayer | Chaplain | 5');await p.click('#mSubmit');await p.waitForTimeout(400);
await p.click('[data-act=share-agenda]');await p.waitForTimeout(600);const sh2=await p.evaluate(()=>window.__shared);ok(sh2.length===1&&sh2[0][0][1]==='application/pdf'&&sh2[0][0][2]>800,'agenda shared as a PDF file');
// broadcast to everyone
await go('outstanding');await p.click('[data-act=wa-broadcast]');await p.waitForTimeout(300);ok(/Everyone/.test(await txt('#modalRoot'))&&/with a phone number/.test(await txt('#modalRoot')),'broadcast offers audiences');
const [v]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=bx-vcf]')]);const vc=fs.readFileSync(await v.path(),'utf8');ok(/BEGIN:VCARD/.test(vc)&&/TEL;TYPE=CELL:\+234/.test(vc),'contacts file has vCards');
await p.click('[data-act=bx-start]');await p.waitForTimeout(300);ok(/Open first chat/.test(await txt('#modalRoot')),'one-chat-at-a-time queue starts');
await p.click('#qGo');await p.waitForTimeout(200);const op=await p.evaluate(()=>window.__opened||[]);ok(op.length===1&&/wa\.me\/234/.test(op[0]),'first chat opens in WhatsApp');await esc();
// receipt share
await go('transactions');const rc=await p.$('[data-act=receipt]');if(rc){await rc.click();await p.waitForSelector('[data-act=share-receipt]');await p.waitForTimeout(500);await p.click('[data-act=share-receipt]');await p.waitForTimeout(900);const s3=await p.evaluate(()=>window.__shared);ok(s3.some(x=>x[0][1]==='application/pdf'),'receipt shared as a PDF');await esc();}else ok(false,'no receipt button found');
// QR check-in: Financial Secretary opens the register, Chairman scans
await login('umuokpu~men','UMKM-A02','umkm-admin');await go('register');await p.click('[data-act=mtg-open]');await p.click('#mSubmit');await p.waitForTimeout(400);
await login('umuokpu~men','UMKM-A01','umkm-admin');await go('idcard');
await p.fill('#idIn','VVID|UMKM|UMKM-M001|DEADBEEF');await p.click('[data-act=id-check]');await p.waitForTimeout(300);ok(/does not match|forged/.test(await txt('#idRes')),'forged card code is refused');
await p.fill('#idIn',qr);await p.click('[data-act=id-check]');await p.waitForTimeout(400);ok(/marked present/.test(await txt('#idRes')),'valid card is checked in: '+await txt('#idRes'));
await p.fill('#idIn',qr);await p.click('[data-act=id-check]');await p.waitForTimeout(300);ok(/already on the register/.test(await txt('#idRes')),'second scan says already marked');
await p.fill('#idIn','VVID|OTHER|UMKM-M001|AAAAAAAA');await p.click('[data-act=id-check]');await p.waitForTimeout(300);ok(/different village/.test(await txt('#idRes')),'card of another village is refused');
await go('register');await p.click('[data-act=rtab][data-tab=attendance]');await p.waitForTimeout(250);await p.click('[data-act=mtg-view]');await p.waitForSelector('#modalRoot table.t');ok(/Waiting for admin/.test(await txt('#modalRoot')),'check-in is waiting for a second admin');await esc();
const pdfbtn=await p.$('[data-act=id-pdf-all]');await go('idcard');const [d2]=await Promise.all([p.waitForEvent('download'),p.click('[data-act=id-pdf-all]')]);const pb=fs.readFileSync(await d2.path());ok(pb.slice(0,5).toString()==='%PDF-'&&pb.includes('%%EOF'),'all ID cards PDF is valid '+pb.length);
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
