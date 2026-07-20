/* Host for the generated Reading markup — the reading body itself, which drops
   into the shell's <dc-import name="Reading"> slot.

   The design file's controller is only a renderVals (no lifecycle), so this
   host is a thin pass-through: it takes the fully-built slot bag from the data
   adapter and hands it to the generated markup. Everything visible, including
   the drop cap, the hexagram glyph, the gene keys spectrum layout and the
   relations table, is the design file's own. */
import React from 'react';
import { CardReadingBodyMarkup } from './CardReadingBody.generated';
import './CardReadingBody.style.css';

export interface HexLine {
  solid: boolean;
  broken: boolean;
}

export interface RelRow {
  label: string;
  text: string;
}

/* Every slot the generated reading markup binds. A field left empty renders as
   an empty block rather than sample text, which is what we want for a card
   whose prose is not written yet. */
export interface CardReadingBodyData {
  /* The reading's single opening line, under the card name. Not written for
     any card yet and no field for it in the oracle data. */
  ulLead: string;
  /* UL — the essence, with the design's drop cap on the opening paragraph. */
  ulKicker: string;
  cardName: string;
  dropCap: string;
  leadRest: string;
  essenceRest: string[];
  keywordsLine: string;
  /* I Ching */
  hexChar: string;
  upperTrigram: string;
  lowerTrigram: string;
  upperLines: HexLine[];
  lowerLines: HexLine[];
  hexName: string;
  trigramLine: string;
  hexLines: HexLine[];
  icComb: string;
  icRead: string[];
  icJudge: string;
  icImage: string;
  /* Gene Keys */
  gkShadowName: string;
  gkGiftName: string;
  gkSiddhiName: string;
  gkPartnerName: string;
  gkShadow: string[];
  gkRepressive: string;
  gkReactive: string;
  gkGift: string[];
  gkSiddhi: string[];
  gkPartner: string;
  /* Human Design */
  hdCentre: string;
  hdCentreLine: string;
  hdGate: string[];
  hdChannel: string[];
  hdCircuit: string[];
  /* Body */
  bodySite: string;
  bodySiteRaw: string;
  bodyAminoName: string;
  bodyPhys: string[];
  bodyAmino: string[];
  /* Relations */
  relTitle: string;
  relRingTarot: string;
  relIntro: string;
  relRows: RelRow[];
}

export const CardReadingBodyHost: React.FC<{ data: CardReadingBodyData }> = ({ data }) => (
  <CardReadingBodyMarkup vals={data} />
);

export default CardReadingBodyHost;
