import React from 'react';
import { CARD_BY_NUMBER, type OracleCard } from '../../../data/oracleData';
import type { ExpandedCard } from '../../../data/expandedOracleData';
import type { CardSynthesis } from '../../../data/synthesisData';
import { castForHexagram, type CastResult } from '../../../utils/ichingCasting';
import { getLineText } from '../../../data/ichingLines';
import { HEXAGRAM_CHINESE } from '../../../data/hexagramChinese';
import { ulCardImageUrl } from '../../../utils/universalLanguage';
import {
  SERIF, SANS, CJK, paras, PANEL_INNER, panelShell, eyebrow, bigTitle, labelUp, NextButton, LineStack,
} from './ebStyle';

type Reg = (el: HTMLElement | null) => void;
const cleanTrig = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, '').trim();

/* ════════════ 1 · UNIVERSAL LANGUAGE ════════════ */
export const ULPanel: React.FC<{
  card: OracleCard; synthesis?: CardSynthesis; invocation?: string; expanded?: ExpandedCard;
  onNext: () => void; register: Reg;
}> = ({ card, synthesis, invocation, expanded, onNext, register }) => {
  const reading = paras(synthesis?.essence ?? expanded?.creator_voice?.personal_reading);
  const invLines = (invocation ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  return (
    <section data-chapter="ul" ref={register} style={panelShell('var(--l-bg)', 'var(--l-1)')}>
      <div style={PANEL_INNER}>
        <p style={eyebrow('var(--accent)')}>One · Universal Language</p>
        <h2 style={{ ...bigTitle('var(--l-1)'), margin: '0 0 clamp(36px,5vw,56px)' }}>The Reading</h2>

        {reading.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {reading.map((p, i) => (
              <p key={i} style={{ fontFamily: SERIF, fontSize: 'clamp(19px,2.2vw,22px)', lineHeight: 1.66, color: i === 0 ? 'var(--l-1)' : 'var(--l-2)', margin: 0, textWrap: 'pretty' }}>
                {i === 0 ? <><span className="ul-dropcap" aria-hidden="true">{p.charAt(0)}</span>{p.slice(1)}</> : p}
              </p>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: SERIF, fontSize: 16, color: 'var(--l-3)', textAlign: 'center', fontStyle: 'italic' }}>The reading for this code is being written.</p>
        )}

        {invLines.length > 0 && (
          <div style={{ marginTop: 'clamp(48px,6vw,72px)' }}>
            <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(26px,3.2vw,32px)', color: 'var(--accent)', textAlign: 'center', margin: '0 0 28px' }}>Invocation</h3>
            <div style={{ borderTop: '1px solid var(--accent)', borderBottom: '1px solid var(--accent)', padding: 'clamp(28px,4vw,40px) 0', maxWidth: '48ch', margin: '0 auto', borderImage: 'linear-gradient(90deg,transparent,var(--accent),transparent) 1' }}>
              <p style={{ fontFamily: SERIF, fontSize: 'clamp(18px,2vw,21px)', lineHeight: 1.85, color: 'var(--l-1)', textAlign: 'center', margin: 0 }}>
                {invLines.map((l, i) => <React.Fragment key={i}>{l}{i < invLines.length - 1 && <br />}</React.Fragment>)}
              </p>
            </div>
          </div>
        )}

        <NextButton rule="var(--l-rule)" sub="var(--l-3)" main="var(--l-1)" accent="var(--accent)" kicker="Next" label="I Ching" onClick={onNext} />
      </div>
    </section>
  );
};

/* ════════════ 2 · I CHING (recess) ════════════ */
export const IChingPanel: React.FC<{
  card: OracleCard; synthesis?: CardSynthesis; expanded?: ExpandedCard;
  hexChar: string; hexPinyin: string;
  ivSel: 'hex' | 'upper' | 'lower'; setIvSel: (v: 'hex' | 'upper' | 'lower') => void;
  cast: CastResult | null; setCast: (c: CastResult | null) => void;
  onAbout: () => void; onNext: () => void; register: Reg;
}> = ({ card, synthesis, expanded, hexChar, hexPinyin, ivSel, setIvSel, cast, setCast, onAbout, onNext, register }) => {
  const ich = card.iching;
  const upperName = cleanTrig(ich.upper_trigram.name);
  const lowerName = cleanTrig(ich.lower_trigram.name);
  const comboText = ivSel === 'hex'
    ? (synthesis?.synthesis.iching.trigram_combination ?? ich.essence)
    : ivSel === 'upper' ? ich.upper_trigram.nature : ich.lower_trigram.nature;
  const comboLabel = ivSel === 'hex' ? 'Combination' : ivSel === 'upper' ? 'Upper nature' : 'Lower nature';

  const readingParas = paras(synthesis?.synthesis.iching.reading);
  const judgement = synthesis?.synthesis.iching.judgement_lines ?? [];
  const image = synthesis?.synthesis.iching.image_lines ?? [];

  const movingNums = cast?.movingPositions ?? [];
  const changed = cast?.changedNumber != null ? CARD_BY_NUMBER.get(cast.changedNumber) : undefined;

  return (
    <section data-chapter="iching" ref={register} style={{ ...panelShell('var(--d-bg)', 'var(--d-1)'), overflowX: 'clip' }}>
      <div style={PANEL_INNER}>
        <header style={{ textAlign: 'center', marginBottom: 'clamp(40px,5vw,60px)' }}>
          <button onClick={onAbout} aria-label="About the I Ching" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 18, color: 'inherit' }}>
            <span style={{ fontFamily: CJK, fontSize: 'clamp(60px,9vw,80px)', lineHeight: 1, color: 'var(--accent-d)' }} title={hexPinyin}>{hexChar}</span>
            <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'var(--accent-d)', borderBottom: '1px solid var(--d-rule)', paddingBottom: 6 }}>Two · I Ching · about ↓</span>
          </button>
        </header>

        {/* hex / upper / lower selector — full-bleed */}
        <div style={{ borderTop: '1px solid var(--d-rule)', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', width: '100vw' }}>
          <button onClick={() => setIvSel('hex')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', background: ivSel === 'hex' ? 'rgba(199,160,91,0.10)' : 'none', border: 'none', borderBottom: '1px solid var(--d-rule)', cursor: 'pointer', padding: '20px clamp(22px,5vw,76px)', color: 'inherit' }}>
            <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--d-3)', width: 64, flexShrink: 0 }}>Guà {card.number}</span>
            <LineStack n={6} w={34} h={4} gap={3} color="var(--accent-d)" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: SERIF, fontSize: 19, color: 'var(--d-1)', lineHeight: 1.2 }}>{ich.hexagram_name}</span>
              <span style={{ display: 'block', fontFamily: SERIF, fontSize: 14, color: 'var(--d-3)' }}>{upperName} over {lowerName}</span>
            </span>
            <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--d-3)', flexShrink: 0 }}>Hexagram</span>
          </button>
          <button onClick={() => setIvSel('upper')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', background: ivSel === 'upper' ? 'rgba(199,160,91,0.10)' : 'none', border: 'none', borderBottom: '1px solid var(--d-rule)', cursor: 'pointer', padding: '15px clamp(22px,5vw,76px)', color: 'inherit' }}>
            <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--d-3)', width: 64, flexShrink: 0 }}>Upper</span>
            <LineStack n={3} w={30} h={4} gap={3} color={ivSel === 'upper' ? 'var(--accent-d)' : 'var(--d-3)'} />
            <span style={{ flex: 1, fontFamily: SERIF, fontSize: 17, color: 'var(--d-2)' }}>{ich.upper_trigram.name}</span>
            <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--d-3)', flexShrink: 0 }}>Trigram</span>
          </button>
          <button onClick={() => setIvSel('lower')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', background: ivSel === 'lower' ? 'rgba(199,160,91,0.10)' : 'none', border: 'none', borderBottom: '1px solid var(--d-rule)', cursor: 'pointer', padding: '15px clamp(22px,5vw,76px)', color: 'inherit' }}>
            <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--d-3)', width: 64, flexShrink: 0 }}>Lower</span>
            <LineStack n={3} w={30} h={4} gap={3} color={ivSel === 'lower' ? 'var(--accent-d)' : 'var(--d-3)'} />
            <span style={{ flex: 1, fontFamily: SERIF, fontSize: 17, color: 'var(--d-2)' }}>{ich.lower_trigram.name}</span>
            <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--d-3)', flexShrink: 0 }}>Trigram</span>
          </button>
          <div style={{ padding: '26px clamp(22px,5vw,76px) 8px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, paddingTop: 3 }}>
              <LineStack n={6} w={56} h={6} gap={7} color="var(--accent-d)" />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-d)', margin: '0 0 12px' }}>{comboLabel}</p>
              <div style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.78, color: 'var(--d-2)' }}>{comboText}</div>
            </div>
          </div>
        </div>

        {/* the reading */}
        {readingParas.length > 0 && (
          <div style={{ marginTop: 'clamp(40px,5vw,56px)' }}>
            <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent-d)', margin: '0 0 18px' }}>The Reading</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {readingParas.map((p, i) => (
                <p key={i} style={{ fontFamily: SERIF, fontSize: 'clamp(18px,2vw,20px)', lineHeight: 1.66, color: i === 0 ? 'var(--d-1)' : 'var(--d-2)', margin: 0 }}>{p}</p>
              ))}
            </div>
          </div>
        )}

        {/* judgement + image */}
        {(judgement.length > 0 || image.length > 0) && (
          <div style={{ marginTop: 'clamp(36px,4vw,48px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 28 }}>
            {judgement.length > 0 && (
              <div style={{ borderTop: '1px solid var(--d-rule)', paddingTop: 18 }}>
                <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent-d)', margin: '0 0 14px' }}>The Judgement</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 1.75, color: 'var(--d-1)', margin: 0 }}>
                  {judgement.map((l, i) => <React.Fragment key={i}>{l}{i < judgement.length - 1 && <br />}</React.Fragment>)}
                </p>
              </div>
            )}
            {image.length > 0 && (
              <div style={{ borderTop: '1px solid var(--d-rule)', paddingTop: 18 }}>
                <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent-d)', margin: '0 0 14px' }}>The Image</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 1.75, color: 'var(--d-1)', margin: 0 }}>
                  {image.map((l, i) => <React.Fragment key={i}>{l}{i < image.length - 1 && <br />}</React.Fragment>)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* coin cast ritual */}
        <div style={{ marginTop: 'clamp(44px,6vw,64px)', border: '1px solid var(--d-rule)', padding: 'clamp(24px,4vw,38px)', background: 'var(--d-soft)' }}>
          <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent-d)', textAlign: 'center', margin: '0 0 8px' }}>The Oracle</p>
          <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(22px,2.6vw,27px)', color: 'var(--d-1)', textAlign: 'center', margin: '0 0 6px' }}>Cast the coins</h3>
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 16, color: 'var(--d-3)', textAlign: 'center', margin: '0 auto 24px', maxWidth: '42ch' }}>Three coins, six times. The throw shows which lines are moving for you now — the places this hexagram is already turning into another.</p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {['乾', '坤', '乾'].map((g, i) => (
                <span key={i} style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--d-rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: CJK, fontSize: 20, color: 'var(--accent-d)' }}>{g}</span>
              ))}
            </div>
          </div>

          {cast ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, animation: 'ulFadeIn 500ms ease both' }}>
              <CastHexagram cast={cast} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--d-3)' }}>{changed ? 'Moving toward' : 'Your cast'}</span>
                <span style={{ fontFamily: SERIF, fontSize: 'clamp(26px,3.6vw,34px)', lineHeight: 1.12, color: 'var(--d-1)' }}>
                  {changed ? `${changed.card_name}` : ich.hexagram_name}
                </span>
              </div>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, lineHeight: 1.6, color: 'var(--d-2)', textAlign: 'center', maxWidth: '44ch', margin: 0 }}>
                {movingNums.length === 0
                  ? 'No lines are moving. The situation is steady — read the hexagram as it stands.'
                  : `${movingNums.length} line${movingNums.length > 1 ? 's are' : ' is'} moving. The reading is already turning toward ${changed?.card_name ?? 'another hexagram'}.`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => setCast(castForHexagram(card.number))} style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--d-bg)', background: 'var(--accent-d)', border: 'none', cursor: 'pointer', padding: '14px 32px' }}>Cast the coins</button>
            </div>
          )}
        </div>

        {/* moving lines */}
        {cast && movingNums.length > 0 && (
          <div style={{ marginTop: 'clamp(40px,5vw,56px)' }}>
            <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent-d)', margin: '0 0 6px' }}>Your Moving Lines</p>
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 15, color: 'var(--d-3)', margin: '0 0 22px' }}>The places this hexagram is already turning — the lines your throw set in motion.</p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {movingNums.map(pos => (
                <div key={pos} style={{ borderTop: '1px solid var(--d-rule)', padding: '18px 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start' }}>
                  <span style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1, color: 'var(--accent-d)', opacity: 0.7, width: 32 }}>{pos}</span>
                  <div>
                    <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.7, color: 'var(--d-2)', margin: 0 }}>{getLineText(card.number, pos)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <NextButton rule="var(--d-rule)" sub="var(--d-3)" main="var(--d-1)" accent="var(--accent-d)" kicker="Next" label="Gene Keys" onClick={onNext} />
      </div>
    </section>
  );
};

/* cast hexagram — the template's castBar: lines build from the bottom up with a
   staggered ulLineCast, moving lines drawn brighter and glowing. */
const CastHexagram: React.FC<{ cast: CastResult }> = ({ cast }) => {
  const motionOn = typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const H = 7, W = 92, GAP = 10;
  const seg = (W - GAP) / 2;
  // render top row (line 6) first; build delay counts from the bottom (line 1)
  const rows = [6, 5, 4, 3, 2, 1];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'center' }}>
      {rows.map(lineNum => {
        const ln = cast.lines[lineNum - 1];
        const moving = cast.movingPositions.includes(lineNum);
        const yang = ln?.value === 7 || ln?.value === 9;
        const color = moving ? 'var(--accent)' : 'var(--accent-d)';
        const glow = moving ? '0 0 10px 1px var(--accent)' : 'none';
        const delay = motionOn ? (lineNum - 1) * 130 : 0;
        const anim = motionOn ? `ulLineCast 520ms cubic-bezier(.16,1,.3,1) ${delay}ms both` : 'none';
        return (
          <span key={lineNum} style={{ width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transformOrigin: 'center', animation: anim }}>
            {yang
              ? <span style={{ width: W, height: H, background: color, display: 'block', boxShadow: glow }} />
              : <span style={{ display: 'flex', gap: GAP, width: W }}>
                  <span style={{ width: seg, height: H, background: color, display: 'block', boxShadow: glow }} />
                  <span style={{ width: seg, height: H, background: color, display: 'block', boxShadow: glow }} />
                </span>}
          </span>
        );
      })}
    </div>
  );
};

/* ════════════ 3 · GENE KEYS ════════════ */
export const GeneKeysPanel: React.FC<{
  card: OracleCard; synthesis?: CardSynthesis; expanded?: ExpandedCard;
  onAbout: () => void; onNext: () => void; register: Reg;
}> = ({ card, synthesis, expanded, onAbout, onNext, register }) => {
  const gk = card.gene_keys;
  const refs = {
    shadow: synthesis?.synthesis.gene_keys.shadow ?? expanded?.gene_keys.shadow?.expanded?.text ?? gk.description,
    gift: synthesis?.synthesis.gene_keys.gift ?? expanded?.gene_keys.gift?.expanded?.text ?? '',
    siddhi: synthesis?.synthesis.gene_keys.siddhi ?? expanded?.gene_keys.siddhi?.expanded?.text ?? '',
  };
  const subtitles = {
    shadow: expanded?.gene_keys.shadow?.contemplation_title,
    gift: expanded?.gene_keys.gift?.contemplation_title,
    siddhi: expanded?.gene_keys.siddhi?.contemplation_title,
  };
  const tones: { key: 'shadow' | 'gift' | 'siddhi'; label: string; name: string }[] = [
    { key: 'shadow', label: 'Shadow', name: gk.shadow },
    { key: 'gift', label: 'Gift', name: gk.gift },
    { key: 'siddhi', label: 'Siddhi', name: gk.siddhi },
  ];

  return (
    <section data-chapter="genekeys" ref={register} style={panelShell('var(--l-bg)', 'var(--l-1)')}>
      <div style={PANEL_INNER}>
        <header style={{ textAlign: 'center', marginBottom: 'clamp(36px,5vw,52px)' }}>
          <button onClick={onAbout} aria-label="About the Gene Keys" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: 'inherit' }}>
            <svg width="64" height="64" viewBox="0 0 100 100" fill="var(--accent)" aria-hidden="true">
              <circle cx="50" cy="14" r="4.4" /><path d="M 47.8 19 L 52.2 19 L 51.5 84 Q 50 87.5 48.5 84 Z" />
              <ellipse cx="25" cy="28" rx="23" ry="4.2" transform="rotate(-4 25 28)" /><ellipse cx="75" cy="28" rx="23" ry="4.2" transform="rotate(4 75 28)" />
              <ellipse cx="28" cy="41" rx="20" ry="3.8" transform="rotate(7 28 41)" /><ellipse cx="72" cy="41" rx="20" ry="3.8" transform="rotate(-7 72 41)" />
            </svg>
            <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'var(--accent)', borderBottom: '1px solid var(--l-rule)', paddingBottom: 6 }}>Three · Gene Keys · about ↓</span>
          </button>
        </header>

        {/* spectrum */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: '1px solid var(--l-rule)', marginBottom: 'clamp(32px,4vw,44px)' }}>
          {tones.map((t, i) => {
            const gift = t.key === 'gift';
            return (
              <div key={t.key} style={{ padding: '18px 12px', textAlign: 'center', borderRight: i < 2 ? '1px solid var(--l-rule)' : 'none', background: gift ? 'color-mix(in oklab,var(--accent) 8%,transparent)' : 'none' }}>
                <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: gift ? 'var(--accent)' : 'var(--l-3)', margin: '0 0 6px' }}>{t.label}</p>
                <p style={{ fontFamily: SERIF, fontSize: 21, color: gift ? 'var(--accent)' : 'var(--l-1)', margin: 0 }}>{t.name}</p>
              </div>
            );
          })}
        </div>

        {/* the three levels */}
        {tones.map(t => {
          const text = paras(refs[t.key]);
          return (
            <div key={t.key} style={{ borderTop: '1px solid var(--l-rule)', padding: '24px 0' }}>
              <p style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--accent)', margin: '0 0 4px' }}>{t.label}</p>
              <p style={{ fontFamily: SERIF, fontSize: 21, color: 'var(--l-1)', margin: '0 0 2px' }}>{t.name}</p>
              {subtitles[t.key] && <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--l-3)', margin: '0 0 16px' }}>{subtitles[t.key]}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: subtitles[t.key] ? 0 : 16 }}>
                {text.length > 0 ? text.map((p, i) => (
                  <p key={i} style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.78, color: 'var(--l-2)', margin: 0 }}>{p}</p>
                )) : <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 15, color: 'var(--l-3)', margin: 0 }}>To be written.</p>}
              </div>
            </div>
          );
        })}

        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 14, color: 'var(--l-3)', lineHeight: 1.5, marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--l-rule)' }}>
          Gene Keys text based on the work of Richard Rudd. Dive deeper at <a href="https://genekeys.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>genekeys.com</a>.
        </p>

        <NextButton rule="var(--l-rule)" sub="var(--l-3)" main="var(--l-1)" accent="var(--accent)" kicker="Next" label="Human Design" onClick={onNext} />
      </div>
    </section>
  );
};

/* ════════════ 4 · HUMAN DESIGN (recess) ════════════ */
export const HumanDesignPanel: React.FC<{
  card: OracleCard; synthesis?: CardSynthesis; onAbout: () => void; onNext: () => void; register: Reg;
}> = ({ card, synthesis, onAbout, onNext, register }) => {
  const hd = card.human_design;
  const sy = synthesis?.synthesis.human_design;
  const blocks = [
    { label: 'The Drive', title: `Gate ${hd.gate} · ${synthesis?.reference?.hd_keyword ?? hd.keyword}`, text: sy?.gate ?? hd.description },
    { label: 'Where It Lives', title: synthesis?.reference?.hd_center ?? 'The Centre', text: sy?.channel ?? '' },
    { label: 'What Completes It', title: synthesis?.reference?.hd_harmonic_gate ? `Channel · Gate ${hd.gate}–${synthesis.reference.hd_harmonic_gate}` : 'The Channel', text: sy?.circuit ?? '' },
  ].filter(b => b.text);

  const chips = [
    `Gate ${hd.gate}`,
    synthesis?.reference?.hd_center,
    synthesis?.reference?.hd_harmonic_gate ? `Channel ${hd.gate}–${synthesis.reference.hd_harmonic_gate}` : null,
  ].filter(Boolean) as string[];

  return (
    <section data-chapter="humandesign" ref={register} style={panelShell('var(--d-bg)', 'var(--d-1)')}>
      <div style={PANEL_INNER}>
        <header style={{ textAlign: 'center', marginBottom: 'clamp(38px,5vw,56px)' }}>
          <button onClick={onAbout} aria-label="About Human Design" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'inherit' }}>
            <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent-d)', opacity: 0.8 }}>Gate</span>
            <span style={{ fontFamily: SERIF, fontSize: 'clamp(58px,8vw,74px)', lineHeight: 0.9, color: 'var(--accent-d)' }}>{hd.gate}</span>
            <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'var(--accent-d)', borderBottom: '1px solid var(--d-rule)', paddingBottom: 6, marginTop: 10 }}>Four · Human Design · about ↓</span>
          </button>
        </header>

        {blocks.map((b, i) => (
          <div key={i} style={{ borderTop: '1px solid var(--d-rule)', padding: '26px 0' }}>
            <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-d)', margin: '0 0 4px' }}>{b.label}</p>
            <p style={{ fontFamily: SERIF, fontSize: 21, color: 'var(--d-1)', margin: '0 0 16px' }}>{b.title}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {paras(b.text).map((p, j) => <p key={j} style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.78, color: 'var(--d-2)', margin: 0 }}>{p}</p>)}
            </div>
          </div>
        ))}

        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            {chips.map((c, i) => <span key={i} style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.12em', color: 'var(--d-2)', border: '1px solid var(--d-rule)', padding: '7px 13px' }}>{c}</span>)}
          </div>
        )}

        <NextButton rule="var(--d-rule)" sub="var(--d-3)" main="var(--d-1)" accent="var(--accent-d)" kicker="Next" label="Body" onClick={onNext} />
      </div>
    </section>
  );
};

/* ════════════ 5 · BODY ════════════ */
export const BodyPanel: React.FC<{
  card: OracleCard; synthesis?: CardSynthesis; onNext: () => void; register: Reg;
}> = ({ card, synthesis, onNext, register }) => {
  const by = synthesis?.synthesis.body;
  const physiology = synthesis?.reference?.body_physiology;
  const amino = synthesis?.reference?.body_amino_acid;
  const chips = [
    physiology ? `Organ · ${physiology}` : null,
    amino ? `Amino acid · ${amino}` : null,
    synthesis?.ring_name,
  ].filter(Boolean) as string[];

  return (
    <section data-chapter="body" ref={register} style={panelShell('var(--l-bg)', 'var(--l-1)')}>
      <div style={PANEL_INNER}>
        <p style={eyebrow('var(--accent)')}>Five · Body</p>
        <h2 style={{ ...bigTitle('var(--l-1)'), margin: '0 0 clamp(34px,5vw,52px)' }}>The Body of the Code</h2>

        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 'clamp(32px,4vw,48px)' }}>
            {chips.map((c, i) => <span key={i} style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.12em', color: 'var(--l-2)', border: '1px solid var(--l-rule)', padding: '7px 14px' }}>{c}</span>)}
          </div>
        )}

        {by?.physiology && (
          <div style={{ borderTop: '1px solid var(--l-rule)', padding: '24px 0' }}>
            <p style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--accent)', margin: '0 0 14px' }}>Physiology{physiology ? ` · ${physiology}` : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {paras(by.physiology).map((p, i) => <p key={i} style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.78, color: 'var(--l-2)', margin: 0 }}>{p}</p>)}
            </div>
          </div>
        )}
        {by?.amino_acid && (
          <div style={{ borderTop: '1px solid var(--l-rule)', padding: '24px 0' }}>
            <p style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--accent)', margin: '0 0 14px' }}>Amino Acid{amino ? ` · ${amino}` : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {paras(by.amino_acid).map((p, i) => <p key={i} style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.78, color: 'var(--l-2)', margin: 0 }}>{p}</p>)}
            </div>
          </div>
        )}
        {!by && <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 15, color: 'var(--l-3)', textAlign: 'center' }}>The body reading for this code is being written.</p>}

        <NextButton rule="var(--l-rule)" sub="var(--l-3)" main="var(--l-1)" accent="var(--accent)" kicker="Next" label="Relations" onClick={onNext} />
      </div>
    </section>
  );
};

/* ════════════ 6 · RELATIONS ════════════ */
export const RelationsPanel: React.FC<{
  card: OracleCard; synthesis?: CardSynthesis; expanded?: ExpandedCard;
  placement: ReturnType<typeof import('../../../lib/atlas/state').useCardPlacement> extends never ? any : any;
  navigate: (to: string, opts?: any) => void; hexChar: string;
  onNext: () => void; register: Reg;
}> = ({ card, synthesis, expanded, placement, navigate, hexChar, onNext, register }) => {
  const rel = synthesis?.relations;
  const unity = rel?.unity_line ?? (expanded ? expanded.i_ching.hexagrams_in_pairs.context.text : undefined);
  const pairNumber = rel?.pair?.number ?? expanded?.i_ching.hexagrams_in_pairs.pair_hexagram;
  const pairCard = pairNumber != null ? CARD_BY_NUMBER.get(pairNumber) : undefined;
  const partnerNumber = rel?.programming_partner?.number ?? expanded?.gene_keys.programming_partner?.number;
  const partnerCard = partnerNumber != null ? CARD_BY_NUMBER.get(partnerNumber) : undefined;
  const ringName = rel?.codon_ring?.name ?? expanded?.gene_keys.codon_ring.name;
  const siblings = card.codon_ring_siblings ?? [];

  // radial kin constellation: self centre, kin nodes around
  const nodes: { card?: OracleCard; glyph: string; label: string; x: number; y: number; dim: number; onSelect?: () => void }[] = [];
  if (pairCard) nodes.push({ card: pairCard, glyph: HEXAGRAM_CHINESE[pairCard.number]?.char ?? String(pairCard.number), label: `UL ${pairCard.number} · ${cleanTrig(pairCard.iching.hexagram_name)}`, x: 24, y: 50, dim: 60, onSelect: () => navigate(`/universal-language/${pairCard.number}`, { state: { ritual: true } }) });
  if (partnerCard) nodes.push({ card: partnerCard, glyph: HEXAGRAM_CHINESE[partnerCard.number]?.char ?? String(partnerCard.number), label: `UL ${partnerCard.number} · Partner`, x: 76, y: 50, dim: 60, onSelect: () => navigate(`/universal-language/${partnerCard.number}`, { state: { ritual: true } }) });
  siblings.slice(0, 4).forEach((n, i) => {
    const sib = CARD_BY_NUMBER.get(n); if (!sib) return;
    const positions = [{ x: 28, y: 18 }, { x: 72, y: 18 }, { x: 28, y: 82 }, { x: 72, y: 82 }];
    const p = positions[i] ?? { x: 50, y: 12 };
    nodes.push({ card: sib, glyph: HEXAGRAM_CHINESE[sib.number]?.char ?? String(sib.number), label: `UL ${sib.number}`, x: p.x, y: p.y, dim: 52, onSelect: () => navigate(`/universal-language/${sib.number}`, { state: { ritual: true } }) });
  });

  const tarot = rel?.tarot?.teaching ?? synthesis?.synthesis.tarot.tarot_resonance;
  const tarotName = rel?.tarot?.card ?? synthesis?.reference?.tarot_card ?? card.ring_tarot;

  return (
    <section data-chapter="relations" ref={register} style={panelShell('var(--l-soft)', 'var(--l-1)')}>
      <div style={PANEL_INNER}>
        <p style={eyebrow('var(--accent)')}>Six · Relations</p>
        <h2 style={{ ...bigTitle('var(--l-1)'), margin: '0 0 24px' }}>Its Kin</h2>
        {unity && (
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.55, color: 'var(--l-2)', textAlign: 'center', maxWidth: '46ch', margin: '0 auto clamp(36px,5vw,52px)' }}>{unity}</p>
        )}

        {/* kin constellation */}
        <div style={{ margin: '0 auto clamp(22px,3.5vw,34px)', maxWidth: 540 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'visible' }}>
            {/* connecting lines */}
            <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} aria-hidden="true">
              {nodes.map((n, i) => (
                <line key={i} x1={50} y1={50} x2={n.x} y2={n.y} stroke="var(--accent)" strokeWidth={0.4} opacity={0.5} />
              ))}
            </svg>
            {/* self */}
            <button onClick={() => {}} aria-label={`${card.card_name}, returns to itself`} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'default', padding: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'clamp(72px,18.5vw,94px)', height: 'clamp(72px,18.5vw,94px)', borderRadius: '50%', background: 'var(--l-bg)', border: '1.5px solid var(--accent)', boxShadow: '0 0 0 7px color-mix(in oklab,var(--accent) 7%,transparent),0 12px 32px -14px rgba(40,34,25,0.55)', fontFamily: CJK, fontSize: 'clamp(32px,8.5vw,46px)', lineHeight: 1, color: 'var(--accent)' }}>{hexChar}</span>
              <span style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-2)' }}>{card.card_name}</span>
            </button>
            {/* kin */}
            {nodes.map((n, i) => (
              <button key={i} onClick={n.onSelect} aria-label={n.label} style={{ position: 'absolute', left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', width: 88, padding: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: n.dim, height: n.dim, borderRadius: '50%', background: 'var(--l-bg)', border: '1px solid var(--accent)', fontFamily: CJK, fontSize: n.dim * 0.5, lineHeight: 1, color: 'var(--accent)', boxShadow: '0 3px 12px -5px rgba(40,34,25,0.4)' }}>{n.glyph}</span>
                <span style={{ fontFamily: SANS, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--l-3)', lineHeight: 1.3, textAlign: 'center' }}>{n.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: SANS, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--l-3)' }}><span style={{ width: 18, borderTop: '2px solid var(--accent)' }} />Kin in the deck</span>
          </div>
        </div>

        {/* pair teaching / tarot resonance block */}
        {(rel?.pair?.teaching || tarot) && (
          <div style={{ borderTop: '1px solid var(--l-rule)', borderBottom: '1px solid var(--l-rule)', padding: '24px 0' }}>
            <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 7px' }}>{pairCard ? 'The Pair' : 'Tarot Resonance'}</p>
            <p style={{ fontFamily: SERIF, fontSize: 'clamp(23px,3.4vw,28px)', lineHeight: 1.12, color: 'var(--l-1)', margin: '0 0 14px' }}>{pairCard ? pairCard.card_name : tarotName}</p>
            {paras(rel?.pair?.teaching ?? tarot).map((p, i) => (
              <p key={i} style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(18px,2.4vw,21px)', lineHeight: 1.62, letterSpacing: '0.01em', color: 'var(--l-2)', margin: '0 0 14px' }}>{p}</p>
            ))}
          </div>
        )}

        {/* on the atlas */}
        {placement && (
          <div style={{ marginTop: 'clamp(28px,4vw,40px)', textAlign: 'center' }}>
            <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>On the Atlas</p>
            <p style={{ fontFamily: SERIF, fontSize: 18, color: 'var(--l-1)', margin: '0 0 8px' }}>{placement.status === 'placed' && placement.cityLabel ? `The original rests in ${placement.cityLabel}.` : 'The original is still seeking its ground.'}</p>
            <a href={`/atlas?piece=${encodeURIComponent(placement.editionNumber != null ? `${placement.pieceId}:${placement.editionNumber}` : placement.pieceId)}`} style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }}>See it on the Atlas →</a>
          </div>
        )}

        <NextButton rule="var(--l-rule)" sub="var(--l-3)" main="var(--l-1)" accent="var(--accent)" kicker="Return to" label="The Reading" arrow="↺" onClick={onNext} />
      </div>
    </section>
  );
};
