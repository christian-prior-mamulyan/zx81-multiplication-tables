// Navigation bar in Solarized orange. Five alternative designs live in nav.css as .nav-1 ... .nav-5;
// see design/navbars.html for all of them side by side and ?nav=N on the game page to try one.

export const NAV_VARIANTS = [1, 2, 3, 4, 5];

export const NAV_ITEMS = [
  { label: 'career.cprima.net', href: 'https://career.cprima.net/' },
  { label: 'Play', href: '#zx81-stage', current: true },
  { label: 'How to play', href: '#howto' },
  { label: 'The program', href: '#zx81-program' },
  { label: 'GitHub', href: 'https://github.com/christian-prior-mamulyan/zx81-multiplication-tables' },
];

// <nav class="site-nav nav-N" aria-label="Site"><ul><li><a ...>
export function buildNav(variant, items = NAV_ITEMS) {
  const nav = document.createElement('nav');
  nav.className = `site-nav nav-${variant}`;
  nav.setAttribute('aria-label', 'Site');
  const list = document.createElement('ul');
  for (const item of items) {
    const entry = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    if (item.current) link.setAttribute('aria-current', 'page');
    entry.append(link);
    list.append(entry);
  }
  nav.append(list);
  return nav;
}
