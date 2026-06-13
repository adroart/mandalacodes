import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PROFILE_POSITIONS,
  PROFILE_CHANNELS,
  POSITIONS_BY_KEY,
  SEQUENCE_LABEL,
} from '../../data/profilePositions';
import type {
  HologeneticProfile,
  ProfileKey,
  ProfileSequence,
} from '../../lib/astrology/types';
import { CARD_BY_NUMBER } from '../../data/oracleData';

interface Props {
  profile: HologeneticProfile;
}

/** Per-sequence orb colour (green = Activation, red = Venus, blue = Pearl),
 *  saturated to read on both the light paper and dark backgrounds. */
const SEQUENCE_COLOR: Record<ProfileSequence, { core: string; edge: string }> = {
  activation: { core: '#3f8f4e', edge: '#1f5a2c' },
  venus: { core: '#c0392b', edge: '#7e1f17' },
  pearl: { core: '#3f7fb5', edge: '#27557e' },
};

const VIEW = 720;     // square viewBox base
const R = 22;         // orb radius in viewBox units

type Filter = ProfileSequence | 'all';

const ProfileGraph: React.FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  // selected = the pinned sphere whose card is open (click). hovered = a
  // transient highlight (mouse/keyboard). filter = which sequence is focused.
  const [selected, setSelected] = useState<ProfileKey | null>(null);
  const [hovered, setHovered] = useState<ProfileKey | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Dismiss the card on Escape or a click outside the chart/card.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.pg__orb') && !t.closest('.pg__card') && !t.closest('.pg__rail-row')) {
        setSelected(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [selected]);

  const pos = (k: ProfileKey) => {
    const m = POSITIONS_BY_KEY[k];
    return { x: m.x * VIEW, y: m.y * VIEW };
  };

  const SEQ_ORDER: ProfileSequence[] = ['activation', 'venus', 'pearl'];
  const sequencesOf = (k: ProfileKey): ProfileSequence[] => {
    const set = new Set<ProfileSequence>([POSITIONS_BY_KEY[k].sequence]);
    for (const ch of PROFILE_CHANNELS) {
      if (ch.from === k || ch.to === k) set.add(ch.sequence);
    }
    return SEQ_ORDER.filter((s) => set.has(s));
  };

  // What is highlighted: the filter wins if set; else the hovered/selected
  // sphere's sequence.
  const focusKey = hovered ?? selected;
  const activeSequence: ProfileSequence | null =
    filter !== 'all' ? filter : focusKey ? POSITIONS_BY_KEY[focusKey].sequence : null;
  const seqActive = (seq: ProfileSequence) => activeSequence === seq;
  const hasFocus = filter !== 'all' || focusKey != null;

  const open = (k: ProfileKey) => setSelected((c) => (c === k ? null : k));
  const goCard = (k: ProfileKey) => navigate(`/universal-language/${profile[k].gate}`);

  // Card placement: anchored to the selected sphere, flipped to whichever
  // side has room. Positions are in % of the chart box (viewBox 0..1-ish).
  const cardSide = selected ? (POSITIONS_BY_KEY[selected].x < 0.5 ? 'right' : 'left') : 'right';

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'activation', label: 'Activation' },
    { key: 'venus', label: 'Venus' },
    { key: 'pearl', label: 'Pearl' },
  ];

  return (
    <div className="pg" ref={wrapRef}>
      {/* ── Top bar: sequence filter ─────────────────────────────────── */}
      <div className="pg__topbar">
        <div className="pg__filter" role="group" aria-label="Focus a sequence">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`pg__filter-btn${filter === f.key ? ' is-on' : ''}`}
              style={f.key !== 'all' ? { ['--c' as string]: SEQUENCE_COLOR[f.key as ProfileSequence].edge } : undefined}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Workspace: rail + canvas ─────────────────────────────────── */}
      <div className="pg__work">
        {/* Left rail: the 11 spheres + legend */}
        <aside className="pg__rail">
          <div className="pg__rail-title">The Path</div>
          <ul className="pg__rail-list">
            {PROFILE_POSITIONS.map((meta) => {
              const gl = profile[meta.key];
              if (!gl) return null;
              const seqs = sequencesOf(meta.key);
              const dot = seqs.length >= 2
                ? `linear-gradient(90deg, ${SEQUENCE_COLOR[seqs[0]].edge} 0 50%, ${SEQUENCE_COLOR[seqs[1]].edge} 50% 100%)`
                : SEQUENCE_COLOR[meta.sequence].edge;
              const on = selected === meta.key || hovered === meta.key;
              return (
                <li key={meta.key}>
                  <button
                    className={`pg__rail-row${on ? ' is-on' : ''}`}
                    onClick={() => open(meta.key)}
                    onMouseEnter={() => setHovered(meta.key)}
                    onMouseLeave={() => setHovered((c) => (c === meta.key ? null : c))}
                  >
                    <span className="pg__rail-dot" style={{ background: dot }} />
                    <span className="pg__rail-name">{meta.label}</span>
                    <span className="pg__rail-gate">{gl.gate}.{gl.line}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="pg__legend">
            <span><i style={{ background: SEQUENCE_COLOR.activation.core }} />Activation</span>
            <span><i style={{ background: SEQUENCE_COLOR.venus.core }} />Venus</span>
            <span><i style={{ background: SEQUENCE_COLOR.pearl.core }} />Pearl</span>
            <span><i className="pg__legend-split" />shared</span>
          </div>
        </aside>

        {/* Canvas: the mandala fills the centre */}
        <div className={`pg__canvas${hasFocus ? ' has-focus' : ''}`}>
          <svg viewBox={`-70 8 860 660`} className="pg__svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              {SEQ_ORDER.map((seq) => (
                <radialGradient key={seq} id={`orb-${seq}`} cx="38%" cy="32%" r="75%">
                  <stop offset="0%" stopColor={SEQUENCE_COLOR[seq].core} />
                  <stop offset="100%" stopColor={SEQUENCE_COLOR[seq].edge} />
                </radialGradient>
              ))}
              {([['activation','venus'],['activation','pearl'],['venus','pearl']] as const).map(([a,b]) => (
                <linearGradient key={`${a}-${b}`} id={`split-${a}-${b}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={SEQUENCE_COLOR[a].core} />
                  <stop offset="50%" stopColor={SEQUENCE_COLOR[a].edge} />
                  <stop offset="50%" stopColor={SEQUENCE_COLOR[b].edge} />
                  <stop offset="100%" stopColor={SEQUENCE_COLOR[b].core} />
                </linearGradient>
              ))}
              {SEQ_ORDER.map((seq) => (
                <React.Fragment key={seq}>
                  <marker id={`arrow-${seq}`} viewBox="0 0 8.66 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                    <path d="M0,0 L8.66,5 L0,10 z" fill={SEQUENCE_COLOR[seq].edge} />
                  </marker>
                  <marker id={`arrow-${seq}-lit`} viewBox="0 0 8.66 10" refX="8" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                    <path d="M0,0 L8.66,5 L0,10 z" fill={SEQUENCE_COLOR[seq].edge} />
                  </marker>
                </React.Fragment>
              ))}
            </defs>

            {/* Channels */}
            <g>
              {PROFILE_CHANNELS.map((ch, i) => {
                const pa = pos(ch.from), pb = pos(ch.to);
                const lit = seqActive(ch.sequence);
                const dx = pb.x - pa.x, dy = pb.y - pa.y;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len, uy = dy / len;
                return (
                  <line
                    key={i}
                    x1={pa.x + ux * (R + 2)} y1={pa.y + uy * (R + 2)}
                    x2={pb.x - ux * (R + 9)} y2={pb.y - uy * (R + 9)}
                    stroke={SEQUENCE_COLOR[ch.sequence].edge}
                    markerEnd={`url(#arrow-${ch.sequence}${lit ? '-lit' : ''})`}
                    className={`pg__channel${lit ? ' is-lit' : ''}`}
                  />
                );
              })}
            </g>

            {/* Spheres */}
            {PROFILE_POSITIONS.map((meta) => {
              const gl = profile[meta.key];
              if (!gl) return null;
              const card = CARD_BY_NUMBER.get(gl.gate);
              const p = pos(meta.key);
              const isSel = selected === meta.key;
              const seqs = sequencesOf(meta.key);
              const inSeq = activeSequence != null && seqs.includes(activeSequence);
              const orbFill = seqs.length >= 2 ? `url(#split-${seqs[0]}-${seqs[1]})` : `url(#orb-${meta.sequence})`;

              const W = 150, H = 30, pad = R + 16;
              let lx = p.x - W / 2, ly = p.y - H / 2; let align = 'is-center';
              if (meta.labelSide === 'left')   { lx = p.x - pad - W; align = 'is-right'; }
              if (meta.labelSide === 'right')  { lx = p.x + pad;     align = 'is-left'; }
              if (meta.labelSide === 'top')    { ly = p.y - pad - H; align = 'is-center'; }
              if (meta.labelSide === 'bottom') { ly = p.y + pad;     align = 'is-center'; }

              return (
                <g key={meta.key} className={`pg__node${isSel ? ' is-sel' : ''}${inSeq ? ' in-seq' : ''}`}>
                  <foreignObject x={lx} y={ly} width={W} height={H} className="pg__label-fo">
                    <div className={`pg__label ${align}`}><span className="pg__name">{meta.label}</span></div>
                  </foreignObject>
                  <g
                    transform={`translate(${p.x} ${p.y})`}
                    className="pg__orb"
                    tabIndex={0}
                    role="button"
                    aria-label={`${meta.label}, gate ${gl.gate} line ${gl.line}, ${card?.card_name ?? ''}`}
                    onMouseEnter={() => setHovered(meta.key)}
                    onMouseLeave={() => setHovered((c) => (c === meta.key ? null : c))}
                    onFocus={() => setHovered(meta.key)}
                    onBlur={() => setHovered((c) => (c === meta.key ? null : c))}
                    onClick={() => open(meta.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(meta.key); } }}
                  >
                    <circle r={R + 4} className="pg__ring" />
                    <circle r={R} fill={orbFill} className="pg__circle" />
                    <text className="pg__gate" y={5}>{gl.gate}.{gl.line}</text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Anchored card: opens beside the selected sphere */}
          {selected && (() => {
            const meta = POSITIONS_BY_KEY[selected];
            const gl = profile[selected];
            const card = gl ? CARD_BY_NUMBER.get(gl.gate) : undefined;
            // position in % of the canvas box, from the orb's normalized x/y
            const topPct = `${meta.y * 100}%`;
            const style: React.CSSProperties = cardSide === 'right'
              ? { left: `${meta.x * 100}%`, top: topPct, marginLeft: 36 }
              : { right: `${(1 - meta.x) * 100}%`, top: topPct, marginRight: 36 };
            return (
              <div className={`pg__card pg__card--${cardSide}`} style={style} role="dialog" aria-label={`${meta.label} detail`}>
                <button className="pg__card-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
                <div className="pg__card-seq">{SEQUENCE_LABEL[meta.sequence]}</div>
                <div className="pg__card-head">
                  <span className="pg__card-name">{meta.label}</span>
                  {gl && <span className="pg__card-gate">{gl.gate}.{gl.line}</span>}
                </div>
                {card && <div className="pg__card-art">{card.card_name}</div>}
                {card?.gene_keys?.gift && (
                  <div className="pg__card-triad">
                    <span className="pg__gk pg__gk--siddhi">{card.gene_keys.siddhi}</span>
                    <span className="pg__gk pg__gk--gift">{card.gene_keys.gift}</span>
                    <span className="pg__gk pg__gk--shadow">{card.gene_keys.shadow}</span>
                  </div>
                )}
                <p className="pg__card-role">{meta.role}</p>
                <button className="pg__card-open" onClick={() => goCard(selected)}>Open the card →</button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Mobile fallback: grouped list ────────────────────────────── */}
      <div className="pg__list-view">
        {SEQ_ORDER.map((seq) => (
          <section key={seq} className="pg__band">
            <h2 className="pg__band-label">{SEQUENCE_LABEL[seq]}</h2>
            <ul className="pg__list">
              {PROFILE_POSITIONS.filter((p) => p.sequence === seq).map((meta) => {
                const gl = profile[meta.key];
                if (!gl) return null;
                const card = CARD_BY_NUMBER.get(gl.gate);
                return (
                  <li key={meta.key}>
                    <a href={`/universal-language/${gl.gate}`} className="pg__row">
                      <span className="pg__row-dot" style={{ background: SEQUENCE_COLOR[meta.sequence].edge }} aria-hidden />
                      <div className="pg__row-text">
                        <div className="pg__row-label">
                          <span className="pg__row-name">{meta.label}</span>
                          <span className="pg__row-gate">{gl.gate}.{gl.line}</span>
                        </div>
                        <div className="pg__row-art">{card ? card.card_name : `Gate ${gl.gate}`}</div>
                        {card?.gene_keys?.gift && (
                          <div className="pg__row-triad">
                            <span className="pg__gk pg__gk--siddhi">{card.gene_keys.siddhi}</span>
                            <span className="pg__gk pg__gk--gift">{card.gene_keys.gift}</span>
                            <span className="pg__gk pg__gk--shadow">{card.gene_keys.shadow}</span>
                          </div>
                        )}
                        <p className="pg__row-role">{meta.role}</p>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <style>{`
        .pg { display: block; }

        /* ── top bar ── */
        .pg__topbar { display: none; }
        .pg__filter { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid color-mix(in oklab, var(--color-wood-600) 16%, transparent); border-radius: 999px; }
        .pg__filter-btn {
          font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
          padding: 7px 16px; border: 0; border-radius: 999px; background: transparent; color: var(--color-wood-700); cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .pg__filter-btn:hover { color: var(--color-wood-900); }
        .pg__filter-btn.is-on { background: var(--c, var(--color-bronze-600)); color: var(--color-paper-50); }

        /* ── orbs / channels (shared by desktop canvas) ── */
        .pg__channel { stroke-width: 1.5; opacity: 0.5; transition: opacity 0.3s, stroke-width 0.3s; }
        .pg__channel.is-lit { opacity: 1; stroke-width: 3; }
        .pg__canvas.has-focus .pg__channel:not(.is-lit) { opacity: 0.22; }
        .pg__orb { cursor: pointer; outline: none; }
        .pg__node { transition: opacity 0.25s; }
        .pg__canvas.has-focus .pg__node:not(.in-seq) { opacity: 0.7; }
        .pg__ring { fill: none; stroke: color-mix(in oklab, var(--color-wood-600) 22%, transparent); stroke-width: 1; transition: stroke 0.25s; }
        .pg__circle { transition: filter 0.25s; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.18)); }
        .pg__node.in-seq .pg__circle { filter: drop-shadow(0 0 10px color-mix(in oklab, var(--color-bronze-400) 55%, transparent)); }
        .pg__node.is-sel .pg__circle { filter: drop-shadow(0 0 16px color-mix(in oklab, var(--color-bronze-400) 85%, transparent)); }
        .pg__node.is-sel .pg__ring { stroke: var(--color-bronze-500); stroke-width: 2; }
        .pg__orb:focus-visible .pg__ring { stroke: var(--color-bronze-400); stroke-width: 2.5; }
        .pg__gate { fill: var(--color-paper-50); font-family: 'Lato', Helvetica, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-anchor: middle; pointer-events: none; }
        .pg__label-fo { overflow: visible; pointer-events: none; }
        .pg__label { display: flex; height: 100%; justify-content: center; }
        .pg__label.is-left { justify-content: flex-start; }
        .pg__label.is-right { justify-content: flex-end; }
        .pg__name { display: inline-block; font-family: 'Cormorant Garamond', serif; font-size: 19px; font-weight: 600; line-height: 1.15; color: var(--color-wood-900); background: color-mix(in oklab, var(--color-paper-50) 88%, transparent); padding: 2px 9px; border-radius: 5px; white-space: nowrap; }
        .pg__node.is-sel .pg__name { color: var(--color-bronze-700, var(--color-bronze-600)); }

        .pg__gk--siddhi { color: var(--color-bronze-600); }
        .pg__gk--gift   { color: var(--color-wood-800); }
        .pg__gk--shadow { color: color-mix(in oklab, #a04a32 80%, var(--color-wood-700)); }

        /* ── desktop workspace ── */
        .pg__work { display: none; }
        .pg__svg { width: 100%; height: auto; overflow: visible; }

        @media (min-width: 880px) {
          .pg__topbar { display: flex; justify-content: center; margin-bottom: 20px; }
          .pg__work {
            display: grid;
            grid-template-columns: 220px minmax(0, 1fr);
            gap: 32px;
            align-items: center;
            max-width: 1500px;
            margin: 0 auto;
          }
          .pg__list-view { display: none; }

          .pg__rail { align-self: start; padding-top: 10px; }
          .pg__rail-title { font-family: Cinzel, Palatino, serif; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--color-bronze-600); margin-bottom: 14px; }
          .pg__rail-list { list-style: none; margin: 0 0 22px; padding: 0; display: flex; flex-direction: column; gap: 1px; }
          .pg__rail-row {
            display: flex; align-items: baseline; gap: 10px; width: 100%;
            padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; text-align: left;
            transition: background 0.18s;
          }
          .pg__rail-row:hover, .pg__rail-row.is-on { background: color-mix(in oklab, var(--color-bronze-400) 12%, transparent); }
          .pg__rail-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; align-self: center; }
          .pg__rail-name { font-family: 'Cormorant Garamond', serif; font-size: 17px; color: var(--color-wood-900); flex: 1; }
          .pg__rail-gate { font-family: 'Lato', Helvetica, sans-serif; font-size: 10px; letter-spacing: 0.12em; color: var(--color-bronze-600); }
          .pg__legend { display: flex; flex-direction: column; gap: 8px; padding-top: 18px; border-top: 1px solid color-mix(in oklab, var(--color-wood-600) 14%, transparent); }
          .pg__legend span { display: flex; align-items: center; gap: 9px; font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.08em; color: var(--color-wood-700); }
          .pg__legend i { width: 12px; height: 12px; border-radius: 50%; flex: none; }
          .pg__legend-split { background: linear-gradient(90deg, #3f8f4e 0 50%, #3f7fb5 50% 100%); }

          .pg__canvas { position: relative; }

          /* anchored card */
          .pg__card {
            position: absolute; z-index: 20; width: 270px; transform: translateY(-50%);
            background: var(--color-paper-50);
            border: 1px solid color-mix(in oklab, var(--color-wood-600) 22%, transparent);
            border-radius: 10px; padding: 20px 22px;
            box-shadow: 0 18px 50px -12px rgba(0,0,0,0.4);
          }
          .pg__card-close { position: absolute; top: 8px; right: 12px; border: 0; background: transparent; font-size: 20px; line-height: 1; color: var(--color-wood-600); cursor: pointer; }
          .pg__card-close:hover { color: var(--color-wood-900); }
          .pg__card-seq { font-family: Cinzel, Palatino, serif; font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--color-bronze-600); margin-bottom: 8px; }
          .pg__card-head { display: flex; align-items: baseline; gap: 10px; }
          .pg__card-name { font-family: 'Cormorant Garamond', serif; font-size: 26px; color: var(--color-wood-900); }
          .pg__card-gate { font-family: 'Lato', Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.16em; color: var(--color-bronze-600); }
          .pg__card-art { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 17px; color: var(--color-wood-700); margin-top: 3px; }
          .pg__card-triad { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 11px; font-family: 'Lato', Helvetica, sans-serif; font-size: 11.5px; letter-spacing: 0.04em; }
          .pg__card-role { font-family: 'Cormorant Garamond', serif; font-size: 16px; font-style: italic; line-height: 1.5; color: var(--color-wood-700); margin: 14px 0 0; }
          .pg__card-open { margin-top: 16px; border: 0; background: transparent; padding: 0; cursor: pointer; font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-bronze-600); }
          .pg__card-open:hover { color: var(--color-bronze-700, var(--color-bronze-600)); }
        }

        /* ── mobile list fallback ── */
        .pg__list-view { display: flex; flex-direction: column; gap: 36px; }
        .pg__band-label { font-family: Cinzel, Palatino, serif; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--color-bronze-600); margin: 0 0 12px; }
        .pg__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .pg__row { display: grid; grid-template-columns: 16px 1fr; align-items: start; gap: 14px; padding: 12px 14px; border: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent); border-radius: 3px; text-decoration: none; color: inherit; transition: border-color 0.2s, background 0.2s; }
        .pg__row:hover { border-color: color-mix(in oklab, var(--color-bronze-600) 40%, transparent); background: color-mix(in oklab, var(--color-bronze-400) 5%, transparent); }
        .pg__row-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 5px; }
        .pg__row-label { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .pg__row-name { font-family: 'Cormorant Garamond', serif; font-size: 19px; color: var(--color-wood-900); }
        .pg__row-gate { font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.18em; color: var(--color-bronze-600); }
        .pg__row-art { font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.06em; color: var(--color-wood-600); margin-top: 2px; }
        .pg__row-triad { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; }
        .pg__row-role { font-family: 'Cormorant Garamond', serif; font-size: 14px; font-style: italic; color: var(--color-wood-700); margin: 8px 0 0; }

        @media (prefers-reduced-motion: reduce) {
          .pg__circle, .pg__ring, .pg__channel, .pg__node { transition: none; }
        }
      `}</style>
    </div>
  );
};

export default ProfileGraph;
