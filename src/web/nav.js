// The page's navigation bar: a horizontal game status bar in Solarized orange (nav.css).
// It shows live values from the emulated ZX81: its state, the BASIC line being executed and the
// emulated time, plus a link to the program listing. On a phone it scrolls sideways instead of
// wrapping.

function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

const formatTime = (seconds) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
};

// <nav class="site-nav nav-status" aria-label="Game status">; update({emulatorState, line, seconds})
export function buildNav() {
  const cell = (name) => el('div', {}, el('dt', {}, name), el('dd', { 'data-status': name }, '–'));
  const nav = el(
    'nav',
    { class: 'site-nav nav-status', 'aria-label': 'Game status' },
    el('span', { class: 'title' }, 'ZX81'),
    el('dl', {}, cell('state'), cell('line'), cell('time')),
    el('a', { class: 'action', href: '#zx81-program' }, 'LISTING'),
  );
  const set = (name, text) => {
    nav.querySelector(`[data-status="${name}"]`).textContent = text;
  };
  /** @param {{ emulatorState?: string, line?: number | null, seconds?: number }} [state] */
  nav.update = ({ emulatorState, line, seconds } = {}) => {
    if (emulatorState !== undefined) set('state', String(emulatorState).toUpperCase());
    if (line !== undefined) set('line', line === null ? '–' : String(line));
    if (seconds !== undefined) set('time', formatTime(seconds));
  };
  return nav;
}

// Feed the bar with the emulator's live state.
export function bindNav(nav, emulator) {
  const push = () => nav.update({ emulatorState: emulator.state, line: emulator.line, seconds: emulator.frame / 50 });
  let last = 0;
  emulator.on('frame', ({ frame }) => {
    if (frame - last >= 10) {
      last = frame;
      push();
    }
  });
  for (const name of ['program-loaded', 'stopped', 'error', 'line']) emulator.on(name, push);
  push();
}
