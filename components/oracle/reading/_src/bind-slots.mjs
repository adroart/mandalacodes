/* Bind pass for the Card Reading import.

   The design files carry card 62's content as literal text in places rather
   than as {{ slots }}, so it cannot be driven by data. Without this, every card
   renders card 62's headings: open card 7 and it still says "Voice of Nature",
   "Small Exceeding", "Precision", "Throat & Thyroid".

   This turns those literals into slots in the source .dc.html so the converter
   emits real bindings. Run before the converter, after any re-download from
   Claude Design:

     node components/oracle/reading/_src/bind-slots.mjs

   Each swap is anchored on the surrounding style attribute so it hits the one
   intended element and never a mention of the same words inside prose. Text
   content only, never markup, so the tree stays balanced. Idempotent.

   Anything the design states that has no field behind it in the oracle data is
   deliberately NOT bound — better a static line than an invented one. */
import { readFileSync, writeFileSync } from 'node:fs';

const DESKTOP = 'components/oracle/reading/_src/Card Reading v2 - Wide Image (Desktop, locked).dc.html';
const READING = 'components/oracle/reading/_src/Reading.dc.html';
const MOBILE = 'components/oracle/reading/_src/Card Reading - Mobile.dc.html';

/* The mobile file draws its own compact brand row. The site's real bar is the
   better one and is already what the live card page uses, so the header
   becomes a slot the app fills with <Navigation />. Matched by its opening tag
   through its close, a balanced swap. */
const MOBILE_HEADER_OPEN = '<header style="flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;height:56px;padding:0 22px;background:#211c16;border-bottom:1px solid rgba(168,135,77,.2);">';
const MOBILE_HEADER_SLOT = '<dc-import name="TopNav" hint-size="100%,56px"></dc-import>';

/* The two trigram rows in the I Ching section carry card 62's trigrams as a
   fixed pattern of <i> bars. Replaced with a loop over the card's own lines,
   reusing the design's exact bar sizes and colour. Whole-element children are
   swapped, so the tree stays balanced. */
const TRIGRAM_BARS = (which) =>
  `<sc-for list="{{ ${which} }}" as="ln">`
  + `<span style="display:flex;gap:4px;">`
  + `<sc-if value="{{ ln.solid }}"><i style="width:32px;height:4px;background:#80735f;"></i></sc-if>`
  + `<sc-if value="{{ ln.broken }}"><i style="width:14px;height:4px;background:#80735f;"></i><i style="width:14px;height:4px;background:#80735f;"></i></sc-if>`
  + `</span></sc-for>`;

const BAR_SOLID = '<span style="display:flex;gap:4px;"><i style="width:32px;height:4px;background:#80735f;"></i></span>';
const BAR_BROKEN = '<span style="display:flex;gap:4px;"><i style="width:14px;height:4px;background:#80735f;"></i><i style="width:14px;height:4px;background:#80735f;"></i></span>';

/* Card 62: upper is Thunder (broken, broken, solid), lower is Mountain
   (solid, broken, broken) reading top to bottom. */
const UPPER_FIXED = BAR_BROKEN + BAR_BROKEN + BAR_SOLID;
const LOWER_FIXED = BAR_SOLID + BAR_BROKEN + BAR_BROKEN;

/* The four per-lens standfirsts the design carried. Removed whole (wrapper and
   paragraph together, a balanced removal) now that the reading opens with one
   line instead of repeating one per section. */
const DEAD_LEADS = ['icLead', 'gkLead', 'hdLead', 'bodyLead'].map((slot) =>
  '<div style="max-width:772px;margin:0 auto;padding:24px var(--read-pad,44px) 0;">'
  + `<p style="font-family:'Cormorant Garamond',serif;font-weight:500;font-size:23px;`
  + `line-height:1.42;color:#ede4d4;margin:0;text-wrap:pretty;">{{ ${slot} }}</p></div>`);

const BINDINGS = [
  {
    file: DESKTOP,
    anchored: [
      /* The bar's five links. Identical prefixes, so they bind in document
         order: family, for me, the deck, the piece, share. Share carries a
         marker so the host can hand its click to the real share sheet. */
      ['<a ', 'href="#top" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba', 'href="{{ familyHref }}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba'],
      ['<a ', 'href="#top" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba', 'href="{{ forMeHref }}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba'],
      ['<a ', 'href="#top" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba', 'href="{{ deckHref }}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba'],
      ['<a ', 'href="#top" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba', 'href="{{ pieceHref }}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;border-right:1px solid rgba'],
      ['<a ', 'href="#top" style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;transition:background .3s e', 'href="{{ shareHref }}" data-bar-share style="flex:1;display:flex;align-items:center;justify-content:center;gap:14px;transition:background .3s e'],
      /* The side column's three links and the brand mark shipped as "#top"
         placeholders. The two row links are byte-identical, so they bind in
         document order: the piece first, then family. */
      ['<a ', 'href="#top" style="display:flex;flex-direction:column;line-height:1.22;text-align:center;"', 'href="/" style="display:flex;flex-direction:column;line-height:1.22;text-align:center;"'],
      ['<a ', 'href="#top" style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid', 'href="{{ forMeHref }}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid'],
      ['<a ', 'href="#top" style="display:flex;align-items:center;justify-content:space-between;gap:10px;transition:transform .3s ease;"', 'href="{{ pieceHref }}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;transition:transform .3s ease;"'],
      ['<a ', 'href="#top" style="display:flex;align-items:center;justify-content:space-between;gap:10px;transition:transform .3s ease;"', 'href="{{ familyHref }}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;transition:transform .3s ease;"'],
    ],
    swaps: [
      // The header nav shipped as href="#top" placeholders. Bound so each item
      // carries its real destination.
      ['<a href="#top" style="position:relative;font-family:\'Iowan Old Style Web\',serif;font-size:13px;', '<a href="{{ h.href }}" style="position:relative;font-family:\'Iowan Old Style Web\',serif;font-size:13px;'],
      // Header title block, above the meta list.
      ['No. 62 · Universal Language', '{{ cardKicker }}'],
      ['Voice of Nature', '{{ cardName }}'],
    ],
  },
  {
    file: MOBILE,
    spans: [{ open: MOBILE_HEADER_OPEN, closeTag: '</header>', replacement: MOBILE_HEADER_SLOT }],
  },
  {
    file: READING,
    removals: DEAD_LEADS,
    /* Handles for the chart invitation, so it can be restyled in CSS without
       touching generated markup. Data attributes rather than a class, because
       style-hover already claims the class slot. */
    swaps: [
      ['<a href="#top" style="display:var(--cta-display,none);', '<a data-chart-cta href="/profile" style="display:var(--cta-display,none);'],
      ['<span style="width:30px;height:30px;border-radius:50%;background:#c6a667;', '<span data-chart-arrow style="width:30px;height:30px;border-radius:50%;background:#c6a667;'],
    ],
    // [anchor, literal, slot] — anchor is the style attribute ending that
    // uniquely identifies the element, so prose mentions are never touched.
    anchored: [
      // ── Universal Language ──
      ['rcase;color:#a8874d;margin:0 0 10px;">', 'Universal Language 62', '{{ ulKicker }}'],
      ['pacing:.01em;color:#ede4d4;margin:0;">', 'Voice of Nature', '{{ cardName }}'],

      // ── I Ching ──
      [';color:#c6a667;letter-spacing:.04em;">', '小過', '{{ hexChar }}'],
      ['px;color:#c6a667;margin-bottom:24px;">', '小過', '{{ hexChar }}'],
      ['e:19px;color:#8a7c60;margin-top:6px;">', 'Small Exceeding', '{{ hexName }}'],
      [':19px;color:#ede4d4;line-height:1.2;">', 'Small Exceeding', '{{ hexName }}'],
      ["ond',serif;font-size:15px;color:#80735f;\">", 'Thunder over Mountain', '{{ trigramLine }}'],
      // The two trigram rows: names, then the bar glyphs beside them.
      ["e:17px;color:#d6c9b0;\">", 'Thunder · Chên', '{{ upperTrigram }}'],
      ["e:17px;color:#d6c9b0;\">", 'Mountain · Kên', '{{ lowerTrigram }}'],
      ['gap:3px;flex-shrink:0;">', UPPER_FIXED, TRIGRAM_BARS('upperLines')],
      ['gap:3px;flex-shrink:0;">', LOWER_FIXED, TRIGRAM_BARS('lowerLines')],

      // ── Gene Keys: the spectrum band, then each plate's heading ──
      ["f;font-size:20px;color:#a89a80;margin:0;\">", 'Intellect', '{{ gkShadowName }}'],
      ["f;font-size:20px;color:#a89a80;margin:0;\">", 'Impeccability', '{{ gkSiddhiName }}'],
      ['nt-size:22px;color:#f3ecde;margin:0;">', 'Precision', '{{ gkGiftName }}'],
      ['size:21px;color:#ede4d4;margin:0 0 16px;">', 'Intellect', '{{ gkShadowName }}'],
      ['size:21px;color:#ede4d4;margin:0 0 16px;">', 'Precision', '{{ gkGiftName }}'],
      ['size:21px;color:#ede4d4;margin:0 0 16px;">', 'Impeccability', '{{ gkSiddhiName }}'],
      ['size:21px;color:#ede4d4;margin:0 0 16px;">', 'Key 61 · Inspiration', '{{ gkPartnerName }}'],
      ['e:19px;color:#8a7c60;margin-top:6px;">', 'Precision', '{{ gkGiftName }}'],

      // ── Human Design ──
      ['e:19px;color:#8a7c60;margin-top:6px;">', 'The Throat', '{{ hdCentre }}'],
      [':19px;color:#80735f;margin:0 0 14px;">', 'The Throat — manifestation &amp; expression', '{{ hdCentreLine }}'],

      // ── Body ──
      ['e:19px;color:#8a7c60;margin-top:6px;">', 'Throat & Thyroid', '{{ bodySite }}'],
      ['or:#c6a667;margin:0 0 14px;">Amino Acid · ', 'Tyrosine', '{{ bodyAminoName }}'],

      ['or:#c6a667;margin:0 0 14px;">Physiology · ', 'Throat / Thyroid', '{{ bodySiteRaw }}'],

      // ── Relations ──
      ['e:19px;color:#8a7c60;margin-top:6px;">', 'The Ecology of Truth', '{{ relTitle }}'],


    ],
  },
];

for (const { file, swaps = [], anchored = [], removals = [], spans = [] } of BINDINGS) {
  let html = readFileSync(file, 'utf8');
  let changed = 0;
  let already = 0;

  /* Replace a whole element, from its opening tag through its matching close. */
  for (const { open, closeTag, replacement } of spans) {
    if (html.includes(replacement)) { already++; continue; }
    const a = html.indexOf(open);
    if (a < 0) { console.warn(`  ! span "${open.slice(0, 40)}…" not found`); continue; }
    const b = html.indexOf(closeTag, a);
    if (b < 0) { console.warn(`  ! close "${closeTag}" not found`); continue; }
    html = html.slice(0, a) + replacement + html.slice(b + closeTag.length);
    changed++;
  }

  for (const dead of removals) {
    if (!html.includes(dead)) { already++; continue; }
    html = html.split(dead).join('');
    changed++;
  }

  for (const [literal, slot] of swaps) {
    if (html.includes(slot)) { already++; continue; }
    if (!html.includes(literal)) {
      console.warn(`  ! "${literal}" not found — the design may have changed`);
      continue;
    }
    html = html.split(literal).join(slot);
    changed++;
  }

  for (const [anchor, literal, slot] of anchored) {
    const target = anchor + literal;
    const bound = anchor + slot;
    if (html.includes(bound)) { already++; continue; }
    const at = html.indexOf(target);
    if (at < 0) {
      console.warn(`  ! anchored "${literal}" not found — the design may have changed`);
      continue;
    }
    // Replace this one occurrence only.
    html = html.slice(0, at) + bound + html.slice(at + target.length);
    changed++;
  }

  if (changed) writeFileSync(file, html);
  console.log(`${file.split('/').pop()} — bound ${changed}, already bound ${already}`);
}
