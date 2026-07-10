import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ALL_CARDS, CARD_BY_NUMBER } from '../data/oracleData';
import { HexagramSVG, hexagramLineBooleans } from './oracle/HexagramGlyph';
import { getExpandedCard } from '../data/expandedOracleData';
import { getSynthesis, getInvocation, type CardSynthesis } from '../data/synthesisData';
import { getLineText } from '../data/ichingLines';
import { getParsedCard, mapIching, type MdIchingLine } from '../data/cardMarkdown';
import { HEXAGRAM_CHINESE } from '../data/hexagramChinese';
import { ulCardImageUrl, ulCardPublicId } from '../utils/universalLanguage';
import { useMetaTags } from '../hooks/useMetaTags';
import { useDarkMode } from '../DarkModeContext';
import { EBReadingHost, type EBData } from './oracle/eb/generated/EBReading.host';
import BuySheet from './oracle/BuySheet';
import OracleShareSheet from './oracle/OracleShareSheet';
import YourPositionCallout from './oracle/YourPositionCallout';
import SaveToCollectionButton from './account/SaveToCollectionButton';
import { ulPieceForCard } from '../utils/universalLanguage';
import { useCardPlacement } from '../lib/atlas/state';
import './oracle/eb/eb-template.css';

/* Earth's Breath card reading. The visible component is GENERATED from the
   imported design file (components/oracle/eb/generated/*) by the dc-import
   converter — no hand-typed markup. This wrapper only builds the per-card data
   bag (EBData) from the live oracle data and hands it to the generated host. */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const UniversalLanguageCard: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useDarkMode();
  const cardNum = parseInt(number ?? '', 10);
  const card = CARD_BY_NUMBER.get(cardNum);
  const expanded = getExpandedCard(cardNum);
  const [synthesis, setSynthesis] = useState<CardSynthesis | undefined>(undefined);
  const [invocation, setInvocation] = useState<string | undefined>(undefined);
  const [ichingLines, setIchingLines] = useState<MdIchingLine[]>([]);
  /* The full entrance (veil + ring/center build) plays only on a FRESH arrival —
     from the deck, a shared link, or a reload. Prev/Next pass state.quiet so the
     ceremony is skipped; the new card's panels still glide in via the host's
     scroll-reveal (it remounts per card via the key below). */
  const arrivedQuiet = (location.state as { quiet?: boolean } | null)?.quiet === true;
  const showEntrance = !arrivedQuiet;
  const [buyOpen, setBuyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /* Where this card's physical piece sits on the public atlas (cached shared
     load). Null while loading or when the piece isn't in the public ledger.
     The "On the Atlas" link only renders when the piece is actually mapped
     (placed or unawakened with a city); a deep link to an unmapped piece
     lands on an unselected globe and reads as a broken link. */
  const placement = useCardPlacement(cardNum);
  const placementOnGlobe =
    placement != null &&
    (placement.status === 'placed' || placement.status === 'unawakened') &&
    placement.cityLabel != null;
  const atlasHref = placementOnGlobe
    ? `/atlas?piece=${encodeURIComponent(
        `${placement.pieceId}${
          typeof placement.editionNumber === 'number' && placement.editionNumber !== 0
            ? `:${placement.editionNumber}`
            : ''
        }`,
      )}`
    : null;

  useEffect(() => {
    document.documentElement.classList.add('oracle-card-page');
    return () => document.documentElement.classList.remove('oracle-card-page');
  }, []);
  useEffect(() => {
    let cancelled = false;
    getSynthesis(cardNum).then(d => { if (!cancelled) setSynthesis(d); }).catch(() => {});
    getInvocation(cardNum).then(v => { if (!cancelled) setInvocation(v); }).catch(() => {});
    getParsedCard(cardNum)
      .then(p => { if (!cancelled) setIchingLines(p ? (mapIching(p)?.lines ?? []) : []); })
      .catch(() => {});
    return () => { cancelled = true; };
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
          <p style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--l-1)', margin: '0 0 12px' }}>This card has not yet arrived.</p>
        </div>
      </div>
    );
  }

  const cleanTrig = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // "Heaven (Ch'ien)" → "Heaven · Ch'ien" — keep the romanisation, lose the parens.
  const trigName = (s: string) => s.replace(/\s*\(([^)]+)\)\s*$/, ' · $1').trim();
  // Six hexagram lines top→bottom for the I Ching glyph; matches the printed plaque.
  const hexLines = hexagramLineBooleans(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol);
  const keywords = synthesis?.keywords ?? expanded?.keywords ?? [];
  const hexChar = HEXAGRAM_CHINESE[card.number]?.char ?? String(card.number);
  const imageUrl = `https://res.cloudinary.com/dobbosnda/image/upload/f_jpg,q_auto,w_1080,h_1080,c_fill,g_center/${ulCardPublicId(card.number) ?? ''}`;

  // The per-card data bag the generated markup binds. Anything not yet authored
  // for a card falls back gracefully (the field is empty/handled in markup).
  const data: EBData = {
    cardName: card.card_name,
    code: card.number,
    imageUrl,
    keywords,
    shareUrl: typeof window !== 'undefined' ? window.location.href : `https://mandalacodes.com/universal-language/${card.number}`,
    shareText: `${card.card_name} · Code ${card.number} · Universal Language Oracle by Adrian Rasmussen`,
    // moving lines: the six line readings for this hexagram. The authored source
    // is the parsed card markdown (image + reading + becomes); fall back to the
    // ichingLines stub for text, and leave a quiet placeholder when nothing is
    // written yet so a moving line never renders as a blank row.
    moving: [1, 2, 3, 4, 5, 6].map(n => {
      const md = ichingLines.find(l => l.line === n);
      const text = (md?.reading || getLineText(card.number, n) || '').trim();
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
    // relations data (pair/codon/tarot/etc.) — minimal live mapping; bodies fall back to synthesis
    reldata: buildReldata(card, synthesis, expanded),
    kin: buildKin(card, synthesis, expanded),
    overlays: OVERLAYS,
    text: (() => {
      const P = (s?: string): string[] => (s ?? '').split('\n\n').map(x => x.trim()).filter(Boolean);
      const ulP = (synthesis?.essence ?? expanded?.creator_voice?.personal_reading ?? '').split('\n\n').map(s => s.trim()).filter(Boolean);
      const first = ulP[0] ?? '';
      const pid = ulCardPublicId(card.number) ?? '';
      const cloud = (t: string) => `https://res.cloudinary.com/dobbosnda/image/upload/${t}/${pid}`;
      return {
        cardName: card.card_name,
        heroImage: cloud('f_auto,q_auto,w_1100,c_fill,g_center'),
        lightboxImage: cloud('f_auto,q_auto,w_1600,c_fit'),
        buyImage: cloud('f_auto,q_auto,w_700,c_fill,g_center'),
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
        invocation: invocation ?? '',
        ichingCombinationHex: synthesis?.synthesis.iching.trigram_combination ?? card.iching.essence,
        ichingCombinationUpper: card.iching.upper_trigram.nature,
        ichingCombinationLower: card.iching.lower_trigram.nature,
        ichingReading: (synthesis?.synthesis.iching.reading ?? '').split('\n\n').map(s => s.trim()).filter(Boolean),
        ichingJudgement: (synthesis?.synthesis.iching.judgement_lines ?? []).join('\n'),
        ichingImage: (synthesis?.synthesis.iching.image_lines ?? []).join('\n'),

        // Gene Keys — names from the card, prose from synthesis (fallback to expanded)
        gkShadowName: card.gene_keys.shadow,
        gkGiftName: card.gene_keys.gift,
        gkSiddhiName: card.gene_keys.siddhi,
        gkShadowName2: card.gene_keys.shadow,
        gkGiftName2: card.gene_keys.gift,
        gkSiddhiName2: card.gene_keys.siddhi,
        gkShadowSub: expanded?.gene_keys.shadow?.contemplation_title ?? '',
        gkGiftSub: expanded?.gene_keys.gift?.contemplation_title ?? '',
        gkSiddhiSub: expanded?.gene_keys.siddhi?.contemplation_title ?? '',
        gkShadowParas: P(synthesis?.synthesis.gene_keys.shadow ?? expanded?.gene_keys.shadow?.expanded?.text ?? card.gene_keys.description),
        gkGiftParas: P(synthesis?.synthesis.gene_keys.gift ?? expanded?.gene_keys.gift?.expanded?.text),
        gkSiddhiParas: P(synthesis?.synthesis.gene_keys.siddhi ?? expanded?.gene_keys.siddhi?.expanded?.text),

        // Human Design
        hdDriveName: `Gate ${card.human_design.gate} · ${synthesis?.reference?.hd_keyword ?? card.human_design.keyword}`,
        hdCentreName: synthesis?.reference?.hd_center ?? 'Where it lives',
        hdChannelName: synthesis?.reference?.hd_harmonic_gate ? `Channel · Gate ${card.human_design.gate}–${synthesis.reference.hd_harmonic_gate}` : 'What completes it',
        hdDriveParas: P(synthesis?.synthesis.human_design.gate ?? card.human_design.description),
        hdCentreParas: P(synthesis?.synthesis.human_design.channel),
        hdChannelParas: P(synthesis?.synthesis.human_design.circuit),

        // Body
        bodyOrganChip: synthesis?.reference?.body_physiology ? `Organ · ${synthesis.reference.body_physiology}` : 'The Body',
        bodyAminoChip: synthesis?.reference?.body_amino_acid ? `Amino acid · ${synthesis.reference.body_amino_acid}` : '',
        bodyPhysParas: P(synthesis?.synthesis.body.physiology),
        bodyAminoParas: P(synthesis?.synthesis.body.amino_acid),

        // Relations intro
        relationsIntro: synthesis?.relations?.unity_line ?? (expanded ? expanded.i_ching.hexagrams_in_pairs.context.text : ''),
      };
    })(),
  };

  const piece = ulPieceForCard(card.number);
  const sortedNums = ALL_CARDS.map(c => c.number);
  const idx = sortedNums.indexOf(card.number);
  const prevCardNum = idx > 0 ? sortedNums[idx - 1] : null;
  const nextCardNum = idx < sortedNums.length - 1 ? sortedNums[idx + 1] : null;
  const palette = isDarkMode ? 'nightfall' : 'daybook';
  return (
    <>
      <EBReadingHost
        key={card.number}
        data={data}
        palette={isDarkMode ? 'nightfall' : 'daybook'}
        accent="bronze"
        reduceMotion={prefersReducedMotion()}
        showEntrance={showEntrance}
        onAcquire={() => setBuyOpen(true)}
        onShare={() => setShareOpen(true)}
        headerChartSlot={
          /* One quiet, low-contrast row of small-label actions under the
             chart callout: save, the physical piece, its place on the map.
             No borders, no boxes; the same muted type as the header's small
             labels, so the reading keeps its minimal rhythm. */
          <>
            <YourPositionCallout gate={card.number} />
            <div className="ul-slot-quiet-row">
              <SaveToCollectionButton kind="card" itemRef={String(card.number)} label="Save this card" />
              {piece && <Link to={`/piece/${piece.id}`}>View the Artwork</Link>}
              {atlasHref && <Link to={atlasHref}>On the Atlas</Link>}
            </div>
            <style>{quietRowStyles}</style>
          </>
        }
      />
      <BuySheet
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        piece={piece ?? null}
        imageUrl={`https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_700,c_fill,g_center/${ulCardPublicId(card.number) ?? ''}`}
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

      {/* Sticky bottom nav — prev / All 64 / next, as on the previous version. */}
      <div className="eb-reading" data-palette={palette} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: 'color-mix(in oklab, var(--l-bg) 92%, transparent)', borderTop: '1px solid var(--l-rule)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', height: 44, maxWidth: 1180, margin: '0 auto' }}>
          {prevCardNum !== null ? (() => { const c = CARD_BY_NUMBER.get(prevCardNum)!; return (
            <Link to={`/universal-language/${prevCardNum}`} state={{ quiet: true }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flex: 1, minWidth: 0, textDecoration: 'none' }}>
              <HexagramSVG upper={c.iching.upper_trigram.symbol} lower={c.iching.lower_trigram.symbol} color="var(--accent)" width={26} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-3)', lineHeight: 1, margin: 0 }}>← Code {c.number}</p>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--l-2)', lineHeight: 1.1, margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.card_name}</p>
              </div>
            </Link>
          ); })() : <div style={{ flex: 1 }} />}
          <Link to="/universal-language" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px', borderLeft: '1px solid var(--l-rule)', borderRight: '1px solid var(--l-rule)', flexShrink: 0, textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--l-1)', lineHeight: 1 }}>{card.number}</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-3)', marginTop: 3 }}>All 64</span>
          </Link>
          {nextCardNum !== null ? (() => { const c = CARD_BY_NUMBER.get(nextCardNum)!; return (
            <Link to={`/universal-language/${nextCardNum}`} state={{ quiet: true }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '0 12px', flex: 1, minWidth: 0, textDecoration: 'none' }}>
              <div style={{ minWidth: 0, textAlign: 'right' }}>
                <p style={{ fontFamily: 'var(--sans)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--l-3)', lineHeight: 1, margin: 0 }}>Code {c.number} →</p>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--l-2)', lineHeight: 1.1, margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.card_name}</p>
              </div>
              <HexagramSVG upper={c.iching.upper_trigram.symbol} lower={c.iching.lower_trigram.symbol} color="var(--accent)" width={26} />
            </Link>
          ); })() : <div style={{ flex: 1 }} />}
        </div>
      </div>
    </>
  );
};

/* The quiet actions row in the header slot. Palette-aware through the EB
   reading's own variables (--l-3 muted ink, --accent bronze), so it holds in
   both Day Book and Nightfall. The save button is SaveToCollectionButton's
   own markup, restyled here to plain label text: the override selector is
   more specific than the component's .stc__btn rules. */
const quietRowStyles = `
  .ul-slot-quiet-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 26px;
    row-gap: 8px;
    margin-top: 14px;
  }
  .ul-slot-quiet-row a {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--l-3);
    text-decoration: none;
    transition: color 0.25s;
  }
  .ul-slot-quiet-row a:hover { color: var(--accent); }
  .ul-slot-quiet-row .stc__btn {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--l-3);
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    transition: color 0.25s;
  }
  .ul-slot-quiet-row .stc__btn:hover { color: var(--accent); background: transparent; }
`;

/* ── light data mappers (live, with graceful fallback) ── */
function buildReldata(card: any, syn?: CardSynthesis, exp?: any): EBData['reldata'] {
  const rel = syn?.relations;
  const pairNum = rel?.pair?.number ?? exp?.i_ching?.hexagrams_in_pairs?.pair_hexagram;
  const pairCard = pairNum != null ? CARD_BY_NUMBER.get(pairNum) : undefined;
  const tarot = rel?.tarot?.teaching ?? syn?.synthesis.tarot.tarot_resonance ?? '';
  return {
    self: { kicker: 'Inverse · Its Own Reflection', kind: 'Itself', name: 'Its Own Reflection', body: [rel?.inverse?.teaching ?? 'The same lines turned, the situation seen from the other side.'] },
    pair: { kicker: 'The Pair · Programming Partner', kind: 'Complement', name: pairCard ? `UL ${pairCard.number} · ${pairCard.card_name}` : 'The Pair', body: [rel?.pair?.teaching ?? (exp?.i_ching?.hexagrams_in_pairs?.context?.text ?? '')].filter(Boolean) },
    ring14: { kicker: 'Codon Ring', kind: 'Codon kin', name: rel?.codon_ring?.name ?? exp?.gene_keys?.codon_ring?.name ?? 'Codon Ring', body: [rel?.codon_ring?.teaching ?? exp?.gene_keys?.codon_ring?.relationship_context ?? ''].filter(Boolean) },
    tarot: { kicker: 'Tarot', kind: 'Arcana', name: rel?.tarot?.card ?? syn?.reference?.tarot_card ?? card.ring_tarot ?? 'Tarot', body: [tarot].filter(Boolean) },
    immortal: { kicker: 'The Eight Immortals', kind: 'Daoist', name: rel?.immortals ? (rel.immortals.same_trigram ? rel.immortals.upper.name : `${rel.immortals.upper.name} · ${rel.immortals.lower.name}`) : 'The Immortal', body: [rel?.immortals?.teaching ?? ''].filter(Boolean) },
    hebrew: { kicker: 'Hebrew Letter', kind: 'The Letter', name: rel?.hebrew_letter?.letter ?? syn?.reference?.hebrew_letter ?? 'Hebrew Letter', body: [rel?.hebrew_letter?.teaching ?? ''].filter(Boolean) },
    sky: { kicker: 'The Sky', kind: 'Astrology', name: rel?.sky?.value ?? syn?.reference?.astrology ?? 'The Sky', body: [rel?.sky?.teaching ?? ''].filter(Boolean) },
  };
}

function buildKin(card: any, syn?: CardSynthesis, exp?: any): EBData['kin'] {
  const rel = syn?.relations;
  const pairNum = rel?.pair?.number ?? exp?.i_ching?.hexagrams_in_pairs?.pair_hexagram;
  const pairCard = pairNum != null ? CARD_BY_NUMBER.get(pairNum) : undefined;
  const sibs = card.codon_ring_siblings ?? [];
  const ringCard = sibs.length ? CARD_BY_NUMBER.get(sibs[0]) : undefined;
  const glyph = (n?: number) => (n != null ? (HEXAGRAM_CHINESE[n]?.char ?? String(n)) : '·');
  return [
    { key: 'pair', x: 24, y: 50, kind: 'kin', glyph: glyph(pairCard?.number), font: 'var(--cjk)', size: 'clamp(26px,6.8vw,34px)', dim: 'clamp(54px,13.5vw,66px)', svgR: 6.4, label: pairCard ? `UL ${pairCard.number}` : 'Pair' },
    { key: 'ring14', x: 76, y: 50, kind: 'kin', glyph: glyph(ringCard?.number), font: 'var(--cjk)', size: 'clamp(26px,6.8vw,34px)', dim: 'clamp(54px,13.5vw,66px)', svgR: 6.4, label: ringCard ? `UL ${ringCard.number}` : 'Ring' },
    { key: 'sky', x: 21.7, y: 21.7, kind: 'corr', glyph: '✦', font: 'var(--serif)', size: 'clamp(22px,5.6vw,28px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: syn?.reference?.astrology ?? 'Sky' },
    { key: 'tarot', x: 78.3, y: 21.7, kind: 'corr', glyph: 'XIV', font: 'var(--serif)', size: 'clamp(15px,4vw,19px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: syn?.reference?.tarot_card ?? card.ring_tarot ?? 'Tarot' },
    { key: 'hebrew', x: 21.7, y: 78.3, kind: 'corr', glyph: syn?.reference?.hebrew_letter ?? 'ס', font: 'var(--serif)', size: 'clamp(23px,6vw,30px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: syn?.reference?.hebrew_letter ?? 'Letter' },
    { key: 'immortal', x: 78.3, y: 78.3, kind: 'corr', glyph: '笛', font: 'var(--cjk)', size: 'clamp(22px,5.8vw,28px)', dim: 'clamp(46px,11.5vw,56px)', svgR: 5.4, label: 'Immortal' },
  ];
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
