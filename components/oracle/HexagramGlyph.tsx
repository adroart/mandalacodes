import React from 'react';
import { CARD_BY_NUMBER } from '../../data/oracleData';

/* ─── Trigram / hexagram SVG — the one shared renderer ────────────────────
 * Pure vector, no Unicode emoji. Shared by the card page, the deck index,
 * ProfileGraph, YourPositionCallout, and the today/year energy panels —
 * no markup duplication, single visual language.
 *
 * Deliberately NOT migrated: OracleGateway (compressed orbital glyphs with
 * historical line ordering) and CoinCast's Hexagram (moving-line flip
 * animation). Both are specialized renderers with their own geometry.
 */

// lines = [top, middle, bottom], true = yang (solid), false = yin (broken)
const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  '☰': [true,  true,  true ],  // Qian / Heaven
  '☱': [false, true,  true ],  // Dui  / Lake
  '☲': [true,  false, true ],  // Li   / Fire
  '☳': [false, false, true ],  // Zhen / Thunder
  '☴': [true,  true,  false],  // Xun  / Wind
  '☵': [false, true,  false],  // Kan  / Water
  '☶': [true,  false, false],  // Gen  / Mountain
  '☷': [false, false, false],  // Kun  / Earth
};

export const TrigramSVG: React.FC<{
  symbol: string;
  color?: string;
  width?: number;
  height?: number;
}> = ({ symbol, color = 'currentColor', width = 64, height = 44 }) => {
  const lines = TRIGRAM_LINES[symbol];
  if (!lines) return null;
  const lh = Math.max(2, Math.round(height * 0.2));
  const gap = Math.round(width * 0.14);
  const hw = (width - gap) / 2;
  const yMid = Math.round((height - lh) / 2);
  const positions = [0, yMid, height - lh];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      {lines.map((solid, i) =>
        solid ? (
          <rect key={i} x={0} y={positions[i]} width={width} height={lh} rx={1} fill={color} />
        ) : (
          <React.Fragment key={i}>
            <rect x={0}        y={positions[i]} width={hw} height={lh} rx={1} fill={color} />
            <rect x={hw + gap} y={positions[i]} width={hw} height={lh} rx={1} fill={color} />
          </React.Fragment>
        )
      )}
    </svg>
  );
};

/**
 * Six hexagram lines in render order (top → bottom): upper trigram top-to-bottom,
 * then lower trigram top-to-bottom. true = yang (solid), false = yin (broken).
 * Shared by HexagramSVG and the card reading's I Ching glyph so a hexagram is
 * drawn from one source of truth. Unknown symbols fall back to all-yang.
 */
export function hexagramLineBooleans(upper: string, lower: string): boolean[] {
  return [
    ...(TRIGRAM_LINES[upper] ?? [true, true, true]),
    ...(TRIGRAM_LINES[lower] ?? [true, true, true]),
  ];
}

// Hexagram = 6 lines with uniform spacing (upper trigram lines 1–3, lower lines 4–6)
export const HexagramSVG: React.FC<{
  upper: string;
  lower: string;
  color?: string;
  width?: number;
  className?: string;
}> = ({ upper, lower, color = 'currentColor', width = 64, className }) => {
  const lh      = Math.max(2, Math.round(width * 0.1));
  const step    = Math.round(width * 0.18);
  const totalH  = lh + step * 5;
  const gap     = Math.round(width * 0.14);
  const hw      = (width - gap) / 2;

  const allLines = hexagramLineBooleans(upper, lower);

  return (
    <svg
      width={width}
      height={totalH}
      viewBox={`0 0 ${width} ${totalH}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {allLines.map((solid, i) => {
        const y = i * step;
        return solid ? (
          <rect key={i} x={0} y={y} width={width} height={lh} rx={1} fill={color} />
        ) : (
          <React.Fragment key={i}>
            <rect x={0}        y={y} width={hw} height={lh} rx={1} fill={color} />
            <rect x={hw + gap} y={y} width={hw} height={lh} rx={1} fill={color} />
          </React.Fragment>
        );
      })}
    </svg>
  );
};

interface Props {
  /** Gate number 1..64; used to look up the hexagram via CARD_BY_NUMBER. */
  gate: number;
  color?: string;
  width?: number;
  className?: string;
}

/**
 * Hexagram glyph for a given gate number. Looks the gate up in the oracle
 * data to find its upper/lower trigrams, then renders the six lines.
 */
const HexagramGlyph: React.FC<Props> = ({
  gate,
  color = 'currentColor',
  width = 32,
  className,
}) => {
  const card = CARD_BY_NUMBER.get(gate);
  if (!card) return null;
  return (
    <HexagramSVG
      upper={card.iching.upper_trigram.symbol}
      lower={card.iching.lower_trigram.symbol}
      color={color}
      width={width}
      className={className}
    />
  );
};

export default HexagramGlyph;
