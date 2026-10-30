// Static checks of the game page: mobile viewport, kit loading, identity.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Prettier lays HTML out over several lines and writes `<meta ... />`; compare the markup, not its layout.
const normalize = (source) =>
  source
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\s*\/>/g, '>')
    .replaceAll(/>\s+</g, '><');
const html = normalize(readFileSync('src/web/index.html', 'utf8'));
const css = readFileSync('src/web/app.css', 'utf8');

test('the viewport is set for phones, including the notch', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(html, /<meta name="theme-color" content="#cb4b16">/);
});

test('the Font Awesome Pro kit code is on the html element (domain-locked, safe in public HTML)', () => {
  assert.match(html, /<html lang="en" data-fa-kit-code="5df958b77d">/);
});

test('Web Awesome loads from the kit: theme, utilities, native reset, then the loader', () => {
  const sheets = [
    ...html.matchAll(/<link rel="stylesheet" href="(https:\/\/ka-p\.webawesome\.com\/kit\/[^"]+)"([^>]*)>/g),
  ];
  assert.deepEqual(
    sheets.map((m) => m[1].split('/styles/')[1]),
    ['themes/default.css', 'utilities.css', 'native.css'],
  );
  for (const [, , rest] of sheets) {
    // non-blocking: a slow or unreachable kit must not keep the page blank
    assert.match(rest, /media="print" onload="this\.media\s*=\s*'all'"/);
  }
  // async: a hanging kit server must not hold back the game's own module script
  assert.match(
    html,
    /<script type="module" async src="https:\/\/ka-p\.webawesome\.com\/kit\/[^"]+\/webawesome\.loader\.js"\s*><\/script>/,
  );
});

test('the identity stylesheet comes after the kit so it wins over the kit defaults', () => {
  assert.ok(html.indexOf('webawesome.loader.js') < html.indexOf('./web/app.css'));
});

test('the kit hosts are the only absolute URLs besides the site and repository links', () => {
  const external = new Set([...html.matchAll(/https?:\/\/([^/"'\s]+)/g)].map((m) => m[1]));
  assert.deepEqual([...external].sort(), ['ka-p.webawesome.com']);
});

test('the identity is Solarized Light with an orange bar across the top', () => {
  assert.match(css, /--orange: #cb4b16;/);
  assert.match(css, /--base3: #fdf6e3;/);
  assert.match(css, /body::before \{[^}]*position: fixed;[^}]*background: var\(--orange\)/s);
  assert.match(css, /color-scheme: light;/);
  assert.ok(!css.includes('prefers-color-scheme'), 'light only');
});

test('mobile: safe areas, touch targets and no iOS input zoom are handled in the stylesheet', () => {
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /touch-action: manipulation/);
  assert.match(css, /min-height: 2\.75rem/); // 44px
  assert.match(css, /#zx81-debug input \{[^}]*font-size: 16px/s);
});
