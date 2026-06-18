import React from 'react';

/* Earth's Breath reading — shared inline-style vocabulary. The reading uses the
   template's CSS-var palette (.eb-reading in src/index.css): --l-* main paper
   surface, --d-* feature-panel recess, --accent antique gold. */

export const SERIF = 'var(--serif)';
export const SANS = 'var(--sans)';
export const CJK = 'var(--cjk)';

export function paras(text?: string): string[] {
  return (text ?? '').split('\n\n').map(s => s.trim()).filter(Boolean);
}

export const PANEL_INNER: React.CSSProperties = {
  maxWidth: 720, margin: '0 auto', padding: 'clamp(48px,7vw,96px) 24px clamp(56px,7vw,104px)',
};

export function panelShell(bg: string, color: string): React.CSSProperties {
  return {
    flex: '0 0 100%', width: '100%', minWidth: '100%',
    scrollSnapAlign: 'start', scrollSnapStop: 'always',
    background: bg, color,
  };
}

export const eyebrow = (color: string): React.CSSProperties => ({
  fontFamily: SANS, fontSize: 10, letterSpacing: '0.34em', textTransform: 'uppercase',
  color, textAlign: 'center', margin: '0 0 10px',
});

export const bigTitle = (color: string): React.CSSProperties => ({
  fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(30px,4vw,40px)', lineHeight: 1.1,
  color, textAlign: 'center',
});

export const labelUp = (color: string): React.CSSProperties => ({
  fontFamily: SANS, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 600, color, margin: 0,
});

export const bodyP = (color: string): React.CSSProperties => ({
  fontFamily: SANS, fontSize: 16, lineHeight: 1.78, color, margin: 0,
});

/* "Next →" walk button at the foot of each panel. */
export const NextButton: React.FC<{
  rule: string; sub: string; main: string; accent: string;
  kicker: string; label: string; arrow?: string; onClick: () => void;
}> = ({ rule, sub, main, accent, kicker, label, arrow = '→', onClick }) => (
  <div style={{ marginTop: 'clamp(40px,5vw,60px)', display: 'flex', justifyContent: 'center' }}>
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 26, minWidth: 240, background: 'none',
        border: `1px solid ${rule}`, cursor: 'pointer', padding: '16px 24px', textAlign: 'left',
        transition: 'border-color .25s',
      }}
      onMouseOver={e => (e.currentTarget.style.borderColor = accent)}
      onMouseOut={e => (e.currentTarget.style.borderColor = rule)}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontFamily: SANS, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: sub }}>{kicker}</span>
        <span style={{ display: 'block', fontFamily: SERIF, fontSize: 19, color: main }}>{label}</span>
      </span>
      <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: 22, color: accent }}>{arrow}</span>
    </button>
  </div>
);

/* A column of N solid bars — the template's trigram/hexagram line mark. */
export const LineStack: React.FC<{ n: number; w: number; color: string; gap?: number; h?: number }> =
  ({ n, w, color, gap = 3, h = 4 }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap, flexShrink: 0 }} aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ display: 'block', width: w, height: h, background: color }} />
      ))}
    </span>
  );
