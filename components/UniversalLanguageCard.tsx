import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CARD_BY_NUMBER } from '../data/oracleData';
import { HexagramSVG, hexagramLineBooleans } from './oracle/HexagramGlyph';
import { getSynthesis, type CardSynthesis } from '../data/synthesisData';
import { getParsedCard, mapIching, type MdIchingLine } from '../data/cardMarkdown';
import { HEXAGRAM_CHINESE } from '../data/hexagramChinese';
import { ulCardImageUrl, ulCardPublicId } from '../utils/universalLanguage';
import { useMetaTags } from '../hooks/useMetaTags';
import { useDarkMode } from '../DarkModeContext';
import { EBReadingHost, type EBData } from './oracle/eb/generated/EBReading.host';
import CardReadingShell from './oracle/reading/CardReadingData';
import BuySheet from './oracle/BuySheet';
import OracleShareSheet from './oracle/OracleShareSheet';
import YourPositionCallout from './oracle/YourPositionCallout';
import BirthTimeModal from './oracle/BirthTimeModal';
import SignInModal from './account/SignInModal';
import { useProfile } from '../lib/profile/context';
import { useAccount } from '../lib/account/useAccount';
import { ulPieceForCard } from '../utils/universalLanguage';
import { astrologyGlyph, hebrewLetterGlyph, tarotNumeral } from '../utils/relationsDiagram';
import './oracle/eb/eb-template.css';
import './oracle/eb/oracle-foundation.css';
import OracleBottomNavigation from './oracle/OracleBottomNavigation';
import PublicInvocation from './oracle/invocation/PublicInvocation';
import { loadLiveInvocation } from '../lib/oracle/invocationApi';
import type { LiveInvocation } from '../lib/oracle/invocationTypes';
import { consumeCardEntranceRequest, requestsCardEntrance } from '../lib/oracle/cardEntrance';

/* Earth's Breath card reading. The visible component is GENERATED from the
   imported design file (components/oracle/eb/generated/*) by the dc-import
   converter — no hand-typed markup. This wrapper only builds the per-card data
   bag (EBData) from the live oracle data and hands it to the generated host. */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function isAppleMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const UniversalLanguageCard: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useDarkMode();
  const cardNum = parseInt(number ?? '', 10);
  const card = CARD_BY_NUMBER.get(cardNum);
  const [synthesis, setSynthesis] = useState<CardSynthesis | undefined>(undefined);
  const [liveInvocationState, setLiveInvocationState] = useState<{ cardNum: number; value: LiveInvocation | null }>({ cardNum, value: null });
  const liveInvocation = liveInvocationState.cardNum === cardNum ? liveInvocationState.value : null;
  const [ichingLines, setIchingLines] = useState<MdIchingLine[]>([]);
  /* The full entrance is opt-in and one-shot. Only the deck index and physical
     QR redirect request it; the marker is consumed below so reload, browser
     Back, shared links, Piece/Atlas returns, and every other route stay quiet. */
  const entranceEntry = useRef({ key: '', show: false });
  const entranceKey = `${location.key}:${cardNum}`;
  if (entranceEntry.current.key !== entranceKey) {
    entranceEntry.current = {
      key: entranceKey,
      show: requestsCardEntrance(location.search, location.state),
    };
  }
  const showEntrance = entranceEntry.current.show;
  const showSafariHandoff = new URLSearchParams(location.search).get('ref') === 'qr' && isAppleMobileDevice();
  const [buyOpen, setBuyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chartFormOpen, setChartFormOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const { profile } = useProfile();
  const { isLoaded: isAccountLoaded, isSignedIn } = useAccount();
  useEffect(() => {
    if (showEntrance) consumeCardEntranceRequest();
  }, [entranceKey, showEntrance]);
  useEffect(() => {
    document.documentElement.classList.add('oracle-card-page');
    return () => document.documentElement.classList.remove('oracle-card-page');
  }, []);
  useEffect(() => {
    let cancelled = false;
    getSynthesis(cardNum).then(d => { if (!cancelled) setSynthesis(d); }).catch(() => {});
    getParsedCard(cardNum)
      .then(p => { if (!cancelled) setIchingLines(p ? (mapIching(p)?.lines ?? []) : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cardNum]);
  const refreshInvocation = useCallback(async () => {
    try { setLiveInvocationState({ cardNum, value: await loadLiveInvocation(cardNum, { fresh: true }) }); }
    catch { /* Keep the last confirmed live version visible; the editor retains retry state. */ }
  }, [cardNum]);
  useEffect(() => {
    const controller = new AbortController();
    loadLiveInvocation(cardNum, { signal: controller.signal })
      .then((value) => setLiveInvocationState({ cardNum, value }))
      .catch(() => { /* A different card never renders this state's value because it is keyed. */ });
    return () => controller.abort();
  }, [cardNum]);
  useMetaTags({
    title: card ? `${card.card_name} · Code ${cardNum} · Universal Language Oracle` : undefined,
    description: card ? `${card.iching.hexagram_name} · ${card.gene_keys.shadow} / ${card.gene_keys.gift} / ${card.gene_keys.siddhi}. Universal Language Oracle by Adrian Rasmussen.` : undefined,
    image: card ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${ulCardPublicId(cardNum) ?? 'adrian-website/placeholders/oracle-card-3'}` : undefined,
  });

  if (!card) {
    return (
      <div className="eb-reading" data-palette={isDarkMode ? 'nightfall' : 'daybook'} style={{ minHeight: '100vh', background: 'var(--l-bg)', color: 'var(--l-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <p style={{ fontFamily: 'var(--font-reading)', fontSize: 26, color: 'var(--l-1)', margin: '0 0 12px' }}>This card has not yet arrived.</p>
        </div>
      </div>
    );
  }

  const cleanTrig = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // "Heaven (Ch'ien)" → "Heaven · Ch'ien" — keep the romanisation, lose the parens.
  const trigName = (s: string) => s.replace(/\s*\(([^)]+)\)\s*$/, ' · $1').trim();
  // Six hexagram lines top→bottom for the I Ching glyph; matches the printed plaque.
  const hexLines = hexagramLineBooleans(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol);
  const keywords = synthesis?.keywords ?? [];
  const hexChar = HEXAGRAM_CHINESE[card.number]?.char ?? String(card.number);
  const imageUrl = ulCardImageUrl(card.number, 1080);

  // The per-card data bag the generated markup binds. Anything not yet authored
  // for a card falls back gracefully (the field is empty/handled in markup).
  const data: EBData = {
    cardName: card.card_name,
    code: card.number,
    imageUrl,
    keywords,
    shareUrl: typeof window !== 'undefined' ? window.location.href : `https://mandalacodes.com/universal-language/${card.number}`,
    shareText: `${card.card_name} · Code ${card.number} · Universal Language Oracle by Adrian Rasmussen`,
    // Moving lines come only from the parsed card manuscript. Leave a quiet
    // placeholder when a line is absent so the UI never renders a blank row.
    moving: [1, 2, 3, 4, 5, 6].map(n => {
      const md = ichingLines.find(l => l.line === n);
      const text = (md?.reading ?? '').trim();
      const becomes = md?.becomes?.hexagram
        ? `Hexagram ${md.becomes.hexagram}${md.becomes.name ? ` · ${md.becomes.name}` : ''}`
        : '';
      return {
        n,
        image: md?.image ?? '',
        becomes,
        text: text || 'This line’s reading is being written.',
      };
    }),
    // Relations and kinship are mapped from the same card manuscript.
    reldata: buildReldata(card, synthesis),
    kin: buildKin(card, synthesis),
    overlays: OVERLAYS,
    text: (() => {
      const P = (s?: string): string[] => (s ?? '').split('\n\n').map(x => x.trim()).filter(Boolean);
      const ulP = (synthesis?.essence ?? '').split('\n\n').map(s => s.trim()).filter(Boolean);
      const first = ulP[0] ?? '';
      return {
        cardName: card.card_name,
        // Use the SAME image source + transform the deck index uses (square
        // c_fill/g_center from UL_IMAGE_BY_NUMBER via ulCardImageUrl), so the
        // artwork on the reading is identical to the card on the index, not the
        // physical piece cover (which was a different image).
        heroImage: ulCardImageUrl(card.number, 1100),
        lightboxImage: ulCardImageUrl(card.number, 1600),
        buyImage: ulCardImageUrl(card.number, 700),
        // hero uses the HEXAGRAM SYMBOL glyph (䷀ U+4DC0+n-1), like the file —
        // not the Chinese name character. The I Ching header keeps the name char.
        heroGlyph: String.fromCodePoint(0x4DBF + card.number),
        ichingGlyph: hexChar,
        code2: String(card.number).padStart(2, '0'),
        ichingHexName: card.iching.hexagram_name,
        ichingHexFormula: `${cleanTrig(card.iching.upper_trigram.name)} over ${cleanTrig(card.iching.lower_trigram.name)}`,
        // The actual hexagram glyph (broken/solid lines) + trigram names, so the
        // I Ching panel draws THIS card's hexagram rather than a hardcoded one.
        hexLines,
        ichingUpperName: trigName(card.iching.upper_trigram.name),
        ichingLowerName: trigName(card.iching.lower_trigram.name),
        ichingGua: `Guà ${card.number}`,
        ulDropcap: first.charAt(0),
        ulReadingFirst: first.slice(1),
        ulReadingRest: ulP.slice(1),
        ulReading: ulP,
        invocation: '',
        ichingCombinationHex: synthesis?.synthesis.iching.trigram_combination ?? card.iching.essence,
        ichingCombinationUpper: card.iching.upper_trigram.nature,
        ichingCombinationLower: card.iching.lower_trigram.nature,
        ichingReading: (synthesis?.synthesis.iching.reading ?? '').split('\n\n').map(s => s.trim()).filter(Boolean),
        ichingJudgement: (synthesis?.synthesis.iching.judgement_lines ?? []).join('\n'),
        ichingImage: (synthesis?.synthesis.iching.image_lines ?? []).join('\n'),

        // Gene Keys — names and prose from the Markdown-derived card layers.
        gkShadowName: card.gene_keys.shadow,
        gkGiftName: card.gene_keys.gift,
        gkSiddhiName: card.gene_keys.siddhi,
        gkShadowName2: card.gene_keys.shadow,
        gkGiftName2: card.gene_keys.gift,
        gkSiddhiName2: card.gene_keys.siddhi,
        gkShadowSub: '',
        gkGiftSub: '',
        gkSiddhiSub: '',
        gkShadowParas: P(synthesis?.synthesis.gene_keys.shadow),
        gkGiftParas: P(synthesis?.synthesis.gene_keys.gift),
        gkSiddhiParas: P(synthesis?.synthesis.gene_keys.siddhi),

        // Human Design
        hdGate: String(card.human_design.gate),
        hdDriveName: `Gate ${card.human_design.gate} · ${synthesis?.reference?.hd_keyword ?? card.human_design.keyword}`,
        hdCentreName: synthesis?.reference?.hd_center ?? 'Where it lives',
        hdChannelName: synthesis?.reference?.hd_harmonic_gate ? `Channel · Gate ${card.human_design.gate}–${synthesis.reference.hd_harmonic_gate}` : 'What completes it',
        hdDriveParas: P(synthesis?.synthesis.human_design.gate),
        hdCentreParas: P(synthesis?.synthesis.human_design.channel),
        hdChannelParas: P(synthesis?.synthesis.human_design.circuit),

        // Body
        bodyOrganChip: synthesis?.reference?.body_physiology ? `Organ · ${synthesis.reference.body_physiology}` : 'The Body',
        bodyAminoChip: synthesis?.reference?.body_amino_acid ? `Amino acid · ${synthesis.reference.body_amino_acid}` : '',
        bodyPhysParas: P(synthesis?.synthesis.body.physiology),
        bodyAminoParas: P(synthesis?.synthesis.body.amino_acid),

        // Relations intro
        relationsIntro: synthesis?.relations?.unity_line ?? '',
      };
    })(),
  };

  const piece = ulPieceForCard(card.number);
  const palette = isDarkMode ? 'nightfall' : 'daybook';
  return (
    <>
      <CardReadingShell cardNumber={card.number} reading={
      <EBReadingHost
        key={card.number}
        data={data}
        palette={isDarkMode ? 'nightfall' : 'daybook'}
        accent="bronze"
        reduceMotion={prefersReducedMotion()}
        showEntrance={showEntrance}
        onAcquire={() => setBuyOpen(true)}
        onShare={() => setShareOpen(true)}
        onOpenCode={(code) => navigate(`/universal-language/${code}`)}
        headerActionsSlot={isAccountLoaded && !isSignedIn && !profile ? (
          <ChartHeroBox
            hexGlyph={String.fromCodePoint(0x4DBF + card.number)}
            code={card.number}
            onOpen={() => { if (profile) navigate('/profile'); else setChartFormOpen(true); }}
          />
        ) : null}
        headerChartSlot={
          /* Only the matched "in your chart" line remains here; it shows once a
             code actually sits in the visitor's chart. The old quiet strip
             (save, see the painting, on the map) has been removed. */
          <YourPositionCallout gate={card.number} matchOnly />
        }
        invocationSlot={<PublicInvocation invocation={liveInvocation} />}
      />
      } />
      <BuySheet
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        piece={piece ?? null}
        imageUrl={ulCardImageUrl(card.number, 700)}
        imageAlt={`${card.card_name}, Universal Language ${card.number}.`}
        cardName={card.card_name}
        cardNumber={card.number}
      />
      <OracleShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        cardName={card.card_name}
        cardNumber={card.number}
        keywords={keywords}
      />
      {chartFormOpen && (
        <BirthTimeModal
          showCardOption
          onClose={() => setChartFormOpen(false)}
          onLogIn={() => { setChartFormOpen(false); setSignInOpen(true); }}
          onSeeChart={() => { setChartFormOpen(false); navigate('/profile'); }}
          onBackToCard={() => setChartFormOpen(false)}
          onSave={() => { setChartFormOpen(false); setSignInOpen(true); }}
        />
      )}
      {signInOpen && (
        <SignInModal
          context="reading"
          onClose={() => setSignInOpen(false)}
          onSignedIn={() => setSignInOpen(false)}
        />
      )}

      <OracleBottomNavigation current={card} palette={palette} pieceId={piece ? String(piece.id) : null} onShare={() => setShareOpen(true)} onInvocationPublished={() => void refreshInvocation()} showSafariHandoff={showSafariHandoff} />
    </>
  );
};

/* The quiet actions row in the header slot. Palette-aware through the EB
   reading's own variables (--l-3 muted ink, --accent bronze), so it holds in
   both Day Book and Nightfall. The save button is SaveToCollectionButton's
   own markup, restyled here to plain label text: the override selector is
   more specific than the component's .stc__btn rules. */
/* The single hero box: the chart question, with THIS code's hexagram as the
   feature on the left. The glyph + number scale to the HEIGHT of the text block
   beside them (measured live), so the feature always reads as tall as the copy
   it sits next to, at any screen size. Opens the birthday/login flow, or the
   chart itself once one exists. */
const ChartHeroBox: React.FC<{
  hexGlyph: string;
  code: number;
  onOpen: () => void;
}> = ({ hexGlyph, code, onOpen }) => {
  const bodyRef = useRef<HTMLSpanElement>(null);
  const [glyphPx, setGlyphPx] = useState(46);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      // Glyph sits at roughly three-quarters of the copy-block height, with the
      // number beneath; clamp so it never gets absurd on very short/tall wraps.
      setGlyphPx(Math.max(40, Math.min(88, h * 0.78)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="ul-hero-actions">
      <button type="button" className="ul-hero-box ul-hero-box--chart" onClick={onOpen}>
        <span className="ul-hero-hex" aria-hidden="true">
          <span className="ul-hero-hex__glyph" style={{ fontSize: glyphPx }}>{hexGlyph}</span>
          <span
            className="ul-hero-hex__num"
            style={{ fontSize: Math.max(8, Math.round(glyphPx * 0.18)), marginTop: Math.round(glyphPx * -0.04) }}
          >
            {String(code).padStart(2, '0')}
          </span>
        </span>
        <span className="ul-hero-box__body" ref={bodyRef}>
          <span className="ul-hero-box__title">Is this code in your chart?</span>
          <span className="ul-hero-box__line">
            See your birth chart and understand where all 64 codes land in the Oracle.
          </span>
        </span>
        <style>{heroActionStyles}</style>
      </button>
    </div>
  );
};

/* The chart question uses the old action row's hairline box, palette-aware
   through the EB reading's own variables. Serif copy, no label, no italics. */
const heroActionStyles = `
  .ul-hero-actions { display: block; }
  /* Horizontal: the hexagram sits on the left (its number centred beneath it),
     what the box is sits on the right. The glyph is a quiet mark here, roughly
     half the previous size, not a billboard. */
  .ul-hero-box {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: clamp(12px, 3vw, 18px);
    text-align: left;
    width: 100%;
    background: none;
    border: 1px solid var(--l-rule, rgba(180,150,110,0.22));
    cursor: pointer;
    padding: 15px clamp(15px, 3.5vw, 22px);
    transition: border-color .25s, background .25s;
  }
  .ul-hero-box:hover {
    border-color: color-mix(in oklab, var(--accent, #C99A5B) 55%, var(--l-rule, rgba(180,150,110,0.22)));
  }
  .ul-hero-box--chart { position: relative; overflow: hidden; }
  .ul-hero-box--chart::after {
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 2px;
    background: linear-gradient(to right, var(--accent, #C99A5B), color-mix(in oklab, var(--accent, #C99A5B) 25%, transparent));
    opacity: .32;
  }
  .ul-hero-hex {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--accent, #C99A5B);
  }
  /* Glyph + number sizes are set inline from the measured text-block height
     (see ChartHeroBox); these are just fallbacks before the measure lands. */
  .ul-hero-hex__glyph {
    font-family: var(--font-cjk);
    font-size: 46px;
    line-height: 1;
  }
  .ul-hero-hex__num {
    font-family: var(--font-ui);
    font-size: 11px;
    letter-spacing: 0.12em;
    margin-top: 7px;
    text-indent: 0.12em;
  }
  .ul-hero-box__body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }
  .ul-hero-box__title {
    font-family: var(--font-display);
    font-size: 20px;
    line-height: 1.12;
    color: var(--l-1);
    margin-bottom: 6px;
  }
  .ul-hero-box__line {
    font-family: var(--font-reading);
    font-size: 15px;
    line-height: 1.4;
    color: var(--l-2, #C9BDA9);
  }
`;

/* ── light data mappers (live, with graceful fallback) ── */
function buildReldata(card: any, syn?: CardSynthesis): EBData['reldata'] {
  const rel = syn?.relations;
  const pairNum = rel?.pair?.number;
  const pairCard = pairNum != null ? CARD_BY_NUMBER.get(pairNum) : undefined;
  const tarot = rel?.tarot?.teaching ?? syn?.synthesis.tarot.tarot_resonance ?? '';
  return {
    self: { kicker: 'Inverse · Its Own Reflection', kind: 'Itself', name: 'Its Own Reflection', body: [rel?.inverse?.teaching ?? 'The same lines turned, the situation seen from the other side.'] },
    pair: { kicker: 'The Pair · Programming Partner', kind: 'Complement', name: pairCard ? `UL ${pairCard.number} · ${pairCard.card_name}` : 'The Pair', body: [rel?.pair?.teaching ?? ''].filter(Boolean) },
    ring14: { kicker: 'Codon Ring', kind: 'Codon kin', name: rel?.codon_ring?.name ?? 'Codon Ring', body: [rel?.codon_ring?.teaching ?? ''].filter(Boolean) },
    tarot: { kicker: 'Tarot', kind: 'Arcana', name: rel?.tarot?.card ?? syn?.reference?.tarot_card ?? card.ring_tarot ?? 'Tarot', body: [tarot].filter(Boolean) },
    immortal: { kicker: 'The Eight Immortals', kind: 'Daoist', name: rel?.immortals ? (rel.immortals.same_trigram ? rel.immortals.upper.name : `${rel.immortals.upper.name} · ${rel.immortals.lower.name}`) : 'The Immortal', body: [rel?.immortals?.teaching ?? ''].filter(Boolean) },
    hebrew: { kicker: 'Hebrew Letter', kind: 'The Letter', name: rel?.hebrew_letter?.letter ?? syn?.reference?.hebrew_letter ?? 'Hebrew Letter', body: [rel?.hebrew_letter?.teaching ?? ''].filter(Boolean) },
    sky: { kicker: 'The Sky', kind: 'Astrology', name: rel?.sky?.value ?? syn?.reference?.astrology ?? 'The Sky', body: [rel?.sky?.teaching ?? ''].filter(Boolean) },
  };
}

function buildKin(card: any, syn?: CardSynthesis): EBData['kin'] {
  const rel = syn?.relations;
  const pairNum = rel?.pair?.number;
  const pairCard = pairNum != null ? CARD_BY_NUMBER.get(pairNum) : undefined;
  const sibs = card.codon_ring_siblings ?? [];
  const ringCard = sibs.length ? CARD_BY_NUMBER.get(sibs[0]) : undefined;
  const pairHexagram = pairCard ? (
    <HexagramSVG
      upper={pairCard.iching.upper_trigram.symbol}
      lower={pairCard.iching.lower_trigram.symbol}
      color="currentColor"
      width={27}
    />
  ) : '·';
  const tarotCard = rel?.tarot?.card ?? syn?.reference?.tarot_card ?? card.ring_tarot ?? '';
  const letterName = rel?.hebrew_letter?.letter ?? syn?.reference?.hebrew_letter ?? '';
  const letterGlyph = hebrewLetterGlyph(letterName);
  const skyValue = rel?.sky?.value ?? syn?.reference?.astrology ?? '';
  const skyGlyph = astrologyGlyph(skyValue);
  return [
    { key: 'pair', x: 24, y: 50, kind: 'kin', glyph: pairHexagram, fontRole: 'display', size: 'clamp(26px,6.8vw,34px)', dim: 'clamp(54px,13.5vw,66px)', svgR: 6.4, label: pairCard ? `UL ${pairCard.number}` : 'Pair' },
    { key: 'ring14', x: 76, y: 50, kind: 'kin', glyph: <CodonRingGlyph />, fontRole: 'display', size: 'clamp(26px,6.8vw,34px)', dim: 'clamp(54px,13.5vw,66px)', svgR: 6.4, label: ringCard ? `UL ${ringCard.number}` : 'Ring' },
    { key: 'sky', x: 21.7, y: 21.7, kind: 'corr', glyph: skyGlyph ? <AstrologyGlyph value={skyValue} /> : '·', fontRole: 'display', size: 'clamp(22px,5.6vw,28px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: skyValue || 'Sky' },
    { key: 'tarot', x: 78.3, y: 21.7, kind: 'corr', glyph: tarotNumeral(tarotCard) || '·', fontRole: 'display', size: 'clamp(15px,4vw,19px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: tarotCard || 'Tarot' },
    { key: 'hebrew', x: 21.7, y: 78.3, kind: 'corr', glyph: letterGlyph ? <HebrewGlyph glyph={letterGlyph} /> : '·', fontRole: 'display', size: 'clamp(23px,6vw,30px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: letterName || 'Letter' },
    { key: 'immortal', x: 78.3, y: 78.3, kind: 'corr', glyph: '笛', fontRole: 'cjk', size: 'clamp(22px,5.8vw,28px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: 'Immortal' },
  ];
}

function CodonRingGlyph() {
  return (
    <svg width="31" height="31" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11" cy="19.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="21" cy="19.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}

function HebrewGlyph({ glyph }: { glyph: string }) {
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true" focusable="false">
      <text x="14" y="23" textAnchor="middle" direction="rtl" fontFamily="var(--font-display)" fontSize="23" fill="currentColor">
        {glyph}
      </text>
    </svg>
  );
}

function AstrologyGlyph({ value }: { value: string }) {
  const glyph = astrologyGlyph(value);
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true" focusable="false">
      <text x="15" y="22" textAnchor="middle" fontFamily="Times New Roman, Georgia, serif" fontSize="22" fill="currentColor">
        {`${glyph}\uFE0E`}
      </text>
    </svg>
  );
}

// System overlays are the same three short essays for every card (about the systems,
// not the card) — verbatim from the template.
const OVERLAYS: EBData['overlays'] = {
  iching: { kicker: 'The Book of Changes', title: 'I Ching', sub: 'attributed to Fu Xi, King Wen, the Duke of Zhou, and Confucius', gratitude: 'Richard Wilhelm and Cary F. Baynes', paras: [
    'The I Ching is the oldest text in active spiritual use anywhere in the world. Its earliest layers are attributed to the legendary Fu Xi, who is said to have seen, in eight three-line figures, the structure of the cosmos.',
    'King Wen of Zhou ordered the sixty-four hexagrams and named each one. His son, the Duke of Zhou, wrote the line statements. Confucius and his school added the Ten Wings, turning the oracle into a philosophical text.',
    'The translation that opens the I Ching to the modern imagination is Richard Wilhelm’s, carried into English by Cary F. Baynes in 1950 with a foreword by Carl Jung.' ] },
  genekeys: { kicker: 'A contemplative path', title: 'Gene Keys', sub: 'transmitted by Richard Rudd, 2002 onward', gratitude: 'Richard Rudd', paras: [
    'The Gene Keys are the youngest of the three systems. Richard Rudd received the transmission over a long, contemplative period beginning in the early 2000s.',
    'Each of the sixty-four keys names three frequencies of the same archetype: the Shadow, the Gift, and the Siddhi.',
    'The sixty-four Gene Keys correspond directly to the sixty-four hexagrams of the I Ching and to the sixty-four codons of human DNA.' ] },
  humandesign: { kicker: 'A map of energy', title: 'Human Design', sub: 'received by Ra Uru Hu, Ibiza, January 1987', gratitude: 'Ra Uru Hu', paras: [
    'Human Design enters the world through Ra Uru Hu, who in January of 1987 reports an eight-day-and-night encounter with a voice he calls the Voice.',
    'It is a synthesis of the I Ching, Western astrology, the Hindu chakra system, the Kabbalistic Tree of Life, and the science of the neutrino, woven into a single chart called the bodygraph.',
    'The bodygraph names which centres in a person are defined and which are open, and locates sixty-four gates against the calendar of the sun and the moment of birth.' ] },
};

export default UniversalLanguageCard;
