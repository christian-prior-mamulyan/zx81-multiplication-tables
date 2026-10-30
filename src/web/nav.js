// Five alternative HORIZONTAL navigation bars in Solarized orange. Each has its own content and
// its own styling (nav.css: .nav-1 ... .nav-5); all stay on one row and scroll sideways on a phone.
// design/navbars.html shows all five; ?nav=N on the game page tries one on the real page.
//
//   1  Brand and links    the site's mark on the left, the sections and GitHub on the right
//   2  Where am I         a breadcrumb trail from career.cprima.net to this page, source link at the end
//   3  Sections           in-page tabs with a count on each (steps to read, lines of BASIC)
//   4  Game status        a status bar: live emulator state, running BASIC line and emulated time
//   5  ZX81 menu          a numbered keyword menu in inverse video

export const NAV_VARIANTS = [1, 2, 3, 4, 5];

const HOME = 'https://career.cprima.net/';
const REPO = 'https://github.com/christian-prior-mamulyan/zx81-multiplication-tables';

export const NAV_DESIGNS = {
  1: { name: 'Brand and links', content: 'brand, Play, How to play, The program, GitHub' },
  2: { name: 'Where am I', content: 'breadcrumb: career.cprima.net / ZX81 multiplication tables, source link' },
  3: { name: 'Sections', content: 'tabs Play, How to play (steps), The program (lines)' },
  4: { name: 'Game status', content: 'ZX81 title, live state, BASIC line, emulated time, listing link' },
  5: { name: 'ZX81 menu', content: 'numbered keyword menu: 1 PLAY, 2 HOW TO PLAY, 3 LISTING, 4 SOURCE' },
};

function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) element.setAttribute(name, '');
    else if (value !== false && value !== null && value !== undefined) element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

// decorative Font Awesome Pro icon (Web Awesome <wa-icon>); the text label always stays beside it
const icon = (name, family) => el('wa-icon', { name, family, 'aria-hidden': 'true' });

const link = (href, label, { current = false, iconName, family } = {}) =>
  el('a', { href, 'aria-current': current ? 'page' : false }, ...(iconName ? [icon(iconName, family)] : []), label);

const item = (anchor) => el('li', {}, anchor);

const formatTime = (seconds) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
};

const designs = {
  // 1 - brand on the left, links on the right
  1() {
    const nav = el(
      'nav',
      { 'aria-label': 'Site' },
      el('a', { class: 'brand', href: HOME }, el('span', { class: 'mark', 'aria-hidden': 'true' }), 'cprima'),
      el(
        'ul',
        {},
        item(link('#zx81-stage', 'Play', { current: true, iconName: 'play' })),
        item(link('#howto', 'How to play', { iconName: 'circle-question' })),
        item(link('#zx81-program', 'The program', { iconName: 'code' })),
        item(link(REPO, 'GitHub', { iconName: 'github', family: 'brands' })),
      ),
    );
    return nav;
  },

  // 2 - breadcrumb trail with the source link at the end
  2() {
    return el(
      'nav',
      { 'aria-label': 'Breadcrumb' },
      el('ol', {}, el('li', {}, link(HOME, 'career.cprima.net')), el('li', { 'aria-current': 'page' }, 'ZX81 multiplication tables')),
      el('a', { class: 'aside', href: REPO }, 'Source on GitHub'),
    );
  },

  // 3 - in-page tabs, each with a count that comes from the page
  3() {
    const howto = document.querySelectorAll('#howto li').length;
    const nav = el(
      'nav',
      { 'aria-label': 'Page sections' },
      el(
        'ul',
        {},
        item(link('#zx81-stage', 'Play', { current: true })),
        item(el('a', { href: '#howto' }, 'How to play ', el('span', { class: 'badge', 'data-badge': 'steps' }, howto ? `${howto} steps` : '5 steps'))),
        item(el('a', { href: '#zx81-program' }, 'The program ', el('span', { class: 'badge', 'data-badge': 'lines' }, '–'))),
      ),
    );
    nav.update = ({ programLines } = {}) => {
      if (programLines !== undefined) nav.querySelector('[data-badge="lines"]').textContent = `${programLines} lines`;
    };
    return nav;
  },

  // 4 - status bar with live values
  4() {
    const cell = (name) => el('div', {}, el('dt', {}, name), el('dd', { 'data-status': name }, '–'));
    const nav = el(
      'nav',
      { 'aria-label': 'Game status' },
      el('span', { class: 'title' }, 'ZX81'),
      el('dl', {}, cell('state'), cell('line'), cell('time')),
      el('a', { class: 'action', href: '#zx81-program' }, 'LISTING'),
    );
    const set = (name, text) => (nav.querySelector(`[data-status="${name}"]`).textContent = text);
    nav.update = ({ emulatorState, line, seconds } = {}) => {
      if (emulatorState !== undefined) set('state', String(emulatorState).toUpperCase());
      if (line !== undefined) set('line', line === null ? '–' : String(line));
      if (seconds !== undefined) set('time', formatTime(seconds));
    };
    return nav;
  },

  // 5 - numbered keyword menu in inverse video, like the ZX81's own keywords
  5() {
    const entry = (number, label, href, current) =>
      item(el('a', { href, 'aria-current': current ? 'page' : false }, el('span', { class: 'key', 'aria-hidden': 'true' }, String(number)), label));
    return el(
      'nav',
      { 'aria-label': 'Menu' },
      el('ul', {}, entry(1, 'PLAY', '#zx81-stage', true), entry(2, 'HOW TO PLAY', '#howto'), entry(3, 'LISTING', '#zx81-program'), entry(4, 'SOURCE', REPO)),
    );
  },
};

// <nav class="site-nav nav-N" ...>. Designs 3 and 4 have update() for live values.
export function buildNav(variant) {
  const nav = designs[variant]();
  nav.classList.add('site-nav', `nav-${variant}`);
  return nav;
}

// Feed a nav bar with the emulator's live state (design 4 shows it; the others ignore it).
export function bindNav(nav, emulator) {
  if (!nav.update) return;
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
