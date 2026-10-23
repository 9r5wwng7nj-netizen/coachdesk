'use strict';
/* =====================================================================
   CORE UTILITIES (shared with Life Dashboard's patterns)
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function webUrl(value) {
  if (typeof value !== 'string' || /[\u0000- \u007f]/.test(value)) return '';
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch (e) { return ''; }
}
const pad = n => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const fmtDate = (s, o = { month: 'short', day: 'numeric', year: 'numeric' }) => isYmd(s) ? parseYmd(s).toLocaleDateString(undefined, o) : '';
const fmtDay = s => fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDateTime = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtTime = hm => { if (!/^\d{1,2}:\d{2}$/.test(hm || '')) return ''; const [h, m] = hm.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const round = (n, d = 1) => n == null ? null : Math.round(n * 10 ** d) / 10 ** d;
const fmtNum = (n, d = 0) => (n == null || isNaN(n)) ? '–' : Number(round(n, d)).toLocaleString(undefined, { maximumFractionDigits: d });
const sum = arr => arr.reduce((a, b) => a + (+b || 0), 0);
const startOfWeek = (s = ymd()) => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }; // Monday
const fmtClock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
const icon = (name, cls = 'w-4 h-4') => `<i data-lucide="${name}" class="${cls}"></i>`;
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fd = form => Object.fromEntries(new FormData(form));
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
const nowIso = () => new Date().toISOString();
function refreshIcons() { try { window.lucide && lucide.createIcons({ attrs: { 'aria-hidden': 'true', focusable: 'false' } }); } catch (e) {} enhanceAccessibility(); }
function download(name, content, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
async function copyText(text, msg = 'Copied') {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast(msg);
}
const BACKUP_LIMIT = 64 * 1024 * 1024;
function pickFile(accept, cb) {
  const inp = $('#file-input'); inp.value = ''; inp.accept = accept;
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; if (f.size > BACKUP_LIMIT) return toast('That file is larger than the 64 MB import limit.', 'error'); const r = new FileReader(); r.onload = () => cb(r.result, f); r.onerror = () => toast('Could not read that file', 'error'); r.readAsText(f); };
  inp.click();
}

/* =====================================================================
   SETTINGS (localStorage)
   ===================================================================== */
const SETTINGS_DEFAULT = {
  business: '', trainer: '', theme: 'system', unit: 'lbs', restSeconds: 90, timerSound: true,
  collapsed: false, view: 'home', lastExport: null
};
let S = loadSettings();
function loadSettings() {
  try { return { ...SETTINGS_DEFAULT, ...JSON.parse(localStorage.getItem('cd.settings') || '{}') }; }
  catch (e) { return structuredClone(SETTINGS_DEFAULT); }
}
function saveSettings() { try { localStorage.setItem('cd.settings', JSON.stringify(S)); } catch (e) { console.warn(e); } }

// Units: lifts are stored in kg and distances in km, shown in the person's unit.
const LB = 0.45359237, MI = 1.609344;
const toUnit = kg => kg == null ? null : (S.unit === 'lbs' ? kg / LB : kg);
const fromUnit = v => v == null ? null : (S.unit === 'lbs' ? v * LB : v);
const wDisp = kg => kg == null ? '' : String(round(toUnit(kg), 1));
const wFmt = kg => kg == null ? '–' : `${fmtNum(toUnit(kg), 1)} ${S.unit}`;
const distUnit = () => S.unit === 'lbs' ? 'mi' : 'km';
const distDisp = km => km == null ? '' : String(round(S.unit === 'lbs' ? km / MI : km, 2));
const distFrom = v => v == null ? null : (S.unit === 'lbs' ? v * MI : v);

/* =====================================================================
   STORAGE (IndexedDB primary, localStorage fallback)
   Every collection and its default. Records carry `id`, `created` and `updated`
   so a later Drive sync can merge them. Changes to these shapes are additive only.
   ===================================================================== */
const COLLECTIONS = {
  clients: [], packages: [], appointments: [], exercises: null, templates: [], programs: [], sessions: [], activeSession: null
};
const Store = {
  db: null, data: {}, dirty: new Set(), t: null,
  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('coach-desk', 1);
        r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { console.warn('IndexedDB unavailable — falling back to localStorage', e); this.db = null; }
    const keys = Object.keys(COLLECTIONS), values = await this.readMany(keys);
    for (const [i, k] of keys.entries()) this.data[k] = values[i] === undefined ? structuredClone(COLLECTIONS[k]) : values[i];
  },
  readMany(keys) {
    if (!this.db) return Promise.all(keys.map(k => this.read(k)));
    return new Promise((res, rej) => {
      const tx = this.db.transaction('kv', 'readonly'), store = tx.objectStore('kv'), values = new Array(keys.length);
      keys.forEach((k, i) => { const q = store.get(k); q.onsuccess = () => { values[i] = q.result; }; });
      tx.oncomplete = () => res(values);
      tx.onerror = tx.onabort = () => rej(tx.error || new Error('Reading saved data was interrupted'));
    });
  },
  read(k) {
    if (!this.db) { try { const s = localStorage.getItem('cd.data.' + k); return Promise.resolve(s == null ? undefined : JSON.parse(s)); } catch (e) { return Promise.resolve(undefined); } }
    return new Promise(res => { const q = this.db.transaction('kv', 'readonly').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); });
  },
  write(k, v) {
    if (!this.db) { try { localStorage.setItem('cd.data.' + k, JSON.stringify(v)); } catch (e) { toast('Storage is full — download a backup!', 'error'); } return Promise.resolve(); }
    return new Promise(res => {
      const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k);
      tx.oncomplete = res; tx.onerror = () => { toast('Save failed: ' + tx.error, 'error'); res(); };
    });
  },
  get(k) { return this.data[k]; },
  set(k, v) { this.data[k] = v; this.save(k); },
  save(k) { this.dirty.add(k); clearTimeout(this.t); this.t = setTimeout(() => this.flushDirty(), 250); },
  flushDirty() { const ks = [...this.dirty]; this.dirty.clear(); return Promise.all(ks.map(k => this.write(k, this.data[k]))); },
  async flushAll() { clearTimeout(this.t); this.dirty.clear(); await Promise.all(Object.keys(this.data).map(k => this.write(k, this.data[k]))); }
};
window.addEventListener('pagehide', () => Store.flushDirty());
document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flushDirty(); });
// Mark a record changed. Use on every edit so a later sync knows which copy is newer.
function stamp(rec) { const t = nowIso(); if (!rec.created) rec.created = t; rec.updated = t; return rec; }
const byId = (key, id) => (Store.get(key) || []).find(x => x.id === id);

/* =====================================================================
   UI PRIMITIVES
   ===================================================================== */
const ui = {
  clientId: null, clientTab: 'overview', clientFilter: 'active', clientQ: '',
  tplId: null, libQ: '', libMuscle: '', libEquip: '',
  pick: null, confirm: null, more: {}, after: null
};
let accessibleFieldId = 0;
function enhanceAccessibility(root = document) {
  for (const label of $$('label:not([for])', root)) {
    if (label.querySelector('input, select, textarea') || !label.textContent.trim()) continue;
    const next = label.nextElementSibling, controls = next ? (next.matches('input:not([type="hidden"]), select, textarea') ? [next] : $$('input:not([type="hidden"]), select, textarea', next)) : [];
    if (controls.length !== 1) continue;
    const control = controls[0]; if (!control.id) control.id = 'a11y-field-' + (++accessibleFieldId);
    label.htmlFor = control.id;
  }
  for (const control of $$('input:not([type="hidden"]), select, textarea', root)) {
    if (control.labels?.length || control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby')) continue;
    const name = control.getAttribute('placeholder') || control.title;
    if (name) control.setAttribute('aria-label', name);
  }
  for (const el of $$('[data-action]', root)) {
    if (!el.matches('button, a, input, select, textarea, label, summary') && !el.querySelector('button, a, input, select, textarea') && el.id !== 'sidebar-backdrop' && el.dataset.action !== 'closeModal') {
      el.setAttribute('role', 'button'); if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    }
  }
  syncSidebarAccessibility();
  if (Modal.isOpen()) modalBackground(true);
}
function focusSnapshot(element = document.activeElement) {
  if (!element || element === document.body) return null;
  const attributes = ['name', 'data-action', 'data-input', 'data-change', 'data-id', 'data-i', 'data-f', 'data-key', 'data-val', 'data-v'];
  let selector = element.tagName.toLowerCase();
  if (element.id && !element.id.startsWith('a11y-field-')) selector = '#' + CSS.escape(element.id);
  else for (const key of attributes) if (element.hasAttribute(key)) selector += '[' + key + '="' + CSS.escape(element.getAttribute(key)) + '"]';
  let start = null, end = null; try { start = element.selectionStart; end = element.selectionEnd; } catch (e) {}
  return { element, selector, start, end };
}
function restoreFocus(snapshot, root = document) {
  if (!snapshot) return false;
  const element = snapshot.element.isConnected && root.contains(snapshot.element) ? snapshot.element : root.querySelector(snapshot.selector);
  if (!element || element.closest('[inert]') || !element.getClientRects().length) return false;
  element.focus({ preventScroll: true });
  try { if (snapshot.start != null) element.setSelectionRange(snapshot.start, snapshot.end); } catch (e) {}
  return document.activeElement === element;
}
function focusableElements(root) {
  return $$('button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]', root).filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
}
function syncSidebarAccessibility() {
  const sidebar = $('#sidebar'), small = !matchMedia('(min-width: 768px)').matches, open = sidebar.classList.contains('open');
  const hidden = small && !open;
  sidebar.inert = hidden;
  sidebar.setAttribute('aria-hidden', String(hidden));
  $('[data-action="openSidebar"]').setAttribute('aria-expanded', String(small && open));
}
function modalBackground(inert) {
  for (const el of $$('#app-shell, #timer, .skip-link')) el.inert = inert;
}
function trapDialogTab(e, dialog) {
  if (e.key !== 'Tab') return;
  const controls = focusableElements(dialog), first = controls[0], last = controls[controls.length - 1], active = document.activeElement;
  if (!first) { e.preventDefault(); dialog.focus(); }
  else if (e.shiftKey && (active === first || !controls.includes(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !controls.includes(active))) { e.preventDefault(); first.focus(); }
}
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `pointer-events-auto rounded-lg px-4 py-2 text-sm shadow-lg ${type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`;
  el.style.transition = 'opacity .3s'; el.textContent = msg; $('#toasts').appendChild(el);
  const announcement = $(type === 'error' ? '#error-announcement' : '#status-announcement');
  announcement.textContent = ''; requestAnimationFrame(() => { announcement.textContent = msg; });
  setTimeout(() => el.style.opacity = '0', 2600); setTimeout(() => el.remove(), 3000);
}
const Modal = {
  onClose: null, origin: null,
  open(html, { wide = false, onClose = null } = {}) {
    const m = $('#modal'), replacing = this.isOpen(), focused = replacing && m.contains(document.activeElement) ? focusSnapshot() : null;
    if (!replacing) this.origin = focusSnapshot();
    m.innerHTML = `<div class="absolute inset-0 bg-black/50" data-action="closeModal"></div>
      <div class="relative mx-auto mt-4 sm:mt-12 ${wide ? 'max-w-3xl' : 'max-w-lg'} w-[calc(100%-1.5rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-6rem)] overflow-y-auto scroll-thin card p-0" role="dialog" aria-modal="true">${html}</div>`;
    m.classList.remove('hidden'); this.onClose = onClose; refreshIcons();
    const dialog = $('[role="dialog"]', m), heading = $('h2, h3', dialog);
    dialog.tabIndex = -1;
    if (heading) { heading.id = 'modal-title'; heading.tabIndex = -1; dialog.setAttribute('aria-labelledby', heading.id); } else dialog.setAttribute('aria-label', 'Coach Desk dialog');
    modalBackground(true);
    if (!restoreFocus(focused, m)) ($('[autofocus]', dialog) || heading || dialog).focus();
  },
  isOpen() { return !$('#modal').classList.contains('hidden'); },
  close() {
    if (!this.isOpen()) return;
    const m = $('#modal'), origin = this.origin, c = this.onClose;
    m.classList.add('hidden'); m.innerHTML = ''; this.onClose = null; this.origin = null; modalBackground(false);
    if (c) c();
    if (!this.isOpen() && !restoreFocus(origin)) $('#view-title').focus({ preventScroll: true });
  },
  keydown(e) {
    if (!this.isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    trapDialogTab(e, $('#modal [role="dialog"]'));
  }
};
function modalShell(title, body, footer = '', formAction = '') {
  const inner = `<div class="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
      <h3 class="font-semibold">${title}</h3><button type="button" class="btn btn-ghost btn-sm" data-action="closeModal" aria-label="Close">${icon('x')}</button></div>
    <div class="p-5 space-y-4">${body}</div>
    ${footer ? `<div class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-900 rounded-b-2xl">${footer}</div>` : ''}`;
  return formAction ? `<form data-submit="${formAction}">${inner}</form>` : inner;
}
// A confirmation step inside the page. `run` is called when the person presses the button.
function ask(title, body, okLabel, run, { danger = true } = {}) {
  ui.confirm = run;
  Modal.open(modalShell(title, `<div class="text-sm space-y-2">${body}</div>`,
    `<button type="button" class="btn" data-action="closeModal">Cancel</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirmOk">${okLabel}</button>`), { onClose: () => { ui.confirm = null; } });
}
function tabs(key, items) {
  const active = items.some(([id]) => id === ui[key]) ? ui[key] : items[0][0];
  return `<div role="group" aria-label="View sections" class="flex gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-900 overflow-x-auto scroll-thin mb-5 w-full sm:w-fit max-w-full">${items.map(([id, label, ic]) =>
    `<button class="tab ${active === id ? 'tab-active' : ''}" aria-pressed="${active === id}" data-action="setTab" data-key="${key}" data-val="${id}">${ic ? icon(ic, 'w-4 h-4 inline -mt-0.5 mr-1') : ''}${label}</button>`).join('')}</div>`;
}
// Long lists show PAGE items at first, then PAGE more per tap. `key` names the list in ui.more for this visit.
const PAGE = 50;
const pageOf = (key, list) => list.slice(0, ui.more[key] || PAGE);
function moreBtn(key, list) {
  const shown = ui.more[key] || PAGE, left = list.length - shown;
  return left > 0 ? `<button type="button" class="btn btn-sm w-full mt-2" data-action="showMore" data-key="${key}">Show ${Math.min(PAGE, left)} more <span class="muted">· ${fmtNum(left)} not shown</span></button>` : '';
}
function cardHead(ic, title, right = '') {
  return `<div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 shrink-0 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 grid place-items-center">${icon(ic, 'w-4 h-4')}</div><h3 class="font-semibold min-w-0">${title}</h3><div class="ml-auto flex flex-wrap justify-end items-center gap-1">${right}</div></div>`;
}
function emptyState(ic, title, sub = '', action = '') {
  return `<div class="card text-center py-10"><div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 grid place-items-center mb-3 muted">${icon(ic, 'w-6 h-6')}</div><div class="font-semibold">${title}</div>${sub ? `<p class="text-sm muted mt-1 max-w-md mx-auto">${sub}</p>` : ''}${action ? `<div class="mt-4 flex flex-wrap justify-center gap-2">${action}</div>` : ''}</div>`;
}
const avatar = (name, size = 'w-9 h-9 text-sm') => `<div class="${size} shrink-0 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-800 dark:text-brand-200 grid place-items-center font-semibold" aria-hidden="true">${esc(initials(name))}</div>`;
const field = (label, input, cls = '') => `<div class="${cls}"><label class="label">${label}</label>${input}</div>`;

/* =====================================================================
   ROUTER / SHELL
   ===================================================================== */
const VIEWS = [
  { id: 'home', label: 'Home', icon: 'house', render: () => renderHome() },
  { id: 'clients', label: 'Clients', icon: 'users', render: () => renderClients(), title: () => (ui.clientId && byId('clients', ui.clientId)?.name) || 'Clients' },
  { id: 'programs', label: 'Programs', icon: 'clipboard-list', render: () => renderPrograms(), title: () => (ui.tplId && byId('templates', ui.tplId)?.name) || 'Programs' },
  { id: 'library', label: 'Exercises', icon: 'dumbbell', render: () => renderLibrary() },
  { id: 'session', label: 'Session', icon: 'activity', render: () => renderSession(), hidden: true }
];
let lastRendered = null, tickIv = null;
// What needs attention in each section. Return { n, what } (late: true for red) or null.
const NAV_COUNTS = {
  home: () => { const items = attentionItems().filter(x => !x.quiet), late = items.some(x => x.late); return items.length ? { n: items.length, what: `thing${items.length === 1 ? '' : 's'} need attention`, late } : null; }
};
function navCount(id) {
  const c = NAV_COUNTS[id] && NAV_COUNTS[id](); if (!c || !c.n) return '';
  return `<span class="nav-count chip ${c.late ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200' : 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200'}" title="${c.n} ${c.what}">${c.n}<span class="sr-only"> ${c.what}</span></span>`;
}
function renderBar() {
  const el = $('#bottom-bar'); if (!el) return;
  const item = id => {
    const v = VIEWS.find(x => x.id === id), c = NAV_COUNTS[id] && NAV_COUNTS[id](), on = S.view === id, n = c && c.n ? c : null;
    return `<button type="button" class="bar-item ${on ? 'bar-on' : ''}" data-action="go" data-view="${id}" aria-current="${on ? 'page' : 'false'}">${icon(v.icon, 'w-5 h-5')}<span class="truncate max-w-full">${esc(v.label)}</span>${n ? `<span class="bar-badge ${n.late ? 'bar-late' : ''}" aria-hidden="true">${n.n > 99 ? '99+' : n.n}</span><span class="sr-only">, ${n.n} ${esc(n.what)}</span>` : ''}</button>`;
  };
  el.innerHTML = `${item('home')}${item('clients')}<div class="flex items-center px-1"><button type="button" class="bar-add" data-action="quickAdd" aria-label="Start a session, schedule one, add a client or a program">${icon('plus', 'w-6 h-6')}</button></div>${item('programs')}${item('library')}`;
}
function renderNav() {
  $('#nav').innerHTML = VIEWS.filter(v => !v.hidden).map(v =>
    `<button class="nav-item w-full ${S.view === v.id ? 'nav-active' : ''}" aria-current="${S.view === v.id ? 'page' : 'false'}" data-action="go" data-view="${v.id}" title="${v.label}">${icon(v.icon, 'w-5 h-5 shrink-0')}<span class="nav-label truncate">${v.label}</span><span class="nav-label ml-auto">${navCount(v.id)}</span></button>`).join('')
    + `<div class="pt-3"><button class="btn btn-primary w-full" data-action="quickAdd">${icon('plus')}<span class="nav-label">Add or start</span></button></div>`;
  $('#session-btn').classList.toggle('hidden', !Store.get('activeSession') || S.view === 'session');
  renderBar();
}
let _rendering = false;
function render() {
  if (_rendering) { setTimeout(render, 0); return; } // a blur/change fired mid-render: render again right after
  _rendering = true; try { renderNow(); } finally { _rendering = false; }
}
function renderNow() {
  const focused = focusSnapshot(), previousView = lastRendered;
  if (S.view === 'session' && !Store.get('activeSession')) S.view = 'home';
  const v = VIEWS.find(x => x.id === S.view) || VIEWS[0];
  const main = $('#view'), key = v.id + (ui.clientId || '') + (ui.tplId || ''), keep = lastRendered === key ? main.scrollTop : 0;
  let html;
  try { html = v.render(); } catch (e) { console.error(e); html = `<div class="card text-rose-600">Something went wrong showing this screen: ${esc(e.message)}</div>`; }
  $('#view-title').textContent = v.title ? v.title() : v.label;
  main.innerHTML = `<div class="max-w-5xl mx-auto p-4 md:p-6 pb-28">${html}</div>`;
  main.scrollTop = keep; lastRendered = key;
  renderNav(); refreshIcons(); afterRender();
  if (previousView === key && !Modal.isOpen()) restoreFocus(focused);
}
function afterRender() {
  clearInterval(tickIv);
  const s = Store.get('activeSession');
  if (s && $('#elapsed')) { const upd = () => { const e = $('#elapsed'); if (e) e.textContent = fmtClock((Date.now() - new Date(s.start)) / 1000); }; upd(); tickIv = setInterval(upd, 1000); }
  if (ui.after) { const f = ui.after; ui.after = null; setTimeout(f, 0); }
}
function go(view) {
  S.view = view; ui.clientId = null; ui.tplId = null; ui.more = {};
  saveSettings(); closeSidebar(); lastRendered = null; render();
  if (!Modal.isOpen()) $('#view-title').focus({ preventScroll: true });
}
function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebar-backdrop').classList.remove('hidden'); syncSidebarAccessibility(); $('#nav button')?.focus(); }
function closeSidebar() { const focused = $('#sidebar').contains(document.activeElement); $('#sidebar').classList.remove('open'); $('#sidebar-backdrop').classList.add('hidden'); syncSidebarAccessibility(); if (focused && !matchMedia('(min-width: 768px)').matches) $('[data-action="openSidebar"]').focus(); }
function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  const l = $('#theme-label'); if (l) l.textContent = `Theme: ${S.theme[0].toUpperCase() + S.theme.slice(1)}`;
}
function applyCollapse() { $('#sidebar').classList.toggle('collapsed', !!S.collapsed); }

/* =====================================================================
   REST TIMER (floating, survives reloads)
   ===================================================================== */
let audioCtx = null;
function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {} }
function beep() {
  if (!S.timerSound || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.28, 0.56].forEach((d, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.45, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
    o.connect(g).connect(audioCtx.destination); o.start(t0 + d); o.stop(t0 + d + 0.25);
  });
}
const Timer = {
  end: 0, total: 0, iv: null, visible: false, flash: false,
  running() { return this.end > Date.now(); },
  remaining() { return Math.max(0, Math.ceil((this.end - Date.now()) / 1000)); },
  start(sec) { unlockAudio(); this.total = sec; this.end = Date.now() + sec * 1000; this.visible = true; this.flash = false; this.persist(); this.loop(); this.draw(); },
  add(d) { if (!this.running()) return this.start(Math.max(d, 15)); this.end = Math.max(Date.now() + 1000, this.end + d * 1000); this.total = Math.max(this.total + d, this.remaining()); this.persist(); this.draw(); },
  stop() { this.end = 0; this.persist(); clearInterval(this.iv); this.iv = null; document.title = 'Coach Desk'; this.draw(); },
  loop() { clearInterval(this.iv); this.iv = setInterval(() => { if (this.end && Date.now() >= this.end) this.done(); else this.tick(); }, 250); },
  done() {
    this.end = 0; this.persist(); clearInterval(this.iv); this.iv = null; document.title = 'Coach Desk';
    beep(); try { navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 300]); } catch (e) {}
    this.flash = true; this.visible = true; this.draw(); setTimeout(() => { this.flash = false; this.draw(); }, 4500);
  },
  persist() { try { localStorage.setItem('cd.timer', JSON.stringify({ end: this.end, total: this.total })); } catch (e) {} },
  restore() { try { const t = JSON.parse(localStorage.getItem('cd.timer') || '{}'); if (t.end > Date.now()) { this.end = t.end; this.total = t.total; this.visible = true; this.loop(); this.draw(); } } catch (e) {} },
  tick() {
    const rem = this.remaining(), tx = $('#timer-text'), bar = $('#timer-bar');
    if (tx) tx.textContent = fmtClock(rem); if (bar) bar.style.width = `${this.total ? rem / this.total * 100 : 0}%`;
    document.title = `⏱ ${fmtClock(rem)} · Rest`;
  },
  draw() {
    const el = $('#timer');
    if (!this.visible) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const run = this.running(), rem = this.remaining();
    el.innerHTML = `<div class="card relative overflow-hidden p-1.5 pl-3 shadow-2xl flex items-center gap-1.5 ${this.flash ? 'timer-flash border-brand-500' : ''}" role="group" aria-label="Rest timer">
      <div id="timer-text" class="text-xl font-bold tabular-nums min-w-[3.25rem] ${this.flash ? 'text-brand-600' : ''}">${run ? fmtClock(rem) : (this.flash ? 'Go!' : '0:00')}</div>
      ${run
        ? `<button class="btn btn-sm" data-action="timerAdd" data-v="-15" aria-label="15 seconds less">−15</button><button class="btn btn-sm" data-action="timerAdd" data-v="15" aria-label="15 seconds more">+15</button><button class="btn btn-sm btn-primary" data-action="timerStop">Skip</button>`
        : [60, 90, 120, 180].map(s => `<button class="btn btn-sm" data-action="timerStart" data-v="${s}" aria-label="Rest ${fmtClock(s)}">${fmtClock(s)}</button>`).join('')}
      <button class="btn btn-ghost btn-sm px-1.5" data-action="hideTimer" aria-label="Hide timer">${icon('x', 'w-3.5 h-3.5')}</button>
      <div class="absolute inset-x-0 bottom-0 h-1 bg-slate-200 dark:bg-slate-800"><div id="timer-bar" class="h-full bg-brand-500 transition-all duration-300" style="width:${run && this.total ? rem / this.total * 100 : 0}%"></div></div></div>`;
    refreshIcons();
  }
};

/* =====================================================================
   CORE ACTIONS (merged with each module's table in app.js)
   ===================================================================== */
const A = {
  go: el => go(el.dataset.view),
  openSidebar: () => openSidebar(),
  closeSidebar: () => closeSidebar(),
  closeModal: () => Modal.close(),
  cycleTheme: () => { S.theme = { system: 'light', light: 'dark', dark: 'system' }[S.theme] || 'system'; saveSettings(); applyTheme(); },
  toggleCollapse: () => { S.collapsed = !S.collapsed; saveSettings(); applyCollapse(); },
  setTab: el => { ui[el.dataset.key] = el.dataset.val; render(); },
  showMore: el => { ui.more[el.dataset.key] = (ui.more[el.dataset.key] || PAGE) + PAGE; render(); },
  confirmOk: () => { const run = ui.confirm; ui.confirm = null; Modal.close(); if (run) run(); },
  showTimer: () => { Timer.visible = true; Timer.draw(); },
  hideTimer: () => { Timer.visible = false; Timer.draw(); },
  timerStart: el => Timer.start(+el.dataset.v),
  timerAdd: el => Timer.add(+el.dataset.v),
  timerStop: () => Timer.stop()
};
