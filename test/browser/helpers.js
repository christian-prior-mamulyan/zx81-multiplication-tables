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

// Press and release a key. The ZX81 scans its keyboard once per frame and needs the key held for a
// few scans; on a slow machine 3 frames were not always enough, so hold for 8 and leave 4 after.
export async function typeKey(page, key, { hold = 8 } = {}) {
  await page.evaluate((k) => window.zx81.keyDown(k), key);
  const before = await page.evaluate(() => window.zx81.frame);
  await waitForFrame(page, before + hold);
  await page.evaluate((k) => window.zx81.keyUp(k), key);
  await waitForFrame(page, before + hold + 4);
}
