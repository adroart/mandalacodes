/**
 * cast_hexagram — the three-coin I-Ching cast. Pure and corpus-agnostic: it
 * needs only each code's number + reference.binary, so the same logic serves
 * the local MCP server and the hosted Function.
 *
 * Six lines bottom-to-top, each 6/7/8/9 by the three-coin method. 6 and 9 are
 * moving lines. The primary code is the cast pattern; the resulting code is the
 * pattern with moving lines flipped. Codes resolve from reference.binary, so no
 * separate King Wen table is needed.
 */

/** Minimal shape the cast needs from a corpus card. */
export interface BinaryCard {
  number: number;
  reference?: { binary?: string } | Record<string, unknown>;
}

export interface CastLine {
  position: number; // 1 (bottom) … 6 (top)
  value: 6 | 7 | 8 | 9;
  type: 'yin' | 'yang';
  moving: boolean;
}

export interface CastResult {
  lines: CastLine[];
  primary: { number: number | null; binary: string };
  resulting: { number: number | null; binary: string } | null;
  moving_positions: number[];
}

function tossLine(): CastLine['value'] {
  let sum = 0;
  for (let i = 0; i < 3; i++) sum += Math.random() < 0.5 ? 2 : 3;
  return sum as CastLine['value'];
}

function nowBit(v: number): '0' | '1' {
  return v === 7 || v === 9 ? '1' : '0';
}
function futureBit(v: number): '0' | '1' {
  if (v === 6) return '1'; // old yin → yang
  if (v === 9) return '0'; // old yang → yin
  return v === 7 ? '1' : '0';
}

export function castHexagram(corpus: BinaryCard[]): CastResult {
  const fwd = new Map<string, number>();
  const rev = new Map<string, number>();
  for (const c of corpus) {
    const b = (c.reference as { binary?: string } | undefined)?.binary;
    if (!b || b.length !== 6) continue;
    fwd.set(b, c.number);
    rev.set(b.split('').reverse().join(''), c.number);
  }
  const lookup = (bottomToTop: string): number | null =>
    fwd.get(bottomToTop) ?? rev.get(bottomToTop) ??
    fwd.get(bottomToTop.split('').reverse().join('')) ?? null;

  const lines: CastLine[] = [];
  for (let pos = 1; pos <= 6; pos++) {
    const value = tossLine();
    lines.push({
      position: pos,
      value,
      type: value === 7 || value === 9 ? 'yang' : 'yin',
      moving: value === 6 || value === 9,
    });
  }

  const nowBinary = lines.map((l) => nowBit(l.value)).join('');
  const moving = lines.filter((l) => l.moving).map((l) => l.position);

  let resulting: CastResult['resulting'] = null;
  if (moving.length > 0) {
    const futureBinary = lines.map((l) => futureBit(l.value)).join('');
    resulting = { number: lookup(futureBinary), binary: futureBinary };
  }

  return {
    lines,
    primary: { number: lookup(nowBinary), binary: nowBinary },
    resulting,
    moving_positions: moving,
  };
}
