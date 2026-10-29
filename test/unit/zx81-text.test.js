import assert from 'node:assert/strict';
import { test } from 'node:test';
import { D_FILE, dfileAddress, displayFileRows, zx81CodeToText } from '../../src/emulator/zx81-text.js';

test('letters, digits and space', () => {
  assert.equal(zx81CodeToText(0), ' ');
  assert.equal(zx81CodeToText(28), '0');
  assert.equal(zx81CodeToText(37), '9');
  assert.equal(zx81CodeToText(38), 'A');
  assert.equal(zx81CodeToText(63), 'Z');
  assert.equal(zx81CodeToText(26), ',');
});

test('semigraphics are named by exact code, never approximated', () => {
  for (const code of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 128, 129, 138]) {
    assert.equal(zx81CodeToText(code), `[Q${code}]`);
  }
});

test('inverse letters and unknown codes are marked', () => {
  assert.equal(zx81CodeToText(128 + 38), '{A}');
  assert.equal(zx81CodeToText(200), '<200>');
});

test('display file is split into rows at NEWLINE bytes', () => {
  const mem = new Uint8Array(65536);
  const dfile = 0x8000;
  // HALT, "A", [Q128], padding blank, NEWLINE, NEWLINE (empty row), "1", NEWLINE
  mem.set([118, 38, 128, 0, 0, 118, 118, 29, 118], dfile);
  mem[D_FILE] = dfile & 255;
  mem[D_FILE + 1] = dfile >> 8;
  const read = (a) => mem[a];
  assert.equal(dfileAddress(read), dfile);
  const rows = displayFileRows(read, dfile);
  assert.deepEqual(rows.slice(0, 3), ['A[Q128]', '', '1']);
});

test('row reading stops at the end of memory', () => {
  const rows = displayFileRows(() => 0, 0xfff0);
  assert.ok(rows.length <= 24);
});
