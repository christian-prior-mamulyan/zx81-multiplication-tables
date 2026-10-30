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

# --- code quality -------------------------------------------------------------------------

# every npm-based check: ESLint, Stylelint, html-validate, Prettier, TypeScript, knip
lint:
    npm run lint
    npm run format:check
    npm run typecheck
    npm run knip

# rewrite all files in the project's code style
format:
    npm run format

# check shell scripts (shellcheck, fetched on demand through uv)
lint-shell:
    uvx --from shellcheck-py shellcheck tools/*.sh

# check and format-check the Python helper (ruff, fetched on demand through uv)
lint-py:
    uvx ruff check tools
    uvx ruff format --check tools

# check the Markdown files
lint-md:
    npx --yes markdownlint-cli2 "README.md"

# check the GitHub workflows (actionlint, fetched on demand through uv)
lint-actions:
    uvx --from actionlint-py actionlint

# everything that can run on a developer machine, then the tests
ci: lint test

clean:
    rm -rf build public artifacts test-results playwright-report
