// Upload page: files go to PLEX Cloud with the upload code; crew/POB files are refused before sending.
import { test, expect } from '@playwright/test';
const UP = 'upl-test';
async function mock(page) {
  const posts = [];
  await page.route('https://script.google.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') { const b = JSON.parse(req.postData()); posts.push(b); return route.fulfill({ json: posts.filter((p) => p.name === b.name).length > 1 ? { ok: true, dup: true } : { ok: true, name: '20261125_2100_' + b.name } }); }
    return route.fulfill({ json: { ok: true, uploads: posts.map((p) => ({ at: '2026-11-25T21:00:00', name: '20261125_2100_' + p.name, by: p.by })) } });
  });
  return posts;
}
const file = (name, text = 'x') => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
test('sends an inventory and a lookahead, shows them as received', async ({ page }) => {
  const posts = await mock(page);
  await page.goto('/upload.html#k=' + UP);
  await expect(page.locator('#drop')).toBeVisible();
  await page.fill('#by', 'Store keeper');
  await page.setInputFiles('#files', [file('02.12.2026_Rig_inventory.xlsx', 'inv'), file('PLEX_Lookahead_26.11.2026.xlsx', 'la')]);
  await expect(page.locator('#list li')).toHaveCount(2);
  await expect(page.locator('#list li').first()).toContainText('Rig inventory');
  await page.click('#send');
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[0]).toMatchObject({ action: 'file', key: UP, name: '02.12.2026_Rig_inventory.xlsx', kind: 'Rig inventory', by: 'Store keeper' });
  expect(Buffer.from(posts[0].b64, 'base64').toString()).toBe('inv');
  await expect(page.locator('#list li.ok')).toHaveCount(2);
  await expect(page.locator('#rec li')).toHaveCount(2);
  expect(page.url()).not.toContain(UP);
});
test('refuses crew and POB files without sending them', async ({ page }) => {
  const posts = await mock(page);
  await page.goto('/upload.html#k=' + UP);
  await page.setInputFiles('#files', [file('POB_25.11.2026.xlsx'), file('Chopper manifest 26.11.xlsx')]);
  await expect(page.locator('#list li.no')).toHaveCount(2);
  await expect(page.locator('#send')).toBeDisabled();
  expect(posts.length).toBe(0);
});
test('asks for a code when opened without one and rejects other codes', async ({ page }) => {
  await mock(page);
  await page.goto('/upload.html');
  await expect(page.locator('#code')).toBeVisible();
  await page.fill('#codein', 'mlu-abc'); await page.click('#codeform button');
  await expect(page.locator('#code-err')).toContainText('not an upload code');
  await page.fill('#codein', UP); await page.click('#codeform button');
  await expect(page.locator('#drop')).toBeVisible();
});
