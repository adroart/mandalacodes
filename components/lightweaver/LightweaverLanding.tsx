/**
 * LightweaverLanding
 *
 * Entrance for visitors and owners. On led.mandalacodes.com this is the root
 * page; on mandalacodes.com it's still reachable at /lightweaver for backward
 * compatibility. Two doors:
 *
 *   1. View my piece — opens or registers a card hostname, routes to
 *      /control/<host> on the led subdomain (or /lightweaver/control/<host>
 *      on the legacy path).
 *   2. Design mode — opens the static designer bundle at /design/.
 *
 * A list of previously-visited cards is shown when present, so an owner with
 * several pieces can jump straight in without retyping the hostname.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSavedCards, sanitizeHost, type SavedCard } from '../../lib/lightweaver/cards';

// Designer lives at /design/index.html as a static bundle on whichever
// domain serves the SPA. Works for both mandalacodes.com/design and
// led.mandalacodes.com/design.
const DESIGNER_URL = '/design/';

// Pick the right base path for control links based on hostname. On
// led.mandalacodes.com the Lightweaver app is the root, so /control/:host
// is the canonical route. On the legacy mandalacodes.com path it sits under
// /lightweaver/control/:host.
const isLedHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'led.mandalacodes.com' || h.startsWith('led.');
};
const controlPath = (host: string) => (isLedHost() ? `/control/${host}` : `/lightweaver/control/${host}`);

const LightweaverLanding: React.FC = () => {
  const navigate = useNavigate();
  const [host, setHost] = useState('lightweaver');
  const [saved, setSaved] = useState<SavedCard[]>([]);
  const [discovering, setDiscovering] = useState(true);

  useEffect(() => {
    const recent = getSavedCards();
    setSaved(recent);

    // Auto-discover: try the most recent card first, then 'lightweaver'.
    // If a /api/status answers within 1500ms, jump straight to its control
    // page. If nothing answers, fall through to the manual input.
    //
    // Mixed-content reality: this site is HTTPS, the card is HTTP, so the
    // fetch will be blocked on production. In that case the catch fires
    // quickly and we drop to the input UI — no worse than today. On a
    // localhost dev server the call goes through.
    const candidates = [
      ...recent.slice(0, 1).map((c) => c.host),
      'lightweaver',
    ];
    const unique = [...new Set(candidates)];
    let cancelled = false;

    const tryHost = async (h: string): Promise<string | null> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        const r = await fetch(`http://${h}.local/api/status`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timer);
        if (!r.ok) return null;
        const j = await r.json();
        if (!j?.ok) return null;
        return h;
      } catch {
        return null;
      }
    };

    (async () => {
      for (const h of unique) {
        if (cancelled) return;
        const found = await tryHost(h);
        if (found && !cancelled) {
          navigate(controlPath(found));
          return;
        }
      }
      if (!cancelled) setDiscovering(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const openCard = (rawHost: string) => {
    const clean = sanitizeHost(rawHost);
    if (!clean) return;
    navigate(controlPath(clean));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    openCard(host);
  };

  // While we're checking, show a minimal "Looking for your piece…" splash
  // so the page doesn't flash the manual form for a beat then disappear.
  if (discovering) {
    return (
      <div className="min-h-screen bg-paper-50 dark:bg-wood-900 transition-colors flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-light tracking-tight text-wood-900 dark:text-paper-50 mb-3">
            Lightweaver
          </h1>
          <p className="text-sm text-bronze-600 dark:text-bronze-300 uppercase tracking-[0.2em]">
            Looking for your piece…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-wood-900 transition-colors">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-12">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 hover:text-bronze-800 dark:hover:text-bronze-100"
          >
            ← mandalacodes
          </Link>
        </div>

        <h1 className="text-4xl font-light tracking-tight text-wood-900 dark:text-paper-50 mb-3">
          Lightweaver
        </h1>
        <p className="text-base text-wood-600 dark:text-paper-300 mb-12 leading-relaxed">
          A light installation system for laser-cut pieces. Each piece runs on its own card,
          reachable from any device on the same network.
        </p>

        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-4">
            View my piece
          </h2>
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="card hostname"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-paper-100 dark:bg-wood-800 border border-wood-200 dark:border-wood-700 rounded-md px-4 py-3 pr-16 text-wood-900 dark:text-paper-50 font-mono text-sm focus:outline-none focus:border-bronze-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-wood-400 font-mono pointer-events-none">
                .local
              </span>
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-bronze-600 text-paper-50 rounded-md text-sm uppercase tracking-wider hover:bg-bronze-700 transition-colors"
            >
              Open
            </button>
          </form>
          <p className="text-xs text-wood-500 dark:text-paper-400 mt-3 leading-relaxed">
            The card prints its hostname on the setup page during first-time WiFi join.
            Default is <span className="font-mono">lightweaver</span>.
          </p>
        </section>

        {saved.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-4">
              Recent pieces
            </h2>
            <ul className="space-y-2">
              {saved.map((card) => (
                <li key={card.host}>
                  <Link
                    to={controlPath(card.host)}
                    className="flex items-center justify-between bg-paper-100 dark:bg-wood-800 border border-wood-200 dark:border-wood-700 rounded-md px-4 py-3 hover:border-bronze-500 transition-colors"
                  >
                    <div>
                      <div className="text-sm text-wood-900 dark:text-paper-50">{card.label}</div>
                      <div className="text-xs text-wood-500 dark:text-paper-400 font-mono">
                        {card.host}.local
                      </div>
                    </div>
                    <span className="text-xs text-wood-400 font-mono">
                      {new Date(card.lastSeenAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="border-t border-wood-200 dark:border-wood-700 pt-10 mb-12">
          <h2 className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-4">
            New to Lightweaver?
          </h2>
          <p className="text-sm text-wood-600 dark:text-paper-300 mb-6 leading-relaxed">
            You just unwrapped your piece. Two minutes to get it on your home WiFi:
          </p>
          <ol className="space-y-4 mb-6 pl-5 list-decimal text-sm text-wood-900 dark:text-paper-50">
            <li>
              <strong>Plug it in.</strong> The lights come on. Turn the knob to dim or brighten.
              Press the knob to change patterns.
            </li>
            <li>
              <strong>For more control,</strong> open your phone's WiFi list. Look for a network
              called <span className="font-mono text-bronze-700 dark:text-bronze-300">Lightweaver-XXXX</span> and join it.
            </li>
            <li>
              <strong>A setup page opens automatically.</strong> Enter your home WiFi name and
              password. Tap <em>Save and reboot</em>.
            </li>
            <li>
              <strong>Anytime after that,</strong> from any device on your home WiFi, open{' '}
              <span className="font-mono text-bronze-700 dark:text-bronze-300">lightweaver.local</span>{' '}
              in a browser. Patterns, colors, brightness — all from your phone.
            </li>
          </ol>
          <p className="text-xs text-wood-500 dark:text-paper-400 leading-relaxed">
            Lost the WiFi later? If the lights start pulsing slowly in warm white, the piece is back
            in setup mode and ready to be joined to a new network. Same steps as above.
          </p>
        </section>

        <section className="border-t border-wood-200 dark:border-wood-700 pt-10 mb-12">
          <h2 className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-4">
            Why this works the way it works
          </h2>
          <ul className="space-y-3 text-sm text-wood-600 dark:text-paper-300 leading-relaxed list-disc pl-5">
            <li>
              Each piece is its own small computer. It plays patterns on its own — no internet, no
              account, no app required.
            </li>
            <li>
              When it's on your WiFi, your phone or laptop can talk to it directly. Nothing in
              between, nothing tracking what you do.
            </li>
            <li>
              The website you're reading this on (<span className="font-mono">led.mandalacodes.com</span>)
              is the same controls in a friendlier browser, plus a place to find new patterns when
              they're released.
            </li>
            <li>
              You don't need an account to use your piece. If you ever want to save settings or
              hear about new patterns, you can sign up — that's all it does.
            </li>
          </ul>
        </section>

        <section className="border-t border-wood-200 dark:border-wood-700 pt-10 mb-12">
          <h2 className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-4">
            Something's not right
          </h2>
          <dl className="space-y-5 text-sm text-wood-600 dark:text-paper-300 leading-relaxed">
            <div>
              <dt className="font-medium text-wood-900 dark:text-paper-50 mb-1">
                The lights are off and nothing happens when I plug it in.
              </dt>
              <dd>
                Check the power adapter is fully seated. Try a different outlet. If still nothing,
                email me and I'll send a replacement adapter.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-wood-900 dark:text-paper-50 mb-1">
                The piece is pulsing warm white slowly and won't stop.
              </dt>
              <dd>
                That's setup mode. Open your phone's WiFi, look for{' '}
                <span className="font-mono">Lightweaver-XXXX</span>, join it, and follow the setup
                page that opens. Two minutes.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-wood-900 dark:text-paper-50 mb-1">
                I can't open lightweaver.local on my computer.
              </dt>
              <dd>
                Make sure you're on the same WiFi as the piece. On Windows, you may need to install
                Bonjour (it ships with iTunes, or download from Apple's site). On a phone — almost
                always just works.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-wood-900 dark:text-paper-50 mb-1">
                I want it to do something it doesn't do.
              </dt>
              <dd>
                Tell me. New patterns and capabilities ship over time. The more I hear, the better
                the next release is.
              </dd>
            </div>
          </dl>
          <p className="text-sm text-wood-900 dark:text-paper-50 mt-8">
            <a
              href="mailto:hello@mandalacodes.com"
              className="text-bronze-700 dark:text-bronze-300 hover:underline"
            >
              hello@mandalacodes.com
            </a>
            {' '}— I read every message.
          </p>
        </section>

        <section className="border-t border-wood-200 dark:border-wood-700 pt-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-4">
            Design mode
          </h2>
          <p className="text-sm text-wood-600 dark:text-paper-300 mb-4 leading-relaxed">
            For artists and installers. Build pattern sequences, configure outputs, and push to
            cards.
          </p>
          <a
            href={DESIGNER_URL}
            className="inline-block px-6 py-3 border border-wood-300 dark:border-wood-600 rounded-md text-sm uppercase tracking-wider text-wood-900 dark:text-paper-50 hover:border-bronze-500 transition-colors"
          >
            Open designer →
          </a>
        </section>
      </div>
    </div>
  );
};

export default LightweaverLanding;
