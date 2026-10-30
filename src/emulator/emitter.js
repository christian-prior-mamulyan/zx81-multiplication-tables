// Event plumbing shared by the real emulator adapter and the mock. It lives in its own module so
// that neither of them has to import the other (the adapter loads the mock on demand).

export const EVENTS = ['ready', 'program-loaded', 'frame', 'line', 'stopped', 'error'];
export const FRAMES_PER_SECOND = 50;

export class Emitter {
  constructor() {
    this._handlers = new Map();
  }

  // returns a function that removes the handler again
  on(event, handler) {
    if (!EVENTS.includes(event)) {
      throw new Error(`unknown emulator event: ${event}`);
    }
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event).add(handler);
    return () => this._handlers.get(event).delete(handler);
  }

  emit(event, payload) {
    for (const handler of this._handlers.get(event) ?? []) {
      handler(payload);
    }
  }
}
