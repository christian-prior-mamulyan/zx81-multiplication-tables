// GitHub Pages project sites live below /REPOSITORY/, so no page or script of ours may use a
// root-relative URL. (The vendored emulator is checked by the browser subdirectory test.)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const roots = ['src/web', 'src/emulator'];

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'zx81' ? [] : files(path);
    return /\.(js|html|css)$/.test(entry.name) ? [path] : [];
  });
}

test('no root-relative URLs in our own pages and scripts', () => {
  const offenders = [];
  for (const file of roots.flatMap(files)) {
    const text = readFileSync(file, 'utf8');
    const patterns = [
      /\b(?:src|href|action)\s*=\s*["']\/(?!\/)/g, // html attributes
      /\bfetch\(\s*["'`]\/(?!\/)/g, // fetch("/x")
      /\bimport\(?\s*["']\/(?!\/)/g, // import "/x"
      /url\(\s*["']?\/(?!\/)/g, // css url(/x)
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the emulator patch for relative loading is in place', () => {
  const source = readFileSync('src/emulator/zx81/zx81_emu.js', 'utf8');
  assert.ok(!source.includes('"/" + this.fileName'), 'ROM must be fetched relative to the page');
  assert.ok(source.includes('PATCH 1'));
});
