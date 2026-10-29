// Run the trainer (seeded variant) to a known state and write repeatable artifacts:
//   artifacts/screen.png        the emulated ZX81 display only
//   artifacts/debug.txt         diagnostic text form of the screen (NOT the authentic display)
//   artifacts/display-file.bin  the ZX81 display file bytes, read through the adapter
//
// Known state: the first exercise of seed 1 (computed in test/browser/trainer-helpers.js) with its
// answer on screen, frozen 30 emulated frames after the answer first appeared. Emulated frames
// are deterministic, so the artifacts are identical on every run.
//
//   node tools/capture-screen.js            (needs: just build, npm install)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { expectedExercises } from '../test/browser/trainer-helpers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FREEZE_AFTER_ANSWER = 30;

// Emulated frame numbers (counted from power-on of the new machine) at which keys are pressed.
// The emulator starts the program within the first two frames, so the pause prompt is already
// waiting for input at frame 40: "1" is pressed at 40 and released at 43, Enter at 47 and 50.
const KEY_SCRIPT = [
  ['down', '1', 40],
  ['up', '1', 43],
  ['down', 'Enter', 47],
  ['up', 'Enter', 50],
];
const LATEST_FIRST_FRAME = 30; // the handler must be installed this early or the frame numbers are not exact

export async function captureWith(page, baseUrl, outDir) {
  await page.goto(`${baseUrl}/?debug=1&program=trainer-seeded&speed=4`);
  await page.waitForFunction(() => window.zx81?.state === 'running');

  // Everything runs inside the frame handler, so key presses and the freeze happen at exact
  // emulated frames, never at wall-clock moments. The handler is installed first and the machine
  // is then powered on again (reset), so it sees the program from its first frame.
  const frozenAt = await page.evaluate(
    ({ after, script, latestFirstFrame }) =>
      new Promise((resolve, reject) => {
        let armed = false;
        let first = null;
        let seen = null;
        let next = 0;
        window.zx81.on('program-loaded', () => {
          armed = true;
        });
        const off = window.zx81.on('frame', ({ frame }) => {
          if (!armed) return;
          if (first === null) {
            first = frame;
            if (frame >= latestFirstFrame) {
              off();
              reject(new Error(`frame handler installed too late (first frame ${frame}); frame numbers would not be exact`));
              return;
            }
          }
          const rows = window.zx81.getScreenRows();
          while (next < script.length && frame >= script[next][2]) {
            const [direction, key] = script[next++];
            if (direction === 'down') window.zx81.keyDown(key);
            else window.zx81.keyUp(key);
          }
          const header = /^(\d+) X (\d+)$/.exec(rows[0] ?? '');
          if (seen === null && header && /^\d+$/.test(rows[1 + Number(header[1])] ?? '')) seen = frame;
          if (seen !== null && frame >= seen + after) {
            off();
            window.zx81.stop();
            resolve(frame);
          }
        });
        window.zx81.reset();
      }),
    { after: FREEZE_AFTER_ANSWER, script: KEY_SCRIPT, latestFirstFrame: LATEST_FIRST_FRAME },
  );

  const { screenshot, text, dfile } = await page.evaluate(async () => {
    const blob = await window.zx81.captureScreen();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dAddr = window.zx81.getMemory(0x400c, 2);
    const address = dAddr[0] | (dAddr[1] << 8);
    return {
      screenshot: Array.from(bytes),
      text: window.zx81.getScreenText(),
      dfile: Array.from(window.zx81.getMemory(address, 24 * 33 + 1)),
    };
  });

  const [first] = expectedExercises(1, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'screen.png'), Buffer.from(screenshot));
  writeFileSync(
    join(outDir, 'debug.txt'),
    `# diagnostic text form, not the authentic display; [Qn] = ZX81 semigraphics code n\n# program trainer-seeded, pause 1, seed 1, frozen at emulated frame ${frozenAt}\n# expected first exercise: ${first.a} X ${first.b}\n${text}\n`,
  );
  writeFileSync(join(outDir, 'display-file.bin'), Buffer.from(dfile));
  return { outDir, frozenAt, first };
}

async function main() {
  const port = Number(process.env.ZX81_PORT ?? 8765);
  const python = (process.env.ZX81_PY ?? 'uv run --no-project python').split(' ');
  const server = spawn(python[0], [...python.slice(1), 'tools/serve.py', '--dir', 'public', '--port', String(port)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const browser = await chromium.launch();
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const page = await browser.newPage();
    const result = await captureWith(page, `http://localhost:${port}`, join(ROOT, 'artifacts'));
    console.log(`captured to ${result.outDir} (exercise ${result.first.a} X ${result.first.b}, frozen at frame ${result.frozenAt})`);
  } finally {
    await browser.close();
    // `uv run` starts Python as a child; on Windows kill() would leave that child serving the port
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else server.kill();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
