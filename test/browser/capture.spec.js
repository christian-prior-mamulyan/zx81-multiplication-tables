// just capture must be repeatable: two runs produce byte-identical artifacts.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { captureWith } from '../../tools/capture-screen.js';
import { expectedBlockRow, expectedExercises } from './trainer-helpers.js';

test('capture is deterministic and shows the known first exercise', async ({ browser, baseURL }) => {
  const dirs = [];
  const results = [];
  for (let run = 0; run < 2; run++) {
    const dir = mkdtempSync(join(tmpdir(), 'zx81-capture-'));
    dirs.push(dir);
    const page = await browser.newPage();
    results.push(await captureWith(page, baseURL, dir));
    await page.close();
  }
  try {
    for (const file of ['screen.png', 'debug.txt', 'display-file.bin']) {
      const [a, b] = dirs.map((dir) => readFileSync(join(dir, file)));
      expect(a.equals(b), `${file} identical across runs`).toBe(true);
    }
    expect(results[0].frozenAt).toBe(results[1].frozenAt);

    const [{ a, b }] = expectedExercises(1, 1);
    const text = readFileSync(join(dirs[0], 'debug.txt'), 'utf8');
    expect(text).toContain(`${a} X ${b}`);
    expect(text).toContain(expectedBlockRow(b));
    expect(text).toContain(String(a * b));
    expect(readFileSync(join(dirs[0], 'screen.png')).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(readFileSync(join(dirs[0], 'display-file.bin')).length).toBeGreaterThan(24);
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});
