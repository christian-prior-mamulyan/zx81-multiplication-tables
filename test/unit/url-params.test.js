import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PROGRAM, parseParams, tapeUrl } from '../../src/web/url-params.js';

test('defaults launch the trainer with the real emulator', () => {
  assert.deepEqual(parseParams(''), {
    program: DEFAULT_PROGRAM,
    debug: false,
    emulator: 'real',
    renderer: 'screen',
    keypad: false,
    nav: 'all',
    scenario: 'normal',
    speed: null,
  });
  assert.equal(DEFAULT_PROGRAM, 'trainer');
});

test('program, debug, emulator and scenario are read from the query', () => {
  const p = parseParams('?program=hello&debug=1&emulator=mock&scenario=slow');
  assert.equal(p.program, 'hello');
  assert.equal(p.debug, true);
  assert.equal(p.emulator, 'mock');
  assert.equal(p.scenario, 'slow');
});

test('debug is only on for debug=1', () => {
  assert.equal(parseParams('?debug=0').debug, false);
  assert.equal(parseParams('?debug=true').debug, false);
});

test('unsafe program ids fall back to the trainer', () => {
  for (const bad of ['../secret', 'a/b', 'x.y', 'UPPER', '']) {
    assert.equal(parseParams(`?program=${encodeURIComponent(bad)}`).program, DEFAULT_PROGRAM, bad);
  }
});

test('speed is an integer from 0 to 8, otherwise ignored', () => {
  assert.equal(parseParams('?speed=8').speed, 8);
  assert.equal(parseParams('?speed=0').speed, 0);
  assert.equal(parseParams('?speed=9').speed, null);
  assert.equal(parseParams('?speed=fast').speed, null);
});

test('the page draws the screen itself unless ?renderer=emulator', () => {
  assert.equal(parseParams('').renderer, 'screen');
  assert.equal(parseParams('?renderer=emulator').renderer, 'emulator');
  assert.equal(parseParams('?renderer=other').renderer, 'screen');
});

test('the page holds all five navigation bars by default; ?nav= picks one or none', () => {
  assert.equal(parseParams('').nav, 'all');
  for (const n of [1, 2, 3, 4, 5]) assert.equal(parseParams(`?nav=${n}`).nav, n);
  assert.equal(parseParams('?nav=none').nav, 'none');
  assert.equal(parseParams('?nav=all').nav, 'all');
  for (const bad of ['0', '6', 'x', '']) assert.equal(parseParams(`?nav=${bad}`).nav, 'all', bad);
});

test('unknown emulator values mean the real emulator', () => {
  assert.equal(parseParams('?emulator=other').emulator, 'real');
});

test('tape URLs are relative, never root-relative', () => {
  assert.equal(tapeUrl('trainer'), './tapes/trainer.p.hex');
  assert.ok(!tapeUrl('trainer').startsWith('/'));
});
