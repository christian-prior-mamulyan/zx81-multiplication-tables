// URL parameters of the trainer page. All asset URLs are relative so the site also works
// under a GitHub Pages project path (https://USER.github.io/REPOSITORY/).

import { NAV_VARIANTS } from './nav.js';

const PROGRAM_ID = /^[a-z0-9-]+$/;
export const DEFAULT_PROGRAM = 'trainer';

export function parseParams(search) {
  const params = new URLSearchParams(search);
  const program = params.get('program');
  const speed = Number.parseInt(params.get('speed') ?? '', 10);
  return {
    program: program && PROGRAM_ID.test(program) ? program : DEFAULT_PROGRAM,
    debug: params.get('debug') === '1',
    emulator: params.get('emulator') === 'mock' ? 'mock' : 'real',
    // "screen" (default): the page draws the ZX81 screen itself from its contents, with a hard cut
    // on clear; "emulator": show the emulator's own TV-raster picture unchanged
    renderer: params.get('renderer') === 'emulator' ? 'emulator' : 'screen',
    // show the on-screen number pad even without a touch screen (it appears on touch screens anyway)
    keypad: params.get('keypad') === '1',
    // Navigation bars: the page holds all five alternatives ("all", the default) so they can be
    // compared in place; ?nav=1..5 shows one of them, ?nav=none shows none.
    nav: params.get('nav') === 'none' ? 'none' : NAV_VARIANTS.includes(Number(params.get('nav'))) ? Number(params.get('nav')) : 'all',
    scenario: params.get('scenario') || 'normal',
    // emulator-native speed index 0-8 (4 = real time); only used when given
    speed: Number.isInteger(speed) && speed >= 0 && speed <= 8 ? speed : null,
  };
}

// Relative URL of a program tape, as the page sees it.
export function tapeUrl(id, base = './') {
  return `${base}tapes/${id}.p.hex`;
}
