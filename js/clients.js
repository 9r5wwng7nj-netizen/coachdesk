'use strict';
/* =====================================================================
   CLIENTS — list, client page, intake, health screening (PAR-Q+),
   packages, appointments, notes, export and delete
   ===================================================================== */
const CLIENT_STATUS = { active: 'Active', lead: 'Lead', paused: 'Paused', past: 'Past' };
const WHERE = { 'in-person': 'In person', online: 'Online', both: 'In person and online' };
// Short summaries of the seven PAR-Q+ general health questions. The client answers the official form;
// the trainer records which ones were "yes". Any "yes" means follow-up or a doctor's clearance first.
const PARQ = [
  [1, 'Heart condition or high blood pressure diagnosed by a doctor'],
  [2, 'Chest pain at rest, in daily activities or during physical activity'],
  [3, 'Loses balance from dizziness, or lost consciousness in the last 12 months'],
  [4, 'Another chronic medical condition diagnosed'],
  [5, 'Takes prescribed medication for a chronic condition'],
  [6, 'Bone, joint or soft-tissue problem (last 12 months) that more activity could worsen'],
  [7, 'Told by a doctor to do only medically supervised activity']
];
const PARQ_LINK = 'https://eparmedx.com/';
function parqStatus(c) {
  const q = c.parq || {};
  if (!isYmd(q.date)) return { state: 'missing', text: 'Health screening not recorded' };
  if ((q.yes || []).length && !isYmd(q.cleared)) return { state: 'clearance', text: 'Needs medical clearance before training' };
  return { state: 'ok', text: (q.yes || []).length ? `Cleared ${fmtDate(q.cleared)}` : `No concerns · ${fmtDate(q.date)}` };
}
const clientName = id => byId('clients', id)?.name || 'Former client';
const firstName = id => clientName(id).split(' ')[0];
const sessionsFor = clientId => Store.get('sessions').filter(s => s.clientId === clientId).sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')));
const lastSession = clientId => sessionsFor(clientId)[0] || null;
const packagesFor = clientId => Store.get('packages').filter(p => p.clientId === clientId).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
const pkgUsed = pkg => (pkg.usedBefore || 0) + Store.get('sessions').filter(s => s.packageId === pkg.id).length;
const pkgLeft = pkg => Math.max(0, (pkg.sessions || 0) - pkgUsed(pkg));
const pkgExpired = pkg => isYmd(pkg.expires) && pkg.expires < ymd();
const pkgActive = pkg => pkgLeft(pkg) > 0 && !pkgExpired(pkg);
const currentPackage = clientId => packagesFor(clientId).find(pkgActive) || null;
const apptsFor = clientId => Store.get('appointments').filter(a => a.clientId === clientId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
const upcomingFor = clientId => apptsFor(clientId).filter(a => a.date >= ymd() && !a.sessionId);
function openClient(id, tab = 'overview') {
  S.view = 'clients'; ui.clientId = id; ui.clientTab = tab; ui.tplId = null; ui.more = {};
  saveSettings(); closeSidebar(); lastRendered = null; render();
  if (!Modal.isOpen()) $('#view-title').focus({ preventScroll: true });
}
const statusChip = c => `<span class="chip ${c.status === 'active' ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : c.status === 'lead' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : ''}">${CLIENT_STATUS[c.status] || 'Active'}</span>`;
function apptLabel(a) { return `${a.date === ymd() ? 'Today' : a.date === addDays(ymd(), 1) ? 'Tomorrow' : fmtDay(a.date)}${a.time ? ' ' + fmtTime(a.time) : ''}`; }

/* ---------- Clients list ---------- */
function renderClients() {
  const c = ui.clientId && byId('clients', ui.clientId);
  if (c) return clientPage(c);
  ui.clientId = null;
  const all = Store.get('clients'), q = ui.clientQ.trim().toLowerCase();
  const counts = Object.fromEntries(Object.keys(CLIENT_STATUS).map(k => [k, all.filter(x => (x.status || 'active') === k).length]));
  const list = all.filter(x => (ui.clientFilter === 'all' || (x.status || 'active') === ui.clientFilter) && (!q || [x.name, x.email, x.phone, x.goals].some(v => String(v || '').toLowerCase().includes(q))))
    .sort((a, b) => a.name.localeCompare(b.name));
  const chip = (id, label, n) => `<button class="chip ${ui.clientFilter === id ? 'chip-on' : ''}" aria-pressed="${ui.clientFilter === id}" data-action="clFilter" data-v="${id}">${label}${n != null ? ` · ${n}` : ''}</button>`;
  if (!all.length) return emptyState('users', 'No clients yet', 'Add a client to keep their goals, health screening, program and sessions in one place.', `<button class="btn btn-primary" data-action="clientNew">${icon('user-plus')} Add a client</button>`);
  return `<div class="flex flex-wrap items-center gap-2 mb-3">
      <input id="cl-q" class="input flex-1 min-w-[12rem]" type="search" placeholder="Search clients" value="${esc(ui.clientQ)}" data-input="clSearch" autocomplete="off">
      <button class="btn btn-primary" data-action="clientNew">${icon('user-plus')} Add a client</button>
    </div>
    <div class="flex flex-wrap gap-1.5 mb-4">${chip('active', 'Active', counts.active)}${chip('lead', 'Leads', counts.lead)}${chip('paused', 'Paused', counts.paused)}${chip('past', 'Past', counts.past)}${chip('all', 'All')}</div>
    ${list.length ? `<div class="card p-0 divide-y divide-slate-100 dark:divide-slate-800">${list.map(clientRow).join('')}</div>`
      : `<p class="text-sm muted">No clients match.</p>`}`;
}
function clientRow(c) {
  const next = upcomingFor(c.id)[0], pkg = currentPackage(c.id), hs = parqStatus(c), prog = activeProgram(c.id);
  const sub = [next ? `Next: ${apptLabel(next)}` : 'No session booked', prog ? prog.name : ''].filter(Boolean).join(' · ');
  return `<button class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60" data-action="clientOpen" data-id="${c.id}">
    ${avatar(c.name)}
    <div class="min-w-0 flex-1"><div class="font-medium truncate">${esc(c.name)}</div><div class="text-xs muted truncate">${esc(sub)}</div></div>
    <div class="flex items-center gap-1 shrink-0">
      ${hs.state === 'clearance' ? `<span class="chip bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200" title="${hs.text}">${icon('heart-pulse', 'w-3 h-3')}<span class="sr-only">${hs.text}</span></span>` : ''}
      ${pkg ? `<span class="chip tabular-nums">${pkgLeft(pkg)} left</span>` : ''}
      ${c.status !== 'active' ? statusChip(c) : ''}
    </div>
  </button>`;
}

/* ---------- One client's page ---------- */
function clientPage(c) {
  const hs = parqStatus(c), prog = activeProgram(c.id);
  const contact = [c.phone ? `<a class="underline" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a>` : '', c.email ? `<a class="underline break-all" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''].filter(Boolean).join(' · ');
  const head = `<div class="flex flex-wrap items-center gap-2 mb-4"><button class="btn btn-sm" data-action="go" data-view="clients">${icon('arrow-left')} Clients</button></div>
    <div class="card mb-4"><div class="flex items-center gap-3">
      ${avatar(c.name, 'w-12 h-12 text-base')}
      <div class="min-w-0 flex-1"><h2 class="text-lg font-semibold truncate">${esc(c.name)}</h2>
        <div class="flex flex-wrap items-center gap-1.5 mt-0.5">${statusChip(c)}${c.where ? `<span class="chip">${esc(WHERE[c.where] || '')}</span>` : ''}${prog ? `<span class="chip">${esc(prog.name)}</span>` : ''}</div>
        ${contact ? `<div class="text-sm muted mt-1">${contact}</div>` : ''}</div>
    </div>
    <div class="flex flex-wrap gap-2 mt-3">
      <button class="btn btn-primary" data-action="sessionStartOpen" data-client="${c.id}">${icon('play')} Start session</button>
      <button class="btn" data-action="apptNew" data-client="${c.id}">${icon('calendar-plus')} Schedule</button>
      <button class="btn" data-action="clientEdit" data-id="${c.id}">${icon('pencil')} Edit details</button>
    </div></div>
    ${hs.state === 'clearance' ? `<div class="card mb-4 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40"><div class="flex items-start gap-2 text-sm">${icon('heart-pulse', 'w-5 h-5 text-rose-600 shrink-0')}<div><strong>Get medical clearance before training.</strong> ${esc(c.name.split(' ')[0])} answered yes to ${plural(c.parq.yes.length, 'PAR-Q+ question')}. Sessions stay locked until you record the clearance date.<div class="mt-2"><button class="btn btn-sm" data-action="parqOpen" data-id="${c.id}">Record clearance</button></div></div></div></div>` : ''}`;
  const t = ui.clientTab;
  const body = t === 'program' ? clientProgramTab(c) : t === 'sessions' ? clientSessionsTab(c) : t === 'packages' ? clientPackagesTab(c) : clientOverview(c, hs);
  return head + tabs('clientTab', [['overview', 'Overview', 'user'], ['program', 'Program', 'clipboard-list'], ['sessions', 'Sessions', 'history'], ['packages', 'Packages', 'ticket']]) + body;
}
function clientOverview(c, hs) {
  const q = c.parq || {}, upcoming = upcomingFor(c.id), notes = [...(c.notes || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const pill = hs.state === 'ok' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : hs.state === 'clearance' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200';
  const text = (v, empty) => v ? `<p class="text-sm whitespace-pre-line">${esc(v)}</p>` : `<p class="text-sm muted">${empty}</p>`;
  const paper = (label, date, f) => `<div class="flex items-center gap-2 text-sm py-1"><span class="flex-1">${label}</span>${isYmd(date) ? `<span class="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">${fmtDate(date)}</span>` : `<button class="btn btn-sm" data-action="clientPaper" data-id="${c.id}" data-f="${f}">Mark signed today</button>`}</div>`;
  return `<div class="grid md:grid-cols-2 gap-4">
    <div class="card">${cardHead('target', 'Goals')}${text(c.goals, 'No goals written yet.')}
      ${c.history ? `<div class="label mt-3">Training background</div>${text(c.history)}` : ''}</div>
    <div class="card">${cardHead('shield-alert', 'Injuries and limits')}${text(c.limits, 'None recorded.')}</div>
    <div class="card">${cardHead('heart-pulse', 'Health screening', `<button class="btn btn-sm" data-action="parqOpen" data-id="${c.id}">${isYmd(q.date) ? 'Update' : 'Record'}</button>`)}
      <span class="chip ${pill}">${esc(hs.text)}</span>
      ${(q.yes || []).length ? `<ul class="text-sm list-disc pl-5 mt-2 space-y-0.5">${PARQ.filter(([n]) => q.yes.includes(n)).map(([, t]) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${q.note ? `<p class="text-sm mt-2 whitespace-pre-line">${esc(q.note)}</p>` : ''}
      ${!isYmd(q.date) ? `<p class="text-sm muted mt-2">Have ${esc(c.name.split(' ')[0])} fill in the PAR-Q+ before the first session, then record the answers here.</p>` : ''}</div>
    <div class="card">${cardHead('file-check', 'Paperwork')}${paper('Waiver signed', c.waiver, 'waiver')}${paper('Consent to keep their records', c.consent, 'consent')}</div>
    <div class="card">${cardHead('calendar', 'Booked sessions', `<button class="btn btn-sm" data-action="apptNew" data-client="${c.id}">${icon('plus')} Schedule</button>`)}
      ${upcoming.length ? `<ul class="divide-y divide-slate-100 dark:divide-slate-800">${upcoming.slice(0, 8).map(a => `<li class="flex items-center gap-2 py-2 text-sm"><span class="flex-1">${esc(apptLabel(a))}${a.note ? ` <span class="muted">· ${esc(a.note)}</span>` : ''}</span><button class="btn btn-ghost btn-sm" data-action="apptCancel" data-id="${a.id}" aria-label="Cancel the session on ${esc(apptLabel(a))}">${icon('x')}</button></li>`).join('')}</ul>${upcoming.length > 8 ? `<p class="text-xs muted mt-1">and ${upcoming.length - 8} more</p>` : ''}` : '<p class="text-sm muted">Nothing booked.</p>'}</div>
    <div class="card">${cardHead('phone', 'Contact and emergency')}
      <dl class="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt class="muted">Phone</dt><dd>${esc(c.phone || '–')}</dd><dt class="muted">Email</dt><dd class="break-all">${esc(c.email || '–')}</dd>
        <dt class="muted">Birthday</dt><dd>${isYmd(c.birthday) ? esc(fmtDate(c.birthday, { month: 'long', day: 'numeric' })) : '–'}</dd>
        <dt class="muted">Emergency</dt><dd>${esc([c.emergency?.name, c.emergency?.phone].filter(Boolean).join(' · ') || '–')}</dd>
      </dl></div>
    <div class="card md:col-span-2">${cardHead('notebook-pen', 'Notes')}
      <form data-submit="noteAdd" class="flex gap-2 mb-3"><input type="hidden" name="id" value="${c.id}"><input name="text" class="input flex-1" placeholder="Add a note (what they told you, how they’re feeling)" autocomplete="off" aria-label="New note"><button class="btn btn-primary">${icon('plus')}<span class="sr-only">Add note</span></button></form>
      ${notes.length ? `<ul class="space-y-2">${notes.map(n => `<li class="flex items-start gap-2 text-sm"><span class="chip shrink-0">${esc(fmtDate(n.date, { month: 'short', day: 'numeric' }))}</span><span class="flex-1 whitespace-pre-line">${esc(n.text)}</span><button class="btn btn-ghost btn-sm" data-action="noteDel" data-id="${c.id}" data-note="${n.id}" aria-label="Delete note">${icon('x')}</button></li>`).join('')}</ul>` : '<p class="text-sm muted">No notes yet.</p>'}</div>
  </div>
  <div class="flex flex-wrap gap-2 mt-6">
    <button class="btn" data-action="clientExport" data-id="${c.id}">${icon('download')} Download their records</button>
    <button class="btn btn-danger" data-action="clientDelete" data-id="${c.id}">${icon('trash-2')} Delete client</button>
  </div>`;
}
function clientProgramTab(c) {
  const p = activeProgram(c.id), past = Store.get('programs').filter(x => x.clientId === c.id && x.status !== 'active').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  const pastHtml = past.length ? `<div class="card mt-6">${cardHead('archive', 'Past programs')}<ul class="divide-y divide-slate-100 dark:divide-slate-800">${past.map(x => `<li class="flex flex-wrap items-center gap-2 py-2 text-sm"><span class="flex-1 min-w-0"><strong>${esc(x.name)}</strong> <span class="muted">${isYmd(x.start) ? esc(fmtDate(x.start)) : ''}${x.ended ? ' to ' + esc(fmtDate(x.ended)) : ''}</span></span><button class="btn btn-sm" data-action="sheetOpen" data-id="${x.id}">${icon('file-text')} Sheet</button><button class="btn btn-sm" data-action="progReuse" data-id="${x.id}">${icon('rotate-ccw')} Use again</button></li>`).join('')}</ul></div>` : '';
  if (!p) return emptyState('clipboard-list', 'No program yet', `Give ${esc(c.name.split(' ')[0])} one of your templates, or build one just for them.`,
    `<button class="btn btn-primary" data-action="assignOpen" data-client="${c.id}">${icon('copy-plus')} Assign a template</button><button class="btn" data-action="progBlank" data-client="${c.id}">${icon('plus')} Start a blank program</button>`) + pastHtml;
  const next = nextDay(p), wk = programWeek(p);
  return `<div class="card mb-4"><div class="flex flex-wrap items-center gap-2">
      <div class="min-w-0 flex-1"><div class="font-semibold">${esc(p.name)}</div><div class="text-sm muted">${esc(progDates(p))}</div></div>
      ${isDeload(p, wk) ? '<span class="chip bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">Lighter week</span>' : ''}
    </div>
    <div class="flex flex-wrap gap-2 mt-3">
      ${next ? `<button class="btn btn-primary" data-action="sessionStartOpen" data-client="${c.id}">${icon('play')} Start ${esc(next.name)}</button>` : ''}
      <button class="btn" data-action="sheetOpen" data-id="${p.id}">${icon('file-text')} Program sheet</button>
      <button class="btn" data-action="assignOpen" data-client="${c.id}">${icon('copy-plus')} New program</button>
      <button class="btn" data-action="progSaveAsTemplate" data-id="${p.id}">${icon('bookmark-plus')} Save as template</button>
      <button class="btn btn-danger" data-action="progEnd" data-id="${p.id}">${icon('flag')} End program</button>
    </div></div>
    ${editorHtml(p, 'prog')}${pastHtml}`;
}
function setsText(item) {
  const cols = typeCols(exFor(item)?.type || item.type);
  return (item.sets || []).map(s => {
    if (cols.includes('distance')) return [s.dist != null ? `${distDisp(s.dist)} ${distUnit()}` : '', s.d ? fmtClock(s.d) : ''].filter(Boolean).join(' in ');
    if (cols.includes('duration')) return [s.w != null ? wDisp(s.w) + ' ' + S.unit : '', s.d ? fmtClock(s.d) : ''].filter(Boolean).join(' × ');
    return s.w != null && cols.includes('weight') ? `${wDisp(s.w)}×${s.r ?? '–'}` : `${s.r ?? '–'} reps`;
  }).join(', ');
}
function clientSessionsTab(c) {
  const list = sessionsFor(c.id);
  if (!list.length) return emptyState('history', 'No sessions logged yet', 'Sessions you run in session mode show up here, with every set.', `<button class="btn btn-primary" data-action="sessionStartOpen" data-client="${c.id}">${icon('play')} Start a session</button>`);
  const month = list.filter(s => s.date >= ymd().slice(0, 8) + '01').length;
  return `<p class="text-sm muted mb-3">${plural(list.length, 'session')} logged, ${month} this month.</p>
    <div class="space-y-2">${pageOf('sess', list).map(s => {
      const sets = sum(s.items.map(i => i.sets.length)), pkg = s.packageId && byId('packages', s.packageId);
      return `<details class="card p-0"><summary class="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-2"><span class="font-medium">${esc(fmtDay(s.date))}</span><span class="text-sm muted flex-1 min-w-0 truncate">${esc(s.dayName || 'Session')} · ${plural(sets, 'set')}</span>${pkg ? `<span class="chip">${esc(pkg.name)}</span>` : ''}</summary>
        <div class="px-4 pb-3 space-y-1 text-sm">${s.items.map(i => `<div><strong>${esc(i.name)}</strong> <span class="muted tabular-nums">${esc(setsText(i))}</span></div>`).join('')}
          ${s.notes ? `<p class="mt-2 whitespace-pre-line">${esc(s.notes)}</p>` : ''}
          <div class="pt-2"><button class="btn btn-sm btn-danger" data-action="sessionDelete" data-id="${s.id}">${icon('trash-2')} Delete session</button></div></div></details>`;
    }).join('')}</div>${moreBtn('sess', list)}`;
}
function clientPackagesTab(c) {
  const list = packagesFor(c.id).reverse();
  const add = `<button class="btn btn-primary" data-action="pkgNew" data-client="${c.id}">${icon('plus')} Add a package</button>`;
  if (!list.length) return emptyState('ticket', 'No packages yet', 'Add the sessions a client has bought, and each logged session counts down from it.', add);
  return `<div class="flex mb-3">${add}</div><div class="grid sm:grid-cols-2 gap-3">${list.map(p => {
    const used = pkgUsed(p), left = pkgLeft(p), pct = p.sessions ? Math.min(100, used / p.sessions * 100) : 0, state = pkgExpired(p) ? 'Expired' : left ? `${left} left` : 'Used up';
    return `<div class="card"><div class="flex items-center gap-2"><div class="font-semibold flex-1 min-w-0 truncate">${esc(p.name)}</div><span class="chip ${left && !pkgExpired(p) ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : ''}">${state}</span></div>
      <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2" role="img" aria-label="${used} of ${p.sessions} sessions used"><div class="h-full bg-brand-600" style="width:${pct}%"></div></div>
      <div class="text-sm muted mt-1">${used} of ${p.sessions} used${isYmd(p.start) ? ` · from ${esc(fmtDate(p.start))}` : ''}${isYmd(p.expires) ? ` · expires ${esc(fmtDate(p.expires))}` : ''}</div>
      ${p.note ? `<p class="text-sm mt-1">${esc(p.note)}</p>` : ''}
      <div class="mt-2"><button class="btn btn-sm" data-action="pkgEdit" data-id="${p.id}">${icon('pencil')} Edit</button></div></div>`;
  }).join('')}</div>`;
}

/* ---------- Forms ---------- */
function clientModal(c) {
  const e = c || { status: 'active', where: 'in-person', emergency: {} }, sel = (name, map, cur) => `<select name="${name}" class="input">${Object.entries(map).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  Modal.open(modalShell(c ? 'Edit client' : 'New client', `
    <input type="hidden" name="id" value="${c ? esc(c.id) : ''}">
    ${field('Name', `<input name="name" class="input" value="${esc(e.name || '')}" required autocomplete="off" ${c ? '' : 'autofocus'}>`)}
    <div class="grid grid-cols-2 gap-3">${field('Status', sel('status', CLIENT_STATUS, e.status || 'active'))}${field('Trains', sel('where', WHERE, e.where || 'in-person'))}</div>
    <div class="grid sm:grid-cols-2 gap-3">${field('Phone', `<input name="phone" type="tel" class="input" value="${esc(e.phone || '')}" autocomplete="off">`)}${field('Email', `<input name="email" type="email" class="input" value="${esc(e.email || '')}" autocomplete="off">`)}</div>
    ${field('Birthday', `<input name="birthday" type="date" class="input" value="${esc(e.birthday || '')}">`)}
    ${field('Goals', `<textarea name="goals" class="input" rows="2" placeholder="What they want, in their words, and by when">${esc(e.goals || '')}</textarea>`)}
    ${field('Training background', `<textarea name="history" class="input" rows="2" placeholder="Experience, sports, what they’ve tried">${esc(e.history || '')}</textarea>`)}
    ${field('Injuries and limits', `<textarea name="limits" class="input" rows="2" placeholder="Old injuries, pain, movements to avoid, equipment at home">${esc(e.limits || '')}</textarea>`)}
    <div class="grid sm:grid-cols-2 gap-3">${field('Emergency contact', `<input name="ecName" class="input" value="${esc(e.emergency?.name || '')}" autocomplete="off">`)}${field('Their phone', `<input name="ecPhone" type="tel" class="input" value="${esc(e.emergency?.phone || '')}" autocomplete="off">`)}</div>
    <div class="grid sm:grid-cols-2 gap-3">${field('Waiver signed', `<input name="waiver" type="date" class="input" value="${esc(e.waiver || '')}">`)}${field('Consent to keep records', `<input name="consent" type="date" class="input" value="${esc(e.consent || '')}">`)}</div>
    <p class="text-xs muted">Only collect what coaching needs. Records stay on this device and in your backups.</p>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('check')} Save</button>`, 'clientSave'), { wide: true });
}
function parqModal(c) {
  const q = c.parq || {}, yes = q.yes || [];
  Modal.open(modalShell('Health screening', `
    <input type="hidden" name="id" value="${esc(c.id)}">
    <p class="text-sm">Have ${esc(c.name.split(' ')[0])} complete the official <a class="underline text-brand-600" href="${PARQ_LINK}" target="_blank" rel="noopener">PAR-Q+</a>, then tick each question they answered <strong>yes</strong>.</p>
    ${field('Date completed', `<input name="date" type="date" class="input" value="${esc(q.date || ymd())}" required>`)}
    <fieldset class="space-y-1"><legend class="label">Answered yes</legend>${PARQ.map(([n, t]) => `<label class="flex items-start gap-3 py-1.5 text-sm"><input type="checkbox" name="q${n}" class="mt-0.5 accent-brand-600" ${yes.includes(n) ? 'checked' : ''}><span>${n}. ${esc(t)}</span></label>`).join('')}</fieldset>
    ${field('Follow-up notes', `<textarea name="note" class="input" rows="2" placeholder="Details from the follow-up pages, what the doctor said">${esc(q.note || '')}</textarea>`)}
    ${field('Cleared for exercise on', `<input name="cleared" type="date" class="input" value="${esc(q.cleared || '')}">`)}
    <p class="text-xs muted">Any yes answer locks sessions until you record the date they were cleared, by a doctor or by the PAR-Q+ follow-up questions.</p>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('check')} Save</button>`, 'parqSave'));
}
function pkgModal(pkg, clientId) {
  const e = pkg || { name: '10 sessions', sessions: 10, start: ymd(), expires: '', usedBefore: 0, note: '' };
  Modal.open(modalShell(pkg ? 'Edit package' : 'New package', `
    <input type="hidden" name="id" value="${pkg ? esc(pkg.id) : ''}"><input type="hidden" name="clientId" value="${esc(pkg ? pkg.clientId : clientId)}">
    <div class="grid grid-cols-2 gap-3">${field('Name', `<input name="name" class="input" value="${esc(e.name)}" required autocomplete="off">`)}${field('Sessions', `<input name="sessions" type="number" min="1" max="500" inputmode="numeric" class="input" value="${e.sessions}" required>`)}</div>
    <div class="grid grid-cols-2 gap-3">${field('Starts', `<input name="start" type="date" class="input" value="${esc(e.start || '')}">`)}${field('Expires (optional)', `<input name="expires" type="date" class="input" value="${esc(e.expires || '')}">`)}</div>
    ${field('Already used before this app', `<input name="usedBefore" type="number" min="0" inputmode="numeric" class="input" value="${e.usedBefore || 0}">`)}
    ${field('Note', `<input name="note" class="input" value="${esc(e.note || '')}" autocomplete="off">`)}`,
    `${pkg ? `<button type="button" class="btn btn-danger mr-auto" data-action="pkgDelete" data-id="${esc(pkg.id)}">${icon('trash-2')} Delete</button>` : ''}<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('check')} Save</button>`, 'pkgSave'));
}
function apptModal({ clientId = '', date = '' } = {}) {
  const clients = Store.get('clients').filter(c => c.status !== 'past').sort((a, b) => a.name.localeCompare(b.name));
  if (!clients.length) return toast('Add a client first', 'error');
  Modal.open(modalShell('Schedule a session', `
    ${field('Client', `<select name="clientId" class="input" required>${clients.map(c => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
    <div class="grid grid-cols-2 gap-3">${field('Date', `<input name="date" type="date" class="input" value="${esc(date || ymd())}" required>`)}${field('Time', `<input name="time" type="time" class="input" value="" step="300">`)}</div>
    <div class="grid grid-cols-2 gap-3">${field('Minutes', `<input name="mins" type="number" min="15" step="15" inputmode="numeric" class="input" value="60">`)}${field('Repeat weekly', `<select name="repeat" class="input">${[1, 2, 4, 6, 8, 12].map(n => `<option value="${n}">${n === 1 ? 'Just this once' : `For ${n} weeks`}</option>`).join('')}</select>`)}</div>
    ${field('Note', `<input name="note" class="input" placeholder="Where, or what to bring" autocomplete="off">`)}`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('calendar-plus')} Schedule</button>`, 'apptSave'));
}

/* ---------- Removing a client completely, and their own copy of their records ---------- */
function clientRecords(id) {
  const of = key => Store.get(key).filter(x => x.clientId === id);
  return { client: byId('clients', id), packages: of('packages'), appointments: of('appointments'), programs: of('programs'), sessions: of('sessions') };
}
function deleteClient(id) {
  Store.set('clients', Store.get('clients').filter(c => c.id !== id));
  for (const key of ['packages', 'appointments', 'programs', 'sessions']) Store.set(key, Store.get(key).filter(x => x.clientId !== id));
  if (Store.get('activeSession')?.clientId === id) Store.set('activeSession', null);
}

const A_CLIENTS = {
  clSearch: el => { ui.clientQ = el.value; render(); },
  clFilter: el => { ui.clientFilter = el.dataset.v; render(); },
  clientNew: () => clientModal(null),
  clientOpen: el => openClient(el.dataset.id),
  clientEdit: el => clientModal(byId('clients', el.dataset.id)),
  clientSave: form => {
    const d = fd(form), name = d.name.trim().replace(/\s+/g, ' ');
    if (!name) return toast('Add their name', 'error');
    const c = d.id ? byId('clients', d.id) : { id: uid(), notes: [], parq: {} };
    if (!c) return;
    Object.assign(c, { name, status: CLIENT_STATUS[d.status] ? d.status : 'active', where: WHERE[d.where] ? d.where : 'in-person', phone: d.phone.trim(), email: d.email.trim(),
      birthday: isYmd(d.birthday) ? d.birthday : '', goals: d.goals.trim(), history: d.history.trim(), limits: d.limits.trim(),
      emergency: { name: d.ecName.trim(), phone: d.ecPhone.trim() }, waiver: isYmd(d.waiver) ? d.waiver : '', consent: isYmd(d.consent) ? d.consent : '' });
    stamp(c); if (!d.id) Store.get('clients').push(c);
    Store.save('clients'); Modal.close(); toast(d.id ? 'Saved' : `${name} added`);
    if (d.id) render(); else openClient(c.id);
  },
  clientPaper: el => { const c = byId('clients', el.dataset.id); if (!c) return; c[el.dataset.f] = ymd(); stamp(c); Store.save('clients'); render(); },
  parqOpen: el => { const c = byId('clients', el.dataset.id); if (c) parqModal(c); },
  parqSave: form => {
    const d = fd(form), c = byId('clients', d.id); if (!c) return;
    if (!isYmd(d.date)) return toast('Add the date it was completed', 'error');
    const yes = PARQ.map(([n]) => n).filter(n => d['q' + n]);
    c.parq = { date: d.date, yes, note: d.note.trim(), cleared: yes.length && isYmd(d.cleared) ? d.cleared : '' };
    stamp(c); Store.save('clients'); Modal.close();
    toast(yes.length && !c.parq.cleared ? 'Saved. Sessions stay locked until they’re cleared.' : 'Health screening saved'); render();
  },
  noteAdd: form => {
    const d = fd(form), c = byId('clients', d.id), text = (d.text || '').trim(); if (!c || !text) return;
    (c.notes = c.notes || []).push({ id: uid(), date: ymd(), text }); stamp(c); Store.save('clients'); render();
    ui.after = () => $('input[name="text"]')?.focus();
  },
  noteDel: el => { const c = byId('clients', el.dataset.id); if (!c) return; c.notes = (c.notes || []).filter(n => n.id !== el.dataset.note); stamp(c); Store.save('clients'); render(); },
  pkgNew: el => pkgModal(null, el.dataset.client),
  pkgEdit: el => pkgModal(byId('packages', el.dataset.id)),
  pkgSave: form => {
    const d = fd(form), n = Math.round(num(d.sessions) || 0);
    if (!byId('clients', d.clientId)) return;
    if (n < 1) return toast('A package needs at least one session', 'error');
    const pkg = d.id ? byId('packages', d.id) : { id: uid(), clientId: d.clientId };
    Object.assign(pkg, { name: d.name.trim() || `${n} sessions`, sessions: n, start: isYmd(d.start) ? d.start : '', expires: isYmd(d.expires) ? d.expires : '', usedBefore: Math.max(0, Math.round(num(d.usedBefore) || 0)), note: d.note.trim() });
    stamp(pkg); if (!d.id) Store.get('packages').push(pkg);
    Store.save('packages'); Modal.close(); toast('Package saved'); render();
  },
  pkgDelete: el => {
    const pkg = byId('packages', el.dataset.id); if (!pkg) return;
    ask('Delete this package?', `<p><strong>${esc(pkg.name)}</strong> is removed. Logged sessions stay in their history.</p>`, 'Delete', () => {
      Store.set('packages', Store.get('packages').filter(p => p.id !== pkg.id)); toast('Package deleted'); render();
    });
  },
  apptNew: el => apptModal({ clientId: el.dataset.client || '', date: el.dataset.date || '' }),
  apptSave: form => {
    const d = fd(form); if (!byId('clients', d.clientId) || !isYmd(d.date)) return toast('Choose a client and a date', 'error');
    const n = Math.min(52, Math.max(1, +d.repeat || 1)), mins = Math.max(15, Math.round(num(d.mins) || 60));
    for (let i = 0; i < n; i++) Store.get('appointments').push(stamp({ id: uid(), clientId: d.clientId, date: addDays(d.date, i * 7), time: /^\d{2}:\d{2}$/.test(d.time) ? d.time : '', mins, note: d.note.trim(), sessionId: null }));
    Store.save('appointments'); Modal.close(); toast(n > 1 ? `${n} sessions scheduled` : 'Session scheduled'); render();
  },
  apptCancel: el => {
    const a = byId('appointments', el.dataset.id); if (!a) return;
    ask('Remove this booking?', `<p>${esc(firstName(a.clientId))}, ${esc(apptLabel(a))}.</p>`, 'Remove', () => {
      Store.set('appointments', Store.get('appointments').filter(x => x.id !== a.id)); toast('Booking removed'); render();
    });
  },
  progBlank: el => { const p = assignProgram(null, el.dataset.client, ymd()); toast('Blank program started'); openClient(p.clientId, 'program'); },
  progEnd: el => {
    const p = byId('programs', el.dataset.id); if (!p) return;
    ask('End this program?', `<p><strong>${esc(p.name)}</strong> moves to past programs. Its sessions stay in the history.</p>`, 'End program', () => {
      p.status = 'ended'; p.ended = ymd(); stamp(p); Store.save('programs'); toast('Program ended'); render();
    }, { danger: false });
  },
  progReuse: el => {
    const old = byId('programs', el.dataset.id); if (!old) return;
    const p = assignProgram({ ...old, id: old.templateId, days: old.days }, old.clientId, ymd());
    p.templateId = old.templateId || null; p.name = old.name; stamp(p); Store.save('programs');
    toast('Started again from today'); render();
  },
  sessionDelete: el => {
    const s = byId('sessions', el.dataset.id); if (!s) return;
    ask('Delete this session?', `<p>${esc(fmtDay(s.date))}, ${esc(s.dayName || 'session')}. If it counted against a package, that session is given back.</p>`, 'Delete', () => {
      Store.set('sessions', Store.get('sessions').filter(x => x.id !== s.id));
      for (const a of Store.get('appointments')) if (a.sessionId === s.id) { a.sessionId = null; stamp(a); }
      Store.save('appointments'); toast('Session deleted'); render();
    });
  },
  clientExport: el => {
    const id = el.dataset.id, r = clientRecords(id); if (!r.client) return;
    const names = Object.fromEntries(Store.get('exercises').map(x => [x.id, x.name]));
    download(`coach-desk-${slug(r.client.name) || 'client'}-${ymd()}.json`, JSON.stringify({ app: 'coach-desk', kind: 'client-records', exportedAt: nowIso(), ...r, exerciseNames: names }, null, 2));
    toast('Their records were downloaded. Send them the file if they asked for a copy.');
  },
  clientDelete: el => {
    const r = clientRecords(el.dataset.id); if (!r.client) return;
    ask(`Delete ${esc(r.client.name)}?`, `<p>This removes their details, health screening and notes, plus ${plural(r.sessions.length, 'session')}, ${plural(r.programs.length, 'program')}, ${plural(r.packages.length, 'package')} and ${plural(r.appointments.length, 'booking')}. It can’t be undone, except from a backup.</p><p class="muted">If they only stopped training, set their status to Past instead.</p>`, 'Delete everything', () => {
      deleteClient(r.client.id); ui.clientId = null; toast(`${r.client.name} deleted`); go('clients');
    });
  }
};
