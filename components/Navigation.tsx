import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { SignedIn } from '@clerk/clerk-react';
import { useDarkMode } from '../DarkModeContext';
import AuthButton from './account/AuthButton';

interface NavItem {
  path: string;
  label: string;
  /** Only render this item when the visitor is signed in. */
  signedInOnly?: boolean;
}

// Mandala Codes is its own site (split from Adrian-Website). The menu lists
// only real destinations on this domain — no Creations/Writings/Shop, those
// live on adrianrasmussen.com.
//
// "Your pieces" is the way back in for an owner who already claimed: /atlas/edit
// is otherwise reachable only by completing the claim flow or typing the URL,
// which strands returning stewards. It renders only when signed in.
const NAV_ITEMS: NavItem[] = [
  { path: '/universal-language', label: 'Deck' },
  { path: '/the-systems', label: 'The Systems' },
  { path: '/atlas', label: 'Atlas' },
  { path: '/atlas/edit', label: 'Your pieces', signedInOnly: true },
  { path: '/profile', label: 'Profile' },
];

/**
 * Global top bar. Renders the wordmark + primary nav, and — critically — keeps
 * the `--nav-height` CSS variable in sync with its own rendered height via a
 * ResizeObserver. Pages reserve their top space with `var(--nav-height)` and
 * stick sub-bars to `top: var(--nav-height)`, so without this component live
 * those values fall back to a stale default and every page opens with an empty
 * gap. The nav owns that variable.
 */
const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // Prefix-match so a card page (/universal-language/12) keeps "Deck" active.
  // But never let a shorter item (/atlas) also claim a page that another nav
  // item matches exactly (/atlas/edit) — otherwise both highlight at once.
  const isNavActive = (itemPath: string) => {
    if (location.pathname === itemPath) return true;
    if (!location.pathname.startsWith(itemPath + '/')) return false;
    return !NAV_ITEMS.some(
      (other) => other.path !== itemPath && other.path === location.pathname,
    );
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keep --nav-height equal to the nav's actual rendered height so the spacing
  // under the bar stays flush as the nav shrinks on scroll or the mobile menu
  // changes its height.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--nav-height', `${el.offsetHeight}px`);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isScrolled, isMobileMenuOpen]);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
  const pad = isScrolled ? 'py-1.5 md:py-2' : 'py-2 md:py-4';

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 ease-in-out ${surface} ${pad}`}
    >
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex justify-between items-center relative z-[120]">
        <Link to="/" className="group flex flex-col items-start py-2 -my-2" aria-label="Mandala Codes home">
          <span
            className={`font-serif tracking-normal leading-none transition-all duration-300 font-normal text-wood-900 group-hover:text-bronze-600 ${
              isScrolled ? 'text-base md:text-lg' : 'text-lg md:text-2xl'
            }`}
            style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.06em' }}
          >
            Mandala Codes
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center">
          {NAV_ITEMS.map((item, i) => {
            const link = (
              <React.Fragment key={item.path}>
                {i > 0 && (
                  <span aria-hidden="true" className="h-3.5 w-px bg-wood-900/15" />
                )}
                <Link
                  to={item.path}
                  className={`group relative text-[13px] uppercase tracking-[0.18em] font-label py-3 px-4 xl:px-5 transition-all duration-300 font-semibold ${
                    isNavActive(item.path) ? 'text-wood-900' : 'text-wood-700 hover:text-bronze-600'
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0 left-4 xl:left-5 right-4 xl:right-5 h-px bg-bronze-500 transition-all duration-300 ease-out ${
                      isNavActive(item.path) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </Link>
              </React.Fragment>
            );
            return item.signedInOnly ? (
              <SignedIn key={item.path}>{link}</SignedIn>
            ) : (
              link
            );
          })}
        </div>

        {/* Right controls: dark toggle + mobile hamburger */}
        <div className="flex items-center gap-0">
          <AuthButton />

          <button
            onClick={toggleDarkMode}
            className="px-3 min-w-[44px] min-h-[44px] flex items-center justify-center hover:opacity-70 transition-opacity font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-wood-900"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </button>

          <button
            className="lg:hidden text-wood-900 hover:opacity-70 transition-opacity p-3 -mr-3 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setIsMobileMenuOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div
          ref={mobileMenuRef}
          id="mobile-nav-menu"
          role="navigation"
          aria-label="Mobile navigation"
          className="lg:hidden absolute top-full left-0 w-full bg-paper-50/98 backdrop-blur-xl border-b border-wood-200 py-10 px-6 flex flex-col gap-7 items-center shadow-2xl"
        >
          {NAV_ITEMS.map((item) => {
            const button = (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`text-sm font-label uppercase tracking-[0.2em] font-semibold transition-colors ${
                  isNavActive(item.path) ? 'text-bronze-600' : 'text-wood-800 hover:text-wood-900'
                }`}
              >
                {item.label}
              </button>
            );
            return item.signedInOnly ? (
              <SignedIn key={item.path}>{button}</SignedIn>
            ) : (
              button
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default Navigation;
