// Web Awesome and Font Awesome Pro come from third-party kits. The page must look right and play
// with the kit present (a stand-in kit is supplied here), and also when the kit cannot be reached.
import { expect, test } from './fixtures.js';
import { frameWhenScreenMatches } from './helpers.js';

const BASE3 = 'rgb(253, 246, 227)'; // Solarized base3, the page background
const ORANGE = 'rgb(203, 75, 22)';

// A stand-in for the kit: a few CSS rules and a loader that defines <wa-icon>.
async function standInKit(page) {
  await page.route(/^https?:\/\/ka-p\.webawesome\.com\//, (route) => {
    const url = route.request().url();
    if (url.endsWith('.css')) {
      return route.fulfill({ contentType: 'text/css', body: ':root{--stand-in-kit:loaded}' });
    }
    return route.fulfill({
      contentType: 'text/javascript',
      body: "customElements.define('wa-icon', class extends HTMLElement { connectedCallback() { this.dataset.kit = 'loaded'; } });",
    });
  });
}

test('with the kit present: stylesheets apply, <wa-icon> is defined, the game still runs', async ({ page }) => {
  await standInKit(page);
  await page.goto('/?debug=1&program=hello&speed=8');
  await page.waitForFunction(() => customElements.get('wa-icon') !== undefined);
  // the three kit stylesheets were switched from non-blocking "print" to "all" by their onload
  const media = await page.locator('link[href*="webawesome"]').evaluateAll((links) => links.map((l) => l.media));
  expect(media).toEqual(['all', 'all', 'all']);
  await expect(page.locator('#zx81-reload wa-icon')).toHaveAttribute('data-kit', 'loaded');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--stand-in-kit'))).toBe(
    'loaded',
  );
  await frameWhenScreenMatches(page, /^HELLO$/);
  // the Font Awesome kit code is on the page, for the Pro icons
  await expect(page.locator('html')).toHaveAttribute('data-fa-kit-code', '5df958b77d');
});

test('with the kit unreachable: the page is complete and playable without it', async ({ page }) => {
  // fixtures.js aborts every kit request
  await page.goto('/?debug=1&program=hello&speed=8');
  await frameWhenScreenMatches(page, /^HELLO$/);
  expect(await page.evaluate(() => customElements.get('wa-icon'))).toBeUndefined();
  await expect(page.locator('#zx81-reload')).toBeVisible();
  await expect(page.locator('#zx81-reload')).toContainText('Reload'); // the text label does not depend on the icon
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(BASE3);
  await expect(page.locator('#zx81-display')).toBeVisible();
});

test('the kit stylesheets do not block the first paint', async ({ page }) => {
  // a kit that never answers must not keep the page blank
  await page.route(/^https?:\/\/ka-p\.webawesome\.com\//, () => {}); // never fulfilled
  await page.goto('/?debug=1&program=hello&speed=8', { waitUntil: 'domcontentloaded' });
  await frameWhenScreenMatches(page, /^HELLO$/);
  await expect(page.locator('#zx81-display')).toBeVisible();
});

test('identity: Solarized Light with the orange bar across the top, light only', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); // a dark OS theme does not change the identity
  await page.goto('/');
  const bar = await page.evaluate(() => {
    const style = getComputedStyle(document.body, '::before');
    return { position: style.position, height: style.height, background: style.backgroundColor, top: style.top };
  });
  expect(bar).toEqual({ position: 'fixed', height: '6px', background: ORANGE, top: '0px' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(BASE3);
});

test('no Font Awesome Pro or Web Awesome files are part of the repository', async () => {
  // Pro assets must never be committed (the repository is public): only the kit code and URLs appear
  const { execFileSync } = await import('node:child_process');
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  const offenders = files.filter(
    (file) => /\.(woff2?|ttf|otf|eot)$/i.test(file) || /(fontawesome|webawesome|fa-pro)/i.test(file),
  );
  expect(offenders).toEqual([]);
});
