'use strict';
/* =====================================================================
   ACTIONS, EVENT WIRING & INIT
   Later tables override earlier ones; `npm run check` flags accidental collisions.
   ===================================================================== */
Object.assign(A, A_LIB, A_PROG, A_CLIENTS, A_SESS, A_HOME, A_SET);

// Fill in anything missing, and add the starter exercise library and sample templates on first run.
function ensureSeeds() {
  const d = Store.data;
  for (const [k, v] of Object.entries(COLLECTIONS)) if (d[k] === undefined || (v !== null && d[k] === null)) Store.set(k, structuredClone(v));
  if (!Array.isArray(d.exercises)) Store.set('exercises', seedExercises());
  if (!localStorage.getItem('cd.seeded')) {
    if (!d.templates.length) Store.set('templates', sampleTemplates());
    try { localStorage.setItem('cd.seeded', '1'); } catch (e) {}
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const ctl = e.target.closest('input, select, textarea, label'); if (ctl && ctl !== el && el.contains(ctl)) return; // let form controls inside clickable cards work
  const fn = A[el.dataset.action]; if (!fn) return console.warn('Unknown action', el.dataset.action);
  e.preventDefault(); fn(el, e);
});
document.addEventListener('input', e => { const el = e.target.closest('[data-input]'); if (el && A[el.dataset.input]) A[el.dataset.input](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && A[el.dataset.change]) A[el.dataset.change](el, e); });
document.addEventListener('submit', e => { const f = e.target.closest('[data-submit]'); if (!f) return; e.preventDefault(); const fn = A[f.dataset.submit]; if (fn) fn(f, e); });
document.addEventListener('keydown', e => {
  if (Modal.isOpen()) { Modal.keydown(e); if (e.defaultPrevented) return; }
  if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) { e.preventDefault(); closeSidebar(); }
  const el = e.target.closest('[role="button"][data-action]');
  if (el && e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
});
matchMedia('(min-width: 768px)').addEventListener('change', syncSidebarAccessibility);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (S.theme === 'system') applyTheme(); });

// The hosted copy caches its own files so it opens offline. The file:// copy never registers;
// ?pwa on localhost is for tests.
function registerOfflineShell() {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('pwa');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || local)) navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Offline support unavailable', e));
}

async function init() {
  applyTheme(); applyCollapse();
  $('#header-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  await Store.init(); ensureSeeds();
  render(); Timer.restore();
  try { if (navigator.storage && navigator.storage.persisted && !(await navigator.storage.persisted())) navigator.storage.persist(); } catch (e) {}
  registerOfflineShell();
}
init().catch(e => {
  console.error('Could not initialize saved data', e);
  $('#view').innerHTML = '<div class="card m-6"><h2 class="font-semibold">Could not read saved data</h2><p class="muted mt-2">Your saved records have not been reset. Reload to try again. If this continues, don’t reset or restore anything until you have a backup.</p></div>';
  toast('Could not read saved data. Reload to try again.', 'error');
});
