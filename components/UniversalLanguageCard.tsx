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
import SaveToCollectionButton from './account/SaveToCollectionButton';
import { cardCollectionItem } from '../lib/collections/items';
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
   converter, with no hand-typed markup. This wrapper only builds the per-card data
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
  // "Heaven (Ch'ien)" becomes "Heaven · Ch'ien": keep the romanisation, lose the parens.
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
    // This card's own hexagram-symbol reading, when authored (`### The
    // symbol` under `## ICHING`). Most cards do not have one yet.
    ichingSymbolParas: (card.iching.symbol ?? '').split('\n\n').map(s => s.trim()).filter(Boolean),
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
        // hero uses the HEXAGRAM SYMBOL glyph (䷀ U+4DC0+n-1), like the file,
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

        // Gene Keys: names and prose from the Markdown-derived card layers.
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
        // The two faces of the shadow, inside the "go deeper" disclosure. The
        // markup carried card 1's prose as literals, so all 64 cards read as
        // Earth's Breath there. Names come from the KEYS subheadings
        // (the "Repressive nature" subheading), prose from the same section.
        gkRepressiveName: synthesis?.synthesis.gene_keys.repressive_name ? `Repressive · ${synthesis.synthesis.gene_keys.repressive_name}` : 'Repressive',
        gkReactiveName: synthesis?.synthesis.gene_keys.reactive_name ? `Reactive · ${synthesis.synthesis.gene_keys.reactive_name}` : 'Reactive',
        gkRepressiveParas: P(synthesis?.synthesis.gene_keys.repressive),
        gkReactiveParas: P(synthesis?.synthesis.gene_keys.reactive),

        // Human Design
        hdGate: String(card.human_design.gate),
        hdDriveName: `Gate ${card.human_design.gate} · ${synthesis?.reference?.hd_keyword ?? card.human_design.keyword}`,
        hdCentreName: synthesis?.reference?.hd_center ?? 'Where it lives',
        hdChannelName: synthesis?.reference?.hd_harmonic_gate ? `Channel · Gate ${card.human_design.gate}–${synthesis.reference.hd_harmonic_gate}` : 'What completes it',
        hdDriveParas: P(synthesis?.synthesis.human_design.gate),
        hdCentreParas: P(synthesis?.synthesis.human_design.channel),
        hdChannelParas: P(synthesis?.synthesis.human_design.circuit),
        // The three tag chips under the panel: gate, centre, channel. The
        // channel reads "Channel of Inspiration 1–8" when the manuscript names
        // one gate pair; the integration cards (20, 34, 57) name a cluster
        // instead, so they fall back to the authored heading label.
        hdGateChip: `Gate ${card.human_design.gate}`,
        hdCentreChip: synthesis?.reference?.hd_center ?? '',
        hdChannelChip: synthesis?.reference?.hd_circuit && synthesis.reference.hd_harmonic_gate
          ? `${synthesis.reference.hd_circuit} ${card.human_design.gate}–${synthesis.reference.hd_harmonic_gate}`
          : (synthesis?.reference?.hd_channel_label ?? ''),

        // Body
        bodyOrganChip: synthesis?.reference?.body_physiology ? `Organ · ${synthesis.reference.body_physiology}` : 'The Body',
        bodyAminoChip: synthesis?.reference?.body_amino_acid ? `Amino acid · ${synthesis.reference.body_amino_acid}` : '',
        bodyPhysParas: P(synthesis?.synthesis.body.physiology),
        bodyAminoParas: P(synthesis?.synthesis.body.amino_acid),
        // Ring tag + the two section headers, from the card's own frontmatter.
        bodyRingChip: card.ring_name,
        bodyPhysHeading: synthesis?.reference?.body_physiology ? `Physiology · ${synthesis.reference.body_physiology}` : 'Physiology',
        bodyAminoHeading: synthesis?.reference?.body_amino_acid ? `Amino Acid · ${synthesis.reference.body_amino_acid}` : 'Amino Acid',

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
      <>
      {/* The one act under the designed header: is this code in your chart?

          Where this wanted to go, and why it does not: the generated reading
          carries these boxes in a hero of its own, and that hero is hidden
          outright by the shell this page renders inside
          (card-reading-fullbleed.css hides .ul-hero-section), so both of the
          host's header slots reach nobody. So the act lands here instead,
          directly below the card name and its keywords. The .eb-reading
          wrapper carries the reading's palette variables to it, the same way
          the bottom bar does.

          The pull is the chart question, not the filing cabinet. A visitor
          wants to know whether this code is theirs; keeping it is the quiet
          second line beneath. The callout carries all three states on its own:
          no chart yet asks the question, a chart with this code in it names
          the placement, a chart without it says nothing. */}
      <div className="eb-reading ul-chart-row" data-palette={palette}>
        <YourPositionCallout gate={card.number} />
        <SaveToCollectionButton
          item={cardCollectionItem(card.number)}
          label="Save this code"
        />
        <style>{chartRowStyles}</style>
      </div>
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
        invocationSlot={<PublicInvocation invocation={liveInvocation} />}
      />
      </>
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

      <OracleBottomNavigation current={card} palette={palette} pieceId={piece ? String(piece.id) : null} onShare={() => setShareOpen(true)} onInvocationPublished={() => void refreshInvocation()} showSafariHandoff={showSafariHandoff} />
    </>
  );
};

/* The chart row's own seat. It holds two things, stacked and centred: the
   chart question, and under it the small chip that keeps the code. Both draw
   on the reading's own --l-rule, --l-1, --l-3 and --accent variables, so they
   follow Day Book and Nightfall without a second palette. The side inset is
   the reading's own: 44px once the shell is on its two-column layout, 10px
   below that (CardReading.tsx's own 820px breakpoint). */
const chartRowStyles = `
  .ul-chart-row {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 44px clamp(18px, 3vw, 28px);
    background: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  @media (max-width: 819px) {
    .ul-chart-row { padding-left: 10px; padding-right: 10px; }
  }

  /* The question sizes itself to its words and sits in the middle of the
     column, rather than spanning it. Smaller than the panel it replaces on
     purpose: one quiet offer, not a banner. */
  .ul-chart-row .ypc-wrap { width: auto; max-width: 100%; }
  .ul-chart-row .ypc {
    width: auto;
    justify-content: center;
    text-align: center;
    gap: 10px;
    padding: 10px 18px;
  }
  .ul-chart-row .ypc__mid { flex: 0 1 auto; align-items: center; gap: 3px; }
  .ul-chart-row .ypc__title { font-size: 16px; }
  .ul-chart-row .ypc__title--out { font-size: 15px; }
  .ul-chart-row .ypc__go { font-size: 9px; letter-spacing: 0.16em; }

  /* Keeping the code is the second line. The chip's own colors are the account
     surfaces' paper ones, so they are traded here for the reading's, chooser
     included, since this one sits on the reading. */
  .ul-chart-row .stc__btn {
    font-size: 10px;
    padding: 6px 12px;
    /* --l-3 is the palette's faintest step. On Day Book it lands at 1.9 to 1
       against the reader's own paper, which is unreadable at this size, so the
       quiet step here is --l-2: still subordinate to the question above, still
       legible in both palettes. */
    color: var(--l-2);
    border-color: var(--l-rule, rgba(180,150,110,0.22));
  }
  .ul-chart-row .stc__btn:hover {
    background: none;
    border-color: color-mix(in oklab, var(--accent, #C99A5B) 55%, var(--l-rule, rgba(180,150,110,0.22)));
  }
  .ul-chart-row .stc__menu {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: min(280px, 100%);
    z-index: 90;
    background: var(--l-bg);
    border-color: var(--l-rule, rgba(180,150,110,0.22));
    border-radius: 0;
  }
  .ul-chart-row .stc__menu-empty { color: var(--l-2); }
  .ul-chart-row .stc__menu-item { color: var(--l-1); border-radius: 0; }
  .ul-chart-row .stc__menu-item:hover {
    background: color-mix(in oklab, var(--accent, #C99A5B) 12%, transparent);
  }
  .ul-chart-row .stc__create { border-top-color: var(--l-rule, rgba(180,150,110,0.22)); }
  .ul-chart-row .stc__input {
    color: var(--l-1);
    background: none;
    border-color: var(--l-rule, rgba(180,150,110,0.22));
    border-radius: 0;
  }
  .ul-chart-row .stc__create-btn {
    color: var(--l-bg);
    background: var(--accent, #C99A5B);
    border-radius: 0;
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
// not the card), verbatim from the template.
const OVERLAYS: EBData['overlays'] = {
  iching: { kicker: 'The Book of Changes', title: 'I Ching', sub: 'attributed to Fu Xi, King Wen, the Duke of Zhou, and Confucius', gratitude: 'Richard Wilhelm and Cary F. Baynes', paras: [
    'A hexagram is six lines, read from the bottom up. Bottom is where the situation starts. Top is where it ends.',
    'A whole line pushes. A broken line gives way.',
    'The lower three lines are what is happening inside you. The upper three are what you are meeting in the world.',
    'When you cast, the lines that turn are where you stand now.' ] },
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
