// What the program is doing, in the player's words. The trainer's BASIC stays plain; a small table
// next to it (trainer.phases.json) says which BASIC lines belong to which phase, and the page reads
// the line number the emulator reports. The same table names the loop counter variable and how many
// exercises a round has, so the page can say "exercise 3 of 10".

// URL of the phase table of a program, as the page sees it. The fixed-seed test variant of the
// trainer shares the trainer's table.
export function phasesUrl(program, base = './') {
  return `${base}basic/${program.replace(/-seeded$/, '')}.phases.json`;
}

// The phase that line number `line` belongs to, or null.
export function phaseForLine(table, line) {
  if (!table || line === null || line === undefined) {
    return null;
  }
  return table.phases.find((phase) => line >= phase.from && line <= phase.to) ?? null;
}

// Fetch a phase table; null when the program has none (the page then shows only the machine state).
export async function loadPhases(program, base = './', fetchImpl = fetch) {
  try {
    const response = await fetchImpl(phasesUrl(program, base));
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// "3/10" from the loop counter, or null. When the program has ended the counter has run past its
// last value; the exercise shown is then the last one.
export function exerciseLabel(table, counter, finished) {
  if (!table?.exercises || counter === null || counter === undefined) {
    return null;
  }
  const exercise = finished ? table.exercises : Math.min(Math.max(Math.round(counter), 1), table.exercises);
  return `${exercise}/${table.exercises}`;
}
