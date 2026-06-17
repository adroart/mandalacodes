import React, { useMemo } from 'react';
import { CODON_RINGS, CARD_BY_NUMBER, type OracleCard } from '../../data/oracleData';
import { elementForCard, ELEMENT_DOT } from '../../lib/oracle/elements';

/* ─── Map view: the 64 codes as a codon-ring constellation ───────────────────
 * A star-wheel: cards laid out around a ring, grouped by codon ring, with faint
 * chords linking ring-siblings. Nodes are element-coloured; the visitor's grid
 * codes get a bronze halo. Search / element filters dim the rest.
 *
 * Pure SVG, scales fluidly. Tapping a star opens that card's reading. */

interface Props {
  /** Card numbers currently matching search/filter — others dim. Null = all lit. */
  matchSet: Set<number> | null;
  /** The visitor's profile codes — these get a bronze halo. */
  gridSet: Set<number> | null;
  onRead: (card: OracleCard) => void;
}

const CX = 360;
const CY = 360;
const R = 300;
const RING_GAP = 0.55; // angular padding between rings, in node-units

const Constellation: React.FC<Props> = ({ matchSet, gridSet, onRead }) => {
  const { chords, nodes } = useMemo(() => {
    // Lay every card around the wheel, grouped by ring with a gap between groups.
    const order: Array<{ n: number; ri: number }> = [];
    CODON_RINGS.forEach((ring, ri) => ring.cards.forEach((c) => order.push({ n: c.number, ri })));

    const units = order.length + CODON_RINGS.length * RING_GAP;
    const pos: Record<number, { x: number; y: number }> = {};
    let acc = 0;
    let last = order.length ? order[0].ri : 0;
    order.forEach((o) => {
      if (o.ri !== last) {
        acc += RING_GAP;
        last = o.ri;
      }
      const ang = (acc / units) * Math.PI * 2 - Math.PI / 2;
      pos[o.n] = { x: CX + Math.cos(ang) * R, y: CY + Math.sin(ang) * R };
      acc += 1;
    });

    // Chords link cards that share a codon ring.
    const chords: React.ReactNode[] = [];
    CODON_RINGS.forEach((ring, ri) => {
      const nums = ring.cards.map((c) => c.number);
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const a = pos[nums[i]];
          const b = pos[nums[j]];
          if (!a || !b) continue;
          const both = !matchSet || (matchSet.has(nums[i]) && matchSet.has(nums[j]));
          chords.push(
            <line
              key={`c${ri}-${i}-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={both ? 'rgba(138,116,78,0.22)' : 'rgba(138,116,78,0.05)'}
              strokeWidth={1}
            />,
          );
        }
      }
    });

    const nodes = order.map((o) => {
      const card = CARD_BY_NUMBER.get(o.n);
      const p = pos[o.n];
      if (!card || !p) return null;
      const dot = ELEMENT_DOT[elementForCard(o.n)];
      const inGrid = !!gridSet && gridSet.has(o.n);
      const dim = !!matchSet && !matchSet.has(o.n);
      const r = inGrid ? 8.5 : 6;
      return (
        <g
          key={`n${o.n}`}
          transform={`translate(${p.x},${p.y})`}
          style={{ cursor: 'pointer' }}
          opacity={dim ? 0.15 : 1}
          onClick={() => onRead(card)}
          role="button"
          tabIndex={-1}
          aria-label={`${o.n} · ${card.card_name}`}
        >
          <title>{`${o.n} · ${card.card_name}`}</title>
          {inGrid && <circle r={r + 4.5} fill="none" stroke="#8a744e" strokeWidth={1.5} />}
          <circle r={r} fill={dot} stroke="#f5f4f0" strokeWidth={1.5} />
        </g>
      );
    });

    return { chords, nodes };
  }, [matchSet, gridSet, onRead]);

  return (
    <svg
      viewBox="0 0 720 720"
      role="img"
      aria-label="Constellation of the sixty-four codes grouped by codon ring"
      className="block w-full h-auto max-w-[600px] mx-auto"
    >
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(138,116,78,0.12)" strokeWidth={1} />
      <g>{chords}</g>
      <g>{nodes}</g>
    </svg>
  );
};

export default Constellation;
