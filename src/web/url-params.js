// URL parameters of the trainer page. All asset URLs are relative so the site also works
// under a GitHub Pages project path (https://USER.github.io/REPOSITORY/).

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
    scenario: params.get('scenario') || 'normal',
    // emulator-native speed index 0-8 (4 = real time); only used when given
    speed: Number.isInteger(speed) && speed >= 0 && speed <= 8 ? speed : null,
  };
}

// Relative URL of a program tape, as the page sees it.
export function tapeUrl(id, base = './') {
  return `${base}tapes/${id}.p.hex`;
}
