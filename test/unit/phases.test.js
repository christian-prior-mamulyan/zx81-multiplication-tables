import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { exerciseLabel, loadPhases, phaseForLine, phasesUrl } from '../../src/web/phases.js';

const table = JSON.parse(readFileSync('src/basic/trainer.phases.json', 'utf8'));

test('the phase table of the trainer covers every line of the program once', () => {
  const lines = readFileSync('src/basic/trainer.bas', 'utf8')
    .split('\n')
    .filter((text) => /^\s*\d+\s/.test(text))
    .map((text) => Number.parseInt(text, 10));
  for (const line of lines) {
    const phases = table.phases.filter((phase) => line >= phase.from && line <= phase.to);
    assert.equal(phases.length, 1, `line ${line} belongs to exactly one phase`);
  }
});

test('lines map to the player-facing phases', () => {
  const id = (line) => phaseForLine(table, line)?.id;
  assert.equal(id(20), 'input'); // INPUT P
  assert.equal(id(30), 'drawing'); // FOR N
  assert.equal(id(100), 'drawing'); // PRINT of one block
  assert.equal(id(150), 'pause'); // PAUSE P*50
  assert.equal(id(170), 'answer'); // PRINT A*B
  assert.equal(id(190), 'answer'); // NEXT N
  assert.equal(id(200), 'finished'); // CLS, then the program ends
  assert.equal(phaseForLine(table, 999), null);
  assert.equal(phaseForLine(table, null), null);
  assert.equal(phaseForLine(null, 20), null);
});

test('phases have short upper-case labels that fit the status bar', () => {
  for (const phase of table.phases) {
    assert.match(phase.label, /^[A-Z ]{1,9}$/, phase.id);
  }
});

test('the phase table URL is relative and the seeded test variant shares the trainer table', () => {
  assert.equal(phasesUrl('trainer'), './basic/trainer.phases.json');
  assert.equal(phasesUrl('trainer-seeded'), './basic/trainer.phases.json');
  assert.ok(!phasesUrl('trainer').startsWith('/'));
});

test('the exercise label is n/total, clamped, and the last one when the program has ended', () => {
  assert.equal(exerciseLabel(table, 1, false), '1/10');
  assert.equal(exerciseLabel(table, 7, false), '7/10');
  assert.equal(exerciseLabel(table, 11, false), '10/10'); // the counter runs past its limit at the end
  assert.equal(exerciseLabel(table, 3, true), '10/10');
  assert.equal(exerciseLabel(table, null, false), null);
  assert.equal(exerciseLabel(null, 3, false), null);
});

test('loading: a table is parsed, a missing one gives null, a broken fetch gives null', async () => {
  const ok = await loadPhases('trainer', './', async () => ({ ok: true, json: async () => table }));
  assert.equal(ok.exercises, 10);
  assert.equal(await loadPhases('hello', './', async () => ({ ok: false })), null);
  assert.equal(
    await loadPhases('x', './', async () => {
      throw new Error('offline');
    }),
    null,
  );
});
