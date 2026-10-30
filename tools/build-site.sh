#!/usr/bin/env bash
# Assemble the static site in public/ (what is served locally and deployed to GitHub Pages):
#   public/index.html            trainer page
#   public/web/                  page scripts and styles
#   public/emulator/             vendored ZX81 emulator + adapter + mock
#   public/tapes/                program images (built by tools/build-program.sh)
#   public/debug/charset.html    semigraphics reference
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bash tools/build-program.sh

# start clean: everything in public/ except the tapes just built (removes stale files of old builds)
find public -mindepth 1 -maxdepth 1 ! -name tapes -exec rm -rf {} +
mkdir -p public/emulator public/web public/debug

cp -r src/emulator/zx81/. public/emulator/
cp src/emulator/*.js public/emulator/
cp src/web/index.html public/index.html
cp src/web/*.js src/web/*.css public/web/
cp src/web/debug/charset.html public/debug/charset.html
# BASIC sources, shown under the emulator (including the seeded test variant)
mkdir -p public/basic
cp src/basic/*.bas build/trainer-seeded.bas public/basic/
cp .nojekyll public/.nojekyll

echo "site ready in public/"
