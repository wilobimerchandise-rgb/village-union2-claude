const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1360,height:900}});await ctx.route(/fonts\.g/,r=>r.abort());
const U=(process.env.BASE_URL||'http://localhost:8765/index.html');const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(U);await p.selectOption('#heroVillage','umuokpu');await p.fill('#loginId','UMK-A02');await p.fill('#loginPw','umk-admin');await p.click('#loginBtn');await p.waitForSelector('.shell');
const N_M=+process.env.NM||400,N_T=+process.env.NT||6000;
const info=await p.evaluate(({N_M,N_T})=>{const v=JSON.parse(localStorage.getItem('vv_v1_umuokpu'));const tm=v.users.find(u=>u.role==='member'),tt=v.tx.find(t=>t.status==='verified'),ta=v.audit[0];
const levies=Object.keys(v.settings.levies);let n=v.users.length;
for(let i=0;i<N_M;i++){const u=Object.assign({},tm,{id:'UMK-M9'+String(i).padStart(3,'0'),name:'Stress Member '+i,joined:'2020-01-01'});v.users.push(u);}
const ms=v.users.filter(u=>u.role==='member');
for(let i=0;i<N_T;i++){const m=ms[i%ms.length];const d=new Date(2026,0,1+(i%280)).toISOString().slice(0,10);v.tx.push(Object.assign({},tt,{id:'UMK-T9'+i,memberId:m.id,levy:levies[i%levies.length],date:d,amount:1000+(i%7)*500,receiptNo:null,proof:null}));}
for(let i=0;i<N_T;i++)v.audit.push(Object.assign({},ta,{id:'A9'+i,ts:new Date(2026,0,1,0,0,i).toISOString()}));
localStorage.setItem('vv_v1_umuokpu',JSON.stringify(v));return {users:v.users.length,tx:v.tx.length,audit:v.audit.length,kb:Math.round(JSON.stringify(v).length/1024)}},{N_M,N_T});
console.log(info);
const t0=Date.now();await p.reload();await p.waitForSelector('.shell').catch(()=>{});console.log('reload ms',Date.now()-t0, 'logged in?',!!(await p.$('.shell')));
if(!(await p.$('.shell'))){await p.selectOption('#heroVillage','umuokpu');await p.fill('#loginId','UMK-A02');await p.fill('#loginPw','umk-admin');const t=Date.now();await p.click('#loginBtn');await p.waitForSelector('.shell');console.log('login->shell ms',Date.now()-t);}
const pages=await p.$$eval('.navlist [data-page]',e=>e.map(x=>x.dataset.page));
for(const pg of pages){const ms=await p.evaluate(pg=>{const b=document.querySelector(`.navlist [data-page=${pg}]`);const t=performance.now();b.click();return Math.round(performance.now()-t)},pg);console.log(pg.padEnd(14),ms+' ms');}
// pdf build
const dl=await p.evaluate(()=>{const t=performance.now();const b=document.querySelector('.navlist [data-page=reports]');b.click();return 1});

const c=await ctx.newCDPSession(p);await c.send('Profiler.enable');await c.send('Profiler.setSamplingInterval',{interval:200});await c.send('Profiler.start');
await p.evaluate(()=>{for(let i=0;i<5;i++)for(const pg of ['halloffame','overview','outstanding','members'])document.querySelector(`.navlist [data-page=${pg}]`).click()});
const {profile}=await c.send('Profiler.stop');const self={};const byId={};profile.nodes.forEach(n=>byId[n.id]=n);const dt=profile.timeDeltas;profile.samples.forEach((s,i)=>{const n=byId[s];const k=n.callFrame.functionName+':'+n.callFrame.lineNumber;self[k]=(self[k]||0)+dt[i]});
Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,16).forEach(([k,v])=>console.log((v/1000).toFixed(0).padStart(6)+' ms  '+k));
console.log('ERR',errs);await b.close()})().catch(e=>{console.log('FATAL',e.message.slice(0,300))});
