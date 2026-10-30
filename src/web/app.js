import { KEY_CODES, createEmulator } from '../emulator/emulator-adapter.js';
import { KeyQueue } from './key-queue.js';
import { mountKeypad } from './keypad.js';
import { lineNumber, programLines, sourceUrl } from './listing.js';
import { bindNav, buildNav } from './nav.js';
import { loadPhases } from './phases.js';
import { ScreenPresenter, isReport } from './screen-presenter.js';
import { parseParams } from './url-params.js';

let currentLine = null;

// Mark the listing line the emulated ZX81 is executing right now.
function highlight(line) {
  currentLine = line;
  for (const element of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#zx81-listing .line'))) {
    element.classList.toggle('current', line !== null && Number(element.dataset.line) === line);
  }
}

// Show the BASIC source under the emulator. A program without source (e.g. a test variant) just
// leaves the section hidden.
async function showListing(program) {
  try {
    const response = await fetch(sourceUrl(program));
    if (!response.ok) {
      return;
    }
    const listing = document.getElementById('zx81-listing');
    listing.replaceChildren();
    const lines = programLines(await response.text());
    for (const text of lines) {
      const element = document.createElement('span');
      element.className = 'line';
      const number = lineNumber(text);
      if (number !== null) {
        element.dataset.line = String(number);
      }
      element.textContent = text;
      listing.append(element);
    }
    document.getElementById('zx81-program-title').textContent = `The program (${lines.length} lines)`;
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
    if (event.ctrlKey || event.metaKey || event.altKey || own.test(event.target?.tagName ?? '')) {
      return;
    }
    if (event.key.length !== 1 && !(event.key in KEY_CODES)) {
      return;
    }
    event.preventDefault(); // space and the arrow keys must not scroll the page
    if (event.repeat) {
      return;
    } // the ZX81 has no key repeat in hardware
    if (type === 'down') {
      keys.down(event.key);
    } else {
      keys.up(event.key);
    }
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
  // The trainer ends by clearing the screen and stopping; the ZX81 then prints its own report
  // ("0/200"). The presenter hides that report and the page shows its end overlay instead.
  const endOverlay = params.program.startsWith('trainer') ? document.getElementById('zx81-end') : null;
  emulator.on('frame', () => {
    const codes = emulator.getScreenCodes();
    if (codes) {
      presenter.update(codes);
      if (endOverlay) {
        endOverlay.hidden = !isReport(codes);
      }
    }
  });
  return presenter;
}

// A <details> block that remembers whether the player closed it (first visit: as in the markup).
function rememberOpen(details, key) {
  try {
    if (localStorage.getItem(key) === 'closed') {
      details.open = false;
    }
    details.addEventListener('toggle', () => localStorage.setItem(key, details.open ? 'open' : 'closed'));
  } catch {
    // storage can be blocked (private windows); the block then simply keeps its default
  }
}

async function main() {
  const params = parseParams(window.location.search);
  // only the trainer has a phase table; it loads while the emulator starts
  const phasesPending = params.program.startsWith('trainer') ? loadPhases(params.program) : Promise.resolve(null);
  rememberOpen(document.getElementById('howto'), 'zx81.howto');

  // New game: power the emulated ZX81 on again and start over (the button is outside the simulation)
  let emulator = null;
  const newGame = async () => {
    /** @type {HTMLElement | null} */ (document.activeElement)?.blur?.(); // the next Enter key must not press a button
    highlight(null);
    try {
      await emulator.reset();
    } catch {
      // already reported through the error event
    }
  };
  const navBar = buildNav({ onNewGame: newGame });
  document.getElementById('zx81-nav').append(navBar);
  document.getElementById('zx81-newgame-end').addEventListener('click', newGame);
  const container = document.getElementById('zx81-screen');
  const status = document.getElementById('zx81-status');

  emulator = await createEmulator({
    kind: params.emulator,
    scenario: params.scenario,
    container,
    base: './',
    speed: params.speed,
  });

  // debug builds only: handles for the browser console and the test suite
  if (params.debug) {
    window.zx81 = emulator;
  }

  // the navigation bar shows what the game is doing, from the emulator's own state
  const phases = await phasesPending;
  bindNav(navBar, emulator, { phases });

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

  showListing(params.program);
  try {
    await emulator.loadProgram(params.program);
  } catch {
    // already reported through the error event
  }
}

main();
