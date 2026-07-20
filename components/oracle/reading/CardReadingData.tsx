/* The seam between the real oracle data and the imported card reading.

   Everything visible comes from the design files. This builds the six lens
   sections, the rail, the meta block and the artwork from the live card record
   and its synthesis, exactly the sources the current reading page uses:

     CARD_BY_NUMBER   the card itself (name, hexagram, element, gene keys, gate)
     getSynthesis     the authored prose per lens, loaded per card

   Nothing here is invented. Where a card has no prose written yet for a lens,
   that lens's section is left out rather than filled with placeholder text. */
import React, { useEffect, useState } from 'react';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import { getSynthesis, type CardSynthesis } from '../../../data/synthesisData';
import { ulCardImageUrl } from '../../../utils/universalLanguage';
import CardReading, { type CardReadingLens } from './CardReading';

/* Prose in these files is paragraph-separated by blank lines. */
const paras = (s?: string): string[] =>
  (s ?? '').split('\n\n').map((p) => p.trim()).filter(Boolean);

interface Section {
  lens: CardReadingLens;
  heading: string;
  body: string[];
}

function buildSections(card: any, syn?: CardSynthesis): Section[] {
  const s = syn?.synthesis;
  const out: Section[] = [];

  /* UL — the card's own reading. */
  const ul = paras(syn?.essence);
  if (ul.length) {
    out.push({
      lens: { id: 'ul', label: 'Universal Language', tab: 'UL', sum: String(card.number), glyph: 'star' },
      heading: card.card_name,
      body: ul,
    });
  }

  /* I Ching — the hexagram reading, then judgement and image. */
  const ich = [
    ...paras(s?.iching?.reading),
    ...(s?.iching?.judgement_lines ?? []),
    ...(s?.iching?.image_lines ?? []),
  ].filter(Boolean);
  if (ich.length) {
    out.push({
      lens: { id: 'iching', label: 'I Ching', tab: 'I Ching', sum: card.iching.hexagram_name, glyph: 'hex' },
      heading: card.iching.hexagram_name,
      body: ich,
    });
  }

  /* Gene Keys — the spectrum, shadow through siddhi. */
  const gk = [
    ...paras(s?.gene_keys?.shadow),
    ...paras(s?.gene_keys?.repressive),
    ...paras(s?.gene_keys?.reactive),
    ...paras(s?.gene_keys?.gift),
    ...paras(s?.gene_keys?.siddhi),
  ];
  if (gk.length) {
    const g = card.gene_keys;
    out.push({
      lens: { id: 'genekeys', label: 'Gene Keys', tab: 'Gene Keys', sum: `${g.shadow} → ${g.gift} → ${g.siddhi}`, glyph: 'sprout' },
      heading: `${g.shadow} · ${g.gift} · ${g.siddhi}`,
      body: gk,
    });
  }

  /* Human Design — gate, centre, channel. */
  const hd = [
    ...paras(s?.human_design?.gate),
    ...paras(s?.human_design?.channel),
    ...paras(s?.human_design?.circuit),
  ];
  if (hd.length) {
    out.push({
      lens: { id: 'humandesign', label: 'Human Design', tab: 'Human Design', tabShort: 'H. Design', sum: `Gate ${card.human_design.gate} · ${card.human_design.keyword}`, glyph: 'diamond' },
      heading: `Gate ${card.human_design.gate} · ${card.human_design.keyword}`,
      body: hd,
    });
  }

  /* Body — physiology and amino acid. */
  const body = [...paras(s?.body?.physiology), ...paras(s?.body?.amino_acid)];
  if (body.length) {
    out.push({
      lens: { id: 'body', label: 'Body', tab: 'Body', sum: 'Physiology', glyph: 'circle' },
      heading: 'In the Body',
      body,
    });
  }

  /* Relations — the unity line and the paired card. */
  const rel = syn?.relations;
  if (rel) {
    const relBody = [
      ...paras(rel.unity_line),
      ...(rel.pair?.teaching ? [`${rel.pair.card_name} · ${rel.pair.hexagram_name}`, rel.pair.teaching] : []),
    ];
    if (relBody.length) {
      out.push({
        lens: { id: 'relations', label: 'Relations', tab: 'Relations', sum: rel.pair ? `Paired with ${rel.pair.number}` : 'Relations', glyph: 'rings' },
        heading: 'Relations',
        body: relBody,
      });
    }
  }

  return out;
}

export const CardReadingData: React.FC<{ cardNumber: number; variant?: 'mobile' | 'desktop' }> = ({ cardNumber, variant }) => {
  const card = CARD_BY_NUMBER.get(cardNumber);
  const [syn, setSyn] = useState<CardSynthesis | undefined>();

  useEffect(() => {
    let cancelled = false;
    getSynthesis(cardNumber).then((d) => { if (!cancelled) setSyn(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [cardNumber]);

  if (!card) return null;

  const sections = buildSections(card, syn);
  const keywords = syn?.keywords ?? [];

  /* The design's left-hand meta block, from the card's own fields. */
  const meta = [
    { k: 'Element', v: card.element },
    { k: 'Gate', v: `${card.human_design.gate} — ${card.human_design.keyword}` },
    ...(keywords.length ? [{ k: 'Keynotes', v: keywords.join(', ') }] : []),
  ];

  /* data-sec is load-bearing: the design's scroll engine keys the rail, the
     progress marker and jump-to-section off it. */
  const reading = (
    <>
      {sections.map((sec) => (
        <section
          key={sec.lens.id}
          data-sec={sec.lens.id}
          style={{ padding: '56px 8% 64px', maxWidth: '760px', margin: '0 auto' }}
        >
          <p style={{ margin: '0 0 10px', fontFamily: "'Cinzel',serif", fontSize: '11px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#c6a667' }}>
            {sec.lens.label}
          </p>
          <h2 style={{ margin: '0 0 22px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 500, fontSize: '34px', lineHeight: 1.2, color: '#f3ecde' }}>
            {sec.heading}
          </h2>
          {sec.body.map((p, i) => (
            <p key={i} style={{ margin: '0 0 18px', fontFamily: "'Iowan Old Style Web',Georgia,serif", fontSize: '17px', lineHeight: 1.72, color: '#ddd4c2' }}>
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );

  const artwork = (
    <img
      src={ulCardImageUrl(card.number, 1080)}
      alt={`${card.card_name} · Code ${card.number}`}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );

  return (
    <CardReading
      variant={variant}
      lenses={sections.map((s) => s.lens)}
      meta={meta}
      cardKicker={`No. ${card.number} · Universal Language`}
      cardName={card.card_name}
      reading={reading}
      artwork={artwork}
    />
  );
};

export default CardReadingData;
