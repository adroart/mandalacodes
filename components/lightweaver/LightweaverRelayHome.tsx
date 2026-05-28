/**
 * LightweaverRelayHome
 *
 * The customer-facing control surface served from led.mandalacodes.com.
 * Talks through the relay (cloud) rather than directly to the card. Works
 * from anywhere on the internet — customer at home, at work, on vacation.
 *
 * Three states:
 *   1. Not paired — show pair form (6-char code from card's onboard page).
 *   2. Paired + card online — full control surface (brightness, patterns,
 *      color picker, off).
 *   3. Paired + card offline — show "card is offline" with last-seen time.
 *
 * Pairing binding lives in localStorage; multi-card support is future work.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearBinding, fetchState, getBinding, pair, postCommand, type RelayCommand, type RelayState } from '../../lib/lightweaver/relayClient';

const SWATCH_CLASS: Record<string, string> = {
  aurora: 'lwsw-aurora',
  ember: 'lwsw-ember',
  rainbow: 'lwsw-rainbow',
  breathe: 'lwsw-breathe',
  scanner: 'lwsw-scanner',
  sunset: 'lwsw-sunset',
  twinkle: 'lwsw-twinkle',
  wave: 'lwsw-wave',
  'custom-color': 'lwsw-color',
};

const PATTERN_LIST: { id: string; label: string }[] = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'ember', label: 'Ember' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'scanner', label: 'Scanner' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'twinkle', label: 'Twinkle' },
  { id: 'wave', label: 'Wave' },
  { id: 'custom-color', label: 'Color' },
];

const hueToHsl = (h: number, s: number) =>
  `hsl(${Math.round((h / 255) * 360)}, ${Math.round((s / 255) * 100)}%, 50%)`;

const STYLES = `
.lw-bg{min-height:100vh;background:#050505;color:#f4ede0;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}
.lw-wrap{max-width:520px;margin:0 auto;padding:24px 18px 36px;display:flex;flex-direction:column;gap:16px}
.lw-head{display:flex;justify-content:space-between;align-items:baseline}
.lw-title{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9a8d75}
.lw-piece{font-size:13px;letter-spacing:.5px;color:#c89b5c}
.lw-card{background:#141414;border:1px solid #262626;border-radius:14px;padding:18px}
.lw-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.lw-tile{background:#141414;border:1px solid #262626;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;cursor:pointer}
.lw-tile.lw-active{border-color:#c89b5c}
.lw-tile-name{font-size:12px;font-weight:500;color:#f4ede0;text-align:center}
.lw-sw{height:54px;border-radius:6px;background-color:#262626}
.lwsw-aurora{background:linear-gradient(90deg,#0a3a4a,#2a8a9a,#4ac0d0,#2a8a9a,#0a3a4a);background-size:200% 100%;animation:lwflow 6s linear infinite}
.lwsw-ember{background:radial-gradient(circle at 30% 50%,#d04a18,#8a2008 40%,#2a0800);animation:lwflicker 1.5s ease-in-out infinite}
.lwsw-rainbow{background:linear-gradient(90deg,#e74c3c,#f39c12,#f1c40f,#27ae60,#3498db,#9b59b6,#e74c3c);background-size:200% 100%;animation:lwflow 4s linear infinite}
.lwsw-breathe{background:radial-gradient(circle at 50% 50%,#c89b5c,#5a3a1a 60%,#1a1208);animation:lwbreathe 3s ease-in-out infinite}
.lwsw-scanner{background:linear-gradient(90deg,#000 0%,#000 30%,#c89b5c 50%,#000 70%,#000 100%);background-size:200% 100%;animation:lwscan 2.5s linear infinite}
.lwsw-sunset{background:linear-gradient(90deg,#2a0830,#8a2050,#d04a18,#f1c40f,#d04a18,#8a2050,#2a0830);background-size:200% 100%;animation:lwflow 9s linear infinite}
.lwsw-twinkle{background:radial-gradient(circle at 20% 40%,#f4ede0 0,transparent 8%),radial-gradient(circle at 70% 60%,#f4ede0 0,transparent 6%),radial-gradient(circle at 45% 80%,#f4ede0 0,transparent 5%),linear-gradient(180deg,#3a2c1a,#1a1208);animation:lwflicker 2s ease-in-out infinite}
.lwsw-wave{background:linear-gradient(90deg,#1a1a4a,#5c5cc8,#9b9be0,#5c5cc8,#1a1a4a);background-size:200% 100%;animation:lwflow 5s linear infinite}
.lwsw-color{background:linear-gradient(90deg,#e74c3c,#f39c12,#f1c40f,#27ae60,#3498db,#9b59b6,#e74c3c)}
@keyframes lwflow{0%{background-position:0 0}100%{background-position:200% 0}}
@keyframes lwscan{0%{background-position:100% 0}100%{background-position:-100% 0}}
@keyframes lwflicker{0%,100%{opacity:.9}25%{opacity:1}50%{opacity:.7}75%{opacity:1}}
@keyframes lwbreathe{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.05);opacity:1}}
.lw-bright{background:#141414;border:1px solid #262626;border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px}
.lw-bright-lbl{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9a8d75;flex-shrink:0}
.lw-bright-val{font-size:12px;color:#c89b5c;font-family:ui-monospace,SF Mono,monospace;flex-shrink:0;min-width:36px;text-align:right}
.lw-range{flex:1;-webkit-appearance:none;height:14px;border-radius:7px;background:#262626;outline:none;margin:0}
.lw-range::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;border-radius:50%;background:#c89b5c;cursor:pointer;border:0;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.lw-foot{display:flex;justify-content:space-between;align-items:center;padding:4px 4px 0;gap:10px}
.lw-off-btn{background:transparent;border:1px solid #333;color:#f4ede0;padding:10px 22px;border-radius:22px;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-family:inherit;cursor:pointer}
.lw-off-btn.lw-on{background:#c89b5c;color:#0a0a0a;border-color:#c89b5c}
.lw-link{background:transparent;border:0;color:#5a5247;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:inherit;padding:8px 0}
.lw-pair-input{width:100%;background:#0a0a0a;color:#f4ede0;border:1px solid #333;border-radius:10px;padding:18px 16px;font-size:24px;font-family:ui-monospace,SF Mono,monospace;letter-spacing:.3em;text-align:center;text-transform:uppercase;box-sizing:border-box}
.lw-primary{background:#c89b5c;color:#050505;border:0;border-radius:10px;padding:14px 22px;font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:inherit;width:100%}
.lw-err{color:#e07856;font-size:13px;margin-top:8px;text-align:center}
.lw-status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#7fb069;margin-right:8px;vertical-align:middle}
.lw-status-dot.lw-off{background:#e07856}
.lw-offline{padding:32px 18px;text-align:center;background:#141414;border:1px solid #262626;border-radius:14px}
.lw-offline h2{font-size:16px;font-weight:500;color:#e07856;margin:0 0 8px}
.lw-offline p{font-size:13px;color:#9a8d75;line-height:1.5;margin:0}
`;

const LightweaverRelayHome: React.FC = () => {
  const [binding, setBindingState] = useState(() => getBinding());
  const [state, setStateData] = useState<RelayState | null>(null);
  const [error, setError] = useState<string>('');
  const [pairCode, setPairCode] = useState<string>('');
  const [pairBusy, setPairBusy] = useState(false);
  const [localHue, setLocalHue] = useState(32);
  const [localSat, setLocalSat] = useState(230);
  const [localBri, setLocalBri] = useState(1);

  // Coalescing sender: one in-flight POST per key, latest value wins.
  const senderRef = useRef<{ pending: RelayCommand | null; busy: boolean }>({ pending: null, busy: false });

  const send = useCallback(async (cmd: RelayCommand) => {
    senderRef.current.pending = { ...(senderRef.current.pending || {}), ...cmd };
    if (senderRef.current.busy) return;
    senderRef.current.busy = true;
    while (senderRef.current.pending) {
      const next = senderRef.current.pending;
      senderRef.current.pending = null;
      try {
        await postCommand(next);
      } catch (e) {
        // best-effort; the next state poll will repair UI mismatch
      }
    }
    senderRef.current.busy = false;
  }, []);

  // Poll state every 1.5s while paired
  useEffect(() => {
    if (!binding) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await fetchState();
        if (!cancelled) {
          setStateData(s);
          if (typeof s.hue === 'number') setLocalHue(s.hue);
          if (typeof s.saturation === 'number') setLocalSat(s.saturation);
          if (typeof s.brightness === 'number') setLocalBri(s.brightness);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [binding]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pairBusy) return;
    setError('');
    setPairBusy(true);
    try {
      const b = await pair(pairCode);
      // Persist binding via the helper (uses localStorage). Re-read into state.
      const m = { ...b };
      window.localStorage.setItem('lw_relay_card_id', m.cardId);
      window.localStorage.setItem('lw_relay_owner_token', m.ownerToken);
      window.localStorage.setItem('lw_relay_card_label', m.label);
      setBindingState(getBinding());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'pair failed');
    } finally {
      setPairBusy(false);
    }
  };

  const unpair = () => {
    clearBinding();
    setBindingState(null);
    setStateData(null);
  };

  // Not paired: show pair form
  if (!binding) {
    return (
      <div className="lw-bg">
        <style>{STYLES}</style>
        <div className="lw-wrap">
          <div className="lw-head">
            <span className="lw-title">Lightweaver</span>
          </div>
          <div className="lw-card">
            <p style={{ fontSize: 14, color: '#f4ede0', marginTop: 0, marginBottom: 18, lineHeight: 1.5 }}>
              First time? Pair this device to your piece.
            </p>
            <p style={{ fontSize: 13, color: '#9a8d75', margin: '0 0 18px', lineHeight: 1.6 }}>
              On the same WiFi as your card, open{' '}
              <span style={{ fontFamily: 'ui-monospace, monospace', color: '#c89b5c' }}>http://lightweaver.local</span>
              {' '}— a 6-character code is shown on its Settings drawer. Type it here.
            </p>
            <form onSubmit={handlePair}>
              <input
                className="lw-pair-input"
                value={pairCode}
                onChange={(e) => setPairCode(e.target.value)}
                placeholder="ABC123"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <div style={{ marginTop: 16 }}>
                <button type="submit" className="lw-primary" disabled={pairBusy || pairCode.length < 6}>
                  {pairBusy ? 'Pairing…' : 'Pair'}
                </button>
              </div>
              {error && <div className="lw-err">{error}</div>}
            </form>
          </div>
          <p style={{ fontSize: 11, color: '#5a5247', textAlign: 'center', marginTop: 8 }}>
            After pairing, you can control your piece from anywhere on the internet.
          </p>
        </div>
      </div>
    );
  }

  // Paired but card offline
  if (state && !state.online) {
    return (
      <div className="lw-bg">
        <style>{STYLES}</style>
        <div className="lw-wrap">
          <div className="lw-head">
            <span className="lw-title">Lightweaver</span>
            <span className="lw-piece">{binding.label}</span>
          </div>
          <div className="lw-offline">
            <h2>Card is offline</h2>
            <p>
              Your piece hasn&rsquo;t checked in {state.lastSeenAt ? `for ${Math.round((Date.now() - state.lastSeenAt) / 60000)} minutes` : 'recently'}.
              Make sure it&rsquo;s plugged in and on WiFi.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button className="lw-link" onClick={unpair}>Unpair</button>
          </div>
        </div>
      </div>
    );
  }

  const currentId = state?.currentPatternId || '';
  const blackoutOn = !!state?.blackout;

  return (
    <div className="lw-bg">
      <style>{STYLES}</style>
      <div className="lw-wrap">
        <div className="lw-head">
          <span className="lw-title">
            <span className={`lw-status-dot ${state?.online ? '' : 'lw-off'}`} />
            Lightweaver
          </span>
          <span className="lw-piece">{binding.label}</span>
        </div>

        <div className="lw-grid">
          {PATTERN_LIST.map((p) => {
            const active = p.id === currentId;
            const swClass = SWATCH_CLASS[p.id] || '';
            const swStyle: React.CSSProperties = {};
            if (p.id === 'custom-color') swStyle.background = hueToHsl(localHue, localSat);
            return (
              <button
                key={p.id}
                className={`lw-tile ${active ? 'lw-active' : ''}`}
                onClick={() => send({ patternId: p.id })}
                type="button"
              >
                <div className={`lw-sw ${swClass}`} style={swStyle} />
                <div className="lw-tile-name">{p.label}</div>
              </button>
            );
          })}
        </div>

        {currentId === 'custom-color' && (
          <div className="lw-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ height: 42, borderRadius: 8, background: hueToHsl(localHue, localSat) }} />
            <div className="lw-bright">
              <span className="lw-bright-lbl">Hue</span>
              <input
                type="range" min={0} max={255} value={localHue}
                onChange={(e) => { const v = Number(e.target.value); setLocalHue(v); send({ hue: v }); }}
                className="lw-range"
                style={{ background: 'linear-gradient(90deg,#e74c3c,#f39c12,#f1c40f,#27ae60,#3498db,#9b59b6,#e74c3c)', height: 22, borderRadius: 11 }}
              />
              <span className="lw-bright-val">{localHue}</span>
            </div>
            <div className="lw-bright">
              <span className="lw-bright-lbl">Sat</span>
              <input
                type="range" min={0} max={255} value={localSat}
                onChange={(e) => { const v = Number(e.target.value); setLocalSat(v); send({ saturation: v }); }}
                className="lw-range"
              />
              <span className="lw-bright-val">{localSat}</span>
            </div>
          </div>
        )}

        <div className="lw-bright">
          <span className="lw-bright-lbl">Brightness</span>
          <input
            type="range" min={2} max={100} value={Math.round(localBri * 100)}
            onChange={(e) => { const v = Number(e.target.value) / 100; setLocalBri(v); send({ brightness: v }); }}
            className="lw-range"
          />
          <span className="lw-bright-val">{Math.round(localBri * 100)}%</span>
        </div>

        <div className="lw-foot">
          <button
            className={`lw-off-btn ${blackoutOn ? 'lw-on' : ''}`}
            onClick={() => send({ blackout: !blackoutOn })}
            type="button"
          >
            {blackoutOn ? 'On' : 'Off'}
          </button>
          <button className="lw-link" onClick={unpair}>Unpair</button>
        </div>
      </div>
    </div>
  );
};

export default LightweaverRelayHome;
