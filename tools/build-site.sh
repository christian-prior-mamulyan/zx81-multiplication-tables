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

rm -rf public/emulator public/web public/debug public/design public/index.html
mkdir -p public/emulator public/web public/debug public/design

cp -r src/emulator/zx81/. public/emulator/
cp src/emulator/*.js public/emulator/
cp src/web/index.html public/index.html
cp src/web/*.js src/web/*.css public/web/
cp src/web/debug/charset.html public/debug/charset.html
cp src/web/design/navbars.html public/design/navbars.html
# BASIC sources, shown under the emulator (including the seeded test variant)
mkdir -p public/basic
cp src/basic/*.bas build/trainer-seeded.bas public/basic/
cp .nojekyll public/.nojekyll

echo "site ready in public/"
