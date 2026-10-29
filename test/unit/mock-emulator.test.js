import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockZX81Emulator, SCENARIOS } from '../mock-emulator.js';

function collect(emulator) {
  const log = [];
  for (const name of ['ready', 'program-loaded', 'frame', 'line', 'stopped', 'error']) {
    emulator.on(name, (payload) => log.push([name, payload]));
  }
  return log;
}

const names = (log) => log.map(([name]) => name);

test('scenarios are the documented set', () => {
  assert.deepEqual(SCENARIOS, ['normal', 'slow', 'load-error', 'runtime-error', 'blank-screen', 'finished']);
});

test('unknown scenario is rejected', () => {
  assert.throws(() => new MockZX81Emulator({ scenario: 'nope' }), /unknown mock scenario/);
});

test('ready is emitted after construction', async () => {
  const emulator = new MockZX81Emulator();
  const log = collect(emulator);
  await Promise.resolve();
  assert.deepEqual(names(log), ['ready']);
});

test('normal: loads, runs, shows the first exercise deterministically', async () => {
  const emulator = new MockZX81Emulator({ scenario: 'normal' });
  const log = collect(emulator);
  await emulator.loadProgram('trainer');
  assert.equal(emulator.state, 'running');
  assert.equal(emulator.getScreenRows()[0], 'ENTER YOUR INDIVIDUAL PAUSE');
  emulator.tick(12);
  assert.equal(emulator.frame, 12);
  assert.equal(emulator.getScreenRows()[0], '[Q1][Q1][Q1][Q1]');
  assert.equal(emulator.getScreenRows().at(-1), '28');
  assert.equal(names(log).filter((n) => n === 'frame').length, 12);
  assert.ok(names(log).includes('program-loaded'));
});

test('load-error: loadProgram rejects and emits error', async () => {
  const emulator = new MockZX81Emulator({ scenario: 'load-error' });
  const log = collect(emulator);
  await assert.rejects(emulator.loadProgram('x'), /not found/);
  assert.equal(emulator.state, 'error');
  assert.ok(names(log).includes('error'));
});

test('runtime-error: error event and state after frame 5', async () => {
  const emulator = new MockZX81Emulator({ scenario: 'runtime-error' });
  const log = collect(emulator);
  await emulator.loadProgram('x');
  emulator.tick(10);
  assert.equal(emulator.state, 'error');
  assert.equal(emulator.frame, 5);
  assert.ok(names(log).includes('error'));
});

test('blank-screen: frames arrive but the screen stays empty', async () => {
  const emulator = new MockZX81Emulator({ scenario: 'blank-screen' });
  await emulator.loadProgram('x');
  emulator.tick(20);
  assert.deepEqual(emulator.getScreenRows(), []);
  assert.equal(emulator.frame, 20);
});

test('finished: stops with reason finished', async () => {
  const emulator = new MockZX81Emulator({ scenario: 'finished' });
  const log = collect(emulator);
  await emulator.loadProgram('x');
  emulator.tick(10);
  assert.equal(emulator.state, 'stopped');
  assert.deepEqual(log.find(([name]) => name === 'stopped')[1], { reason: 'finished' });
  assert.deepEqual(emulator.getScreenRows(), ['FINISHED']);
});

test('stop and start pause and resume frames', async () => {
  const emulator = new MockZX81Emulator();
  await emulator.loadProgram('x');
  emulator.tick(2);
  emulator.stop();
  emulator.tick(5);
  assert.equal(emulator.frame, 2);
  emulator.start();
  emulator.tick(1);
  assert.equal(emulator.frame, 3);
});

test('keys are recorded', () => {
  const emulator = new MockZX81Emulator();
  emulator.keyDown('5');
  emulator.keyDown('Enter');
  assert.deepEqual(emulator.keys, ['5', 'Enter']);
  assert.equal(emulator.lastKey, 'Enter');
});

test('memory can be written and read back', () => {
  const emulator = new MockZX81Emulator();
  emulator.setMemory(0x4000, [1, 2, 3]);
  assert.deepEqual([...emulator.getMemory(0x4000, 3)], [1, 2, 3]);
});

test('captureScreen returns a Blob with the screen text', async () => {
  const emulator = new MockZX81Emulator();
  await emulator.loadProgram('x');
  const blob = await emulator.captureScreen();
  assert.ok(blob instanceof Blob);
  assert.equal(await blob.text(), 'ENTER YOUR INDIVIDUAL PAUSE');
});

test('reset reloads the program from frame 0', async () => {
  const emulator = new MockZX81Emulator();
  await emulator.loadProgram('trainer');
  emulator.tick(4);
  await emulator.reset();
  assert.equal(emulator.frame, 0);
  assert.equal(emulator.program, 'trainer');
});

test('line events report the BASIC line being executed, only when it changes', async () => {
  const emulator = new MockZX81Emulator();
  const lines = [];
  emulator.on('line', ({ line, frame }) => lines.push([frame, line]));
  await emulator.loadProgram('trainer');
  emulator.tick(14);
  assert.deepEqual(lines, [
    [1, 10],
    [3, 20],
    [6, 80],
    [9, 150],
    [12, 170],
  ]);
  assert.equal(emulator.line, 170);
});

test('reset starts the line sequence again', async () => {
  const emulator = new MockZX81Emulator();
  await emulator.loadProgram('trainer');
  emulator.tick(5);
  await emulator.reset();
  assert.equal(emulator.line, null);
  const lines = [];
  emulator.on('line', ({ line }) => lines.push(line));
  emulator.tick(1);
  assert.deepEqual(lines, [10]);
});
