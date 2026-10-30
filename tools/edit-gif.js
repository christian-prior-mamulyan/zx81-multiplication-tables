// Cut the rushes (tools/capture-rushes.js) into an animated GIF, following the playbook
// (tools/gif-playbook.json, explained in docs/gif-video-brief.md):
//   artifacts/demo.gif
//
// The playbook is a list of rules. Each picture in artifacts/rushes/manifest.json is looked at in order;
// the first rule that matches its phase (and exercise, when the rule names one) decides whether the
// picture is used and for how long it is shown. A picture no rule matches is left out. Changing the
// playbook and running this script again needs no new capture.
//
//   node tools/edit-gif.js [rushes-folder] [output.gif]     (needs: just rushes, ffmpeg on the PATH)
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MS_PER_FRAME = 20; // the ZX81 shows 50 frames per second

const matches = (rule, picture) =>
  rule.phase === picture.phase && (rule.exercise === undefined || rule.exercise === picture.exercise);

// Which pictures are used, and for how many milliseconds each. Pure function: manifest + playbook in,
// list of { picture, ms } out.
export function cut(manifest, playbook) {
  const { endHoldMs, minMs } = playbook.output;
  const edit = [];
  manifest.forEach((picture, index) => {
    const rule = playbook.rules.find((candidate) => matches(candidate, picture));
    if (!rule) {
      return;
    }
    const previous = manifest[index - 1];
    const startsRun = !previous || previous.phase !== picture.phase || previous.exercise !== picture.exercise;
    const used =
      rule.pictures === 'all' ||
      (rule.pictures === 'screen-changes' && picture.changed.includes('screen')) ||
      (rule.pictures === 'first' && startsRun);
    if (!used) {
      return;
    }
    let ms = rule.ms;
    if (ms === undefined) {
      // real time: until the next picture of the rushes, sped up by `speed`
      const next = manifest[index + 1];
      const frames = next ? next.frame - picture.frame : 50;
      ms = (frames * MS_PER_FRAME) / (rule.speed ?? 1);
    }
    edit.push({ picture: picture.picture, ms: Math.max(minMs, Math.round(ms / 10) * 10) });
  });
  if (edit.length > 0) {
    edit.at(-1).ms = endHoldMs; // the last picture stays before the GIF starts over
  }
  return edit;
}

// ffmpeg's concat list: every picture with the time it is shown (the last one is named twice, as the
// concat format needs).
export function concatList(edit) {
  const lines = edit.flatMap(({ picture, ms }) => [`file '${picture}'`, `duration ${ms / 1000}`]);
  lines.push(`file '${edit.at(-1).picture}'`);
  return `${lines.join('\n')}\n`;
}

function buildGif(list, width, output) {
  const filter =
    `scale=${width}:-1:flags=lanczos,split[a][b];` +
    '[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle';
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-filter_complex',
      filter,
      '-fps_mode',
      'vfr',
      '-loop',
      '0',
      output,
    ],
    { encoding: 'utf8' },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`ffmpeg failed (is it on the PATH?): ${result.error?.message ?? result.stderr}`);
  }
}

function main() {
  const rushes = resolve(process.argv[2] ?? join(ROOT, 'artifacts', 'rushes'));
  const output = resolve(process.argv[3] ?? join(ROOT, 'artifacts', 'demo.gif'));
  const manifest = JSON.parse(readFileSync(join(rushes, 'manifest.json'), 'utf8'));
  const playbook = JSON.parse(readFileSync(join(ROOT, 'tools', 'gif-playbook.json'), 'utf8'));
  const edit = cut(manifest, playbook);
  if (edit.length === 0) {
    throw new Error('the playbook uses none of the pictures');
  }
  const list = join(rushes, 'edit.txt');
  writeFileSync(list, concatList(edit));
  mkdirSync(dirname(output), { recursive: true });
  buildGif(list, playbook.output.width, output);
  const seconds = edit.reduce((sum, { ms }) => sum + ms, 0) / 1000;
  console.log(`wrote ${output} (${edit.length} of ${manifest.length} pictures, ${seconds.toFixed(1)} s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
