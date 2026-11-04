const { chromium } = require('playwright');
const AUDIT=()=>{
  const out=[];const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  const name=e=>(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')&&[...e.getAttribute('aria-labelledby').split(' ')].map(i=>document.getElementById(i)?.textContent).join(' ')||e.textContent||e.getAttribute('title')||e.getAttribute('alt')||'').trim();
  document.querySelectorAll('button,a[href],[role=button]').forEach(e=>{if(vis(e)&&!name(e))out.push('no-name '+e.outerHTML.slice(0,90))});
  document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(e=>{if(!vis(e))return;const has=e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||(e.id&&document.querySelector(`label[for="${CSS.escape(e.id)}"]`))||e.closest('label');if(!has)out.push('no-label '+e.outerHTML.slice(0,90))});
  document.querySelectorAll('img').forEach(e=>{if(vis(e)&&e.getAttribute('alt')===null)out.push('img-no-alt '+e.outerHTML.slice(0,80))});
  const ids={};document.querySelectorAll('[id]').forEach(e=>{ids[e.id]=(ids[e.id]||0)+1});Object.entries(ids).forEach(([k,v])=>{if(v>1)out.push('dup-id '+k)});
  const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
  const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return [p[0],p[1],p[2],p[3]==null?1:p[3]]};
  const bgOf=e=>{let c=[255,255,255];const chain=[];for(let n=e;n;n=n.parentElement)chain.push(n);for(const n of chain.reverse()){const b=parse(getComputedStyle(n).backgroundColor);if(b&&b[3]>0){c=c.map((v,i)=>v*(1-b[3])+b[i]*b[3])}}return c};
  const seen=new Set();
  document.querySelectorAll('body *').forEach(e=>{if(!vis(e))return;const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1);if(!own)return;const s=getComputedStyle(e);if(s.backgroundImage!=='none')return;const fg=parse(s.color);if(!fg)return;const bg=bgOf(e);const f=fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));const L1=lum(f),L2=lum(bg),r=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);const px=parseFloat(s.fontSize),big=px>=24||(px>=18.66&&parseInt(s.fontWeight)>=700);if(r<(big?3:4.5)){const k=e.className+'|'+s.color+'|'+JSON.stringify(bg.map(Math.round));if(!seen.has(k)){seen.add(k);out.push(`contrast ${r.toFixed(2)} ${(e.className||e.tagName)} "${e.textContent.trim().slice(0,28)}" fg=${s.color} bg=rgb(${bg.map(Math.round)})`)}}});
  return out};
(async()=>{const b=await chromium.launch();const U=(process.env.BASE_URL||'http://localhost:8765/index.html');
for(const scheme of ['light','dark']){const ctx=await b.newContext({viewport:{width:1360,height:900},colorScheme:scheme});await ctx.route(/fonts\.g/,r=>r.abort());await require('./_parent-options')(ctx);
await ctx.addInitScript(()=>{setInterval(()=>{const m=document.querySelector('#modalRoot:not([hidden])');if(m&&/How are we doing|Payment verified/.test(m.textContent)){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}},300)});
const p=await ctx.newPage();await p.goto(U);await p.waitForTimeout(400);
const report={};const run=async(label)=>{report[label]=await p.evaluate(AUDIT)};
await run('landing');
await p.selectOption('#heroVillage','umuokpu');await p.waitForTimeout(250);await run('landing+form');
await p.fill('#loginId','UMK-A02');await p.fill('#loginPw','umk-admin');await p.click('#loginBtn');await p.waitForSelector('.shell');
for(const pg of await p.$$eval('.navlist [data-page]',e=>e.map(x=>x.dataset.page))){await p.click(`.navlist [data-page=${pg}]`);await p.waitForTimeout(120);await run('admin:'+pg)}
await p.click('[data-act=upload-proof]');await p.waitForTimeout(200);await run('modal:upload');await p.keyboard.press('Escape');
const m=await ctx.newPage();await m.goto(U);await m.selectOption('#heroVillage','umuokpu');await m.fill('#loginId','UMK-M002');await m.fill('#loginPw','umk-member');await m.click('#loginBtn');await m.waitForSelector('.shell');
for(const pg of await m.$$eval('.navlist [data-page]',e=>e.map(x=>x.dataset.page))){await m.click(`.navlist [data-page=${pg}]`);await m.waitForTimeout(120);report['member:'+pg]=await m.evaluate(AUDIT)}
const all={};Object.entries(report).forEach(([k,v])=>v.forEach(x=>{(all[x]=all[x]||[]).push(k)}));
const real=Object.entries(all).filter(([x])=>!/^dup-id \[object/.test(x));console.log((real.length?'FAIL ':'PASS ')+'accessibility scan ('+scheme+')'+(real.length?'':''));real.slice(0,40).forEach(([x,w])=>console.log('  '+x,' <= ',w.slice(0,3).join(',')));
await ctx.close()}
await b.close()})().catch(e=>console.log('FATAL',e.message.slice(0,400)));
