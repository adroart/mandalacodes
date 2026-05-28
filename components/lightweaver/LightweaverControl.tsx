/**
 * LightweaverControl
 *
 * Remote control surface for a single Lightweaver card, served from
 * mandalacodes.com. Connects to http://<host>.local from the visitor's
 * browser. When the site is loaded over HTTPS the connection will be
 * blocked by mixed-content rules — in that case we show a clear message
 * and a direct link to the card's onboard page.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CardUnreachableError,
  getCardPatterns,
  getCardStatus,
  postCardControl,
  postCardIdentify,
  type CardPattern,
  type CardStatus,
} from '../../lib/lightweaver/cardApi';
import { rememberCard, sanitizeHost } from '../../lib/lightweaver/cards';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'mixed-content' }
  | { kind: 'unreachable'; reason: string }
  | { kind: 'ready'; status: CardStatus; patterns: CardPattern[] };

const SWATCH_CLASS: Record<string, string> = {
  aurora: 'sw-aurora',
  ember: 'sw-ember',
  rainbow: 'sw-rainbow',
  breathe: 'sw-breathe',
  scanner: 'sw-scanner',
  'warm-white': 'sw-warm-white',
  'cool-white': 'sw-cool-white',
  'photo-white': 'sw-photo-white',
};

const LightweaverControl: React.FC = () => {
  const params = useParams<{ host: string }>();
  const host = sanitizeHost(params.host || '');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [brightness, setBrightness] = useState(1);
  const [currentId, setCurrentId] = useState('');
  const [blackoutOn, setBlackoutOn] = useState(false);
  const [identifyMsg, setIdentifyMsg] = useState('');

  const sendPending = useRef<number | null>(null);
  const sendInflight = useRef(false);

  const sendBrightness = useCallback(
    async (val: number) => {
      sendPending.current = val;
      const flush = async () => {
        if (sendInflight.current || sendPending.current === null) return;
        sendInflight.current = true;
        const v = sendPending.current;
        sendPending.current = null;
        try {
          await postCardControl(host, { brightness: v });
        } catch {
          /* swallow — UI already shows position optimistically */
        }
        sendInflight.current = false;
        if (sendPending.current !== null) flush();
      };
      flush();
    },
    [host],
  );

  const load = useCallback(async () => {
    if (!host) {
      setState({ kind: 'unreachable', reason: 'no host' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const [status, patterns] = await Promise.all([getCardStatus(host), getCardPatterns(host)]);
      rememberCard(host, status.piece?.name || host);
      setCurrentId(patterns.currentId);
      setBlackoutOn(!!status.blackout);
      setState({ kind: 'ready', status, patterns: patterns.patterns });
    } catch (err) {
      if (err instanceof CardUnreachableError && err.reason === 'mixed-content') {
        setState({ kind: 'mixed-content' });
      } else if (err instanceof CardUnreachableError) {
        setState({ kind: 'unreachable', reason: err.reason });
      } else {
        setState({ kind: 'unreachable', reason: 'unknown' });
      }
    }
  }, [host]);

  useEffect(() => {
    load();
  }, [load]);

  const onPickPattern = async (id: string) => {
    setCurrentId(id);
    try {
      await postCardControl(host, { patternId: id });
    } catch {
      /* surface kept silent — load() will recover on next refresh */
    }
  };

  const onToggleBlackout = async () => {
    const next = !blackoutOn;
    setBlackoutOn(next);
    try {
      await postCardControl(host, { blackout: next });
    } catch {
      setBlackoutOn(!next);
    }
  };

  const onIdentify = async () => {
    setIdentifyMsg('Flashing…');
    try {
      await postCardIdentify(host);
      setTimeout(() => setIdentifyMsg(''), 2200);
    } catch {
      setIdentifyMsg('Could not reach card');
      setTimeout(() => setIdentifyMsg(''), 2500);
    }
  };

  const onBrightnessInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    setBrightness(v);
    sendBrightness(v);
  };

  const pieceName = useMemo(() => {
    if (state.kind === 'ready') return state.status.piece?.name || host;
    return host;
  }, [state, host]);

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-wood-900">
      <style>{`
        .sw{height:36px;border-radius:8px;overflow:hidden}
        .sw-aurora{background:linear-gradient(90deg,#0a3a4a,#2a8a9a,#4ac0d0,#2a8a9a,#0a3a4a);background-size:200% 100%;animation:lwFlow 6s linear infinite}
        .sw-ember{background:radial-gradient(circle at 30% 50%,#d04a18,#8a2008 40%,#2a0800);animation:lwFlicker 1.5s ease-in-out infinite}
        .sw-rainbow{background:linear-gradient(90deg,#e74c3c,#f39c12,#f1c40f,#27ae60,#3498db,#9b59b6,#e74c3c);background-size:200% 100%;animation:lwFlow 4s linear infinite}
        .sw-breathe{background:radial-gradient(circle at 50% 50%,#c89b5c,#5a3a1a 60%,#1a1208);animation:lwBreathe 3s ease-in-out infinite}
        .sw-scanner{background:linear-gradient(90deg,#000 0%,#000 30%,#c89b5c 50%,#000 70%,#000 100%);background-size:200% 100%;animation:lwScan 2.5s linear infinite}
        .sw-warm-white{background:linear-gradient(90deg,#3a2c1a,#c89b5c,#f4ede0,#c89b5c,#3a2c1a);background-size:200% 100%;animation:lwFlow 8s linear infinite}
        .sw-cool-white{background:linear-gradient(90deg,#1a2a3a,#5c8ac8,#e0edf4,#5c8ac8,#1a2a3a);background-size:200% 100%;animation:lwFlow 8s linear infinite}
        .sw-photo-white{background:linear-gradient(90deg,#3a3328,#c8b89c,#f4ede0,#c8b89c,#3a3328);background-size:200% 100%;animation:lwFlow 10s linear infinite}
        @keyframes lwFlow{0%{background-position:0 0}100%{background-position:200% 0}}
        @keyframes lwScan{0%{background-position:100% 0}100%{background-position:-100% 0}}
        @keyframes lwFlicker{0%,100%{opacity:.9}25%{opacity:1}50%{opacity:.7}75%{opacity:1}}
        @keyframes lwBreathe{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.05);opacity:1}}
      `}</style>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <Link
            to="/lightweaver"
            className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300"
          >
            ← Lightweaver
          </Link>
          <span className="text-xs font-mono text-wood-500 dark:text-paper-400">
            {host}.local
          </span>
        </div>

        <h1 className="text-3xl font-light tracking-tight text-wood-900 dark:text-paper-50 mb-1">
          {pieceName}
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-10">
          Lightweaver Card
        </p>

        {state.kind === 'loading' && (
          <p className="text-sm text-wood-600 dark:text-paper-300">Connecting to card…</p>
        )}

        {state.kind === 'mixed-content' && (
          <div className="bg-paper-100 dark:bg-wood-800 border border-wood-200 dark:border-wood-700 rounded-md p-6 mb-6">
            <p className="text-sm text-wood-900 dark:text-paper-50 mb-3">
              Your browser blocks secure pages from talking to local devices over plain HTTP.
            </p>
            <p className="text-sm text-wood-600 dark:text-paper-300 mb-4">
              To control this card, open the card's onboard page directly:
            </p>
            <a
              href={`http://${host}.local`}
              className="inline-block px-5 py-3 bg-bronze-600 text-paper-50 rounded-md text-sm uppercase tracking-wider hover:bg-bronze-700 transition-colors"
            >
              Open http://{host}.local →
            </a>
          </div>
        )}

        {state.kind === 'unreachable' && (
          <div className="bg-paper-100 dark:bg-wood-800 border border-wood-200 dark:border-wood-700 rounded-md p-6 mb-6">
            <p className="text-sm text-wood-900 dark:text-paper-50 mb-2">
              Could not reach <span className="font-mono">{host}.local</span> ({state.reason}).
            </p>
            <p className="text-sm text-wood-600 dark:text-paper-300 mb-4">
              Make sure you're on the same WiFi as the card. If the card isn't online yet, plug it
              in and run the setup again.
            </p>
            <button
              onClick={load}
              className="px-5 py-2 border border-wood-300 dark:border-wood-600 rounded-md text-sm uppercase tracking-wider hover:border-bronze-500 transition-colors text-wood-900 dark:text-paper-50"
            >
              Try again
            </button>
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300">
                  Brightness
                </span>
                <span className="text-2xl font-light text-wood-900 dark:text-paper-50">
                  {Math.round(brightness * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={100}
                value={Math.round(brightness * 100)}
                onChange={onBrightnessInput}
                className="w-full accent-bronze-600"
              />
            </section>

            <section className="mb-8">
              <div className="text-xs uppercase tracking-[0.2em] text-bronze-600 dark:text-bronze-300 mb-3">
                Pattern
              </div>
              <div className="grid grid-cols-2 gap-3">
                {state.patterns.map((p) => {
                  const active = p.id === currentId;
                  const swClass = SWATCH_CLASS[p.id] || '';
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPickPattern(p.id)}
                      className={`text-left rounded-md p-3 border transition-colors ${
                        active
                          ? 'border-bronze-500 bg-bronze-50 dark:bg-wood-800'
                          : 'border-wood-200 dark:border-wood-700 hover:border-bronze-500 bg-paper-100 dark:bg-wood-800'
                      }`}
                    >
                      <div className={`sw ${swClass} mb-2`} />
                      <div className="text-sm font-medium text-wood-900 dark:text-paper-50">
                        {p.label}
                      </div>
                      <div className="text-xs text-wood-500 dark:text-paper-400 uppercase tracking-wider">
                        {p.mode}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={onToggleBlackout}
                className={`px-5 py-3 rounded-md text-sm uppercase tracking-wider transition-colors ${
                  blackoutOn
                    ? 'bg-bronze-600 text-paper-50'
                    : 'bg-paper-100 dark:bg-wood-800 border border-wood-200 dark:border-wood-700 text-wood-900 dark:text-paper-50'
                }`}
              >
                {blackoutOn ? 'On' : 'Off'}
              </button>
              <button
                onClick={onIdentify}
                className="px-5 py-3 rounded-md text-sm uppercase tracking-wider bg-paper-100 dark:bg-wood-800 border border-wood-200 dark:border-wood-700 text-wood-900 dark:text-paper-50"
              >
                Identify
              </button>
              {identifyMsg && (
                <span className="text-xs text-wood-500 dark:text-paper-400 self-center">
                  {identifyMsg}
                </span>
              )}
            </section>

            <section className="border-t border-wood-200 dark:border-wood-700 pt-6 text-xs text-wood-500 dark:text-paper-400 space-y-1 font-mono">
              <div>mode: {state.status.mode}</div>
              <div>source: {state.status.source}</div>
              <div>pixels: {state.status.led.pixels}</div>
              <div>
                wifi: {state.status.wifi.transport} · {state.status.wifi.ssid || '—'}
              </div>
              <div className="pt-3">
                <a
                  href={`http://${host}.local/advanced`}
                  className="text-bronze-600 dark:text-bronze-300 hover:underline"
                >
                  Open advanced settings on card →
                </a>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default LightweaverControl;
