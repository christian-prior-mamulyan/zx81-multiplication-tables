# ZX81 multiplication tables

A circa-1982 ZX81 BASIC multiplication trainer, run in the browser as a **real ZX81 BASIC program
inside an emulated ZX81**. JavaScript only hosts, instruments and presents it; the BASIC program is
never reimplemented in JavaScript.

Ten multiplication exercises per run. Each is drawn as rows of ZX81 semigraphics blocks with a gap
after every fifth block, waits for a pupil-specific pause, then shows the answer.

**Status:** the trainer in `src/basic/trainer.bas` is a *provisional* reconstruction. Its on-screen
layout (a rows of b full blocks) is a candidate, not yet the remembered original. The drawing lives
in lines 80-140 and the glyph in line 100, so it can be changed in a few lines.

## Run it locally

```bash
npm install
just dev          # builds the site, serves http://localhost:8765/
```

The port can be changed with `ZX81_PORT=9000 just dev`. Do not open the pages through `file://`:
the emulator loads its ROM and program with HTTP requests.

Requirements: node, npm, [just](https://just.systems/), bash with `xxd`, [uv](https://docs.astral.sh/uv/) (runs the small
Python file server), and a C compiler for `zxtext2p` (native `gcc`, or `gcc` inside WSL on Windows).

## Pages and URL parameters

| URL | What |
|-----|------|
| `/` | launches the trainer |
| `/?program=NAME` | runs `tapes/NAME.p.hex` (hello, arithmetic, graphics, keyboard, delay, line0, trainer, trainer-seeded) |
| `/?debug=1` | developer panel (state, frame, emulated time, last key, PC, memory, pause/run/step, reset, PNG capture); `window.zx81` is the adapter |
| `/?emulator=mock&scenario=normal` | mock emulator, no Z80; scenarios `normal`, `slow`, `load-error`, `runtime-error`, `blank-screen`, `finished` |
| `/?speed=0..8` | emulator speed index (4 = real time, 8 = 10x); emulated frame counts do not change |
| `/debug/charset.html` | every ZX81 semigraphics character, drawn from the ROM bitmaps |

All URLs are relative, so the site also works below `https://USER.github.io/REPOSITORY/`.
`just dev` additionally serves it under `/zx81-trainer/` to prove that.

## How it fits together

```text
src/basic/*.bas  --zxtext2p-->  build/*.p  --xxd-->  public/tapes/*.p.hex
                                                        |
vendored ZX81 emulator (JtyOne, JavaScript) <-- adapter (src/emulator/emulator-adapter.js)
                                                        |
                                           src/web (page, debug panel) --> public/
```

- **No TZX step.** The emulator loads a `.P` file directly when the URL ends in `.p` and the server
  returns ASCII hex (`zx81.html?tzx=../tapes/trainer.p` fetches `../tapes/trainer.p.hex`).
- **Autorun.** `zxtext2p` leaves the "next line to run" pointer at the end of the program, so a
  loaded program would only be listed. `tools/build-program.sh` points it at the first line.
- **Adapter.** Application code uses only the `ZX81Emulator` interface; the real emulator and the
  mock implement it. Emulator internals stay behind it.
- **Emulator patches** are kept minimal and listed in `src/emulator/zx81/PATCHES.md`. The rule:
  patch the emulator only when a failing fixture or a required adapter feature proves it necessary.
- **Fixtures** (`src/basic`): `hello`, `arithmetic`, `graphics` (every semigraphics code),
  `keyboard`, `delay` (the trainer's busy-loop delay), `line0` (a BASIC line numbered 0, which
  cannot be typed on a ZX81 keyboard), `trainer`, and `trainer-seeded` (identical to the trainer
  except `RAND` becomes `RAND 1`, so the random exercises are reproducible).

## Tests

```bash
just test           # unit tests (node), no network, no browser
just test-browser   # Playwright: emulator integration, trainer behaviour, mock, Pages paths
just capture        # artifacts/screen.png, debug.txt, display-file.bin for a known exercise
```

- Emulator integration tests check the ROM boots, programs load and run, the screen changes,
  semigraphics are emitted with exact ZX81 codes and rendered as the original glyphs
  (pixel regression in `test/browser/__screenshots__`), and the keyboard works.
- Trainer tests check ten exercises, operands against an independently computed ZX81 `RND`
  sequence, correct answers, the gap after every fifth block, the pause scaling the delay, and
  completion. A failure here points at the BASIC program, not the emulator.
- Timing is measured in emulated frames (50 per emulated second), never wall-clock time.
- Text forms of the screen (`[Q128]` for semigraphics) exist only for tests and diagnostics; they
  are not the authentic display.

## Deployment

`.github/workflows/pages.yml` tests, runs `just build` and publishes `public/` with GitHub Pages
(`.nojekyll` is included). `test.yml` runs the tests and the capture on every push.

## Licences

- Own code (adapter, mock, web page, tests, BASIC programs, tools): Apache-2.0, see `LICENSE`.
- `src/emulator/zx81/` (and its copy in `public/emulator/`): the emulator
  [hammingweight/zx81-javascript-emulator](https://github.com/hammingweight/zx81-javascript-emulator),
  GPL-2.0, derived from JtyOne by Simon Holdsworth. Upstream licence kept in
  `src/emulator/zx81/LICENSE`; the patches are described in `PATCHES.md`.
- `tools/zxtext2p/`: ZXText2P by Chris Cowley (based on zmakebas by Russell Marks), GPL.
- ZX81 ROM image: Sinclair/Nine Tiles ROM as distributed with the emulator.

The deployed site contains the GPL-2.0 emulator next to Apache-2.0 code. Check that this mix is
what you want before publishing; see `NOTICE`.
