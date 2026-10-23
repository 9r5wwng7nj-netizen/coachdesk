'use strict';
/* =====================================================================
   PROGRAMS — templates, each client's own copy, the editor they share,
   progression rules, assigning, and the program sheet
   A template lives in `templates`; assigning copies it into `programs` with a clientId,
   so adjusting a client's copy never changes the template.
   ===================================================================== */
const PROGRESSIONS = {
  double: { label: 'Double progression', how: 'Add weight once every set reaches the top of the rep range.' },
  linear: { label: 'Add weight each session', how: 'Add weight whenever every set reaches the bottom of the rep range.' },
  none: { label: 'By hand', how: 'Keep the weight; you decide when it goes up.' }
};
const defaultInc = () => S.unit === 'lbs' ? 5 * LB : 2.5;
const progColl = kind => kind === 'tpl' ? 'templates' : 'programs';
const getProg = (kind, id) => byId(progColl(kind), id);
function saveProg(kind, p) { stamp(p); Store.save(progColl(kind)); }
function repRange(s) {
  const m = String(s || '').match(/^\s*(\d+)\s*(?:[-–to]+\s*(\d+))?\s*$/i);
  if (!m) return null;
  const a = +m[1], b = m[2] ? +m[2] : a;
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}
function defaultReps(type) {
  return { bodyweight: '8-15', duration: '30s', weight_duration: '30s', distance_duration: '10 min' }[type] || '8-12';
}
function newItem(ex) {
  return { id: uid(), exId: ex.id, name: ex.name, sets: 3, reps: defaultReps(ex.type), rest: S.restSeconds || 90, rpe: '', notes: '' };
}
const programEnd = p => isYmd(p.start) ? addDays(p.start, Math.max(1, p.weeks || 1) * 7 - 1) : '';
const programWeek = (p, date = ymd()) => isYmd(p.start) ? Math.floor(daysBetween(p.start, date) / 7) + 1 : 1;
const isDeload = (p, wk) => (p.deload || 0) > 0 && wk > 0 && wk % p.deload === 0;
const activeProgram = clientId => Store.get('programs').find(p => p.clientId === clientId && p.status === 'active');
const usedBy = tplId => Store.get('programs').filter(p => p.templateId === tplId && p.status === 'active').length;
// The day after the one done most recently in this program, or the first day.
function nextDay(p) {
  if (!p || !p.days.length) return null;
  const last = Store.get('sessions').filter(s => s.programId === p.id).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0];
  const i = last ? p.days.findIndex(d => d.id === last.dayId) : -1;
  return p.days[(i + 1) % p.days.length];
}
function copyDays(days) { return structuredClone(days || []).map(d => ({ ...d, id: uid(), items: (d.items || []).map(it => ({ ...it, id: uid() })) })); }
function progSummary(p) {
  const parts = [plural(p.days.length, 'day') + ' a week', plural(p.weeks || 1, 'week')];
  if (p.deload) parts.push(`lighter every ${ordinal(p.deload)} week`);
  return parts.join(' · ');
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
function progDates(p) {
  if (!isYmd(p.start)) return '';
  const wk = programWeek(p), end = programEnd(p);
  if (wk < 1) return `Starts ${fmtDay(p.start)}`;
  if (ymd() > end) return `Finished ${fmtDay(end)}`;
  return `Week ${wk} of ${p.weeks}${isDeload(p, wk) ? ' (lighter week)' : ''} · ends ${fmtDay(end)}`;
}

/* ---------- Sample templates (added once, on first run) ---------- */
function sampleTemplates() {
  const item = (name, sets, reps, rest) => { const ex = exByName(name); return { id: uid(), exId: ex ? ex.id : null, name, sets, reps, rest, rpe: '', notes: '' }; };
  const day = (name, items) => ({ id: uid(), name, notes: '', items: items.map(a => item(...a)) });
  return [
    stamp({ id: uid(), name: 'Full body A/B — beginner', goal: 'Learn the main movement patterns and build a habit. Alternate the two days, two or three times a week.', weeks: 6, deload: 0, progression: 'double', inc: defaultInc(), days: [
      day('Full body A', [['Goblet Squat', 3, '8-12', 90], ['Push Up', 3, '6-12', 90], ['Dumbbell Row', 3, '10-12', 90], ['Glute Bridge', 3, '12-15', 60], ['Plank', 3, '30s', 60]]),
      day('Full body B', [['Romanian Deadlift (Dumbbell)', 3, '8-12', 90], ['Shoulder Press (Dumbbell)', 3, '8-12', 90], ['Lat Pulldown (Cable)', 3, '10-12', 90], ['Split Squat (Dumbbell)', 2, '8-10', 60], ['Dead Bug', 3, '8-10', 60]])
    ] }),
    stamp({ id: uid(), name: 'Upper / lower — intermediate', goal: 'Four days a week for strength and muscle, with a lighter fourth week.', weeks: 8, deload: 4, progression: 'double', inc: defaultInc(), days: [
      day('Upper A', [['Bench Press (Barbell)', 4, '6-8', 150], ['Bent Over Row (Barbell)', 4, '6-8', 120], ['Shoulder Press (Dumbbell)', 3, '8-10', 90], ['Lat Pulldown (Cable)', 3, '10-12', 90], ['Triceps Pushdown (Cable)', 3, '10-12', 60]]),
      day('Lower A', [['Squat (Barbell)', 4, '5-8', 180], ['Romanian Deadlift (Barbell)', 3, '8-10', 120], ['Walking Lunge (Dumbbell)', 3, '10-12', 90], ['Lying Leg Curl (Machine)', 3, '10-12', 60], ['Standing Calf Raise', 3, '12-15', 60]]),
      day('Upper B', [['Incline Bench Press (Dumbbell)', 4, '8-10', 120], ['Seated Cable Row', 4, '8-10', 90], ['Lateral Raise (Dumbbell)', 3, '12-15', 60], ['Face Pull (Cable)', 3, '12-15', 60], ['Bicep Curl (Dumbbell)', 3, '10-12', 60]]),
      day('Lower B', [['Deadlift (Barbell)', 3, '4-6', 180], ['Leg Press', 3, '10-12', 120], ['Hip Thrust (Barbell)', 3, '8-12', 90], ['Leg Extension (Machine)', 3, '12-15', 60], ['Pallof Press (Cable)', 3, '10-12', 60]])
    ] }),
    stamp({ id: uid(), name: 'Strength basics — 3 days', goal: 'Three full-body days built on the main barbell lifts. Add weight each session while every set is completed.', weeks: 6, deload: 0, progression: 'linear', inc: defaultInc(), days: [
      day('Day A', [['Squat (Barbell)', 3, '5', 180], ['Bench Press (Barbell)', 3, '5', 180], ['Bent Over Row (Barbell)', 3, '5-8', 120], ['Plank', 2, '30s', 60]]),
      day('Day B', [['Squat (Barbell)', 3, '5', 180], ['Overhead Press (Barbell)', 3, '5', 150], ['Deadlift (Barbell)', 1, '5', 180], ['Chin Up', 3, '5-8', 120]])
    ] })
  ];
}

/* ---------- Programs view: templates list and the template editor ---------- */
function renderPrograms() {
  if (ui.tplId) {
    const t = byId('templates', ui.tplId);
    if (t) return `<div class="flex flex-wrap items-center gap-2 mb-4"><button class="btn btn-sm" data-action="tplBack">${icon('arrow-left')} Programs</button>
        <div class="ml-auto flex flex-wrap gap-2"><button class="btn btn-sm" data-action="tplDuplicate" data-id="${t.id}">${icon('copy')} Duplicate</button><button class="btn btn-sm btn-primary" data-action="assignOpen" data-tpl="${t.id}">${icon('user-plus')} Assign to a client</button></div></div>
      ${editorHtml(t, 'tpl')}
      <div class="mt-6"><button class="btn btn-danger" data-action="tplDelete" data-id="${t.id}">${icon('trash-2')} Delete template</button></div>`;
    ui.tplId = null;
  }
  const list = [...Store.get('templates')].sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="flex flex-wrap items-center gap-2 mb-2"><h2 class="text-lg font-semibold">Templates</h2><button class="btn btn-primary ml-auto" data-action="tplNew">${icon('plus')} New template</button></div>
    <p class="text-sm muted mb-4">Write a program once, then assign it. Each client gets their own copy, so changes for one person never touch the template.</p>
    ${list.length ? `<div class="grid sm:grid-cols-2 gap-3">${list.map(t => { const n = usedBy(t.id); return `
      <div class="card flex flex-col gap-2">
        <button class="text-left" data-action="tplOpen" data-id="${t.id}"><div class="font-semibold">${esc(t.name)}</div>
          ${t.goal ? `<p class="text-sm muted mt-0.5 line-clamp-2">${esc(t.goal)}</p>` : ''}</button>
        <div class="flex flex-wrap gap-1"><span class="chip">${progSummary(t)}</span><span class="chip">${esc((PROGRESSIONS[t.progression] || PROGRESSIONS.none).label)}</span>${n ? `<span class="chip bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200">${plural(n, 'client')}</span>` : ''}</div>
        <div class="flex flex-wrap gap-2 mt-auto pt-1"><button class="btn btn-sm" data-action="tplOpen" data-id="${t.id}">${icon('pencil')} Edit</button><button class="btn btn-sm" data-action="assignOpen" data-tpl="${t.id}">${icon('user-plus')} Assign</button></div>
      </div>`; }).join('')}</div>`
    : emptyState('clipboard-list', 'No templates yet', 'A template is a program you can give to several clients.', `<button class="btn btn-primary" data-action="tplNew">${icon('plus')} New template</button>`)}`;
}

// The editor shared by templates (kind 'tpl') and client programs (kind 'prog').
// Text fields save on change without redrawing, so moving between fields never loses a tap.
function editorHtml(p, kind) {
  const k = `data-kind="${kind}" data-id="${p.id}"`, unit = S.unit;
  const prog = PROGRESSIONS[p.progression] ? p.progression : 'none';
  const deloadOpts = [0, 3, 4, 5, 6].map(n => `<option value="${n}" ${+(p.deload || 0) === n ? 'selected' : ''}>${n ? `Every ${ordinal(n)} week` : 'None'}</option>`).join('');
  return `<div class="card mb-4 space-y-3">
      <div class="grid sm:grid-cols-2 gap-3">
        ${field('Program name', `<input id="pe-name-${p.id}" class="input" value="${esc(p.name)}" data-change="peSet" data-f="name" ${k} autocomplete="off">`)}
        ${kind === 'prog' ? field('Start date', `<input id="pe-start-${p.id}" type="date" class="input" value="${esc(p.start || '')}" data-change="peSet" data-f="start" ${k}>`) : ''}
      </div>
      ${field(kind === 'tpl' ? 'Goal and notes' : 'Goal and notes for this client', `<textarea id="pe-goal-${p.id}" class="input" rows="2" data-change="peSet" data-f="goal" ${k} placeholder="Who it’s for, how often, what to focus on">${esc(p.goal || '')}</textarea>`)}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${field('Weeks in block', `<input id="pe-weeks-${p.id}" type="number" min="1" max="52" inputmode="numeric" class="input" value="${p.weeks || 6}" data-change="peSet" data-f="weeks" ${k}>`)}
        ${field('Lighter week', `<select id="pe-deload-${p.id}" class="input" data-change="peSet" data-f="deload" ${k}>${deloadOpts}</select>`)}
        ${field('Progression', `<select id="pe-prog-${p.id}" class="input" data-change="peSet" data-f="progression" ${k}>${Object.entries(PROGRESSIONS).map(([id, v]) => `<option value="${id}" ${prog === id ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`)}
        ${field(`Add each time (${unit})`, `<input id="pe-inc-${p.id}" type="number" step="0.5" min="0" inputmode="decimal" class="input" value="${wDisp(p.inc ?? defaultInc())}" data-change="peSet" data-f="inc" ${k} ${prog === 'none' ? 'disabled' : ''}>`)}
      </div>
      <p id="pe-summary-${p.id}" class="text-sm muted">${esc(editorSummary(p, kind))}</p>
    </div>
    <div class="space-y-4">${p.days.map((d, di) => dayHtml(p, kind, d, di)).join('')}</div>
    <button class="btn mt-4" data-action="peDayAdd" ${k}>${icon('plus')} Add a day</button>`;
}
function editorSummary(p, kind) {
  const how = (PROGRESSIONS[p.progression] || PROGRESSIONS.none).how;
  return `${progSummary(p)}. ${how}${p.deload ? ' Lighter weeks use about 60% of the sets at the same weight.' : ''}${kind === 'prog' && progDates(p) ? ' ' + progDates(p) + '.' : ''}`;
}
function dayHtml(p, kind, d, di) {
  const k = `data-kind="${kind}" data-id="${p.id}" data-day="${d.id}"`;
  return `<section class="card p-0" aria-label="${esc(d.name)}">
    <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
      <span class="chip shrink-0">Day ${di + 1}</span>
      <input id="pd-name-${d.id}" class="input font-semibold flex-1 min-w-0" value="${esc(d.name)}" data-change="peDaySet" data-f="name" ${k} aria-label="Day name">
      <button class="btn btn-ghost btn-sm" data-action="peDayMove" data-dir="-1" ${k} ${di === 0 ? 'disabled' : ''} aria-label="Move day up">${icon('arrow-up')}</button>
      <button class="btn btn-ghost btn-sm" data-action="peDayMove" data-dir="1" ${k} ${di === p.days.length - 1 ? 'disabled' : ''} aria-label="Move day down">${icon('arrow-down')}</button>
      <button class="btn btn-ghost btn-sm" data-action="peDayDel" ${k} aria-label="Remove day">${icon('trash-2')}</button>
    </div>
    <ol class="divide-y divide-slate-100 dark:divide-slate-800">${d.items.map((it, ii) => itemHtml(p, kind, d, it, ii)).join('') || '<li class="px-4 py-3 text-sm muted">No exercises yet.</li>'}</ol>
    <div class="px-4 py-3 border-t border-slate-100 dark:border-slate-800"><button class="btn btn-sm" data-action="peItemAdd" ${k}>${icon('plus')} Add exercise</button></div>
  </section>`;
}
function itemHtml(p, kind, d, it, ii) {
  const k = `data-kind="${kind}" data-id="${p.id}" data-day="${d.id}" data-item="${it.id}"`, base = `pi-${it.id}`;
  const ex = exFor(it), type = ex ? ex.type : 'weight_reps', repsLabel = typeCols(type).includes('reps') ? 'Reps' : 'Target';
  const inp = (f, label, val, extra = '') => `<div><label class="label" for="${base}-${f}">${label}</label><input id="${base}-${f}" class="input" value="${esc(val ?? '')}" data-change="peItemSet" data-f="${f}" ${k} ${extra}></div>`;
  return `<li class="px-4 py-3">
    <div class="flex items-start gap-2">
      <span class="w-6 h-6 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-xs grid place-items-center tabular-nums mt-0.5">${ii + 1}</span>
      <div class="flex-1 min-w-0"><div class="font-medium">${esc(it.name)}</div>${ex && ex.cues ? `<div class="text-xs muted truncate">${esc(ex.cues.split('\n')[0])}</div>` : ''}</div>
      <button class="btn btn-ghost btn-sm" data-action="peItemSwap" ${k} aria-label="Change exercise" title="Change exercise">${icon('replace')}</button>
      <button class="btn btn-ghost btn-sm" data-action="peItemMove" data-dir="-1" ${k} ${ii === 0 ? 'disabled' : ''} aria-label="Move up">${icon('arrow-up')}</button>
      <button class="btn btn-ghost btn-sm" data-action="peItemMove" data-dir="1" ${k} ${ii === d.items.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('arrow-down')}</button>
      <button class="btn btn-ghost btn-sm" data-action="peItemDel" ${k} aria-label="Remove ${esc(it.name)}">${icon('x')}</button>
    </div>
    <div class="grid grid-cols-4 gap-2 mt-2 sm:pl-8">
      ${inp('sets', 'Sets', it.sets, 'type="number" min="1" max="20" inputmode="numeric"')}
      ${inp('reps', repsLabel, it.reps, 'autocomplete="off"')}
      ${inp('rest', 'Rest (s)', it.rest, 'type="number" min="0" step="15" inputmode="numeric"')}
      ${inp('rpe', 'RPE', it.rpe, 'autocomplete="off" placeholder="7-8"')}
    </div>
    <div class="mt-2 sm:pl-8"><input id="${base}-notes" class="input" value="${esc(it.notes || '')}" data-change="peItemSet" data-f="notes" ${k} placeholder="Notes (tempo, setup, a swap)" aria-label="Notes for ${esc(it.name)}"></div>
  </li>`;
}
function editTarget(el) {
  const p = getProg(el.dataset.kind, el.dataset.id); if (!p) return {};
  const d = el.dataset.day ? p.days.find(x => x.id === el.dataset.day) : null;
  const it = d && el.dataset.item ? d.items.find(x => x.id === el.dataset.item) : null;
  return { p, d, it, kind: el.dataset.kind };
}
function moveIn(list, i, dir) { const j = i + dir; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; }

/* ---------- Assigning a template to a client ---------- */
function assignProgram(tpl, clientId, start) {
  const today = ymd();
  for (const p of Store.get('programs')) if (p.clientId === clientId && p.status === 'active') { p.status = 'ended'; p.ended = today; stamp(p); }
  const prog = stamp({ id: uid(), clientId, templateId: tpl ? tpl.id : null, name: tpl ? tpl.name : 'Program', goal: tpl ? tpl.goal || '' : '', weeks: tpl ? tpl.weeks || 6 : 6, deload: tpl ? tpl.deload || 0 : 0,
    progression: tpl ? tpl.progression || 'double' : 'double', inc: tpl ? tpl.inc ?? defaultInc() : defaultInc(), start: isYmd(start) ? start : today, status: 'active',
    days: tpl ? copyDays(tpl.days) : [{ id: uid(), name: 'Day 1', notes: '', items: [] }] });
  Store.get('programs').push(prog); Store.save('programs');
  return prog;
}
function assignModal({ tplId = '', clientId = '' } = {}) {
  const tpls = [...Store.get('templates')].sort((a, b) => a.name.localeCompare(b.name));
  const clients = Store.get('clients').filter(c => c.status !== 'past').sort((a, b) => a.name.localeCompare(b.name));
  if (!clients.length) return toast('Add a client first', 'error');
  const cur = clientId && activeProgram(clientId);
  Modal.open(modalShell('Assign a program', `
    ${clientId ? `<input type="hidden" name="clientId" value="${esc(clientId)}">` : field('Client', `<select name="clientId" class="input" required>${clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>`)}
    ${field('Program', `<select name="tplId" class="input">${tpls.map(t => `<option value="${t.id}" ${t.id === tplId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="">Start from a blank program</option></select>`)}
    ${field('Start date', `<input name="start" type="date" class="input" value="${ymd()}" required>`)}
    <p class="text-sm muted">The client gets their own copy to adjust. ${cur ? `Their current program, <strong>${esc(cur.name)}</strong>, moves to past programs.` : 'If they already have a program, it moves to past programs.'}</p>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('check')} Assign</button>`, 'assignSave'));
}

/* ---------- Program sheet: share or print ---------- */
function sheetText(p, client) {
  const first = (client?.name || '').split(' ')[0], lines = [`${p.name}${first ? ' — ' + first : ''}`];
  if (isYmd(p.start)) lines.push(`${plural(p.weeks, 'week')}, ${fmtDate(p.start)} to ${fmtDate(programEnd(p))}`);
  if (p.goal) lines.push(p.goal);
  lines.push(`How to progress: ${(PROGRESSIONS[p.progression] || PROGRESSIONS.none).how}${p.deload ? ` Every ${ordinal(p.deload)} week is lighter: fewer sets at the same weight.` : ''}`);
  p.days.forEach((d, i) => {
    lines.push('', `DAY ${i + 1} · ${d.name}`);
    d.items.forEach((it, j) => {
      const ex = exFor(it);
      lines.push(`${j + 1}. ${it.name}: ${it.sets} × ${it.reps}${it.rest ? `, rest ${fmtClock(it.rest)}` : ''}${it.rpe ? `, RPE ${it.rpe}` : ''}`);
      if (it.notes) lines.push(`   ${it.notes}`);
      if (ex?.cues) lines.push(`   Cues: ${ex.cues.replace(/\s*\n\s*/g, '; ')}`);
      if (webUrl(ex?.video)) lines.push(`   Demo: ${ex.video}`);
    });
  });
  const from = [S.trainer, S.business].filter(Boolean).join(', ');
  if (from) lines.push('', `From ${from}`);
  return lines.join('\n');
}
function sheetHtml(p, client) {
  const from = [S.trainer, S.business].filter(Boolean).join(' · ');
  return `<div class="space-y-4">
    <div><div class="text-xs uppercase tracking-wide muted">${esc(from || 'Training program')}</div>
      <h2 class="text-xl font-bold">${esc(p.name)}${client ? ` — ${esc(client.name)}` : ''}</h2>
      ${isYmd(p.start) ? `<p class="text-sm">${plural(p.weeks, 'week')}, ${esc(fmtDate(p.start))} to ${esc(fmtDate(programEnd(p)))}</p>` : ''}
      ${p.goal ? `<p class="text-sm mt-1">${esc(p.goal)}</p>` : ''}
      <p class="text-sm mt-1"><strong>How to progress:</strong> ${esc((PROGRESSIONS[p.progression] || PROGRESSIONS.none).how)}${p.deload ? ` Every ${ordinal(p.deload)} week is lighter: fewer sets at the same weight.` : ''}</p></div>
    ${p.days.map((d, i) => `<section class="break-inside-avoid"><h3 class="font-semibold border-b border-slate-300 pb-1 mb-2">Day ${i + 1} · ${esc(d.name)}</h3>
      <ol class="space-y-2">${d.items.map(it => { const ex = exFor(it), demo = webUrl(ex?.video); return `<li class="text-sm"><div><strong>${esc(it.name)}</strong> — ${esc(String(it.sets))} × ${esc(it.reps)}${it.rest ? `, rest ${fmtClock(it.rest)}` : ''}${it.rpe ? `, RPE ${esc(it.rpe)}` : ''}</div>
        ${it.notes ? `<div>${esc(it.notes)}</div>` : ''}${ex?.cues ? `<div class="muted">Cues: ${esc(ex.cues.replace(/\s*\n\s*/g, '; '))}</div>` : ''}${demo ? `<div class="break-all"><a class="text-brand-600 underline" href="${esc(demo)}" target="_blank" rel="noopener">${esc(demo)}</a></div>` : ''}</li>`; }).join('')}</ol></section>`).join('')}
  </div>`;
}
function sheetModal(progId) {
  const p = byId('programs', progId); if (!p) return;
  const c = byId('clients', p.clientId);
  Modal.open(modalShell('Program sheet', sheetHtml(p, c),
    `<button type="button" class="btn" data-action="closeModal">Close</button><button type="button" class="btn" data-action="sheetPrint" data-id="${p.id}">${icon('printer')} Print or save PDF</button><button type="button" class="btn btn-primary" data-action="sheetCopy" data-id="${p.id}">${icon('copy')} Copy as text</button>`), { wide: true });
}

const A_PROG = {
  tplNew: () => {
    const t = stamp({ id: uid(), name: 'New program', goal: '', weeks: 6, deload: 0, progression: 'double', inc: defaultInc(), days: [{ id: uid(), name: 'Day 1', notes: '', items: [] }] });
    Store.get('templates').push(t); Store.save('templates');
    Modal.close(); if (S.view !== 'programs') go('programs');
    ui.tplId = t.id; render();
    ui.after = () => { const n = $(`#pe-name-${t.id}`); if (n) { n.focus(); n.select(); } };
  },
  tplOpen: el => { ui.tplId = el.dataset.id; render(); $('#view-title').focus({ preventScroll: true }); },
  tplBack: () => { ui.tplId = null; render(); },
  tplDuplicate: el => {
    const t = byId('templates', el.dataset.id); if (!t) return;
    const c = stamp({ ...structuredClone(t), id: uid(), name: `Copy of ${t.name}`, days: copyDays(t.days), created: null });
    Store.get('templates').push(c); Store.save('templates'); ui.tplId = c.id; toast('Template duplicated'); render();
  },
  tplDelete: el => {
    const t = byId('templates', el.dataset.id); if (!t) return;
    ask('Delete this template?', `<p><strong>${esc(t.name)}</strong> leaves your templates. Clients who have it keep their own copies.</p>`, 'Delete', () => {
      Store.set('templates', Store.get('templates').filter(x => x.id !== t.id)); ui.tplId = null; toast('Template deleted'); render();
    });
  },
  progSaveAsTemplate: el => {
    const p = byId('programs', el.dataset.id); if (!p) return;
    const t = stamp({ id: uid(), name: `${p.name} (from ${byId('clients', p.clientId)?.name.split(' ')[0] || 'a client'})`, goal: p.goal || '', weeks: p.weeks, deload: p.deload, progression: p.progression, inc: p.inc, days: copyDays(p.days) });
    Store.get('templates').push(t); Store.save('templates'); toast('Saved as a new template');
  },
  peSet: el => {
    const { p, kind } = editTarget(el); if (!p) return;
    const f = el.dataset.f, v = el.value;
    if (f === 'name') p.name = v.trim() || 'Untitled program';
    else if (f === 'goal') p.goal = v.trim();
    else if (f === 'weeks') { const n = Math.round(num(v) || 0); p.weeks = Math.min(52, Math.max(1, n || 1)); el.value = p.weeks; }
    else if (f === 'deload') p.deload = Math.max(0, +v || 0);
    else if (f === 'progression') p.progression = PROGRESSIONS[v] ? v : 'none';
    else if (f === 'inc') { const n = num(v); p.inc = n == null || n < 0 ? 0 : fromUnit(n); }
    else if (f === 'start') { if (!isYmd(v)) { el.value = p.start || ''; return toast('Choose a start date', 'error'); } p.start = v; }
    saveProg(kind, p);
    if (f === 'progression') return render(); // the increment field turns on or off
    const sum = $(`#pe-summary-${p.id}`); if (sum) sum.textContent = editorSummary(p, kind);
    if (f === 'name') { const t = $('#view-title'); if (t && kind === 'tpl') t.textContent = p.name; }
  },
  peDaySet: el => { const { p, d, kind } = editTarget(el); if (!d) return; d.name = el.value.trim() || 'Day'; saveProg(kind, p); },
  peDayAdd: el => {
    const { p, kind } = editTarget(el); if (!p) return;
    const d = { id: uid(), name: `Day ${p.days.length + 1}`, notes: '', items: [] }; p.days.push(d); saveProg(kind, p); render();
    ui.after = () => { const n = $(`#pd-name-${d.id}`); if (n) { n.focus(); n.select(); } };
  },
  peDayMove: el => { const { p, d, kind } = editTarget(el); if (!d) return; moveIn(p.days, p.days.indexOf(d), +el.dataset.dir); saveProg(kind, p); render(); },
  peDayDel: el => {
    const { p, d, kind } = editTarget(el); if (!d) return;
    const drop = () => { p.days = p.days.filter(x => x !== d); saveProg(kind, p); render(); };
    if (!d.items.length) return drop();
    ask(`Remove ${esc(d.name)}?`, `<p>Its ${plural(d.items.length, 'exercise')} leave this program. Past sessions keep what was logged.</p>`, 'Remove day', drop);
  },
  peItemAdd: el => { const { p, d, kind } = editTarget(el); if (!d) return; openPicker({ mode: 'peAdd', kind, id: p.id, dayId: d.id, title: `Add to ${esc(d.name)}` }); },
  peItemSwap: el => { const { p, d, it, kind } = editTarget(el); if (!it) return; openPicker({ mode: 'peSwap', kind, id: p.id, dayId: d.id, itemId: it.id, swaps: exFor(it)?.swaps || [], title: `Change ${esc(it.name)}` }); },
  peItemMove: el => { const { p, d, it, kind } = editTarget(el); if (!it) return; moveIn(d.items, d.items.indexOf(it), +el.dataset.dir); saveProg(kind, p); render(); },
  peItemDel: el => { const { p, d, it, kind } = editTarget(el); if (!it) return; d.items = d.items.filter(x => x !== it); saveProg(kind, p); render(); },
  peItemSet: el => {
    const { p, it, kind } = editTarget(el); if (!it) return;
    const f = el.dataset.f, v = el.value.trim();
    if (f === 'sets') { it.sets = Math.min(20, Math.max(1, Math.round(num(v) || 1))); el.value = it.sets; }
    else if (f === 'rest') { const n = num(v); it.rest = n == null ? 0 : Math.max(0, Math.round(n)); el.value = it.rest; }
    else if (['reps', 'rpe', 'notes'].includes(f)) it[f] = v;
    saveProg(kind, p);
  },
  assignOpen: el => assignModal({ tplId: el.dataset.tpl || '', clientId: el.dataset.client || '' }),
  assignSave: form => {
    const d = fd(form), client = byId('clients', d.clientId);
    if (!client) return toast('Choose a client', 'error');
    const tpl = d.tplId ? byId('templates', d.tplId) : null;
    const prog = assignProgram(tpl, client.id, d.start);
    Modal.close(); toast(`${prog.name} assigned to ${client.name.split(' ')[0]}`);
    openClient(client.id, 'program');
  },
  sheetOpen: el => sheetModal(el.dataset.id),
  sheetCopy: el => { const p = byId('programs', el.dataset.id); if (p) copyText(sheetText(p, byId('clients', p.clientId)), 'Program copied — paste it into a text or email'); },
  sheetPrint: el => {
    const p = byId('programs', el.dataset.id); if (!p) return;
    $('#print').innerHTML = `<div class="p-6 max-w-3xl mx-auto">${sheetHtml(p, byId('clients', p.clientId))}</div>`;
    try { window.print(); } catch (e) { toast('Printing isn’t available here. Use Copy as text instead.', 'error'); }
  }
};
PICK_HANDLERS.peAdd = (ex, pick) => {
  const p = getProg(pick.kind, pick.id), d = p && p.days.find(x => x.id === pick.dayId); if (!d) return;
  d.items.push(newItem(ex)); saveProg(pick.kind, p); render();
};
PICK_HANDLERS.peSwap = (ex, pick) => {
  const p = getProg(pick.kind, pick.id), d = p && p.days.find(x => x.id === pick.dayId), it = d && d.items.find(x => x.id === pick.itemId); if (!it) return;
  const wasType = exFor(it)?.type;
  it.exId = ex.id; it.name = ex.name; if (wasType !== ex.type) it.reps = defaultReps(ex.type);
  saveProg(pick.kind, p); render();
};
