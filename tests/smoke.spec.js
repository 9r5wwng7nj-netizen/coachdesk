// Smoke tests: every screen renders, records survive a reload, and nothing scrolls sideways on a phone.
import { test, expect } from '@playwright/test';
import { prepare, ready, addSample, screens, noErrors } from './helpers.js';

test('first run shows getting started, sample templates and the exercise library', async ({ page }) => {
  const errors = await prepare(page);
  await expect(page.locator('#view')).toContainText('Getting started');
  const counts = await page.evaluate(() => ({ t: Store.get('templates').length, e: Store.get('exercises').length }));
  expect(counts.t).toBe(3);
  expect(counts.e).toBeGreaterThan(50);
  // Every exercise a sample template uses is in the library.
  const missing = await page.evaluate(() => Store.get('templates').flatMap(t => t.days.flatMap(d => d.items)).filter(i => !exFor(i)).map(i => i.name));
  expect(missing).toEqual([]);
  await noErrors(errors);
});

test('every screen and tab renders without errors', async ({ page }) => {
  const errors = await prepare(page);
  await addSample(page);
  const seen = [];
  await screens(page, async name => { await expect(page.locator('#view')).not.toBeEmpty(); await expect(page.locator('#view')).not.toContainText('Something went wrong'); seen.push(name); });
  await page.evaluate(() => { const c = Store.get('clients')[0], p = activeProgram(c.id); startSession({ clientId: c.id, programId: p.id, dayId: p.days[0].id }); });
  await expect(page.locator('#view')).toContainText('Last time');
  expect(seen.length).toBe(9);
  await noErrors(errors);
});

test('records are saved and survive a reload', async ({ page }) => {
  const errors = await prepare(page);
  const ids = await addSample(page);
  await page.evaluate(() => Store.flushDirty());
  await page.reload(); await ready(page);
  const back = await page.evaluate(id => ({ client: byId('clients', id)?.name, sessions: sessionsFor(id).length, program: activeProgram(id)?.name }), ids.clientId);
  expect(back.client).toBe('Sam Example');
  expect(back.sessions).toBe(1);
  expect(back.program).toBeTruthy();
  // Sample templates are not added again after the first run.
  expect(await page.evaluate(() => Store.get('templates').length)).toBe(3);
  await noErrors(errors);
});

test('phone width: no screen scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await prepare(page);
  await addSample(page);
  const wide = [];
  const check = async name => { const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, $('#view').scrollWidth)); if (w > 391) wide.push(`${name}: ${w}px`); };
  await screens(page, check);
  await page.evaluate(() => { const c = Store.get('clients')[0], p = activeProgram(c.id); startSession({ clientId: c.id, programId: p.id, dayId: p.days[1].id }); });
  await check('session');
  expect(wide, wide.join('\n')).toEqual([]);
  await noErrors(errors);
});

test('dark mode applies from settings', async ({ page }) => {
  const errors = await prepare(page);
  await page.evaluate(() => { S.theme = 'dark'; saveSettings(); applyTheme(); });
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  await noErrors(errors);
});
