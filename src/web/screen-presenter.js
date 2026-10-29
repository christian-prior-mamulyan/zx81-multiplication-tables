// Draws the emulated ZX81 screen ourselves from its logical contents (the display file), instead
// of showing the emulator's TV-raster picture. Two things follow:
//
//  * No skew. The raster picture re-synchronises while the ZX81 is busy, which shows up as rows
//    of quarter blocks shifted sideways. The logical screen has no such state.
//  * A hard cut. While the program clears the screen the ROM wipes it over several frames; the
//    hold rule below keeps the last picture and cuts straight to the cleared screen.
//
// The glyphs are the 8x8 bitmaps of the original ZX81 ROM (charset at 0x1E00; inverse
// characters are the same bitmap with all bits flipped), not Unicode approximations.

import { SCREEN_COLUMNS, SCREEN_ROWS, zx81CodeToText } from '../emulator/zx81-text.js';

export const HOLD_FRAMES = 3; // a partly cleared screen that stays unchanged this long is shown
const CHARSET_ROM_ADDRESS = 0x1e00;

const blankScreen = () => Array.from({ length: SCREEN_ROWS }, () => Array(SCREEN_COLUMNS).fill(0));

export function isBlank(screen) {
  return screen.every((row) => row.every((code) => code === 0));
}

export function sameScreen(a, b) {
  return a.every((row, r) => row.every((code, c) => code === b[r][c]));
}

// True when `next` only lost cells compared with `prev`: every cell it still has equals the same
// cell of `prev`, and at least one cell is gone. This is what a clear-screen wipe looks like.
export function isRemoval(prev, next) {
  let removed = false;
  for (let r = 0; r < SCREEN_ROWS; r++) {
    for (let c = 0; c < SCREEN_COLUMNS; c++) {
      const now = next[r][c];
      if (now !== 0 && now !== prev[r][c]) return false;
      if (now === 0 && prev[r][c] !== 0) removed = true;
    }
  }
  return removed;
}

export function createPresenterState() {
  return { shown: blankScreen(), held: null, heldFrames: 0 };
}

// Decide what to show for one emulated frame. Returns the screen to draw, or null to keep what
// is on display. Rules:
//   - unchanged: nothing to do;
//   - cells added or changed: show it at once (drawing and typing stay immediate);
//   - cells only removed (a wipe): keep the old picture, and show the new one only when it is
//     completely cleared (the hard cut) or has stopped changing for HOLD_FRAMES frames.
export function planFrame(state, frame) {
  const show = () => {
    state.shown = frame;
    state.held = null;
    state.heldFrames = 0;
    return frame;
  };
  if (sameScreen(frame, state.shown)) {
    state.held = null;
    state.heldFrames = 0;
    return null;
  }
  if (!isRemoval(state.shown, frame)) return show();
  if (isBlank(frame)) return show();
  if (state.held && sameScreen(state.held, frame)) state.heldFrames += 1;
  else {
    state.held = frame;
    state.heldFrames = 1;
  }
  return state.heldFrames >= HOLD_FRAMES ? show() : null;
}

export class ScreenPresenter {
  // rom: Uint8Array of the ZX81 ROM. keepLog: remember every shown screen as text (tests, debug).
  constructor({ canvas, rom, scale = 2, origin = { x: 64, y: 48 }, background = '#f3f3f3', keepLog = false }) {
    this.canvas = canvas;
    this.rom = rom;
    this.scale = scale;
    this.origin = origin;
    this.background = background;
    this.state = createPresenterState();
    this.log = keepLog ? [] : null;
    this._draw(this.state.shown);
  }

  // Feed the logical screen of the current emulated frame. Returns true if the picture changed.
  update(screen) {
    const next = planFrame(this.state, screen);
    if (!next) return false;
    this._draw(next);
    this.log?.push(next.map((row) => row.map(zx81CodeToText).join('').trimEnd()));
    return true;
  }

  _draw(screen) {
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#000';
    const s = this.scale;
    for (let r = 0; r < SCREEN_ROWS; r++) {
      for (let c = 0; c < SCREEN_COLUMNS; c++) {
        const code = screen[r][c];
        if (code === 0) continue;
        const base = CHARSET_ROM_ADDRESS + (code & 63) * 8;
        for (let y = 0; y < 8; y++) {
          const bits = code & 128 ? ~this.rom[base + y] & 0xff : this.rom[base + y];
          if (bits === 0) continue;
          for (let x = 0; x < 8; x++) {
            if (bits & (0x80 >> x)) ctx.fillRect(this.origin.x + (c * 8 + x) * s, this.origin.y + (r * 8 + y) * s, s, s);
          }
        }
      }
    }
  }
}
