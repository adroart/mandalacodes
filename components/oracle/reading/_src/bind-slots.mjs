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

const BINDINGS = [
  {
    file: DESKTOP,
    swaps: [
      // Header title block, above the meta list.
      ['No. 62 · Universal Language', '{{ cardKicker }}'],
      ['Voice of Nature', '{{ cardName }}'],
    ],
  },
  {
    file: READING,
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
      ['rcase;color:#a8874d;margin:0 0 11px;">The ', 'Judgement', '{{ relRingTarot }}'],

      // ── The four section standfirsts (23px lead above each lens's prose).
      //    These are editorial one-liners with no field of their own in the
      //    oracle data; see CardReadingData for what feeds them. ──
      ['font-size:23px;line-height:1.42;color:#ede4d4;margin:0;text-wrap:pretty;">', 'Thunder rests above the mountain — a sound sharp but contained, carrying further than its size suggests.', '{{ icLead }}'],
      ['font-size:23px;line-height:1.42;color:#ede4d4;margin:0;text-wrap:pretty;">', 'The gift turns the confusion of knowledge with understanding into language that carries actual seeing.', '{{ gkLead }}'],
      ['font-size:23px;line-height:1.42;color:#ede4d4;margin:0;text-wrap:pretty;">', 'The throat renders what has been understood into words that others can actually receive.', '{{ hdLead }}'],
      ['font-size:23px;line-height:1.42;color:#ede4d4;margin:0;text-wrap:pretty;">', 'The body becomes a living instrument for perceiving, expressing, and embodying with precision.', '{{ bodyLead }}'],
    ],
  },
];

for (const { file, swaps = [], anchored = [] } of BINDINGS) {
  let html = readFileSync(file, 'utf8');
  let changed = 0;
  let already = 0;

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
