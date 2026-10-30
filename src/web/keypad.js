// On-screen number pad for touch screens. The ZX81 has no soft keyboard of its own: a phone shows
// none for a canvas, so the page offers the keys the trainer needs (digits, delete, Enter).
// Every key is forwarded like a real key press, through the same press/release functions.

// [label, KeyboardEvent.key, accessible name, css class]
const KEYS = [
  ['1', '1', '1'],
  ['2', '2', '2'],
  ['3', '3', '3'],
  ['4', '4', '4'],
  ['5', '5', '5'],
  ['6', '6', '6'],
  ['7', '7', '7'],
  ['8', '8', '8'],
  ['9', '9', '9'],
  ['⌫', 'Backspace', 'Delete', 'key-delete'],
  ['0', '0', '0'],
  ['↵', 'Enter', 'Enter', 'key-enter'],
];

// press(key) / release(key) are the page's key functions; show: display the pad even without touch
export function mountKeypad(container, { press, release, show = false }) {
  container.replaceChildren();
  for (const [label, key, name, extra] of KEYS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.key = key;
    button.setAttribute('aria-label', name);
    if (extra) {
      button.classList.add(extra);
    }
    const down = (event) => {
      event.preventDefault(); // no focus change, no text selection, no double-tap zoom
      try {
        button.setPointerCapture(event.pointerId); // keep the release even if the finger slides off the key
      } catch {
        // a synthetic or already finished pointer cannot be captured; the press still counts
      }
      button.classList.add('pressed');
      press(key);
    };
    const up = (event) => {
      if (!button.classList.contains('pressed')) {
        return;
      }
      event.preventDefault();
      button.classList.remove('pressed');
      release(key);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    // keyboard users who focus a key press it with Space or Enter on the button itself
    button.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          press(key);
        }
      }
    });
    button.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        release(key);
      }
    });
    container.append(button);
  }
  container.hidden = false;
  container.classList.toggle('show', show);
}
