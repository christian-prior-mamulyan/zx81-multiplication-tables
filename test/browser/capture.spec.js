// just capture must be repeatable: two runs produce byte-identical artifacts.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './fixtures.js';
import { captureWith } from '../../tools/capture-screen.js';
import { expectedExercises, expectedLayout } from './trainer-helpers.js';

test('capture is deterministic and shows the known first exercise', async ({ context, baseURL }) => {
  const dirs = [];
  const results = [];
  for (let run = 0; run < 2; run++) {
    const dir = mkdtempSync(join(tmpdir(), 'zx81-capture-'));
    dirs.push(dir);
    const page = await context.newPage();
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
    // the screen part of debug.txt (without the "#" comment lines) shows the drawing and the answer,
    // and no multiplication printed as numbers
    const screen = text
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join('\n');
    expect(screen).not.toMatch(/\d+\s*[Xx*]\s*\d+/);
    const layout = expectedLayout(a, b);
    expect(screen.split('\n').slice(0, layout.length)).toEqual(layout);
    expect(screen).toContain(String(a * b));
    expect(readFileSync(join(dirs[0], 'screen.png')).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(readFileSync(join(dirs[0], 'display-file.bin')).length).toBeGreaterThan(24);
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});
