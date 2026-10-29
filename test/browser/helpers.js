// Shared helpers for the browser tests. Everything is measured in emulated frames
// (50 per emulated second), never in wall-clock time.

export const SPEED = 8; // emulator speed index 8 = 10x real time; frame counts are unaffected

export async function openProgram(page, program, { prefix = '', speed = SPEED } = {}) {
  await page.goto(`${prefix}/?debug=1&program=${program}&speed=${speed}`);
  await page.waitForFunction(() => window.zx81?.state === 'running');
}

export function waitForFrame(page, frame) {
  return page.waitForFunction((target) => window.zx81.frame >= target, frame, { timeout: 60_000 });
}

export function screenRows(page) {
  return page.evaluate(() => window.zx81.getScreenRows());
}

export function pauseEmulator(page) {
  return page.evaluate(() => window.zx81.stop());
}

// Wait until a row of the emulated screen matches, then return the frame where it first did.
// The check runs inside the page on every emulated frame, so no frame is missed.
export function frameWhenScreenMatches(page, pattern) {
  return page.evaluate(
    (source) =>
      new Promise((resolve) => {
        const regex = new RegExp(source);
        const check = ({ frame }) => {
          if (window.zx81.getScreenRows().some((row) => regex.test(row))) {
            off();
            resolve(frame);
          }
        };
        const off = window.zx81.on('frame', check);
      }),
    pattern.source,
  );
}

// Press and release a key, leaving the emulator a few frames to see it.
export async function typeKey(page, key) {
  await page.evaluate((k) => window.zx81.keyDown(k), key);
  const before = await page.evaluate(() => window.zx81.frame);
  await waitForFrame(page, before + 3);
  await page.evaluate((k) => window.zx81.keyUp(k), key);
  await waitForFrame(page, before + 6);
}
