'use strict';
/* =====================================================================
   EXERCISE LIBRARY — exercises with coaching cues, demo links and swaps
   ===================================================================== */
const EX_TYPES = {
  weight_reps: { label: 'Weight & reps', cols: ['weight', 'reps'] },
  bodyweight: { label: 'Bodyweight reps', cols: ['reps'] },
  weighted_bw: { label: 'Weighted bodyweight', cols: ['weight', 'reps'] },
  assisted_bw: { label: 'Assisted bodyweight', cols: ['weight', 'reps'] },
  duration: { label: 'Duration', cols: ['duration'] },
  weight_duration: { label: 'Weight & duration', cols: ['weight', 'duration'] },
  distance_duration: { label: 'Distance & duration', cols: ['distance', 'duration'] }
};
const typeCols = t => (EX_TYPES[t] || EX_TYPES.weight_reps).cols;
const MUSCLES = ['Chest', 'Shoulders', 'Triceps', 'Biceps', 'Forearms', 'Lats', 'Upper Back', 'Lower Back', 'Abs', 'Glutes', 'Quads', 'Hamstrings', 'Calves', 'Full Body', 'Cardio', 'Other'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Cable', 'Bodyweight', 'Band', 'Suspension', 'Plate', 'Other', 'None'];
// name: type | primary muscle | equipment
const DEFAULT_LIB = {
  'Bench Press (Barbell)': 'weight_reps|Chest|Barbell', 'Bench Press (Dumbbell)': 'weight_reps|Chest|Dumbbell', 'Incline Bench Press (Dumbbell)': 'weight_reps|Chest|Dumbbell',
  'Push Up': 'bodyweight|Chest|Bodyweight', 'Incline Push Up': 'bodyweight|Chest|Bodyweight', 'Chest Fly (Cable)': 'weight_reps|Chest|Cable',
  'Overhead Press (Barbell)': 'weight_reps|Shoulders|Barbell', 'Shoulder Press (Dumbbell)': 'weight_reps|Shoulders|Dumbbell', 'Lateral Raise (Dumbbell)': 'weight_reps|Shoulders|Dumbbell',
  'Face Pull (Cable)': 'weight_reps|Shoulders|Cable', 'Band Pull Apart': 'bodyweight|Upper Back|Band',
  'Triceps Pushdown (Cable)': 'weight_reps|Triceps|Cable', 'Skullcrusher (Barbell)': 'weight_reps|Triceps|Barbell', 'Triceps Dip': 'bodyweight|Triceps|Bodyweight',
  'Bicep Curl (Dumbbell)': 'weight_reps|Biceps|Dumbbell', 'Hammer Curl (Dumbbell)': 'weight_reps|Biceps|Dumbbell',
  'Pull Up': 'bodyweight|Lats|Bodyweight', 'Assisted Pull Up': 'assisted_bw|Lats|Machine', 'Chin Up': 'bodyweight|Lats|Bodyweight', 'Lat Pulldown (Cable)': 'weight_reps|Lats|Cable',
  'Bent Over Row (Barbell)': 'weight_reps|Upper Back|Barbell', 'Dumbbell Row': 'weight_reps|Upper Back|Dumbbell', 'Seated Cable Row': 'weight_reps|Upper Back|Cable',
  'Inverted Row': 'bodyweight|Upper Back|Bodyweight', 'Suspension Row': 'bodyweight|Upper Back|Suspension',
  'Squat (Barbell)': 'weight_reps|Quads|Barbell', 'Front Squat (Barbell)': 'weight_reps|Quads|Barbell', 'Goblet Squat': 'weight_reps|Quads|Kettlebell', 'Box Squat': 'weight_reps|Quads|Barbell',
  'Leg Press': 'weight_reps|Quads|Machine', 'Leg Extension (Machine)': 'weight_reps|Quads|Machine', 'Split Squat (Dumbbell)': 'weight_reps|Quads|Dumbbell',
  'Bulgarian Split Squat': 'weight_reps|Quads|Dumbbell', 'Walking Lunge (Dumbbell)': 'weight_reps|Quads|Dumbbell', 'Step Up (Dumbbell)': 'weight_reps|Quads|Dumbbell',
  'Deadlift (Barbell)': 'weight_reps|Hamstrings|Barbell', 'Trap Bar Deadlift': 'weight_reps|Hamstrings|Barbell', 'Romanian Deadlift (Barbell)': 'weight_reps|Hamstrings|Barbell',
  'Romanian Deadlift (Dumbbell)': 'weight_reps|Hamstrings|Dumbbell', 'Lying Leg Curl (Machine)': 'weight_reps|Hamstrings|Machine', 'Kettlebell Swing': 'weight_reps|Glutes|Kettlebell',
  'Hip Thrust (Barbell)': 'weight_reps|Glutes|Barbell', 'Glute Bridge': 'bodyweight|Glutes|Bodyweight', 'Cable Pull Through': 'weight_reps|Glutes|Cable',
  'Standing Calf Raise': 'weight_reps|Calves|Machine',
  'Plank': 'duration|Abs|Bodyweight', 'Side Plank': 'duration|Abs|Bodyweight', 'Dead Bug': 'bodyweight|Abs|Bodyweight', 'Bird Dog': 'bodyweight|Abs|Bodyweight',
  'Pallof Press (Cable)': 'weight_reps|Abs|Cable', 'Cable Crunch': 'weight_reps|Abs|Cable', 'Hanging Leg Raise': 'bodyweight|Abs|Bodyweight',
  "Farmer's Carry": 'weight_duration|Forearms|Dumbbell',
  'Walking': 'distance_duration|Cardio|None', 'Running': 'distance_duration|Cardio|None', 'Cycling': 'distance_duration|Cardio|Machine', 'Rowing Machine': 'distance_duration|Cardio|Machine',
  'Jump Rope': 'duration|Cardio|Other', 'Burpee': 'bodyweight|Full Body|Bodyweight', 'Mountain Climber': 'duration|Full Body|Bodyweight'
};
// Easier or equipment-free alternatives, offered first when swapping in a session.
const DEFAULT_SWAPS = {
  'Bench Press (Barbell)': ['Bench Press (Dumbbell)', 'Push Up'], 'Bench Press (Dumbbell)': ['Push Up', 'Incline Push Up'], 'Push Up': ['Incline Push Up', 'Bench Press (Dumbbell)'],
  'Overhead Press (Barbell)': ['Shoulder Press (Dumbbell)'], 'Pull Up': ['Assisted Pull Up', 'Lat Pulldown (Cable)'], 'Lat Pulldown (Cable)': ['Assisted Pull Up', 'Suspension Row'],
  'Bent Over Row (Barbell)': ['Dumbbell Row', 'Seated Cable Row'], 'Squat (Barbell)': ['Goblet Squat', 'Leg Press', 'Box Squat'], 'Goblet Squat': ['Box Squat', 'Leg Press'],
  'Deadlift (Barbell)': ['Trap Bar Deadlift', 'Romanian Deadlift (Dumbbell)'], 'Romanian Deadlift (Barbell)': ['Romanian Deadlift (Dumbbell)', 'Glute Bridge'],
  'Bulgarian Split Squat': ['Split Squat (Dumbbell)', 'Step Up (Dumbbell)'], 'Walking Lunge (Dumbbell)': ['Split Squat (Dumbbell)', 'Step Up (Dumbbell)'],
  'Hip Thrust (Barbell)': ['Glute Bridge', 'Cable Pull Through'], 'Running': ['Walking', 'Cycling'], 'Hanging Leg Raise': ['Dead Bug']
};
function libraryRecord(name, spec) {
  const [type, primary, equipment] = spec.split('|');
  return stamp({ id: uid(), name, type, primary, equipment, cues: '', video: '', swaps: DEFAULT_SWAPS[name] || [] });
}
function seedExercises() { return Object.entries(DEFAULT_LIB).map(([n, s]) => libraryRecord(n, s)).sort((a, b) => a.name.localeCompare(b.name)); }
const exList = () => [...Store.get('exercises')].sort((a, b) => a.name.localeCompare(b.name));
const exById = id => id ? Store.get('exercises').find(x => x.id === id) : null;
const exByName = name => Store.get('exercises').find(x => x.name.toLowerCase() === String(name || '').trim().toLowerCase());
// The library record for a program or session item, by id first and then by name.
const exFor = item => exById(item.exId) || exByName(item.name) || null;
function inferType(name) {
  const n = String(name || '').toLowerCase();
  if (/\brun|jog|walk(?!ing lunge)|cycl|bike|rowing machine|elliptical|swim|ruck|hike|stair/.test(n)) return 'distance_duration';
  if (/plank|wall sit|\bhold\b|dead hang|jump rope|carry/.test(n)) return 'duration';
  if (/push ?up|pull ?up|chin ?up|\bdip\b|burpee|sit ?up|crunch$|bird dog|dead bug|bridge$/.test(n) && !/\((barbell|dumbbell|cable|machine)\)/.test(n)) return 'bodyweight';
  return 'weight_reps';
}
function addExercise(name, extra = {}) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const have = exByName(clean); if (have) return have;
  const rec = stamp({ id: uid(), name: clean, type: inferType(clean), primary: 'Other', equipment: 'Other', cues: '', video: '', swaps: [], ...extra });
  Store.get('exercises').push(rec); Store.save('exercises');
  return rec;
}

function renderLibrary() {
  const q = ui.libQ.trim().toLowerCase();
  const list = exList().filter(x => (!q || x.name.toLowerCase().includes(q) || (x.cues || '').toLowerCase().includes(q))
    && (!ui.libMuscle || x.primary === ui.libMuscle) && (!ui.libEquip || x.equipment === ui.libEquip));
  const opt = (v, cur, all) => `<option value="">${all}</option>` + v.map(m => `<option ${m === cur ? 'selected' : ''}>${esc(m)}</option>`).join('');
  return `<div class="flex flex-wrap items-center gap-2 mb-4">
      <input id="lib-q" class="input flex-1 min-w-[12rem]" type="search" placeholder="Search exercises" value="${esc(ui.libQ)}" data-input="libSearch" autocomplete="off">
      <select class="input w-auto" data-change="libFilter" data-key="libMuscle" aria-label="Filter by muscle">${opt(MUSCLES, ui.libMuscle, 'All muscles')}</select>
      <select class="input w-auto" data-change="libFilter" data-key="libEquip" aria-label="Filter by equipment">${opt(EQUIPMENT, ui.libEquip, 'All equipment')}</select>
      <button class="btn btn-primary" data-action="exNew">${icon('plus')} New exercise</button>
    </div>
    <p class="text-sm muted mb-3">${plural(list.length, 'exercise')}. Add coaching cues and a demo link to any of them; they show in session mode and on program sheets.</p>
    ${list.length ? `<div class="card p-0 divide-y divide-slate-100 dark:divide-slate-800">${pageOf('lib', list).map(x => `
      <button class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60" data-action="exEdit" data-id="${x.id}">
        <div class="min-w-0 flex-1"><div class="font-medium truncate">${esc(x.name)}</div>
          <div class="text-xs muted truncate">${esc(x.primary)} · ${esc(x.equipment)}${x.cues ? ' · ' + esc(x.cues.split('\n')[0]) : ''}</div></div>
        ${webUrl(x.video) ? `<span class="chip">${icon('play', 'w-3 h-3')} Demo</span>` : ''}${(x.swaps || []).length ? `<span class="chip hidden sm:inline-flex">${plural(x.swaps.length, 'swap')}</span>` : ''}
      </button>`).join('')}</div>${moreBtn('lib', list)}`
    : emptyState('search-x', 'No exercises match', 'Try another search, or add it as a new exercise.', `<button class="btn btn-primary" data-action="exNew">${icon('plus')} New exercise</button>`)}`;
}

function exerciseModal(x) {
  const e = x || { name: ui.libQ.trim(), type: 'weight_reps', primary: 'Other', equipment: 'Other', cues: '', video: '', swaps: [] };
  const sel = (name, list, cur, labels) => `<select name="${name}" class="input">${list.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(labels ? labels[v] : v)}</option>`).join('')}</select>`;
  Modal.open(modalShell(x ? 'Edit exercise' : 'New exercise', `
    <input type="hidden" name="id" value="${x ? esc(x.id) : ''}">
    ${field('Name', `<input name="name" class="input" value="${esc(e.name)}" required autocomplete="off" ${x ? '' : 'autofocus'}>`)}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      ${field('Logged as', sel('type', Object.keys(EX_TYPES), e.type, Object.fromEntries(Object.entries(EX_TYPES).map(([k, v]) => [k, v.label]))))}
      ${field('Main muscle', sel('primary', MUSCLES, e.primary))}
      ${field('Equipment', sel('equipment', EQUIPMENT, e.equipment))}
    </div>
    ${field('Coaching cues', `<textarea name="cues" class="input" rows="3" placeholder="Brace, then push the floor away">${esc(e.cues)}</textarea>`)}
    ${field('Demo video link', `<input name="video" type="url" class="input" value="${esc(e.video)}" placeholder="https://">`)}
    ${field('Swaps', `<input name="swaps" class="input" list="ex-names" value="${esc((e.swaps || []).join(', '))}" placeholder="Easier or equipment-free options, separated by commas" autocomplete="off">
      <datalist id="ex-names">${exList().map(n => `<option value="${esc(n.name)}">`).join('')}</datalist>`)}
    <p class="text-xs muted">Programs keep the exercise name they were built with, so renaming here doesn’t change past sessions.</p>`,
    `${x ? `<button type="button" class="btn btn-danger mr-auto" data-action="exDelete" data-id="${esc(x.id)}">${icon('trash-2')} Delete</button>` : ''}<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('check')} Save</button>`, 'exSave'));
}

// Exercise picker, shared by the program editor and session mode. ui.pick says what the choice is for;
// PICK_HANDLERS[ui.pick.mode](exercise) does it. Programs and sessions add their own handlers.
const PICK_HANDLERS = {};
function openPicker(pick) {
  ui.pick = pick;
  Modal.open(modalShell(pick.title || 'Choose an exercise', `
    <input id="pick-q" class="input" type="search" placeholder="Search exercises" data-input="pickSearch" autocomplete="off" autofocus>
    <div id="pick-list" class="max-h-[55vh] overflow-y-auto scroll-thin -mx-1 px-1">${pickerList('')}</div>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button>`), { onClose: () => { ui.pick = null; } });
}
function pickerList(query) {
  const q = query.trim().toLowerCase(), pick = ui.pick || {};
  const swaps = (pick.swaps || []).map(n => exByName(n)).filter(Boolean).filter(x => !q || x.name.toLowerCase().includes(q));
  const rest = exList().filter(x => !swaps.includes(x) && (!q || x.name.toLowerCase().includes(q))).slice(0, 80);
  const row = x => `<button type="button" class="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2" data-action="pickEx" data-id="${x.id}"><span class="flex-1 min-w-0 truncate">${esc(x.name)}</span><span class="text-xs muted shrink-0">${esc(x.primary)}</span></button>`;
  const exact = q && exList().some(x => x.name.toLowerCase() === q);
  return `${swaps.length ? `<div class="label mt-1">Suggested swaps</div>${swaps.map(row).join('')}<div class="label mt-3">All exercises</div>` : ''}
    ${rest.map(row).join('') || '<p class="text-sm muted px-3 py-2">No matches.</p>'}
    ${q && !exact ? `<button type="button" class="btn w-full mt-2" data-action="pickNew">${icon('plus')} Add “${esc(query.trim())}” to the library</button>` : ''}`;
}
function pickDone(ex) {
  const pick = ui.pick; ui.pick = null; Modal.close();
  const run = pick && PICK_HANDLERS[pick.mode]; if (run) run(ex, pick);
}

const A_LIB = {
  libSearch: el => { ui.libQ = el.value; ui.more.lib = 0; render(); },
  libFilter: el => { ui[el.dataset.key] = el.value; render(); },
  exNew: () => exerciseModal(null),
  exEdit: el => exerciseModal(exById(el.dataset.id)),
  exSave: form => {
    const d = fd(form), name = d.name.trim().replace(/\s+/g, ' ');
    if (!name) return toast('Give the exercise a name', 'error');
    const clash = Store.get('exercises').find(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== d.id);
    if (clash) return toast('There’s already an exercise with that name', 'error');
    const video = d.video.trim();
    if (video && !webUrl(video)) return toast('The demo link needs to start with https://', 'error');
    const rec = d.id ? exById(d.id) : { id: uid() };
    Object.assign(rec, { name, type: EX_TYPES[d.type] ? d.type : 'weight_reps', primary: d.primary, equipment: d.equipment, cues: d.cues.trim(), video, swaps: [...new Set(d.swaps.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== name.toLowerCase()))] });
    stamp(rec); if (!d.id) Store.get('exercises').push(rec);
    Store.save('exercises'); Modal.close(); toast(d.id ? 'Exercise saved' : 'Exercise added'); render();
  },
  exDelete: el => {
    const x = exById(el.dataset.id); if (!x) return;
    ask('Delete this exercise?', `<p><strong>${esc(x.name)}</strong> leaves the library. Programs and past sessions that use it keep it by name.</p>`, 'Delete', () => {
      Store.set('exercises', Store.get('exercises').filter(e => e.id !== x.id)); toast('Exercise deleted'); render();
    });
  },
  pickSearch: el => { const box = $('#pick-list'); if (box) { box.innerHTML = pickerList(el.value); refreshIcons(); } },
  pickEx: el => { const ex = exById(el.dataset.id); if (ex) pickDone(ex); },
  pickNew: () => { const q = $('#pick-q')?.value || ''; const ex = addExercise(q); if (ex) { toast(`Added ${ex.name} to the library`); pickDone(ex); } }
};
