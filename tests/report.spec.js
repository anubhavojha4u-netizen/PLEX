// Report page: bridge weather reports and MLU operation updates against a mocked PLEX Cloud.
import { test, expect } from '@playwright/test';
const BR = 'bridge-test', ML = 'mlu-test';
async function mock(page, opts = {}) {
  const posts = [];
  await page.route('https://script.google.com/**', async (route) => {
    const req = route.request();
    if (opts.offline) return route.abort('internetdisconnected');
    if (req.method() === 'POST') { const b = JSON.parse(req.postData()); posts.push(b); return route.fulfill({ json: { ok: true, saved: (b.entries || []).length } }); }
    const k = new URL(req.url()).searchParams.get('key');
    if (k !== BR && k !== ML) return route.fulfill({ json: { ok: false, err: 'bad key' } });
    return route.fulfill({ json: { ok: true, entries: [], wx: [], plan: { cur: 23, lines: [{ seq: 23, op: 'POOH tubing with DST test string', st: 'now' }, { seq: 24, op: 'Junk basket run & set bridge plugs', st: 'planned' }] } } });
  });
  return posts;
}
test('bridge sends a weather and riser report', async ({ page }) => {
  const posts = await mock(page);
  await page.goto('/report.html#k=' + BR);
  await expect(page.locator('#wx')).toBeVisible();
  await page.fill('[name=wind_dir]', '045'); await page.fill('[name=wind_kts]', '22'); await page.fill('[name=swell_m]', '1.8');
  await page.fill('[name=heave_m]', '0.9'); await page.fill('[name=roll_deg]', '0.6'); await page.fill('[name=pitch_deg]', '0.4');
  await page.fill('[name=ufj_deg]', '0.5'); await page.fill('[name=lfj_deg]', '1.1'); await page.fill('[name=by]', '2/O');
  await page.click('#wx button[type=submit]');
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].action).toBe('wx'); expect(posts[0].key).toBe(BR);
  expect(posts[0].entries[0]).toMatchObject({ wind_kts: '22', swell_m: '1.8', ufj_deg: '0.5', lfj_deg: '1.1', by: '2/O' });
});
test('bridge form refuses impossible numbers', async ({ page }) => {
  const posts = await mock(page);
  await page.goto('/report.html#k=' + BR);
  await page.fill('[name=roll_deg]', '75'); await page.click('#wx button[type=submit]');
  await expect(page.locator('#wx .err')).toContainText('red');
  expect(posts.length).toBe(0);
});
test('MLU sends an operation update linked to the running lookahead line', async ({ page }) => {
  const posts = await mock(page);
  await page.goto('/report.html#k=' + ML);
  await expect(page.locator('#ops')).toBeVisible();
  await expect(page.locator('[name=la]')).toHaveValue('23');
  await page.fill('[name=t0]', '2026-11-25T15:00'); await page.fill('[name=t1]', '2026-11-25T16:30');
  await page.fill('[name=op]', 'POOH 4-1/2" tubing to 1153 m'); await page.fill('[name=depth]', '1153');
  await page.click('#ops button[type=submit]');
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].action).toBe('add'); expect(posts[0].entries[0]).toMatchObject({ t0: '2026-11-25T15:00', t1: '2026-11-25T16:30', la: '23', depth: '1153' });
});
test('keeps an update when offline and sends it when the network is back', async ({ page }) => {
  await mock(page); await page.goto('/report.html#k=' + ML); await expect(page.locator('#ops')).toBeVisible();
  await page.unroute('https://script.google.com/**'); await mock(page, { offline: true });
  await page.fill('[name=t0]', '2026-11-25T16:30'); await page.fill('[name=t1]', '2026-11-25T18:00'); await page.fill('[name=op]', 'Laid down DST tools');
  await page.click('#ops button[type=submit]');
  await expect(page.locator('#net')).toContainText('waiting');
  await page.unroute('https://script.google.com/**'); const posts = await mock(page);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].entries[0].op).toBe('Laid down DST tools');
});
test('asks for a code when the link has none', async ({ page }) => {
  await mock(page); await page.goto('/report.html');
  await expect(page.locator('#code')).toBeVisible();
});

test('MLU form is pre-filled from the last update', async ({ page }) => {
  await page.route('https://script.google.com/**', (route) => route.fulfill({ json: { ok: true, wx: [], entries: [{ id: 'a', t0: '2026-11-25T15:00', t1: '2026-11-25T16:30', op: 'POOH 4-1/2" wedge tubing', depth: '1153', status: 'P', la: 23, by: 'MLU-1', state: '' }], plan: { cur: 23, lines: [{ seq: 23, op: 'POOH tubing', st: 'now' }] } } }));
  await page.goto('/report.html#k=' + ML);
  await expect(page.locator('[name=op]')).toHaveValue('POOH 4-1/2" wedge tubing');
  await expect(page.locator('[name=t0]')).toHaveValue('2026-11-25T16:30');
  await expect(page.locator('[name=depth]')).toHaveValue('1153');
  await expect(page.locator('#prefill')).toBeVisible();
});
