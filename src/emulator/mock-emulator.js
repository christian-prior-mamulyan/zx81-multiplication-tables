// Mock ZX81 emulator. Implements the adapter interface without emulating a Z80:
// it only models what the application can observe (events, state, screen, keys, memory).
// Scenarios: normal, slow, load-error, runtime-error, blank-screen, finished.
// Select in the browser with ?emulator=mock&scenario=<name>.

import { Emitter } from './emulator-adapter.js';

export const SCENARIOS = ['normal', 'slow', 'load-error', 'runtime-error', 'blank-screen', 'finished'];

const FRAME_MS = 20;
const SLOW_FRAME_MS = 500;
const ERROR_FRAME = 5;
const FINISH_FRAME = 5;

// first exercise of the "normal" scenario: 7 times 4, drawn as 7 rows of 4 quarter blocks (code 1)
// with no numbers, a blank line after the fifth row, a blank line above the answer, then the answer
export const ROW = '[Q1][Q1][Q1][Q1]';
const EXERCISE = [...Array(5).fill(ROW), '', ...Array(2).fill(ROW), '', '28'];

// [from frame, BASIC line being executed]
export const LINE_SCRIPT = [
  [0, 10],
  [3, 20],
  [6, 80],
  [9, 150],
  [12, 170],
];

export class MockZX81Emulator extends Emitter {
  // autoRun: advance frames with a timer (browser). Tests set autoRun:false and call tick(n).
  constructor({ container = null, scenario = 'normal', autoRun = Boolean(container) } = {}) {
    super();
    if (!SCENARIOS.includes(scenario)) throw new Error(`unknown mock scenario: ${scenario}`);
    this.scenario = scenario;
    this.container = container;
    this.autoRun = autoRun;
    this.program = null;
    this.state = 'idle';
    this.frame = 0;
    this.pc = 0;
    this.line = null;
    this.lastKey = null;
    this.keys = [];
    this.memory = new Uint8Array(65536);
    this.rows = [];
    this.timer = null;
    queueMicrotask(() => this.emit('ready'));
  }

  async loadProgram(id) {
    this.program = id;
    this.frame = 0;
    this.line = null;
    this.state = 'loading';
    if (this.scenario === 'load-error') {
      this.state = 'error';
      const error = new Error(`mock: tape ${id} not found`);
      this.emit('error', error);
      throw error;
    }
    this._render();
    this.state = 'running';
    this.emit('program-loaded', { id });
    if (this.autoRun) this._startTimer();
  }

  reset() {
    this._stopTimer();
    return this.loadProgram(this.program);
  }

  start() {
    if (this.state === 'stopped') this.state = 'running';
    if (this.autoRun) this._startTimer();
  }

  stop() {
    this._stopTimer();
    this.state = 'stopped';
    this.emit('stopped', { reason: 'stop' });
  }

  step() {
    this.tick(1);
  }

  // Advance n frames; this is the whole "emulation".
  tick(n = 1) {
    for (let i = 0; i < n && this.state === 'running'; i++) {
      this.frame += 1;
      this.pc = (this.pc + 1) & 0xffff;
      this._render();
      this.emit('frame', { frame: this.frame, rows: this.rows });
      this._emitLine();
      if (this.scenario === 'runtime-error' && this.frame === ERROR_FRAME) {
        this._stopTimer();
        this.state = 'error';
        this.emit('error', new Error('mock: runtime error 2/20'));
      }
      if (this.scenario === 'finished' && this.frame === FINISH_FRAME) {
        this._stopTimer();
        this.state = 'stopped';
        this.emit('stopped', { reason: 'finished' });
      }
    }
  }

  keyDown(key) {
    this.lastKey = key;
    this.keys.push(key);
  }

  keyUp() {}

  focus() {}

  getScreen() {
    return { width: 256, height: 192, rows: [...this.rows] };
  }

  getScreenRows() {
    return [...this.rows];
  }

  getScreenText() {
    return this.rows.join('\n');
  }

  async captureScreen() {
    return new Blob([this.getScreenText()], { type: 'text/plain' });
  }

  getMemory(address, length) {
    return this.memory.slice(address, address + length);
  }

  setMemory(address, bytes) {
    this.memory.set(bytes, address);
  }

  _render() {
    if (this.scenario === 'blank-screen') this.rows = [];
    else if (this.scenario === 'finished' && this.frame >= FINISH_FRAME) this.rows = ['FINISHED'];
    else if (this.frame < 3) this.rows = ['ENTER YOUR INDIVIDUAL PAUSE'];
    else this.rows = EXERCISE.slice(0, Math.min(EXERCISE.length, this.frame - 1));
    if (this.container) {
      let pre = this.container.querySelector('pre');
      if (!pre) {
        pre = this.container.ownerDocument.createElement('pre');
        pre.id = 'mock-screen';
        this.container.replaceChildren(pre);
      }
      pre.textContent = this.getScreenText();
    }
  }

  // the mock "executes" a fixed script of BASIC lines so listeners can be tested without a Z80
  _emitLine() {
    let line = LINE_SCRIPT[0][1];
    for (const [fromFrame, scriptLine] of LINE_SCRIPT) if (this.frame >= fromFrame) line = scriptLine;
    if (line !== this.line) {
      this.line = line;
      this.emit('line', { line, frame: this.frame });
    }
  }

  _startTimer() {
    if (this.timer !== null) return;
    const ms = this.scenario === 'slow' ? SLOW_FRAME_MS : FRAME_MS;
    this.timer = setInterval(() => this.tick(1), ms);
  }

  _stopTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
