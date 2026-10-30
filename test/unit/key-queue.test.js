import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KeyQueue } from '../../src/web/key-queue.js';

// a fake clock: timers run when the test advances time
function clock() {
  let time = 0;
  const timers = [];
  return {
    now: () => time,
    schedule: (fn, ms) => timers.push({ at: time + ms, fn }),
    advance(ms) {
      const end = time + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > end) {
          break;
        }
        const next = timers.shift();
        time = next.at;
        next.fn();
      }
      time = end;
    },
  };
}

function setup(options = {}) {
  const c = clock();
  const events = [];
  const queue = new KeyQueue({
    send: (type, key) => events.push([type, key, c.now()]),
    now: c.now,
    schedule: c.schedule,
    ...options,
  });
  return { c, events, queue };
}

test('a press goes down at once', () => {
  const { events, queue } = setup();
  queue.down('5');
  assert.deepEqual(events, [['down', '5', 0]]);
});

test('a quick tap is held for the minimum time before it is released', () => {
  const { c, events, queue } = setup();
  queue.down('5');
  queue.up('5'); // released in the same instant
  c.advance(59);
  assert.deepEqual(events, [['down', '5', 0]]); // still held
  c.advance(1);
  assert.deepEqual(events, [
    ['down', '5', 0],
    ['up', '5', 60],
  ]);
});

test('a key held longer than the minimum is released at once', () => {
  const { c, events, queue } = setup();
  queue.down('5');
  c.advance(500);
  queue.up('5');
  c.advance(0);
  assert.deepEqual(events.at(-1), ['up', '5', 500]);
});

test('two quick taps never overlap: the second goes down after the first is released plus a gap', () => {
  const { c, events, queue } = setup();
  queue.down('2');
  queue.up('2');
  queue.down('7'); // tapped while the first key is still held back
  queue.up('7');
  c.advance(1000);
  assert.deepEqual(events, [
    ['down', '2', 0],
    ['up', '2', 60],
    ['down', '7', 85], // 60 + gap 25
    ['up', '7', 145], // held 60
  ]);
});

test('at no time are two keys down at once for taps', () => {
  const { c, events, queue } = setup();
  for (const key of ['1', '2', '3', 'Enter']) {
    queue.down(key);
    queue.up(key);
  }
  c.advance(5000);
  let down = 0;
  for (const [type] of events) {
    down += type === 'down' ? 1 : -1;
    assert.ok(down <= 1, 'more than one key down');
  }
  assert.equal(down, 0);
  assert.deepEqual(
    events.filter(([type]) => type === 'down').map(([, key]) => key),
    ['1', '2', '3', 'Enter'],
  );
});

test('hold and gap can be changed', () => {
  const { c, events, queue } = setup({ hold: 100, gap: 10 });
  queue.down('a');
  queue.up('a');
  queue.down('b');
  c.advance(500);
  assert.deepEqual(events, [
    ['down', 'a', 0],
    ['up', 'a', 100],
    ['down', 'b', 110],
  ]);
});
