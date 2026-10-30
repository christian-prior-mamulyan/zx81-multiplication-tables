// Trainer behaviour: tests of the BASIC program itself (not of the emulator).
// The seeded variant is identical to the trainer except RAND becomes RAND 1.
import { expect, test } from './fixtures.js';
import { frameWhenScreenMatches, openProgram } from './helpers.js';
import {
  collectExercises,
  enterPause,
  expectedExercises,
  expectedLayout,
  openTrainer,
  pauseFrames,
  recordLines,
  startTrainer,
} from './trainer-helpers.js';

test('runs exactly ten exercises with correct operands, drawing and answers', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { exercises, finished } = await collectExercises(page, 10);

  expect(exercises).toHaveLength(10);
  const expected = expectedExercises(1, 10); // ZX81 RND sequence for seed 1, computed independently
  exercises.forEach((exercise, i) => {
    const { a, b } = expected[i];
    // the operands are read off the drawing: a rows of b blocks
    expect([exercise.a, exercise.b], `exercise ${i + 1} operands`).toEqual([a, b]);
    expect(exercise.answer, `exercise ${i + 1} answer`).toBe(a * b);
    expect(exercise.rows, `exercise ${i + 1} drawing`).toEqual(expectedLayout(a, b));
  });
  expect(finished || exercises.length === 10).toBe(true);
});

test('the multiplication is never printed as numbers', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { printed } = await collectExercises(page, 10);
  expect(printed).toBe(false);
});

test('after the tenth exercise the screen is cleared and tells the player to reload', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { finished, exercises } = await collectExercises(page, 11); // asking for more than exist runs to the end
  expect(finished).toBe(true);
  expect(exercises).toHaveLength(10);
  // a program that ends makes the ZX81 print its report ("0/190"); this one never ends
  const now = await page.evaluate(() => window.zx81.frame);
  await page.waitForFunction((frame) => window.zx81.frame >= frame + 150, now);
  const rows = await page.evaluate(() => window.zx81.getScreenRows());
  expect(rows.filter(Boolean)).toEqual(['PRESS RELOAD TO PLAY AGAIN']); // nothing else on screen, no report
  expect(await page.evaluate(() => window.zx81.line)).toBe(220);
});

test('units are quarter blocks, so every unit is separated from its neighbours', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { exercises } = await collectExercises(page, 10);
  for (const e of exercises) {
    for (const row of e.rows.filter(Boolean)) {
      expect(row).toMatch(/^(\[Q1\])+( (\[Q1\])+)?$/); // only code 1, never a full block (128)
      expect(row).not.toContain('Q128');
    }
  }
});

test('a blank line is printed above every result', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { exercises } = await collectExercises(page, 10);
  expect(exercises).toHaveLength(10);
  for (const e of exercises) {
    expect(e.blankAboveAnswer, `${e.a} X ${e.b}`).toBe(true);
  }
});

test('a gap after every fifth block across and a blank row after the fifth row down', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { exercises } = await collectExercises(page, 10);

  const wide = exercises.filter((e) => e.b > 5);
  const tall = exercises.filter((e) => e.a > 5); // more than five rows: the fifth row is followed by a blank row
  expect(wide.length).toBeGreaterThan(0);
  expect(tall.length).toBeGreaterThan(0);
  for (const e of wide) {
    for (const row of e.rows.filter(Boolean)) {
      expect(row).toMatch(/^(\[Q1\]){5} (\[Q1\])+$/);
    }
  }
  for (const e of tall) {
    expect(e.rows[5], `after row 5 of ${e.a} X ${e.b}`).toBe('');
    expect(e.rows.slice(0, 5).every(Boolean)).toBe(true);
    expect(e.rows.filter((r) => r === '')).toHaveLength(1); // only one separator, after the fifth row
  }
});

test('the pause input is in seconds', async ({ context }) => {
  // PAUSE P*50 (line 150) waits P*50 ZX81 frames, and the ZX81 shows 50 frames per second. The wait
  // is measured directly: the number of emulated frames the program spent in line 150, taken from
  // the emulator's own "BASIC line changed" events. The recorder is installed before the pause is
  // entered, so it cannot start late. The ZX81's frame counter is not perfectly in step with the
  // emulator's frames while BASIC is busy, hence a small tolerance.
  for (const pause of [1, 3, 12]) {
    const page = await context.newPage();
    await openTrainer(page);
    await recordLines(page);
    await enterPause(page, pause);
    const frames = await pauseFrames(page);
    await page.close();
    const expected = pause * 50;
    expect(
      Math.abs(frames - expected),
      `pause ${pause} s took ${frames} frames, expected ${expected}`,
    ).toBeLessThanOrEqual(Math.max(4, expected * 0.04));
  }
});

test('the delay is measured in emulated frames, not wall-clock time', async ({ context }) => {
  const frames = [];
  for (const speed of [8, 6]) {
    const page = await context.newPage();
    await openProgram(page, 'delay', { speed });
    frames.push(await frameWhenScreenMatches(page, /^DONE$/));
    await page.close();
  }
  expect(frames[0]).toBe(frames[1]); // same emulated time at different host speeds
  expect(frames[0]).toBeGreaterThanOrEqual(100); // PAUSE 100 = 100 frames = 2 emulated seconds
  expect(frames[0]).toBeLessThanOrEqual(115);
});
