import { KEY_CODES, createEmulator } from '../emulator/emulator-adapter.js';
import { lineNumber, programLines, sourceUrl } from './listing.js';
import { buildNav } from './nav.js';
import { ScreenPresenter } from './screen-presenter.js';
import { parseParams } from './url-params.js';

let currentLine = null;

// Mark the listing line the emulated ZX81 is executing right now.
function highlight(line) {
  currentLine = line;
  for (const element of document.querySelectorAll('#zx81-listing .line')) {
    element.classList.toggle('current', line !== null && Number(element.dataset.line) === line);
  }
}

// Show the BASIC source under the emulator. A program without source (e.g. a test variant) just
// leaves the section hidden.
async function showListing(program) {
  try {
    const response = await fetch(sourceUrl(program));
    if (!response.ok) return;
    const listing = document.getElementById('zx81-listing');
    listing.replaceChildren();
    for (const text of programLines(await response.text())) {
      const element = document.createElement('span');
      element.className = 'line';
      const number = lineNumber(text);
      if (number !== null) element.dataset.line = String(number);
      element.textContent = text;
      listing.append(element);
    }
    document.getElementById('zx81-program').hidden = false;
    highlight(currentLine);
  } catch {
    // no listing is not an error for the player
  }
}

// The player's real keyboard goes to the emulated ZX81, wherever the focus is on the page
// (except in form fields and on buttons, which keep their own keys).
function forwardKeys(emulator) {
  const own = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/;
  const relay = (type) => (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || own.test(event.target?.tagName ?? '')) return;
    if (event.key.length !== 1 && !(event.key in KEY_CODES)) return;
    event.preventDefault(); // space and the arrow keys must not scroll the page
    if (type === 'down') pressKey(emulator, event.key);
    else releaseKey(emulator, event.key);
  };
  document.addEventListener('keydown', relay('down'));
  document.addEventListener('keyup', relay('up'));
}

// The ZX81 scans its keyboard once per frame (20 ms). A key that goes down and up faster than
// that (a quick tap, a touch screen, a test) would never be seen, so every key is held for at
// least MIN_KEY_HOLD_MS before it is released.
const MIN_KEY_HOLD_MS = 60;
const pressed = new Map(); // key -> { at: time of the press, release: pending timer }

export function pressKey(emulator, key) {
  const entry = pressed.get(key);
  if (entry?.release) clearTimeout(entry.release); // pressed again before the release happened
  pressed.set(key, { at: entry?.at ?? performance.now(), release: null });
  emulator.keyDown(key);
}

export function releaseKey(emulator, key) {
  const entry = pressed.get(key);
  const wait = Math.max(0, MIN_KEY_HOLD_MS - (performance.now() - (entry?.at ?? 0)));
  const release = setTimeout(() => {
    pressed.delete(key);
    emulator.keyUp(key);
  }, wait);
  pressed.set(key, { at: entry?.at ?? 0, release });
}

// Draw the emulated screen on our own canvas (see screen-presenter.js).
async function startPresenter(emulator, params) {
  const canvas = document.getElementById('zx81-display');
  const rom = new Uint8Array(await (await fetch('./emulator/roms/zx81.rom')).arrayBuffer());
  const presenter = new ScreenPresenter({ canvas, rom, keepLog: params.debug });
  document.getElementById('zx81-stage').classList.add('presented');
  emulator.on('frame', () => {
    const codes = emulator.getScreenCodes();
    if (codes) presenter.update(codes);
  });
  return presenter;
}

async function main() {
  const params = parseParams(window.location.search);
  if (params.nav !== null) document.getElementById('zx81-nav').append(buildNav(params.nav));
  const container = document.getElementById('zx81-screen');
  const status = document.getElementById('zx81-status');

  const emulator = await createEmulator({
    kind: params.emulator,
    scenario: params.scenario,
    container,
    base: './',
    speed: params.speed,
  });

  // debug builds only: handles for the browser console and the test suite
  if (params.debug) window.zx81 = emulator;

  emulator.on('error', (error) => {
    status.textContent = `Error: ${error.message}`;
  });
  emulator.on('program-loaded', () => {
    status.textContent = '';
  });
  // the line being executed, from the emulator's own state
  emulator.on('line', ({ line }) => highlight(line));

  let presenter = null;
  if (params.emulator === 'real' && params.renderer === 'screen') {
    presenter = await startPresenter(emulator, params);
    forwardKeys(emulator);
  } else if (params.emulator === 'real') {
    emulator.on('program-loaded', () => emulator.focus()); // keys go to the emulator's own frame
  }

  if (params.debug) {
    window.zx81Presenter = presenter;
    const { mountDebugPanel } = await import('./debug-panel.js');
    mountDebugPanel(document.getElementById('zx81-debug'), emulator);
  }

  // Reload button, outside the simulation: power the emulated ZX81 on again and start over
  const reload = document.getElementById('zx81-reload');
  reload.addEventListener('click', async () => {
    reload.blur(); // otherwise the next Enter key would press the button again
    highlight(null);
    try {
      await emulator.reset();
    } catch {
      // already reported through the error event
    }
  });

  showListing(params.program);
  try {
    await emulator.loadProgram(params.program);
  } catch {
    // already reported through the error event
  }
}

main();
