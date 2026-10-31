import React, { useRef, useState } from 'react';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import { UL_CARD_HERO_SIZES, ulCardHeroImageUrl, ulCardHeroSrcset } from '../../../utils/universalLanguage';
import { hexagramLineBooleans } from '../HexagramGlyph';
import './card-artwork.css';

/** A source-keyed image boundary: the plate stays hidden until decode succeeds. */
export default function CardArtwork({ cardNumber }: { cardNumber: number }) {
  return <ArtworkRequest key={cardNumber} cardNumber={cardNumber} />;
}

function ArtworkRequest({ cardNumber }: { cardNumber: number }) {
  const card = CARD_BY_NUMBER.get(cardNumber)!;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const lines = hexagramLineBooleans(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol);
  const reveal = async (element: HTMLImageElement) => {
    try {
      await element.decode();
      if (image.current === element) setState('ready');
    } catch {
      if (image.current === element) setState('error');
    }
  };
  return (
    <div className="card-artwork" data-state={state} aria-busy={state === 'loading'}>
      <img
        key={attempt}
        ref={image}
        src={ulCardHeroImageUrl(cardNumber)}
        srcSet={ulCardHeroSrcset(cardNumber)}
        sizes={UL_CARD_HERO_SIZES}
        alt={`${card.card_name} · Code ${cardNumber}`}
        crossOrigin="anonymous"
        decoding="async"
        loading="eager"
        onLoad={event => void reveal(event.currentTarget)}
        onError={() => setState('error')}
      />
      {state !== 'ready' && (
        <div className="card-artwork__waiting" role="status" aria-live="polite">
          <svg className="card-artwork__sigil" viewBox="0 0 200 200" fill="none" aria-hidden="true">
            <circle className="card-artwork__track" cx="100" cy="100" r="88" />
            <g className="card-artwork__orbit">
              <circle cx="100" cy="100" r="88" pathLength="100" strokeDasharray="28 72" />
              <circle cx="100" cy="12" r="3" className="card-artwork__point" />
            </g>
            {lines.map((solid, i) => (
              <g key={i} className="card-artwork__line" data-solid={solid} style={{ '--line': 5 - i } as React.CSSProperties}>
                {solid ? <rect x="62" y={63 + i * 14} width="76" height="7" rx="1" /> : <>
                  <rect x="62" y={63 + i * 14} width="31" height="7" rx="1" />
                  <rect x="107" y={63 + i * 14} width="31" height="7" rx="1" />
                </>}
              </g>
            ))}
          </svg>
          <span className="card-artwork__code">Code {cardNumber} · {card.card_name}</span>
          <span className="card-artwork__message">{state === 'error' ? 'Artwork could not load.' : 'Revealing the artwork…'}</span>
          {state === 'error' && <button type="button" onClick={() => { setState('loading'); setAttempt(value => value + 1); }}>Try again</button>}
        </div>
      )}
    </div>
  );
}
