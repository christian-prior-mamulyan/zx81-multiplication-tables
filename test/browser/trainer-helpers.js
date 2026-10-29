// Drives the real trainer program and records what it draws, frame by frame, from inside the page.
import { openProgram, typeKey, waitForFrame } from './helpers.js';

export const PROMPT = 'ENTER YOUR INDIVIDUAL PAUSE';

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

// What the trainer draws for a X b, as the rows of the diagnostic text form: a rows of b quarter
// blocks (ZX81 code 1), a gap after every fifth block, a blank row after the fifth row when more
// rows follow. A blank row above the answer is not part of this layout (see parseExercise).
export function expectedLayout(a, b) {
  const row = Array.from({ length: b }, (_, j) => '[Q1]' + (j === 4 ? ' ' : '')).join('').trimEnd();
  const rows = [];
  for (let i = 1; i <= a; i++) {
    rows.push(row);
    if (i === 5 && a > 5) rows.push('');
  }
  return rows;
}

export const expectedBlockRow = (b) => expectedLayout(1, b)[0];

// Reads one exercise off the screen rows (diagnostic text form). The multiplication is not printed
// as numbers, so the operands come from the drawing: a rows of b blocks. Returns null when nothing
// is drawn. blankAbove / answer describe the line below the drawing.
// Self-contained on purpose: its source is also run inside the page.
export function parseExercise(rows) {
  const isBlockRow = (r) => /^(\[Q1\])+( (\[Q1\])+)?$/.test(r ?? '');
  const drawn = [];
  let blockRows = 0;
  let i = 0;
  while (i < rows.length) {
    if (isBlockRow(rows[i])) {
      drawn.push(rows[i]);
      blockRows += 1;
      i += 1;
    } else if (rows[i] === '' && blockRows === 5 && isBlockRow(rows[i + 1])) {
      drawn.push(''); // separator after the fifth row
      i += 1;
    } else {
      break;
    }
  }
  if (blockRows === 0) return null;
  const b = (drawn[0].match(/\[Q1\]/g) ?? []).length;
  const blankAbove = rows[i] === '';
  const answer = blankAbove && /^\d+$/.test(rows[i + 1] ?? '') ? Number(rows[i + 1]) : null;
  return { rows: drawn, a: blockRows, b, blankAbove, answer };
}

export async function startTrainer(page, { program = 'trainer-seeded', pause = 1 } = {}) {
  await openProgram(page, program);
  // The prompt text appears at frame 2, but the program only waits for a key once INPUT shows its
  // cursor (inverse L, a few frames later). A key pressed before that is lost, so wait for the cursor.
  await page.waitForFunction((prompt) => {
    const rows = window.zx81.getScreenRows();
    return rows.includes(prompt) && rows.includes('{L}');
  }, PROMPT);
  for (const digit of String(pause)) await typeKey(page, digit);
  await typeKey(page, 'Enter');
}

// Record exercises until `count` are complete (or the program has reached its final wait, line 220).
// Each record: operands read off the drawing, the drawn rows, the frame where drawing last changed
// (drawnAt), the frame the answer first appeared (answerAt) and the answer.
export function collectExercises(page, count) {
  return page.evaluate(
    ({ wanted, parseSource }) =>
      new Promise((resolve) => {
        const parse = new Function(`return ${parseSource}`)();
        const done = [];
        let cur = null;
        let lastDrawing = '';
        let lastChangeAt = 0;
        let printed = false; // true if the multiplication was ever printed as numbers ("7 X 9")
        const close = () => {
          if (cur) done.push(cur);
          cur = null;
        };
        const off = window.zx81.on('frame', ({ frame }) => {
          const rows = window.zx81.getScreenRows();
          const shown = parse(rows);
          if (rows.some((r) => /\d+\s*[Xx*]\s*\d+/.test(r))) printed = true;

          // an exercise ends when its answer disappears (the next one clears the screen); the
          // answer is printed digit by digit, so a changing answer is the same exercise
          if (cur && cur.answer !== null && !(shown && shown.answer !== null && shown.a === cur.a && shown.b === cur.b)) {
            close();
          }
          if (shown) {
            const drawing = JSON.stringify(shown.rows);
            if (drawing !== lastDrawing) {
              lastDrawing = drawing;
              lastChangeAt = frame;
            }
            if (!cur) {
              cur = { a: 0, b: 0, rows: [], blankAboveAnswer: false, answer: null, answerAt: null, drawnAt: null };
            }
            cur.a = shown.a;
            cur.b = shown.b;
            cur.rows = shown.rows;
            if (shown.answer !== null) {
              if (cur.answerAt === null) {
                cur.answerAt = frame;
                cur.drawnAt = lastChangeAt; // the drawing was complete when the answer appeared
              }
              cur.answer = shown.answer; // keep the latest value: the final one is the complete number
              cur.blankAboveAnswer = shown.blankAbove;
            }
          } else {
            lastDrawing = '';
          }
          // after the tenth exercise the screen is cleared and the program waits in line 220 (it never ends, so no report is shown)
          const finished = window.zx81.line === 220;
          if (done.length >= wanted || finished) {
            if (finished) close();
            off();
            resolve({ exercises: done.slice(0, wanted), finished, printed });
          }
        });
      }),
    { wanted: count, parseSource: parseExercise.toString() },
  );
}

export async function waitFrames(page, n) {
  const now = await page.evaluate(() => window.zx81.frame);
  await waitForFrame(page, now + n);
}
