import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VARS, decodeFloat, readBasicNumber } from '../../src/emulator/zx81-vars.js';

// The variables area of the real trainer, dumped from the emulator while it waited in line 150
// (pause 1, first exercise 2 x 3): P=1, FOR N=1 TO 10, A=2, B=3, FOR I=1 TO 2, FOR J=1 TO 3.
const DUMP = `75 81 00 00 00 00 f3 81 00 00 00 00 84 20 00 00 00 81 00 00 00 00 1f 00 66 82 00 00 00 00 67 82
40 00 00 00 ee 82 40 00 00 00 82 00 00 00 00 81 00 00 00 00 51 00 ef 83 00 00 00 00 82 40 00 00 00
81 00 00 00 00 5b 00 80 86 48 00 00 00 86 c8 00 00 00`;

function machine(hex, at = 0x44fd) {
  const memory = new Uint8Array(65536);
  memory[VARS] = at & 0xff;
  memory[VARS + 1] = at >> 8;
  memory.set(
    hex
      .trim()
      .split(/\s+/)
      .map((byte) => Number.parseInt(byte, 16)),
    at,
  );
  return (addr) => memory[addr];
}

test('the five-byte floating point format is decoded', () => {
  const read = (bytes) => (addr) => bytes[addr] ?? 0;
  assert.equal(decodeFloat(read([0, 0, 0, 0, 0]), 0), 0);
  assert.equal(decodeFloat(read([0x81, 0, 0, 0, 0]), 0), 1);
  assert.equal(decodeFloat(read([0x82, 0, 0, 0, 0]), 0), 2);
  assert.equal(decodeFloat(read([0x82, 0x40, 0, 0, 0]), 0), 3);
  assert.equal(decodeFloat(read([0x84, 0x20, 0, 0, 0]), 0), 10);
  assert.equal(decodeFloat(read([0x86, 0x48, 0, 0, 0]), 0), 50);
  assert.equal(decodeFloat(read([0x82, 0xc0, 0, 0, 0]), 0), -3); // sign bit set
  assert.equal(decodeFloat(read([0x80, 0, 0, 0, 0]), 0), 0.5);
});

test('numeric variables and FOR loop variables are found by their letter in the real dump', () => {
  const read = machine(DUMP);
  assert.equal(readBasicNumber(read, 'P'), 1);
  assert.equal(readBasicNumber(read, 'N'), 1); // a FOR variable: 1 of 10
  assert.equal(readBasicNumber(read, 'A'), 2);
  assert.equal(readBasicNumber(read, 'B'), 3);
  assert.equal(readBasicNumber(read, 'I'), 3); // a finished FOR loop leaves limit + 1
  assert.equal(readBasicNumber(read, 'J'), 4);
});

test('letters are case-insensitive and unknown variables give null', () => {
  const read = machine(DUMP);
  assert.equal(readBasicNumber(read, 'n'), 1);
  assert.equal(readBasicNumber(read, 'Z'), null);
  assert.equal(readBasicNumber(read, 'W'), null);
});

test('entries of other types are skipped by their size', () => {
  // string variable A$ (type 010, letter A = 0x06): length 2, "HI"; then number B = 3
  const read = machine('46 02 00 2d 2e 67 82 40 00 00 00 80');
  assert.equal(readBasicNumber(read, 'B'), 3);
  assert.equal(readBasicNumber(read, 'A'), null); // A$ is a string, not a number
  // a number with a long name: first letter 0xA1-style entry (type 101) then the value; then B = 1
  const long = machine('a6 a7 81 00 00 00 00 67 81 00 00 00 00 80');
  assert.equal(readBasicNumber(long, 'B'), 1);
});

test('an empty variables area and memory without one give null', () => {
  assert.equal(readBasicNumber(machine('80'), 'N'), null);
  assert.equal(
    readBasicNumber(() => 0, 'N'),
    null,
  ); // all zeros: no end marker, no match
});
