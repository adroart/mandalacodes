/**
 * LightweaverLanding
 *
 * Public Lightweaver entry point. The hosted site is the Studio, installer,
 * and support surface; the ESP32 card is the runtime. Owners open their card
 * directly at http://lightweaver.local, so normal use does not depend on the
 * relay, Cloudflare KV polling, or a pairing code.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSavedCards, sanitizeHost, type SavedCard } from '../../lib/lightweaver/cards';

// Designer lives at /design/index.html as a static bundle on whichever
// domain serves the SPA. Works for both mandalacodes.com/design and
// led.mandalacodes.com/design.
const DESIGNER_URL = '/design/';
const DESIGNER_EXPORT_URL = '/design/#screen=export';
const DESIGNER_DEVICES_URL = '/design/#screen=devices';
const DEFAULT_CARD_URL = 'http://lightweaver.local/';
const AP_SETUP_URL = 'http://192.168.4.1/';

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

const cardUrlFor = (rawHost: string): string => {
  const withoutProtocol = rawHost.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const bare = withoutProtocol.replace(/\.local$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return `http://${bare}/`;
  const clean = sanitizeHost(bare || 'lightweaver');
  return clean ? `http://${clean}.local/` : DEFAULT_CARD_URL;
};

const LightweaverLanding: React.FC = () => {
  const [host, setHost] = useState('lightweaver');
  const [saved, setSaved] = useState<SavedCard[]>([]);

  useEffect(() => {
    setSaved(getSavedCards());
  }, []);

  const openCard = (rawHost: string) => {
    if (typeof window !== 'undefined') window.location.href = cardUrlFor(rawHost);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    openCard(host);
  };

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-wood-900 transition-colors">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-12">
          <a
            href="https://mandalacodes.com/"
            className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 hover:text-bronze-800 dark:hover:text-bronze-100"
          >
            mandalacodes
          </a>
        </div>

        <h1 className="text-4xl font-light tracking-tight text-wood-900 dark:text-paper-50 mb-3">
          Lightweaver
        </h1>
        <p className="text-base text-wood-600 dark:text-paper-300 mb-12 leading-relaxed">
          Design online. Install to the card. Run locally from the hardware. No pairing number is
          required for the normal Lightweaver path.
        </p>

        <section className="mb-10 grid gap-3 sm:grid-cols-3">
          <a
            href={DESIGNER_URL}
            className="px-4 py-3 bg-bronze-600 text-paper-50 rounded-md text-sm uppercase tracking-wider hover:bg-bronze-700 transition-colors text-center"
          >
            Open Studio
          </a>
          <a
            href={DEFAULT_CARD_URL}
            className="px-4 py-3 border border-wood-300 dark:border-wood-600 rounded-md text-sm uppercase tracking-wider text-wood-900 dark:text-paper-50 hover:border-bronze-500 transition-colors text-center"
          >
            Open Card
          </a>
          <a
            href="https://led.mandalacodes.com/relay"
            className="px-4 py-3 border border-wood-300 dark:border-wood-600 rounded-md text-sm uppercase tracking-wider text-wood-900 dark:text-paper-50 hover:border-bronze-500 transition-colors text-center"
          >
            Optional Relay
          </a>
        </section>

        <section className="mb-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-4">
            Open the local card
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
            This opens the card's own page at{' '}
            <span className="font-mono">http://lightweaver.local</span>. If the card is still in
            setup mode, join its <span className="font-mono">Lightweaver-XXXX</span> WiFi network
            and open <a href={AP_SETUP_URL} className="text-bronze-700 dark:text-bronze-300 hover:underline">192.168.4.1</a>.
          </p>
          <p className="text-xs text-wood-500 dark:text-paper-400 mt-2 leading-relaxed">
            Advanced hosted controls are still available at{' '}
            <Link
              to={controlPath(sanitizeHost(host) || 'lightweaver')}
              className="text-bronze-700 dark:text-bronze-300 hover:underline"
            >
              /control/{sanitizeHost(host) || 'lightweaver'}
            </Link>
            , but the card page is the reliable local controller.
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
                  <a
                    href={cardUrlFor(card.host)}
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
                  </a>
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
            You just unwrapped your piece. Get it running from the hardware first; the web Studio
            is only needed when you want to change the layout or install a new configuration.
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
              in a browser. Patterns, colors, brightness, and saved settings all live on the card.
            </li>
            <li>
              <strong>To redesign it,</strong> open Studio on this site, export the Lightweaver card
              config, then paste it into the card page's settings drawer or push it from the Devices
              panel when your browser allows local HTTP.
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
              is the Studio: draw layouts, export card configs, and install updates. It is not the
              transport the lights depend on every second.
            </li>
            <li>
              Remote relay control is optional at <span className="font-mono">/relay</span>. It is
              useful for experiments, but local control is the default because it is immediate and
              does not burn Cloudflare KV reads.
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
                Bonjour. If the card has not joined WiFi yet, connect to its{' '}
                <span className="font-mono">Lightweaver-XXXX</span> setup network and open{' '}
                <span className="font-mono">192.168.4.1</span>.
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
            Studio and install
          </h2>
          <p className="text-sm text-wood-600 dark:text-paper-300 mb-4 leading-relaxed">
            For artists and installers. Build the LED layout, configure outputs, export the card
            runtime file, or push directly to a card on the same WiFi.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={DESIGNER_URL}
              className="inline-block px-6 py-3 border border-wood-300 dark:border-wood-600 rounded-md text-sm uppercase tracking-wider text-wood-900 dark:text-paper-50 hover:border-bronze-500 transition-colors text-center"
            >
              Open Studio
            </a>
            <a
              href={DESIGNER_EXPORT_URL}
              className="inline-block px-6 py-3 border border-wood-300 dark:border-wood-600 rounded-md text-sm uppercase tracking-wider text-wood-900 dark:text-paper-50 hover:border-bronze-500 transition-colors text-center"
            >
              Export Config
            </a>
            <a
              href={DESIGNER_DEVICES_URL}
              className="inline-block px-6 py-3 border border-wood-300 dark:border-wood-600 rounded-md text-sm uppercase tracking-wider text-wood-900 dark:text-paper-50 hover:border-bronze-500 transition-colors text-center"
            >
              Push to Card
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LightweaverLanding;
