import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineNumber, programLines, sourceUrl } from '../../src/web/listing.js';

const source = [
  '# a comment that zxtext2p drops',
  '',
  '10 PRINT "PAUSE SECONDS 1-99"',
  '150 PAUSE P*50',
  '# another comment',
  '',
].join('\n');

test('only the lines the ZX81 runs are listed', () => {
  assert.deepEqual(programLines(source), ['10 PRINT "PAUSE SECONDS 1-99"', '150 PAUSE P*50']);
});

test('windows line endings are handled', () => {
  assert.deepEqual(programLines('10 PRINT 1\r\n20 PRINT 2\r\n'), ['10 PRINT 1', '20 PRINT 2']);
});

test('the BASIC line number is read from the start of a listing line', () => {
  assert.equal(lineNumber('150 PAUSE P*50'), 150);
  assert.equal(lineNumber('  10 PRINT 1'), 10);
  assert.equal(lineNumber('PRINT "NO NUMBER"'), null); // labels-mode source
  assert.equal(lineNumber('0 REM'), 0); // line 0 is a real line number
});

test('the source URL is relative', () => {
  assert.equal(sourceUrl('trainer'), './basic/trainer.bas');
  assert.ok(!sourceUrl('trainer').startsWith('/'));
});
