// GitHub Pages project sites are served below /REPOSITORY/. The server also exposes the site
// under /zx81-trainer/; every request the page makes must stay inside that prefix and succeed.
import { expect, test } from '@playwright/test';
import { frameWhenScreenMatches } from './helpers.js';

test('the site works under a subdirectory (no root-relative requests)', async ({ page }) => {
  const outside = [];
  const failed = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (!pathname.startsWith('/zx81-trainer/')) outside.push(pathname);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/zx81-trainer/?debug=1&program=hello&speed=8');
  await page.waitForFunction(() => window.zx81?.state === 'running');
  await frameWhenScreenMatches(page, /^HELLO$/);

  expect(outside).toEqual([]);
  expect(failed).toEqual([]);
});

test('the semigraphics reference page works under a subdirectory', async ({ page }) => {
  const failed = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/zx81-trainer/debug/charset.html');
  await expect(page.locator('#charset tbody tr')).toHaveCount(22);
  expect(failed).toEqual([]);
});
