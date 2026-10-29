import { KEY_CODES, createEmulator } from '../emulator/emulator-adapter.js';
import { KeyQueue } from './key-queue.js';
import { mountKeypad } from './keypad.js';
import { lineNumber, programLines, sourceUrl } from './listing.js';
import { NAV_DESIGNS, NAV_VARIANTS, bindNav, buildNav } from './nav.js';
import { ScreenPresenter } from './screen-presenter.js';
import { parseParams } from './url-params.js';

let currentLine = null;
let navBars = []; // the navigation bars on the page (all five alternatives by default)

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
    const lines = programLines(await response.text());
    for (const bar of navBars) bar.update?.({ programLines: lines.length });
    for (const text of lines) {
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
function forwardKeys(keys) {
  const own = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/;
  const relay = (type) => (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || own.test(event.target?.tagName ?? '')) return;
    if (event.key.length !== 1 && !(event.key in KEY_CODES)) return;
    event.preventDefault(); // space and the arrow keys must not scroll the page
    if (event.repeat) return; // the ZX81 has no key repeat in hardware
    if (type === 'down') keys.down(event.key);
    else keys.up(event.key);
  };
  document.addEventListener('keydown', relay('down'));
  document.addEventListener('keyup', relay('up'));
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
  // the single page holds the alternative navigation bars, each in its own div with a caption
  const variants = params.nav === 'all' ? NAV_VARIANTS : params.nav === 'none' ? [] : [params.nav];
  for (const variant of variants) {
    const bar = buildNav(variant);
    navBars.push(bar);
    const holder = document.createElement('div');
    holder.className = 'nav-alt';
    holder.dataset.alt = String(variant);
    if (variants.length > 1) {
      const caption = document.createElement('p');
      caption.className = 'nav-caption';
      caption.textContent = `Alternative ${variant}: ${NAV_DESIGNS[variant].name}`;
      holder.append(caption);
    }
    holder.append(bar);
    document.getElementById('zx81-nav').append(holder);
  }
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

  // the navigation bar (when one is chosen) shows the emulator's live state where its design has room for it
  for (const bar of navBars) bindNav(bar, emulator);

  emulator.on('error', (error) => {
    status.textContent = `Error: ${error.message}`;
  });
  emulator.on('program-loaded', () => {
    status.textContent = '';
  });
  // the line being executed, from the emulator's own state
  emulator.on('line', ({ line }) => highlight(line));

  // real keys and the number pad share one queue, so the ZX81 sees one key at a time, long enough
  const keys = new KeyQueue({ send: (type, key) => (type === 'down' ? emulator.keyDown(key) : emulator.keyUp(key)) });
  mountKeypad(document.getElementById('zx81-keypad'), {
    press: (key) => keys.down(key),
    release: (key) => keys.up(key),
    show: params.keypad,
  });

  let presenter = null;
  if (params.emulator === 'real' && params.renderer === 'screen') {
    presenter = await startPresenter(emulator, params);
    forwardKeys(keys);
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
