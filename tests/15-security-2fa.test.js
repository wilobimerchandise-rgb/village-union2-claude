const { chromium } = require('playwright');const crypto=require('crypto');
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const dec=s=>{let bits='';s.replace(/[^A-Z2-7]/g,'').split('').forEach(c=>bits+=B32.indexOf(c).toString(2).padStart(5,'0'));const o=[];for(let i=0;i+8<=bits.length;i+=8)o.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(o)};
const totp=(sec,off=0)=>{const c=Math.floor(Date.now()/30000)+off;const m=Buffer.alloc(8);m.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',dec(sec)).update(m).digest();const o=h[19]&15;const n=((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];return String(n%1e6).padStart(6,'0')};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)});
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);const U=(process.env.BASE_URL||(process.env.BASE_URL||'http://localhost:8765/index.html'));const errs=[];
const mk=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));return p};
const clear=async pg=>{await pg.goto(U);await pg.evaluate(()=>{sessionStorage.clear();Object.keys(localStorage).filter(k=>k.startsWith('vv_rem_')).forEach(k=>localStorage.removeItem(k))});await pg.goto(U);};
const fillLogin=async(pg,v,id,pw)=>{await pg.selectOption('#heroVillage',v);await pg.waitForTimeout(250);await pg.fill('#loginId',id);await pg.fill('#loginPw',pw);await pg.click('#loginBtn');};
const A=await mk();await clear(A);await fillLogin(A,'umuokpu~men','UMKM-A01','umkm-admin');await A.waitForSelector('.shell');
ok(await A.$('#dpwBanner')!==null,'default-password banner shown');
await A.click('.navlist [data-page=admins]');await A.waitForTimeout(300);ok(!!(await A.$('#twostep')),'lead sees two-step panel');
await A.click('[data-act="2fa-on"]');await A.waitForSelector('.seckey');const sec=(await A.textContent('.seckey')).replace(/\s/g,'');ok(sec.length===32,'secret shown');
await A.fill('#tfN','000000');await A.click('#mSubmit');await A.waitForTimeout(300);ok(/not right/.test(await A.textContent('#mError')),'wrong enrol code rejected');
await A.fill('#tfN',totp(sec));await A.click('#mSubmit');await A.waitForSelector('pre.recov');const rec=(await A.textContent('pre.recov')).trim().split(/\s+/);ok(rec.length===8&&/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(rec[0]),'8 recovery codes');
await A.keyboard.press('Escape');ok(/On/.test(await A.textContent('#twostep .badge')),'two-step on');
// log out and in again
await A.evaluate(()=>{sessionStorage.clear()});await A.goto(U);
await fillLogin(A,'umuokpu~men','UMKM-A01','umkm-admin');await A.waitForSelector('#tfC');ok(!(await A.$('.shell')),'code asked before dashboard');
// reload during gate must not log in
await A.reload();await A.waitForTimeout(600);ok(!(await A.$('.shell:not([hidden])')),'reload does not skip the code');
await A.evaluate(()=>sessionStorage.clear());await A.goto(U);await fillLogin(A,'umuokpu~men','UMKM-A01','umkm-admin');await A.waitForSelector('#tfC');
await A.fill('#tfC','111111');await A.click('#mSubmit');await A.waitForTimeout(300);ok(/not right/.test(await A.textContent('#mError')),'wrong login code rejected');
await A.fill('#tfC',totp(sec));await A.click('#mSubmit');await A.waitForSelector('.shell');ok(true,'correct code signs in');
// recovery code
await A.evaluate(()=>sessionStorage.clear());await A.goto(U);await fillLogin(A,'umuokpu~men','UMKM-A01','umkm-admin');await A.waitForSelector('#tfC');await A.fill('#tfC',rec[0]);await A.click('#mSubmit');await A.waitForSelector('.shell');ok(true,'recovery code signs in');
await A.evaluate(()=>sessionStorage.clear());await A.goto(U);await fillLogin(A,'umuokpu~men','UMKM-A01','umkm-admin');await A.waitForSelector('#tfC');await A.fill('#tfC',rec[0]);await A.click('#mSubmit');await A.waitForTimeout(300);ok(/not right/.test(await A.textContent('#mError')),'recovery code works only once');
// owner reset
const O=await mk();await O.goto(U+'#owner');await O.waitForTimeout(500);await O.fill('#ownId','OWNER');await O.fill('#ownPw','owner-2026');await O.click('#ownerBtn');await O.waitForSelector('.shell');
await O.click('.navlist [data-page=o-admins]');await O.waitForTimeout(300);await O.selectOption('#oaV','umuokpu~men').catch(()=>{});await O.waitForTimeout(300);const rb=await O.$('[data-act=o-reset-2fa]');ok(!!rb,'owner sees Reset 2-step');if(rb){await rb.click();await O.waitForTimeout(300);}
const A3=await mk();await clear(A3);await fillLogin(A3,'umuokpu~men','UMKM-A01','umkm-admin');await A3.waitForSelector('.shell');ok(true,'after owner reset: password only');
// owner 2FA
await O.click('.navlist [data-page=o-account]');await O.waitForTimeout(300);await O.click('[data-act="2fa-on"]');await O.waitForSelector('.seckey');const os=(await O.textContent('.seckey')).replace(/\s/g,'');await O.fill('#tfN',totp(os));await O.click('#mSubmit');await O.waitForSelector('pre.recov');
const O2=await mk();await O2.goto(U+'#owner');await O2.waitForTimeout(500);await O2.fill('#ownId','OWNER');await O2.fill('#ownPw','owner-2026');await O2.click('#ownerBtn');await O2.waitForSelector('#tfC');ok(!(await O2.$('.shell:not([hidden])')),'owner asked for code');
await O2.fill('#tfC',totp(os,-0));await O2.click('#mSubmit');await O2.waitForSelector('.shell');ok(true,'owner signs in with code');
// remember expiry
const R=await mk();await clear(R);await R.goto(U);await R.selectOption('#heroVillage','umuchima');await R.waitForTimeout(250);await R.fill('#loginId','UMC-A02');await R.fill('#loginPw','umc-admin');await R.check('[name=remember]').catch(()=>{});await R.click('#loginBtn');await R.waitForSelector('.shell');
await R.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('vv_rem_'));const r=JSON.parse(localStorage[k]);r.at=Date.now()-40*864e5;localStorage[k]=JSON.stringify(r);sessionStorage.clear()});await R.goto(U);await R.selectOption('#heroVillage','umuchima');await R.waitForTimeout(600);ok(!(await R.$('.shell:not([hidden])')),'expired remember-me token ignored');
// idle timeout
const I=await mk();await I.goto(U);await I.evaluate(()=>{localStorage.setItem('vv_cfg_session',JSON.stringify({idleMin:0.06,warnSec:1}))});await clear(I);await fillLogin(I,'umuchima','UMC-A02','umc-admin');await I.waitForSelector('.shell');
await I.waitForTimeout(4800);ok(!(await I.$('.shell:not([hidden])')),'idle timeout signs out');ok(/no activity/.test(await I.textContent('#toasts')),'idle message shown');
await I.evaluate(()=>localStorage.removeItem('vv_cfg_session'));
console.log('ERRORS',JSON.stringify(errs));await b.close()})().catch(e=>{console.log('FATAL',e.message.slice(0,500));process.exit(1)});
