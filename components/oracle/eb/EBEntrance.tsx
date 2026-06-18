import React, { useEffect, useRef, useState } from 'react';
import type { OracleCard } from '../../../data/oracleData';
import { bitsForCard } from '../../../utils/ichingCasting';
import { SERIF, SANS } from './ebStyle';

/* Earth's Breath entrance ritual — a faithful copy of the template's entrance:
   the card title above, a ring of all 64 hexagram glyphs that blooms in and
   slowly spins, the card's own hexagram drawn line-by-line at the centre with
   the keywords beneath, and "tap to begin" below. Tap anywhere to enter. */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* The encircling ring of 64 hexagrams (buildRing in the template). */
const Ring: React.FC<{ currentBits: boolean[]; motionOn: boolean }> = ({ currentBits, motionOn }) => {
  const CX = 550, CY = 550, R = 452, HEXW = 34, lineH = 4.5, gap = 2.4, brokenGap = 8;
  const HEXH = 5 * (lineH + gap) + lineH;
  const half = (HEXW - brokenGap) / 2;
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 64; i++) {
    const ang = (i / 64) * 2 * Math.PI - Math.PI / 2;
    const x = CX + Math.cos(ang) * R, y = CY + Math.sin(ang) * R;
    const rot = (i / 64) * 360 + 180;
    const current = i === 0;
    const lines: boolean[] = [];
    for (let li = 0; li < 6; li++) lines.push(current ? (currentBits[li] ?? true) : (((i >> li) & 1) === 1));
    const fill = current ? 'var(--accent)' : 'var(--l-3)';
    const op = current ? 0.95 : 0.3;
    const lineEls = lines.map((solid, li) => {
      const ly = li * (lineH + gap);
      if (solid) return <rect key={li} x={0} y={ly} width={HEXW} height={lineH} fill={fill} opacity={op} />;
      return (
        <g key={li}>
          <rect x={0} y={ly} width={half} height={lineH} fill={fill} opacity={op} />
          <rect x={half + brokenGap} y={ly} width={half} height={lineH} fill={fill} opacity={op} />
        </g>
      );
    });
    items.push(
      <g key={i} transform={`translate(${x},${y}) rotate(${rot}) translate(${-HEXW / 2},${-HEXH / 2})`}>{lineEls}</g>
    );
  }
  return (
    <svg viewBox="0 0 1100 1100" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: motionOn ? 'ulRingBloom 1400ms cubic-bezier(.16,1,.3,1) both' : 'none' }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--l-rule)" strokeWidth={1} />
      <g style={{ transformOrigin: '550px 550px', animation: motionOn ? 'ulRingSpin 120s linear infinite' : 'none' }}>{items}</g>
    </svg>
  );
};

/* The card's own hexagram, drawn line-by-line (buildCenter in the template). */
const CenterHex: React.FC<{ bits: boolean[]; motionOn: boolean }> = ({ bits, motionOn }) => {
  const lineH = 4.5, gap = 2.4, HEXW = 72, brokenGap = 8;
  const half = (HEXW - brokenGap) / 2;
  // template draws 6 solid bars 72×9 stacked; we honour the card's yin/yang.
  return (
    <svg width={80} height={92} viewBox="0 0 80 92" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => {
        const y = i * 13;
        const solid = bits[5 - i] ?? true; // top row = line 6
        const anim = motionOn ? `ulDraw 280ms ease-out ${560 + i * 110}ms both` : 'none';
        const common = { fill: 'var(--l-1)', height: 9, style: { transformBox: 'fill-box' as const, transformOrigin: 'left center', animation: anim } };
        if (solid) return <rect key={i} x={4} y={y} width={72} {...common} />;
        return (
          <g key={i}>
            <rect x={4} y={y} width={half} {...common} />
            <rect x={4 + half + brokenGap} y={y} width={half} {...common} />
          </g>
        );
      })}
    </svg>
  );
};

export const EBEntrance: React.FC<{ card: OracleCard; keywords: string[]; palette?: string; onDone: () => void }> = ({ card, keywords, palette = 'daybook', onDone }) => {
  const motionOn = !prefersReducedMotion();
  const bits = bitsForCard(card.number) ?? [true, true, true, true, true, true];
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onDone, motionOn ? 420 : 0);
  };

  // Auto-dismiss after the ritual has played, matching the template's feel.
  useEffect(() => {
    const t = setTimeout(dismiss, 5200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className="eb-entrance"
      data-palette={palette}
      onClick={dismiss}
      role="dialog" aria-modal="true" aria-label="Card entrance. Tap to begin."
      style={{
        position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: 'var(--l-bg)', cursor: 'pointer',
        overflow: 'hidden', userSelect: 'none',
        animation: closing && motionOn ? 'ulFadeIn 380ms ease reverse both' : undefined,
        opacity: closing && !motionOn ? 0 : 1,
      }}
    >
      <p style={{ position: 'absolute', left: 0, right: 0, top: 'max(40px,env(safe-area-inset-top))', textAlign: 'center', padding: '0 24px', fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(38px,8vw,68px)', color: 'var(--l-1)', letterSpacing: '-0.01em', lineHeight: 1.04, margin: 0, animation: motionOn ? 'ulRise 1000ms cubic-bezier(.16,1,.3,1) 260ms both' : 'none' }}>{card.card_name}</p>

      <div style={{ position: 'relative', width: 'min(64vh,540px)', height: 'min(64vh,540px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Ring currentBits={bits} motionOn={motionOn} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center', padding: '0 24px' }}>
          <CenterHex bits={bits} motionOn={motionOn} />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            {keywords.map((kw, i) => (
              <li key={i} style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: 'var(--l-2)', lineHeight: 1.3, letterSpacing: '0.02em', animation: motionOn ? `ulRise 760ms cubic-bezier(.16,1,.3,1) ${900 + i * 90}ms both` : 'none' }}>{kw}</li>
            ))}
          </ul>
        </div>
      </div>

      <p style={{ position: 'absolute', left: 0, right: 0, bottom: 'max(34px,env(safe-area-inset-bottom))', textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(19px,2.4vw,24px)', color: 'var(--l-3)', margin: 0, animation: motionOn ? 'ulPulse 3.4s ease-in-out 1.8s infinite' : 'none' }}>tap to begin</p>
    </div>
  );
};

export default EBEntrance;
