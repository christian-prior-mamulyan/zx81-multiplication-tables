// The web shell: URL parameters, debug mode, mock emulator, GitHub Pages paths.
import { expect, test } from '@playwright/test';
import { frameWhenScreenMatches } from './helpers.js';

test('the normal URL launches the trainer without any debug surface', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('zx81-frame')?.contentWindow?.zx81Machine?.frames > 20);
  expect(await page.evaluate(() => window.zx81)).toBeUndefined();
  await expect(page.locator('#zx81-debug')).toBeHidden();
  const loaded = await page.evaluate(() => document.getElementById('zx81-frame').src);
  expect(loaded).toContain('tzx=../tapes/trainer.p');
  await page.waitForFunction(() => document.getElementById('zx81-frame').contentWindow.zx81Machine.peek(0x400c, 2)[0] !== 0);
});

test('?program= selects another program', async ({ page }) => {
  await page.goto('/?debug=1&program=hello');
  await page.waitForFunction(() => window.zx81?.state === 'running');
  expect(await page.evaluate(() => window.zx81.program)).toBe('hello');
  await frameWhenScreenMatches(page, /^HELLO$/);
});

test('?debug=1 shows the panel and exposes the adapter', async ({ page }) => {
  await page.goto('/?debug=1&program=hello&speed=8');
  await page.waitForFunction(() => window.zx81?.state === 'running');
  await expect(page.locator('#zx81-debug')).toBeVisible();
  await expect(page.locator('#zx81-debug [data-f="program"]')).toHaveText('hello');
  await page.waitForFunction(() => Number(document.querySelector('#zx81-debug [data-f="frame"]').textContent) > 0);
});

test('debug controls pause, step one frame and resume', async ({ page }) => {
  await page.goto('/?debug=1&program=hello&speed=8');
  await page.waitForFunction(() => window.zx81?.state === 'running' && window.zx81.frame > 5);
  await page.click('#zx81-debug [data-a="pause"]');
  const paused = await page.evaluate(() => window.zx81.frame);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(await page.evaluate(() => window.zx81.frame)).toBe(paused);
  await page.click('#zx81-debug [data-a="step"]');
  await page.waitForFunction((f) => window.zx81.frame === f + 1, paused);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(await page.evaluate(() => window.zx81.frame)).toBe(paused + 1);
  await page.click('#zx81-debug [data-a="run"]');
  await page.waitForFunction((f) => window.zx81.frame > f + 5, paused);
});

test('debug capture button downloads zx81-screen.png', async ({ page }) => {
  await page.goto('/?debug=1&program=hello&speed=8');
  await frameWhenScreenMatches(page, /^HELLO$/);
  const download = page.waitForEvent('download');
  await page.click('#zx81-debug [data-a="capture"]');
  expect((await download).suggestedFilename()).toBe('zx81-screen.png');
});

test('unknown tape reports an error instead of a blank page', async ({ page }) => {
  await page.goto('/?program=does-not-exist');
  await expect(page.locator('#zx81-status')).toContainText('not found');
});

test('mock emulator: normal scenario', async ({ page }) => {
  await page.goto('/?emulator=mock&scenario=normal&debug=1');
  await page.waitForFunction(() => window.zx81?.state === 'running' && window.zx81.frame > 12);
  await expect(page.locator('#mock-screen')).toContainText('7 X 4');
  expect(await page.locator('iframe').count()).toBe(0);
});

test('mock emulator: load-error scenario shows the error', async ({ page }) => {
  await page.goto('/?emulator=mock&scenario=load-error');
  await expect(page.locator('#zx81-status')).toContainText('not found');
});

test('mock emulator: finished scenario stops', async ({ page }) => {
  await page.goto('/?emulator=mock&scenario=finished&debug=1');
  await page.waitForFunction(() => window.zx81?.state === 'stopped');
  await expect(page.locator('#mock-screen')).toContainText('FINISHED');
});

test('mock emulator: runtime-error scenario shows the error', async ({ page }) => {
  await page.goto('/?emulator=mock&scenario=runtime-error');
  await expect(page.locator('#zx81-status')).toContainText('runtime error');
});

test('mock emulator: blank-screen scenario keeps the screen empty', async ({ page }) => {
  await page.goto('/?emulator=mock&scenario=blank-screen&debug=1');
  await page.waitForFunction(() => window.zx81?.frame > 5);
  await expect(page.locator('#mock-screen')).toHaveText('');
});

test('mock emulator: slow scenario advances slowly', async ({ page }) => {
  await page.goto('/?emulator=mock&scenario=slow&debug=1');
  await page.waitForFunction(() => window.zx81?.state === 'running');
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1200)));
  expect(await page.evaluate(() => window.zx81.frame)).toBeLessThan(6);
});

test('semigraphics reference page draws the ROM bitmaps', async ({ page }) => {
  await page.goto('/debug/charset.html');
  await expect(page.locator('#charset tbody tr')).toHaveCount(22);
  await expect(page.locator('#charset canvas[data-code="128"]')).toBeVisible();
  const full = await page.evaluate(() => {
    const canvas = document.querySelector('#charset canvas[data-code="128"]');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return [...data].filter((_, i) => i % 4 === 3 && data[i] === 255).length;
  });
  expect(full).toBe(48 * 48); // inverse space: every pixel of the cell is set
  const quarter = await page.evaluate(() => {
    const canvas = document.querySelector('#charset canvas[data-code="1"]');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return [...data].filter((_, i) => i % 4 === 3 && data[i] === 255).length;
  });
  expect(quarter).toBe(24 * 24); // code 1 is one quarter of the cell
});
