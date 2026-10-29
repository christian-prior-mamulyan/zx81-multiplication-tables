// Emulator adapter: the only module application code uses to reach a ZX81 emulator.
// Nothing outside this file (and its mock) may touch emulator internals.
//
// ZX81Emulator interface (JSDoc form; the real and the mock emulator both implement it):
//   loadProgram(id)            Promise<void>   load tapes/<id>.p.hex and start running it
//   reset()                    Promise<void>   reload the current program from power-on
//   start() / stop()                           resume / pause emulation
//   keyDown(key) / keyUp(key)                  press / release a key (KeyboardEvent.key values)
//   getScreen()                {width,height,data}  RGBA pixels of the emulated display
//   captureScreen()            Promise<Blob>   PNG of the emulated display only
//   getMemory(address, length) Uint8Array
//   setMemory(address, bytes)
//   on(event, handler)         returns an unsubscribe function
// Events: ready, program-loaded, frame, stopped, error.
// Extras used by the debug panel and tests: state, program, frame, pc, lastKey, step(),
//   getScreenText() / getScreenRows() (diagnostic text form, see zx81-text.js).

import { dfileAddress, displayFileRows } from './zx81-text.js';

export const EVENTS = ['ready', 'program-loaded', 'frame', 'stopped', 'error'];
export const FRAMES_PER_SECOND = 50;

export class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  on(event, handler) {
    if (!EVENTS.includes(event)) throw new Error(`unknown emulator event: ${event}`);
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this._handlers.get(event).delete(handler);
  }

  emit(event, payload) {
    for (const handler of this._handlers.get(event) ?? []) handler(payload);
  }
}

// KeyboardEvent init for a key press, in the form the emulator's keyboard code reads it.
const KEY_CODES = { Enter: 13, Backspace: 8, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46 };

export function keyEventInit(key) {
  return {
    key,
    keyCode: KEY_CODES[key] ?? 0,
    shiftKey: key.length === 1 && key !== key.toLowerCase(),
    bubbles: true,
    cancelable: true,
  };
}

const STYLE = 'html,body{margin:0;background:#fff}a,.emulator_fps{display:none}canvas{display:block}';

export class RealZX81Emulator extends Emitter {
  constructor({ container, base = './', scale = 2, speed = null }) {
    super();
    this.container = container;
    this.base = base;
    this.scale = scale;
    this.speed = speed;
    this.program = null;
    this.state = 'idle';
    this.frame = 0;
    this.lastKey = null;
    this.iframe = null;
    queueMicrotask(() => this.emit('ready'));
  }

  get pc() {
    return this._machine()?.getPC() ?? null;
  }

  async loadProgram(id) {
    this.program = id;
    this.frame = 0;
    this._setState('loading');
    let response;
    try {
      response = await fetch(`${this.base}tapes/${id}.p.hex`);
    } catch (cause) {
      return this._fail(new Error(`cannot fetch tape ${id}: ${cause.message}`));
    }
    if (!response.ok) return this._fail(new Error(`tape ${id} not found (HTTP ${response.status})`));

    this.iframe?.remove();
    const iframe = this.container.ownerDocument.createElement('iframe');
    iframe.id = 'zx81-frame';
    iframe.title = 'ZX81 display';
    iframe.width = String(320 * this.scale);
    iframe.height = String(240 * this.scale);
    iframe.setAttribute('scrolling', 'no');
    const speed = this.speed === null ? '' : `&speed=${this.speed}`;
    iframe.src = `${this.base}emulator/zx81.html?tzx=../tapes/${encodeURIComponent(id)}.p&scale=${this.scale}${speed}`;
    this.iframe = iframe;
    await new Promise((resolve) => {
      iframe.addEventListener('load', resolve, { once: true });
      this.container.replaceChildren(iframe);
    });

    const win = iframe.contentWindow;
    const style = win.document.createElement('style');
    style.textContent = STYLE;
    win.document.head.append(style);

    for (let waited = 0; !win.zx81Machine; waited += 20) {
      if (waited > 5000) return this._fail(new Error('emulator did not start'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    win.zx81Machine.onframe = (frame) => {
      this.frame = frame;
      this.emit('frame', { frame });
    };
    this._setState('running');
    this.emit('program-loaded', { id });
  }

  reset() {
    return this.loadProgram(this.program);
  }

  start() {
    this._display()?.setPaused(false);
    this._setState('running');
  }

  stop() {
    this._display()?.setPaused(true);
    this._setState('stopped');
    this.emit('stopped', { reason: 'stop' });
  }

  // Run exactly one emulated frame, then pause again.
  step() {
    const machine = this._machine();
    const display = this._display();
    if (!machine || !display) return;
    const previous = machine.onframe;
    machine.onframe = (frame) => {
      machine.onframe = previous;
      display.setPaused(true);
      previous?.(frame);
      this._setState('stopped');
    };
    display.setPaused(false);
    this._setState('running');
  }

  keyDown(key) {
    this._dispatchKey('keydown', key);
  }

  keyUp(key) {
    this._dispatchKey('keyup', key);
  }

  getScreen() {
    const canvas = this._canvas();
    const { width, height } = canvas;
    return { width, height, data: canvas.getContext('2d').getImageData(0, 0, width, height).data };
  }

  captureScreen() {
    const canvas = this._canvas();
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  getMemory(address, length) {
    return new Uint8Array(this._machine().peek(address, length));
  }

  setMemory(address, bytes) {
    this._machine().poke(address, bytes);
  }

  getScreenRows() {
    const machine = this._machine();
    const read = (addr) => machine.peek(addr, 1)[0];
    return displayFileRows(read, dfileAddress(read));
  }

  getScreenText() {
    return this.getScreenRows().join('\n');
  }

  _setState(state) {
    this.state = state;
  }

  _fail(error) {
    this._setState('error');
    this.emit('error', error);
    throw error;
  }

  _win() {
    return this.iframe?.contentWindow ?? null;
  }

  _machine() {
    return this._win()?.zx81Machine ?? null;
  }

  _display() {
    return this._win()?.zx81Display ?? null;
  }

  _canvas() {
    return this._win().document.getElementById('emulator_canvas');
  }

  _dispatchKey(type, key) {
    const win = this._win();
    if (!win) return;
    this.lastKey = key;
    win.document.dispatchEvent(new win.KeyboardEvent(type, keyEventInit(key)));
  }
}

// kind: "real" | "mock". For the mock, MockClass can be injected (tests) or is imported on demand.
export async function createEmulator({ kind = 'real', scenario = 'normal', container, base = './', speed = null, MockClass }) {
  if (kind === 'mock') {
    const Mock = MockClass ?? (await import('./mock-emulator.js')).MockZX81Emulator;
    return new Mock({ container, scenario });
  }
  return new RealZX81Emulator({ container, base, speed });
}
