
/* =========================================================
   ROUND 16: 30-day Premium trial, earlier member-cap nudge, locked previews with samples,
   village year in review, priority support desk, bulk member import.
   ========================================================= */
['bulkImport', 'yearReview'].forEach(k => { PLAN_RULES.basic[k] = false; PLAN_RULES.premium[k] = true; });

/* ---------- 1. Premium trial (30 days, once per village or association) ---------- */
const TRIAL = { key: 'vv_trials_v1', load() { try { return JSON.parse(lsGet(this.key) || '{}') || {}; } catch (_) { return {}; } }, save(o) { lsSet(this.key, JSON.stringify(o)); } };
const trialOf = () => (S.v ? TRIAL.load()[baseId(S.v.id)] : null) || null;
const canStartTrial = () => !!S.u && !S.owner && S.u.role === 'admin' && !!S.v && S.v.plan !== 'premium' && !trialOf() && (isLeadAdmin() || isChairman());
const trialBtn = () => canStartTrial() ? '<button class="btn btn-leaf" type="button" data-act="trial-start">Try Premium free for 30 days</button>' : '';
Object.assign(API, {
  startTrial() {
    requireAdmin(); if (S.v.plan === 'premium') throw new Error('This village or association is already on Premium.');
    if (trialOf()) throw new Error('The free trial has already been used here. Upgrade to keep Premium.');
    if (!isLeadAdmin() && !isChairman()) throw new Error('Only the Lead Admin or the Chairman can start the trial.');
    const pid = baseId(S.v.id), o = TRIAL.load(), end = addDays(today(), 30); o[pid] = { start: today(), end, by: S.u.name, byId: S.u.id, status: 'active' }; TRIAL.save(o);
    setRegistryPlan(pid, 'premium'); S.v.plan = 'premium'; log('Started Premium trial', 'Plan', `30 days, ending ${fmtDate(end)}`); commit();
    try { olog('Premium trial started', S.v.name, `By ${S.u.name}, ends ${fmtDate(end)}`); OWN.save(); } catch (_) {}
  }
});
function checkTrial() {
  try {
    if (!S.v || S.owner || !S.u) return; const pid = baseId(S.v.id), o = TRIAL.load(), t = o[pid]; if (!t || t.status !== 'active' || today() <= t.end) return;
    t.status = 'ended'; TRIAL.save(o); setRegistryPlan(pid, 'basic'); S.v.plan = 'basic'; log('Premium trial ended', 'Plan', 'Back on Basic. Every record is kept'); commit();
  } catch (_) {}
}
{ const mv = OWNER_API.manageVillage; OWNER_API.manageVillage = function (id, d) { const r = mv.apply(this, arguments); try { if (d && d.plan) { const pid = baseId(id), o = TRIAL.load(), t = o[pid]; if (t && t.status === 'active') { t.status = d.plan === 'premium' ? 'converted' : 'ended'; TRIAL.save(o); } } } catch (_) {} return r; };
  const du = OWNER_API.decideUpgrade; OWNER_API.decideUpgrade = function (id, decision) { const r0 = UPG.load().find(x => x.id === id), r = du.apply(this, arguments); try { if (decision === 'activate' && r0) { const pid = baseId(r0.pid), o = TRIAL.load(), t = o[pid]; if (t && t.status === 'active') { t.status = 'converted'; TRIAL.save(o); } } } catch (_) {} return r; }; }
function trialBanner() {
  if (!S.u || S.owner || S.u.role !== 'admin') return ''; const t = trialOf();
  if (t && t.status === 'active') { const n = Math.max(0, dayDiff(today(), t.end)); return `<div class="callout${n <= 5 ? ' upgrade' : ''}"><div><b>${premiumBadge} Premium trial: ${n === 0 ? 'last day today' : n + ' day' + (n === 1 ? '' : 's') + ' left'}</b><p>Every Premium page is switched on until ${esc(fmtDate(t.end))}. After that the village goes back to Basic and every record is kept.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="upgrade-start">Keep Premium</button></div>`; }
  if (t && t.status === 'ended' && dayDiff(t.end, today()) <= 30) return `<div class="callout upgrade"><div><b>Your Premium trial has ended</b><p>Everything you recorded is kept. Upgrade to switch the Premium pages back on.</p></div><button class="btn btn-saffron btn-sm" type="button" data-act="upgrade-start">Upgrade to Premium</button></div>`;
  if (canStartTrial()) return `<div class="callout"><div><b>Try Premium free for 30 days</b><p>Switch on the notice board, certificates, ID cards, year in review and more. No payment now, and nothing is deleted when it ends.</p></div><button class="btn btn-leaf btn-sm" type="button" data-act="trial-start">Start free trial</button></div>`;
  return '';
}
ACTIONS['trial-start'] = function () {
  if (!canStartTrial()) return toast(trialOf() ? 'The free trial has already been used here.' : 'Only the Lead Admin or the Chairman can start the trial.', 'err');
  openModal({ title: 'Start the 30-day Premium trial', sub: esc(S.v.name), submit: 'Start free trial', body: `<ul class="ticks"><li>Every Premium page and feature switches on today.</li><li>It runs for 30 days, then the village goes back to Basic by itself.</li><li>Nothing you record is deleted. Members above the Basic limit stay, but no new members can be added until you upgrade.</li><li>A village or association gets one trial.</li></ul>`, onSubmit: () => { API.startTrial(); done('Your 30-day Premium trial has started.'); } });
};

/* ---------- 3. Locked previews with sample data ---------- */
function samplePreview(title) {
  const S1 = {
    'Agenda builder': () => `<h3>Monthly general meeting</h3><ol class="agenda-list"><li>Opening prayer <small>Chaplain 5 min</small></li><li>Financial report <small>Financial Secretary 15 min</small></li><li>Burial levy update <small>Chairman 10 min</small></li></ol>`,
    'Birthdays and anniversaries': () => table(['Member', 'Date', 'When', ''], [['Chinedu O.', '14 Nov', 'In 10 days', '<span class="btn btn-leaf btn-sm">Send wish</span>'], ['Ngozi A.', '19 Nov', 'In 15 days', '<span class="btn btn-leaf btn-sm">Send wish</span>']], ['', '']),
    'Community projects': () => `<h3>Community borehole</h3><p class="hint">Target ${money(1500000)}. Raised ${money(960000)}.</p>${bar(64)}<p class="hint">Donor wall and progress updates appear here.</p>`,
    'Emergency levies': () => `<h3>Burial support: Late Mr. Okafor</h3><p class="hint">${money(2000)} per member. Collected ${money(78000)} of ${money(120000)}.</p>${bar(65)}`,
    'Good standing certificate': () => `<div class="callout"><div><b>In good standing</b><p>Everything due is paid. Valid for 90 days, with the full member details and a QR code.</p></div></div><dl class="kv"><dt>Number</dt><dd>GS-XXXX-2026-0001</dd><dt>Member</dt><dd>Chinedu Okeke</dd></dl>`,
    'ID card and QR check-in': () => `<div class="mock-id"><b>Your Village</b><span>Chinedu Okeke</span><small>XXXX-M014 · Member</small><i></i></div>`,
    'Notice board': () => `<h3>Annual general meeting date</h3><p>The AGM holds on the first Saturday of December.</p><b>Seen by 40 of 60</b>${bar(67)}`,
    'One-tap AGM report': () => `<div class="kpis kpis-3">${kpi('Collected', money(4850000), '')}${kpi('Spent', money(3120000), '')}${kpi('Attendance', '72%', '')}</div>`,
    'Terms of office': () => table(['Role', 'Holder', 'Term ends'], [['Chairman', 'Chief Okeke', 'In 140 days'], ['Secretary', 'Mrs. Eze', 'In 38 days']], ['', '']),
    'Village reports for members': () => `<div class="rep-item"><div><b>Yearly village report</b><br><small>Members can download it as a PDF</small></div></div>`,
    'Village year in review': () => `<div class="kpis kpis-3">${kpi('Collected', money(4850000), '')}${kpi('Spent', money(3120000), '')}${kpi('Paid up', '78%', '')}</div>${bar(78)}`,
    'Bulk member import': () => table(['Name', 'Phone', 'Check'], [['Chinedu Okeke', '0803 000 0001', 'Ready'], ['Ngozi Ade', '0803 000 0002', 'Ready'], ['Ike Obi', '0803 000 0002', 'Same phone as a row above']], ['', ''])
  }[title];
  if (!S1) return '';
  return `<section class="panel sample-lock" aria-hidden="true"><span class="sample-tag">Sample preview. Made-up names and figures.</span><div class="sample-body">${S1()}</div></section>`;
}

/* ---------- 2. Member-cap nudge: see capNotice in p17 (starts at 80 percent, with the trial button) ---------- */

/* ---------- 4. Village year in review ---------- */
function reviewData(yr) {
  const ys = String(yr), tx = S.v.tx.filter(t => t.status === 'verified' && String(t.date).slice(0, 4) === ys), months = Array(12).fill(0), levy = {};
  tx.forEach(t => { months[Number(String(t.date).slice(5, 7)) - 1] += t.amount; const n = levyOf(t.levy).name; levy[n] = (levy[n] || 0) + t.amount; });
  const spent = sum(activeExp().filter(e => String(e.date).slice(0, 4) === ys)), live = livePeople(), paidUp = live.filter(u => memberOutstanding(u.id, yr) === 0).length;
  const mt = S.v.meetings.filter(m => m.date.slice(0, 4) === ys && m.status !== 'open' && !m.exec), avgAtt = mt.length && live.length ? Math.round(sum(mt.map(m => presentCount(m))) / mt.length / live.length * 100) : 0;
  const prj = projects().filter(p => String(p.createdAt).slice(0, 4) === ys || p.status === 'completed'), emg = emergencies();
  return { yr, total: sum(tx), count: tx.length, months, levy: Object.entries(levy).sort((a, b) => b[1] - a[1]), spent, left: sum(tx) - spent, live: live.length, paidUp, rate: live.length ? Math.round(paidUp * 100 / live.length) : 0, meetings: mt.length, avgAtt,
    joined: S.v.users.filter(u => ['member', 'admin'].includes(u.role) && String(u.joined).slice(0, 4) === ys).length, projects: prj, projDone: prj.filter(p => p.status === 'completed').length, projRaised: sum(prj.map(projectRaised)), emg: emg.length, notices: (S.v.notices || []).filter(n => String(n.at).slice(0, 4) === ys).length };
}
const reviewText = d => `Dear members, here is ${S.v.name} in ${d.yr}.\nCollected: ${money(d.total)} from ${d.count} verified payments.\nSpent: ${money(d.spent)}.\n${d.rate}% of members are fully paid up.\n${d.meetings} meeting${d.meetings === 1 ? '' : 's'} held${d.meetings ? ', average attendance ' + d.avgAtt + '%' : ''}.\n${d.joined} new member${d.joined === 1 ? '' : 's'} joined.\n${d.projects.length ? d.projDone + ' of ' + d.projects.length + ' projects completed.\n' : ''}Thank you for standing with ${S.v.name}.`;
function reviewPdf(d) {
  const W = docWriter('Village year in review', `${S.v.name} · ${d.yr}`, `YR-${S.v.code}-${d.yr}`);
  W.section('The year in numbers'); W.kv([['Collected (verified payments)', naira(d.total)], ['Payments verified', String(d.count)], ['Spent', naira(d.spent)], ['Left after spending', naira(d.left)], ['Members fully paid up', `${d.paidUp} of ${d.live} (${d.rate}%)`], ['Meetings held', String(d.meetings)], ['Average attendance', d.meetings ? d.avgAtt + '%' : 'No meetings'], ['New members', String(d.joined)], ['Notices posted', String(d.notices)]]);
  W.section('Money collected by levy'); W.table([{ h: 'Levy', w: 335 }, { h: 'Collected', w: 180, align: 'right' }], d.levy.map(([n, a]) => [n, naira(a)]));
  W.section('Money collected by month'); W.table([{ h: 'Month', w: 335 }, { h: 'Collected', w: 180, align: 'right' }], d.months.map((a, i) => [MONTHS[i], naira(a)]));
  if (d.projects.length) { W.section('Community projects'); W.table([{ h: 'Project', w: 255 }, { h: 'Status', w: 90 }, { h: 'Raised', w: 170, align: 'right' }], d.projects.map(p => [p.name, p.status === 'completed' ? 'Completed' : p.status === 'paused' ? 'Paused' : 'In progress', naira(projectRaised(p))])); }
  W.space(8); W.sign([['Chairman', holderName('Chairman')], ['Financial Secretary', holderName('Financial Secretary')]]); return W.build();
}
function reviewView() {
  if (!planAllows('yearReview')) return premiumGate('Village year in review', 'A one-page story of the year for the village: money collected and spent, who is paid up, meetings, new members and projects. Download it as a PDF or share a summary on WhatsApp.');
  const yr = Number(S.f.ry) || new Date().getFullYear(), d = reviewData(yr), mx = Math.max(1, ...d.months), years = []; for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 4; y--) years.push(y);
  const wa = `https://wa.me/?text=${encodeURIComponent(reviewText(d))}`;
  return `<section class="panel"><div class="panel-h"><div><h2>${esc(S.v.name)}: ${yr} in review</h2><p>Built from verified payments, the register, members and projects. Only village totals are shown, never one person’s record.</p></div><div class="field" style="min-width:120px"><label for="ryY">Year</label><select id="ryY" class="select" data-filter="ry">${years.map(y => opt(String(y), String(y), String(yr))).join('')}</select></div></div>
  <div class="kpis kpis-4">${kpi('Collected', money(d.total), d.count + ' verified payments', 'good')}${kpi('Spent', money(d.spent), '')}${kpi('Left after spending', money(d.left), d.left < 0 ? 'More spent than collected' : '', d.left < 0 ? 'bad' : '')}${kpi('Paid up', d.rate + '%', `${d.paidUp} of ${d.live} members`)}</div>
  <div class="btn-row"><button class="btn btn-primary btn-sm" type="button" data-act="rv-pdf" data-y="${yr}">Download PDF</button><button class="btn btn-leaf btn-sm" type="button" data-act="rv-share" data-y="${yr}">Share (WhatsApp)</button><a class="btn btn-ghost btn-sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Send summary text</a></div></section>
  <section class="panel"><div class="panel-h"><div><h2>Money collected, month by month</h2></div></div><div class="mbars" role="img" aria-label="Collected each month in ${yr}">${d.months.map((a, i) => `<div class="mbar"><span style="height:${Math.round(a * 100 / mx)}%"></span><small>${MONTHS[i].slice(0, 3)}</small></div>`).join('')}</div></section>
  <section class="panel"><div class="panel-h"><div><h2>By levy</h2></div></div>${table(['Levy', { t: 'Collected', num: true }, 'Share'], d.levy.map(([n, a]) => [esc(n), money(a), bar(d.total ? Math.round(a * 100 / d.total) : 0)]), ['No verified payments this year', ''])}</section>
  <section class="panel"><div class="panel-h"><div><h2>People and meetings</h2></div></div><div class="rep-sum"><div><small>Meetings held</small><b>${d.meetings}</b></div><div><small>Average attendance</small><b>${d.meetings ? d.avgAtt + '%' : '-'}</b></div><div><small>New members</small><b>${d.joined}</b></div><div><small>Notices posted</small><b>${d.notices}</b></div></div></section>
  <section class="panel"><div class="panel-h"><div><h2>Projects and emergencies</h2></div></div><div class="rep-sum"><div><small>Projects</small><b>${d.projects.length}</b></div><div><small>Completed</small><b>${d.projDone}</b></div><div><small>Raised for projects</small><b>${money(d.projRaised)}</b></div><div><small>Emergency levies</small><b>${d.emg}</b></div></div></section>`;
}
Object.assign(ACTIONS, {
  'rv-pdf'(el) { if (!planAllows('yearReview')) return; const d = reviewData(Number(el.dataset.y)); download(`${S.v.code}-year-in-review-${d.yr}.pdf`, reviewPdf(d)); },
  async 'rv-share'(el) { if (!planAllows('yearReview')) return; const d = reviewData(Number(el.dataset.y)); try { await shareFile(reviewPdf(d), `${S.v.code}-year-in-review-${d.yr}.pdf`, reviewText(d)); } catch (ex) { toast(ex.message, 'err'); } }
});

/* ---------- 5. Priority support desk ---------- */
const SUP = {
  key: 'vv_support_v1', cfgKey: 'vv_support_cfg_v1',
  load() { try { return JSON.parse(lsGet(this.key) || '[]') || []; } catch (_) { return []; } }, save(l) { lsSet(this.key, JSON.stringify(l)); },
  cfg() { const d = { phone: '', promise: 'Premium: answered first, usually the same working day. Basic: within 3 working days.' }; try { return Object.assign(d, JSON.parse(lsGet(this.cfgKey) || '{}')); } catch (_) { return d; } },
  forOrg(pid) { return this.load().filter(t => t.pid === pid).sort((a, b) => b.at.localeCompare(a.at)); },
  open() { return this.load().filter(t => t.status !== 'closed'); }
};
Object.assign(API, {
  sendTicket(d) {
    requireAdmin(); const topic = (d.topic || '').trim(), msg = (d.msg || '').trim(); if (!topic) throw new Error('Choose what it is about.'); if (msg.length < 10) throw new Error('Describe the problem in a few words.'); if (msg.length > 800) throw new Error('Keep it under 800 characters.');
    const pid = baseId(S.v.id), l = SUP.load(); if (l.filter(t => t.pid === pid && t.status !== 'closed').length >= 5) throw new Error('You already have 5 open requests. Wait for answers or close some.');
    const t = { id: 'SP-' + String(l.length + 1).padStart(4, '0'), pid, orgName: S.v.name, code: S.v.code, tier: S.v.plan === 'premium' ? 'priority' : 'standard', byId: S.u.id, byName: S.u.name, byTitle: S.u.title || 'Admin', topic, msg, urgent: !!d.urgent, at: stamp(), status: 'open', replies: [] };
    l.push(t); SUP.save(l); log('Sent a support request', t.id, `${topic}${t.tier === 'priority' ? ' (priority)' : ''}`); commit(); return t;
  },
  closeTicket(id) { requireAdmin(); const l = SUP.load(), t = l.find(x => x.id === id && x.pid === baseId(S.v.id)); if (!t) throw new Error('Request not found.'); t.status = 'closed'; t.closedAt = stamp(); SUP.save(l); log('Closed a support request', id, t.topic); commit(); }
});
Object.assign(OWNER_API, {
  replyTicket(id, text, close) { requireOwner(); const l = SUP.load(), t = l.find(x => x.id === id); if (!t) throw new Error('Request not found.'); text = (text || '').trim(); if (text.length < 3) throw new Error('Write a short reply.'); t.replies.push({ by: 'VillageVault support', at: stamp(), text }); t.status = close ? 'closed' : 'answered'; SUP.save(l); olog('Answered a support request', t.orgName, `${t.id}: ${t.topic}`); OWN.save(); },
  saveSupportCfg(d) { requireOwner(); const p = (d.phone || '').replace(/\D/g, ''); if (d.phone && (p.length < 11 || p.length > 15)) throw new Error('Enter the WhatsApp number with country code, for example 2348012345678.'); lsSet(SUP.cfgKey, JSON.stringify({ phone: p, promise: (d.promise || '').trim().slice(0, 160) || SUP.cfg().promise })); olog('Changed support settings', 'All villages', 'WhatsApp line or response promise'); OWN.save(); }
});
const TICKET_TOPICS = ['Payments and proofs', 'Members and logins', 'Receipts and reports', 'Premium features', 'Something is not working', 'Other'];
function supportView() {
  const pid = baseId(S.v.id), prem = S.v.plan === 'premium', c = SUP.cfg(), list = SUP.forOrg(pid), tag = t => t.tier === 'priority' ? '<span class="badge b-admin">Priority</span>' : '<span class="badge b-off">Standard</span>', st = t => t.status === 'open' ? '<span class="badge b-pending">Waiting</span>' : t.status === 'answered' ? '<span class="badge b-verified">Answered</span>' : '<span class="badge b-off">Closed</span>';
  const line = prem ? (c.phone ? `<a class="btn btn-leaf btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(waLinkTo(c.phone, `Hello VillageVault support, this is ${S.u.name} (${S.u.title || 'Admin'}) from ${S.v.name} (${S.v.code}). `))}">Message support on WhatsApp</a>` : '<span class="hint">The WhatsApp line will be shown here once support adds it.</span>') : `<span class="hint">Premium villages also get a direct WhatsApp line. ${premiumBadge}</span>`;
  return `<section class="panel"><div class="panel-h"><div><h2>Help desk ${prem ? premiumBadge : ''}</h2><p>${prem ? 'Priority support is on. Your requests are answered first.' : 'Send a request and we will answer in the standard queue.'} ${esc(c.promise)}</p></div><button class="btn btn-primary btn-sm" type="button" data-act="tk-new">New request</button></div><div class="btn-row">${line}</div></section>
  <section class="panel"><div class="panel-h"><div><h2>Your requests</h2></div></div>${list.length ? list.map(t => `<div class="rep-item" style="display:block;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${esc(t.topic)}</b> ${tag(t)} ${st(t)}<br><small>${esc(t.id)} · ${esc(fmtTS(t.at))} · ${esc(t.byName)}</small></div>${t.status !== 'closed' ? `<button class="btn btn-ghost btn-sm" type="button" data-act="tk-close" data-id="${esc(t.id)}">Close</button>` : ''}</div><p style="white-space:pre-wrap;margin:8px 0">${esc(t.msg)}</p>${t.replies.map(r => `<div class="callout"><div><b>${esc(r.by)}</b> <small>${esc(fmtTS(r.at))}</small><p style="white-space:pre-wrap">${esc(r.text)}</p></div></div>`).join('')}</div>`).join('') : '<p class="muted">No requests yet.</p>'}</section>`;
}
Object.assign(ACTIONS, {
  'tk-new'() {
    if (!isAdmin()) return; openModal({ title: 'New support request', sub: S.v.plan === 'premium' ? 'Priority queue' : 'Standard queue', submit: 'Send request', body: `<div class="field"><label for="tkT">About</label><select id="tkT" name="topic" class="select">${TICKET_TOPICS.map(t => opt(t, t, '')).join('')}</select></div><div class="field"><label for="tkM">What do you need help with?</label><textarea id="tkM" name="msg" class="input" rows="5" maxlength="800" required></textarea></div><label class="check"><input type="checkbox" name="urgent"> <span>This is urgent (money or members are blocked)</span></label>`, onSubmit: fd => { API.sendTicket({ topic: fd.get('topic'), msg: fd.get('msg'), urgent: !!fd.get('urgent') }); done('Request sent. Support will answer here.'); } });
  },
  'tk-close'(el) { API.closeTicket(el.dataset.id); done('Request closed.'); },
  'tk-reply'(el) { const t = SUP.load().find(x => x.id === el.dataset.id); if (!t) return; openModal({ title: `Reply to ${t.orgName}`, sub: `${esc(t.id)}: ${esc(t.topic)}`, submit: 'Send reply', body: `<p class="remind-text">${esc(t.msg)}</p><div class="field"><label for="trR">Your reply</label><textarea id="trR" name="text" class="input" rows="4" maxlength="800" required></textarea></div><label class="check"><input type="checkbox" name="close"> <span>Close the request after replying</span></label>`, onSubmit: fd => { OWNER_API.replyTicket(t.id, fd.get('text'), !!fd.get('close')); done('Reply sent.'); } }); },
  'sup-cfg'() { const c = SUP.cfg(); openModal({ title: 'Support settings', sub: 'Shown to Premium admins.', submit: 'Save', body: `<div class="field"><label for="scP">Support WhatsApp number (with country code)</label><input id="scP" name="phone" class="input" inputmode="numeric" maxlength="16" value="${esc(c.phone)}" placeholder="2348012345678"></div><div class="field"><label for="scM">Response promise</label><input id="scM" name="promise" class="input" maxlength="160" value="${esc(c.promise)}"></div>`, onSubmit: fd => { OWNER_API.saveSupportCfg({ phone: fd.get('phone'), promise: fd.get('promise') }); done('Saved.'); } }); }
});
OWNERV['o-support'] = function () {
  const l = SUP.load().sort((a, b) => ((a.status === 'closed') - (b.status === 'closed')) || ((b.tier === 'priority') - (a.tier === 'priority')) || (b.urgent - a.urgent) || a.at.localeCompare(b.at)), op = l.filter(t => t.status === 'open'), pr = op.filter(t => t.tier === 'priority').length;
  return `<div class="kpis kpis-3">${kpi('Waiting for a reply', String(op.length), op.length ? 'Priority ones are at the top' : 'Nothing waiting', op.length ? 'bad' : 'good')}${kpi('Priority waiting', String(pr), 'Premium villages')}${kpi('All requests', String(l.length), '')}</div>
  <section class="panel"><div class="panel-h"><div><h2>Support requests</h2><p>Premium villages come first, then urgent ones, then the oldest.</p></div><button class="btn btn-ghost btn-sm" type="button" data-act="sup-cfg">Support settings</button></div>
  ${table(['Sent', 'Village or association', 'About', 'Status', ''], l.map(t => [`<span class="nowrap">${esc(fmtTS(t.at))}</span>`, `<b>${esc(t.orgName)}</b><small>${esc(t.code)} · ${esc(t.byName)}, ${esc(t.byTitle)}</small>`, `${esc(t.topic)}${t.urgent ? ' <span class="badge b-rejected">Urgent</span>' : ''}<small>${esc(t.msg.slice(0, 90))}${t.msg.length > 90 ? '…' : ''}</small>`, (t.tier === 'priority' ? '<span class="badge b-admin">Priority</span> ' : '') + (t.status === 'open' ? '<span class="badge b-pending">Waiting</span>' : t.status === 'answered' ? '<span class="badge b-verified">Answered</span>' : '<span class="badge b-off">Closed</span>'), t.status !== 'closed' ? `<button class="btn btn-primary btn-sm" type="button" data-act="tk-reply" data-id="${esc(t.id)}">Reply</button>` : '']), ['No requests yet', ''])}</section>`;
};

/* ---------- 6. Bulk member import ---------- */
function csvRows(text) {
  const t = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim(); if (!t) return []; const first = t.split('\n')[0], d = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === d) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c; }
  row.push(cur); rows.push(row); return rows.filter(r => r.some(x => String(x).trim()));
}
function importCheck(text) {
  const raw = csvRows(text); if (!raw.length) return { rows: [], error: 'Paste or upload a list first.' }; let map = { name: 0, phone: 1, family: 2, kindred: 3, email: 4 }, body = raw;
  const h = raw[0].map(x => String(x).trim().toLowerCase()); if (h.some(x => /^(full\s*)?name$/.test(x))) { map = {}; h.forEach((x, i) => { if (/^(full\s*)?name$/.test(x)) map.name = i; else if (/phone|mobile|whatsapp/.test(x)) map.phone = i; else if (/family/.test(x)) map.family = i; else if (/kindred|kin/.test(x)) map.kindred = i; else if (/mail/.test(x)) map.email = i; }); body = raw.slice(1); }
  if (map.name === undefined) return { rows: [], error: 'The list needs a Name column.' }; if (body.length > 300) return { rows: [], error: 'Import up to 300 members at a time.' };
  const have = new Set(S.v.users.map(u => waNum(u.phone)).filter(x => x.length >= 12)), names = new Set(S.v.users.map(u => (u.name || '').trim().toLowerCase())), seen = new Set(), village = isVillageType();
  const rows = body.map((r, i) => { const g = k => map[k] === undefined ? '' : String(r[map[k]] || '').trim(), x = { n: i + 1, name: g('name').replace(/\s+/g, ' '), phone: g('phone'), family: village ? g('family') : '', kindred: village ? g('kindred') : '', email: g('email'), errs: [], warn: [] }, wn = waNum(x.phone);
    if (x.name.length < 3 || x.name.length > 80) x.errs.push('Name needs 3 to 80 letters'); if (x.phone && (wn.length < 12 || wn.length > 15)) x.errs.push('Phone number looks wrong'); if (x.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) x.errs.push('Email looks wrong');
    if (wn.length >= 12) { if (have.has(wn)) x.errs.push('Phone already on the register'); else if (seen.has(wn)) x.errs.push('Same phone as a row above'); seen.add(wn); }
    if (!x.errs.length && names.has(x.name.toLowerCase())) x.warn.push('A member with this name exists'); return x; });
  return { rows };
}
Object.assign(API, {
  async importMembers(rows) {
    requireAdmin(); assertFeature('bulkImport', 'Bulk member import'); const chk = importCheck(rows.map(r => [r.name, r.phone, r.family, r.kindred, r.email].map(x => '"' + String(x || '').replace(/"/g, '""') + '"').join(',')).join('\n')), ok = chk.rows.filter(r => !r.errs.length);
    if (!ok.length) throw new Error('There is nothing valid to import.'); const out = [];
    for (const r of ok) { const id = nextId('mbr', 'M'), pw = 'Vv' + Math.floor(100000 + Math.random() * 899999), h = await hashPw(S.v.id, id, pw);
      S.v.users.push({ id, name: r.name, role: 'member', title: 'Member', family: r.family, kindred: r.kindred, phone: r.phone, email: r.email, joined: today(), active: true, hash: h, mustChange: true, tempPw: pw, createdBy: S.u.name, createdAt: stamp(), imported: true }); S.v.credLog.push({ memberId: id, by: S.u.name, at: stamp(), kind: 'issued' }); out.push({ id, name: r.name, phone: r.phone, pw }); }
    log('Imported members', 'Members', `${out.length} member${out.length === 1 ? '' : 's'} added from a list`); commit(); return out;
  }
});
let IM = null;
const IM_TEMPLATE = 'Name,Phone,Family,Kindred,Email\nChinedu Okeke,08030000001,Okeke,Umuagu,\nNgozi Ade,08030000002,Ade,Umuchi,ngozi@example.com\n';
function importStep1(msg) {
  openModal({ title: 'Import members from a list', size: 'modal-lg', sub: 'Paste from Excel or upload a CSV file. One member per row.', submit: 'Check the list',
    body: `<p class="hint">Columns: Name, Phone, Family, Kindred, Email. Only Name is required. In Excel use Save as CSV, or copy the cells and paste them below.</p><div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="im-template">Download a template</button></div>
    <div class="field"><label for="imF">CSV file</label><input id="imF" name="file" class="input" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain"></div><div class="field"><label for="imT">Or paste the list here</label><textarea id="imT" name="text" class="input mono" rows="7" placeholder="Name,Phone,Family,Kindred">${esc(msg || '')}</textarea></div>`,
    onSubmit: async fd => { const f = fd.get('file'); let text = (fd.get('text') || '').trim(); if (f && f.size) { if (f.size > 400000) throw new Error('That file is too large. Use a list of up to 300 members.'); text = await f.text(); } const r = importCheck(text); if (r.error) throw new Error(r.error); IM = { rows: r.rows, text }; setTimeout(importStep2, 0); } });
}
function importStep2() {
  const ok = IM.rows.filter(r => !r.errs.length), bad = IM.rows.length - ok.length;
  openModal({ title: 'Check before importing', size: 'modal-lg', sub: `${ok.length} ready, ${bad} with a problem`, submit: ok.length ? `Import ${ok.length} member${ok.length === 1 ? '' : 's'}` : false,
    body: `${bad ? '<p class="hint">Rows with a problem are skipped. Fix them in your list and import again.</p>' : '<p class="hint">Every row looks good. Members get a temporary password they must change at first sign-in.</p>'}${table(['#', 'Name', 'Phone', 'Family and kindred', 'Check'], IM.rows.slice(0, 120).map(r => [String(r.n), esc(r.name), esc(r.phone || '-'), esc([r.family, r.kindred].filter(Boolean).join(', ') || '-'), r.errs.length ? `<span class="badge b-rejected">${esc(r.errs.join('. '))}</span>` : r.warn.length ? `<span class="badge b-pending">${esc(r.warn[0])}</span>` : '<span class="badge b-verified">Ready</span>']), ['', ''])}${IM.rows.length > 120 ? `<p class="hint">Showing the first 120 of ${IM.rows.length} rows.</p>` : ''}<div class="btn-row"><button class="btn btn-ghost btn-sm" type="button" data-act="im-back">Back to the list</button></div>`,
    onSubmit: async () => { const out = await API.importMembers(ok); IM = { done: out }; setTimeout(importStep3, 0); } });
}
function importStep3() {
  const o = IM.done; infoModal('Import finished', `${o.length} member${o.length === 1 ? '' : 's'} added`, `<p class="hint" style="margin-top:12px">Download the login sheet now and give each member their ID and temporary password. You can also send them later from the member’s profile.</p><div class="btn-row"><button class="btn btn-primary" type="button" data-act="im-sheet">Download login sheet (CSV)</button></div>${table(['Member', 'ID', 'Temporary password'], o.slice(0, 60).map(m => [esc(m.name), `<span class="mono">${esc(m.id)}</span>`, `<span class="mono">${esc(m.pw)}</span>`]), ['', ''])}${o.length > 60 ? `<p class="hint">The sheet has all ${o.length}.</p>` : ''}`);
  renderView();
}
Object.assign(ACTIONS, {
  'im-open'() { if (!isAdmin()) return; if (!planAllows('bulkImport')) return featureModal('Bulk member import'); IM = null; importStep1(); },
  'im-back'() { importStep1(IM && IM.text); },
  'im-template'() { download('VillageVault-member-template.csv', new Blob([IM_TEMPLATE], { type: 'text/csv' })); },
  'im-sheet'() { if (!IM || !IM.done) return; const q = x => '"' + String(x || '').replace(/"/g, '""') + '"'; download(`${S.v.code}-login-sheet.csv`, new Blob(['﻿' + ['Name,ID,Phone,Temporary password,Village'].concat(IM.done.map(m => [m.name, m.id, m.phone, m.pw, S.v.name].map(q).join(','))).join('\n') + '\n'], { type: 'text/csv' })); }
});

/* ---------- Navigation, pages and banners ---------- */
NAV.admin.push(['review', 'Year in review', 'list'], ['support', 'Help desk', 'book']);
NAV.member.push(['review', 'Year in review', 'list']);
NAV.owner.push(['o-support', 'Support requests', 'book']);
Object.assign(TITLES, { review: 'Village year in review', support: 'Help desk', 'o-support': 'Support requests' });
VIEWS.admin.review = VIEWS.member.review = reviewView; VIEWS.admin.support = supportView;
{ const _ao = VIEWS.admin.overview, _mo = VIEWS.member.overview, _ap = VIEWS.admin.plans, _mp = VIEWS.member.plans;
  VIEWS.admin.overview = function () { return trialBanner() + (S.v.plan !== 'premium' ? capNotice() : '') + _ao.apply(this, arguments); };
  VIEWS.member.overview = function () { return _mo.apply(this, arguments); };
  if (_ap) VIEWS.admin.plans = function () { return trialBanner() + _ap.apply(this, arguments); }; }
{ const _rn = renderNav; renderNav = function () { _rn.apply(this, arguments); try { if (roleKey() === 'owner') { const n = SUP.open().filter(t => t.status === 'open').length, b = $('#navlist [data-page="o-support"]'); if (b && n) b.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`); } } catch (_) {} }; }
{ const _rv = renderView; renderView = function () { checkTrial(); return _rv.apply(this, arguments); }; }
