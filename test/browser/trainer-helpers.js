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
  const row = Array.from({ length: b }, (_, j) => '[Q1]' + (j === 4 ? ' ' : ''))
    .join('')
    .trimEnd();
  const rows = [];
  for (let i = 1; i <= a; i++) {
    rows.push(row);
    if (i === 5 && a > 5) {
      rows.push('');
    }
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
  if (blockRows === 0) {
    return null;
  }
  const b = (drawn[0].match(/\[Q1\]/g) ?? []).length;
  const blankAbove = rows[i] === '';
  const answer = blankAbove && /^\d+$/.test(rows[i + 1] ?? '') ? Number(rows[i + 1]) : null;
  return { rows: drawn, a: blockRows, b, blankAbove, answer };
}

// Open the trainer and wait until it waits for the pause input.
export async function openTrainer(page, { program = 'trainer-seeded' } = {}) {
  await openProgram(page, program);
  // The prompt text appears at frame 2, but the program only waits for a key once INPUT shows its
  // cursor (inverse L, a few frames later). A key pressed before that is lost, so wait for the cursor.
  await page.waitForFunction((prompt) => {
    const rows = window.zx81.getScreenRows();
    return rows.includes(prompt) && rows.includes('{L}');
  }, PROMPT);
}

// Remember every change of the BASIC line being executed, with the emulated frame it happened in.
// Install it BEFORE the pause is entered, so no part of the run is missed.
export function recordLines(page) {
  return page.evaluate(() => {
    window.zx81LineLog = [];
    window.zx81.on('line', ({ line, frame }) => window.zx81LineLog.push([line, frame]));
  });
}

// How many emulated frames the program waited in line 150 (PAUSE P*50), from the line log.
export async function pauseFrames(page) {
  await page.waitForFunction(() => {
    const log = window.zx81LineLog;
    const at = log.findIndex(([line]) => line === 150);
    return at >= 0 && at < log.length - 1;
  });
  return page.evaluate(() => {
    const log = window.zx81LineLog;
    const at = log.findIndex(([line]) => line === 150);
    return log[at + 1][1] - log[at][1];
  });
}

export async function startTrainer(page, { program = 'trainer-seeded', pause = 1 } = {}) {
  await openTrainer(page, { program });
  await enterPause(page, pause);
}

// Type the pause and Enter. The program must then take the input and move on (line 25 and later).
// On a loaded CI machine a key press has been seen to go missing (the digit shown, Enter lost, the
// program still waiting in line 20; not reproducible on a fast machine, and the ZX81's key debounce
// is not the cause: the emulator accepts keys with no gap at all). So if the program has not moved
// on, the missing key is typed again, up to twice. If it still does not start, fail at once and say
// what the screen shows, instead of every later wait timing out.
export async function enterPause(page, pause) {
  const digits = String(pause);
  for (const digit of digits) {
    await typeKey(page, digit);
  }
  await typeKey(page, 'Enter');
  for (let retry = 0; retry <= 2; retry++) {
    const started = await page
      .waitForFunction(() => window.zx81.line >= 25, undefined, { timeout: 5_000 })
      .then(
        () => true,
        () => false,
      );
    if (started) {
      return;
    }
    const rows = await page.evaluate(() => window.zx81.getScreenRows());
    if (retry === 2) {
      const info = await page.evaluate(() => ({
        line: window.zx81.line,
        frame: window.zx81.frame,
        rows: window.zx81.getScreenRows().filter(Boolean),
      }));
      throw new Error(`the trainer did not start after the pause input ${pause}: ${JSON.stringify(info)}`);
    }
    if (rows.includes(`${digits}{L}`)) {
      await typeKey(page, 'Enter'); // the digits are on screen, only Enter went missing
    } else {
      for (const digit of digits) {
        await typeKey(page, digit);
      } // the digits themselves went missing
      await typeKey(page, 'Enter');
    }
  }
}

// Record exercises until `count` are complete (or the program has ended: the ZX81 then prints its report, such as 0/200).
// Each record: operands read off the drawing, the drawn rows, the frame where drawing last changed
// (drawnAt), the frame the answer first appeared (answerAt) and the answer.
export function collectExercises(page, count) {
  return page.evaluate(
    ({ wanted, parseSource }) =>
      new Promise((resolve) => {
        const parse = new Function(`return ${parseSource}`)();
        const done = [];
        let cur = null;
        let firstSeen = new Map(); // drawing -> first frame it was on screen, within the current exercise
        let printed = false; // true if the multiplication was ever printed as numbers ("7 X 9")
        const close = () => {
          if (cur) {
            done.push(cur);
          }
          cur = null;
        };
        const startFrame = window.zx81.frame;
        const off = window.zx81.on('frame', ({ frame }) => {
          const rows = window.zx81.getScreenRows();
          if (frame - startFrame > 20_000) {
            // far more emulated time than ten exercises of up to 12 seconds need: give up with what we have
            off();
            resolve({
              exercises: done,
              finished: false,
              printed,
              timedOut: { line: window.zx81.line, rows: rows.filter(Boolean) },
            });
            return;
          }
          const shown = parse(rows);
          if (rows.some((r) => /\d+\s*[Xx*]\s*\d+/.test(r))) {
            printed = true;
          }

          // an exercise ends when its answer disappears (the next one clears the screen); the
          // answer is printed digit by digit, so a changing answer is the same exercise
          if (
            cur &&
            cur.answer !== null &&
            !(shown && shown.answer !== null && shown.a === cur.a && shown.b === cur.b)
          ) {
            close();
          }
          if (shown) {
            const drawing = JSON.stringify(shown.rows);
            if (!firstSeen.has(drawing)) {
              firstSeen.set(drawing, frame);
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
                // the first frame that showed the finished drawing (a one-frame dip in between, as a
                // half-updated display can cause, does not move it)
                cur.drawnAt = firstSeen.get(drawing);
              }
              cur.answer = shown.answer; // keep the latest value: the final one is the complete number
              cur.blankAboveAnswer = shown.blankAbove;
            }
          } else {
            firstSeen = new Map();
          }
          // after the tenth exercise the screen is cleared and the program ends: the ZX81 prints its report "0/200"
          const finished = rows.some((r) => /^0\/\d+$/.test(r));
          if (done.length >= wanted || finished) {
            if (finished) {
              close();
            }
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
