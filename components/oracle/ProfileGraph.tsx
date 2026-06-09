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
  activation: { core: '#9bab86', edge: '#5f7355' },
  venus: { core: '#c06a4e', edge: '#7e3a28' },
  pearl: { core: '#d8b88a', edge: '#9c7434' },
};

const VIEW = 720;     // square viewBox
const R = 30;         // orb radius in viewBox units

const ProfileGraph: React.FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  const [active, setActive] = useState<ProfileKey | null>(null);

  const pos = (k: ProfileKey) => {
    const m = POSITIONS_BY_KEY[k];
    return { x: m.x * VIEW, y: m.y * VIEW };
  };

  // A sphere can belong to more than one sequence (the shared "hinge"
  // spheres where the emblems overlap — e.g. Purpose joins Activation and
  // Venus). Hovering a sphere lights EVERY sequence it participates in, so
  // the overlap reads as the connective tissue between the emblems. We
  // derive the set from the channels that actually touch the active sphere.
  const activeSequences: Set<ProfileSequence> = active
    ? new Set(
        PROFILE_CHANNELS
          .filter((ch) => ch.from === active || ch.to === active)
          .map((ch) => ch.sequence),
      )
    : new Set();
  const seqActive = (seq: ProfileSequence) => activeSequences.has(seq);

  // Every sequence a given sphere participates in (via the channels touching
  // it). A shared sphere returns more than one.
  const sequencesOf = (k: ProfileKey): Set<ProfileSequence> =>
    new Set(
      PROFILE_CHANNELS
        .filter((ch) => ch.from === k || ch.to === k)
        .map((ch) => ch.sequence),
    );

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
            const card = CARD_BY_NUMBER.get(gl.gate);
            const p = pos(meta.key);
            const isActive = active === meta.key;
            const inSequence = active != null &&
              [...sequencesOf(meta.key)].some((s) => activeSequences.has(s));

            // Label box placement relative to the orb.
            const W = 170, H = 64, pad = R + 10;
            let lx = p.x - W / 2, ly = p.y - H / 2;
            let alignClass = 'is-center';
            if (meta.labelSide === 'left')   { lx = p.x - pad - W; alignClass = 'is-right'; }
            if (meta.labelSide === 'right')  { lx = p.x + pad;     alignClass = 'is-left'; }
            if (meta.labelSide === 'top')    { ly = p.y - pad - H; alignClass = 'is-center'; }
            if (meta.labelSide === 'bottom') { ly = p.y + pad;     alignClass = 'is-center'; }

            return (
              <g key={meta.key} className={`profile-graph__node${isActive ? ' is-active' : ''}${inSequence ? ' in-sequence' : ''}`}>
                {/* label outside the orb */}
                <foreignObject x={lx} y={ly} width={W} height={H} className="profile-graph__label-fo">
                  <div className={`profile-graph__label ${alignClass}`}>
                    <div className="profile-graph__name">{meta.label}</div>
                    {card?.gene_keys?.gift && (
                      <div className="profile-graph__triad">
                        <span className="profile-graph__gk profile-graph__gk--siddhi">{card.gene_keys.siddhi}</span>
                        <span className="profile-graph__gk profile-graph__gk--gift">{card.gene_keys.gift}</span>
                        <span className="profile-graph__gk profile-graph__gk--shadow">{card.gene_keys.shadow}</span>
                      </div>
                    )}
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
                  <circle r={R} fill={`url(#orb-${meta.sequence})`} className="profile-graph__circle" />
                  <text className="profile-graph__gate" y={5}>{gl.gate}.{gl.line}</text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Caption: the reached sphere's plain-voice role, so the desktop
            mandala explains each position the way the mobile list does. A
            non-breaking-space placeholder holds the height so the layout does
            not jump as spheres are reached. */}
        <p className="profile-graph__caption" aria-live="polite">
          {active ? (
            <>
              <span className="profile-graph__caption-name">{POSITIONS_BY_KEY[active].label}.</span>{' '}
              {POSITIONS_BY_KEY[active].role}
            </>
          ) : (
            <span className="profile-graph__caption-hint">Hover or focus a sphere to read its place in you.</span>
          )}
        </p>
      </div>

      {/* ── Grouped list (narrow) ────────────────────────────────────── */}
      <div className="profile-graph__list-view">
        {(['activation', 'venus', 'pearl'] as const).map((seq) => (
          <section key={seq} className="profile-graph__band">
            <h2 className="profile-graph__band-label">{SEQUENCE_LABEL[seq]}</h2>
            <ul className="profile-graph__list">
              {PROFILE_POSITIONS.filter((p) => p.sequence === seq).map((meta) => {
                const gl = profile[meta.key];
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
          opacity: 0.35;
          transition: opacity 0.3s, stroke-width 0.3s;
        }
        .profile-graph__channel.is-lit { opacity: 1; stroke-width: 3; }
        .profile-graph__mandala.has-active .profile-graph__channel:not(.is-lit) { opacity: 0.15; }
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
        .profile-graph__mandala.has-active .profile-graph__node:not(.in-sequence) { opacity: 0.3; }
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
        .profile-graph__name {
          font-family: 'Cormorant Garamond', serif; font-size: 17px; line-height: 1.1;
          color: var(--color-wood-900);
        }
        .profile-graph__node.is-active .profile-graph__name { color: var(--color-bronze-700, var(--color-bronze-600)); }
        .profile-graph__triad {
          display: flex; flex-wrap: wrap; gap: 5px;
          font-family: 'Lato', Helvetica, sans-serif; font-size: 9.5px; letter-spacing: 0.04em; line-height: 1.3;
          /* Calm by default: the triad is a whisper until its sphere is
             reached, so the busy centre stays readable. Names stay solid. */
          opacity: 0.42;
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

        /* ── caption (mandala only) ── */
        .profile-graph__caption { display: none; }
        .profile-graph__caption-name { color: var(--color-wood-900); }
        .profile-graph__caption-hint { color: var(--color-wood-600); font-style: normal; }

        /* Mandala on wide screens, grouped list on narrow. Placed last so
           it wins on source order over the base display declarations. */
        @media (min-width: 760px) {
          .profile-graph__mandala { display: block; max-width: 760px; margin: 0 auto; }
          .profile-graph__list-view { display: none; }
          .profile-graph__caption {
            display: block;
            text-align: center;
            min-height: 2.6em;
            max-width: 520px;
            margin: 8px auto 0;
            font-family: 'Cormorant Garamond', serif;
            font-size: 16px;
            font-style: italic;
            line-height: 1.45;
            color: var(--color-wood-700);
            transition: color 0.25s;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .profile-graph__circle, .profile-graph__ring, .profile-graph__channel, .profile-graph__node { transition: none; }
        }
      `}</style>
    </div>
  );
};

export default ProfileGraph;
