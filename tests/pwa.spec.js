// Hosted-copy checks: the app installs from a web address and reopens with no connection.
// Served from a throwaway local server, since service workers never run from file://.
import { test, expect } from '@playwright/test';
import { serveRepo, stopServer } from './serve.js';
import { APP, ready } from './helpers.js';

test('hosted copy is installable and reopens offline', async ({ page }) => {
  const server = await serveRepo();
  const base = `http://localhost:${server.address().port}`;
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  try {
    await page.goto(`${base}/index.html?pwa`);
    await ready(page);
    const manifest = await (await page.request.get(`${base}/manifest.webmanifest`)).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBe('Coach Desk');
    const icons = [...manifest.icons.map(i => i.src), await page.getAttribute('link[rel="apple-touch-icon"]', 'href'), await page.getAttribute('link[rel="icon"]', 'href')];
    for (const src of icons) expect((await page.request.get(new URL(src, `${base}/`).href)).ok(), src).toBe(true);
    // Every file the worker promises to keep must exist, or it never finishes installing.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.evaluate(() => { const c = stamp({ id: uid(), name: 'Saved Offline', status: 'active', notes: [], parq: {} }); Store.get('clients').push(c); Store.save('clients'); return Store.flushDirty(); });
  } finally {
    await stopServer(server);
  }
  await page.reload();
  await ready(page);
  await expect(page.locator('#view-title')).toHaveText('Home');
  expect(await page.evaluate(() => Store.get('clients').some(c => c.name === 'Saved Offline'))).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('file copy never registers a service worker', async ({ page }) => {
  await page.goto(APP);
  await ready(page);
  expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.().catch(() => []) || []).length)).toBe(0);
});
