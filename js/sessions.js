'use strict';
/* =====================================================================
   SESSION MODE — run today's workout for the client in front of you
   The session in progress lives in `activeSession` (survives reloads). Finishing it
   keeps only the sets ticked done, saves it to `sessions`, and counts it against a package.
   ===================================================================== */
function parseDur(s) {
  const m = String(s || '').trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?$/i);
  if (!m) return null;
  return Math.round(+m[1] * (/^m/i.test(m[2] || '') ? 60 : 1));
}
const sameExercise = (a, b) => (a.exId && b.exId && a.exId === b.exId) || String(a.name || '').toLowerCase() === String(b.name || '').toLowerCase();
// The most recent logged sets of this exercise for this client.
function lastPerformance(clientId, item) {
  for (const s of sessionsFor(clientId)) {
    const hit = s.items.find(i => sameExercise(i, item));
    if (hit && hit.sets.length) return { date: s.date, item: hit };
  }
  return null;
}
const roundLoad = kg => fromUnit(Math.round(toUnit(kg) * 2) / 2);
// What weight to use today, and why, from last time's sets and the program's progression rule.
function suggestion(last, target, { progression = 'none', inc = 0, deload = false, type = 'weight_reps' } = {}) {
  const cols = typeCols(type);
  if (!cols.includes('weight') || !cols.includes('reps')) return { w: null, text: '' };
  const done = last ? last.item.sets.filter(s => s.w != null && s.r != null) : [];
  if (!done.length) return { w: null, text: 'First time logging this: pick a starting weight.' };
  const top = Math.max(...done.map(s => s.w)), atTop = done.filter(s => s.w === top), rr = repRange(target.reps);
  if (deload) return { w: top, text: 'Lighter week: same weight, fewer sets.' };
  if (!rr || progression === 'none' || !inc) return { w: top, text: `Same weight as last time (${wFmt(top)}).` };
  const goal = progression === 'double' ? rr.hi : rr.lo, enough = atTop.length >= (target.sets || 1) && atTop.every(s => s.r >= goal);
  if (enough) { const w = roundLoad(top + inc); return { w, text: `Every set reached ${goal} last time: up to ${wFmt(w)}.`, up: true }; }
  return { w: top, text: `Stay at ${wFmt(top)} until every set reaches ${goal} reps.` };
}
function buildItem(it, clientId, opts) {
  const ex = exFor(it), type = ex ? ex.type : inferType(it.name);
  const target = { sets: +it.sets || 1, reps: it.reps || '', rest: it.rest ?? S.restSeconds, rpe: it.rpe || '', notes: it.notes || '' };
  const n = opts.deload ? Math.max(1, Math.round(target.sets * 0.6)) : target.sets;
  const last = lastPerformance(clientId, { exId: ex?.id || it.exId, name: it.name });
  const sug = suggestion(last, target, { ...opts, type }), cols = typeCols(type), secs = cols.includes('duration') ? parseDur(target.reps) : null;
  return { id: uid(), exId: ex?.id || it.exId || null, name: it.name, type, target, hint: sug.text, last: last ? { date: last.date, text: setsText(last.item) } : null,
    sets: Array.from({ length: n }, () => ({ id: uid(), w: cols.includes('weight') ? sug.w : null, r: null, d: secs, dist: null, done: false })) };
}
function startSession({ clientId, programId = null, dayId = null, date = ymd(), apptId = null }) {
  const c = byId('clients', clientId); if (!c) return;
  const p = programId ? byId('programs', programId) : null, day = p && p.days.find(d => d.id === dayId);
  const week = p ? programWeek(p, date) : 0, deload = !!(p && isDeload(p, week));
  const opts = { progression: p ? p.progression : 'none', inc: p ? p.inc ?? defaultInc() : 0, deload };
  const s = { id: uid(), clientId, programId: p ? p.id : null, dayId: day ? day.id : null, dayName: day ? day.name : 'Session', date: isYmd(date) ? date : ymd(), start: nowIso(),
    apptId, week, deload, progression: opts.progression, inc: opts.inc, notes: '', items: day ? day.items.map(it => buildItem(it, clientId, opts)) : [] };
  Store.set('activeSession', s); Modal.close(); go('session');
}
function todaysAppt(clientId, date = ymd()) { return Store.get('appointments').find(a => a.clientId === clientId && a.date === date && !a.sessionId) || null; }

function startModal(clientId = '', { apptId = '', date = '' } = {}) {
  if (Store.get('activeSession')) { toast('Finish or discard the session in progress first'); return go('session'); }
  const clients = Store.get('clients').filter(c => c.status !== 'past' || c.id === clientId).sort((a, b) => a.name.localeCompare(b.name));
  if (!clients.length) return toast('Add a client first', 'error');
  const c = byId('clients', clientId) || clients[0], hs = parqStatus(c), p = activeProgram(c.id), next = nextDay(p);
  const appt = apptId ? byId('appointments', apptId) : todaysAppt(c.id, date || ymd()), when = date || appt?.date || ymd();
  const pick = `${field('Client', `<select name="clientId" class="input" data-change="ssClient">${clients.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`)}`;
  if (hs.state === 'clearance') return Modal.open(modalShell('Start a session', `${pick}
    <div class="rounded-xl p-3 bg-rose-50 dark:bg-rose-950/40 text-sm flex gap-2">${icon('heart-pulse', 'w-5 h-5 text-rose-600 shrink-0')}<div><strong>${esc(c.name.split(' ')[0])} needs medical clearance first.</strong> They answered yes on the PAR-Q+. Record the date they were cleared to unlock sessions.</div></div>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button type="button" class="btn btn-primary" data-action="parqOpen" data-id="${c.id}">Record clearance</button>`, 'sessionStart'));
  Modal.open(modalShell('Start a session', `${pick}
    <input type="hidden" name="apptId" value="${esc(appt ? appt.id : '')}">
    ${p ? field('Workout', `<select name="dayId" class="input">${p.days.map(d => `<option value="${d.id}" ${next && d.id === next.id ? 'selected' : ''}>${esc(d.name)}${next && d.id === next.id ? ' (next up)' : ''}</option>`).join('')}<option value="">Empty session</option></select>`)
      + `<p class="text-xs muted -mt-2">${esc(p.name)} · ${esc(progDates(p))}</p>`
      : `<p class="text-sm muted">${esc(c.name.split(' ')[0])} has no program yet, so this starts an empty session. Add exercises as you go.</p>`}
    ${field('Date', `<input name="date" type="date" class="input" value="${esc(when)}" max="${ymd()}" required>`)}
    ${appt ? `<p class="text-sm">${icon('calendar-check', 'w-4 h-4 inline -mt-0.5 text-brand-600')} Logs the booking for ${esc(apptLabel(appt))}.</p>` : ''}
    ${hs.state === 'missing' ? `<p class="text-sm rounded-xl p-3 bg-amber-50 dark:bg-amber-950/40">${icon('triangle-alert', 'w-4 h-4 inline -mt-0.5 text-amber-600')} No health screening on file for ${esc(c.name.split(' ')[0])}. Have them complete the PAR-Q+ before training hard.</p>` : ''}`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('play')} Start</button>`, 'sessionStart'));
}

/* ---------- The session screen ---------- */
function renderSession() {
  const s = Store.get('activeSession'); if (!s) return '';
  const c = byId('clients', s.clientId), ex = s.items, doneSets = sum(ex.map(i => i.sets.filter(x => x.done).length)), all = sum(ex.map(i => i.sets.length));
  const hs = c ? parqStatus(c) : null;
  return `<div class="card mb-4"><div class="flex flex-wrap items-center gap-3">
      ${avatar(c?.name || '?', 'w-11 h-11 text-base')}
      <div class="min-w-0 flex-1"><div class="font-semibold truncate">${esc(c?.name || 'Former client')} · ${esc(s.dayName)}</div>
        <div class="text-sm muted"><span id="elapsed" class="tabular-nums">0:00</span> · ${doneSets} of ${plural(all, 'set')} done${s.date !== ymd() ? ` · logging ${esc(fmtDay(s.date))}` : ''}</div></div>
      ${s.deload ? '<span class="chip bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">Lighter week</span>' : ''}
    </div>
    <div class="flex flex-wrap gap-2 mt-3"><button class="btn btn-primary" data-action="sessionFinishOpen">${icon('flag')} Finish</button>${c ? `<button class="btn" data-action="clientOpen" data-id="${c.id}">${icon('user')} Their details</button>` : ''}<button class="btn btn-ghost btn-danger ml-auto" data-action="sessionDiscard">${icon('trash-2')} Discard</button></div></div>
    ${hs && hs.state === 'missing' ? `<p class="text-sm rounded-xl p-3 mb-4 bg-amber-50 dark:bg-amber-950/40">${icon('triangle-alert', 'w-4 h-4 inline -mt-0.5 text-amber-600')} No health screening on file.</p>` : ''}
    ${c?.limits ? `<p class="text-sm rounded-xl p-3 mb-4 bg-slate-100 dark:bg-slate-800/60"><strong>Limits:</strong> ${esc(c.limits)}</p>` : ''}
    <div class="space-y-4">${ex.map((it, i) => sessionItemHtml(it, i)).join('') || '<p class="text-sm muted">No exercises yet.</p>'}</div>
    <button class="btn mt-4" data-action="ssItemAdd">${icon('plus')} Add exercise</button>
    <div class="card mt-4"><label class="label" for="ss-notes">Session notes</label><textarea id="ss-notes" class="input" rows="3" data-change="ssNotes" placeholder="How they moved, what to change next time">${esc(s.notes || '')}</textarea></div>`;
}
function sessionItemHtml(it, i) {
  const ex = exFor(it), cols = typeCols(it.type), t = it.target, demo = webUrl(ex?.video);
  const head = [`${t.sets} × ${t.reps || '–'}`, t.rest ? `rest ${fmtClock(t.rest)}` : '', t.rpe ? `RPE ${t.rpe}` : ''].filter(Boolean).join(' · ');
  const k = `data-item="${it.id}"`;
  const inp = (st, f, val, label, extra) => `<input id="ss-${st.id}-${f}" class="input text-center tabular-nums px-1" value="${esc(val ?? '')}" data-change="ssSet" ${k} data-set="${st.id}" data-f="${f}" aria-label="${label}, set ${it.sets.indexOf(st) + 1}" ${extra}>`;
  const colHead = { weight: S.unit, reps: 'Reps', duration: 'Seconds', distance: distUnit() };
  const grid = `grid-template-columns: 2rem repeat(${cols.length}, minmax(0, 1fr)) 3rem`;
  return `<section class="card p-0" aria-label="${esc(it.name)}">
    <div class="px-4 pt-3">
      <div class="flex items-start gap-2"><span class="w-6 h-6 shrink-0 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs grid place-items-center tabular-nums mt-0.5">${i + 1}</span>
        <div class="flex-1 min-w-0"><div class="font-semibold">${esc(it.name)}</div><div class="text-sm muted">${esc(head)}</div></div>
        <button class="btn btn-ghost btn-sm" data-action="ssSwap" ${k} title="Swap exercise" aria-label="Swap ${esc(it.name)}">${icon('replace')}</button>
        <button class="btn btn-ghost btn-sm" data-action="ssItemDel" ${k} aria-label="Remove ${esc(it.name)}">${icon('x')}</button></div>
      ${it.hint ? `<p class="text-sm mt-1 text-brand-700 dark:text-brand-300">${icon('trending-up', 'w-4 h-4 inline -mt-0.5')} ${esc(it.hint)}</p>` : ''}
      ${it.last ? `<p class="text-xs muted mt-0.5">Last time (${esc(fmtDate(it.last.date, { month: 'short', day: 'numeric' }))}): <span class="tabular-nums">${esc(it.last.text)}</span></p>` : ''}
      ${t.notes ? `<p class="text-sm mt-1">${esc(t.notes)}</p>` : ''}
      ${ex?.cues ? `<p class="text-xs muted mt-1">Cues: ${esc(ex.cues.replace(/\s*\n\s*/g, '; '))}</p>` : ''}
      ${demo ? `<a class="text-xs underline text-brand-600" href="${esc(demo)}" target="_blank" rel="noopener">Watch the demo</a>` : ''}
    </div>
    <div class="px-4 py-3 space-y-1.5">
      <div class="grid gap-2 text-xs muted text-center" style="${grid}" aria-hidden="true"><span>Set</span>${cols.map(cn => `<span>${colHead[cn]}</span>`).join('')}<span>Done</span></div>
      ${it.sets.map((st, si) => `<div class="grid gap-2 items-center ${st.done ? 'opacity-90' : ''}" style="${grid}">
        <span class="text-sm text-center tabular-nums muted">${si + 1}</span>
        ${cols.map(cn => cn === 'weight' ? inp(st, 'w', wDisp(st.w), 'Weight', `inputmode="decimal" placeholder="${S.unit}"`)
          : cn === 'reps' ? inp(st, 'r', st.r, 'Reps', `inputmode="numeric" placeholder="${esc(t.reps || 'reps')}"`)
          : cn === 'duration' ? inp(st, 'd', st.d, 'Seconds', 'inputmode="numeric" placeholder="sec"')
          : inp(st, 'dist', distDisp(st.dist), 'Distance', `inputmode="decimal" placeholder="${distUnit()}"`)).join('')}
        <button class="btn btn-sm h-9 ${st.done ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700' : ''}" data-action="ssDone" ${k} data-set="${st.id}" aria-pressed="${st.done}" aria-label="Set ${si + 1} done">${icon('check')}</button>
      </div>`).join('')}
      <div class="flex gap-2 pt-1"><button class="btn btn-sm" data-action="ssSetAdd" ${k}>${icon('plus')} Set</button>${it.sets.length > 1 ? `<button class="btn btn-sm" data-action="ssSetDel" ${k}>${icon('minus')} Set</button>` : ''}</div>
    </div>
  </section>`;
}
function ssFind(el) { const s = Store.get('activeSession'), it = s && s.items.find(x => x.id === el.dataset.item), st = it && el.dataset.set ? it.sets.find(x => x.id === el.dataset.set) : null; return { s, it, st }; }
function finishModal() {
  const s = Store.get('activeSession'); if (!s) return;
  const done = sum(s.items.map(i => i.sets.filter(x => x.done).length)), open = sum(s.items.map(i => i.sets.filter(x => !x.done).length));
  const pkgs = packagesFor(s.clientId).filter(pkgActive), cur = currentPackage(s.clientId);
  Modal.open(modalShell('Finish the session', `
    <p class="text-sm">${plural(done, 'set')} done${open ? `. ${plural(open, 'set')} not ticked done won’t be saved` : ''}.</p>
    ${field('Count it against', `<select name="packageId" class="input">${pkgs.map(p => `<option value="${p.id}" ${cur && p.id === cur.id ? 'selected' : ''}>${esc(p.name)} (${pkgLeft(p)} left)</option>`).join('')}<option value="" ${cur ? '' : 'selected'}>No package</option></select>`)}
    ${field('Session notes', `<textarea name="notes" class="input" rows="3" placeholder="How they moved, what to change next time">${esc(s.notes || '')}</textarea>`)}`,
    `<button type="button" class="btn" data-action="closeModal">Keep going</button><button class="btn btn-primary">${icon('check')} Save session</button>`, 'sessionFinish'));
}

const A_SESS = {
  sessionStartOpen: el => startModal(el.dataset.client || ui.clientId || '', { apptId: el.dataset.appt || '', date: el.dataset.date || '' }),
  ssClient: el => startModal(el.value),
  sessionStart: form => {
    const d = fd(form), c = byId('clients', d.clientId); if (!c) return;
    if (parqStatus(c).state === 'clearance') return toast('Record their medical clearance first', 'error');
    if (d.date && d.date > ymd()) return toast('A session can’t be logged for a future date', 'error');
    const p = activeProgram(c.id);
    startSession({ clientId: c.id, programId: p && d.dayId ? p.id : null, dayId: d.dayId || null, date: d.date || ymd(), apptId: d.apptId || null });
  },
  ssSet: el => {
    const { s, it, st } = ssFind(el); if (!st) return;
    const n = num(el.value), f = el.dataset.f;
    if (f === 'w') st.w = n == null ? null : fromUnit(n);
    else if (f === 'r') st.r = n == null ? null : Math.max(0, Math.round(n));
    else if (f === 'd') st.d = n == null ? null : Math.max(0, Math.round(n));
    else if (f === 'dist') st.dist = n == null ? null : distFrom(n);
    Store.save('activeSession');
  },
  ssDone: el => {
    const { s, it, st } = ssFind(el); if (!st) return;
    st.done = !st.done;
    if (st.done) {
      const cols = typeCols(it.type), rr = repRange(it.target.reps);
      if (cols.includes('reps') && st.r == null && rr) st.r = rr.hi;
      // A later set starts from this set's weight when it has none yet.
      for (const later of it.sets.slice(it.sets.indexOf(st) + 1)) if (later.w == null && st.w != null && cols.includes('weight')) later.w = st.w;
      const rest = it.target.rest ?? S.restSeconds; if (rest > 0) Timer.start(rest);
    }
    Store.save('activeSession'); render();
  },
  ssSetAdd: el => { const { it } = ssFind(el); if (!it) return; const prev = it.sets[it.sets.length - 1]; it.sets.push({ id: uid(), w: prev ? prev.w : null, r: null, d: prev ? prev.d : null, dist: null, done: false }); Store.save('activeSession'); render(); },
  ssSetDel: el => { const { it } = ssFind(el); if (!it || it.sets.length < 2) return; it.sets.pop(); Store.save('activeSession'); render(); },
  ssItemDel: el => { const { s, it } = ssFind(el); if (!it) return; s.items = s.items.filter(x => x !== it); Store.save('activeSession'); render(); },
  ssItemAdd: () => openPicker({ mode: 'ssAdd', title: 'Add an exercise' }),
  ssSwap: el => { const { it } = ssFind(el); if (!it) return; openPicker({ mode: 'ssSwap', itemId: it.id, swaps: exFor(it)?.swaps || [], title: `Swap ${esc(it.name)}` }); },
  ssNotes: el => { const s = Store.get('activeSession'); if (!s) return; s.notes = el.value; Store.save('activeSession'); },
  sessionFinishOpen: () => finishModal(),
  sessionFinish: form => {
    const s = Store.get('activeSession'); if (!s) return;
    const d = fd(form), items = s.items.map(it => ({ id: it.id, exId: it.exId, name: it.name, type: it.type, target: it.target, sets: it.sets.filter(x => x.done).map(({ id, w, r, d: dur, dist }) => ({ id, w, r, d: dur, dist })) })).filter(it => it.sets.length);
    if (!items.length) return toast('Tick at least one set done, or discard the session', 'error');
    const pkg = d.packageId ? byId('packages', d.packageId) : null;
    const rec = stamp({ id: s.id, clientId: s.clientId, programId: s.programId, dayId: s.dayId, dayName: s.dayName, date: s.date, start: s.start, end: nowIso(), week: s.week, deload: s.deload, packageId: pkg ? pkg.id : null, notes: (d.notes || '').trim(), items });
    Store.get('sessions').push(rec); Store.save('sessions');
    const appt = s.apptId && byId('appointments', s.apptId); if (appt) { appt.sessionId = rec.id; stamp(appt); Store.save('appointments'); }
    Store.set('activeSession', null); Timer.stop(); Timer.visible = false; Timer.draw();
    Modal.close();
    toast(pkg ? (pkgLeft(pkg) ? `Session saved · ${plural(pkgLeft(pkg), 'session')} left in ${pkg.name}` : `Session saved · ${pkg.name} is used up`) : 'Session saved');
    go('home');
  },
  sessionDiscard: () => ask('Discard this session?', '<p>Nothing from it is saved.</p>', 'Discard', () => { Store.set('activeSession', null); Timer.stop(); go('home'); })
};
PICK_HANDLERS.ssAdd = ex => {
  const s = Store.get('activeSession'); if (!s) return;
  const it = buildItem(newItem(ex), s.clientId, { progression: s.progression, inc: s.inc, deload: false });
  s.items.push(it); Store.save('activeSession'); render();
};
PICK_HANDLERS.ssSwap = (ex, pick) => {
  const s = Store.get('activeSession'), i = s ? s.items.findIndex(x => x.id === pick.itemId) : -1; if (i < 0) return;
  const old = s.items[i], tgt = { ...newItem(ex), sets: old.target.sets, reps: exFor(old)?.type === ex.type ? old.target.reps : defaultReps(ex.type), rest: old.target.rest, rpe: old.target.rpe, notes: old.target.notes };
  s.items[i] = buildItem(tgt, s.clientId, { progression: s.progression, inc: s.inc, deload: s.deload });
  Store.save('activeSession'); render();
};
