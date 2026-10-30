// Developer panel, mounted only with ?debug=1. Lives outside the emulated ZX81 screen.

import { FRAMES_PER_SECOND } from '../emulator/emulator-adapter.js';

const hex = (n, width) => n.toString(16).toUpperCase().padStart(width, '0');

export function mountDebugPanel(root, emulator) {
  root.hidden = false;
  root.innerHTML = `
    <h2>Debug</h2>
    <dl>
      <dt>state</dt><dd data-f="state"></dd>
      <dt>program</dt><dd data-f="program"></dd>
      <dt>frame</dt><dd data-f="frame"></dd>
      <dt>emulated time</dt><dd data-f="time"></dd>
      <dt>BASIC line</dt><dd data-f="line"></dd>
      <dt>last key</dt><dd data-f="key"></dd>
      <dt>PC</dt><dd data-f="pc"></dd>
    </dl>
    <p>
      <button data-a="run">Run</button>
      <button data-a="pause">Pause</button>
      <button data-a="step">Step frame</button>
      <button data-a="reset">Reset</button>
      <button data-a="capture">Capture PNG</button>
    </p>
    <p>memory <input data-f="addr" value="4000" size="5" aria-label="address (hex)">
       <input data-f="len" value="64" size="3" aria-label="length"></p>
    <pre data-f="mem"></pre>`;

  const field = (name) => root.querySelector(`[data-f="${name}"]`);

  function refresh() {
    field('state').textContent = emulator.state;
    field('program').textContent = emulator.program ?? '-';
    field('frame').textContent = emulator.frame;
    field('time').textContent = `${(emulator.frame / FRAMES_PER_SECOND).toFixed(2)} s`;
    field('line').textContent = emulator.line ?? '-';
    field('key').textContent = emulator.lastKey ?? '-';
    field('pc').textContent = emulator.pc === null ? 'n/a' : `0x${hex(emulator.pc, 4)}`;
    try {
      const address = Number.parseInt(field('addr').value, 16) || 0;
      const length = Math.min(Number.parseInt(field('len').value, 10) || 0, 256);
      const bytes = emulator.getMemory(address, length);
      const lines = [];
      for (let i = 0; i < bytes.length; i += 16) {
        lines.push(`${hex(address + i, 4)}  ${[...bytes.slice(i, i + 16)].map((b) => hex(b, 2)).join(' ')}`);
      }
      field('mem').textContent = lines.join('\n');
    } catch {
      field('mem').textContent = 'memory not available';
    }
  }

  const actions = {
    run: () => emulator.start(),
    pause: () => emulator.stop(),
    step: () => emulator.step(),
    reset: () => emulator.reset(),
    capture: async () => {
      const blob = await emulator.captureScreen();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'zx81-screen.png';
      link.click();
      URL.revokeObjectURL(link.href);
    },
  };
  root.addEventListener('click', async (event) => {
    const action = event.target.dataset?.a;
    if (action) {
      await actions[action]();
      refresh();
    }
  });

  let last = 0;
  emulator.on('frame', ({ frame }) => {
    if (frame - last >= 10) {
      last = frame;
      refresh();
    }
  });
  for (const name of ['program-loaded', 'stopped', 'error', 'line']) {
    emulator.on(name, refresh);
  }
  refresh();
}
