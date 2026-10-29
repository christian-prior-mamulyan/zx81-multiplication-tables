#!/usr/bin/env bash
# Build ZX81 programs: src/basic/*.bas -> build/*.p -> public/tapes/*.p.hex
#
# The emulator loads a .P file directly when the URL ends in .p and the server
# returns the file as ASCII hex (zx81.html?tzx=../tapes/NAME.p fetches NAME.p.hex),
# so no TZX step is needed.
#
# zxtext2p is vendored C source (tools/zxtext2p). It is compiled with the native
# gcc, or with gcc inside WSL when no native gcc exists (the usual Windows case).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p build public/tapes

run() {
  if command -v gcc >/dev/null 2>&1; then
    "$@"
  elif command -v wsl.exe >/dev/null 2>&1; then
    wsl.exe --cd "$(cygpath -w "$ROOT" 2>/dev/null || pwd -W)" -e "$@"
  else
    echo "need gcc (native or inside WSL) to build tools/zxtext2p" >&2
    exit 1
  fi
}

if [ ! -x build/zxtext2p ]; then
  run gcc -O2 -o build/zxtext2p tools/zxtext2p/zxtext2p.c -lm
fi

shopt -s nullglob
sources=(src/basic/*.bas)
if [ "${#sources[@]}" -eq 0 ]; then
  echo "no BASIC sources in src/basic" >&2
  exit 1
fi

# Test variant of the trainer: identical except RAND becomes RAND 1, so the random
# exercises are the same on every run (RND stays the real ZX81 RND, only its seed is fixed).
sed 's/^25 RAND$/25 RAND 1/' src/basic/trainer.bas > build/trainer-seeded.bas
if cmp -s src/basic/trainer.bas build/trainer-seeded.bas; then
  echo "seeded variant: line '25 RAND' not found in src/basic/trainer.bas" >&2
  exit 1
fi
sources+=(build/trainer-seeded.bas)

for src in "${sources[@]}"; do
  name="$(basename "$src" .bas)"
  # optional per-file zxtext2p options on a line "# zxtext2p: <options>"
  opts="$(sed -n 's/^# zxtext2p: //p' "$src" | head -1 | tr -d '\r')"
  # shellcheck disable=SC2086
  run ./build/zxtext2p $opts -o "build/$name.p" "$src"
  # zxtext2p leaves NXTLIN (the "next line to run" system variable, bytes 32-33 of a .P file)
  # pointing at the end of the program, like a SAVE typed as a direct command: the program
  # would only be listed after loading. Point it at the first program line (0x407D) so it
  # starts at once, like a tape saved from a running program.
  printf '\175\100' | dd of="build/$name.p" bs=1 seek=32 conv=notrunc status=none
  xxd -p "build/$name.p" | tr -d '\n' > "public/tapes/$name.p.hex"
  echo "built public/tapes/$name.p.hex ($(wc -c < "build/$name.p") bytes)"
done
