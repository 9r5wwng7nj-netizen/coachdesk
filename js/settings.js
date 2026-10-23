'use strict';
/* =====================================================================
   SETTINGS & BACKUP — settings, backup download, checked restore
   A restore is validated in full first, then saved in one IndexedDB transaction,
   so a bad file changes nothing.
   ===================================================================== */
const plainObject = v => v != null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const validRecordId = id => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(id);
function validateJsonTree(v, depth = 0) {
  if (depth > 40) throw new Error('The backup is nested too deeply.');
  if (Array.isArray(v)) { v.forEach(x => validateJsonTree(x, depth + 1)); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('The backup contains an unsafe key.');
    validateJsonTree(x, depth + 1);
  }
}
function validateBackup(d) {
  if (!plainObject(d) || d.app !== 'coach-desk' || d.version !== 1 || !plainObject(d.data)) throw new Error('Choose a Coach Desk backup file.');
  validateJsonTree(d);
  if (!Object.keys(d.data).some(k => Object.hasOwn(COLLECTIONS, k))) throw new Error('The backup has no Coach Desk records in it.');
  for (const [key, value] of Object.entries(d.data)) {
    if (!Object.hasOwn(COLLECTIONS, key)) continue;
    if (key === 'activeSession') { if (value !== null && !(plainObject(value) && Array.isArray(value.items))) throw new Error('The session in progress is unreadable.'); continue; }
    if (key === 'exercises' && value === null) continue;
    if (!Array.isArray(value)) throw new Error(key + ' must be a list.');
    const ids = new Set();
    for (const r of value) {
      if (!plainObject(r) || !validRecordId(r.id)) throw new Error(key + ' contains a record without a valid id.');
      if (ids.has(r.id)) throw new Error(key + ' contains the same id twice.'); ids.add(r.id);
      for (const f of ['name', 'notes', 'goal', 'text']) if (r[f] != null && typeof r[f] !== 'string' && !(f === 'notes' && Array.isArray(r[f]))) throw new Error(`${key}.${f} must be text.`);
    }
  }
  for (const r of d.data.clients || []) if (typeof r.name !== 'string' || !r.name.trim()) throw new Error('A client is missing their name.');
  for (const key of ['templates', 'programs']) for (const r of d.data[key] || []) {
    if (!Array.isArray(r.days) || r.days.some(day => !plainObject(day) || !Array.isArray(day.items))) throw new Error(key + ' has a program without its days.');
  }
  for (const r of d.data.sessions || []) {
    if (!isYmd(r.date) || !Array.isArray(r.items) || r.items.some(i => !plainObject(i) || !Array.isArray(i.sets))) throw new Error('A session is missing its date or sets.');
  }
  if (d.settings != null) {
    if (!plainObject(d.settings)) throw new Error('The backup’s settings are unreadable.');
    for (const [key, def] of Object.entries(SETTINGS_DEFAULT)) if (def != null && typeof def !== 'object' && d.settings[key] != null && typeof d.settings[key] !== typeof def) throw new Error('Invalid setting: ' + key);
    if (d.settings.unit != null && !['lbs', 'kg'].includes(d.settings.unit)) throw new Error('Invalid weight unit.');
    if (d.settings.theme != null && !['system', 'light', 'dark'].includes(d.settings.theme)) throw new Error('Invalid theme.');
  }
  return d;
}
function parseBackup(text) {
  let d; try { d = JSON.parse(text); } catch (e) { throw new Error('That file isn’t a readable backup.'); }
  return validateBackup(d);
}
const newer = (a, b) => String(b.updated || '') >= String(a.updated || '') ? b : a;
// Merge keeps the newer copy of each record by id; Replace makes this device match the file.
function planImport(d, mode) {
  validateBackup(d);
  if (!['merge', 'replace'].includes(mode)) throw new Error('Choose Merge or Replace.');
  const data = structuredClone(Store.data);
  for (const key of Object.keys(COLLECTIONS)) {
    const has = Object.hasOwn(d.data, key), inc = structuredClone(d.data[key]);
    if (mode === 'replace') { data[key] = has ? inc : structuredClone(COLLECTIONS[key]); continue; }
    if (!has || inc == null) continue;
    if (key === 'activeSession') { if (!data[key]) data[key] = inc; continue; }
    const m = new Map((data[key] || []).map(x => [x.id, x]));
    for (const x of inc) m.set(x.id, m.has(x.id) ? newer(m.get(x.id), x) : x);
    data[key] = [...m.values()];
  }
  const settings = mode === 'replace' && d.settings ? { ...SETTINGS_DEFAULT, ...d.settings, view: S.view, collapsed: S.collapsed } : structuredClone(S);
  return { data, settings };
}
async function commitImport(plan) {
  await Store.flushDirty();
  const previous = localStorage.getItem('cd.settings');
  try {
    localStorage.setItem('cd.settings', JSON.stringify(plan.settings));
    if (Store.db) await new Promise((resolve, reject) => {
      const tx = Store.db.transaction('kv', 'readwrite');
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('The restore could not be saved.')); tx.onabort = () => reject(tx.error || new Error('The restore was cancelled.'));
      try { const kv = tx.objectStore('kv'); for (const [k, v] of Object.entries(plan.data)) kv.put(v, k); } catch (e) { tx.abort(); reject(e); }
    });
    else for (const [k, v] of Object.entries(plan.data)) localStorage.setItem('cd.data.' + k, JSON.stringify(v));
  } catch (e) {
    if (previous === null) localStorage.removeItem('cd.settings'); else localStorage.setItem('cd.settings', previous);
    throw e;
  }
  Store.data = plan.data; S = plan.settings; applyTheme(); applyCollapse();
}
function buildBackup() {
  const { view, collapsed, ...settings } = S;
  return { app: 'coach-desk', version: 1, exportedAt: nowIso(), settings, data: { ...Store.data } };
}
function settingsModal() {
  const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
  Modal.open(modalShell('Settings & backup', `
    <section class="space-y-3"><h4 class="font-semibold text-sm">You</h4>
      <div class="grid sm:grid-cols-2 gap-3">${field('Your name', `<input name="trainer" class="input" value="${esc(S.trainer)}" autocomplete="off">`)}${field('Business name', `<input name="business" class="input" value="${esc(S.business)}" autocomplete="off">`)}</div>
      <p class="text-xs muted">Shown on program sheets you share.</p></section>
    <section class="space-y-3"><h4 class="font-semibold text-sm">Training</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${field('Units', `<select name="unit" class="input">${opt('lbs', S.unit, 'lb and miles')}${opt('kg', S.unit, 'kg and km')}</select>`)}
        ${field('Default rest (s)', `<input name="restSeconds" type="number" min="0" step="15" inputmode="numeric" class="input" value="${S.restSeconds}">`)}
        ${field('Theme', `<select name="theme" class="input">${opt('system', S.theme, 'Match device')}${opt('light', S.theme, 'Light')}${opt('dark', S.theme, 'Dark')}</select>`)}
      </div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="timerSound" class="accent-brand-600" ${S.timerSound ? 'checked' : ''}> Beep when rest is over</label></section>
    <section class="space-y-2"><h4 class="font-semibold text-sm">Backup</h4>
      <p class="text-sm">${S.lastExport ? `Last backup: ${esc(fmtDateTime(S.lastExport))}.` : 'No backup downloaded yet.'} Records live only in this browser on this device. Download a backup each week and keep it somewhere private: it holds client health information.</p>
      <div class="flex flex-wrap gap-2"><button type="button" class="btn" data-action="backupNow">${icon('download')} Download backup</button><button type="button" class="btn" data-action="backupImport">${icon('upload')} Restore from a backup</button></div>
      <p class="text-xs muted">On an iPhone, the app added to the home screen keeps its own records, separate from Safari. Restore a backup inside the app you use.</p></section>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button class="btn btn-primary">${icon('check')} Save</button>`, 'settingsSave'), { wide: true });
}
function importChoice(d) {
  ui.pendingImport = d;
  const counts = Object.entries(d.data).filter(([k, v]) => Object.hasOwn(COLLECTIONS, k) && Array.isArray(v)).map(([k, v]) => `<span class="chip">${esc(k)}: ${v.length}</span>`).join(' ');
  Modal.open(modalShell('Restore from a backup', `<p class="text-sm">Backup from <strong>${d.exportedAt ? esc(fmtDateTime(d.exportedAt)) : 'an unknown date'}</strong>.</p><div class="flex flex-wrap gap-1">${counts}</div>
    <p class="text-sm muted"><strong>Merge</strong> keeps what’s here and adds the backup’s records, keeping the newer copy of anything in both. <strong>Replace everything</strong> makes this device match the backup.</p>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button type="button" class="btn" data-action="doImport" data-mode="merge">Merge</button><button type="button" class="btn btn-danger" data-action="doImport" data-mode="replace">Replace everything</button>`), { onClose: () => { ui.pendingImport = null; } });
}

const A_SET = {
  openSettings: () => { closeSidebar(); settingsModal(); },
  settingsSave: form => {
    const d = fd(form);
    Object.assign(S, { trainer: d.trainer.trim(), business: d.business.trim(), unit: d.unit === 'kg' ? 'kg' : 'lbs', restSeconds: Math.max(0, Math.round(num(d.restSeconds) ?? 90)), theme: ['system', 'light', 'dark'].includes(d.theme) ? d.theme : 'system', timerSound: !!d.timerSound });
    saveSettings(); applyTheme(); Modal.close(); toast('Settings saved'); render();
  },
  backupNow: () => {
    const payload = buildBackup();
    download(`coach-desk-backup-${ymd()}.json`, JSON.stringify(payload, null, 2));
    S.lastExport = payload.exportedAt; saveSettings(); toast('Backup downloaded'); if (!Modal.isOpen()) render();
  },
  backupImport: () => pickFile('application/json,.json', text => { try { importChoice(parseBackup(text)); } catch (e) { toast(e.message, 'error'); } }),
  doImport: async el => {
    const d = ui.pendingImport; if (!d) return;
    try { await commitImport(planImport(d, el.dataset.mode)); ui.pendingImport = null; Modal.close(); ensureSeeds(); toast('Backup restored'); go(S.view === 'session' ? 'home' : S.view); }
    catch (e) { toast('Nothing was changed: ' + e.message, 'error'); }
  }
};
