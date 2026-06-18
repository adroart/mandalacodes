import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { getExpandedCard } from '../data/expandedOracleData';
import { getSynthesis, getInvocation, type CardSynthesis } from '../data/synthesisData';
import { img } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';
import EBEntrance from './oracle/eb/EBEntrance';
import SystemOverlay, { type SystemKey } from './SystemOverlay';
import { HEXAGRAM_CHINESE } from '../data/hexagramChinese';
import ImageViewer from './oracle/ImageViewer';
import BuySheet from './oracle/BuySheet';
import { type CastResult } from '../utils/ichingCasting';
import { ulCardImageUrl, ulCardPublicId, ulPieceForCard } from '../utils/universalLanguage';
import { useCardPlacement } from '../lib/atlas/state';
import { SERIF, SANS, CJK } from './oracle/eb/ebStyle';
import {
  ULPanel, IChingPanel, GeneKeysPanel, HumanDesignPanel, BodyPanel, RelationsPanel,
} from './oracle/eb/EBPanels';
import { useDarkMode } from '../DarkModeContext';
import './oracle/eb/eb-template.css';

/* ════════════════════════════════════════════════════════════════════════════
   EARTH'S BREATH READING

   A faithful build of the imported "Earth's Breath Reading" template, fed by
   the live card data. The whole reading uses the template's own CSS-var palette
   (`.eb-reading` in src/index.css): --l-* = the main paper surface, --d-* = the
   warm feature-panel recess (I Ching + Human Design), --accent the antique gold.
   Day Book = light, Nightfall = dark (driven by the site's .dark class).

   Layout: sticky top bar · hero (artwork + keywords + Acquire/Share) · sticky
   chapter nav · horizontal swipe stage of six system panels. Entrance, lightbox,
   BuySheet (Acquire) and SystemOverlay reuse the existing components; the panels
   live in ./oracle/eb/EBPanels.
   ════════════════════════════════════════════════════════════════════════════ */

const seenEntrances = new Set<number>();

export type ChapterKey = 'ul' | 'iching' | 'genekeys' | 'humandesign' | 'body' | 'tarot';

const CHAPTERS: { key: ChapterKey; label: string; two?: [string, string] }[] = [
  { key: 'ul',          label: 'Universal' },
  { key: 'iching',      label: 'I Ching' },
  { key: 'genekeys',    label: 'Gene Keys',    two: ['Gene', 'Keys'] },
  { key: 'humandesign', label: 'Human Design', two: ['Human', 'Design'] },
  { key: 'body',        label: 'Body' },
  { key: 'tarot',       label: 'Relations' },
];

const UniversalLanguageCard: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useDarkMode();
  const palette = isDarkMode ? 'nightfall' : 'daybook';
  const cardNum = parseInt(number ?? '', 10);
  const card = CARD_BY_NUMBER.get(cardNum);
  const expanded = getExpandedCard(cardNum);

  const [synthesis, setSynthesis] = useState<CardSynthesis | undefined>(undefined);
  const [invocation, setInvocation] = useState<string | undefined>(undefined);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxOrigin, setLightboxOrigin] = useState<DOMRect | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [systemOverlay, setSystemOverlay] = useState<SystemKey | null>(null);
  const [ivSel, setIvSel] = useState<'hex' | 'upper' | 'lower'>('hex');
  const [cast, setCast] = useState<CastResult | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialChapter = (() => {
    const s = searchParams.get('system');
    const valid: ChapterKey[] = ['ul', 'iching', 'genekeys', 'humandesign', 'body', 'tarot'];
    return valid.includes(s as ChapterKey) ? (s as ChapterKey) : 'ul';
  })();
  const [activeChapter, setActiveChapter] = useState<ChapterKey>(initialChapter);

  const stageRef = useRef<HTMLDivElement>(null);
  const panelEls = useRef<Map<string, HTMLElement>>(new Map());
  const placement = useCardPlacement(cardNum);

  const [showEntrance, setShowEntrance] = useState(() => {
    const willShow = !seenEntrances.has(cardNum);
    if (willShow) seenEntrances.add(cardNum);
    return willShow;
  });

  useEffect(() => {
    document.documentElement.classList.add('oracle-card-page');
    return () => document.documentElement.classList.remove('oracle-card-page');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSynthesis(undefined); setInvocation(undefined); setCast(null); setIvSel('hex');
    getSynthesis(cardNum).then(d => { if (!cancelled) setSynthesis(d); }).catch(() => {});
    getInvocation(cardNum).then(v => { if (!cancelled) setInvocation(v); }).catch(() => {});
    window.scrollTo(0, 0);
    return () => { cancelled = true; };
  }, [cardNum]);

  const sortedNums = ALL_CARDS.map(c => c.number);
  const currentIdx = sortedNums.indexOf(cardNum);
  const prevCardNum = currentIdx > 0 ? sortedNums[currentIdx - 1] : null;
  const nextCardNum = currentIdx < sortedNums.length - 1 ? sortedNums[currentIdx + 1] : null;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prevCardNum !== null) navigate(`/universal-language/${prevCardNum}`, { state: { ritual: true } });
      if (e.key === 'ArrowRight' && nextCardNum !== null) navigate(`/universal-language/${nextCardNum}`, { state: { ritual: true } });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevCardNum, nextCardNum, navigate]);

  const go = useCallback((key: ChapterKey) => {
    setActiveChapter(key);
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('system', key); return n; }, { replace: true });
    const el = panelEls.current.get(key);
    const stage = stageRef.current;
    if (el && stage) stage.scrollTo({ left: el.offsetLeft, behavior: 'smooth' });
  }, [setSearchParams]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = stage.scrollLeft + stage.clientWidth / 2;
        let best: ChapterKey = 'ul'; let bestD = Infinity;
        panelEls.current.forEach((el, key) => {
          const c = el.offsetLeft + el.clientWidth / 2;
          const d = Math.abs(c - mid);
          if (d < bestD) { bestD = d; best = key as ChapterKey; }
        });
        setActiveChapter(prev => (prev === best ? prev : best));
      });
    };
    stage.addEventListener('scroll', onScroll, { passive: true });
    return () => stage.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = panelEls.current.get(activeChapter);
    const stage = stageRef.current;
    if (el && stage) stage.scrollLeft = el.offsetLeft;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardNum]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = card ? `${card.card_name} · Code ${card.number} · Universal Language Oracle by Adrian Rasmussen` : '';
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  useMetaTags({
    title: card ? `${card.card_name} · Code ${cardNum} · Universal Language Oracle` : undefined,
    description: card ? `${card.iching.hexagram_name} · ${card.gene_keys.shadow} / ${card.gene_keys.gift} / ${card.gene_keys.siddhi}. Universal Language Oracle by Adrian Rasmussen.` : undefined,
    image: card ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${ulCardPublicId(cardNum) ?? 'adrian-website/placeholders/oracle-card-3'}` : undefined,
  });

  if (!card) {
    return (
      <div className="eb-reading" style={{ minHeight: '100vh', background: 'var(--l-bg)', color: 'var(--l-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <p style={{ fontFamily: SERIF, fontSize: 26, color: 'var(--l-1)', margin: '0 0 12px' }}>This card has not yet arrived.</p>
          <Link to="/universal-language" style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }}>Return to the oracle</Link>
        </div>
      </div>
    );
  }

  const piece = ulPieceForCard(card.number);
  const cardPublicId = ulCardPublicId(card.number);
  const imageAlt = `${card.card_name}, Universal Language ${card.number}. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`;
  const keywords = synthesis?.keywords ?? expanded?.keywords ?? [];
  const hexChar = HEXAGRAM_CHINESE[card.number]?.char ?? String(card.number);
  const hexPinyin = HEXAGRAM_CHINESE[card.number]?.pinyin ?? '';
  const code2 = String(card.number).padStart(2, '0');

  const openLightbox = (rect: DOMRect | null) => { setLightboxOrigin(rect); setLightboxOpen(true); };

  return (
    <div className="eb-reading eb-grain" data-palette={palette} style={{ minHeight: '100vh', background: 'var(--l-bg)', color: 'var(--l-1)', fontFamily: SANS, position: 'relative' }}>

      {showEntrance && <EBEntrance card={card} keywords={keywords} palette={palette} onDone={() => setShowEntrance(false)} />}

      <ImageViewer open={lightboxOpen} src={ulCardImageUrl(card.number, 1200)} alt={imageAlt} originRect={lightboxOrigin} onClose={() => setLightboxOpen(false)} />
      <BuySheet open={buyOpen} onClose={() => setBuyOpen(false)} piece={piece ?? null} imageUrl={ulCardImageUrl(card.number, 360)} imageAlt={imageAlt} cardName={card.card_name} cardNumber={card.number} />
      <SystemOverlay open={systemOverlay !== null} systemKey={systemOverlay ?? 'iching'} glyph={<span style={{ fontFamily: CJK, fontSize: 96, color: 'var(--accent)' }}>{hexChar}</span>} onClose={() => setSystemOverlay(null)} />

      {/* ════ TOP BAR ════ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 90, background: 'color-mix(in oklab,var(--l-bg) 88%,transparent)', backdropFilter: 'saturate(1.1) blur(10px)', WebkitBackdropFilter: 'saturate(1.1) blur(10px)', borderBottom: '1px solid var(--l-rule)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '8px 22px' }}>
          <span style={{ fontFamily: SERIF, fontSize: 16, letterSpacing: '0.04em', color: 'var(--l-1)' }}>Universal Language</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link to="/universal-language" aria-label="The sixty-four codes" title="The 64 codes" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--l-2)', padding: '4px 8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.1" /></svg>
            </Link>
            <span style={{ width: 1, height: 13, background: 'var(--l-rule)' }} />
            <button onClick={() => setBuyOpen(true)} style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px' }}>Acquire</button>
            <span style={{ width: 1, height: 13, background: 'var(--l-rule)' }} />
            <button onClick={() => setShareOpen(v => !v)} style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--l-2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px' }}>Share</button>
          </div>
        </div>
      </header>

      {/* ════ HERO ════ */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(30px,4.5vw,64px) 22px clamp(28px,4vw,52px)' }}>
        <header style={{ textAlign: 'center', margin: '0 auto clamp(22px,3vw,40px)', maxWidth: '34ch' }}>
          <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(34px,7vw,54px)', lineHeight: 1.04, letterSpacing: '-0.015em', color: 'var(--l-1)', margin: '0 0 10px', textWrap: 'balance' }}>{card.card_name}</h1>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'clamp(26px,4vw,52px)', alignItems: 'center' }}>
          <figure
            onClick={e => { const t = e.currentTarget.querySelector('img'); openLightbox(t?.getBoundingClientRect() ?? null); }}
            role="button" tabIndex={0} aria-label="Enlarge artwork"
            style={{ margin: 0, position: 'relative', aspectRatio: '1/1', cursor: 'zoom-in', overflow: 'hidden', background: 'var(--l-soft)', boxShadow: '0 1px 0 rgba(255,255,255,0.04),0 30px 80px -30px rgba(20,15,8,0.5)' }}
          >
            <img
              crossOrigin="anonymous"
              src={ulCardImageUrl(card.number, 1100)}
              srcSet={cardPublicId ? [480, 720, 900, 1200].map(s => `${img(cardPublicId, { w: s, h: s, crop: 'fill', gravity: 'center', format: 'webp' })} ${s}w`).join(', ') : undefined}
              sizes="(max-width: 768px) 100vw, 560px"
              alt={imageAlt}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              loading="eager" decoding="async"
            />
          </figure>

          <div style={{ textAlign: 'left' }}>
            {keywords.length > 0 && (
              <div
                onClick={() => go('genekeys')} title="Read the Gene Keys"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', borderTop: '1px solid var(--l-rule)', borderBottom: '1px solid var(--l-rule)', padding: '16px 0', marginBottom: 28, cursor: 'pointer' }}
              >
                {keywords.map((kw, i) => (
                  <span key={i} style={{ fontFamily: SERIF, fontSize: 'clamp(15px,4vw,18px)', color: 'var(--l-2)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{kw}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
              <button onClick={() => setBuyOpen(true)} style={{ flex: 1, textAlign: 'left', background: 'none', border: '1px solid var(--l-rule)', cursor: 'pointer', padding: '14px 18px', transition: 'border-color .25s' }} onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')} onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--l-rule)')}>
                <span style={{ display: 'block', fontFamily: SERIF, fontSize: 18, color: 'var(--l-1)', lineHeight: 1.1 }}>Acquire</span>
                <span style={{ display: 'block', fontFamily: SANS, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-3)', marginTop: 3 }}>
                  {piece?.availability === 'SOLD' ? 'The original · sold' : 'The original · available'}
                </span>
              </button>
              <span aria-hidden="true" style={{ flexShrink: 0, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, color: 'var(--accent)' }}>
                <span style={{ fontFamily: CJK, fontSize: 'clamp(38px,6.5vw,52px)', lineHeight: 1 }}>{hexChar}</span>
                <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.2em' }}>{code2}</span>
              </span>
              <button onClick={() => setShareOpen(v => !v)} style={{ flex: 1, textAlign: 'left', background: 'none', border: '1px solid var(--l-rule)', cursor: 'pointer', padding: '14px 18px', transition: 'border-color .25s' }} onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')} onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--l-rule)')}>
                <span style={{ display: 'block', fontFamily: SERIF, fontSize: 18, color: 'var(--l-1)', lineHeight: 1.1 }}>Share</span>
                <span style={{ display: 'block', fontFamily: SANS, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-3)', marginTop: 3 }}>Send a code</span>
              </button>
            </div>
            <div style={{ marginTop: 16 }}>
              <Link to="/profile" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'none', border: '1px solid var(--l-rule)', cursor: 'pointer', padding: '13px 16px', textDecoration: 'none', transition: 'border-color .25s' }} onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')} onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--l-rule)')}>
                <span style={{ fontFamily: SERIF, fontSize: 16, color: 'var(--l-1)', lineHeight: 1.25, textAlign: 'center' }}>Check the placement of this card in your chart</span>
                <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: 18, color: 'var(--accent)', flexShrink: 0 }}>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════ CHAPTER NAV ════ */}
      <nav aria-label="Reading by system" style={{ position: 'sticky', top: 40, zIndex: 80, background: 'color-mix(in oklab,var(--l-bg) 92%,transparent)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderTop: '1px solid var(--l-rule)', borderBottom: '1px solid var(--l-rule)' }}>
        <div className="ul-stage" style={{ maxWidth: 1180, margin: '0 auto', overflowX: 'auto', textAlign: 'center', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'inline-flex', minWidth: '100%', justifyContent: 'center', position: 'relative', verticalAlign: 'top' }}>
            {CHAPTERS.map(ch => {
              const on = activeChapter === ch.key;
              return (
                <button key={ch.key} onClick={() => go(ch.key)}
                  style={{ flex: '0 0 auto', padding: '9px clamp(6px,1.8vw,18px)', background: 'none', border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', fontFamily: SANS, fontWeight: 500, fontSize: 'clamp(10.5px,2.3vw,13px)', letterSpacing: '0.13em', textTransform: 'uppercase', color: on ? 'var(--accent)' : 'var(--l-3)', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.06, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transition: 'color .25s' }}>
                  {ch.two ? <><span>{ch.two[0]}</span><span>{ch.two[1]}</span></> : ch.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ════ READING STAGE (horizontal swipe) ════ */}
      <div ref={stageRef} className="ul-stage"
        style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', width: '100%', overflowX: 'auto', overflowY: 'visible', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>

        <ULPanel card={card} synthesis={synthesis} invocation={invocation} expanded={expanded} onNext={() => go('iching')} register={el => { if (el) panelEls.current.set('ul', el); }} />
        <IChingPanel card={card} synthesis={synthesis} expanded={expanded} hexChar={hexChar} hexPinyin={hexPinyin} ivSel={ivSel} setIvSel={setIvSel} cast={cast} setCast={setCast} onAbout={() => setSystemOverlay('iching')} onNext={() => go('genekeys')} register={el => { if (el) panelEls.current.set('iching', el); }} />
        <GeneKeysPanel card={card} synthesis={synthesis} expanded={expanded} onAbout={() => setSystemOverlay('genekeys')} onNext={() => go('humandesign')} register={el => { if (el) panelEls.current.set('genekeys', el); }} />
        <HumanDesignPanel card={card} synthesis={synthesis} onAbout={() => setSystemOverlay('humandesign')} onNext={() => go('body')} register={el => { if (el) panelEls.current.set('humandesign', el); }} />
        <BodyPanel card={card} synthesis={synthesis} onNext={() => go('tarot')} register={el => { if (el) panelEls.current.set('body', el); }} />
        <RelationsPanel card={card} synthesis={synthesis} expanded={expanded} placement={placement} navigate={navigate} hexChar={hexChar} onNext={() => go('ul')} register={el => { if (el) panelEls.current.set('tarot', el); }} />

      </div>

      {/* ════ FOOTER / CARD NAV ════ */}
      <footer style={{ borderTop: '1px solid var(--l-rule)', background: 'var(--l-bg)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '26px 24px' }}>
          {prevCardNum !== null ? (
            <Link to={`/universal-language/${prevCardNum}`} state={{ ritual: true }} style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-2)', textDecoration: 'none' }}>← Code {prevCardNum}</Link>
          ) : <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-3)', opacity: 0.5 }}>← Code 64</span>}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: SERIF, fontSize: 18, color: 'var(--l-1)', margin: 0 }}>{card.card_name}</p>
            <p style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--l-3)', margin: '3px 0 0' }}>Code {code2} of 64</p>
          </div>
          {nextCardNum !== null ? (
            <Link to={`/universal-language/${nextCardNum}`} state={{ ritual: true }} style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-2)', textDecoration: 'none' }}>Code {nextCardNum} →</Link>
          ) : <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-3)', opacity: 0.5 }}>Code 1 →</span>}
        </div>
      </footer>

      {/* ════ SHARE SHEET ════ */}
      {shareOpen && (
        <div onClick={() => setShareOpen(false)} role="dialog" aria-modal="true" aria-label="Share" style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,8,5,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'ulFadeIn 250ms ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, background: 'var(--l-bg)', border: '1px solid var(--l-rule)', borderBottom: 'none', padding: '24px 22px calc(24px + env(safe-area-inset-bottom))', animation: 'ulRise 360ms cubic-bezier(.16,1,.3,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontFamily: SERIF, fontSize: 22, color: 'var(--l-1)', margin: 0 }}>Send a code</p>
              <button onClick={() => setShareOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--l-3)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: copied ? 'Copied!' : 'Copy link', onClick: copyLink, color: copied ? 'var(--accent)' : 'var(--l-2)' },
                { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}` },
                { label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
                { label: 'X / Twitter', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
                { label: 'Email', href: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent('I wanted to share this oracle card with you:\n\n' + shareUrl)}` },
              ].map((b, i) => b.href ? (
                <a key={i} href={b.href} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 14, border: '1px solid var(--l-rule)', textDecoration: 'none' }}>
                  <span style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--l-2)' }}>{b.label}</span>
                </a>
              ) : (
                <button key={i} onClick={b.onClick} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 14, background: 'none', border: '1px solid var(--l-rule)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: b.color }}>{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalLanguageCard;
