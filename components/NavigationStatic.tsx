import React, { forwardRef, useEffect, useState } from 'react';
import NavigationCore from './NavigationCore';
import { DarkModeProvider, useDarkMode } from '../DarkModeContext';
import { AccountContext, type AccountState } from '../lib/account/useAccount';
import { LAUNCH_FLAGS } from '../launchFlags';

/**
 * Static shell around the one true site bar (NavigationCore), rendered by the
 * Astro /learn library (content-site/src/layouts/Base.astro, hydrated
 * client:load). No react-router here: every link is a plain anchor and
 * "navigate" is a full-page load, which is exactly right when crossing from
 * the static library back into the app.
 *
 * Theme: DarkModeProvider is the app's own theme owner (localStorage
 * `dark-mode` + the `.dark` class), so the toggle in the bar behaves
 * identically on both surfaces. ThemeMirror additionally reflects the choice
 * into `data-theme`, which is what the /learn reading styles key off — one
 * toggle drives both styling systems.
 */

const Anchor = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }>(
  ({ to, children, ...rest }, ref) => (
    <a ref={ref} href={to} {...rest}>
      {children}
    </a>
  ),
);
Anchor.displayName = 'NavAnchor';

/**
 * The static library can't ask the auth backend anything, but it doesn't need
 * to: the app shows the Account item whenever accounts are LAUNCHED (not only
 * when signed in), and the launch flag is a build-time constant both surfaces
 * import. Same flag, same bar, same item count. Sign-in state itself stays
 * unknown here — /account handles that after the click.
 */
const staticAccount: AccountState = {
  available: LAUNCH_FLAGS.accounts,
  isSignedIn: false,
  isLoaded: true,
  userId: null,
  email: null,
  fetchAuthed: (input, init) => fetch(input, init),
};

const ThemeMirror: React.FC = () => {
  const { isDarkMode } = useDarkMode();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  return null;
};

const NavigationStatic: React.FC = () => {
  // SSR renders with the section root; the real pathname lands on hydration so
  // deep article pages still underline "Learn" via the prefix match.
  const [pathname, setPathname] = useState('/learn');
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  return (
    <AccountContext.Provider value={staticAccount}>
      <DarkModeProvider>
        <ThemeMirror />
        <NavigationCore
          pathname={pathname}
          navigate={(path) => window.location.assign(path)}
          LinkComponent={Anchor}
        />
      </DarkModeProvider>
    </AccountContext.Provider>
  );
};

export default NavigationStatic;
