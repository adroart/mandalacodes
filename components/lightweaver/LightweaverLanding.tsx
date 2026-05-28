/**
 * LightweaverLanding
 *
 * Entrance for visitors and owners arriving at /lightweaver. Two doors:
 * 1. View my piece — opens or registers a card hostname, routes to /lightweaver/control/<host>
 * 2. Design mode — opens the designer app (separate Vite project in led/lightweaver/)
 *
 * A list of previously-visited cards is shown when present, so an owner with
 * several pieces can jump straight in without retyping the hostname.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSavedCards, sanitizeHost, type SavedCard } from '../../lib/lightweaver/cards';

const DESIGNER_URL = 'https://design.mandalacodes.com'; // placeholder; falls back to /lightweaver/design if route exists

const LightweaverLanding: React.FC = () => {
  const navigate = useNavigate();
  const [host, setHost] = useState('lightweaver');
  const [saved, setSaved] = useState<SavedCard[]>([]);

  useEffect(() => {
    setSaved(getSavedCards());
  }, []);

  const openCard = (rawHost: string) => {
    const clean = sanitizeHost(rawHost);
    if (!clean) return;
    navigate(`/lightweaver/control/${clean}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    openCard(host);
  };

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
                    to={`/lightweaver/control/${card.host}`}
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
            target="_blank"
            rel="noopener noreferrer"
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
