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

  const isLit = (a: ProfileKey, b: ProfileKey) =>
    active != null && (a === active || b === active);

  // Spine channels animate a slow travelling pulse at rest.
  const SPINE = new Set(['lifesWork>pearl', 'pearl>sq', 'sq>attraction', 'attraction>purpose']);
  const isSpine = (a: ProfileKey, b: ProfileKey) => SPINE.has(`${a}>${b}`);

  const go = (k: ProfileKey) => navigate(`/universal-language/${profile[k].gate}`);

  return (
    <div className="profile-graph">
      {/* ── Mandala (wide) ───────────────────────────────────────────── */}
      <div className="profile-graph__mandala" role="group" aria-label="Hologenetic profile mandala">
        <svg viewBox={`-150 -20 ${VIEW + 300} ${VIEW + 40}`} className="profile-graph__svg">
          <defs>
            {(['activation', 'venus', 'pearl'] as const).map((seq) => (
              <radialGradient key={seq} id={`orb-${seq}`} cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor={SEQUENCE_COLOR[seq].core} />
                <stop offset="100%" stopColor={SEQUENCE_COLOR[seq].edge} />
              </radialGradient>
            ))}
          </defs>

          {/* Channels */}
          <g className="profile-graph__channels">
            {PROFILE_CHANNELS.map(([a, b], i) => {
              const pa = pos(a);
              const pb = pos(b);
              const cls =
                'profile-graph__channel' +
                (isLit(a, b) ? ' is-lit' : '') +
                (isSpine(a, b) && active == null ? ' is-spine' : '');
              return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className={cls} />;
            })}
          </g>

          {/* Spheres + outside labels */}
          {PROFILE_POSITIONS.map((meta) => {
            const gl = profile[meta.key];
            const card = CARD_BY_NUMBER.get(gl.gate);
            const p = pos(meta.key);
            const isActive = active === meta.key;

            // Label box placement relative to the orb.
            const W = 170, H = 64, pad = R + 10;
            let lx = p.x - W / 2, ly = p.y - H / 2;
            let alignClass = 'is-center';
            if (meta.labelSide === 'left')   { lx = p.x - pad - W; alignClass = 'is-right'; }
            if (meta.labelSide === 'right')  { lx = p.x + pad;     alignClass = 'is-left'; }
            if (meta.labelSide === 'top')    { ly = p.y - pad - H; alignClass = 'is-center'; }
            if (meta.labelSide === 'bottom') { ly = p.y + pad;     alignClass = 'is-center'; }

            return (
              <g key={meta.key} className={`profile-graph__node${isActive ? ' is-active' : ''}`}>
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
        .profile-graph__channel {
          stroke: color-mix(in oklab, var(--color-wood-600) 20%, transparent);
          stroke-width: 1;
          transition: stroke 0.3s, stroke-width 0.3s;
        }
        .profile-graph__channel.is-lit { stroke: var(--color-bronze-500); stroke-width: 2.5; }
        .profile-graph__channel.is-spine {
          stroke: color-mix(in oklab, var(--color-bronze-500) 45%, transparent);
          stroke-dasharray: 6 10;
          animation: spine-flow 6s linear infinite;
        }
        @keyframes spine-flow { to { stroke-dashoffset: -16; } }

        /* ── orbs ── */
        .profile-graph__orb { cursor: pointer; outline: none; }
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
        .profile-graph__node.is-active .profile-graph__circle {
          filter: drop-shadow(0 0 12px color-mix(in oklab, var(--color-bronze-400) 70%, transparent));
        }
        .profile-graph__node.is-active .profile-graph__ring { stroke: var(--color-bronze-500); }
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
        }
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

        /* Mandala on wide screens, grouped list on narrow. Placed last so
           it wins on source order over the base display declarations. */
        @media (min-width: 760px) {
          .profile-graph__mandala { display: block; max-width: 760px; margin: 0 auto; }
          .profile-graph__list-view { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .profile-graph__channel.is-spine { animation: none; }
          .profile-graph__circle, .profile-graph__ring, .profile-graph__channel { transition: none; }
        }
      `}</style>
    </div>
  );
};

export default ProfileGraph;
