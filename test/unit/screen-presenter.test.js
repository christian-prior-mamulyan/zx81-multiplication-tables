import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_COLUMNS, SCREEN_ROWS, displayFileCodes } from '../../src/emulator/zx81-text.js';
import {
  HOLD_FRAMES,
  createPresenterState,
  hideReport,
  isBlank,
  isRemoval,
  isReport,
  planFrame,
  sameScreen,
} from '../../src/web/screen-presenter.js';

const blank = () => Array.from({ length: SCREEN_ROWS }, () => Array(SCREEN_COLUMNS).fill(0));
// a screen with the given cells set: [[row, column, code], ...]
const screen = (...cells) => {
  const s = blank();
  for (const [r, c, code] of cells) {
    s[r][c] = code;
  }
  return s;
};
const picture = () => screen([0, 0, 1], [0, 1, 1], [0, 2, 1], [1, 0, 1], [1, 1, 1], [1, 2, 1], [3, 0, 29]);

test('isBlank, sameScreen and isRemoval', () => {
  assert.ok(isBlank(blank()));
  assert.ok(!isBlank(picture()));
  assert.ok(sameScreen(picture(), picture()));
  assert.ok(!sameScreen(picture(), blank()));
  assert.ok(isRemoval(picture(), screen([0, 0, 1], [3, 0, 29]))); // cells only lost
  assert.ok(isRemoval(picture(), blank()));
  assert.ok(!isRemoval(picture(), picture())); // nothing lost
  assert.ok(!isRemoval(picture(), screen([0, 0, 1], [5, 5, 1]))); // a new cell appeared
  assert.ok(!isRemoval(picture(), screen([0, 0, 2]))); // a cell changed
});

test('drawing is shown immediately, cell by cell', () => {
  const state = createPresenterState();
  assert.deepEqual(planFrame(state, screen([0, 0, 1])), screen([0, 0, 1]));
  assert.deepEqual(planFrame(state, screen([0, 0, 1], [0, 1, 1])), screen([0, 0, 1], [0, 1, 1]));
  assert.equal(planFrame(state, screen([0, 0, 1], [0, 1, 1])), null); // unchanged: nothing to draw
});

test('a wipe is a hard cut: the picture stays until the screen is completely cleared', () => {
  const state = createPresenterState();
  planFrame(state, picture());
  // rows disappear from the top, one frame after the other
  assert.equal(planFrame(state, screen([1, 0, 1], [1, 1, 1], [1, 2, 1], [3, 0, 29])), null);
  assert.equal(planFrame(state, screen([3, 0, 29])), null);
  assert.ok(sameScreen(state.shown, picture())); // still the old picture
  const cut = planFrame(state, blank());
  assert.ok(sameScreen(cut, blank())); // then straight to the cleared screen
  assert.ok(sameScreen(state.shown, blank()));
});

test('a partly cleared screen that stays unchanged is shown after HOLD_FRAMES frames', () => {
  const state = createPresenterState();
  planFrame(state, picture());
  const partial = screen([0, 0, 1], [3, 0, 29]);
  for (let i = 1; i < HOLD_FRAMES; i++) {
    assert.equal(planFrame(state, partial), null);
  }
  assert.ok(sameScreen(planFrame(state, partial), partial));
});

test('a changing wipe restarts the hold count', () => {
  const state = createPresenterState();
  planFrame(state, picture());
  const a = screen([0, 0, 1], [3, 0, 29]);
  const b = screen([3, 0, 29]);
  planFrame(state, a);
  planFrame(state, a);
  assert.equal(planFrame(state, b), null); // different partial state: count starts again
  assert.equal(planFrame(state, b), null);
  assert.ok(sameScreen(planFrame(state, b), b));
});

test('returning to the shown picture cancels a hold', () => {
  const state = createPresenterState();
  planFrame(state, picture());
  planFrame(state, screen([0, 0, 1])); // held
  assert.equal(planFrame(state, picture()), null); // back to what is shown: nothing to do
  assert.equal(state.heldFrames, 0);
  assert.equal(state.held, null);
});

test('typing is immediate, deleting is held briefly (cursor and prompt behave)', () => {
  const state = createPresenterState();
  const prompt = screen([23, 0, 38]); // a letter in the lower screen
  planFrame(state, prompt);
  const typed = screen([23, 0, 38], [23, 1, 29]);
  assert.ok(sameScreen(planFrame(state, typed), typed)); // typed digit shows at once
  assert.equal(planFrame(state, prompt), null); // deleted: held for a moment...
  assert.equal(planFrame(state, prompt), null);
  assert.ok(sameScreen(planFrame(state, prompt), prompt)); // ...then shown
});

test('the display file is read into 24 rows of 32 raw codes', () => {
  const mem = new Uint8Array(65536);
  const dfile = 0x8000;
  // HALT(NEWLINE), "A", [code 1], NEWLINE, NEWLINE (empty row), "1", NEWLINE
  mem.set([118, 38, 1, 118, 118, 29, 118], dfile);
  const rows = displayFileCodes((addr) => mem[addr], dfile);
  assert.equal(rows.length, SCREEN_ROWS);
  assert.ok(rows.every((row) => row.length === SCREEN_COLUMNS));
  assert.deepEqual(rows[0].slice(0, 3), [38, 1, 0]);
  assert.ok(rows[1].every((code) => code === 0));
  assert.deepEqual(rows[2].slice(0, 2), [29, 0]);
  assert.ok(rows[10].every((code) => code === 0)); // missing rows are padded with blanks
});

// ZX81 character codes: digits 28-37 ("0" = 28), letters 38-63 ("A" = 38), "/" = 24
const reportScreen = (...codes) => {
  const s = Array.from({ length: SCREEN_ROWS }, () => Array(SCREEN_COLUMNS).fill(0));
  codes.forEach((code, i) => {
    s[SCREEN_ROWS - 1][i] = code;
  });
  return s;
};

test('the ZX81 end report in the bottom row is recognised: code, slash, line number', () => {
  assert.ok(isReport(reportScreen(28, 24, 30, 28, 28))); // 0/200
  assert.ok(isReport(reportScreen(28, 24, 29))); // 0/1
  assert.ok(isReport(reportScreen(38, 24, 29, 28))); // a letter code such as A/10
  assert.ok(!isReport(reportScreen())); // nothing there
  assert.ok(!isReport(reportScreen(28, 24))); // a slash without a line number
  assert.ok(!isReport(reportScreen(29, 28, 28))); // digits only, e.g. typed input
  assert.ok(!isReport(reportScreen(29, 0, 0, 24, 29))); // not at the start of the row
  assert.ok(!isReport(reportScreen(28, 24, 29, 0, 38))); // something else after the number
});

test('hideReport blanks only the report and leaves the input screen unchanged', () => {
  const withReport = reportScreen(28, 24, 30, 28, 28);
  withReport[3][0] = 38; // something above the report stays
  const hidden = hideReport(withReport);
  assert.ok(hidden[SCREEN_ROWS - 1].every((code) => code === 0));
  assert.equal(hidden[3][0], 38);
  assert.equal(withReport[SCREEN_ROWS - 1][0], 28); // the input was not changed
  const plain = reportScreen(29, 28);
  assert.equal(hideReport(plain), plain); // no report: the same screen comes back
});

test('after the report is hidden a cleared screen is a plain cut to blank', () => {
  const state = createPresenterState();
  planFrame(state, picture());
  const cleared = reportScreen(28, 24, 30, 28, 28); // the screen wiped, the ZX81 report in the corner
  assert.ok(isBlank(hideReport(cleared)));
  const shown = planFrame(state, hideReport(cleared));
  assert.ok(isBlank(shown));
});
