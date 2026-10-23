'use strict';
/* =====================================================================
   HOME — today, what needs attention, the week ahead, and the + menu
   ===================================================================== */
// Everything that needs the trainer, most urgent first. `late` shows red; `quiet` items (birthdays)
// don't count toward the badge on Home.
function attentionItems() {
  const today = ymd(), out = [], clients = Store.get('clients');
  const live = clients.filter(c => (c.status || 'active') === 'active');
  const btn = (label, attrs) => `<button class="btn btn-sm" ${attrs}>${label}</button>`;
  for (const c of clients.filter(c => c.status !== 'past' && parqStatus(c).state === 'clearance'))
    out.push({ late: true, icon: 'heart-pulse', client: c, text: 'Needs medical clearance before training', act: btn('Record', `data-action="parqOpen" data-id="${c.id}"`) });
  for (const a of Store.get('appointments').filter(a => !a.sessionId && a.date < today && a.date >= addDays(today, -14)).sort((a, b) => a.date.localeCompare(b.date))) {
    const c = byId('clients', a.clientId); if (!c) continue;
    out.push({ late: true, icon: 'calendar-x', client: c, text: `Booked session on ${fmtDay(a.date)} isn’t logged`, act: btn('Log it', `data-action="sessionStartOpen" data-client="${c.id}" data-appt="${a.id}" data-date="${a.date}"`) + btn('Remove', `data-action="apptCancel" data-id="${a.id}"`) });
  }
  for (const c of live) {
    const hs = parqStatus(c), p = activeProgram(c.id), pkgs = packagesFor(c.id), pkg = currentPackage(c.id), last = lastSession(c.id), next = upcomingFor(c.id)[0];
    if (hs.state === 'missing') out.push({ icon: 'clipboard-check', client: c, text: 'Health screening not recorded', act: btn('Record', `data-action="parqOpen" data-id="${c.id}"`) });
    if (!isYmd(c.waiver)) out.push({ icon: 'file-warning', client: c, text: 'No signed waiver on file', act: btn('Mark signed', `data-action="clientPaper" data-id="${c.id}" data-f="waiver"`) });
    if (pkg && pkgLeft(pkg) <= 2) out.push({ icon: 'ticket', client: c, text: `${plural(pkgLeft(pkg), 'session')} left in ${pkg.name}`, act: btn('Packages', `data-action="clientOpenTab" data-id="${c.id}" data-tab="packages"`) });
    else if (!pkg && pkgs.length) out.push({ icon: 'ticket', client: c, text: 'Package used up', act: btn('Packages', `data-action="clientOpenTab" data-id="${c.id}" data-tab="packages"`) });
    if (!p) out.push({ icon: 'clipboard-list', client: c, text: 'No program assigned', act: btn('Assign', `data-action="assignOpen" data-client="${c.id}"`) });
    else { const end = programEnd(p); if (end && end < today) out.push({ icon: 'flag', client: c, text: `${p.name} finished ${fmtDay(end)}: plan the next block`, act: btn('Program', `data-action="clientOpenTab" data-id="${c.id}" data-tab="program"`) });
      else if (end && daysBetween(today, end) <= 7) out.push({ icon: 'flag', client: c, text: `${p.name} ends ${fmtDay(end)}`, act: btn('Program', `data-action="clientOpenTab" data-id="${c.id}" data-tab="program"`) }); }
    const since = last ? last.date : (c.created || '').slice(0, 10);
    if (isYmd(since) && !next && daysBetween(since, today) >= 14) out.push({ icon: 'moon', client: c, text: last ? `No session in ${daysBetween(since, today)} days` : 'No sessions yet', act: btn('Schedule', `data-action="apptNew" data-client="${c.id}"`) });
  }
  for (const c of clients.filter(c => c.status !== 'past' && isYmd(c.birthday))) {
    const [, m, d] = c.birthday.split('-'); let bd = `${today.slice(0, 4)}-${m}-${d}`; if (bd < today) bd = `${+today.slice(0, 4) + 1}-${m}-${d}`;
    if (isYmd(bd) && daysBetween(today, bd) <= 7) out.push({ quiet: true, icon: 'cake', client: c, text: bd === today ? 'Birthday today' : `Birthday ${fmtDay(bd)}`, act: '' });
  }
  if (clients.length && (!S.lastExport || daysBetween(S.lastExport.slice(0, 10), today) >= 7))
    out.push({ icon: 'hard-drive-download', text: S.lastExport ? `Last backup ${fmtDate(S.lastExport.slice(0, 10))}` : 'No backup downloaded yet', sub: 'Client records live only on this device until sync is set up.', act: btn('Back up now', 'data-action="backupNow"') });
  return out;
}

function renderHome() {
  const today = ymd(), clients = Store.get('clients'), s = Store.get('activeSession');
  const appts = Store.get('appointments').filter(a => byId('clients', a.clientId));
  const todays = appts.filter(a => a.date === today).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const soon = appts.filter(a => a.date > today && a.date <= addDays(today, 7) && !a.sessionId).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  const sessions = Store.get('sessions'), week = sessions.filter(x => x.date >= startOfWeek(today)).length, month = sessions.filter(x => x.date >= today.slice(0, 8) + '01').length;
  const items = attentionItems();
  const hello = `${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}${S.trainer ? ', ' + esc(S.trainer.split(' ')[0]) : ''}`;
  if (!clients.length) return `<h2 class="text-xl font-semibold mb-1">${hello}</h2><p class="muted mb-5">${esc(S.business || 'Coach Desk')} keeps your clients, programs and sessions on this device.</p>
    <div class="card space-y-3">${cardHead('rocket', 'Getting started')}
      <ol class="space-y-3 text-sm">
        <li class="flex gap-3"><span class="chip shrink-0">1</span><div><strong>Add your first client.</strong> Their goals, limits, PAR-Q+ health screening and waiver go on their page.<div class="mt-2"><button class="btn btn-sm btn-primary" data-action="clientNew">${icon('user-plus')} Add a client</button></div></div></li>
        <li class="flex gap-3"><span class="chip shrink-0">2</span><div><strong>Look at the sample templates.</strong> Adjust one or write your own, then assign it.<div class="mt-2"><button class="btn btn-sm" data-action="go" data-view="programs">${icon('clipboard-list')} Programs</button></div></div></li>
        <li class="flex gap-3"><span class="chip shrink-0">3</span><div><strong>Run a session.</strong> Last time’s numbers and the next weight are shown for every exercise.</div></li>
        <li class="flex gap-3"><span class="chip shrink-0">4</span><div><strong>Add your name and business</strong> for program sheets, and download a backup each week.<div class="mt-2"><button class="btn btn-sm" data-action="openSettings">${icon('settings')} Settings</button></div></div></li>
      </ol></div>`;
  const apptRow = a => { const c = byId('clients', a.clientId); return `<li class="flex flex-wrap items-center gap-2 py-2">
      <span class="w-20 shrink-0 text-sm tabular-nums ${a.date === today ? 'font-semibold' : 'muted'}">${a.date === today ? (a.time ? esc(fmtTime(a.time)) : 'Today') : esc(fmtDate(a.date, { weekday: 'short', day: 'numeric' }))}</span>
      <button class="flex items-center gap-2 min-w-0 flex-1 text-left" data-action="clientOpen" data-id="${c.id}">${avatar(c.name, 'w-7 h-7 text-xs')}<span class="truncate">${esc(c.name)}</span></button>
      ${a.sessionId ? `<span class="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">${icon('check', 'w-3 h-3')} Logged</span>`
        : a.date === today ? `<button class="btn btn-sm btn-primary" data-action="sessionStartOpen" data-client="${c.id}" data-appt="${a.id}">${icon('play')} Start</button>` : (a.time ? `<span class="text-xs muted">${esc(fmtTime(a.time))}</span>` : '')}
    </li>`; };
  return `<h2 class="text-xl font-semibold mb-4">${hello}</h2>
    ${s ? `<div class="card mb-4 border-brand-300 dark:border-brand-800 flex flex-wrap items-center gap-3">${icon('activity', 'w-5 h-5 text-brand-600')}<div class="flex-1 min-w-0"><strong>Session in progress</strong> <span class="muted">· ${esc(clientName(s.clientId))}, ${esc(s.dayName)}</span></div><button class="btn btn-primary" data-action="go" data-view="session">Resume</button></div>` : ''}
    <div class="grid grid-cols-3 gap-2 mb-4">
      <div class="stat"><div class="text-2xl font-semibold tabular-nums">${clients.filter(c => (c.status || 'active') === 'active').length}</div><div class="text-xs muted">active clients</div></div>
      <div class="stat"><div class="text-2xl font-semibold tabular-nums">${week}</div><div class="text-xs muted">sessions this week</div></div>
      <div class="stat"><div class="text-2xl font-semibold tabular-nums">${month}</div><div class="text-xs muted">this month</div></div>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="card">${cardHead('calendar', 'Today', `<button class="btn btn-sm" data-action="apptNew" data-date="${today}">${icon('plus')} Book</button>`)}
        ${todays.length ? `<ul class="divide-y divide-slate-100 dark:divide-slate-800">${todays.map(apptRow).join('')}</ul>` : `<p class="text-sm muted">Nothing booked today.</p><button class="btn btn-sm mt-3" data-action="sessionStartOpen">${icon('play')} Start a session anyway</button>`}</div>
      <div class="card">${cardHead('bell', 'Needs attention')}
        ${items.length ? `<ul class="divide-y divide-slate-100 dark:divide-slate-800">${pageOf('attn', items).map(x => `<li class="py-2 flex flex-wrap items-center gap-2">
            <span class="w-7 h-7 shrink-0 rounded-lg grid place-items-center ${x.late ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200' : 'bg-slate-100 dark:bg-slate-800 muted'}">${icon(x.icon, 'w-4 h-4')}</span>
            <div class="min-w-0 flex-1 text-sm">${x.client ? `<button class="font-medium hover:underline" data-action="clientOpen" data-id="${x.client.id}">${esc(x.client.name)}</button><div class="muted">${esc(x.text)}</div>` : `<div class="font-medium">${esc(x.text)}</div>${x.sub ? `<div class="muted">${esc(x.sub)}</div>` : ''}`}</div>
            <div class="flex gap-1">${x.act}</div></li>`).join('')}</ul>${moreBtn('attn', items)}` : `<p class="text-sm muted">${icon('circle-check', 'w-4 h-4 inline -mt-0.5 text-emerald-600')} All caught up.</p>`}</div>
      <div class="card md:col-span-2">${cardHead('calendar-days', 'Next 7 days')}
        ${soon.length ? `<ul class="divide-y divide-slate-100 dark:divide-slate-800">${soon.slice(0, 30).map(apptRow).join('')}</ul>` : '<p class="text-sm muted">Nothing booked this week.</p>'}</div>
    </div>`;
}

const QUICK_ADD = [['session', 'Start a session', 'play'], ['appt', 'Schedule a session', 'calendar-plus'], ['client', 'Add a client', 'user-plus'], ['template', 'New program template', 'clipboard-plus']];
function quickAddSheet() {
  Modal.open(modalShell('Add or start', `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${QUICK_ADD.map(([k, l, ic]) => `<button type="button" class="btn justify-start gap-3 py-3 text-base" data-action="qaPick" data-what="${k}">${icon(ic, 'w-5 h-5 shrink-0 text-brand-700 dark:text-brand-300')}<span class="min-w-0 text-left">${l}</span></button>`).join('')}</div>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button>`));
}

const A_HOME = {
  quickAdd: () => { closeSidebar(); quickAddSheet(); },
  qaPick: el => {
    const w = el.dataset.what;
    if (w === 'session') startModal(ui.clientId || '');
    else if (w === 'appt') apptModal({ clientId: ui.clientId || '' });
    else if (w === 'client') clientModal(null);
    else if (w === 'template') A.tplNew();
  },
  clientOpenTab: el => openClient(el.dataset.id, el.dataset.tab)
};
