import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { ALL_CARDS, CARD_BY_NUMBER, type OracleCard } from '../../../data/oracleData';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import { castFree, type CastResult } from '../../../utils/ichingCasting';
import { hexagramLineBooleans, TrigramSVG } from '../HexagramGlyph';
import './OracleDrawDialog.css';

// Read names and symbols from the same manuscripts as the deck. The sequence
// groups familiar natural images, rather than implying a hexagram number order.
const TRIGRAMS = ['☰', '☷', '☳', '☴', '☵', '☲', '☶', '☱'].map(symbol => {
  const trigram = ALL_CARDS.flatMap(card => [card.iching.lower_trigram, card.iching.upper_trigram])
    .find(trigram => trigram.symbol === symbol)!;
  return { symbol, name: trigram.name.replace(/\s*\(.*\)\s*$/, '').trim() };
});
type Trigram = typeof TRIGRAMS[number];
const plainTrigram = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim();

interface Props {
  theme: 'light' | 'dark';
  onClose: () => void;
  onOpen: (number: number, cast?: CastResult) => void;
}

export default function OracleDrawDialog({ theme, onClose, onOpen }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [mode, setMode] = useState<'trigrams' | 'coins'>('coins');
  const [lower, setLower] = useState<Trigram | null>(null);
  const [upper, setUpper] = useState<Trigram | null>(null);
  const [step, setStep] = useState<'lower' | 'upper'>('lower');
  const [cast, setCast] = useState<CastResult | null>(null);
  const [casting, setCasting] = useState(false);
  const castStarted = useRef(false);
  const castTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(castTimer.current), []);
  const throwCoins = () => {
    if (castStarted.current) return;
    castStarted.current = true;
    const result = castFree();
    const finish = () => { setCast(result); setCasting(false); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else { setCasting(true); castTimer.current = setTimeout(finish, 380); }
  };
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

  const card = mode === 'coins'
    ? cast && CARD_BY_NUMBER.get(cast.primaryNumber)
    : lower && upper && ALL_CARDS.find(card => card.iching.lower_trigram.symbol === lower.symbol && card.iching.upper_trigram.symbol === upper.symbol);
  const changed = mode === 'coins' && cast?.changedNumber ? CARD_BY_NUMBER.get(cast.changedNumber) : null;
  const selected = step === 'lower' ? lower : upper;
  const pick = useCallback((trigram: Trigram) => {
    if (step === 'lower') { setLower(trigram); setStep('upper'); }
    else setUpper(trigram);
  }, [step]);


  return <div className="oracle-draw-backdrop" onClick={onClose}>
    <div ref={panel} className="oracle-draw" data-theme={theme} data-method={mode} role="dialog" aria-modal="true" aria-labelledby="oracle-draw-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header className="oracle-draw-header">
        <h2 id="oracle-draw-title" className="oracle-draw-sr">Draw a card</h2>
      <div className="oracle-draw-tabs" role="tablist" aria-label="Drawing method">
        {(['coins', 'trigrams'] as const).map((method, index) => <button key={method} id={`draw-tab-${method}`} role="tab" type="button" aria-selected={mode === method} aria-controls="draw-method" tabIndex={mode === method ? 0 : -1} onClick={() => setMode(method)} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 'coins' : event.key === 'End' ? 'trigrams' : index === 0 ? 'trigrams' : 'coins';
            setMode(next);
            document.getElementById(`draw-tab-${next}`)?.focus();
          }
        }}>{method === 'trigrams' ? 'Choose trigrams' : 'Cast coins'}</button>)}
      </div>
        <button className="oracle-draw-close" type="button" aria-label="Close draw a card" onClick={onClose}><X size={20} /></button>
      </header>
      <p className="oracle-draw-sr" role="status" aria-live="polite" aria-atomic="true">{casting ? 'Casting the coins.' : mode === 'coins' && cast && card ? `Currently at Hexagram ${card.number}, ${card.card_name}.${changed ? ` Moving to Hexagram ${changed.number}, ${changed.card_name}.` : ' Begin with this card as it stands.'}` : lower ? `Lower trigram: ${lower.name}. ${upper ? `Upper trigram: ${upper.name}. Your hexagram is ready.` : 'Choose the upper trigram.'}` : ''}</p>
      <div id="draw-method" role="tabpanel" aria-labelledby={`draw-tab-${mode}`} className={`oracle-draw-body ${mode === 'coins' ? 'oracle-draw-coin-mode' : ''}`}>
        {(mode === 'trigrams' || !cast) && <section className="oracle-draw-controls">
          {mode === 'trigrams' ? <>
            <div className="oracle-draw-steps" aria-label="Selection order">
              <button type="button" aria-current={step === 'lower' ? 'step' : undefined} onClick={() => setStep('lower')}><span>1 · Lower</span><strong>{lower?.name ?? 'Choose first'}</strong></button>
              <button type="button" disabled={!lower} aria-current={step === 'upper' ? 'step' : undefined} onClick={() => setStep('upper')}><span>2 · Upper</span><strong>{upper?.name ?? 'Choose next'}</strong></button>
            </div>
            <h3>{step === 'lower' ? 'Choose the lower trigram' : 'Choose the upper trigram'}</h3>
            <p className="oracle-draw-help">Pick the bottom three lines, then the top.</p>
            <div className="oracle-draw-trigrams" role="group" aria-label={`${step === 'lower' ? 'Lower' : 'Upper'} trigram choices`}>
              <span className="oracle-draw-wheel-center" aria-hidden="true">{step === 'lower' ? 'Lower' : 'Upper'}</span>
              {TRIGRAMS.map((trigram, index) => <button key={trigram.symbol} type="button" style={{ left: `${50 + 37 * Math.sin(index * Math.PI / 4)}%`, top: `${50 - 37 * Math.cos(index * Math.PI / 4)}%` }} aria-label={trigram.name} aria-pressed={selected?.symbol === trigram.symbol} onClick={() => pick(trigram)}>
                <TrigramSVG symbol={trigram.symbol} width={38} height={25} />
                <span>{trigram.name}</span>
                {selected?.symbol === trigram.symbol && <Check className="oracle-draw-selected" size={12} aria-hidden="true" />}
              </button>)}
            </div>
          </> : <>
            <h3>Let the coins choose</h3>
            <p className="oracle-draw-help">Cast the coins to find a picture of your situation now and the direction it may be moving.</p>
            <button className={`oracle-draw-coin-control ${casting ? 'is-casting' : ''}`} type="button" aria-label="Cast the coins" disabled={casting} aria-busy={casting} onClick={throwCoins}>
              <span className="oracle-draw-coins" aria-hidden="true">{[0, 1, 2].map(n => <span key={n} style={{ animationDelay: `${n * 35}ms` }}>
                <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
                  <circle cx="23" cy="23" r="22" stroke="currentColor" />
                  <circle cx="23" cy="23" r="17" stroke="currentColor" opacity=".55" />
                  <rect x="17.5" y="17.5" width="11" height="11" stroke="currentColor" />
                </svg>
              </span>)}</span>
              <span className="oracle-draw-cast">{casting ? 'Casting…' : 'Cast the coins'}</span>
            </button>
          </>}
        </section>}
        {mode === 'coins' && cast && card && <DrawCastResult card={card} changed={changed || null} cast={cast} onOpen={onOpen} />}
        {mode === 'trigrams' && <section className="oracle-draw-preview" aria-label="Your hexagram" aria-live="polite" aria-atomic="true">
          <TrigramSelection upper={upper} lower={lower} onEdit={setStep} />
          <div className="oracle-draw-result">
            <p>{card ? `Hexagram ${card.number}` : 'Your hexagram'}</p>
            <h3 className={card ? undefined : 'is-placeholder'}>{card ? card.card_name : 'Your card appears here'}</h3>
            <p>{card ? card.iching.hexagram_name : lower ? 'Now choose the top three lines.' : 'Choose the bottom three lines first.'}</p>
            <button type="button" className="oracle-draw-open" disabled={!card} onClick={() => card && onOpen(card.number)}>Open card {card?.number}<ArrowRight size={17} aria-hidden="true" /></button>
          </div>
        </section>}
      </div>
    </div>
  </div>;
}

function DrawCastResult({ card, changed, cast, onOpen }: { card: OracleCard; changed: OracleCard | null; cast: CastResult; onOpen: Props['onOpen'] }) {
  const upperChanges = changed && card.iching.upper_trigram.symbol !== changed.iching.upper_trigram.symbol;
  const lowerChanges = changed && card.iching.lower_trigram.symbol !== changed.iching.lower_trigram.symbol;
  const describe = (side: 'upper' | 'lower') => `${plainTrigram(card.iching[`${side}_trigram`].name)} becomes ${plainTrigram(changed!.iching[`${side}_trigram`].name)} ${side === 'upper' ? 'above' : 'below'}.`;
  const sameAboveAndBelow = upperChanges && lowerChanges && card.iching.upper_trigram.symbol === card.iching.lower_trigram.symbol && changed!.iching.upper_trigram.symbol === changed!.iching.lower_trigram.symbol;
  const description = sameAboveAndBelow ? `${plainTrigram(card.iching.upper_trigram.name)} becomes ${plainTrigram(changed!.iching.upper_trigram.name)} above and below.` : changed ? [upperChanges && describe('upper'), lowerChanges && describe('lower')].filter(Boolean).join(' ') : 'Read this card as a whole.';
  return <section className="oracle-draw-cast-result" aria-label="Your hexagram" tabIndex={-1}>
    <div className={`oracle-draw-pair ${changed ? '' : 'is-still'}`}>
      <CastFigure card={card} cast={cast} onOpen={() => onOpen(card.number, cast)} label="Your throw" upperChanges={!!upperChanges} lowerChanges={!!lowerChanges} />
      {changed && <><ArrowRight className="oracle-draw-direction" size={20} aria-hidden="true" /><CastFigure card={changed} cast={cast} onOpen={() => onOpen(changed.number)} destination label="Changes to" upperChanges={!!upperChanges} lowerChanges={!!lowerChanges} /></>}
    </div>
    <div className="oracle-draw-result-tools"><p>{description}</p></div>
    <p className="oracle-draw-reading-guide">{changed ? 'The I Ching follows the cycle of change: where you are now, and what may come next. The brighter lines show what is shifting.' : 'This figure reflects your situation now. Begin with this card and explore what it brings into view.'}</p>
  </section>;
}

function CastFigure({ card, cast, destination = false, label, upperChanges, lowerChanges, onOpen }: { card: OracleCard; cast: CastResult; destination?: boolean; label: string; upperChanges: boolean; lowerChanges: boolean; onOpen: () => void }) {
  return <figure className="oracle-draw-cast-figure" data-phase={destination ? 'next' : 'current'} aria-label={label}>
    <p className="oracle-draw-position">{destination ? 'Moving to' : 'Currently at'}</p>
    <p className="oracle-draw-hex-number">Hexagram {card.number}</p>
    <CastGlyph card={card} lines={cast.lines} destination={destination} />
    <figcaption>
      <p className="oracle-draw-elements"><span className={upperChanges ? 'does-change' : undefined}>{plainTrigram(card.iching.upper_trigram.name)}</span> over <span className={lowerChanges ? 'does-change' : undefined}>{plainTrigram(card.iching.lower_trigram.name)}</span></p>
      <h3>{card.card_name}</h3>
      <p className="oracle-draw-hex-name">{card.iching.hexagram_name}</p>
      <button type="button" className="oracle-draw-figure-open" aria-label={`Open card ${card.number}`} onClick={onOpen}>Open card <ArrowRight size={14} aria-hidden="true" /></button>
    </figcaption>
  </figure>;
}

function CastGlyph({ card, lines, destination }: { card: OracleCard; lines: CastResult['lines']; destination: boolean }) {
  const bits = hexagramLineBooleans(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol);
  return <svg className="oracle-draw-cast-glyph" width="88" height="90" viewBox="0 0 76 78" fill="currentColor" aria-hidden="true">
    {bits.map((yang, index) => {
      const moving = lines[5 - index].moving;
      const shape = (solid: boolean) => solid ? <rect x="0" y={index * 14} width="76" height="8" /> : <><rect x="0" y={index * 14} width="33" height="8" /><rect x="43" y={index * 14} width="33" height="8" /></>;
      return <g key={index} className={`oracle-draw-cast-line ${moving ? 'is-moving' : ''} ${destination ? 'is-destination' : ''}`} style={{ animationDelay: `${destination ? (moving ? 1050 : 850) : (5 - index) * 100}ms` }}>
        {moving && destination ? <><g className="oracle-draw-before">{shape(!yang)}</g><g className="oracle-draw-after">{shape(yang)}</g></> : shape(yang)}
      </g>;
    })}
  </svg>;
}

function TrigramSelection({ upper, lower, onEdit }: { upper: Trigram | null; lower: Trigram | null; onEdit: (step: 'lower' | 'upper') => void }) {
  const bits = hexagramLineBooleans(upper?.symbol ?? '☰', lower?.symbol ?? '☰');
  return <div className="oracle-draw-figure oracle-draw-selection" aria-label="Combined hexagram">
    <svg width="88" height="90" viewBox="0 0 76 78" fill="currentColor" aria-hidden="true">
      {bits.map((solid, index) => {
        const chosen = index < 3 ? upper : lower;
        return <g key={index} className={chosen ? 'is-chosen' : 'is-unfilled'}>{solid ? <rect x="0" y={index * 14} width="76" height="8" /> : <><rect x="0" y={index * 14} width="33" height="8" /><rect x="43" y={index * 14} width="33" height="8" /></>}</g>;
      })}
    </svg>
    {(['upper', 'lower'] as const).map(half => {
      const trigram = half === 'upper' ? upper : lower;
      return <div key={half} className={`oracle-draw-selection-half is-${half}`} aria-label={`${half === 'upper' ? 'Upper' : 'Lower'} trigram`}><button type="button" disabled={half === 'upper' && !lower} aria-label={`Edit ${half} trigram${trigram ? `, ${trigram.name}` : ''}`} onClick={() => onEdit(half)}><span className="oracle-draw-sr">{trigram?.name ?? 'Not chosen'}</span></button></div>;
    })}
  </div>;
}
