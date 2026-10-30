// The page draws the ZX81 screen itself (screen-presenter.js): glyphs from the ROM, no raster
// skew, a hard cut when the program clears the screen.
import { expect, test } from './fixtures.js';
import { frameWhenScreenMatches } from './helpers.js';
import { startTrainer } from './trainer-helpers.js';

// colour of one canvas pixel as [r, g, b]
const pixel = (page, x, y) =>
  page.evaluate(
    ([px, py]) =>
      [...document.getElementById('zx81-display').getContext('2d').getImageData(px, py, 1, 1).data].slice(0, 3),
    [x, y],
  );
const dark = ([r, g, b]) => r + g + b < 60;
const light = ([r, g, b]) => r + g + b > 600;

test('the ZX81 screen is drawn from the ROM bitmaps on the page canvas', async ({ page }) => {
  await page.goto('/?debug=1&program=graphics&speed=8');
  await expect(page.locator('#zx81-display')).toBeVisible();
  await expect(page.locator('#zx81-stage')).toHaveClass(/presented/);
  await page.waitForFunction(() =>
    window.zx81Presenter?.log.some((rows) => rows.some((row) => row.includes('[Q138]'))),
  );
  // text row 0 starts at canvas (64, 48); each ZX81 pixel is 2x2 canvas pixels, a cell is 16x16.
  // column 0 of row 0 is a blank (code 0); column 1 is code 1 = top-left quarter block
  expect(light(await pixel(page, 66, 50))).toBe(true); // code 0: blank
  expect(dark(await pixel(page, 82, 50))).toBe(true); // code 1: top-left quarter set...
  expect(light(await pixel(page, 94, 62))).toBe(true); // ...bottom-right quarter clear
  // row 1: code 128 (inverse space) is a full block
  expect(dark(await pixel(page, 66, 66))).toBe(true);
  expect(dark(await pixel(page, 78, 78))).toBe(true);
  // code 2 (column 2) is the top-right quarter
  expect(dark(await pixel(page, 110, 50))).toBe(true);
  expect(light(await pixel(page, 98, 50))).toBe(true);
});

test('the emulator raster view is still available with ?renderer=emulator', async ({ page }) => {
  await page.goto('/?renderer=emulator&program=hello&speed=8');
  await expect(page.locator('#zx81-display')).toBeHidden();
  await expect(page.locator('#zx81-frame')).toBeVisible();
});

test('clearing the screen is a hard cut: the picture is replaced by the blank screen, no wipe', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  // the log holds every screen the page showed; wait for the blank screen after the first answer
  await page.waitForFunction(() => {
    const log = window.zx81Presenter.log;
    // a screen with a drawing and a result (the typed pause digit alone is not a result)
    const answered = log.findIndex(
      (rows) => rows.some((row) => row.includes('[Q1]')) && rows.some((row) => /^\d+$/.test(row)),
    );
    return answered >= 0 && log.slice(answered + 1).some((rows) => rows.every((row) => row === ''));
  });
  const { answered, next } = await page.evaluate(() => {
    const log = window.zx81Presenter.log;
    // a screen with a drawing and a result (the typed pause digit alone is not a result)
    const answered = log.findIndex(
      (rows) => rows.some((row) => row.includes('[Q1]')) && rows.some((row) => /^\d+$/.test(row)),
    );
    return { answered, next: log[answered + 1] };
  });
  expect(answered).toBeGreaterThan(0);
  // the very next screen after the answer is the completely cleared one: no half-wiped picture
  expect(next.every((row) => row === '')).toBe(true);
});

test('drawing stays immediate: each block appears as soon as it is printed', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const blocks = (rows) => (rows.join('').match(/\[Q1\]/g) ?? []).length;
  await page.waitForFunction((source) => {
    const count = new Function(`return ${source}`)();
    return window.zx81Presenter.log.some((rows) => count(rows) >= 3);
  }, blocks.toString());
  const counts = await page.evaluate((source) => {
    const count = new Function(`return ${source}`)();
    return window.zx81Presenter.log.map(count);
  }, blocks.toString());
  // the number of blocks on screen never goes down while a picture is being drawn (the entries
  // before the first block are the pause prompt and the typed digits, which vary with machine speed)
  const first = counts.findIndex((n) => n > 0);
  const drawing = counts.slice(first, first + 40);
  for (let i = 1; i < drawing.length; i++) {
    expect(drawing[i]).toBeGreaterThanOrEqual(drawing[i - 1]);
  }
  expect(Math.max(...drawing)).toBeGreaterThan(2);
});

test('the real keyboard reaches the emulated ZX81 from anywhere on the page', async ({ page }) => {
  await page.goto('/?debug=1&program=trainer-seeded&speed=8');
  await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
  await page.mouse.click(5, 5); // click on empty page area, not on the screen
  await page.keyboard.press('4');
  await page.waitForFunction(() => window.zx81Presenter.log.some((rows) => rows.some((row) => row.includes('4'))));
  // the key is shown on the page canvas as well
  await frameWhenScreenMatches(page, /^4\{L\}$/);
  await page.keyboard.press('Backspace'); // a real key, held long enough by the page (delete is shift+0)
  await frameWhenScreenMatches(page, /^\{L\}$/);
});

test('New game sits in the status bar, above the screen, at the right end', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const button = await page.locator('nav.nav-status #zx81-newgame').boundingBox();
  const bar = await page.locator('nav.nav-status').boundingBox();
  const stage = await page.locator('#zx81-stage').boundingBox();
  expect(button.y + button.height).toBeLessThanOrEqual(stage.y);
  expect(Math.abs(button.x + button.width - (bar.x + bar.width))).toBeLessThanOrEqual(40); // the right end of the bar (its padding)
});

test('after New game the focus is off the button so Enter does not press it again', async ({ page }) => {
  await page.goto('/?debug=1&program=trainer-seeded&speed=8');
  await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
  await page.click('#zx81-newgame');
  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('zx81-newgame');
});
