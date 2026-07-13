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

  // ── Zoom + pan ──────────────────────────────────────────────────────
  // The chart now renders at every width (scaled to fit), so when it shrinks
  // on a phone we let the visitor pinch to zoom and drag to pan around it.
  // Pure pointer math, no library: a {scale, x, y} transform on a wrapper.
  const MIN_Z = 1, MAX_Z = 4;
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  // Active pointers (for pinch) and the last single-pointer position (for pan).
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; s: number; cx: number; cy: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const didDrag = useRef(false);

  const clampZoom = (z: { s: number; x: number; y: number }) => {
    const s = Math.min(MAX_Z, Math.max(MIN_Z, z.s));
    const vp = viewportRef.current;
    if (!vp || s <= 1) return { s, x: 0, y: 0 };
    // Keep the (scaled) content from panning past its own edges.
    const w = vp.clientWidth, h = vp.clientHeight;
    const maxX = (w * (s - 1)) / 2, maxY = (h * (s - 1)) / 2;
    return { s, x: Math.min(maxX, Math.max(-maxX, z.x)), y: Math.min(maxY, Math.max(-maxY, z.y)) };
  };

  const zoomAt = (factor: number, cx: number, cy: number) => {
    setZoom((z) => {
      const vp = viewportRef.current;
      if (!vp) return z;
      const rect = vp.getBoundingClientRect();
      // Point under the cursor, relative to viewport centre.
      const px = cx - rect.left - rect.width / 2;
      const py = cy - rect.top - rect.height / 2;
      const ns = Math.min(MAX_Z, Math.max(MIN_Z, z.s * factor));
      const k = ns / z.s;
      // Zoom toward the cursor: new offset keeps that point stationary.
      return clampZoom({ s: ns, x: px - (px - z.x) * k, y: py - (py - z.y) * k });
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && zoom.s <= 1) return; // let the page scroll when not zoomed
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    didDrag.current = false;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        s: zoom.s,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      panStart.current = null;
    } else if (ptrs.current.size === 1 && zoom.s > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2 && pinchStart.current) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ps = pinchStart.current;
      const ns = Math.min(MAX_Z, Math.max(MIN_Z, ps.s * (dist / ps.dist)));
      setZoom((z) => {
        const vp = viewportRef.current;
        if (!vp) return z;
        const rect = vp.getBoundingClientRect();
        const px = ps.cx - rect.left - rect.width / 2;
        const py = ps.cy - rect.top - rect.height / 2;
        const k = ns / z.s;
        return clampZoom({ s: ns, x: px - (px - z.x) * k, y: py - (py - z.y) * k });
      });
      didDrag.current = true;
    } else if (ptrs.current.size === 1 && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setZoom((z) => clampZoom({ s: z.s, x: panStart.current!.ox + dx, y: panStart.current!.oy + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinchStart.current = null;
    if (ptrs.current.size === 0) panStart.current = null;
  };

  const resetZoom = () => setZoom({ s: 1, x: 0, y: 0 });
  // Swallow an orb click that was actually the end of a drag/pinch.
  const guard = (fn: () => void) => () => { if (didDrag.current) { didDrag.current = false; return; } fn(); };

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
  // A click pins the explanation. Hover only previews while nothing is pinned.
  const detailKey: ProfileKey = selected ?? hovered ?? 'lifesWork';
  const detailMeta = POSITIONS_BY_KEY[detailKey];
  const detailGate = profile[detailKey];
  const detailCard = detailGate ? CARD_BY_NUMBER.get(detailGate.gate) : undefined;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'activation', label: 'Activation' },
    { key: 'venus', label: 'Venus' },
    { key: 'pearl', label: 'Pearl' },
  ];

  return (
    <div className="pg" ref={wrapRef}>
      {/* ── Workspace: path + centred chart + connected detail ─────── */}
      <div className="pg__work">
        <aside className="pg__rail pg__rail--path">
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
                    aria-pressed={selected === meta.key}
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
        </aside>

        {/* Canvas: the mandala fills the centre */}
        <div className={`pg__canvas${hasFocus ? ' has-focus' : ''}`}>
          {/* Zoom controls — visible whenever the chart can be explored. */}
          <div className="pg__zoom" role="group" aria-label="Zoom the chart">
            <button type="button" className="pg__zoom-btn" aria-label="Zoom out"
              onClick={() => { const vp = viewportRef.current; const r = vp?.getBoundingClientRect(); zoomAt(1 / 1.3, (r?.left ?? 0) + (r?.width ?? 0) / 2, (r?.top ?? 0) + (r?.height ?? 0) / 2); }}>−</button>
            <button type="button" className="pg__zoom-btn" aria-label="Reset zoom" onClick={resetZoom} disabled={zoom.s === 1}>{Math.round(zoom.s * 100)}%</button>
            <button type="button" className="pg__zoom-btn" aria-label="Zoom in"
              onClick={() => { const vp = viewportRef.current; const r = vp?.getBoundingClientRect(); zoomAt(1.3, (r?.left ?? 0) + (r?.width ?? 0) / 2, (r?.top ?? 0) + (r?.height ?? 0) / 2); }}>+</button>
          </div>
          <div
            className={`pg__viewport${zoom.s > 1 ? ' is-zoomed' : ''}`}
            ref={viewportRef}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
          <div className="pg__pan" style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` }}>
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
                    onClick={guard(() => open(meta.key))}
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
          </div>{/* .pg__pan */}
          </div>{/* .pg__viewport */}

        </div>

        <aside className="pg__rail pg__rail--detail" aria-live="polite">
          <div className="pg__filter" role="group" aria-label="Focus a sequence">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`pg__filter-btn${filter === f.key ? ' is-on' : ''}`}
                aria-pressed={filter === f.key}
                style={f.key !== 'all' ? { ['--c' as string]: SEQUENCE_COLOR[f.key as ProfileSequence].edge } : undefined}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="pg__detail">
            <div className="pg__detail-seq">{SEQUENCE_LABEL[detailMeta.sequence]}</div>
            <div className="pg__detail-head">
              <h2 className="pg__detail-name">{detailMeta.label}</h2>
              <span className="pg__detail-gate">{detailGate.gate}.{detailGate.line}</span>
            </div>
            {detailCard && <div className="pg__detail-art">{detailCard.card_name}</div>}
            <p className="pg__detail-role">{detailMeta.role}</p>
            <button className="pg__detail-open" onClick={() => goCard(detailKey)}>Open the card →</button>
          </div>
        </aside>
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

        /* ── Sequence controls: part of the right-hand reading rail ── */
        .pg__filter { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 6px; padding-bottom: 14px; border-bottom: 1px solid color-mix(in oklab, var(--color-wood-600) 14%, transparent); max-width: 100%; }
        .pg__filter-btn {
          font-family: 'Lato', Helvetica, sans-serif; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
          min-height: 28px; padding: 5px 7px; border: 0; border-radius: 999px; background: transparent; color: var(--color-wood-700); cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .pg__filter-btn:hover { color: var(--color-wood-900); }
        .pg__filter-btn.is-on { background: var(--c, var(--color-bronze-600)); color: var(--color-paper-50); }
        .pg__filter-btn:focus-visible, .pg__rail-row:focus-visible, .pg__detail-open:focus-visible, .pg__zoom-btn:focus-visible { outline: 2px solid var(--color-bronze-400); outline-offset: 2px; }

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

        /* ── workspace: balanced rails keep the graph on the page axis ── */
        .pg__work {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1320px;
          margin: 0 auto;
        }
        .pg__svg { width: 100%; height: auto; overflow: visible; display: block; }

        /* Zoom + pan viewport. The chart scales to fit the column width; pinch
           or the +/− controls magnify it, drag pans around when zoomed. */
        .pg__canvas { position: relative; }
        .pg__viewport {
          position: relative;
          overflow: hidden;
          touch-action: pan-y;
          border-radius: 10px;
        }
        .pg__viewport.is-zoomed { cursor: grab; touch-action: none; }
        .pg__viewport.is-zoomed:active { cursor: grabbing; }
        .pg__pan { transform-origin: center center; will-change: transform; }
        .pg__zoom {
          position: absolute; z-index: 15; top: 6px; right: 6px;
          display: inline-flex; gap: 2px; padding: 3px;
          background: color-mix(in oklab, var(--color-paper-50) 86%, transparent);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 16%, transparent);
          border-radius: 999px; backdrop-filter: blur(4px);
        }
        .pg__zoom-btn {
          min-width: 30px; height: 26px; padding: 0 8px; border: 0; border-radius: 999px;
          background: transparent; cursor: pointer;
          font-family: 'Lato', Helvetica, sans-serif; font-size: 12px; font-weight: 600;
          letter-spacing: 0.04em; color: var(--color-wood-700);
          display: inline-flex; align-items: center; justify-content: center;
        }
        .pg__zoom-btn:hover:not(:disabled) { background: color-mix(in oklab, var(--color-bronze-400) 16%, transparent); color: var(--color-wood-900); }
        .pg__zoom-btn:disabled { opacity: 0.55; cursor: default; }

        /* Rail: a flowing list of the 11 positions above the chart on narrow. */
        .pg__rail { align-self: start; width: 100%; }
        .pg__rail-title { font-family: Cinzel, Palatino, serif; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--color-bronze-600); margin-bottom: 12px; }
        .pg__rail-list { list-style: none; margin: 0 0 18px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1px; }
        .pg__rail-row {
          display: flex; align-items: baseline; gap: 10px; width: 100%;
          padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; text-align: left;
          transition: background 0.18s;
        }
        .pg__rail-row:hover, .pg__rail-row.is-on { background: color-mix(in oklab, var(--color-bronze-400) 12%, transparent); }
        .pg__rail-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; align-self: center; }
        .pg__rail-name { font-family: 'Cormorant Garamond', serif; font-size: 17px; color: var(--color-wood-900); flex: 1; }
        .pg__rail-gate { font-family: 'Lato', Helvetica, sans-serif; font-size: 10px; letter-spacing: 0.12em; color: var(--color-bronze-600); }
        .pg__legend { display: flex; flex-wrap: wrap; gap: 8px 18px; padding-top: 14px; border-top: 1px solid color-mix(in oklab, var(--color-wood-600) 14%, transparent); }
        .pg__legend span { display: flex; align-items: center; gap: 9px; font-family: 'Lato', Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.08em; color: var(--color-wood-700); }
        .pg__legend i { width: 12px; height: 12px; border-radius: 50%; flex: none; }
        .pg__legend-split { background: linear-gradient(90deg, #3f8f4e 0 50%, #3f7fb5 50% 100%); }

        .pg__detail { padding-top: 16px; }
        .pg__detail-seq { font-family: Cinzel, Palatino, serif; font-size: 9px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--color-bronze-600); margin-bottom: 8px; }
        .pg__detail-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .pg__detail-name { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 500; line-height: 1.05; color: var(--color-wood-900); margin: 0; }
        .pg__detail-gate { font-family: 'Lato', Helvetica, sans-serif; font-size: 10px; letter-spacing: 0.12em; color: var(--color-bronze-600); }
        .pg__detail-art { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-style: italic; color: var(--color-wood-700); margin-top: 5px; }
        .pg__detail-role { font-family: 'Cormorant Garamond', serif; font-size: 15px; line-height: 1.45; color: var(--color-wood-700); margin: 13px 0 0; }
        .pg__detail-open { margin-top: 13px; border: 0; background: transparent; padding: 0; cursor: pointer; font-family: 'Lato', Helvetica, sans-serif; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-bronze-600); }
        .pg__detail-open:hover { color: var(--color-bronze-700, var(--color-bronze-600)); }

        @media (max-width: 879px) {
          .pg__filter-btn { min-height: 44px; font-size: 11px; }
          .pg__rail-row { min-height: 44px; }
          .pg__detail-open { min-height: 44px; display: inline-flex; align-items: center; }
        }

        @media (min-width: 880px) {
          .pg__work {
            display: grid;
            grid-template-columns: 190px minmax(0, 1fr) 190px;
            gap: 24px;
            align-items: start;
          }

          /* Rail returns to a single vertical column beside the chart. */
          .pg__rail { padding-top: 0; }
          .pg__rail--detail { padding-top: 0; }
          .pg__rail-list { display: flex; flex-direction: column; gap: 1px; margin-bottom: 22px; }
          .pg__legend { flex-direction: column; gap: 8px; padding-top: 18px; }

        }

        /* ── grouped list (always shown, beneath the chart) ── */
        .pg__list-view { display: flex; flex-direction: column; gap: 36px; margin-top: 48px; padding-top: 40px; border-top: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent); }
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
