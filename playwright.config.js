import { defineConfig } from '@playwright/test';

// ZX81_PY overrides how Python is started (CI uses python3, locally uv is used).
const python = process.env.ZX81_PY ?? 'uv run --no-project python';
// tests use their own port so a running `just dev` (8765) is never in the way
const port = Number(process.env.ZX81_TEST_PORT ?? 8766);

export default defineConfig({
  testDir: 'test/browser',
  timeout: 240_000, // the trainer runs 10 exercises in the emulator; slow CI runners need the headroom
  // one baseline for every operating system; a substituted glyph changes far more than 0.2% of the pixels
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 900, height: 900 } },
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: `${python} tools/serve.py --dir public --port ${port} --also-under zx81-trainer`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
