import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CARD_BY_NUMBER } from '../data/oracleData';
import { getExpandedCard } from '../data/expandedOracleData';
import { getSynthesis, getInvocation, type CardSynthesis } from '../data/synthesisData';
import { getLineText } from '../data/ichingLines';
import { HEXAGRAM_CHINESE } from '../data/hexagramChinese';
import { ulCardImageUrl, ulCardPublicId } from '../utils/universalLanguage';
import { useMetaTags } from '../hooks/useMetaTags';
import { useDarkMode } from '../DarkModeContext';
import { EBReadingHost, type EBData } from './oracle/eb/generated/EBReading.host';
import './oracle/eb/eb-template.css';

/* Earth's Breath card reading. The visible component is GENERATED from the
   imported design file (components/oracle/eb/generated/*) by the dc-import
   converter — no hand-typed markup. This wrapper only builds the per-card data
   bag (EBData) from the live oracle data and hands it to the generated host. */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const seen = new Set<number>();

const UniversalLanguageCard: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const { isDarkMode } = useDarkMode();
  const cardNum = parseInt(number ?? '', 10);
  const card = CARD_BY_NUMBER.get(cardNum);
  const expanded = getExpandedCard(cardNum);
  const [synthesis, setSynthesis] = useState<CardSynthesis | undefined>(undefined);
  const [invocation, setInvocation] = useState<string | undefined>(undefined);
  const [showEntrance] = useState(() => { const s = !seen.has(cardNum); if (s) seen.add(cardNum); return s; });

  useEffect(() => {
    document.documentElement.classList.add('oracle-card-page');
    return () => document.documentElement.classList.remove('oracle-card-page');
  }, []);
  useEffect(() => {
    let cancelled = false;
    getSynthesis(cardNum).then(d => { if (!cancelled) setSynthesis(d); }).catch(() => {});
    getInvocation(cardNum).then(v => { if (!cancelled) setInvocation(v); }).catch(() => {});
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
    // moving lines: the six line texts for this hexagram
    moving: [1, 2, 3, 4, 5, 6].map(n => ({ n, image: '', becomes: '', text: getLineText(card.number, n) })),
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
        heroGlyph: hexChar,
        ichingGlyph: hexChar,
        code2: String(card.number).padStart(2, '0'),
        ichingHexName: card.iching.hexagram_name,
        ichingHexFormula: `${cleanTrig(card.iching.upper_trigram.name)} over ${cleanTrig(card.iching.lower_trigram.name)}`,
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

  return (
    <EBReadingHost
      key={card.number}
      data={data}
      palette={isDarkMode ? 'nightfall' : 'daybook'}
      accent="bronze"
      reduceMotion={prefersReducedMotion()}
      showEntrance={showEntrance}
    />
  );
};

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
