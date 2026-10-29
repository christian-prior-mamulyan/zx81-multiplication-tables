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

// Press and release a key, timed exactly in EMULATED frames. The whole press happens inside the
// page, driven by the emulator's own frame events, so the number of frames the key is held does not
// depend on how fast the browser or the test runner is. (Timing it from outside once held keys for
// hundreds of frames on a slow CI machine: the ZX81 then repeated the character, "111", and a key
// still held when a PAUSE starts ends the PAUSE at once.) Held for `hold` frames, then `gap` frames
// of rest.
export function typeKey(page, key, { hold = 6, gap = 4 } = {}) {
  return page.evaluate(
    ([k, holdFrames, gapFrames]) =>
      new Promise((resolve) => {
        const machine = window.zx81;
        const after = (frames, then) => {
          const start = machine.frame;
          const off = machine.on('frame', ({ frame }) => {
            if (frame >= start + frames) {
              off();
              then();
            }
          });
        };
        machine.keyDown(k);
        after(holdFrames, () => {
          machine.keyUp(k);
          after(gapFrames, resolve);
        });
      }),
    [key, hold, gap],
  );
}
