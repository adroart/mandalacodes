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
  const controlsRef = useRef<HTMLButtonElement>(null);
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

  // Several pages (the card reading, the Atlas) do NOT scroll the window — they
  // scroll an inner absolutely-positioned container, so `window.scrollY` stays
  // 0 forever there. Listening on `window` alone left the bar stuck in its
  // translucent top-of-page state on exactly the pages that scroll the most
  // content underneath it. Scroll events don't bubble, but they DO capture, so
  // a capture-phase listener on the document sees every scroller on the page;
  // we read the offset off whichever element actually fired.
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target;
      if (target === document || target === document.documentElement || target === document.body) {
        setIsScrolled(window.scrollY > 20);
        return;
      }
      const el = target as HTMLElement | null;
      if (!el || typeof el.scrollTop !== 'number') return;
      // Ignore horizontal-only rails (the lens pill strip scrolls sideways);
      // their scrollTop is permanently 0 and would falsely reset the bar.
      if (el.scrollHeight <= el.clientHeight + 1) return;
      setIsScrolled(el.scrollTop > 20);
    };
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
  }, []);

  // A page swap resets every scroller to the top, but no scroll event fires for
  // that — without this the bar would keep the compact scrolled surface from the
  // previous page.
  useEffect(() => {
    setIsScrolled(window.scrollY > 20);
  }, [pathname]);

  // Decide whether the inline menu fits, by measuring real geometry rather than
  // guessing a viewport breakpoint. The menu is centered in the bar; it can grow
  // until its half-width reaches whichever flanking element sits closer to
  // center, plus a small gutter so labels never kiss the wordmark or the toggle
  // before we collapse. The inline menu is always in the DOM (just visually
  // hidden when it doesn't fit) so its natural width stays measurable even while
  // the hamburger is showing — that's what lets it expand back the instant room
  // returns.
  //
  // This measures WIDTHS, never on-screen positions. It used to read the
  // wordmark's and the toggle's bounding rects, which was fine while the bar had
  // exactly one arrangement. Now the collapsed bar centers the wordmark and
  // splits the controls to opposite edges, so a position-based reading of the
  // collapsed layout would always report "no room on the left" and the desktop
  // menu could never come back when the window widened again. Widths are the
  // same in either arrangement, so the test always evaluates the hypothetical
  // expanded layout and there is no feedback loop between layout and decision.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const menu = inlineMenuRef.current;
    const wordmark = wordmarkRef.current;
    const controls = controlsRef.current;
    if (!row || !menu || !wordmark || !controls) return;

    const GUTTER = 24; // breathing room each side before we collapse

    const measure = () => {
      const style = getComputedStyle(row);
      const contentWidth =
        row.getBoundingClientRect().width -
        parseFloat(style.paddingLeft || '0') -
        parseFloat(style.paddingRight || '0');
      const half = contentWidth / 2;
      const menuHalf = menu.scrollWidth / 2; // natural, unclipped half-width
      // Room from center out to where each flanking element would end in the
      // expanded layout: the wordmark hard-left, the theme toggle hard-right.
      const roomLeft = half - wordmark.scrollWidth;
      const roomRight = half - controls.offsetWidth;
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
    // Whether this pass has yet seen the bar at a real height. Until it has,
    // the chase below keeps watching instead of giving up.
    let measured = false;
    const update = () => {
      const height = el.getBoundingClientRect().height;
      // Zero is never a real bar height — it means the bar is display:none,
      // which is how the card entrance hides it while the ritual plays. Writing
      // 0 collapsed the top space every page reserves with var(--nav-height),
      // and the sub-bars that stick to it then sat UNDER the bar once it came
      // back: on a QR arrival the reading's lens rail landed at y=0, behind the
      // site bar, and the reading scrolled under the bar with no rail in sight.
      // It stayed that way until something wrote the variable again — which
      // only happens when a scroll flips isScrolled and re-runs this effect.
      // That is the "scroll down and the top comes back" the bug reports
      // describe, and it is why the reserved space must never be written from a
      // hidden bar.
      if (height <= 0) return;
      measured = true;
      document.documentElement.style.setProperty('--nav-height', `${height}px`);
    };
    update();
    // rAF chase: follow the height through the 500ms transition to its settled
    // value. Runs on mount and on every isScrolled / mobile-menu toggle.
    let raf = 0;
    let start = 0;
    const chase = (t: number) => {
      if (!start) start = t;
      update();
      // Past the transition window the chase keeps going while the bar is still
      // hidden, so the real height is published the moment it returns rather
      // than waiting on the observer — WebKit does not reliably fire one across
      // display:none. The cap is a backstop for a bar that is hidden for good;
      // in the ordinary case this stops at 560ms having measured on frame one.
      if (t - start < 560 || (!measured && t - start < 30_000)) raf = requestAnimationFrame(chase);
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
  // Truly opaque once scrolled or while the mobile sheet is open; translucent
  // glass over the top of a page otherwise. The scrolled surface used to sit at
  // 95% alpha and lean on the blur to hide the rest — but backdrop-filter does
  // not reliably sample an inner scroller on iOS Safari, so that last 5% showed
  // the page's own background and headings sliding past *through* the bar. A
  // fixed bar over moving content has to be opaque; the blur stays only as a
  // fallback flourish for the top-of-page glass state.
  const surface = isScrolled || open
    ? 'bg-paper-50 border-b border-wood-200'
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
        {/* One line, both words in a single run of tracking. Letter-spacing adds
            a phantom gap AFTER the last letter, so a negative right margin equal
            to the tracking pulls that gap back and lets the final S land truly
            flush against whatever sits to its right.

            Flex `order` places it: hard-left when the inline menu fits (the menu
            owns the true center), dead-center when it doesn't, with the theme
            toggle and the hamburger flanking it. */}
        <LinkComponent
          ref={wordmarkRef}
          to="/"
          className={`group flex items-center leading-none py-2 -my-2 shrink-0 ${menuFits ? 'order-1' : 'order-2'}`}
          aria-label="Mandala Codes home"
        >
          <span
            className={`font-brand font-normal uppercase whitespace-nowrap text-wood-900 group-hover:text-bronze-600 transition-colors duration-300 ${
              isScrolled ? 'text-[12px]' : 'text-[13px]'
            }`}
            style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.2em', marginRight: '-0.2em', lineHeight: 1.22 }}
          >
            Mandala Codes
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
          className={`items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap order-3 ${
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

        {/* The two controls are independent flex cells rather than one cluster,
            so they can sit together at the right edge on desktop and split to
            opposite edges around the centered wordmark on mobile. Both carry the
            same 44px box, which is the touch minimum AND what makes the wordmark
            land on true center between them (justify-between only centers the
            middle child when its two neighbours measure the same). */}
        <button
          ref={controlsRef}
          onClick={toggleDarkMode}
          className={`inline-flex items-center justify-center shrink-0 text-wood-700 hover:text-bronze-600 transition-colors min-w-[44px] min-h-[44px] ${
            menuFits ? 'order-4 -mr-2' : 'order-1 -ml-3'
          }`}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode
            ? <Sun aria-hidden="true" size={17} strokeWidth={1.75} />
            : <Moon aria-hidden="true" size={17} strokeWidth={1.75} />}
        </button>

        <button
          className={`${menuFits ? 'hidden' : 'flex'} order-5 shrink-0 text-wood-900 hover:opacity-70 transition-opacity -mr-3 min-w-[44px] min-h-[44px] items-center justify-center`}
          onClick={() => setIsMobileMenuOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-nav-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile sheet — only when the inline menu doesn't fit and is open. */}
      {open && !menuFits && (
        <div
          ref={mobileMenuRef}
          id="mobile-nav-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className="absolute top-full left-0 w-full bg-paper-50 border-b border-wood-200 py-10 px-6 flex flex-col gap-7 items-center shadow-2xl"
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
