// The BASIC source shown under the emulator: only what the ZX81 runs, without the "#" source
// comments and blank lines that zxtext2p drops anyway.
export function programLines(source) {
  return source.split(/\r?\n/).filter((line) => line.trim() !== '' && !line.startsWith('#'));
}

// Leading BASIC line number of a listing line, or null (labels-mode sources have none).
export function lineNumber(text) {
  const match = /^\s*(\d+)\s/.exec(text);
  return match ? Number(match[1]) : null;
}

// Relative URL of the program source, as the page sees it.
export function sourceUrl(id, base = './') {
  return `${base}basic/${id}.bas`;
}
