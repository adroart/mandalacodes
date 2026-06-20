/**
 * SHARED NAV — single source of truth for the top bar on BOTH the React app
 * (Deck / Atlas / Systems / Profile) AND the static Learn library.
 *
 * Edit the bar ONCE here and rebuild; both sides update together and can never
 * drift apart. The links, their order, their labels, and which destinations are
 * absolute (cross-site) all live in this one list. The bar's VISUAL look lives
 * in the sibling `nav-shared.css`.
 *
 * `external: true` means the link points to the OTHER world (a real page load,
 * not an in-app screen swap) — used so each side knows whether to navigate with
 * the router or with a plain link.
 */
export const NAV_LINKS = [
  { href: 'https://mandalacodes.com/universal-language', label: 'Deck', key: 'deck' },
  { href: 'https://mandalacodes.com/the-systems', label: 'The Systems', key: 'systems' },
  { href: 'https://mandalacodes.com/learn/', label: 'Learn', key: 'learn' },
  { href: 'https://mandalacodes.com/atlas', label: 'Atlas', key: 'atlas' },
  { href: 'https://mandalacodes.com/profile', label: 'Profile', key: 'profile' },
];

/** The wordmark text + where it links home. */
export const NAV_WORDMARK = { text: 'Mandala Codes', home: 'https://mandalacodes.com/' };
