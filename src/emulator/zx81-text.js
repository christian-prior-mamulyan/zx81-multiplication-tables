// Pure helpers that turn ZX81 display-file bytes into a text form for tests and diagnostics.
// The text form is NOT the authentic display. It only names exact ZX81 character codes:
// semigraphics are written [Q<code>] (Q1..Q10, inverse Q128..Q138), inverse letters {X}.

export const D_FILE = 0x400c; // system variable: address of the display file
export const NEWLINE = 118; // end of a display-file line
export const SCREEN_ROWS = 24; // 22 upper rows + 2 lower rows
export const SCREEN_COLUMNS = 32;

const CHARS = ' ??????????"£$:?()><=+-*/;,.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function isGraphics(code) {
  return (code >= 1 && code <= 10) || (code >= 128 && code <= 138);
}

export function zx81CodeToText(code) {
  if (code === 0) return ' ';
  if (isGraphics(code)) return `[Q${code}]`;
  if (code < 64) return CHARS[code];
  if (code >= 128 && code < 192) return `{${CHARS[code - 128]}}`;
  return `<${code}>`;
}

// mem: Uint8Array-like of the whole address space (or a getter function (addr) => byte).
export function displayFileRows(read, dfile) {
  const rows = [];
  let addr = dfile + 1; // the display file starts with a NEWLINE (HALT) byte
  let row = '';
  for (let guard = 0; guard < 4000 && rows.length < SCREEN_ROWS && addr < 0x10000; guard++) {
    const code = read(addr++);
    if (code === NEWLINE) {
      rows.push(row.trimEnd()); // the display pads every row with blanks; they carry no information
      row = '';
    } else {
      row += zx81CodeToText(code);
    }
  }
  return rows;
}

// Raw character codes of the display: SCREEN_ROWS rows, each padded with blanks (code 0) to
// SCREEN_COLUMNS columns. This is the logical screen, not the emulated TV picture.
export function displayFileCodes(read, dfile) {
  const rows = [];
  let addr = dfile + 1;
  let row = [];
  for (let guard = 0; guard < 4000 && rows.length < SCREEN_ROWS && addr < 0x10000; guard++) {
    const code = read(addr++);
    if (code === NEWLINE) {
      while (row.length < SCREEN_COLUMNS) row.push(0);
      rows.push(row.slice(0, SCREEN_COLUMNS));
      row = [];
    } else {
      row.push(code);
    }
  }
  while (rows.length < SCREEN_ROWS) rows.push(Array(SCREEN_COLUMNS).fill(0));
  return rows;
}

export function dfileAddress(read) {
  return read(D_FILE) | (read(D_FILE + 1) << 8);
}
