// End-to-end tests of the PLEX app shell against a mocked PLEX Cloud API (no real data, no network).
import { test, expect } from '@playwright/test';
const KEY = 'view-test-key';
const ENGINE = '<!DOCTYPE html><html><head></head><body><h1 id="ok"></h1><script>document.getElementById("ok").textContent = "engine " + (window.__PLEX_BOOT && window.__PLEX_BOOT.store.v);</script></body></html>';
const VIEW = '<!DOCTYPE html><html><head></head><body><h1 id="ok">published view</h1></body></html>';

async function mock(page, opts = {}) {
  const calls = [];
  await page.route('https://script.google.com/**', async (route) => {
    const q = new URL(route.request().url()).searchParams; calls.push(q.get('get'));
    if (opts.offline) return route.abort('internetdisconnected');
    if (q.get('key') !== KEY) return route.fulfill({ json: { ok: false, err: 'bad key' } });
    if (q.get('get') === 'boot') return route.fulfill({ json: { ok: true, engineAt: opts.noEngine ? null : (opts.engineAt || '2026-11-25T11:00:00Z'), boot: { store: { v: opts.v || 'A' }, inbox: [] } } });
    if (q.get('get') === 'engine') return route.fulfill({ json: { ok: true, at: opts.engineAt || '2026-11-25T11:00:00Z', html: ENGINE } });
    if (q.get('get') === 'view') return route.fulfill({ json: { ok: true, at: '2026-11-25T11:00:00Z', html: VIEW } });
    return route.fulfill({ json: { ok: false, err: 'unknown' } });
  });
  return calls;
}
const frameText = (page) => page.frameLocator('#view').locator('#ok');

test('opens from a shared link, hides the code from the address, runs the engine with the boot data', async ({ page }) => {
  await mock(page);
  await page.goto('/#k=' + KEY);
  await expect(frameText(page)).toHaveText('engine A');
  expect(page.url()).not.toContain(KEY);
  expect(await page.evaluate(() => localStorage.getItem('plexKey'))).toBe(KEY);
});

test('downloads the engine once and reuses it until a new version is uploaded', async ({ page }) => {
  const calls = await mock(page);
  await page.goto('/#k=' + KEY); await expect(frameText(page)).toHaveText('engine A');
  await page.reload(); await expect(frameText(page)).toHaveText('engine A');
  expect(calls.filter((c) => c === 'engine').length).toBe(1);
});

test('asks for the code when it is wrong', async ({ page }) => {
  await mock(page);
  await page.goto('/#k=wrong');
  await expect(page.locator('#signin')).toBeVisible();
  await expect(page.locator('#signin-err')).toContainText('not valid');
  await page.fill('#code', KEY); await page.click('button[type=submit]');
  await expect(frameText(page)).toHaveText('engine A');
});

test('works offline with the last copy', async ({ page, context }) => {
  await mock(page);
  await page.goto('/#k=' + KEY); await expect(frameText(page)).toHaveText('engine A');
  await page.unroute('https://script.google.com/**'); await mock(page, { offline: true });
  await page.reload();
  await expect(frameText(page)).toHaveText('engine A');
  await expect(page.locator('#chip')).toContainText('Offline');
});

test('falls back to the published view when no engine is uploaded', async ({ page }) => {
  await mock(page, { noEngine: true });
  await page.goto('/#k=' + KEY);
  await expect(frameText(page)).toHaveText('published view');
});

test('first open offline shows a clear message, not a blank page', async ({ page }) => {
  await mock(page, { offline: true });
  await page.goto('/#k=' + KEY);
  await expect(page.locator('#problem')).toBeVisible();
  await expect(page.locator('#problem-msg')).toContainText('No connection');
});
