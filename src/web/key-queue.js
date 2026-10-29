// Keys on their way to the emulated ZX81.
//
// The ZX81 scans its keyboard once per frame (20 ms) and reads only ONE key at a time. So:
//  * a key must be held for at least `hold` ms, or a quick tap (touch screen, fast typist, test)
//    goes down and up between two scans and is never seen;
//  * the next key may only go down `gap` ms after the previous one was released, or two quick taps
//    overlap and the ZX81 sees two keys at once, which it reads as no key at all.
// Presses and releases are queued in the order they happen and played out with those minimum times.

export class KeyQueue {
  // send('down' | 'up', key) delivers an event to the machine; now and schedule are injectable for tests
  constructor({ send, hold = 60, gap = 25, now = () => performance.now(), schedule = (fn, ms) => setTimeout(fn, ms) }) {
    this.send = send;
    this.hold = hold;
    this.gap = gap;
    this.now = now;
    this.schedule = schedule;
    this.queue = [];
    this.waiting = false;
    this.downAt = 0;
  }

  down(key) {
    this.queue.push(['down', key]);
    this._pump();
  }

  up(key) {
    this.queue.push(['up', key]);
    this._pump();
  }

  _pump() {
    while (!this.waiting && this.queue.length) {
      const [type, key] = this.queue.shift();
      if (type === 'down') {
        this.send('down', key);
        this.downAt = this.now();
      } else {
        // release no sooner than `hold` after the press, then leave `gap` before the next key
        const wait = Math.max(0, this.hold - (this.now() - this.downAt));
        this.waiting = true;
        this.schedule(() => {
          this.send('up', key);
          this.schedule(() => {
            this.waiting = false;
            this._pump();
          }, this.gap);
        }, wait);
      }
    }
  }
}
