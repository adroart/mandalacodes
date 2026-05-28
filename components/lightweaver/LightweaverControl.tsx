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
  sunset: 'sw-sunset',
  twinkle: 'sw-twinkle',
  wave: 'sw-wave',
  'warm-white': 'sw-warm-white',
  'cool-white': 'sw-cool-white',
  'photo-white': 'sw-photo-white',
  'custom-color': 'sw-custom-color',
};

const hueToHsl = (h: number, s: number) =>
  `hsl(${Math.round((h / 255) * 360)}, ${Math.round((s / 255) * 100)}%, 50%)`;

const LightweaverControl: React.FC = () => {
  const params = useParams<{ host: string }>();
  const host = sanitizeHost(params.host || '');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [brightness, setBrightness] = useState(1);
  const [currentId, setCurrentId] = useState('');
  const [blackoutOn, setBlackoutOn] = useState(false);
  const [identifyMsg, setIdentifyMsg] = useState('');
  const [customHue, setCustomHue] = useState(32);
  const [customSat, setCustomSat] = useState(230);
  const [customBreathe, setCustomBreathe] = useState(false);
  const [customDrift, setCustomDrift] = useState(false);
  const [driftMin, setDriftMin] = useState(0);
  const [driftMax, setDriftMax] = useState(255);

  // Generic coalescing sender — one in-flight per key
  const useCoalescedSender = (key: keyof import('../../lib/lightweaver/cardApi').ControlPayload) => {
    const pending = useRef<number | null>(null);
    const inflight = useRef(false);
    return useCallback(
      (val: number) => {
        pending.current = val;
        const flush = async () => {
          if (inflight.current || pending.current === null) return;
          inflight.current = true;
          const v = pending.current;
          pending.current = null;
          try {
            await postCardControl(host, { [key]: v } as any);
          } catch {
            /* swallow */
          }
          inflight.current = false;
          if (pending.current !== null) flush();
        };
        flush();
      },
      [host, key],
    );
  };

  const sendBrightness = useCoalescedSender('brightness');
  const sendHue = useCoalescedSender('hue');
  const sendSat = useCoalescedSender('saturation');

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
      // Pull current color state by posting an empty control (the echo includes it)
      try {
        const echo = await postCardControl(host, {});
        if (typeof echo.hue === 'number') setCustomHue(echo.hue);
        if (typeof echo.saturation === 'number') setCustomSat(echo.saturation);
        if (typeof echo.breathe === 'boolean') setCustomBreathe(echo.breathe);
        if (typeof echo.drift === 'boolean') setCustomDrift(echo.drift);
        if (typeof echo.driftMin === 'number') setDriftMin(echo.driftMin);
        if (typeof echo.driftMax === 'number') setDriftMax(echo.driftMax);
      } catch {
        /* echo failure isn't fatal */
      }
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

  const onToggleBreathe = async () => {
    const next = !customBreathe;
    setCustomBreathe(next);
    try { await postCardControl(host, { breathe: next }); } catch {}
  };

  const onToggleDrift = async () => {
    const next = !customDrift;
    setCustomDrift(next);
    try { await postCardControl(host, { drift: next }); } catch {}
  };

  const setPalette = async (lo: number, hi: number) => {
    setDriftMin(lo);
    setDriftMax(hi);
    if (!customDrift) setCustomDrift(true);
    try {
      await postCardControl(host, { drift: true, driftMin: lo, driftMax: hi });
    } catch {}
  };

  const isWarmPalette = driftMin === 0 && driftMax === 60;
  const isCoolPalette = driftMin === 130 && driftMax === 200;
  const isRainbowPalette = driftMin === 0 && driftMax === 255;

  const onHueInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    setCustomHue(v);
    sendHue(v);
  };

  const onSatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    setCustomSat(v);
    sendSat(v);
  };

  const onIdentify = async () => {
    setIdentifyMsg('Watch the strip — flashing 3 times.');
    try {
      await postCardIdentify(host);
      setTimeout(() => setIdentifyMsg(''), 3000);
    } catch {
      setIdentifyMsg('Could not reach the card on this network.');
      setTimeout(() => setIdentifyMsg(''), 3000);
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
        .sw-sunset{background:linear-gradient(90deg,#2a0830,#8a2050,#d04a18,#f1c40f,#d04a18,#8a2050,#2a0830);background-size:200% 100%;animation:lwFlow 9s linear infinite}
        .sw-twinkle{background-color:#3a2c1a;background-image:radial-gradient(circle at 20% 40%,#f4ede0 0%,transparent 8%),radial-gradient(circle at 70% 60%,#f4ede0 0%,transparent 6%),radial-gradient(circle at 45% 80%,#f4ede0 0%,transparent 5%),linear-gradient(180deg,#3a2c1a,#1a1208);animation:lwFlicker 2s ease-in-out infinite}
        .sw-wave{background:linear-gradient(90deg,#1a1a4a,#5c5cc8,#9b9be0,#5c5cc8,#1a1a4a);background-size:200% 100%;animation:lwFlow 5s linear infinite}
        .sw-warm-white{background:linear-gradient(90deg,#3a2c1a,#c89b5c,#f4ede0,#c89b5c,#3a2c1a);background-size:200% 100%;animation:lwFlow 8s linear infinite}
        .sw-cool-white{background:linear-gradient(90deg,#1a2a3a,#5c8ac8,#e0edf4,#5c8ac8,#1a2a3a);background-size:200% 100%;animation:lwFlow 8s linear infinite}
        .sw-photo-white{background:linear-gradient(90deg,#3a3328,#c8b89c,#f4ede0,#c8b89c,#3a3328);background-size:200% 100%;animation:lwFlow 10s linear infinite}
        .sw-custom-color{background:linear-gradient(90deg,#e74c3c,#f39c12,#f1c40f,#27ae60,#3498db,#9b59b6,#e74c3c)}
        .lw-hue-track{-webkit-appearance:none;appearance:none;height:14px;border-radius:7px;background:linear-gradient(90deg,#e74c3c,#f39c12,#f1c40f,#27ae60,#3498db,#9b59b6,#e74c3c);outline:none;width:100%}
        .lw-hue-track::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#f4ede0;border:2px solid #0a0a0a;cursor:pointer}
        .lw-hue-track::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#f4ede0;border:2px solid #0a0a0a;cursor:pointer}
        @keyframes lwFlow{0%{background-position:0 0}100%{background-position:200% 0}}
        @keyframes lwScan{0%{background-position:100% 0}100%{background-position:-100% 0}}
        @keyframes lwFlicker{0%,100%{opacity:.9}25%{opacity:1}50%{opacity:.7}75%{opacity:1}}
        @keyframes lwBreathe{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.05);opacity:1}}
      `}</style>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <Link
            to={typeof window !== 'undefined' && (window.location.hostname === 'led.mandalacodes.com' || window.location.hostname.startsWith('led.')) ? '/' : '/lightweaver'}
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
              Open the card directly. Same controls, same network:
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
            <p className="text-sm text-wood-900 dark:text-paper-50 mb-3">
              Can't reach <span className="font-mono">{host}.local</span> on this network.
            </p>
            <p className="text-xs text-wood-600 dark:text-paper-400 mb-4 leading-relaxed">
              If the LEDs are slowly pulsing in warm white, the card is in setup mode
              waiting for new WiFi credentials. Here's how to bring it back:
            </p>
            <ol className="text-sm text-wood-900 dark:text-paper-50 space-y-2 mb-5 pl-5 list-decimal">
              <li>Open <strong>WiFi settings</strong> on your phone or laptop.</li>
              <li>
                Look for a network called <span className="font-mono">Lightweaver-XXXX</span> and join it.
              </li>
              <li>
                The setup page should pop up on its own. Enter your home WiFi name and password,
                then tap <strong>Save and reboot</strong>. The card will join the new network and
                this page will work again.
              </li>
            </ol>
            <p className="text-xs text-wood-500 dark:text-paper-400 mb-4 leading-relaxed">
              If the LEDs are completely off and the card isn't broadcasting <span className="font-mono">Lightweaver-XXXX</span>,
              power-cycle it (unplug, wait 5 seconds, plug back in) and try again.
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
            <section className="mb-4">
              <div className="grid grid-cols-3 gap-2">
                {state.patterns.map((p) => {
                  const active = p.id === currentId;
                  const swClass = SWATCH_CLASS[p.id] || '';
                  const swStyle: React.CSSProperties = { height: 54 };
                  if (p.id === 'custom-color') swStyle.background = hueToHsl(customHue, customSat);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPickPattern(p.id)}
                      className={`text-center rounded-md p-2 border transition-colors ${
                        active
                          ? 'border-bronze-500 bg-bronze-50 dark:bg-wood-800'
                          : 'border-wood-200 dark:border-wood-700 hover:border-bronze-500 bg-paper-100 dark:bg-wood-800'
                      }`}
                    >
                      <div className={`sw ${swClass} mb-1`} style={swStyle} />
                      <div className="text-xs font-medium text-wood-900 dark:text-paper-50">
                        {p.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {currentId === 'custom-color' && (
              <section className="bg-paper-100 dark:bg-wood-800 border border-bronze-500 rounded-md p-4 mb-4 flex flex-col gap-3">
                <div
                  className="rounded-md border border-wood-200 dark:border-wood-700"
                  style={{ height: 42, background: hueToHsl(customHue, customSat) }}
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.15em] text-bronze-600 dark:text-bronze-300 w-16 flex-shrink-0">
                    Hue
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={customHue}
                    onChange={onHueInput}
                    className="lw-hue-track"
                  />
                  <span className="text-xs font-mono text-bronze-600 dark:text-bronze-300 min-w-[30px] text-right">
                    {customHue}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.15em] text-bronze-600 dark:text-bronze-300 w-16 flex-shrink-0">
                    Sat
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={customSat}
                    onChange={onSatInput}
                    className="flex-1 accent-bronze-600"
                  />
                  <span className="text-xs font-mono text-bronze-600 dark:text-bronze-300 min-w-[30px] text-right">
                    {customSat}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onToggleBreathe}
                    className={`flex-1 px-3 py-3 rounded-md transition-colors flex flex-col items-center gap-0.5 ${
                      customBreathe
                        ? 'bg-bronze-600 text-paper-50'
                        : 'border border-wood-300 dark:border-wood-600 text-wood-700 dark:text-paper-300'
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wider">Breathe</span>
                    <span className="text-[10px] opacity-70">slow fade in &amp; out</span>
                  </button>
                  <button
                    onClick={onToggleDrift}
                    className={`flex-1 px-3 py-3 rounded-md transition-colors flex flex-col items-center gap-0.5 ${
                      customDrift
                        ? 'bg-bronze-600 text-paper-50'
                        : 'border border-wood-300 dark:border-wood-600 text-wood-700 dark:text-paper-300'
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wider">Drift</span>
                    <span className="text-[10px] opacity-70">slowly cycle hues</span>
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setPalette(0, 60)}
                    className={`flex-1 py-2 rounded-full text-[11px] uppercase tracking-wider font-semibold text-wood-900 ${
                      isWarmPalette ? 'ring-2 ring-bronze-500 opacity-100' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ background: 'linear-gradient(90deg,#8a2008,#d04a18,#f1c40f)' }}
                  >
                    Warm
                  </button>
                  <button
                    onClick={() => setPalette(130, 200)}
                    className={`flex-1 py-2 rounded-full text-[11px] uppercase tracking-wider font-semibold text-paper-50 ${
                      isCoolPalette ? 'ring-2 ring-bronze-500 opacity-100' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ background: 'linear-gradient(90deg,#0a3a4a,#2a8a9a,#5c5cc8)' }}
                  >
                    Cool
                  </button>
                  <button
                    onClick={() => setPalette(0, 255)}
                    className={`flex-1 py-2 rounded-full text-[11px] uppercase tracking-wider font-semibold text-wood-900 ${
                      isRainbowPalette ? 'ring-2 ring-bronze-500 opacity-100' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ background: 'linear-gradient(90deg,#e74c3c,#f39c12,#27ae60,#3498db,#9b59b6)' }}
                  >
                    Rainbow
                  </button>
                </div>
              </section>
            )}

            <section className="bg-paper-100 dark:bg-wood-800 border border-wood-200 dark:border-wood-700 rounded-md px-4 py-3 mb-4 flex items-center gap-3">
              <span className="text-xs uppercase tracking-[0.15em] text-bronze-600 dark:text-bronze-300 flex-shrink-0">
                Brightness
              </span>
              <input
                type="range"
                min={2}
                max={100}
                value={Math.round(brightness * 100)}
                onChange={onBrightnessInput}
                className="flex-1 accent-bronze-600"
              />
              <span className="text-xs font-mono text-bronze-600 dark:text-bronze-300 min-w-[36px] text-right">
                {Math.round(brightness * 100)}%
              </span>
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
                title="Flashes the strip 3 times so you can tell which physical card this is"
              >
                Find this card
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
