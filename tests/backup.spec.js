// Backups: a download restores exactly, merges keep the newer copy, and a bad file changes nothing.
import { test, expect } from '@playwright/test';
import { prepare, ready, addSample, noErrors } from './helpers.js';

test('Download backup saves a file and remembers when', async ({ page }) => {
  const errors = await prepare(page);
  await addSample(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => A.backupNow())]);
  expect(dl.suggestedFilename()).toMatch(/^coach-desk-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const body = JSON.parse(await (await dl.createReadStream()).toArray().then(b => Buffer.concat(b).toString()));
  expect(body.app).toBe('coach-desk');
  expect(body.data.clients[0].name).toBe('Sam Example');
  expect(await page.evaluate(() => !!S.lastExport)).toBe(true);
  await noErrors(errors);
});

test('Replace restores a backup exactly, and it survives a reload', async ({ page }) => {
  const errors = await prepare(page);
  await addSample(page);
  const backup = await page.evaluate(() => JSON.stringify(buildBackup()));
  await page.evaluate(() => { deleteClient(Store.get('clients')[0].id); });
  expect(await page.evaluate(() => Store.get('clients').length)).toBe(0);
  await page.evaluate(async text => { await commitImport(planImport(parseBackup(text), 'replace')); }, backup);
  await page.reload(); await ready(page);
  const r = await page.evaluate(() => ({ clients: Store.get('clients').length, sessions: Store.get('sessions').length, packages: Store.get('packages').length }));
  expect(r).toEqual({ clients: 1, sessions: 1, packages: 1 });
  await noErrors(errors);
});

test('Merge keeps the newer copy of a record', async ({ page }) => {
  const errors = await prepare(page);
  await addSample(page);
  const r = await page.evaluate(async () => {
    const b = structuredClone(buildBackup()), c = Store.get('clients')[0];
    b.data.clients[0].goals = 'Old goal'; b.data.clients[0].updated = '2000-01-01T00:00:00.000Z';
    b.data.clients.push({ id: 'from-backup', name: 'Only In Backup', status: 'active', updated: '2000-01-01T00:00:00.000Z' });
    await commitImport(planImport(b, 'merge'));
    return { goal: byId('clients', c.id).goals, added: !!byId('clients', 'from-backup'), n: Store.get('clients').length };
  });
  expect(r).toEqual({ goal: 'Get stronger', added: true, n: 2 });
  await noErrors(errors);
});

test('a file that isn’t a valid backup is refused and nothing changes', async ({ page }) => {
  const errors = await prepare(page);
  await addSample(page);
  const bad = [
    'not json',
    JSON.stringify({ app: 'life-dashboard', version: 2, data: {} }),
    JSON.stringify({ app: 'coach-desk', version: 1, data: { clients: [{ name: 'No id' }] } }),
    JSON.stringify({ app: 'coach-desk', version: 1, data: { sessions: [{ id: 'a', items: [] }] } }),
    '{"app":"coach-desk","version":1,"data":{"clients":[{"id":"x","name":"A","__proto__":{"bad":1}}]}}'
  ];
  for (const text of bad) {
    const msg = await page.evaluate(t => { try { parseBackup(t); return 'accepted'; } catch (e) { return e.message; } }, text);
    expect(msg, text).not.toBe('accepted');
  }
  expect(await page.evaluate(() => Store.get('clients').length)).toBe(1);
  await noErrors(errors);
});
