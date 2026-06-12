import React, { useState } from 'react';
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

/** Per-sequence orb colour, translated from the official chart's code
 *  (green = Activation, red = Venus, blue = Pearl) into the UL palette. */
const SEQUENCE_COLOR: Record<ProfileSequence, { core: string; edge: string }> = {
  // Activation: a deliberate sage/celadon so it reads as a distinct third
  // sequence rather than a neutral brown.
  // Saturated to match the official chart and stay readable on BOTH the
  // dark and the light (paper) background — the pale earlier tones washed
  // out to near-white in light mode.
  activation: { core: '#3f8f4e', edge: '#1f5a2c' },
  venus: { core: '#c0392b', edge: '#7e1f17' },
  pearl: { core: '#3f7fb5', edge: '#27557e' },
};

const VIEW = 720;     // square viewBox
const R = 34;         // orb radius in viewBox units

const ProfileGraph: React.FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  const [active, setActive] = useState<ProfileKey | null>(null);

  const pos = (k: ProfileKey) => {
    const m = POSITIONS_BY_KEY[k];
    return { x: m.x * VIEW, y: m.y * VIEW };
  };

  // Hovering a sphere lights only ITS OWN sequence — the one emblem it
  // belongs to — not every sequence whose lines happen to touch it. Each
  // sphere has a single home sequence (its `sequence` field).
  const activeSequence: ProfileSequence | null = active
    ? POSITIONS_BY_KEY[active].sequence
    : null;
  const seqActive = (seq: ProfileSequence) => activeSequence === seq;

  // Every sequence whose lines touch a sphere. A shared "hinge" sphere
  // (Purpose, SQ, Life's Work) returns two — its orb is drawn half-and-half.
  const SEQ_ORDER: ProfileSequence[] = ['activation', 'venus', 'pearl'];
  const sequencesOf = (k: ProfileKey): ProfileSequence[] => {
    const set = new Set<ProfileSequence>([POSITIONS_BY_KEY[k].sequence]);
    for (const ch of PROFILE_CHANNELS) {
      if (ch.from === k || ch.to === k) set.add(ch.sequence);
    }
    return SEQ_ORDER.filter((s) => set.has(s));
  };

  const go = (k: ProfileKey) => navigate(`/universal-language/${profile[k].gate}`);

  return (
    <div className="profile-graph">
      {/* ── Mandala (wide) ───────────────────────────────────────────── */}
      <div
        className={`profile-graph__mandala${active ? ' has-active' : ''}`}
        role="group"
        aria-label="Hologenetic profile mandala"
      >
        <svg viewBox={`-150 -20 ${VIEW + 300} ${VIEW + 40}`} className="profile-graph__svg">
          <defs>
            {(['activation', 'venus', 'pearl'] as const).map((seq) => (
              <radialGradient key={seq} id={`orb-${seq}`} cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor={SEQUENCE_COLOR[seq].core} />
                <stop offset="100%" stopColor={SEQUENCE_COLOR[seq].edge} />
              </radialGradient>
            ))}
            {/* Split fills for the shared "hinge" spheres: left half one
                sequence's colour, right half the other, with a hard edge. */}
            {([
              ['activation', 'venus'],
              ['activation', 'pearl'],
              ['venus', 'pearl'],
            ] as const).map(([a, b]) => (
              <linearGradient key={`${a}-${b}`} id={`split-${a}-${b}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={SEQUENCE_COLOR[a].core} />
                <stop offset="50%" stopColor={SEQUENCE_COLOR[a].edge} />
                <stop offset="50%" stopColor={SEQUENCE_COLOR[b].edge} />
                <stop offset="100%" stopColor={SEQUENCE_COLOR[b].core} />
              </linearGradient>
            ))}
            {(['activation', 'venus', 'pearl'] as const).map((seq) => (
              <marker
                key={seq}
                id={`arrow-${seq}`}
                viewBox="0 0 10 10"
                refX="9" refY="5"
                markerWidth="7" markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={SEQUENCE_COLOR[seq].edge} />
              </marker>
            ))}
          </defs>

          {/* Channels — directional arrows in canonical Golden Path order,
              each coloured by its sequence. Lines are trimmed to the orb
              edge so the arrowhead sits just outside the destination. */}
          <g className="profile-graph__channels">
            {PROFILE_CHANNELS.map((ch, i) => {
              const pa = pos(ch.from);
              const pb = pos(ch.to);
              const lit = seqActive(ch.sequence);
              const dx = pb.x - pa.x, dy = pb.y - pa.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len, uy = dy / len;
              const x1 = pa.x + ux * (R + 2);
              const y1 = pa.y + uy * (R + 2);
              const x2 = pb.x - ux * (R + 9);
              const y2 = pb.y - uy * (R + 9);
              // Offset the pathway label perpendicular to the line so it
              // sits beside the channel, clear of the orbs and other labels.
              const nx = -uy, ny = ux;
              const mx = (x1 + x2) / 2 + nx * 14;
              const my = (y1 + y2) / 2 + ny * 14;
              return (
                <g key={i}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={SEQUENCE_COLOR[ch.sequence].edge}
                    markerEnd={`url(#arrow-${ch.sequence})`}
                    className={`profile-graph__channel${lit ? ' is-lit' : ''}`}
                  />
                  {(ch.from === active || ch.to === active) && (
                    <text
                      x={mx} y={my}
                      className="profile-graph__pathway"
                      fill={SEQUENCE_COLOR[ch.sequence].edge}
                    >
                      {ch.pathway}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Spheres + outside labels */}
          {PROFILE_POSITIONS.map((meta) => {
            const gl = profile[meta.key];
            if (!gl) return null; // defensive: stale profile missing a sphere
            const card = CARD_BY_NUMBER.get(gl.gate);
            const p = pos(meta.key);
            const isActive = active === meta.key;
            const inSequence = activeSequence === meta.sequence;
            // Shared spheres (in two sequences) get a half-and-half fill.
            const seqs = sequencesOf(meta.key);
            const orbFill = seqs.length >= 2
              ? `url(#split-${seqs[0]}-${seqs[1]})`
              : `url(#orb-${meta.sequence})`;

            // Label box placement relative to the orb. Generous pad so the
            // name never sits on top of a sphere.
            const W = 150, H = 30, pad = R + 16;
            let lx = p.x - W / 2, ly = p.y - H / 2;
            let alignClass = 'is-center';
            if (meta.labelSide === 'left')   { lx = p.x - pad - W; alignClass = 'is-right'; }
            if (meta.labelSide === 'right')  { lx = p.x + pad;     alignClass = 'is-left'; }
            if (meta.labelSide === 'top')    { ly = p.y - pad - H; alignClass = 'is-center'; }
            if (meta.labelSide === 'bottom') { ly = p.y + pad;     alignClass = 'is-center'; }

            return (
              <g key={meta.key} className={`profile-graph__node${isActive ? ' is-active' : ''}${inSequence ? ' in-sequence' : ''}`}>
                {/* On-chart label: just the position name. The Gene Keys
                    triad now lives in the side panel so the chart stays clean. */}
                <foreignObject x={lx} y={ly} width={W} height={H} className="profile-graph__label-fo">
                  <div className={`profile-graph__label ${alignClass}`}>
                    <div className="profile-graph__name">{meta.label}</div>
                  </div>
                </foreignObject>

                {/* the orb itself */}
                <g
                  transform={`translate(${p.x} ${p.y})`}
                  className="profile-graph__orb"
                  tabIndex={0}
                  role="button"
                  aria-label={`${meta.label}, gate ${gl.gate} line ${gl.line}, ${card?.card_name ?? ''}`}
                  onMouseEnter={() => setActive(meta.key)}
                  onMouseLeave={() => setActive((c) => (c === meta.key ? null : c))}
                  onFocus={() => setActive(meta.key)}
                  onBlur={() => setActive((c) => (c === meta.key ? null : c))}
                  onClick={() => go(meta.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(meta.key); }
                  }}
                >
                  <circle r={R + 4} className="profile-graph__ring" />
                  <circle r={R} fill={orbFill} className="profile-graph__circle" />
                  <text className="profile-graph__gate" y={5}>{gl.gate}.{gl.line}</text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Side reading panel: the reached sphere's full detail. Sits beside
            the chart on desktop, below it on mobile. */}
        <aside className="profile-graph__panel" aria-live="polite">
          {active ? (() => {
            const meta = POSITIONS_BY_KEY[active];
            const gl = profile[active];
            const card = gl ? CARD_BY_NUMBER.get(gl.gate) : undefined;
            return (
              <>
                <div className="profile-graph__panel-seq">{SEQUENCE_LABEL[meta.sequence]}</div>
                <div className="profile-graph__panel-head">
                  <span className="profile-graph__panel-name">{meta.label}</span>
                  {gl && <span className="profile-graph__panel-gate">{gl.gate}.{gl.line}</span>}
                </div>
                {card && <div className="profile-graph__panel-art">{card.card_name}</div>}
                {card?.gene_keys?.gift && (
                  <div className="profile-graph__panel-triad">
                    <span className="profile-graph__gk profile-graph__gk--siddhi">{card.gene_keys.siddhi}</span>
                    <span className="profile-graph__gk profile-graph__gk--gift">{card.gene_keys.gift}</span>
                    <span className="profile-graph__gk profile-graph__gk--shadow">{card.gene_keys.shadow}</span>
                  </div>
                )}
                <p className="profile-graph__panel-role">{meta.role}</p>
              </>
            );
          })() : (
            <div className="profile-graph__legend">
              <div className="profile-graph__legend-title">The Golden Path</div>
              <ul className="profile-graph__legend-list">
                <li><span className="profile-graph__swatch" style={{ background: SEQUENCE_COLOR.activation.core }} /> Activation — your genius</li>
                <li><span className="profile-graph__swatch" style={{ background: SEQUENCE_COLOR.venus.core }} /> Venus — your heart</li>
                <li><span className="profile-graph__swatch" style={{ background: SEQUENCE_COLOR.pearl.core }} /> Pearl — your prosperity</li>
                <li>
                  <span className="profile-graph__swatch profile-graph__swatch--split" /> a half sphere belongs to two sequences
                </li>
              </ul>
              <p className="profile-graph__legend-hint">Hover or tap a sphere to read its place in you.</p>
            </div>
          )}
        </aside>
      </div>

      {/* ── Grouped list (narrow) ────────────────────────────────────── */}
      <div className="profile-graph__list-view">
        {(['activation', 'venus', 'pearl'] as const).map((seq) => (
          <section key={seq} className="profile-graph__band">
            <h2 className="profile-graph__band-label">{SEQUENCE_LABEL[seq]}</h2>
            <ul className="profile-graph__list">
              {PROFILE_POSITIONS.filter((p) => p.sequence === seq).map((meta) => {
                const gl = profile[meta.key];
                if (!gl) return null; // defensive: stale profile missing a sphere
                const card = CARD_BY_NUMBER.get(gl.gate);
                return (
                  <li key={meta.key}>
                    <a href={`/universal-language/${gl.gate}`} className="profile-graph__row">
                      <span className="profile-graph__dot" style={{ background: SEQUENCE_COLOR[meta.sequence].edge }} aria-hidden />
                      <div className="profile-graph__text">
                        <div className="profile-graph__row-label">
                          <span className="profile-graph__position">{meta.label}</span>
                          <span className="profile-graph__gateline">{gl.gate}.{gl.line}</span>
                        </div>
                        <div className="profile-graph__row-detail">{card ? card.card_name : `Gate ${gl.gate}`}</div>
                        {card?.gene_keys?.gift && (
                          <div className="profile-graph__triad">
                            <span className="profile-graph__gk profile-graph__gk--siddhi">{card.gene_keys.siddhi}</span>
                            <span className="profile-graph__gk profile-graph__gk--gift">{card.gene_keys.gift}</span>
                            <span className="profile-graph__gk profile-graph__gk--shadow">{card.gene_keys.shadow}</span>
                          </div>
                        )}
                        <p className="profile-graph__role">{meta.role}</p>
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
        .profile-graph { display: block; }
        .profile-graph__mandala { display: none; }
        .profile-graph__svg { width: 100%; height: auto; overflow: visible; }

        /* ── channels ── */
        /* Stroke colour is set inline per-sequence; opacity carries the
           rest/active state so each sequence's path reads in its own hue. */
        .profile-graph__channel {
          stroke-width: 1.5;
          opacity: 0.5;
          transition: opacity 0.3s, stroke-width 0.3s;
        }
        .profile-graph__channel.is-lit { opacity: 1; stroke-width: 3; }
        .profile-graph__mandala.has-active .profile-graph__channel:not(.is-lit) { opacity: 0.25; }
        .profile-graph__pathway {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          text-anchor: middle;
        }

        /* ── orbs ── */
        .profile-graph__orb { cursor: pointer; outline: none; }
        /* When one sphere is reached, the rest recede so focus lands cleanly. */
        .profile-graph__node { transition: opacity 0.25s; }
        /* Whole-sequence highlight: spheres in the active sequence stay full,
           everything else recedes. */
        .profile-graph__mandala.has-active .profile-graph__node:not(.in-sequence) { opacity: 0.55; }
        .profile-graph__ring {
          fill: none;
          stroke: color-mix(in oklab, var(--color-wood-600) 22%, transparent);
          stroke-width: 1;
          transition: stroke 0.25s;
        }
        .profile-graph__circle {
          transition: filter 0.25s;
          filter: drop-shadow(0 2px 5px rgba(0,0,0,0.18));
        }
        .profile-graph__node.in-sequence .profile-graph__circle {
          filter: drop-shadow(0 0 10px color-mix(in oklab, var(--color-bronze-400) 55%, transparent));
        }
        .profile-graph__node.is-active .profile-graph__circle {
          filter: drop-shadow(0 0 14px color-mix(in oklab, var(--color-bronze-400) 80%, transparent));
        }
        .profile-graph__node.in-sequence .profile-graph__ring { stroke: var(--color-bronze-500); }
        .profile-graph__orb:focus-visible .profile-graph__ring { stroke: var(--color-bronze-400); stroke-width: 2.5; }
        .profile-graph__gate {
          fill: var(--color-paper-50);
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 13px; font-weight: 600; letter-spacing: 0.08em;
          text-anchor: middle; pointer-events: none;
        }

        /* ── outside labels ── */
        .profile-graph__label-fo { overflow: visible; pointer-events: none; }
        .profile-graph__label { display: flex; flex-direction: column; gap: 3px; height: 100%; justify-content: center; }
        .profile-graph__label.is-left   { align-items: flex-start; text-align: left; }
        .profile-graph__label.is-right  { align-items: flex-end;   text-align: right; }
        .profile-graph__label.is-center { align-items: center;     text-align: center; }
        /* A soft pill behind each label so the text stays legible over orbs
           and lines, in both light and dark mode. */
        .profile-graph__name {
          display: inline-block;
          font-family: 'Cormorant Garamond', serif; font-size: 19px; font-weight: 600; line-height: 1.15;
          color: var(--color-wood-900);
          background: color-mix(in oklab, var(--color-paper-50) 88%, transparent);
          padding: 2px 9px; border-radius: 5px;
          white-space: nowrap;
        }
        .profile-graph__node.is-active .profile-graph__name { color: var(--color-bronze-700, var(--color-bronze-600)); }
        .profile-graph__triad {
          display: inline-flex; flex-wrap: wrap; gap: 5px;
          font-family: 'Lato', Helvetica, sans-serif; font-size: 10px; letter-spacing: 0.04em; line-height: 1.35;
          background: color-mix(in oklab, var(--color-paper-50) 78%, transparent);
          padding: 1px 6px; border-radius: 4px;
          opacity: 0.72;
          transition: opacity 0.25s;
        }
        .profile-graph__node.in-sequence .profile-graph__triad { opacity: 1; }
        .profile-graph__label.is-right .profile-graph__triad { justify-content: flex-end; }
        .profile-graph__label.is-center .profile-graph__triad { justify-content: center; }

        /* ── gene-key spectrum colours (shared) ── */
        .profile-graph__gk--siddhi { color: var(--color-bronze-600); }
        .profile-graph__gk--gift   { color: var(--color-wood-800); }
        .profile-graph__gk--shadow { color: color-mix(in oklab, #a04a32 80%, var(--color-wood-700)); }

        /* ── list view ── */
        .profile-graph__list-view { display: flex; flex-direction: column; gap: 36px; }
        .profile-graph__band-label { font-family: Cinzel, Palatino, serif; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--color-bronze-600); margin: 0 0 12px; }
        .profile-graph__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .profile-graph__row { display: grid; grid-template-columns: 16px 1fr; align-items: start; gap: 14px; padding: 12px 14px; border: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent); border-radius: 3px; text-decoration: none; color: inherit; transition: border-color 0.2s, background 0.2s; }
        .profile-graph__row:hover { border-color: color-mix(in oklab, var(--color-bronze-600) 40%, transparent); background: color-mix(in oklab, var(--color-bronze-400) 5%, transparent); }
        .profile-graph__dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 5px; }
        .profile-graph__row-label { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .profile-graph__position { font-family: 'Cormorant Garamond', serif; font-size: 19px; color: var(--color-wood-900); }
        .profile-graph__gateline { font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.18em; color: var(--color-bronze-600); }
        .profile-graph__row-detail { font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.06em; color: var(--color-wood-600); margin-top: 2px; }
        .profile-graph__list-view .profile-graph__triad { margin-top: 8px; font-size: 11px; gap: 6px; }
        .profile-graph__role { font-family: 'Cormorant Garamond', serif; font-size: 14px; font-style: italic; color: var(--color-wood-700); margin: 8px 0 0; }

        /* ── side reading panel ── */
        .profile-graph__panel { display: none; }
        .profile-graph__panel-seq {
          font-family: Cinzel, Palatino, serif; font-size: 10px; letter-spacing: 0.3em;
          text-transform: uppercase; color: var(--color-bronze-600); margin-bottom: 10px;
        }
        .profile-graph__panel-head { display: flex; align-items: baseline; gap: 12px; }
        .profile-graph__panel-name { font-family: 'Cormorant Garamond', serif; font-size: 28px; color: var(--color-wood-900); }
        .profile-graph__panel-gate { font-family: 'Lato', Helvetica, sans-serif; font-size: 13px; letter-spacing: 0.18em; color: var(--color-bronze-600); }
        .profile-graph__panel-art { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 18px; color: var(--color-wood-700); margin-top: 4px; }
        .profile-graph__panel-triad { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; font-family: 'Lato', Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.04em; }
        .profile-graph__panel-role { font-family: 'Cormorant Garamond', serif; font-size: 17px; font-style: italic; line-height: 1.5; color: var(--color-wood-700); margin: 16px 0 0; }
        .profile-graph__panel-hint { font-family: 'Cormorant Garamond', serif; font-size: 16px; font-style: italic; color: var(--color-wood-600); }
        .profile-graph__legend-title { font-family: Cinzel, Palatino, serif; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--color-bronze-600); margin-bottom: 18px; }
        .profile-graph__legend-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
        .profile-graph__legend-list li { display: flex; align-items: center; gap: 10px; font-family: 'Cormorant Garamond', serif; font-size: 16px; color: var(--color-wood-800); line-height: 1.3; }
        .profile-graph__swatch { width: 16px; height: 16px; border-radius: 50%; flex: none; }
        .profile-graph__swatch--split { background: linear-gradient(90deg, #3f8f4e 0 50%, #3f7fb5 50% 100%); }
        .profile-graph__legend-hint { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 15px; color: var(--color-wood-600); margin: 20px 0 0; }

        /* Mandala (chart + side panel) on wide screens, grouped list on narrow.
           Placed last so it wins on source order. */
        @media (min-width: 880px) {
          .profile-graph__mandala {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 280px;
            align-items: center;
            gap: 56px;
            max-width: 1560px;
            margin: 0 auto;
          }
          .profile-graph__list-view { display: none; }
          .profile-graph__panel {
            display: block;
            align-self: center;
            border-left: 1px solid color-mix(in oklab, var(--color-wood-600) 16%, transparent);
            padding-left: 28px;
            min-height: 200px;
          }
        }
        /* Tablet (760-880px): chart only, panel becomes a line below it. */
        @media (min-width: 760px) and (max-width: 879px) {
          .profile-graph__mandala { display: block; max-width: 720px; margin: 0 auto; }
          .profile-graph__list-view { display: none; }
          .profile-graph__panel { display: block; text-align: center; max-width: 560px; margin: 12px auto 0; min-height: 4em; }
        }

        @media (prefers-reduced-motion: reduce) {
          .profile-graph__circle, .profile-graph__ring, .profile-graph__channel, .profile-graph__node { transition: none; }
        }
      `}</style>
    </div>
  );
};

export default ProfileGraph;
