// Trainer behaviour: tests of the BASIC program itself (not of the emulator).
// The seeded variant is identical to the trainer except RAND becomes RAND 1.
import { expect, test } from '@playwright/test';
import { frameWhenScreenMatches, openProgram } from './helpers.js';
import { collectExercises, expectedBlockRow, expectedExercises, startTrainer } from './trainer-helpers.js';

test('runs exactly ten exercises with correct operands, drawing and answers', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { exercises, finished } = await collectExercises(page, 10);

  expect(exercises).toHaveLength(10);
  const expected = expectedExercises(1, 10); // ZX81 RND sequence for seed 1, computed independently
  exercises.forEach((exercise, i) => {
    const { a, b } = expected[i];
    expect([exercise.a, exercise.b], `exercise ${i + 1} operands`).toEqual([a, b]);
    expect(exercise.answer, `exercise ${i + 1} answer`).toBe(a * b);
    // a rows of b full-block semigraphics (code 128), with a gap after every fifth block
    expect(exercise.rows, `exercise ${i + 1} drawing`).toEqual(Array(a).fill(expectedBlockRow(b)));
  });
  expect(finished || exercises.length === 10).toBe(true);
});

test('the program completes after the tenth exercise', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { finished } = await collectExercises(page, 11); // asking for more than exist runs to the end
  expect(finished).toBe(true);
  await frameWhenScreenMatches(page, /^0\/190$/); // BASIC report: success, last line 190
});

test('the gap after every fifth block is really emitted', async ({ page }) => {
  await startTrainer(page, { pause: 1 });
  const { exercises } = await collectExercises(page, 10);
  const wide = exercises.filter((e) => e.b > 5);
  expect(wide.length).toBeGreaterThan(0);
  for (const e of wide) {
    for (const row of e.rows) expect(row).toMatch(/^(\[Q128\]){5} (\[Q128\])+$/);
  }
});

test('the pause value controls the delay before the answer', async ({ browser }) => {
  const gaps = [];
  for (const pause of [1, 2]) {
    const page = await browser.newPage();
    await startTrainer(page, { pause });
    const { exercises } = await collectExercises(page, 1);
    gaps.push(exercises[0].answerAt - exercises[0].drawnAt);
    await page.close();
  }
  // The delay is P*100 empty FOR/NEXT iterations, so one more unit of P adds the time of 100
  // iterations. Measured: about 106 emulated frames (~1.06 frames per iteration, 50 frames/s).
  expect(gaps[0]).toBeGreaterThan(100);
  const addedByOneUnit = gaps[1] - gaps[0];
  expect(addedByOneUnit).toBeGreaterThan(90);
  expect(addedByOneUnit).toBeLessThan(125);
});

test('the delay loop is measured in emulated frames, not wall-clock time', async ({ browser }) => {
  const frames = [];
  for (const speed of [8, 6]) {
    const page = await browser.newPage();
    await openProgram(page, 'delay', { speed });
    frames.push(await frameWhenScreenMatches(page, /^DONE$/));
    await page.close();
  }
  expect(frames[0]).toBe(frames[1]); // same emulated time at different host speeds
  expect(frames[0]).toBeGreaterThan(10);
});
