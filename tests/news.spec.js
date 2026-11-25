// Ideas & news page renders the weekly research feed.
import { test, expect } from '@playwright/test';
test('shows research items that open to their detail', async ({ page }) => {
  await page.route('**/news.json', (r) => r.fulfill({ json: { at: '2026-11-25T18:00:00Z', next: '2026-12-02T18:00:00Z', items: [
    { type: 'news', title: 'New local model', summary: 'Runs on laptop graphics', detail: ['Detail text'], links: [{ title: 'Source', url: 'https://example.com/a' }, { title: 'bad', url: 'javascript:alert(1)' }] },
    { type: 'fix', title: 'Lookahead line check', summary: 'One line had no DPR basis' }] } }));
  await page.goto('/news.html');
  await expect(page.locator('details.card')).toHaveCount(2);
  await expect(page.locator('#when')).toContainText('25.11.2026');
  await page.click('details.card >> nth=0 >> summary');
  await expect(page.locator('details.card').first()).toContainText('Detail text');
  await expect(page.locator('details.card a')).toHaveCount(1);
});
test('says so when the first run has not finished', async ({ page }) => {
  await page.route('**/news.json', (r) => r.fulfill({ json: { at: '', items: [] } }));
  await page.goto('/news.html');
  await expect(page.locator('#news')).toContainText('first research run');
});
