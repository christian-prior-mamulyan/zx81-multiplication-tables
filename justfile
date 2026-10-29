set windows-shell := ["bash", "-uc"]

# ZX81_PORT changes the port, ZX81_PY changes how Python is started (CI sets ZX81_PY=python3)
port := env_var_or_default("ZX81_PORT", "8765")
py := env_var_or_default("ZX81_PY", "uv run --no-project python")

default:
    @just --list

# build the site and serve it on http://localhost:8765/ (also under /zx81-trainer/)
dev: build
    {{py}} tools/serve.py --dir public --port {{port}} --also-under zx81-trainer

# assemble the static site in public/
build:
    bash tools/build-site.sh

# BASIC -> .P -> ASCII hex tape images in public/tapes
program:
    bash tools/build-program.sh

# unit tests, no network and no browser needed
test:
    npm test

# emulator integration, trainer behaviour and GitHub Pages path tests (needs: npm install)
test-browser: build
    npx playwright test

# artifacts/screen.png, artifacts/debug.txt, artifacts/display-file.bin for a known exercise
capture: build
    node tools/capture-screen.js

clean:
    rm -rf build public artifacts test-results playwright-report
