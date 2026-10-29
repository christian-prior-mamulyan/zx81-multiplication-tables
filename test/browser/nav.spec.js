// The five navigation bar designs in Solarized orange.
import { expect, test } from '@playwright/test';

const ORANGE = 'rgb(203, 75, 22)'; // Solarized orange #cb4b16

// WCAG contrast of the text of one link against what it sits on, plus its type size
const measure = (page, selector) =>
  page.evaluate((sel) => {
    const parse = (value) => value.match(/[\d.]+/g).map(Number);
    const luminance = ([r, g, b]) => {
      const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const link = document.querySelector(sel);
    const nav = link.closest('nav');
    const own = parse(getComputedStyle(link).backgroundColor);
    const background = own.length === 4 && own[3] === 0 ? parse(getComputedStyle(nav).backgroundColor) : own;
    const fg = luminance(parse(getComputedStyle(link).color));
    const bg = luminance(background);
    const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
    const style = getComputedStyle(link);
    return { ratio: (hi + 0.05) / (lo + 0.05), px: parseFloat(style.fontSize), weight: Number(style.fontWeight) };
  }, selector);

test('the design page shows five navigation bars, each with five links and one current page', async ({ page }) => {
  await page.goto('/design/navbars.html');
  for (const n of [1, 2, 3, 4, 5]) {
    const nav = page.locator(`nav.site-nav.nav-${n}`);
    await expect(nav).toBeVisible();
    await expect(nav.locator('a')).toHaveCount(5);
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(nav).toHaveAttribute('aria-label', 'Site');
  }
  await expect(page.locator('nav.site-nav')).toHaveCount(5);
});

test('every design uses Solarized orange', async ({ page }) => {
  await page.goto('/design/navbars.html');
  // 1: orange band
  await expect(page.locator('nav.nav-1')).toHaveCSS('background-color', ORANGE);
  // 2: the thick orange rule below the bar
  await expect(page.locator('nav.nav-2')).toHaveCSS('border-bottom-color', ORANGE);
  await expect(page.locator('nav.nav-2')).toHaveCSS('border-bottom-width', '4px');
  // 3: the current page is an orange pill
  await expect(page.locator('nav.nav-3 a[aria-current="page"]')).toHaveCSS('background-color', ORANGE);
  // 4: orange top line
  await expect(page.locator('nav.nav-4')).toHaveCSS('border-top-color', ORANGE);
  // 5: orange band
  await expect(page.locator('nav.nav-5')).toHaveCSS('background-color', ORANGE);
});

test('text is readable in every design: 4.5:1, or 3:1 for large bold text', async ({ page }) => {
  await page.goto('/design/navbars.html');
  for (const n of [1, 2, 3, 4, 5]) {
    for (const selector of [`nav.nav-${n} a:not([aria-current])`, `nav.nav-${n} a[aria-current="page"]`]) {
      const { ratio, px, weight } = await measure(page, selector);
      const large = px >= 18.66 && weight >= 700;
      expect(ratio, `${selector} contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(large ? 3 : 4.5);
      expect(large, `${selector} is large bold text`).toBe(true);
    }
  }
});

test('designs look the same in the dark page theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/design/navbars.html');
  await expect(page.locator('nav.nav-1')).toHaveCSS('background-color', ORANGE);
  for (const n of [1, 2, 3, 4, 5]) {
    const { ratio } = await measure(page, `nav.nav-${n} a:not([aria-current])`);
    expect(ratio).toBeGreaterThanOrEqual(3);
  }
});

test('a design can be tried on the game page with ?nav=N', async ({ page }) => {
  for (const n of [1, 3, 5]) {
    await page.goto(`/?nav=${n}`);
    const nav = page.locator(`#zx81-nav nav.nav-${n}`);
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const heading = await page.locator('h1').boundingBox();
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(heading.y); // the bar is above the heading
  }
});

test('the game page has no navigation bar unless one is asked for', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav.site-nav')).toHaveCount(0);
  await page.goto('/?nav=9');
  await expect(page.locator('nav.site-nav')).toHaveCount(0);
});

test('the links point to the site, the game sections and the repository', async ({ page }) => {
  await page.goto('/?nav=1');
  const hrefs = await page.locator('#zx81-nav a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual([
    'https://career.cprima.net/',
    '#zx81-stage',
    '#howto',
    '#zx81-program',
    'https://github.com/christian-prior-mamulyan/zx81-multiplication-tables',
  ]);
  for (const hash of ['#zx81-stage', '#howto', '#zx81-program']) {
    expect(await page.locator(hash).count(), `target ${hash} exists`).toBe(1);
  }
});

test('the navigation bars work under a subdirectory too', async ({ page }) => {
  const failed = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/zx81-trainer/design/navbars.html');
  await expect(page.locator('nav.site-nav')).toHaveCount(5);
  expect(failed).toEqual([]);
});
