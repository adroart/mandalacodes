import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';
import { useAccount } from '../lib/account/useAccount';

/**
 * THE site bar — the single source of truth for the top bar's markup, styling
 * and behavior. It deliberately knows nothing about react-router so it can be
 * rendered on BOTH surfaces:
 *   - the React app, via Navigation.tsx (router shell: router Link + navigate)
 *   - the static /learn library, via NavigationStatic.tsx (plain anchors +
 *     full-page navigation), baked in at build time by content-site.
 * Never fork this bar per surface — change it here and both inherit it.
 */

interface NavItem {
  path: string;
  label: string;
  /** Only render this item when the visitor is signed in. */
  signedInOnly?: boolean;
  /**
   * Static (non-SPA) destination served outside React Router — e.g. the Astro
   * `/learn` library. Rendered as a plain anchor so the browser does a real
   * navigation instead of asking the router for a route that does not exist.
   */
  external?: boolean;
  /** Only render when accounts are available (auth configured
   *  and the launch flag on). Account is a real menu item, not a side control. */
  accountAware?: boolean;
}

// Mandala Codes is its own site (split from Adrian-Website). The menu lists
// only real destinations on this domain — no Creations/Writings/Shop, those
// live on adrianrasmussen.com.
//
// The menu bar lists the public destinations on this domain plus Account —
// which is itself a whole page (sign-in lives inside it; signed in it becomes
// the person's space with their chart, pieces, and collections). Account sits
// inline with the other codes rather than as a separate corner control, and
// only renders when accounts are available.
const NAV_ITEMS: NavItem[] = [
  { path: '/universal-language', label: 'Deck' },
  { path: '/the-systems', label: 'The Systems' },
  { path: '/learn', label: 'Learn', external: true },
  { path: '/atlas', label: 'Atlas' },
  { path: '/account', label: 'Account', accountAware: true },
];

/**
 * Link renderer injected by the shell. The router shell passes react-router's
 * Link; the static shell passes a plain forwardRef anchor. Receives `to` plus
 * ordinary anchor props (className, children, tabIndex, aria-label, ref).
 */
export type NavLinkComponent = React.ComponentType<any>;

export interface NavigationCoreProps {
  /** Current pathname, used for the active-item underline. */
  pathname: string;
  /** Navigate to an app path (router push on the SPA, full load on /learn). */
  navigate: (path: string) => void;
  /** Renders internal links — router Link on the SPA, plain anchor on /learn. */
  LinkComponent: NavLinkComponent;
}

/**
 * Global top bar. Renders the wordmark + primary nav, and — critically — keeps
 * the `--nav-height` CSS variable in sync with its own rendered height via a
 * ResizeObserver. Pages reserve their top space with `var(--nav-height)` and
 * stick sub-bars to `top: var(--nav-height)`, so without this component live
 * those values fall back to a stale default and every page opens with an empty
 * gap. The nav owns that variable.
 */
const NavigationCore: React.FC<NavigationCoreProps> = ({ pathname, navigate, LinkComponent }) => {
  const { isSignedIn, available: accountsAvailable } = useAccount();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Whether the full horizontal menu actually fits the bar. Driven by real
  // measurement (below), not a viewport breakpoint — the menu collapses to the
  // hamburger only when the centered row would collide with the wordmark or the
  // toggle, so it survives down to whatever width the content truly needs.
  const [menuFits, setMenuFits] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const inlineMenuRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLAnchorElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // Items actually shown, after the account-availability and signed-in gates.
  // Used by both the desktop bar and the mobile sheet so the two stay in sync.
  // Computed up here (before the effects) because the fit-measurement effect
  // depends on how many items are rendered.
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.accountAware && !accountsAvailable) return false;
    if (item.signedInOnly && !isSignedIn) return false;
    return true;
  });
  const desktopItems = visibleItems;

  // Prefix-match so a card page (/universal-language/12) keeps "Deck" active.
  // But never let a shorter item (/atlas) also claim a page that another nav
  // item matches exactly (/atlas/edit) — otherwise both highlight at once.
  const isNavActive = (itemPath: string) => {
    if (pathname === itemPath) return true;
    if (!pathname.startsWith(itemPath + '/')) return false;
    return !NAV_ITEMS.some(
      (other) => other.path !== itemPath && other.path === pathname,
    );
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Decide whether the inline menu fits, by measuring real geometry rather than
  // guessing a viewport breakpoint. The menu is centered in the bar, the
  // wordmark anchors left and the controls anchor right; the menu can grow until
  // its half-width reaches whichever side element sits closer to center. We
  // measure against the menu's *natural* width (clientWidth ignores any clipping)
  // and add a small gutter so labels never kiss the wordmark/toggle before we
  // collapse. The inline menu is always in the DOM (just visually hidden when it
  // doesn't fit) so its natural width stays measurable even while the hamburger
  // is showing — that's what lets it expand back the instant room returns.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const menu = inlineMenuRef.current;
    const wordmark = wordmarkRef.current;
    const controls = controlsRef.current;
    if (!row || !menu || !wordmark || !controls) return;

    const GUTTER = 24; // breathing room each side before we collapse

    const measure = () => {
      const rowRect = row.getBoundingClientRect();
      const center = rowRect.left + rowRect.width / 2;
      const menuHalf = menu.scrollWidth / 2; // natural, unclipped half-width
      // Room from center out to each side element's inner edge.
      const leftRoom = wordmark.getBoundingClientRect().right;
      const rightRoom = controls.getBoundingClientRect().left;
      const roomLeft = center - leftRoom;
      const roomRight = rightRoom - center;
      const fits = menuHalf + GUTTER <= Math.min(roomLeft, roomRight);
      setMenuFits(fits);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(menu);
    return () => ro.disconnect();
  }, [desktopItems.length, isScrolled]);

  // Keep --nav-height equal to the nav's actual rendered height so sub-bars that
  // stick to `top: var(--nav-height)` sit flush against the bar with no gap.
  // The bar's height transitions over 500ms when it shrinks on scroll, and a
  // ResizeObserver alone does NOT reliably fire across that padding transition
  // here, so the var froze at the unscrolled height and left a 4px gap. The fix
  // is to re-measure every frame for the duration of the transition whenever the
  // bar's size-affecting state changes, and to keep the observer for any other
  // resize (font load, viewport change).
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--nav-height', `${el.getBoundingClientRect().height}px`);
    };
    update();
    // rAF chase: follow the height through the 500ms transition to its settled
    // value. Runs on mount and on every isScrolled / mobile-menu toggle.
    let raf = 0;
    let start = 0;
    const chase = (t: number) => {
      if (!start) start = t;
      update();
      if (t - start < 560) raf = requestAnimationFrame(chase);
    };
    raf = requestAnimationFrame(chase);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [isScrolled, isMobileMenuOpen]);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // If the bar widens enough that the inline menu fits again, drop the sheet —
  // the hamburger that opened it is gone, so a lingering open sheet would orphan.
  useEffect(() => {
    if (menuFits) setIsMobileMenuOpen(false);
  }, [menuFits]);

  // While the mobile menu is open: lock body scroll, close on Escape, trap focus.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    document.body.style.overflow = 'hidden';
    const focusableSelector = 'button, [href], input, [tabindex]:not([tabindex="-1"])';
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsMobileMenuOpen(false); return; }
      if (e.key !== 'Tab' || !mobileMenuRef.current) return;
      const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [isMobileMenuOpen]);

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const open = isMobileMenuOpen;
  // Solid surface once scrolled or while the mobile sheet is open; translucent
  // glass over the top of a page otherwise.
  const surface = isScrolled || open
    ? 'bg-paper-50/95 backdrop-blur-xl border-b border-wood-200'
    : 'bg-paper-50/85 backdrop-blur-md border-b border-wood-200/50';
  // On phones the bar stays slim so it reads as a compact top strip above the
  // page chrome (e.g. the card's chapter band); desktop keeps a generous bar.
  const pad = isScrolled ? 'py-1.5 md:py-2' : 'py-2 md:py-2.5';

  return (
    <nav
      ref={navRef}
      className={`site-bar-root fixed top-0 left-0 w-full z-[100] transition-all duration-500 ease-in-out ${surface} ${pad}`}
    >
      <div ref={rowRef} className="max-w-[1800px] mx-auto px-6 md:px-12 flex justify-between items-center relative z-[120]">
        <LinkComponent ref={wordmarkRef} to="/" className="group flex flex-col items-stretch leading-none py-2 -my-2 shrink-0" aria-label="Mandala Codes home">
          {/* Two stacked lines tuned to the SAME printed glyph width. "Mandala"
              (7 letters) carries light tracking; "Codes" (5 letters) carries
              heavier tracking so the shorter word stretches to the same right
              edge — C flush under M, S flush under A. CSS letter-spacing adds a
              phantom gap AFTER the last letter, so each line is given a negative
              right margin equal to its own tracking; that pulls the trailing gap
              back and makes the final glyph land truly flush-right on both. */}
          <span
            className={`font-brand font-normal uppercase text-wood-900 group-hover:text-bronze-600 transition-colors duration-300 ${
              isScrolled ? 'text-[12px]' : 'text-[13px]'
            }`}
            style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.2em', marginRight: '-0.2em', lineHeight: 1.22, textAlign: 'center' }}
          >
            Mandala
          </span>
          <span
            className={`font-brand font-normal uppercase text-wood-900 group-hover:text-bronze-600 transition-colors duration-300 ${
              isScrolled ? 'text-[12px]' : 'text-[13px]'
            }`}
            style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.61em', marginRight: '-0.61em', lineHeight: 1.22, textAlign: 'center' }}
          >
            Codes
          </span>
        </LinkComponent>

        {/* Desktop nav — the codes, including Account, locked to the true center
            of the bar (absolute, not the middle flex cell) so the wordmark can
            anchor hard-left and the toggle hard-right without pushing the menu
            off-center. It stays in the DOM at all widths so its natural width is
            always measurable; when the fit-measurement decides it no longer fits
            between the wordmark and the toggle, it's hidden (not unmounted) and
            the hamburger takes over. No viewport breakpoint — it collapses only
            on real overflow, so it survives as narrow as the labels allow. */}
        <div
          ref={inlineMenuRef}
          aria-hidden={!menuFits}
          className={`items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${
            menuFits ? 'flex' : 'flex invisible pointer-events-none'
          }`}
        >
          {desktopItems.map((item, i) => {
            const linkClass = `group relative text-[13px] uppercase tracking-[0.18em] font-label py-3 px-3.5 2xl:px-5 transition-all duration-300 font-semibold ${
              isNavActive(item.path) ? 'text-wood-900' : 'text-wood-700 hover:text-bronze-600'
            }`;
            const underline = (
              <span
                aria-hidden="true"
                className={`absolute bottom-2 left-3.5 2xl:left-5 right-3.5 2xl:right-5 h-0.5 bg-bronze-500 transition-all duration-300 ease-out ${
                  isNavActive(item.path) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              />
            );
            return (
              <React.Fragment key={item.path}>
                {i > 0 && (
                  <span aria-hidden="true" className="h-3.5 w-px bg-wood-900/15" />
                )}
                {item.external ? (
                  <a href={item.path} className={linkClass} tabIndex={menuFits ? undefined : -1}>
                    {item.label}
                    {underline}
                  </a>
                ) : (
                  <LinkComponent to={item.path} className={linkClass} tabIndex={menuFits ? undefined : -1}>
                    {item.label}
                    {underline}
                  </LinkComponent>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Far-right: bare theme toggle (no enclosing circle), pushed flush to
            the bar's right edge, then the hamburger (shown only when the inline
            menu doesn't fit). */}
        <div ref={controlsRef} className="flex items-center gap-0 shrink-0 -mr-2">
          <button
            onClick={toggleDarkMode}
            className="inline-flex items-center justify-center text-wood-700 hover:text-bronze-600 transition-colors h-9 w-9"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode
              ? <Sun aria-hidden="true" size={17} strokeWidth={1.75} />
              : <Moon aria-hidden="true" size={17} strokeWidth={1.75} />}
          </button>

          <button
            className={`${menuFits ? 'hidden' : 'flex'} text-wood-900 hover:opacity-70 transition-opacity p-3 -mr-3 min-w-[44px] min-h-[44px] items-center justify-center`}
            onClick={() => setIsMobileMenuOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile sheet — only when the inline menu doesn't fit and is open. */}
      {open && !menuFits && (
        <div
          ref={mobileMenuRef}
          id="mobile-nav-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className="absolute top-full left-0 w-full bg-paper-50/98 backdrop-blur-xl border-b border-wood-200 py-10 px-6 flex flex-col gap-7 items-center shadow-2xl"
        >
          {visibleItems.map((item) => {
            const itemClass = `text-sm font-label uppercase tracking-[0.2em] font-semibold transition-colors ${
              isNavActive(item.path) ? 'text-bronze-600' : 'text-wood-800 hover:text-wood-900'
            }`;
            return item.external ? (
              <a key={item.path} href={item.path} className={itemClass}>
                {item.label}
              </a>
            ) : (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={itemClass}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default NavigationCore;
