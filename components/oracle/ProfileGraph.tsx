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

/** Sphere fill per sequence, mirroring the official chart's colour code
 *  (green = Activation, red = Venus, blue = Pearl) translated to the UL palette. */
const SEQUENCE_FILL: Record<ProfileSequence, string> = {
  activation: 'var(--color-wood-600)',
  venus: 'color-mix(in oklab, #a04a32 70%, var(--color-wood-700))',
  pearl: 'var(--color-bronze-600)',
};

const VIEW = 720; // SVG viewBox is square; coords are 0..1 scaled to this.

const ProfileGraph: React.FC<Props> = ({ profile }) => {
  const navigate = useNavigate();
  const [active, setActive] = useState<ProfileKey | null>(null);

  const pos = (k: ProfileKey) => {
    const m = POSITIONS_BY_KEY[k];
    return { x: m.x * VIEW, y: m.y * VIEW };
  };

  // Which channels touch the active sphere (so only those light up).
  const isLit = (a: ProfileKey, b: ProfileKey) =>
    active != null && (a === active || b === active);

  const activeMeta = active ? POSITIONS_BY_KEY[active] : null;
  const activeGate = active ? profile[active] : null;
  const activeCard = activeGate ? CARD_BY_NUMBER.get(activeGate.gate) : undefined;

  return (
    <div className="profile-graph">
      {/* ── Mandala (desktop / wide) ─────────────────────────────────── */}
      <div className="profile-graph__mandala" role="group" aria-label="Hologenetic profile mandala">
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="profile-graph__svg">
          {/* Channels: faint at rest, lit when a connected sphere is active. */}
          <g className="profile-graph__channels">
            {PROFILE_CHANNELS.map(([a, b], i) => {
              const pa = pos(a);
              const pb = pos(b);
              return (
                <line
                  key={i}
                  x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  className={`profile-graph__channel${isLit(a, b) ? ' is-lit' : ''}`}
                />
              );
            })}
          </g>

          {/* Spheres */}
          {PROFILE_POSITIONS.map((meta) => {
            const gl = profile[meta.key];
            const p = pos(meta.key);
            const isActive = active === meta.key;
            return (
              <g
                key={meta.key}
                className={`profile-graph__node${isActive ? ' is-active' : ''}`}
                transform={`translate(${p.x} ${p.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${meta.label}, gate ${gl.gate} line ${gl.line}`}
                onMouseEnter={() => setActive(meta.key)}
                onMouseLeave={() => setActive((c) => (c === meta.key ? null : c))}
                onFocus={() => setActive(meta.key)}
                onBlur={() => setActive((c) => (c === meta.key ? null : c))}
                onClick={() => navigate(`/universal-language/${gl.gate}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/universal-language/${gl.gate}`);
                  }
                }}
              >
                <circle r={34} fill={SEQUENCE_FILL[meta.sequence]} className="profile-graph__circle" />
                <text className="profile-graph__node-label" y={-6}>{meta.label}</text>
                <text className="profile-graph__node-gate" y={14}>{gl.gate}.{gl.line}</text>
              </g>
            );
          })}
        </svg>

        {/* Reading panel: details for the active (or default Pearl) sphere. */}
        <figcaption className="profile-graph__panel" aria-live="polite">
          {(() => {
            const meta = activeMeta ?? POSITIONS_BY_KEY.pearl;
            const gl = activeGate ?? profile.pearl;
            const card = activeCard ?? CARD_BY_NUMBER.get(profile.pearl.gate);
            return (
              <>
                <div className="profile-graph__panel-head">
                  <span className="profile-graph__panel-pos">{meta.label}</span>
                  <span className="profile-graph__panel-gate">{gl.gate}.{gl.line}</span>
                </div>
                <div className="profile-graph__panel-art">{card ? card.card_name : `Gate ${gl.gate}`}</div>
                {card?.gene_keys?.gift && (
                  <div className="profile-graph__genekey">
                    <span className="profile-graph__gk profile-graph__gk--siddhi">{card.gene_keys.siddhi}</span>
                    <span className="profile-graph__gk-sep">·</span>
                    <span className="profile-graph__gk profile-graph__gk--gift">{card.gene_keys.gift}</span>
                    <span className="profile-graph__gk-sep">·</span>
                    <span className="profile-graph__gk profile-graph__gk--shadow">{card.gene_keys.shadow}</span>
                  </div>
                )}
                <p className="profile-graph__role">{meta.role}</p>
                <p className="profile-graph__panel-hint">Touch a sphere to read it. Select to open the card.</p>
              </>
            );
          })()}
        </figcaption>
      </div>

      {/* ── Grouped list (narrow / mobile) ───────────────────────────── */}
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
                      <span
                        className="profile-graph__dot"
                        style={{ background: SEQUENCE_FILL[meta.sequence] }}
                        aria-hidden
                      />
                      <div className="profile-graph__text">
                        <div className="profile-graph__row-label">
                          <span className="profile-graph__position">{meta.label}</span>
                          <span className="profile-graph__gateline">{gl.gate}.{gl.line}</span>
                        </div>
                        <div className="profile-graph__row-detail">
                          {card ? card.card_name : `Gate ${gl.gate}`}
                        </div>
                        {card?.gene_keys?.gift && (
                          <div className="profile-graph__genekey">
                            <span className="profile-graph__gk profile-graph__gk--siddhi">{card.gene_keys.siddhi}</span>
                            <span className="profile-graph__gk-sep">·</span>
                            <span className="profile-graph__gk profile-graph__gk--gift">{card.gene_keys.gift}</span>
                            <span className="profile-graph__gk-sep">·</span>
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

        /* Mandala shows on wide screens; the list shows on narrow ones. */
        .profile-graph__mandala { display: none; }
        @media (min-width: 760px) {
          .profile-graph__mandala {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 260px;
            gap: 32px;
            align-items: center;
          }
          .profile-graph__list-view { display: none; }
        }

        .profile-graph__svg { width: 100%; height: auto; overflow: visible; }

        .profile-graph__channel {
          stroke: color-mix(in oklab, var(--color-wood-600) 22%, transparent);
          stroke-width: 1;
          transition: stroke 0.25s, stroke-width 0.25s;
        }
        .profile-graph__channel.is-lit {
          stroke: var(--color-bronze-600);
          stroke-width: 2;
        }

        .profile-graph__node { cursor: pointer; outline: none; }
        .profile-graph__circle {
          transition: transform 0.2s, filter 0.2s, opacity 0.2s;
          transform-origin: center;
        }
        .profile-graph__node.is-active .profile-graph__circle {
          filter: drop-shadow(0 0 10px color-mix(in oklab, var(--color-bronze-500) 60%, transparent));
        }
        .profile-graph__node:focus-visible .profile-graph__circle {
          stroke: var(--color-bronze-400);
          stroke-width: 3;
        }
        .profile-graph__node-label {
          fill: var(--color-paper-50);
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px;
          text-anchor: middle;
          pointer-events: none;
        }
        .profile-graph__node-gate {
          fill: color-mix(in oklab, var(--color-paper-50) 80%, transparent);
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-anchor: middle;
          pointer-events: none;
        }

        .profile-graph__panel {
          border-left: 1px solid color-mix(in oklab, var(--color-wood-600) 14%, transparent);
          padding-left: 24px;
          min-height: 160px;
        }
        .profile-graph__panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .profile-graph__panel-pos { font-family: 'Cormorant Garamond', serif; font-size: 24px; color: var(--color-wood-900); }
        .profile-graph__panel-gate { font-family: 'Lato', Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.18em; color: var(--color-bronze-600); }
        .profile-graph__panel-art { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 17px; color: var(--color-wood-700); margin-top: 4px; }
        .profile-graph__panel-hint { font-family: 'Lato', Helvetica, sans-serif; font-size: 10px; letter-spacing: 0.08em; color: var(--color-wood-500, var(--color-wood-600)); margin-top: 16px; }

        /* shared: gene-key triad + role */
        .profile-graph__genekey { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-top: 8px; font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.06em; }
        .profile-graph__gk--siddhi { color: var(--color-bronze-600); }
        .profile-graph__gk--gift   { color: var(--color-wood-800); }
        .profile-graph__gk--shadow { color: color-mix(in oklab, #a04a32 80%, var(--color-wood-700)); }
        .profile-graph__gk-sep     { color: var(--color-wood-500, var(--color-wood-600)); }
        .profile-graph__role { font-family: 'Cormorant Garamond', serif; font-size: 14px; font-style: italic; color: var(--color-wood-700); margin: 8px 0 0; }

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
      `}</style>
    </div>
  );
};

export default ProfileGraph;
