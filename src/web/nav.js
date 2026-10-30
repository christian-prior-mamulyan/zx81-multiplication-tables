// The page's navigation bar: a horizontal game status bar in Solarized orange (nav.css).
// It shows what the game is doing, live from the emulator: the phase (waiting for input, drawing,
// pause, answer, done), the BASIC line being executed and the exercise number, plus a link to the
// New game button. On a phone it scrolls sideways instead of wrapping.

import { exerciseLabel, phaseForLine } from './phases.js';

function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

const DASH = '–';

// <nav class="site-nav nav-status" aria-label="Game status">
// update({ phase, line, exercise }) sets the three values; onNewGame() is called by the button.
/** @param {{ onNewGame?: () => void }} [options] */
export function buildNav({ onNewGame } = {}) {
  const cell = (name) => el('dl', { class: 'cell' }, el('dt', {}, name), el('dd', { 'data-status': name }, DASH));
  const newGame = el('button', { class: 'action new-game', id: 'zx81-newgame', type: 'button' }, 'NEW GAME');
  newGame.addEventListener('click', () => onNewGame?.());
  const nav = el(
    'nav',
    { class: 'site-nav nav-status', 'aria-label': 'Game status' },
    el('span', { class: 'title' }, 'ZX81'),
    el('div', { class: 'cells' }, cell('phase'), cell('line'), cell('exercise')),
    newGame,
  );
  const set = (name, text) => {
    nav.querySelector(`[data-status="${name}"]`).textContent = text;
  };
  /** @param {{ phase?: string, line?: number | null, exercise?: string | null }} [state] */
  nav.update = ({ phase, line, exercise } = {}) => {
    if (phase !== undefined) {
      set('phase', phase);
    }
    if (line !== undefined) {
      set('line', line === null ? DASH : String(line));
    }
    if (exercise !== undefined) {
      set('exercise', exercise ?? DASH);
    }
  };
  return nav;
}

// Feed the bar with the emulator's live state. `phases` is the table from trainer.phases.json (or
// null: then the bar shows the machine state instead of a phase).
export function bindNav(nav, emulator, { phases = null } = {}) {
  const push = () => {
    const phase = phaseForLine(phases, emulator.line);
    const counter = phases?.counter ? emulator.getBasicNumber?.(phases.counter) : null;
    nav.update({
      phase: phase ? phase.label : String(emulator.state).toUpperCase(),
      line: emulator.line,
      exercise: exerciseLabel(phases, counter, phase?.id === 'finished'),
    });
  };
  let last = 0;
  emulator.on('frame', ({ frame }) => {
    if (frame - last >= 10) {
      last = frame;
      push();
    }
  });
  for (const name of ['program-loaded', 'stopped', 'error', 'line']) {
    emulator.on(name, push);
  }
  push();
}
