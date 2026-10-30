# Video brief and playbook: the README animation

## Brief

**Goal.** One animated GIF at the top of the README that makes a visitor understand in ten seconds
what this is: a real 1982-style ZX81 BASIC program, running in an emulated ZX81, that draws a
multiplication as blocks. Visitors do not read first, they look first.

**Audience.** Recruiters and developers who open the repository. They have never seen the page.

**What they must see**

1. It is a real BASIC program: the listing is on screen, and the line being executed is marked.
2. The ZX81 draws with loops: the blocks appear one at a time, across (the `J` loop) and down (the
   `I` loop), and the marked line moves through the loops while it happens.
3. It is a game: a pause is typed, the player waits, then the answer appears.
4. The grouping in fives (a gap after the fifth block, a blank row after the fifth row) in a big
   exercise.

**Constraints.** A GIF (GitHub shows GIFs in READMEs, not video files that need a player). 840 px
wide, loops forever, under 1 MB (now about 0.4 MB), about 15 seconds.

**Style.** The page itself, as it is: no extra captions, no cursor, no browser frame. Calm pacing:
typing and answers at about real time, waiting sped up, drawing in slow motion.

## Storyboard

| Beat | What happens                                              | Treatment                  |
| ---- | --------------------------------------------------------- | -------------------------- |
| 1    | The prompt "ENTER YOUR INDIVIDUAL PAUSE", a "2" is typed  | real time                  |
| 2    | Exercise 1 (2 x 3, small): blocks appear one by one       | slow motion, every change  |
| 3    | The wait (the player says the answer out loud)            | sped up twice, one picture |
| 4    | The answer 6, held for the second wait                    | sped up twice              |
| 5    | Exercise 2 (9 x 7, big): the screen is cleared and filled | fast motion, screen steps  |
| 6    | The answer 63, then a long hold before the loop restarts  | hold 2.5 s                 |

Exercise 1 is slow so that the loops can be followed: its pictures include every change of the
marked BASIC line, so the viewer sees `PRINT`, `IF J=5`, `NEXT J` before each next block. Exercise 2
is fast, because its job is to show the gaps and the scale, not the loops again.

## How the animation is made

Two stages, so that the film can be re-cut without playing the game again.

1. **Rushes.** `just rushes` plays the first two exercises of the seeded trainer (always the same
   numbers: 2 x 3 and 9 x 7) and photographs the whole page at **every change** of the ZX81 screen
   or of the BASIC line being executed. The emulated machine is paused for each photograph, so the
   pictures show exact emulated moments, not wall-clock moments. Result: `artifacts/rushes/` with
   one PNG per change and `manifest.json` saying, per picture, the emulated frame (50 per second),
   the BASIC line, the phase, the exercise and what changed. About 180 pictures, in 5 to 7 minutes
   (the photographing, not the game, is slow).
2. **Edit.** `just gif-edit` reads `manifest.json` and the playbook below and writes
   `artifacts/demo.gif`. It takes seconds. `just gif` does both stages.

The result is in `artifacts/` (not committed). Copy `artifacts/demo.gif` to where the README should
reference it when it is final.

## Playbook

The playbook is `tools/gif-playbook.json`. It says which pictures to use and how long to show each.
The editor goes through the pictures in order; the first rule matching a picture's **phase** (and
**exercise**, if the rule names one) decides. A picture that no rule matches is left out.

The phases are those of `src/basic/trainer.phases.json`: `input` (lines 1 to 25), `drawing` (30 to
140), `pause` (150), `answer` (165 to 190), `finished` (200).

A rule has:

- `pictures`: `all` (every picture), `screen-changes` (only pictures where the ZX81 screen changed,
  not those where only the marked line moved), or `first` (the first picture of the phase).
- `ms`: show each picture this many milliseconds, or leave it out and use `timing: "realtime"`:
  show each picture for the emulated time until the next picture, divided by `speed` (default 1).

The current rules:

1. **input**, all pictures, real time. The prompt and the typing.
2. **drawing**, exercise 1, all pictures, 120 ms each. Includes the line-only changes, so the loops
   can be followed. Slow motion.
3. **drawing**, exercise 2, screen changes only, 60 ms each. One picture per block.
4. **pause**, the first picture only, real time, speed 2. The wait, held as one picture, at double
   speed (the 2 second pause shows for 1 second).
5. **answer**, all pictures, real time, speed 2.

The end of the GIF is held for `output.endHoldMs`.

## Which pictures to use for what (choosing rule by rule)

- **To show the BASIC program working:** use `pictures: "all"` in the drawing phase. The marked line
  moves between blocks. It is the strongest shot but only for a small exercise: a big one gives
  hundreds of pictures.
- **To show the result of the loops:** use `screen-changes` with a short `ms`. One picture per
  block.
- **To skip the waiting:** use `first` with `timing: "realtime"` and a `speed` above 1, or give the
  phase no rule at all.
- **To make the GIF smaller:** raise `ms` in exercise 2, use `screen-changes` in exercise 1, or lower
  `output.width`.
- **To film different exercises:** the seed and the number of exercises are constants at the top of
  `tools/capture-rushes.js`; the trainer variant `trainer-seeded` uses `RAND 1`.

## Open decisions

- **Crop to the screen.** The ZX81 screen is the left panel; the blocks are small inside it. A crop
  around the screen plus the status bar would make the drawing much bigger, at the cost of the
  listing. Alternatively two stacked crops. Not done.
- **Sound.** None; a GIF has none.
