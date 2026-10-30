// The five alternative HORIZONTAL navigation bars in Solarized orange. Each has its own content
// and its own styling; all stay on one row (scrolling sideways when the screen is narrow).
import { expect, test } from './fixtures.js';
import { enterPause } from './trainer-helpers.js';

const ORANGE = 'rgb(203, 75, 22)'; // Solarized orange #cb4b16
const VARIANTS = [1, 2, 3, 4, 5];

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
    return { ratio: (hi + 0.05) / (lo + 0.05), px: parseFloat(style.fontSize), weight: Number(style.fontWeight) };
  }, selector);

// the text of everything in a bar that is content (links, crumbs, labels, values)
const contentOf = (page, n) =>
  page.locator(`nav.nav-${n}`).evaluate((nav) =>
    [...nav.querySelectorAll('a, li, .title, dt, dd')]
      .filter((node) => !node.querySelector('a, li'))
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  );

test('the design page shows five horizontal bars', async ({ page }) => {
  await page.goto('/design/navbars.html');
  await expect(page.locator('nav.site-nav')).toHaveCount(5);
  for (const n of VARIANTS) {
    await expect(page.locator(`nav.nav-${n}`)).toBeVisible();
    await expect(page.locator(`section[data-variant="${n}"] h2`)).toContainText(String(n));
    expect(await page.locator(`nav.nav-${n}`).evaluate((nav) => getComputedStyle(nav).display)).toBe('flex');
  }
});

test('every bar has its own content', async ({ page }) => {
  await page.goto('/design/navbars.html');
  const all = {};
  for (const n of VARIANTS) all[n] = await contentOf(page, n);
  for (const n of VARIANTS) expect(all[n].length, `bar ${n} has content`).toBeGreaterThanOrEqual(3);
  // no two bars have the same set of entries
  for (const a of VARIANTS) {
    for (const b of VARIANTS) {
      if (a < b) expect(JSON.stringify(all[a]), `bars ${a} and ${b} differ`).not.toBe(JSON.stringify(all[b]));
    }
  }
  // and what each one is about
  expect(all[1]).toEqual(expect.arrayContaining(['cprima', 'Play', 'How to play', 'The program', 'GitHub']));
  expect(all[2]).toEqual(expect.arrayContaining(['career.cprima.net', 'ZX81 multiplication tables', 'Source on GitHub']));
  expect(all[3].join(' ')).toMatch(/Play.*How to play 5 steps.*The program 27 lines/);
  expect(all[4]).toEqual(expect.arrayContaining(['ZX81', 'state', 'line', 'time', 'LISTING']));
  expect(all[5]).toEqual(expect.arrayContaining(['1PLAY', '2HOW TO PLAY', '3LISTING', '4SOURCE']));
});

test('every bar has its own styling', async ({ page }) => {
  await page.goto('/design/navbars.html');
  const styles = [];
  for (const n of VARIANTS) {
    styles.push(
      await page.locator(`nav.nav-${n}`).evaluate((nav) => {
        const style = getComputedStyle(nav);
        return `${style.backgroundColor}|${style.borderTopWidth}|${style.borderBottomWidth}|${style.borderRadius}|${style.fontFamily.includes('mono') ? 'mono' : 'sans'}`;
      }),
    );
  }
  // the combination of background, rules, corners and typeface differs for every bar
  expect(new Set(styles).size).toBe(5);
  await expect(page.locator('nav.nav-1')).toHaveCSS('background-color', ORANGE);
  await expect(page.locator('nav.nav-2')).toHaveCSS('border-bottom-color', ORANGE);
  await expect(page.locator('nav.nav-2')).toHaveCSS('border-bottom-width', '4px');
  await expect(page.locator('nav.nav-3 a[aria-current="page"]')).toHaveCSS('background-color', ORANGE);
  await expect(page.locator('nav.nav-4')).toHaveCSS('background-color', ORANGE); // Solarized orange is the dominant colour
  await expect(page.locator('nav.nav-4')).toHaveCSS('border-bottom-color', 'rgb(7, 54, 66)'); // with a dark rule below
  await expect(page.locator('nav.nav-5')).toHaveCSS('background-color', ORANGE);
});

for (const [label, size] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  test(`every bar is one horizontal row on a ${label} (scrolls sideways when too narrow)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/design/navbars.html');
    for (const n of VARIANTS) {
      const info = await page.locator(`nav.nav-${n}`).evaluate((nav) => {
        const items = [...nav.querySelectorAll('a, .title, dl, li')].filter((node) => !node.querySelector('li, a, dl') || node.matches('dl'));
        const tops = items.map((node) => Math.round(node.getBoundingClientRect().top));
        const style = getComputedStyle(nav);
        return {
          rowTops: Math.max(...tops) - Math.min(...tops),
          overflowX: style.overflowX,
          wrap: style.flexWrap,
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(info.wrap, `bar ${n} never wraps`).toBe('nowrap');
      expect(info.overflowX, `bar ${n} scrolls sideways`).toBe('auto');
      expect(info.rowTops, `bar ${n}: all entries on one row`).toBeLessThanOrEqual(24); // vertical centring differences only
      expect(info.pageOverflow, `bar ${n} does not widen the page`).toBeLessThanOrEqual(0);
    }
  });
}

test('text is readable in every bar: 4.5:1, or 3:1 for large bold text', async ({ page }) => {
  await page.goto('/design/navbars.html');
  const checked = [
    'nav.nav-1 .brand',
    'nav.nav-1 ul a:not([aria-current])',
    'nav.nav-1 ul a[aria-current="page"]',
    'nav.nav-2 ol a',
    'nav.nav-2 li[aria-current="page"]',
    'nav.nav-2 .aside',
    'nav.nav-3 a:not([aria-current])',
    'nav.nav-3 a[aria-current="page"]',
    'nav.nav-3 .badge',
    'nav.nav-4 .title',
    'nav.nav-4 dt',
    'nav.nav-4 dd',
    'nav.nav-4 .action',
    'nav.nav-5 a:not([aria-current])',
    'nav.nav-5 a[aria-current="page"]',
    'nav.nav-5 .key',
    'nav.nav-5 a[aria-current="page"] .key',
  ];
  for (const selector of checked) {
    const { ratio, px, weight } = await measure(page, selector);
    const large = px >= 18.66 && weight >= 700;
    expect(ratio, `${selector} contrast ${ratio.toFixed(2)} at ${px}px`).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  }
});

test('the bars look the same whatever the page theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/design/navbars.html');
  await expect(page.locator('nav.nav-1')).toHaveCSS('background-color', ORANGE);
  const { ratio } = await measure(page, 'nav.nav-2 ol a');
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('bar 4 shows live values and bar 3 a line count', async ({ page }) => {
  await page.goto('/design/navbars.html');
  const status = (name) => page.locator(`nav.nav-4 [data-status="${name}"]`);
  await expect(status('state')).toHaveText('RUNNING');
  await expect(status('line')).toHaveText('20');
  await expect(status('time')).toHaveText('00:00');
  await expect(status('line')).not.toHaveText('20', { timeout: 6000 }); // the simulated values move on
  await expect(page.locator('nav.nav-3 [data-badge="lines"]')).toHaveText('27 lines');
});

test('on the game page each design can be tried with ?nav=N, above the heading', async ({ page }) => {
  for (const n of VARIANTS) {
    await page.goto(`/?nav=${n}`);
    const nav = page.locator(`#zx81-nav nav.nav-${n}`);
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const heading = await page.locator('h1').boundingBox();
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(heading.y);
  }
});

test('bar 4 on the game page shows the real emulator: state, BASIC line and time', async ({ page }) => {
  await page.goto('/?nav=4&debug=1&program=trainer-seeded&speed=8');
  const status = (name) => page.locator(`nav.nav-4 [data-status="${name}"]`);
  await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
  await expect(status('state')).toHaveText('RUNNING');
  await expect(status('line')).toHaveText('20'); // INPUT P waits in line 20
  await enterPause(page, 5);
  await expect(status('line')).toHaveText('150', { timeout: 20_000 }); // PAUSE P*50
  await page.waitForFunction(() => document.querySelector('nav.nav-4 [data-status="time"]').textContent !== '00:00');
});

test('bar 3 on the game page counts the real steps and BASIC lines', async ({ page }) => {
  await page.goto('/?nav=3');
  await expect(page.locator('nav.nav-3 [data-badge="steps"]')).toHaveText('5 steps');
  await page.locator('#zx81-listing .line').first().waitFor(); // the listing loads after the page
  const lines = await page.locator('#zx81-listing .line').count();
  await expect(page.locator('nav.nav-3 [data-badge="lines"]')).toHaveText(`${lines} lines`);
});

test('the single game page holds the five alternative navigation bars, one div each', async ({ page }) => {
  await page.goto('/');
  const holders = page.locator('#zx81-nav > div.nav-alt');
  await expect(holders).toHaveCount(5);
  for (const n of VARIANTS) {
    const holder = page.locator(`#zx81-nav > div.nav-alt[data-alt="${n}"]`);
    await expect(holder.locator(`nav.site-nav.nav-${n}`)).toHaveCount(1); // exactly one bar in its own div
    await expect(holder.locator('.nav-caption')).toContainText(`Alternative ${n}`);
    await expect(holder.locator('nav')).toBeVisible();
    expect(await holder.locator('nav').evaluate((nav) => getComputedStyle(nav).display)).toBe('flex'); // horizontal
  }
  // in order, one below the other, all above the heading
  const tops = [];
  for (const n of VARIANTS) tops.push((await page.locator(`#zx81-nav > div.nav-alt[data-alt="${n}"]`).boundingBox()).y);
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  const heading = await page.locator('h1').boundingBox();
  expect(tops.at(-1)).toBeLessThan(heading.y);
  // the game is still on the same page, below them
  await expect(page.locator('#zx81-stage')).toBeVisible();
  await expect(page.locator('#zx81-reload')).toBeVisible();
});

test('?nav=N shows one bar, ?nav=none none, anything else all five', async ({ page }) => {
  await page.goto('/?nav=3');
  await expect(page.locator('nav.site-nav')).toHaveCount(1);
  await expect(page.locator('nav.nav-3')).toHaveCount(1);
  await page.goto('/?nav=none');
  await expect(page.locator('nav.site-nav')).toHaveCount(0);
  await page.goto('/?nav=9');
  await expect(page.locator('nav.site-nav')).toHaveCount(5);
});

test('with all five on the page the live bars follow the emulator and each bar keeps its own content', async ({ page }) => {
  await page.goto('/?debug=1&program=trainer-seeded&speed=8');
  await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
  await expect(page.locator('nav.nav-4 [data-status="state"]')).toHaveText('RUNNING');
  await expect(page.locator('nav.nav-4 [data-status="line"]')).toHaveText('20');
  await page.locator('#zx81-listing .line').first().waitFor();
  const lines = await page.locator('#zx81-listing .line').count();
  await expect(page.locator('nav.nav-3 [data-badge="lines"]')).toHaveText(`${lines} lines`);
  const texts = await page.locator('nav.site-nav').evaluateAll((navs) => navs.map((nav) => nav.innerText.replace(/\s+/g, ' ').trim()));
  expect(new Set(texts).size).toBe(5);
});

test('links point to the site, the game sections and the repository', async ({ page }) => {
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
