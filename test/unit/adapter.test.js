import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, Emitter, createEmulator, keyEventInit } from '../../src/emulator/emulator-adapter.js';
import { MockZX81Emulator } from '../mock-emulator.js';

test('events are the documented set', () => {
  assert.deepEqual(EVENTS, ['ready', 'program-loaded', 'frame', 'line', 'stopped', 'error']);
});

test('Emitter delivers events and unsubscribes', () => {
  const emitter = new Emitter();
  const seen = [];
  const off = emitter.on('frame', (e) => seen.push(e));
  emitter.emit('frame', 1);
  off();
  emitter.emit('frame', 2);
  assert.deepEqual(seen, [1]);
});

test('Emitter rejects unknown event names', () => {
  assert.throws(() => new Emitter().on('boom', () => {}), /unknown emulator event/);
});

test('key events carry what the emulator keyboard code reads', () => {
  assert.deepEqual(keyEventInit('a'), { key: 'a', keyCode: 0, shiftKey: false, bubbles: true, cancelable: true });
  assert.equal(keyEventInit('A').shiftKey, true);
  assert.equal(keyEventInit('Enter').keyCode, 13);
  assert.equal(keyEventInit('Enter').shiftKey, false);
});

test('createEmulator selects the mock without changing the interface', async () => {
  const emulator = await createEmulator({ kind: 'mock', scenario: 'normal', MockClass: MockZX81Emulator });
  assert.ok(emulator instanceof MockZX81Emulator);
  for (const method of [
    'loadProgram',
    'reset',
    'start',
    'stop',
    'keyDown',
    'keyUp',
    'focus',
    'getScreen',
    'captureScreen',
    'getMemory',
    'setMemory',
    'on',
  ]) {
    assert.equal(typeof emulator[method], 'function', method);
  }
});

test('createEmulator builds the real emulator by default', async () => {
  const emulator = await createEmulator({ container: {}, base: './' });
  assert.equal(emulator.constructor.name, 'RealZX81Emulator');
  assert.equal(emulator.state, 'idle');
  assert.equal(emulator.pc, null);
});
