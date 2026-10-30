// Play the first two exercises of the trainer (seeded variant) and photograph EVERY change: a picture
// of the whole page whenever the ZX81 screen or the BASIC line being executed changed. Nothing is
// left out and nothing is decided here; choosing the pictures is the job of the playbook
// (tools/gif-playbook.json, see docs/gif-video-brief.md) and tools/edit-gif.js.
//
//   artifacts/rushes/0001.png ...   the pictures
//   artifacts/rushes/manifest.json  one entry per picture: emulated frame, BASIC line, phase,
//                                   exercise, what changed ("screen", "line" or both) and the screen text
//
// How it works. The page runs at full speed. In the emulator's frame handler the emulated machine is
// paused when a picture is due, the page is photographed, and the machine runs on. So the pictures show
// exact emulated moments however slow the photographing is, and keys are pressed at exact emulated
// frames too, never at wall-clock moments.
//
//   node tools/capture-rushes.js [folder]     (needs: just build, npm install)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { parseExercise } from '../test/browser/trainer-helpers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const VIEWPORT = { width: 960, height: 900 }; // two columns, game on the left, listing on the right
const EXERCISES = 2; // seed 1: first a small one (2 x 3, easy to follow), then a big one (9 x 7, with the gaps)
const FIRST_FRAME = 30; // the first frames are the ZX81 starting up
const HOLD_AFTER_ANSWER = 100; // emulated frames the last answer stays in the rushes (2 seconds)
const LATEST_FIRST_FRAME = 30; // the handler must be installed this early or the frame numbers are not exact

// Emulated frame numbers at which keys are pressed: the pause "2" seconds, then Enter.
const KEY_SCRIPT = [
  ['down', '2', 40],
  ['up', '2', 43],
  ['down', 'Enter', 47],
  ['up', 'Enter', 50],
];

const pictureName = (index) => `${String(index + 1).padStart(4, '0')}.png`;

// Everything from the top of the page to the bottom of the two columns.
async function pictureArea(page) {
  const bottom = await page.evaluate(() => Math.ceil(document.querySelector('.layout').getBoundingClientRect().bottom));
  return { x: 0, y: 0, width: VIEWPORT.width, height: Math.min(bottom + 12, VIEWPORT.height) };
}

// Photograph every change. `shoot(meta)` is called by the page, with the machine paused, for every picture.
export async function filmWith(page, baseUrl, phases, shoot) {
  // the page's third-party kits (Web Awesome, Font Awesome) play no part, so the film is repeatable offline
  await page.route(/^https?:\/\/[^/]*(webawesome|fontawesome)\.com\//, (route) => route.abort());
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${baseUrl}/?debug=1&program=trainer-seeded&speed=8`);
  await page.waitForFunction(() => window.zx81?.state === 'running');
  await page.locator('#howto > summary').click(); // closed: the listing, with the executing line marked, is the interesting part
  await page.locator('#zx81-program').waitFor({ state: 'visible' });
  if (!(await page.locator('#zx81-program').evaluate((details) => details.open))) {
    await page.locator('#zx81-program > summary').click();
  }
  await page.exposeFunction('__zx81Shoot', shoot);

  // Install the frame handler first, then power the machine on again so the handler sees every frame.
  return page.evaluate(
    ({ script, phaseTable, exercises, firstFrame, hold, latestFirstFrame, parseSource }) =>
      new Promise((resolve, reject) => {
        const parse = new Function(`return ${parseSource}`)();
        const emulator = window.zx81;
        let armed = false;
        let first = null;
        let next = 0;
        let answers = 0; // answers shown so far
        let answerShown = false;
        let finishAt = null;
        let lastScreen = null;
        let lastLine = null;
        emulator.on('program-loaded', () => {
          armed = true;
        });
        const off = emulator.on('frame', ({ frame }) => {
          if (!armed) {
            return;
          }
          if (first === null) {
            first = frame;
            if (frame >= latestFirstFrame) {
              off();
              reject(new Error(`frame handler installed too late (first frame ${frame})`));
              return;
            }
          }
          while (next < script.length && frame >= script[next][2]) {
            const [direction, key] = script[next++];
            if (direction === 'down') {
              emulator.keyDown(key);
            } else {
              emulator.keyUp(key);
            }
          }
          const rows = emulator.getScreenRows();
          const shown = parse(rows);
          const answered = Boolean(shown && shown.answer !== null);
          if (answered && !answerShown) {
            answers += 1;
            if (answers >= exercises) {
              finishAt = frame + hold;
            }
          }
          answerShown = answered;

          const screen = rows.join('\n');
          const line = emulator.line ?? 0;
          const finished = finishAt !== null && frame >= finishAt;
          const changed = [screen !== lastScreen ? 'screen' : null, line !== lastLine ? 'line' : null].filter(Boolean);
          if (frame < firstFrame || (changed.length === 0 && !finished)) {
            return;
          }
          lastScreen = screen;
          lastLine = line;
          const phase = phaseTable.find((p) => line >= p.from && line <= p.to);
          const meta = {
            frame,
            line,
            phase: phase ? phase.id : null,
            exercise: answered ? answers : answers + 1, // the exercise being drawn, waited for or answered
            changed: changed.length ? changed : ['end'],
            rows,
          };
          // pause the machine without announcing a state change, photograph, run on
          const display = emulator._display();
          display.setPaused(true);
          window.__zx81Shoot(meta).then(() => {
            if (finished) {
              off();
              resolve(frame);
            } else {
              display.setPaused(false);
            }
          }, reject);
        });
        emulator.reset();
      }),
    {
      script: KEY_SCRIPT,
      phaseTable: phases.phases,
      exercises: EXERCISES,
      firstFrame: FIRST_FRAME,
      hold: HOLD_AFTER_ANSWER,
      latestFirstFrame: LATEST_FIRST_FRAME,
      parseSource: parseExercise.toString(),
    },
  );
}

async function main() {
  const outDir = resolve(process.argv[2] ?? join(ROOT, 'artifacts', 'rushes'));
  const phases = JSON.parse(readFileSync(join(ROOT, 'src', 'basic', 'trainer.phases.json'), 'utf8'));
  const port = Number(process.env.ZX81_TEST_PORT ?? 8766); // not the dev server's port (8765)
  const python = (process.env.ZX81_PY ?? 'uv run --no-project python').split(' ');
  rmSync(outDir, { recursive: true, force: true }); // the pictures of the previous run of this script
  mkdirSync(outDir, { recursive: true });
  const server = spawn(python[0], [...python.slice(1), 'tools/serve.py', '--dir', 'public', '--port', String(port)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const browser = await chromium.launch();
  try {
    await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
    const page = await browser.newPage();
    let clip = null;
    const manifest = [];
    const lastFrame = await filmWith(page, `http://localhost:${port}`, phases, async (meta) => {
      clip ??= await pictureArea(page);
      const index = manifest.length;
      manifest.push({ picture: pictureName(index), ...meta });
      await page.screenshot({ path: join(outDir, pictureName(index)), clip });
    });
    writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `wrote ${manifest.length} pictures and manifest.json to ${outDir} (last at emulated frame ${lastFrame})`,
    );
  } finally {
    await browser.close();
    // `uv run` starts Python as a child; on Windows kill() would leave that child serving the port
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      server.kill();
    }
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
