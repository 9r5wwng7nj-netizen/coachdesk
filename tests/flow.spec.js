// The everyday flow, through the real screens: a new client, health screening, a package,
// a program, a session, and what the next session suggests.
import { test, expect } from '@playwright/test';
import { prepare, addSample, noErrors } from './helpers.js';

const modalSave = page => page.locator('#modal button.btn-primary').last().click();

test('add a client, screen them, assign a program, run a session, and the package counts down', async ({ page }) => {
  const errors = await prepare(page);
  await page.locator('#view [data-action="clientNew"]').click();
  await page.fill('#modal input[name="name"]', 'Riley Test');
  await page.fill('#modal textarea[name="goals"]', 'Run a 5K without stopping');
  await modalSave(page);
  await expect(page.locator('#view-title')).toHaveText('Riley Test');

  await page.locator('#view [data-action="parqOpen"]').first().click();
  await modalSave(page);
  await expect(page.locator('#view')).toContainText('No concerns');

  await page.locator('#view [data-action="setTab"][data-val="packages"]').click();
  await page.locator('#view [data-action="pkgNew"]').first().click();
  await page.fill('#modal input[name="sessions"]', '5');
  await page.fill('#modal input[name="name"]', '5 sessions');
  await modalSave(page);
  await expect(page.locator('#view')).toContainText('5 left');

  await page.locator('#view [data-action="setTab"][data-val="program"]').click();
  await page.locator('#view [data-action="assignOpen"]').first().click();
  await page.selectOption('#modal select[name="tplId"]', { label: 'Full body A/B — beginner' });
  await modalSave(page);
  await expect(page.locator('#view')).toContainText('Week 1 of 6');

  await page.locator('#view [data-action="sessionStartOpen"]').nth(1).click();
  await expect(page.locator('#modal')).toContainText('Full body A (next up)');
  await modalSave(page);
  await expect(page.locator('#view-title')).toHaveText('Session');
  await expect(page.locator('#view')).toContainText('First time logging this');

  const weight = page.locator('#view input[data-f="w"]').first();
  await weight.fill('40'); await weight.dispatchEvent('change');
  await page.locator('#view [data-action="ssDone"]').first().click();
  await expect(page.locator('#view input[data-f="r"]').first()).toHaveValue('12'); // ticking done fills the top of the range
  await expect(page.locator('#timer')).toBeVisible(); // rest timer started
  await expect(page.locator('#view input[data-f="w"]').nth(1)).toHaveValue('40'); // later sets start from this weight

  await page.locator('#view [data-action="sessionFinishOpen"]').click();
  await expect(page.locator('#modal select[name="packageId"]')).toContainText('5 sessions (5 left)');
  await modalSave(page);
  await expect(page.locator('#view-title')).toHaveText('Home');

  const after = await page.evaluate(() => {
    const c = Store.get('clients')[0], s = Store.get('sessions')[0];
    return { sessions: Store.get('sessions').length, sets: s.items.map(i => i.sets.length), left: pkgLeft(currentPackage(c.id)), next: nextDay(activeProgram(c.id)).name, active: Store.get('activeSession') };
  });
  expect(after).toEqual({ sessions: 1, sets: [1], left: 4, next: 'Full body B', active: null });
  await noErrors(errors);
});

test('the next session suggests more weight once every set reached the top of the range', async ({ page }) => {
  const errors = await prepare(page);
  const ids = await addSample(page); // last session: 3 × 12 at 20 kg on the first exercise
  const up = await page.evaluate(({ clientId, programId }) => {
    const p = byId('programs', programId); startSession({ clientId, programId, dayId: p.days[0].id });
    const it = Store.get('activeSession').items[0];
    return { hint: it.hint, w: it.sets[0].w, expected: roundLoad(20 + p.inc) };
  }, ids);
  expect(up.hint).toContain('up to');
  expect(up.w).toBeCloseTo(up.expected, 5);
  expect(up.w).toBeGreaterThan(20);
  const same = await page.evaluate(() => suggestion({ date: ymd(), item: { sets: [{ w: 20, r: 12 }, { w: 20, r: 11 }, { w: 20, r: 9 }] } }, { sets: 3, reps: '8-12' }, { progression: 'double', inc: 2.5 }));
  expect(same.w).toBe(20);
  expect(same.text).toContain('until every set reaches 12');
  const linear = await page.evaluate(() => suggestion({ date: ymd(), item: { sets: [{ w: 60, r: 5 }, { w: 60, r: 5 }, { w: 60, r: 5 }] } }, { sets: 3, reps: '5' }, { progression: 'linear', inc: 2.5 }));
  expect(linear.w).toBeGreaterThan(60);
  await noErrors(errors);
});

test('a yes on the PAR-Q+ locks sessions until clearance is recorded', async ({ page }) => {
  const errors = await prepare(page);
  const id = await page.evaluate(() => { const c = stamp({ id: uid(), name: 'Casey Check', status: 'active', notes: [], parq: { date: ymd(), yes: [1, 5], note: '', cleared: '' } }); Store.get('clients').push(c); Store.save('clients'); openClient(c.id); return c.id; });
  await expect(page.locator('#view')).toContainText('Get medical clearance before training');
  await page.locator('#view [data-action="sessionStartOpen"]').first().click();
  await expect(page.locator('#modal')).toContainText('needs medical clearance first');
  await expect(page.locator('#modal button', { hasText: 'Start' })).toHaveCount(0);
  await page.locator('#modal [data-action="parqOpen"]').click();
  await page.fill('#modal input[name="cleared"]', await page.evaluate(() => ymd()));
  await modalSave(page);
  expect(await page.evaluate(id => parqStatus(byId('clients', id)).state, id)).toBe('ok');
  await page.locator('#view [data-action="sessionStartOpen"]').first().click();
  await expect(page.locator('#modal button', { hasText: 'Start' })).toHaveCount(1);
  await noErrors(errors);
});

test('a lighter week has fewer sets at the same weight', async ({ page }) => {
  const errors = await prepare(page);
  const r = await page.evaluate(() => {
    const c = stamp({ id: uid(), name: 'Dana Deload', status: 'active', notes: [], parq: { date: ymd(), yes: [] } }); Store.get('clients').push(c);
    const tpl = Store.get('templates').find(t => t.deload === 4);
    const p = assignProgram(tpl, c.id, addDays(ymd(), -21)); // week 4
    startSession({ clientId: c.id, programId: p.id, dayId: p.days[0].id });
    const s = Store.get('activeSession');
    return { week: programWeek(p), deload: s.deload, planned: p.days[0].items[0].sets, sets: s.items[0].sets.length };
  });
  expect(r).toEqual({ week: 4, deload: true, planned: 4, sets: 2 });
  await noErrors(errors);
});

test('changing a template leaves clients’ copies alone', async ({ page }) => {
  const errors = await prepare(page);
  const ids = await addSample(page);
  const r = await page.evaluate(({ programId }) => {
    const p = byId('programs', programId), t = byId('templates', p.templateId);
    t.days[0].items[0].sets = 9; saveProg('tpl', t);
    return { tpl: t.days[0].items[0].sets, client: p.days[0].items[0].sets };
  }, ids);
  expect(r.tpl).toBe(9);
  expect(r.client).not.toBe(9);
  await noErrors(errors);
});

test('the program sheet lists every day with sets, reps and cues', async ({ page }) => {
  const errors = await prepare(page);
  const ids = await addSample(page);
  const text = await page.evaluate(({ programId }) => {
    const p = byId('programs', programId), ex = exFor(p.days[0].items[0]); ex.cues = 'Chest up'; ex.video = 'https://example.com/demo';
    S.business = 'Example Fitness'; return sheetText(p, byId('clients', p.clientId));
  }, ids);
  expect(text).toContain('Full body A/B — beginner — Sam');
  expect(text).toContain('DAY 1 · Full body A');
  expect(text).toContain('DAY 2 · Full body B');
  expect(text).toContain('Cues: Chest up');
  expect(text).toContain('Demo: https://example.com/demo');
  expect(text).toContain('From Example Fitness');
  await page.evaluate(({ programId }) => sheetModal(programId), ids);
  await expect(page.locator('#modal')).toContainText('Day 2 · Full body B');
  await noErrors(errors);
});

test('deleting a client removes every record of theirs', async ({ page }) => {
  const errors = await prepare(page);
  const ids = await addSample(page);
  await page.evaluate(id => openClient(id), ids.clientId);
  await page.locator('#view [data-action="clientDelete"]').click();
  await page.locator('#modal [data-action="confirmOk"]').click();
  const left = await page.evaluate(id => ['clients', 'packages', 'appointments', 'programs', 'sessions'].map(k => Store.get(k).filter(x => x.id === id || x.clientId === id).length), ids.clientId);
  expect(left).toEqual([0, 0, 0, 0, 0]);
  await expect(page.locator('#view-title')).toHaveText('Clients');
  await noErrors(errors);
});

test('home lists today’s booking and what needs attention', async ({ page }) => {
  const errors = await prepare(page);
  await addSample(page);
  await page.evaluate(() => {
    const c = stamp({ id: uid(), name: 'Morgan New', status: 'active', notes: [], parq: {} }); Store.get('clients').push(c);
    Store.get('appointments').push(stamp({ id: uid(), clientId: c.id, date: addDays(ymd(), -1), time: '', mins: 60, note: '', sessionId: null }));
    go('home');
  });
  const view = page.locator('#view');
  await expect(view).toContainText('Sam Example');
  await expect(view.locator('[data-action="sessionStartOpen"][data-appt]').first()).toBeVisible();
  await expect(view).toContainText('Health screening not recorded');
  await expect(view).toContainText('isn’t logged');
  await expect(view).toContainText('No program assigned');
  await expect(view).toContainText('Birthday');
  await expect(view).toContainText('No backup downloaded yet');
  await noErrors(errors);
});
