// Globals the page and the tests share. They exist only in debug mode or inside the emulator frame.
// The emulator patch (src/emulator/zx81/PATCHES.md) publishes the machine handles; the page
// exposes the adapter as window.zx81 when ?debug=1 is given.

interface Window {
  zx81?: any;
  zx81Presenter?: any;
  zx81Machine?: any;
  zx81Display?: any;
  zx81LineLog?: Array<[number, number]>;
  zx81Loads?: number;
}
