import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import { LAUNCH_FLAGS } from '../../launchFlags';
import SignInPanel from './SignInPanel';

interface AccountLayoutProps {
  title: string;
  children: React.ReactNode;
}

const NAV: Array<{ to: string; label: string }> = [
  { to: '/account', label: 'Overview' },
  { to: '/profile', label: 'Your chart' },
  { to: '/atlas/edit', label: 'Your pieces' },
  { to: '/account/collections', label: 'Collections' },
];

// The whole features that live behind the account, shown as real links on the
// signed-out page so a visitor can step into any of them (each handles its own
// sign-in where it needs one; the chart works without an account at all).
const SIGNED_OUT_FEATURES: Array<{
  to: string; kicker: string; title: string; body: string;
}> = [
  {
    to: '/profile',
    kicker: 'Your chart',
    title: 'Your Hologenetic Profile',
    body: 'Eleven positions, drawn from your birth data, that follow you through every reading.',
  },
  {
    to: '/atlas/edit',
    kicker: 'Your pieces',
    title: 'The artwork you hold',
    body: 'If you own a physical piece: record where it rests, set your intention, and tend its living book.',
  },
  {
    to: '/account/collections',
    kicker: 'Collections',
    title: 'Saved cards',
    body: 'Gather cards into named groupings you can return to.',
  },
];

/**
 * Shared chrome for every /account/* page. Redirects guests to home when
 * accounts are unavailable (Clerk not configured or flag off); shows a
 * brief sign-in prompt when signed out but configured.
 */
const AccountLayout: React.FC<AccountLayoutProps> = ({ title, children }) => {
  const location = useLocation();
  const { available, isLoaded, isSignedIn } = useAccount();

  if (!available && !LAUNCH_FLAGS.accounts) {
    return <Navigate to="/" replace />;
  }

  if (!isLoaded) {
    return <div className="min-h-screen" aria-hidden="true" />;
  }

  // Signed out: a whole page. The sign-in is a full-width horizontal band right
  // at the top under a compact heading, so login is the immediate hero and uses
  // the page width instead of a narrow tower. The three features sit below it,
  // each a large full-width editorial link.
  if (!isSignedIn) {
    return (
      <div className="min-h-screen pt-24 pb-28 px-6 md:px-10 max-w-6xl mx-auto">
        <header className="mb-8 md:mb-10 max-w-3xl">
          <p className="font-label text-[11px] uppercase tracking-[0.32em] text-bronze-600 mb-4">
            Mandala Codes
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05] text-wood-900">
            Your account
          </h1>
          <p className="font-serif text-xl md:text-2xl leading-relaxed text-wood-700 mt-4">
            One place that holds everything that is yours here.
          </p>
        </header>

        {/* The sign-in band, spanning the full width. */}
        <div className="mb-14 md:mb-16">
          <SignInPanel bare horizontal />
        </div>

        {/* The features as large full-width link rows. */}
        <div className="divide-y divide-wood-200/70 border-y border-wood-200/70">
          {SIGNED_OUT_FEATURES.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className="group flex items-baseline gap-5 py-7 transition-colors"
            >
              <div className="flex-1">
                <div className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-600 mb-2.5">
                  {f.kicker}
                </div>
                <div className="font-display text-2xl md:text-3xl leading-tight text-wood-900 mb-2 transition-colors group-hover:text-bronze-700">
                  {f.title}
                </div>
                <p className="font-serif text-[17px] leading-relaxed text-wood-600 max-w-[52ch]">
                  {f.body}
                </p>
              </div>
              <span
                aria-hidden="true"
                className="font-serif text-2xl text-wood-300 transition-all duration-300 ease-out group-hover:text-bronze-600 group-hover:translate-x-1 self-center"
              >
                &rarr;
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-24 px-6 max-w-5xl mx-auto">
      <header className="mb-10">
        <h1 className="font-display text-3xl text-wood-900">{title}</h1>
      </header>
      <div className="grid md:grid-cols-[180px_1fr] gap-10">
        <nav aria-label="Account">
          <ul className="space-y-2">
            {NAV.map((item) => {
              const active =
                item.to === '/account'
                  ? location.pathname === '/account'
                  : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={[
                      'block font-label text-[11px] uppercase tracking-[0.22em] py-2 transition-colors',
                      active ? 'text-bronze-600' : 'text-wood-700 hover:text-bronze-600',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <section>{children}</section>
      </div>
    </div>
  );
};

export default AccountLayout;
