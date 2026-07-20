/* The seam between the real oracle data and the imported card reading.

   Everything visible is the design files' own markup. This only builds the slot
   bag they bind, from the live sources the current reading page already uses:

     CARD_BY_NUMBER   the card record (name, hexagram, element, gene keys, gate)
     getSynthesis     the authored prose per lens, loaded per card

   Nothing here is written by hand. Where a card has no prose authored yet for a
   lens, that slot is left empty rather than filled with sample text. */
import React, { useEffect, useState } from 'react';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import { getSynthesis, type CardSynthesis } from '../../../data/synthesisData';
import { ulCardImageUrl } from '../../../utils/universalLanguage';
import { hexagramLineBooleans } from '../HexagramGlyph';
import { HEXAGRAM_CHINESE } from '../../../data/hexagramChinese';
import CardReading, { type CardReadingLens } from './CardReading';
import CardReadingBodyHost, { type CardReadingBodyData } from './generated/CardReadingBody.host';

/* The design carries a one-line standfirst above each lens's prose. No card has
   one written, and there is no field for it in the oracle data, so the slot
   holds this until the lines are authored. Deliberately reads as unwritten
   rather than as finished copy. */
const LEAD_PLACEHOLDER = 'Summary line to come.';

/* Prose in these files is paragraph-separated by blank lines. */
const paras = (s?: string): string[] =>
  (s ?? '').split('\n\n').map((p) => p.trim()).filter(Boolean);

/* The six lenses, in the order the design's rail expects them. */
const LENSES: CardReadingLens[] = [
  { id: 'ul', label: 'Universal Language', tab: 'UL', glyph: 'star' },
  { id: 'iching', label: 'I Ching', tab: 'I Ching', glyph: 'hex' },
  { id: 'genekeys', label: 'Gene Keys', tab: 'Gene Keys', glyph: 'sprout' },
  { id: 'humandesign', label: 'Human Design', tab: 'Human Design', tabShort: 'H. Design', glyph: 'diamond' },
  { id: 'body', label: 'Body', tab: 'Body', glyph: 'circle' },
  { id: 'relations', label: 'Relations', tab: 'Relations', glyph: 'rings' },
];

function buildBody(card: any, syn?: CardSynthesis): CardReadingBodyData {
  const s = syn?.synthesis;
  const rel = syn?.relations;

  /* The design opens the reading with a drop cap, so the first paragraph is
     split into its first character and the remainder. */
  const essence = paras(syn?.essence);
  const lead = essence[0] ?? '';

  const hexLines = hexagramLineBooleans(
    card.iching.upper_trigram.symbol,
    card.iching.lower_trigram.symbol,
  ).map((solid) => ({ solid, broken: !solid }));

  /* "Thunder (Chen)" -> "Thunder · Chen", the way the design writes it. */
  const trigramName = (n: string) => n.replace(/\s*\(([^)]+)\)\s*$/, ' · $1').trim();

  /* The design's relations table: one row per relationship the card carries.
     Rows with nothing authored are dropped rather than shown empty. */
  const relRows = [
    rel?.pair && { label: `The Pair · Key ${rel.pair.number}`, text: rel.pair.teaching },
    rel?.tarot && { label: `Tarot · ${rel.tarot.card}`, text: rel.tarot.teaching },
    rel?.hebrew_letter && { label: `Hebrew · ${rel.hebrew_letter.letter}`, text: rel.hebrew_letter.teaching },
    rel?.sky && { label: `The Sky · ${rel.sky.value}`, text: rel.sky.teaching },
    rel?.codon_ring && { label: `Ring · ${rel.codon_ring.name}`, text: rel.codon_ring.teaching },
  ].filter(Boolean) as { label: string; text: string }[];

  const ref = syn?.reference;
  const g = card.gene_keys;

  /* "Thunder over Mountain" — the trigram pair, romanisations dropped. */
  const bare = (t: string) => t.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const partner = rel?.programming_partner;
  const partnerCard = partner ? CARD_BY_NUMBER.get(partner.number) : undefined;

  const icReadParas = paras(s?.iching?.reading);
  const gkGiftParas = paras(s?.gene_keys?.gift);
  const hdGateParas = paras(s?.human_design?.gate);
  const bodyPhysParas = paras(s?.body?.physiology);

  return {
    /* Not written for any card yet, so the design's slot holds a placeholder
       rather than an echo of the paragraph directly beneath it. */
    icLead: LEAD_PLACEHOLDER,
    gkLead: LEAD_PLACEHOLDER,
    hdLead: LEAD_PLACEHOLDER,
    bodyLead: LEAD_PLACEHOLDER,

    ulKicker: `Universal Language ${card.number}`,
    cardName: card.card_name,
    dropCap: lead.charAt(0),
    leadRest: lead.slice(1),
    essenceRest: essence.slice(1),
    keywordsLine: (syn?.keywords ?? []).join(' · '),

    hexChar: HEXAGRAM_CHINESE[card.number]?.char ?? '',
    hexName: card.iching.hexagram_name,
    trigramLine: `${bare(card.iching.upper_trigram.name)} over ${bare(card.iching.lower_trigram.name)}`,
    hexLines: hexLines,
    upperTrigram: trigramName(card.iching.upper_trigram.name),
    lowerTrigram: trigramName(card.iching.lower_trigram.name),
    upperLines: hexLines.slice(0, 3),
    lowerLines: hexLines.slice(3),
    icComb: s?.iching?.trigram_combination ?? '',
    icRead: icReadParas,
    icJudge: (s?.iching?.judgement_lines ?? []).join(' '),
    icImage: (s?.iching?.image_lines ?? []).join(' '),

    gkShadowName: g.shadow,
    gkGiftName: g.gift,
    gkSiddhiName: g.siddhi,
    gkPartnerName: partnerCard
      ? `Key ${partnerCard.number} · ${partnerCard.gene_keys.gift}`
      : partner ? `Key ${partner.number}` : '',
    gkShadow: paras(s?.gene_keys?.shadow),
    gkRepressive: s?.gene_keys?.repressive ?? '',
    gkReactive: s?.gene_keys?.reactive ?? '',
    gkGift: gkGiftParas,
    gkSiddhi: paras(s?.gene_keys?.siddhi),
    gkPartner: s?.gene_keys?.programming_partner ?? '',

    /* The design writes the centre as "The Throat"; the data holds "Throat". */
    hdCentre: ref?.hd_center ? `The ${ref.hd_center}` : '',
    hdCentreLine: ref?.hd_center
      ? `The ${ref.hd_center}${ref.hd_circuit ? ` — ${ref.hd_circuit} circuit` : ''}`
      : '',
    hdGate: hdGateParas,
    hdChannel: paras(s?.human_design?.channel),
    hdCircuit: paras(s?.human_design?.circuit),

    bodySite: (ref?.body_physiology ?? '').replace('/', ' & '),
    bodySiteRaw: ref?.body_physiology ?? '',
    bodyAminoName: ref?.body_amino_acid ?? '',
    bodyPhys: bodyPhysParas,
    bodyAmino: paras(s?.body?.amino_acid),

    /* The design's relations subtitle has no field behind it; the codon ring is
       the card's real relations-level identity, so it stands there instead. */
    relTitle: rel?.codon_ring?.name ?? 'Relations',
    relRingTarot: (rel?.codon_ring?.tarot ?? '').replace(/^\d+\s*-\s*/, ''),
    relIntro: rel?.unity_line ?? '',
    relRows,
  };
}

export const CardReadingData: React.FC<{ cardNumber: number; variant?: 'mobile' | 'desktop' }> = ({ cardNumber, variant }) => {
  const card = CARD_BY_NUMBER.get(cardNumber);
  const [syn, setSyn] = useState<CardSynthesis | undefined>();

  useEffect(() => {
    let cancelled = false;
    setSyn(undefined);
    getSynthesis(cardNumber).then((d) => { if (!cancelled) setSyn(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [cardNumber]);

  if (!card) return null;

  const keywords = syn?.keywords ?? [];

  /* The design's left-hand meta block, from the card's own fields. */
  const meta = [
    { k: 'Element', v: card.element },
    { k: 'Gate', v: `${card.human_design.gate} — ${card.human_design.keyword}` },
    ...(keywords.length ? [{ k: 'Keynotes', v: keywords.join(', ') }] : []),
  ];

  /* Per-lens summary on the desktop rail, from the card record. */
  const lenses = LENSES.map((l) => {
    const g = card.gene_keys;
    const sum =
      l.id === 'ul' ? card.card_name
      : l.id === 'iching' ? card.iching.hexagram_name
      : l.id === 'genekeys' ? `${g.shadow} · ${g.gift} · ${g.siddhi}`
      : l.id === 'humandesign' ? `Gate ${card.human_design.gate} · ${card.human_design.keyword}`
      : l.id === 'body' ? (syn?.reference?.body_physiology ?? 'In the body')
      : syn?.relations?.pair ? `Paired with ${syn.relations.pair.number}` : 'Relations';
    return { ...l, sum };
  });

  /* The reading body is the design's own Reading file, not markup written here.
     It already carries data-sec on each of the six sections, which is what the
     shell's scroll engine keys the rail and progress marker off. */
  const reading = <CardReadingBodyHost data={buildBody(card, syn)} />;

  /* contain, not cover: the mandala is a square artwork and cropping it cuts
     the pattern, which is the piece itself. */
  const artwork = (
    <img
      src={ulCardImageUrl(card.number, 1080)}
      alt={`${card.card_name} · Code ${card.number}`}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );

  return (
    <CardReading
      variant={variant}
      lenses={lenses}
      meta={meta}
      cardKicker={`No. ${card.number} · Universal Language`}
      cardName={card.card_name}
      reading={reading}
      artwork={artwork}
    />
  );
};

export default CardReadingData;
