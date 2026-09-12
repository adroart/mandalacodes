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
import { ulCardArtFloatsFree, ulCardHeroImageUrl, ulPieceForCard } from '../../../utils/universalLanguage';
import CardReading, { type CardReadingLens } from './CardReading';
import Navigation from '../../Navigation';
import { isChunkLoadError } from '../../ChunkErrorBoundary';
import { warmOracleForOffline } from '../../../lib/oracle/offlineWarm';
import { hexagramLineBooleans } from '../HexagramGlyph';
import CardReadingBodyHost, { type CardReadingBodyData } from './generated/CardReadingBody.host';

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

interface Props {
  cardNumber: number;
  variant?: 'mobile' | 'desktop';
  /* The reading itself, passed in by whoever owns it. Passed in rather than
     imported here: the card page already loads this shell, so importing the
     page back would leave the two waiting on each other. That loop is invisible
     in development and breaks the built site. */
  reading: React.ReactNode;
}

export const CardReadingData: React.FC<Props> = ({ cardNumber, variant, reading: readingBody }) => {
  const card = CARD_BY_NUMBER.get(cardNumber);
  const [syn, setSyn] = useState<CardSynthesis | undefined>();
  const [loadFailure, setLoadFailure] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setSyn(undefined);
    setLoadFailure(null);
    getSynthesis(cardNumber)
      .then((d) => { if (!cancelled) setSyn(d); })
      .catch((error: unknown) => { if (!cancelled) setLoadFailure(error); });
    return () => { cancelled = true; };
  }, [cardNumber]);

  /* A printed plaque sends its visitor straight here, never past the deck
     index, so this is where the deck has to be warmed for offline as well.
     Warming only from the index left a scanned card as the one card that
     could go blank the moment signal dropped. */
  useEffect(() => {
    warmOracleForOffline({ startAt: cardNumber });
  }, [cardNumber]);

  /* A card's prose is a chunk fetched on demand, so on a device that reached
     this card before the warm pass stored it, offline, that fetch simply
     fails. Swallowing it rendered every lens permanently empty and said
     nothing. Hand it up to the boundary that already owns this exact case and
     already has the sentence for it. Only failures that boundary accepts are
     rethrown; anything else (a malformed manuscript, say) is not a connection
     problem and must not be dressed as one. */
  if (loadFailure !== null && isChunkLoadError(loadFailure)) throw loadFailure;

  if (!card) return null;

  const keywords = syn?.keywords ?? [];
  const piece = ulPieceForCard(card.number);
  const pieceHref = piece ? `/piece/${piece.id}` : '/universal-language';

  /* The design's left-hand meta block, from the card's own fields. */
  const meta = [
    { k: 'Element', v: card.element },
    { k: 'Gate', v: `${card.human_design.gate} · ${card.human_design.keyword}` },
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

  /* The reading itself comes from the card page, which owns it. The shell only
     puts the designed header above it and the frame around it. */
  const reading = (
    <>
      <div className="card-reading__designed-header">
        <CardReadingBodyHost data={buildHeader(card, syn)} />
      </div>
      {readingBody}
    </>
  );

  /* Full width of its column at the artwork's own square proportion: never
     cropped (the pattern IS the piece) and never letterboxed inside a taller
     box. The slot's fixed height is released in card-reading-fullbleed.css. */
  const artwork = (
    <img
      src={ulCardHeroImageUrl(card.number)}
      alt={`${card.card_name} · Code ${card.number}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      crossOrigin="anonymous"
    />
  );

  return (
    <CardReading
      variant={variant}
      lenses={lenses}
      meta={meta}
      cardKicker={`No. ${card.number} · Universal Language`}
      cardName={card.card_name}
      hexLines={hexagramLineBooleans(card.iching.upper_trigram.symbol, card.iching.lower_trigram.symbol).map((solid) => ({ solid, broken: !solid }))}
      hexHref="#iching"
      cardNumber={String(card.number)}
      elementLine={card.element}
      gateLine={`Gate ${card.human_design.gate} · ${card.human_design.keyword} · Universal Language`}
      keynotes={keywords}
      forMeHref="/profile"
      pieceHref={pieceHref}
      familyHref="/family"
      tabs={[
        { id: 'family', label: 'Family', color: '#80735f', href: '/family' },
        { id: 'forme', label: 'For Me', color: '#80735f', href: '/profile' },
        { id: 'deck', label: 'The 64', color: '#c6a667', href: '/universal-language' },
        { id: 'piece', label: 'Piece', color: '#80735f', href: pieceHref },
        { id: 'share', label: 'Share', color: '#80735f', href: '#share' },
      ]}
      reading={reading}
      artwork={artwork}
      artFloatsFree={ulCardArtFloatsFree(card.number)}
      topNav={<Navigation />}
    />
  );
};

export default CardReadingData;
