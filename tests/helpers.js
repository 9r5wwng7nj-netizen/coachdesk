// Shared test helpers. Every test opens index.html from disk with a fresh, empty browser profile,
// and the network is blocked so tests stay deterministic.
import { expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const APP = pathToFileURL(path.resolve('index.html')).href;

export async function prepare(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.route('**/*', route => (/^(file|data|blob):/.test(route.request().url()) ? route.continue() : route.abort()));
  await page.goto(APP);
  await ready(page);
  return errors;
}

export async function ready(page) {
  await page.waitForFunction(() => typeof Store !== 'undefined' && Array.isArray(Store.data.templates) && Array.isArray(Store.data.exercises));
}

// Made-up records covering every screen: a client with a program, a package, bookings and a logged session.
export async function addSample(page) {
  return page.evaluate(() => {
    const c = stamp({ id: uid(), name: 'Sam Example', status: 'active', where: 'both', phone: '555-0100', email: 'sam@example.com', birthday: addDays(ymd(), 3).replace(/^\d{4}/, '1990'),
      goals: 'Get stronger', history: '', limits: 'Left knee: no deep lunges', emergency: { name: 'Pat', phone: '555-0101' }, waiver: ymd(), consent: ymd(), notes: [{ id: uid(), date: ymd(), text: 'First meeting went well' }],
      parq: { date: ymd(), yes: [], note: '', cleared: '' } });
    Store.get('clients').push(c); Store.save('clients');
    const p = assignProgram(Store.get('templates')[0], c.id, addDays(ymd(), -7));
    const pkg = stamp({ id: uid(), clientId: c.id, name: '10 sessions', sessions: 10, start: addDays(ymd(), -7), expires: '', usedBefore: 0, note: '' });
    Store.get('packages').push(pkg); Store.save('packages');
    const d = p.days[0], ex = d.items[0];
    Store.get('sessions').push(stamp({ id: uid(), clientId: c.id, programId: p.id, dayId: d.id, dayName: d.name, date: addDays(ymd(), -2), start: new Date().toISOString(), end: new Date().toISOString(), packageId: pkg.id, notes: 'Good session',
      items: [{ id: uid(), exId: ex.exId, name: ex.name, type: 'weight_reps', target: { sets: 3, reps: '8-12', rest: 90 }, sets: [12, 12, 12].map(r => ({ id: uid(), w: 20, r, d: null, dist: null })) }] }));
    Store.save('sessions');
    for (const n of [0, 2]) Store.get('appointments').push(stamp({ id: uid(), clientId: c.id, date: addDays(ymd(), n), time: '07:00', mins: 60, note: '', sessionId: null }));
    Store.save('appointments');
    return { clientId: c.id, programId: p.id, packageId: pkg.id };
  });
}

export async function screens(page, each) {
  const views = ['home', 'clients', 'programs', 'library'];
  for (const v of views) { await page.evaluate(v => go(v), v); await each(v); }
  const clientId = await page.evaluate(() => Store.get('clients')[0]?.id);
  if (clientId) for (const tab of ['overview', 'program', 'sessions', 'packages']) {
    await page.evaluate(([id, t]) => openClient(id, t), [clientId, tab]); await each(`client › ${tab}`);
  }
  await page.evaluate(() => { go('programs'); ui.tplId = Store.get('templates')[0].id; render(); }); await each('template editor');
}

export async function noErrors(errors) { expect(errors, errors.join('\n')).toEqual([]); }
