// The page's navigation bar: a horizontal game status bar in Solarized orange, with live values
// from the emulator. (Other alternatives were tried and removed.)
import { expect, test } from './fixtures.js';
import { enterPause } from './trainer-helpers.js';

const ORANGE = 'rgb(203, 75, 22)'; // Solarized orange #cb4b16
const NIGHT = 'rgb(7, 54, 66)'; // Solarized base02

// WCAG contrast of one element's text against what is really behind it (nearest non-transparent
// background up the tree), with its type size and weight
const measure = (page, selector) =>
  page.evaluate((sel) => {
    const parse = (value) => value.match(/[\d.]+/g).map(Number);
    const luminance = ([r, g, b]) => {
      const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const element = document.querySelector(sel);
    if (!element) throw new Error(`no element for ${sel}`);
    let backdrop = element;
    let background = parse(getComputedStyle(backdrop).backgroundColor);
    while (background.length === 4 && background[3] === 0 && backdrop.parentElement) {
      backdrop = backdrop.parentElement;
      background = parse(getComputedStyle(backdrop).backgroundColor);
    }
    const style = getComputedStyle(element);
    const fg = luminance(parse(style.color));
    const bg = luminance(background);
    const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
    return { ratio: (hi + 0.05) / (lo + 0.05), px: Number.parseFloat(style.fontSize), weight: Number(style.fontWeight) };
  }, selector);

const status = (page, name) => page.locator(`nav.nav-status [data-status="${name}"]`);

test('the page has one navigation bar, above the heading, and no other alternatives', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav.site-nav')).toHaveCount(1);
  await expect(page.locator('#zx81-nav > nav.nav-status')).toBeVisible();
  const bar = await page.locator('nav.nav-status').boundingBox();
  const heading = await page.locator('h1').boundingBox();
  expect(bar.y + bar.height).toBeLessThanOrEqual(heading.y);
  // old alternatives and their options are gone
  await page.goto('/?nav=all');
  await expect(page.locator('nav.site-nav')).toHaveCount(1);
  expect((await page.request.get('/design/navbars.html')).status()).toBe(404);
});

test('the bar is Solarized orange all over, with a dark rule below', async ({ page }) => {
  await page.goto('/');
  const bar = page.locator('nav.nav-status');
  await expect(bar).toHaveCSS('background-color', ORANGE);
  await expect(bar).toHaveCSS('border-bottom-color', NIGHT);
  await expect(bar).toHaveCSS('border-bottom-width', '4px');
  await expect(page.locator('nav.nav-status dt').first()).toHaveCSS('background-color', 'rgb(253, 246, 227)'); // cream tags
});

for (const [label, size] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  test(`the bar is one horizontal row on a ${label} (scrolls sideways when too narrow)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const info = await page.locator('nav.nav-status').evaluate((nav) => {
      const items = [...nav.querySelectorAll('.title, dl, .action')];
      const tops = items.map((node) => Math.round(node.getBoundingClientRect().top));
      const style = getComputedStyle(nav);
      return {
        display: style.display,
        wrap: style.flexWrap,
        overflowX: style.overflowX,
        rowTops: Math.max(...tops) - Math.min(...tops),
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(info.display).toBe('flex');
    expect(info.wrap).toBe('nowrap');
    expect(info.overflowX).toBe('auto');
    expect(info.rowTops, 'all entries on one row').toBeLessThanOrEqual(24); // vertical centring differences only
    expect(info.pageOverflow, 'does not widen the page').toBeLessThanOrEqual(0);
  });
}

test('on a normal desktop width the whole bar fits without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  expect(await page.locator('nav.nav-status').evaluate((nav) => nav.scrollWidth - nav.clientWidth)).toBe(0);
});

test('text is readable: 4.5:1, or 3:1 for large bold text', async ({ page }) => {
  await page.goto('/');
  for (const selector of ['nav.nav-status .title', 'nav.nav-status dt', 'nav.nav-status dd', 'nav.nav-status .action']) {
    const { ratio, px, weight } = await measure(page, selector);
    const large = px >= 18.66 && weight >= 700;
    expect(ratio, `${selector} contrast ${ratio.toFixed(2)} at ${px}px`).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  }
});

test('the bar looks the same whatever the page theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('nav.nav-status')).toHaveCSS('background-color', ORANGE);
});

test('it shows the real emulator: state, BASIC line and emulated time', async ({ page }) => {
  await page.goto('/?debug=1&program=trainer-seeded&speed=8');
  await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
  await expect(status(page, 'state')).toHaveText('RUNNING');
  await expect(status(page, 'line')).toHaveText('20'); // INPUT P waits in line 20
  await enterPause(page, 5);
  await expect(status(page, 'line')).toHaveText('150', { timeout: 20_000 }); // PAUSE P*50
  await page.waitForFunction(() => document.querySelector('nav.nav-status [data-status="time"]').textContent !== '00:00');
});

test('the LISTING link leads to the program listing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav.nav-status .action')).toHaveAttribute('href', '#zx81-program');
  expect(await page.locator('#zx81-program').count()).toBe(1);
});

test('the bar works under a subdirectory too', async ({ page }) => {
  const failed = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/zx81-trainer/?debug=1&speed=8');
  await expect(page.locator('nav.nav-status')).toBeVisible();
  await expect(status(page, 'state')).toHaveText('RUNNING');
  expect(failed).toEqual([]);
});
