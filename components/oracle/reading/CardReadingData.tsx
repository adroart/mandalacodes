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
import { ulCardImageUrl, ulPieceForCard } from '../../../utils/universalLanguage';
import CardReading, { type CardReadingLens } from './CardReading';
import Navigation from '../../Navigation';
import { hexagramLineBooleans } from '../HexagramGlyph';
import CardReadingBodyHost, { type CardReadingBodyData } from './generated/CardReadingBody.host';
import UniversalLanguageCard from '../../UniversalLanguageCard';

/* Prose in these files is paragraph-separated by blank lines. */
const paras = (s?: string): string[] =>
  (s ?? '').split('\n\n').map((p) => p.trim()).filter(Boolean);

/* The six lenses, in the order the design's rail expects them. */
const LENSES: CardReadingLens[] = [
  { id: 'ul', label: 'Universal Language', tab: 'UL', glyph: 'star' },
  { id: 'iching', label: 'I Ching', tab: 'I Ching', glyph: 'hex' },
  { id: 'genekeys', label: 'Gene Keys', tab: 'Gene Keys', glyph: 'sprout' },
  { id: 'humandesign', label: 'Human Design', tab: 'Human Design', glyph: 'diamond' },
  { id: 'body', label: 'Body', tab: 'Body', glyph: 'circle' },
  { id: 'relations', label: 'Relations', tab: 'Relations', glyph: 'rings' },
];


/* The design's own top block: kicker, card name, the hexagram divider and the
   keywords. The live reading's hero has no kicker and no hexagram divider, so
   it cannot reproduce this layout; the design file can, and it is generated
   markup rather than markup written here. Only its header shows (see
   card-reading-fullbleed.css) and the live reading supplies every chapter.

   The fields below the header are required by the type but never rendered, so
   they are left empty rather than computed twice. */
function buildHeader(card: any, syn?: CardSynthesis): CardReadingBodyData {
  const hexLines = hexagramLineBooleans(
    card.iching.upper_trigram.symbol,
    card.iching.lower_trigram.symbol,
  ).map((solid) => ({ solid, broken: !solid }));

  const none = { hexChar: '', upperTrigram: '', lowerTrigram: '', upperLines: [], lowerLines: [],
    hexName: '', trigramLine: '', icComb: '', icRead: [], icJudge: '', icImage: '',
    gkShadowName: '', gkGiftName: '', gkSiddhiName: '', gkPartnerName: '', gkShadow: [],
    gkRepressive: '', gkReactive: '', gkGift: [], gkSiddhi: [], gkPartner: '',
    hdCentre: '', hdCentreLine: '', hdGate: [], hdChannel: [], hdCircuit: [],
    bodySite: '', bodySiteRaw: '', bodyAminoName: '', bodyPhys: [], bodyAmino: [],
    relTitle: '', relIntro: '', relRows: [],
    dropCap: '', leadRest: '', essenceRest: [] };

  return {
    ...none,
    ulKicker: `Universal Language ${card.number}`,
    cardName: card.card_name,
    keywordsLine: (syn?.keywords ?? []).join(' · '),
    hexLines,
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
  const piece = ulPieceForCard(card.number);

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

  /* The reading body is the LIVE reading, mounted whole inside the new shell.

     The imported Reading.dc.html was a second, thinner implementation of a
     reading that already exists and is far richer: the kin diagram, the coin
     cast, the shadow/gift/siddhi switcher, the artwork lightbox, share and
     acquire, and all of the real content wiring. Rebuilding that against the
     new design would have meant reproducing months of work and losing
     behaviour on the way. The new design's value is the shell around it, so
     the shell is what we keep and the live body goes inside.

     UniversalLanguageCard reads the card number from the route, which is the
     same :number param this preview uses, so it needs nothing passed to it.
     Its own progress rail is hidden in card-reading-fullbleed.css because the
     shell supplies that, and the shell's scroll engine reads its sections via
     data-chapter (see the note in the hosts). */
  const reading = (
    <>
      <div className="card-reading__designed-header">
        <CardReadingBodyHost data={buildHeader(card, syn)} />
      </div>
      <UniversalLanguageCard />
    </>
  );

  /* Full width of its column at the artwork's own square proportion: never
     cropped (the pattern IS the piece) and never letterboxed inside a taller
     box. The slot's fixed height is released in card-reading-fullbleed.css. */
  const artwork = (
    <img
      src={ulCardImageUrl(card.number, 1080)}
      alt={`${card.card_name} · Code ${card.number}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  );

  return (
    <CardReading
      variant={variant}
      lenses={lenses}
      meta={meta}
      cardKicker={`No. ${card.number} · Universal Language`}
      cardName={card.card_name}
      forMeHref="/profile"
      pieceHref={piece ? `/piece/${piece.id}` : '/universal-language'}
      familyHref="/family"
      reading={reading}
      artwork={artwork}
      topNav={<Navigation />}
    />
  );
};

export default CardReadingData;
