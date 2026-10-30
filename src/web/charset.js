// ZX81 semigraphics reference table, drawn from the bitmaps in the original ROM.

const CHARSET_ROM_ADDRESS = 0x1e00; // 64 characters x 8 bytes
const SCALE = 6;

// zxtext2p block-graphics escapes ("\" followed by these two characters), in code order:
// codes 0-10, then the inverse characters 128-138.
const ESCAPES = [
  ['  ', 0],
  ["' ", 1],
  [" '", 2],
  ["''", 3],
  ['. ', 4],
  [': ', 5],
  [".'", 6],
  [":'", 7],
  ['##', 8],
  [',,', 9],
  ['~~', 10],
  ['::', 128],
  ['.:', 129],
  [':.', 130],
  ['..', 131],
  ["':", 132],
  [' :', 133],
  ["'.", 134],
  [' .', 135],
  ['@@', 136],
  [';;', 137],
  ['!!', 138],
];

function drawGlyph(canvas, rom, code) {
  const inverse = code >= 128;
  const base = CHARSET_ROM_ADDRESS + (code & 63) * 8;
  canvas.width = 8 * SCALE;
  canvas.height = 8 * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  for (let y = 0; y < 8; y++) {
    const bits = inverse ? ~rom[base + y] & 0xff : rom[base + y];
    for (let x = 0; x < 8; x++) {
      if (bits & (0x80 >> x)) {
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }
}

async function main() {
  const response = await fetch('../emulator/roms/zx81.rom');
  const rom = new Uint8Array(await response.arrayBuffer());
  const body = /** @type {HTMLTableSectionElement} */ (document.querySelector('#charset tbody'));
  for (const [escape, code] of ESCAPES) {
    const row = body.insertRow();
    row.insertCell().textContent = `${code} (0x${code.toString(16).toUpperCase().padStart(2, '0')})`;
    const canvas = document.createElement('canvas');
    canvas.dataset.code = String(code);
    drawGlyph(canvas, rom, code);
    row.insertCell().append(canvas);
    row.insertCell().innerHTML = `<code>${code.toString(2).padStart(8, '0')}</code>`;
    const escapeCell = row.insertCell();
    escapeCell.innerHTML = '<code></code>';
    escapeCell.firstChild.textContent = `\\${escape}`;
    row.insertCell().innerHTML = `<code>CHR$ ${code}</code>`;
  }
}

main();
