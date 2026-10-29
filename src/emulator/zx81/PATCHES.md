# Patches to the vendored emulator

`zx81_emu.js`, `zx81.html` and `roms/zx81.rom` come from
https://github.com/hammingweight/zx81-javascript-emulator at commit
`7b11a9cb11baffea9240ee88876be875e1152c0a` (GPL-2.0, see `LICENSE` in this folder;
the emulator derives from JtyOne by Simon Holdsworth).

Rule: patch only when a failing fixture or a required adapter feature proves it
necessary. Every patch is marked `PATCH n` in `zx81_emu.js` and listed here.
`zx81.html` and `roms/zx81.rom` are unchanged.

| Patch | Change | Why |
|-------|--------|-----|
| 1 | `FileToLoad` fetches `this.fileName` instead of `"/" + this.fileName` | The ROM was requested from the site root (`/roms/zx81.rom`), which breaks under a GitHub Pages project path. `test/browser/subdir.spec.js` proves it. |
| 2a | `ZX81` gets `frames`, `peek(addr, len)`, `poke(addr, bytes)`, `getPC()` | The adapter interface needs `getMemory`, `setMemory`, frame count and program counter; the emulator keeps all of these in private closures. |
| 2b | `ZX81Display` gets `setPaused()` / `isPaused()`; `start` publishes `window.zx81Machine` and `window.zx81Display` | Pause/resume/single-step in the debug panel, and a handle for the adapter. Uses the emulator's existing internal pause flag. |
| 2c | `displayLoop` increments `machine.frames` and calls `machine.onframe(frames)` once per emulated frame | Frame events for the adapter and tests that count emulated frames instead of wall-clock time. |

Loading a `.P` file directly needs no patch: the emulator already picks the format from the
file extension (`zx81.html?tzx=../tapes/trainer.p` fetches `../tapes/trainer.p.hex`).
