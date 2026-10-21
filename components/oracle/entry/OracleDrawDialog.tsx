import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ALL_CARDS, CARD_BY_NUMBER, type OracleCard } from '../../../data/oracleData';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import { castFree, type CastResult, type CoinValue } from '../../../utils/ichingCasting';
import { hexagramLineBooleans } from '../HexagramGlyph';
import './OracleDrawDialog.css';

// Names come from the same manuscripts as the deck. The ring follows the old
// circular arrangement, where each trigram sits opposite its inverse.
const RING = ['☰', '☴', '☵', '☶', '☷', '☳', '☲', '☱'].map(symbol => {
  const trigram = ALL_CARDS.flatMap(card => [card.iching.lower_trigram, card.iching.upper_trigram])
    .find(trigram => trigram.symbol === symbol)!;
  return { symbol, name: trigram.name.replace(/\s*\(.*\)\s*$/, '').trim(), lines: hexagramLineBooleans(symbol, symbol).slice(0, 3) };
});
type Trigram = typeof RING[number];
const plainTrigram = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim();

const LINE_NAME: Record<CoinValue, string> = { 6: 'Yin, changing', 7: 'Yang', 8: 'Yin', 9: 'Yang, changing' };
const LINE_SENTENCE: Record<CoinValue, string> = { 6: 'a changing yin line', 7: 'a yang line', 8: 'a yin line', 9: 'a changing yang line' };
const KEY: { value: CoinValue; yang: boolean }[] = [{ value: 6, yang: false }, { value: 7, yang: true }, { value: 8, yang: false }, { value: 9, yang: true }];
// One throw: coins land, then are counted, then read, then placed. Six throws take about twelve seconds.
const THROW_MS = 2100;
const PHASE_AT = [700, 1050, 1400, 1700];

interface Props {
  theme: 'light' | 'dark';
  onClose: () => void;
  onOpen: (number: number, cast?: CastResult) => void;
}

/** Three coin faces (3 = heads, 2 = tails) that add up to a line's value, in a random order. */
function facesFor(value: CoinValue): number[] {
  const faces = [3, 3, 3].map((face, index) => index < value - 6 ? face : 2);
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }
  return faces;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function OracleDrawDialog({ theme, onClose, onOpen }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [mode, setMode] = useState<'trigrams' | 'coins'>('coins');
  const [lower, setLower] = useState<Trigram | null>(null);
  const [upper, setUpper] = useState<Trigram | null>(null);
  const [step, setStep] = useState<'lower' | 'upper'>('lower');
  const [picks, setPicks] = useState(0);
  const [cast, setCast] = useState<CastResult | null>(null);
  const play = usePlayer();

  useDialogFocus(panel, true, onClose);
  useEffect(() => {
    if (cast) panel.current?.querySelector<HTMLElement>('.oracle-draw-cast-result')?.focus();
  }, [cast]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = new Map<HTMLElement, boolean>();
    let branch = panel.current?.parentElement;
    while (branch && branch !== document.body) {
      for (const sibling of branch.parentElement?.children ?? []) {
        if (sibling instanceof HTMLElement && sibling !== branch) {
          background.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    return () => {
      document.body.style.overflow = previous;
      background.forEach((inert, element) => { element.inert = inert; });
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);

  const throwCoins = () => {
    if (cast || play.busy) return;
    const result = castFree();
    if (reducedMotion()) { setCast(result); return; }
    play.start(result, () => setCast(result));
  };
  const skip = () => { const result = play.stop(); if (result) setCast(result); };

  const card = mode === 'coins'
    ? cast && CARD_BY_NUMBER.get(cast.primaryNumber)
    : lower && upper && ALL_CARDS.find(card => card.iching.lower_trigram.symbol === lower.symbol && card.iching.upper_trigram.symbol === upper.symbol);
  const changed = mode === 'coins' && cast?.changedNumber ? CARD_BY_NUMBER.get(cast.changedNumber) : null;
  const pick = useCallback((trigram: Trigram) => {
    setPicks(count => count + 1);
    if (step === 'lower') { setLower(trigram); setStep('upper'); }
    else setUpper(trigram);
  }, [step]);

  const status = play.busy ? play.status
    : mode === 'coins' && cast && card ? `Currently at Hexagram ${card.number}, ${card.card_name}.${changed ? ` Moving to Hexagram ${changed.number}, ${changed.card_name}.` : ' Begin with this card as it stands.'}`
    : mode === 'trigrams' && lower ? `Lower trigram: ${lower.name}. ${upper ? `Upper trigram: ${upper.name}. Your hexagram is ready.` : 'Choose the upper trigram.'}` : '';

  return <div className="oracle-draw-backdrop" onClick={onClose}>
    <div ref={panel} className="oracle-draw" data-theme={theme} data-method={mode} role="dialog" aria-modal="true" aria-labelledby="oracle-draw-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header className="oracle-draw-header">
        <h2 id="oracle-draw-title" className="oracle-draw-sr">Draw a card</h2>
        {/* A span, not a div: the home page styles every header > div. */}
        <span className="oracle-draw-tabs" role="tablist" aria-label="Drawing method">
          <span className="oracle-draw-tab-marker" aria-hidden="true" data-at={mode} />
          {(['coins', 'trigrams'] as const).map((method, index) => <button key={method} id={`draw-tab-${method}`} role="tab" type="button" aria-selected={mode === method} aria-controls="draw-method" tabIndex={mode === method ? 0 : -1} onClick={() => setMode(method)} onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const next = event.key === 'Home' ? 'coins' : event.key === 'End' ? 'trigrams' : index === 0 ? 'trigrams' : 'coins';
              setMode(next);
              document.getElementById(`draw-tab-${next}`)?.focus();
            }
          }}>{method === 'trigrams' ? 'Choose trigrams' : 'Cast coins'}</button>)}
        </span>
        <button className="oracle-draw-close" type="button" aria-label="Close draw a card" onClick={onClose}><span aria-hidden="true" /><span aria-hidden="true" /></button>
      </header>
      <p className="oracle-draw-sr" role="status" aria-live="polite" aria-atomic="true">{status}</p>
      <div id="draw-method" role="tabpanel" aria-labelledby={`draw-tab-${mode}`} className="oracle-draw-body">
        {mode === 'coins' && !cast && <CoinStage play={play} onThrow={throwCoins} onSkip={skip} />}
        {mode === 'coins' && cast && card && <DrawCastResult card={card} changed={changed || null} cast={cast} onOpen={onOpen} />}
        {mode === 'trigrams' && <TrigramRing lower={lower} upper={upper} step={step} picks={picks} card={card || null} onPick={pick} onEdit={setStep} onOpen={onOpen} />}
      </div>
    </div>
  </div>;
}

/* The cast plays on its own clock so it can pause, skip, and be cleared on close. */
function usePlayer() {
  const [state, setState] = useState<{ result: CastResult | null; faces: number[][]; throwNumber: number; phase: number; busy: boolean; leaving: boolean; paused: boolean }>({ result: null, faces: [], throwNumber: 0, phase: 0, busy: false, leaving: false, paused: false });
  const clock = useRef(0);
  const queue = useRef<{ at: number; run: () => void }[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval>>();
  const paused = useRef(false);
  const result = useRef<CastResult | null>(null);
  const clear = () => { queue.current = []; clearInterval(ticker.current); ticker.current = undefined; clock.current = 0; };
  useEffect(() => clear, []);
  const later = (ms: number, run: () => void) => {
    queue.current.push({ at: clock.current + ms, run });
    if (ticker.current) return;
    ticker.current = setInterval(() => {
      if (paused.current) return;
      clock.current += 50;
      const due = queue.current.filter(item => item.at <= clock.current);
      queue.current = queue.current.filter(item => item.at > clock.current);
      due.forEach(item => item.run());
      if (!queue.current.length) { clearInterval(ticker.current); ticker.current = undefined; }
    }, 50);
  };
  const start = (cast: CastResult, done: () => void) => {
    clear();
    paused.current = false;
    result.current = cast;
    setState({ result: cast, faces: cast.lines.map(line => facesFor(line.value)), throwNumber: 0, phase: 0, busy: true, leaving: false, paused: false });
    for (let n = 1; n <= 6; n++) {
      const base = (n - 1) * THROW_MS;
      later(base, () => setState(s => ({ ...s, throwNumber: n, phase: 0 })));
      PHASE_AT.forEach((at, index) => later(base + at, () => setState(s => ({ ...s, phase: index + 1 }))));
    }
    later(6 * THROW_MS + 300, () => setState(s => ({ ...s, leaving: true })));
    later(6 * THROW_MS + 620, () => { setState(s => ({ ...s, busy: false, leaving: false })); done(); });
  };
  const stop = () => { clear(); paused.current = false; setState(s => ({ ...s, busy: false, leaving: false, paused: false })); return result.current; };
  const togglePause = () => { paused.current = !paused.current; setState(s => ({ ...s, paused: paused.current })); };
  const { throwNumber: t, phase, result: r } = state;
  const line = r && t ? r.lines[t - 1] : null;
  const status = !line ? 'Throwing the coins.' : phase === 0 ? `Throwing line ${t}.` : phase < 3 ? `Line ${t}: ${state.faces[t - 1].filter(face => face === 3).length} heads.` : `Line ${t}: ${line.value}, ${LINE_SENTENCE[line.value]}.`;
  return { ...state, start, stop, togglePause, status };
}
type Player = ReturnType<typeof usePlayer>;

function CoinStage({ play, onThrow, onSkip }: { play: Player; onThrow: () => void; onSkip: () => void }) {
  const { result, faces, throwNumber: t, phase, busy, leaving, paused } = play;
  const current = result && t ? result.lines[t - 1] : null;
  const target = current && phase < 4 ? t - 1 : t < 6 ? t : -1;
  return <section className={`oracle-draw-coins-stage ${leaving ? 'is-leaving' : ''} ${paused ? 'is-paused' : ''}`}>
    <h3>Use the oracle</h3>
    <p className="oracle-draw-intro">The I Ching is an oracle, a way of reading a moment. Three coins thrown six times build your card, one line at a time.</p>
    <div className="oracle-draw-coin-row" aria-hidden="true" onClick={busy ? undefined : onThrow}>
      {[0, 1, 2].map(k => {
        const face = current ? faces[t - 1][k] : 0;
        const landed = !!current && phase >= 1;
        const look = !current ? 'is-idle' : phase === 0 ? (t % 2 ? 'is-spin-a' : 'is-spin-b') : face === 3 ? 'is-heads' : 'is-tails';
        return <span key={k} className="oracle-draw-coin-slot">
          <span className={`oracle-draw-coin ${look}`} style={{ animationDelay: `${k * 90}ms` }}><span><span /></span></span>
          <span className={`oracle-draw-coin-face ${landed ? (t % 2 ? 'is-in-a' : 'is-in-b') : ''}`} style={{ animationDelay: `${k * 90}ms` }}>{landed ? (face === 3 ? 'Heads, 3' : 'Tails, 2') : ''}</span>
        </span>;
      })}
    </div>
    <p className="oracle-draw-rule">Heads count 3, tails count 2. The total makes each line.</p>
    <div className="oracle-draw-build" aria-label="Your six lines, line 1 at the bottom">
      {[5, 4, 3, 2, 1, 0].map(index => {
        const line = result?.lines[index];
        const reached = !!line && (index < t - 1 || (index === t - 1 && phase >= 1));
        const placed = !!line && (index < t - 1 || (index === t - 1 && phase >= 4));
        const read = !!line && (index < t - 1 || (index === t - 1 && phase >= 3));
        const lineFaces = faces[index] ?? [];
        return <div key={index} className={`oracle-draw-build-row ${index === target ? 'is-target' : ''}`}>
          <span className={`oracle-draw-build-coins ${reached ? 'is-in' : ''}`} aria-label={`Line ${index + 1}`}>
            {reached && lineFaces.map((face, k) => <span key={k} className={face === 3 ? 'is-heads' : ''} />)}
          </span>
          <span className={`oracle-draw-bar ${placed ? 'is-placed' : ''} ${placed && line!.moving ? 'is-moving' : ''} ${placed && !line!.yang ? 'is-yin' : ''}`} aria-hidden="true"><span /><span /></span>
          <span className="oracle-draw-build-total">
            {read && <strong className={line!.moving ? 'is-moving' : ''}>{line!.value}</strong>}
          </span>
        </div>;
      })}
    </div>
    <div className="oracle-draw-key" aria-label="What each total makes">
      {KEY.map(({ value, yang }) => {
        const lit = !!current && phase >= 3;
        const hit = lit && current!.value === value;
        return <div key={value} className={`${hit ? 'is-hit' : ''} ${lit && !hit ? 'is-dim' : ''} ${value === 6 || value === 9 ? 'is-moving' : ''}`}>
          <strong>{value}</strong>
          <span className={`oracle-draw-bar is-placed ${yang ? '' : 'is-yin'}`} aria-hidden="true"><span /><span /></span>
          <span>{LINE_NAME[value]}</span>
        </div>;
      })}
    </div>
    <div className="oracle-draw-actions">
      {busy && !leaving ? <>
        <button type="button" className={`oracle-draw-secondary ${paused ? 'is-on' : ''}`} aria-pressed={paused} onClick={play.togglePause}>{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" className="oracle-draw-secondary is-quiet" onClick={onSkip}>Skip to card</button>
      </> : <button type="button" className="oracle-draw-primary" disabled={busy} onClick={onThrow}>Throw the coins</button>}
    </div>
  </section>;
}

function DrawCastResult({ card, changed, cast, onOpen }: { card: OracleCard; changed: OracleCard | null; cast: CastResult; onOpen: Props['onOpen'] }) {
  const upperChanges = changed && card.iching.upper_trigram.symbol !== changed.iching.upper_trigram.symbol;
  const lowerChanges = changed && card.iching.lower_trigram.symbol !== changed.iching.lower_trigram.symbol;
  const describe = (side: 'upper' | 'lower') => `${plainTrigram(card.iching[`${side}_trigram`].name)} becomes ${plainTrigram(changed!.iching[`${side}_trigram`].name)} ${side === 'upper' ? 'above' : 'below'}.`;
  const sameAboveAndBelow = upperChanges && lowerChanges && card.iching.upper_trigram.symbol === card.iching.lower_trigram.symbol && changed!.iching.upper_trigram.symbol === changed!.iching.lower_trigram.symbol;
  const description = sameAboveAndBelow ? `${plainTrigram(card.iching.upper_trigram.name)} becomes ${plainTrigram(changed!.iching.upper_trigram.name)} above and below.` : changed ? [upperChanges && describe('upper'), lowerChanges && describe('lower')].filter(Boolean).join(' ') : 'No lines are changing, so this card stands on its own.';
  const moving = cast.movingPositions;
  const movingText = !moving.length ? '' : moving.length === 1 ? `Line ${moving[0]} is changing.` : `Lines ${moving.slice(0, -1).join(', ')} and ${moving[moving.length - 1]} are changing.`;
  return <section className="oracle-draw-cast-result" aria-label="Your hexagram" tabIndex={-1}>
    <div className="oracle-draw-pair">
      <CastFigure card={card} cast={cast} label="Your throw" upperChanges={!!upperChanges} lowerChanges={!!lowerChanges} onOpen={() => onOpen(card.number, cast)} />
      {changed ? <>
        <p className="oracle-draw-changing oracle-draw-rise" style={{ animationDelay: '980ms' }}><span>Changing</span><span><strong>{movingText}</strong> {description}</span></p>
        <CastFigure card={changed} cast={cast} destination label="Changes to" upperChanges={!!upperChanges} lowerChanges={!!lowerChanges} onOpen={() => onOpen(changed.number)} />
      </> : <p className="oracle-draw-changing is-still oracle-draw-rise" style={{ animationDelay: '700ms' }}>{description}</p>}
    </div>
    <p className="oracle-draw-reading-guide oracle-draw-rise" style={{ animationDelay: changed ? '1800ms' : '860ms' }}>{changed ? 'The gold lines are changing. The first card is where you are now, the second is where it may be heading.' : 'This figure reflects your situation now. Begin with this card and explore what it brings into view.'}</p>
  </section>;
}

function CastFigure({ card, cast, destination = false, label, upperChanges, lowerChanges, onOpen }: { card: OracleCard; cast: CastResult; destination?: boolean; label: string; upperChanges: boolean; lowerChanges: boolean; onOpen: () => void }) {
  const bits = hexagramLineBooleans(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol);
  const start = destination ? 1120 : 0;
  return <figure className="oracle-draw-cast-figure" data-phase={destination ? 'next' : 'current'} aria-label={label}>
    <h3 className="oracle-draw-rise" style={{ animationDelay: `${start}ms` }}>{card.card_name}</h3>
    <div className="oracle-draw-figure-body">
      <span className="oracle-draw-cast-glyph" aria-hidden="true">
        {bits.map((yang, index) => {
          const line = cast.lines[5 - index];
          const fromBottom = 5 - index;
          const delay = destination ? 1220 + fromBottom * 60 : 160 + fromBottom * 90;
          const kind = line.moving ? (destination ? 'is-morph' : 'is-pulse') : '';
          return <span key={index} className={`oracle-draw-bar is-placed oracle-draw-draw ${kind} ${line.moving ? 'is-moving' : ''} ${yang ? '' : 'is-yin'} ${destination && line.moving && !line.yang ? 'from-yin' : ''} ${destination && line.moving && line.yang ? 'from-yang' : ''}`}
            style={{ animationDelay: line.moving ? `${delay}ms, ${delay + (destination ? 520 : 760)}ms` : `${delay}ms` }}><span /><span /></span>;
        })}
      </span>
      <figcaption className="oracle-draw-rise" style={{ animationDelay: `${start + 320}ms` }}>
        <p className="oracle-draw-position">{destination ? 'Moving to' : 'Currently at'}</p>
        <p className="oracle-draw-hex-number"><span>Hexagram {card.number}</span><span> of 64</span></p>
        <p className="oracle-draw-hex-name">{card.iching.hexagram_name}</p>
        <p className="oracle-draw-elements"><span className={upperChanges ? 'does-change' : undefined}>{plainTrigram(card.iching.upper_trigram.name)}</span> over <span className={lowerChanges ? 'does-change' : undefined}>{plainTrigram(card.iching.lower_trigram.name)}</span></p>
      </figcaption>
    </div>
    <button type="button" className={`${destination ? 'oracle-draw-secondary' : 'oracle-draw-primary'} oracle-draw-rise`} style={{ animationDelay: `${start + (destination ? 500 : 520)}ms` }} aria-label={`Open card ${card.number}`} onClick={onOpen}>Open card {card.number}</button>
  </figure>;
}

function TrigramRing({ lower, upper, step, picks, card, onPick, onEdit, onOpen }: { lower: Trigram | null; upper: Trigram | null; step: 'lower' | 'upper'; picks: number; card: OracleCard | null; onPick: (trigram: Trigram) => void; onEdit: (step: 'lower' | 'upper') => void; onOpen: Props['onOpen'] }) {
  const selected = step === 'lower' ? lower : upper;
  const bits = hexagramLineBooleans(upper?.symbol ?? '☰', lower?.symbol ?? '☰');
  const bounce = picks % 2 ? 'is-picked-a' : 'is-picked-b';
  return <section className="oracle-draw-controls oracle-draw-ring-mode">
    <div className="oracle-draw-ring-head">
      <h3>{step === 'lower' ? 'Choose the bottom half' : 'Now choose the top half'}</h3>
      <p className="oracle-draw-help">A card is two halves of three lines. Start at the bottom.</p>
    </div>
    <div className="oracle-draw-steps" aria-label="Selection order">
      <button type="button" aria-current={step === 'lower' ? 'step' : undefined} onClick={() => onEdit('lower')}><span>1 · Bottom half</span><strong>{lower?.name ?? 'Not chosen'}</strong></button>
      <button type="button" disabled={!lower} aria-current={step === 'upper' ? 'step' : undefined} onClick={() => onEdit('upper')}><span>2 · Top half</span><strong>{upper?.name ?? 'Not chosen'}</strong></button>
    </div>
    <div className="oracle-draw-ring-room">
      <div className="oracle-draw-ring">
        <div className="oracle-draw-trigrams" role="group" aria-label={`${step === 'lower' ? 'Lower' : 'Upper'} trigram choices`}>
          {RING.map((trigram, k) => {
            const angle = -Math.PI / 2 + k * Math.PI / 4;
            const on = selected?.symbol === trigram.symbol;
            return <button key={trigram.symbol} type="button" className={on ? bounce : undefined} aria-label={trigram.name} aria-pressed={on} onClick={() => onPick(trigram)}
              style={{ left: `${50 + 38.8 * Math.cos(angle) - 10.6}%`, top: `${50 + 38.8 * Math.sin(angle) - 10.6}%` }}>
              <span className="oracle-draw-trigram-lines" aria-hidden="true">{trigram.lines.map((yang, i) => <span key={i} className={`oracle-draw-bar is-placed ${yang ? '' : 'is-yin'}`}><span /><span /></span>)}</span>
              <span>{trigram.name}</span>
            </button>;
          })}
        </div>
        <div className="oracle-draw-figure oracle-draw-selection" aria-label="Combined hexagram">
          <svg width="66" height="68" viewBox="0 0 76 78" fill="currentColor" aria-hidden="true">
            {bits.map((solid, index) => {
              const chosen = index < 3 ? upper : lower;
              return <g key={index} className={chosen ? 'is-chosen' : 'is-unfilled'}>{solid ? <rect x="0" y={index * 14} width="76" height="8" /> : <><rect x="0" y={index * 14} width="33" height="8" /><rect x="43" y={index * 14} width="33" height="8" /></>}</g>;
            })}
          </svg>
          {(['upper', 'lower'] as const).map(half => {
            const trigram = half === 'upper' ? upper : lower;
            return <div key={half} className={`oracle-draw-selection-half is-${half}`} aria-label={`${half === 'upper' ? 'Upper' : 'Lower'} trigram`}><button type="button" disabled={half === 'upper' && !lower} aria-label={`Edit ${half} trigram${trigram ? `, ${trigram.name}` : ''}`} onClick={() => onEdit(half)}><span className="oracle-draw-sr">{trigram?.name ?? 'Not chosen'}</span></button></div>;
          })}
        </div>
      </div>
    </div>
    <div className="oracle-draw-preview" aria-label="Your hexagram" aria-live="polite" aria-atomic="true">
      <p>{card ? <><span>Hexagram {card.number}</span><span> of 64</span></> : 'Your hexagram'}</p>
      <h3 className={card ? `oracle-draw-rise-${picks % 2 ? 'a' : 'b'}` : 'is-placeholder'}>{card ? card.card_name : 'Your card appears here'}</h3>
      <p>{card ? card.iching.hexagram_name : lower ? 'Now choose the top half.' : 'Choose the bottom half first.'}</p>
      <button type="button" className="oracle-draw-primary" disabled={!card} onClick={() => card && onOpen(card.number)}>{card ? `Open card ${card.number}` : 'Open card'}</button>
    </div>
  </section>;
}
