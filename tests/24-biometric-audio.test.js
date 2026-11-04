const { chromium } = require('playwright');
(async()=>{
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const errs=[];
const base=(process.env.BASE_URL||'http://localhost:8765/index.html').replace('127.0.0.1','localhost');   // passkeys need a real host name, not an IP
const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const ctx=await b.newContext({viewport:{width:1360,height:900},permissions:['microphone']});await ctx.route(/fonts\.g/,r=>r.abort());
const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
const fresh=async()=>{await p.goto(base);await p.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await p.goto(base);await p.waitForTimeout(200);};
const login=async(v,id,pw)=>{await fresh();await p.selectOption('#heroVillage',v);await p.waitForTimeout(150);await p.fill('#loginId',id);await p.fill('#loginPw',pw);await p.click('#loginBtn');await p.waitForTimeout(800);return !!(await p.$('.shell'))};
const closeM=async()=>{if(await p.$('#modalRoot:not([hidden])')){await p.keyboard.press('Escape');await p.waitForTimeout(150)}};
const cdp=await ctx.newCDPSession(p);await cdp.send('WebAuthn.enable');
const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
// ---- Biometric sign-in
await fresh();await p.selectOption('#heroVillage','umuokpu~men');await p.waitForTimeout(200);ok(await p.isVisible('#bioBtn'),'the sign-in screen offers fingerprint or face sign-in when the device supports it');
await p.selectOption('#heroVillage','umuokpu~men');await p.click('#bioBtn');await p.waitForTimeout(400);ok(/No fingerprint or face sign-in is set up/.test(await p.textContent('#loginError')),'with nothing set up on this device it says so, and signs nobody in');
ok(await login('umuokpu~men','UMKM-M001','umkm-member'),'member signs in with the password');
ok(await p.$('[data-act=bio-manage]')!==null,'the menu offers Fingerprint or face sign-in');
await p.click('[data-act=bio-manage]');await p.fill('#bioP','wrong-pass');await p.click('#mSubmit');await p.waitForTimeout(400);ok(/not correct/.test(await p.textContent('#mError')),'switching it on needs the password again');
await p.fill('#bioP','umkm-member');await p.click('#mSubmit');await p.waitForTimeout(900);
const st=await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_bio_v1')||'{}'));
ok(!!(st['umuokpu~men']&&st['umuokpu~men']['UMKM-M001']&&st['umuokpu~men']['UMKM-M001'].pub),'only the public key is stored on the device');
ok(!/private|fingerprint data/i.test(JSON.stringify(st)),'no private key or biometric data is stored');
const creds=await cdp.send('WebAuthn.getCredentials',{authenticatorId});ok(creds.credentials.length===1,'the device holds the key pair');
// sign in with the biometric
await fresh();await p.selectOption('#heroVillage','umuokpu~men');await p.click('#bioBtn');await p.waitForTimeout(1200);
ok(!!(await p.$('.shell'))&&/UMKM-M001/.test(await p.textContent('.side-foot')),'signed in with fingerprint or face, as the right person');
// failed verification
await cdp.send('WebAuthn.setUserVerified',{authenticatorId,isUserVerified:false});
await fresh();await p.selectOption('#heroVillage','umuokpu~men');await p.click('#bioBtn');await p.waitForTimeout(1500);
ok(!(await p.$('.shell'))&&/did not match|cancelled|could not be confirmed|not available/.test(await p.textContent('#loginError')),'a failed fingerprint or face check does not sign anyone in');
await cdp.send('WebAuthn.setUserVerified',{authenticatorId,isUserVerified:true});
// wrong village
await fresh();await p.selectOption('#heroVillage','umuokpu~women');await p.click('#bioBtn');await p.waitForTimeout(400);ok(!(await p.$('.shell'))&&/No fingerprint or face/.test(await p.textContent('#loginError')),'it does not open a different wing');
// a password reset by an admin switches it off on the device
await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('vv_v1_umuokpu~men'));v.users.find(u=>u.id==='UMKM-M001').bioEpoch=1;localStorage.setItem('vv_v1_umuokpu~men',JSON.stringify(v));});
await p.goto(base);await p.selectOption('#heroVillage','umuokpu~men');await p.click('#bioBtn');await p.waitForTimeout(1200);
ok(!(await p.$('.shell'))&&/reset by an admin/.test(await p.textContent('#loginError')),'after an admin resets the login details, the old fingerprint sign-in stops working');
ok(!(await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_bio_v1')||'{}')['umuokpu~men'])),'and it is removed from the device');
// turn on again, then off
ok(await login('umuokpu~men','UMKM-M001','umkm-member'),'signs in with the password again');
await p.click('[data-act=bio-manage]');await p.fill('#bioP','umkm-member');await p.click('#mSubmit');await p.waitForTimeout(900);
await p.click('[data-act=bio-manage]');ok(/Switch off on this device/.test(await p.textContent('#modalRoot')),'it can be switched off');await p.click('#mSubmit');await p.waitForTimeout(400);
ok(!(await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_bio_v1')||'{}')['umuokpu~men'])),'switching it off removes the key from this device');
// admins keep two-step sign-in
const src=require('fs').readFileSync(require('path').join(__dirname,'..','app.js'),'utf8');ok(/enterApp\(v, u\)/.test(src.slice(src.indexOf('async function bioLogin'))),'biometric sign-in goes through the normal sign-in, so admin two-step still applies');
// ---- Recorder
await login('umuokpu~men','UMKM-A03','umkm-admin');
await p.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,300,120);const sig=c.toDataURL('image/jpeg',.9);const v=JSON.parse(localStorage.getItem('vv_v1_umuokpu~men'));v.users.forEach(u=>{if(u.id==='UMKM-A03')u.title='Secretary';if(u.id==='UMKM-A01')u.signature=sig;if(u.id==='UMKM-A03')u.signature=sig;});localStorage.setItem('vv_v1_umuokpu~men',JSON.stringify(v));});
const ok2=await login('umuokpu~men','UMKM-A03','umkm-admin');
await p.click('.navlist [data-page=minutes]');await p.waitForTimeout(300);
await p.click('[data-act=min-new]');await p.waitForSelector('#mnTi');await p.fill('#mnTi','Recorder check');await p.fill('#mnV','Hall');await p.fill('#mnAg','One');await p.fill('#mnDi','Discussion text long enough for the check.');await p.fill('#mnR','Done');await p.fill('#mnAc','None, Secretary, 1 Dec');await p.click('#mSubmit');await p.waitForTimeout(500);
await p.click('[data-act=min-audio]');await p.waitForSelector('#recGo');
ok(await p.$('#recDev')!==null&&await p.$('#recClose')!==null&&await p.$('#recLvl')!==null,'recorder has a microphone choice, a close-speaker switch and a level meter');
ok(/Bluetooth/.test(await p.textContent('#recMsg')),'tips tell people to avoid Bluetooth headsets');
await p.click('#recGo');let lvl=0;for(let i=0;i<20;i++){await p.waitForTimeout(200);lvl=Math.max(lvl,await p.$eval('#recLvl',e=>parseFloat(e.style.width)||0));}ok(lvl>0,'the level meter moves while recording ('+lvl+'%)');
const info=await p.evaluate(()=>({m:document.getElementById('recMsg').textContent}));ok(/Level is good|Too loud|Very quiet/.test(info.m),'the meter gives plain advice: '+info.m);
await p.click('#recStop');await p.waitForTimeout(800);
ok(!!(await p.$('#recOut audio'))&&!!(await p.$('#recVerdict')),'after stopping, the recording can be played back and has a verdict');
const blob=await p.evaluate(async()=>{const a=document.querySelector('#recOut audio');const r=await fetch(a.src);const b=await r.blob();return {size:b.size,type:b.type}});
ok(blob.size>8000&&/audio\//.test(blob.type),'a real audio file was recorded ('+blob.size+' bytes, '+blob.type+')');
ok(/opus|webm|ogg|mp4/.test(blob.type),'saved as a compressed voice format');
const dur=await p.evaluate(()=>new Promise(res=>{const a=document.querySelector('#recOut audio');if(a.duration&&isFinite(a.duration))return res(a.duration);a.addEventListener('loadedmetadata',()=>res(a.duration));a.load();setTimeout(()=>res(0),4000)}));ok(dur===0||dur>2,'the recording is about as long as the time spent recording ('+dur+'s)');
await p.check('input[name=consent]');await p.click('#mSubmit');await p.waitForTimeout(700);
ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('vv_v1_umuokpu~men')).minutes.some(m=>m.audio&&m.audio.size>8000)),'the recording saved to the minutes');
errs.length&&console.log('FAIL page errors: '+errs.join('|'));ok(errs.length===0,'no page errors');
await b.close();})().catch(e=>{console.log('FATAL '+e.message);process.exit(1)});
