// Mobile browsers: one fluid column, a screen that fits, big touch targets, and a number pad that
// stands in for the ZX81 keyboard.
import { expect, test } from './fixtures.js';

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };

test.describe('phone (touch)', () => {
  test.use(PHONE);

  test('the page does not scroll sideways and the viewport is set for phones', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => document.querySelector('meta[name="viewport"]').content)).toContain(
      'width=device-width',
    );
    expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content)).toBe('#cb4b16');
  });

  test('the screen fills the width, keeps 4:3, and nothing overflows', async ({ page }) => {
    await page.goto('/');
    const stage = await page.locator('#zx81-stage').boundingBox();
    const canvas = await page.locator('#zx81-display').boundingBox();
    expect(stage.x).toBeGreaterThanOrEqual(0);
    expect(stage.x + stage.width).toBeLessThanOrEqual(390);
    expect(stage.width).toBeGreaterThan(330); // uses the width of the phone
    expect(canvas.width / canvas.height).toBeCloseTo(4 / 3, 1);
  });

  test('the number pad is shown on a touch screen, with big keys', async ({ page }) => {
    await page.goto('/');
    const pad = page.locator('#zx81-keypad');
    await expect(pad).toBeVisible();
    const keys = pad.locator('button');
    await expect(keys).toHaveCount(12);
    expect(await keys.evaluateAll((buttons) => buttons.map((b) => b.dataset.key))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'Backspace',
      '0',
      'Enter',
    ]);
    for (const box of await keys.evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().toJSON()))) {
      expect(box.height, 'touch target height').toBeGreaterThanOrEqual(44);
      expect(box.width, 'touch target width').toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });

  test('tapping the pad plays the game: pause, Enter, then the drawing appears', async ({ page }) => {
    await page.goto('/?debug=1&program=trainer-seeded&speed=8');
    await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
    await page.tap('#zx81-keypad [data-key="1"]');
    await page.waitForFunction(() => window.zx81.getScreenRows().some((row) => row.startsWith('1')));
    await page.tap('#zx81-keypad [data-key="Enter"]');
    await page.waitForFunction(() => window.zx81Presenter.log.some((rows) => rows.some((row) => row.includes('[Q1]'))));
  });

  test('the delete key and several digits work (a two-digit pause)', async ({ page }) => {
    await page.goto('/?debug=1&program=trainer-seeded&speed=8');
    await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
    for (const key of ['3', '4']) {
      await page.tap(`#zx81-keypad [data-key="${key}"]`);
    }
    await page.waitForFunction(() => window.zx81.getScreenRows().includes('34{L}'));
    await page.tap('#zx81-keypad [data-key="Backspace"]');
    await page.waitForFunction(() => window.zx81.getScreenRows().includes('3{L}'));
  });

  test('a very quick tap is still seen by the ZX81 (minimum key hold)', async ({ page }) => {
    await page.goto('/?debug=1&program=trainer-seeded&speed=8');
    await page.waitForFunction(() => window.zx81?.getScreenRows().includes('{L}'));
    for (const digit of ['2', '7']) {
      await page.evaluate((d) => {
        const key = document.querySelector(`#zx81-keypad [data-key="${d}"]`);
        const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true };
        key.dispatchEvent(new PointerEvent('pointerdown', init));
        key.dispatchEvent(new PointerEvent('pointerup', init)); // released in the same instant
      }, digit);
    }
    await page.waitForFunction(() => window.zx81.getScreenRows().includes('27{L}'));
  });

  test('New game is a comfortable touch target, comes first in the bar and is on screen', async ({ page }) => {
    await page.goto('/');
    const newGame = await page.locator('#zx81-newgame').boundingBox();
    const stage = await page.locator('#zx81-stage').boundingBox();
    const title = await page.locator('nav.nav-status .title').boundingBox();
    expect(newGame.height).toBeGreaterThanOrEqual(44);
    expect(newGame.y + newGame.height).toBeLessThanOrEqual(stage.y);
    expect(newGame.x).toBeGreaterThanOrEqual(0); // not scrolled out of view
    expect(newGame.x + newGame.width).toBeLessThanOrEqual(390);
    expect(newGame.x).toBeLessThan(title.x); // the bar scrolls sideways, so NEW GAME is placed first
  });

  test('the game is above the fold on a phone: the screen starts right under the bar and heading', async ({ page }) => {
    await page.goto('/');
    const stage = await page.locator('#zx81-stage').boundingBox();
    expect(stage.y).toBeLessThan(200); // not pushed down by instructions
    expect(stage.y + stage.height).toBeLessThan(844); // the whole screen fits in a 390x844 phone viewport
  });

  test('the program listing scrolls inside its box instead of widening the page', async ({ page }) => {
    await page.goto('/');
    await page.locator('#zx81-program > summary').click(); // the listing is in a closed <details>
    await page.locator('#zx81-listing').waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(await page.locator('#zx81-listing').evaluate((pre) => getComputedStyle(pre).overflowX)).toBe('auto');
  });

  test('the navigation bar scrolls sideways on a phone and does not widen the page', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const nav = await page
      .locator('nav.nav-status')
      .evaluate((bar) => ({ scrolls: bar.scrollWidth > bar.clientWidth, overflowX: getComputedStyle(bar).overflowX }));
    expect(nav).toEqual({ scrolls: true, overflowX: 'auto' }); // wider than a 390px phone, so it scrolls inside its own box
  });
});

test.describe('desktop (mouse and keyboard)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('no number pad on desktop, unless asked for with ?keypad=1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#zx81-keypad')).toBeHidden();
    await page.goto('/?keypad=1');
    await expect(page.locator('#zx81-keypad')).toBeVisible();
  });

  test('the screen is not wider than the text column on a big screen', async ({ page }) => {
    await page.goto('/');
    const stage = await page.locator('#zx81-stage').boundingBox();
    expect(stage.width).toBeLessThanOrEqual(680);
  });
});

test.describe('landscape phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('the pad switches to one row of six so screen and pad can both be seen', async ({ page }) => {
    await page.goto('/?keypad=1');
    const columns = await page
      .locator('#zx81-keypad')
      .evaluate((pad) => getComputedStyle(pad).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(6);
  });
});
