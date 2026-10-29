import { createEmulator } from '../emulator/emulator-adapter.js';
import { parseParams } from './url-params.js';

async function main() {
  const params = parseParams(window.location.search);
  const container = document.getElementById('zx81-screen');
  const status = document.getElementById('zx81-status');

  const emulator = await createEmulator({
    kind: params.emulator,
    scenario: params.scenario,
    container,
    base: './',
    speed: params.speed,
  });

  emulator.on('error', (error) => {
    status.textContent = `Error: ${error.message}`;
  });

  if (params.debug) {
    // debug builds only: handle for the browser console and the test suite
    window.zx81 = emulator;
    const { mountDebugPanel } = await import('./debug-panel.js');
    mountDebugPanel(document.getElementById('zx81-debug'), emulator);
  }

  try {
    await emulator.loadProgram(params.program);
  } catch {
    // already reported through the error event
  }
}

main();
