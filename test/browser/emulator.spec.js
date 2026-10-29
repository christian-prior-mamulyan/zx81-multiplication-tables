// Emulator integration: ROM boots, programs load, BASIC runs, graphics render, keys work.
import { expect, test } from './fixtures.js';
import { displayFileRows } from '../../src/emulator/zx81-text.js';
import { frameWhenScreenMatches, openProgram, pauseEmulator, screenRows, typeKey, waitForFrame } from './helpers.js';

test('ROM boots and runs a loaded program', async ({ page }) => {
  await openProgram(page, 'hello');
  await frameWhenScreenMatches(page, /^HELLO$/);
  const rows = await screenRows(page);
  expect(rows[0]).toBe('HELLO');
});

test('BASIC evaluates arithmetic', async ({ page }) => {
  await openProgram(page, 'arithmetic');
  await frameWhenScreenMatches(page, /^56$/);
});

test('the screen changes in response to input', async ({ page }) => {
  await openProgram(page, 'keyboard');
  await frameWhenScreenMatches(page, /^PRESS A KEY$/);
  const before = await page.evaluate(() => window.zx81.getScreenText());
  expect(before).not.toContain('A 38');
  await typeKey(page, 'a');
  await frameWhenScreenMatches(page, /^A 38$/);
  const after = await page.evaluate(() => window.zx81.getScreenText());
  expect(after).not.toBe(before);
});

test('the bare emulator page (no program) boots the ROM to the BASIC prompt', async ({ page }) => {
  await page.goto('/emulator/zx81.html?speed=8');
  await page.waitForFunction(() => window.zx81Machine?.frames > 200);
  const { address, bytes } = await page.evaluate(() => {
    const machine = window.zx81Machine;
    const d = machine.peek(0x400c, 2);
    const address = d[0] | (d[1] << 8);
    return { address, bytes: Array.from(machine.peek(address, 900)) };
  });
  const rows = displayFileRows((addr) => bytes[addr - address], address);
  expect(rows.at(-1)).toBe('{K}'); // the inverse K cursor on the bottom line: BASIC is waiting for a command
});

test('line 0 fixture loads and runs', async ({ page }) => {
  await openProgram(page, 'line0');
  await frameWhenScreenMatches(page, /^LINE0 OK$/);
  // the program image really contains a line numbered 0: first line-number word of the program
  const firstLine = await page.evaluate(() => [...window.zx81.getMemory(0x407d, 2)]);
  expect(firstLine).toEqual([0, 0]);
});

test('keyboard input reaches the program', async ({ page }) => {
  await openProgram(page, 'keyboard');
  await frameWhenScreenMatches(page, /^PRESS A KEY$/);
  await typeKey(page, 'a');
  await frameWhenScreenMatches(page, /^A 38$/); // ZX81 character code of "A" is 38
});

test('semigraphics are emitted as exact ZX81 codes', async ({ page }) => {
  await openProgram(page, 'graphics');
  await frameWhenScreenMatches(page, /\[Q138\]/);
  const rows = await screenRows(page);
  const codes = (row) => [...row.matchAll(/\[Q(\d+)\]/g)].map((m) => Number(m[1]));
  expect(codes(rows[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(codes(rows[1])).toEqual([128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138]);
});

test('semigraphics are rendered by the emulator (pixel regression)', async ({ page }) => {
  await openProgram(page, 'graphics');
  await frameWhenScreenMatches(page, /\[Q138\]/);
  await waitForFrame(page, (await page.evaluate(() => window.zx81.frame)) + 5);
  await pauseEmulator(page);
  // Compare the emulator's own canvas bitmap (via the adapter), not a screenshot of the page:
  // a page screenshot changes size with sub-pixel layout, the canvas bitmap does not.
  const png = await page.evaluate(async () => {
    const blob = await window.zx81.captureScreen();
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  expect(Buffer.from(png)).toMatchSnapshot('graphics.png', { maxDiffPixelRatio: 0.002 });
});

test('captureScreen returns a PNG of the emulated display only', async ({ page }) => {
  await openProgram(page, 'hello');
  await frameWhenScreenMatches(page, /^HELLO$/);
  const info = await page.evaluate(async () => {
    const blob = await window.zx81.captureScreen();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const canvas = document.getElementById('zx81-frame').contentDocument.getElementById('emulator_canvas');
    return { type: blob.type, magic: [...bytes.slice(0, 4)], width: canvas.width, height: canvas.height };
  });
  expect(info.type).toBe('image/png');
  expect(info.magic).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect([info.width, info.height]).toEqual([640, 480]);
});

test('memory can be read and written through the adapter', async ({ page }) => {
  await openProgram(page, 'hello');
  await frameWhenScreenMatches(page, /^HELLO$/);
  const result = await page.evaluate(() => {
    window.zx81.setMemory(0x8000, [1, 2, 3]);
    return [...window.zx81.getMemory(0x8000, 3)];
  });
  expect(result).toEqual([1, 2, 3]);
});
