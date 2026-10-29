// Drives the real trainer program and records what it draws, frame by frame, from inside the page.
import { openProgram, typeKey, waitForFrame } from './helpers.js';

// The ZX81 RND function, written independently of the emulator (ZX81 manual, chapter 10):
// seed = (seed + 1) * 75 mod 65537 - 1; RND = seed / 65536.
export function expectedExercises(seed, count) {
  const exercises = [];
  let s = seed;
  const rnd = () => {
    s = (((s + 1) * 75) % 65537) - 1;
    return s / 65536;
  };
  for (let i = 0; i < count; i++) {
    const a = Math.floor(rnd() * 8) + 2; // LET A=INT (RND*8)+2
    const b = Math.floor(rnd() * 8) + 2; // LET B=INT (RND*8)+2
    exercises.push({ a, b });
  }
  return exercises;
}

// What one drawn row must look like: b blocks, a gap after every fifth block.
export function expectedBlockRow(b, block = '[Q128]') {
  let row = '';
  for (let j = 1; j <= b; j++) {
    row += block;
    if (j === 5) row += ' ';
  }
  return row.trimEnd();
}

export async function startTrainer(page, { program = 'trainer-seeded', pause = 1 } = {}) {
  await openProgram(page, program);
  await page.waitForFunction(() => window.zx81.getScreenRows().some((r) => r === 'PAUSE 1-9'));
  await typeKey(page, String(pause));
  await typeKey(page, 'Enter');
}

// Record exercises until `count` are complete (or the program ends with report 0/190).
export function collectExercises(page, count) {
  return page.evaluate(
    (wanted) =>
      new Promise((resolve) => {
        const done = [];
        let cur = null;
        const close = () => {
          if (cur) done.push(cur);
          cur = null;
        };
        const off = window.zx81.on('frame', ({ frame }) => {
          const rows = window.zx81.getScreenRows();
          const header = /^(\d+) X (\d+)$/.exec(rows[0] ?? '');
          const a = header ? Number(header[1]) : 0;
          const answerRow = header ? rows[1 + a] : undefined;
          const answer = answerRow && /^\d+$/.test(answerRow) ? Number(answerRow) : null;

          // an exercise ends when its answer disappears or another header takes its place; the
          // answer is printed digit by digit, so a changing answer is the same exercise
          const sameExercise = header && Number(header[1]) === cur?.a && Number(header[2]) === cur?.b;
          if (cur && cur.answer !== null && !(sameExercise && answer !== null)) {
            close();
          }
          if (header && !cur) {
            cur = { a, b: Number(header[2]), openedAt: frame, rows: [], answer: null, answerAt: null, drawnAt: null };
          }
          if (cur && header) {
            cur.rows = rows.slice(1, 1 + cur.a);
            const rowLength = 6 * cur.b + (cur.b > 5 ? 1 : 0); // b blocks of "[Q128]" plus the gap
            const fullyDrawn = cur.rows.length === cur.a && cur.rows.every((r) => r.length === rowLength);
            if (cur.drawnAt === null && fullyDrawn) cur.drawnAt = frame;
            if (answer !== null) {
              cur.answer = answer; // keep the latest value: the final one is the complete number
              if (cur.answerAt === null) cur.answerAt = frame;
            }
          }
          const finished = rows.some((r) => r === '0/190');
          if (done.length >= wanted || finished) {
            if (finished) close();
            off();
            resolve({ exercises: done.slice(0, wanted), finished });
          }
        });
      }),
    count,
  );
}

export async function waitFrames(page, n) {
  const now = await page.evaluate(() => window.zx81.frame);
  await waitForFrame(page, now + n);
}
