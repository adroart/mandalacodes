/* Preview surface for the imported card reading, at /preview/card-reading.
   Renders the design's own defaults so the page can be diffed against the
   source .dc.html. `?variant=mobile` or `?variant=desktop` forces one side of
   the breakpoint; with no query it follows the viewport.

   The two design files supply only the shell, so this fills the Reading slot
   with placeholder sections carrying data-sec — enough for the design's own
   scroll engine (rail, marker, jump-to-section) to wire and be verified. Real
   card prose replaces this when the surface is wired to the deck. */
import React from 'react';
import { useLocation } from 'react-router-dom';
import CardReading, { type CardReadingLens } from './CardReading';
import { ulCardImageUrl } from '../../../utils/universalLanguage';

const LENSES: (CardReadingLens & { body: string[] })[] = [
  { id: 'ul', label: 'Universal Language', tab: 'UL', sum: '62', glyph: 'star',
    body: ['The sixty-second form holds precision as its whole argument. Nothing here is decorative.',
           'What looks like restraint is actually accuracy, held long enough to become a shape.'] },
  { id: 'iching', label: 'I Ching', tab: 'I Ching', sum: 'Hexagram 62', glyph: 'hex',
    body: ['Small exceeding. The bird flies low, and the low flight is the correct one.',
           'Attend to what is near. The great crossing is not asked for today.'] },
  { id: 'genekeys', label: 'Gene Keys', tab: 'Gene Keys', sum: 'Sphere of Genius', glyph: 'sprout',
    body: ['Shadow moves through the compulsion to correct everything in reach.',
           'The gift is discernment: knowing which detail carries the structure and which is noise.',
           'At the siddhi it becomes impeccability, where precision stops being effort.'] },
  { id: 'humandesign', label: 'Human Design', tab: 'Human Design', sum: 'Channel of Discernment', glyph: 'diamond',
    body: ['A channel that reads pattern before it reads meaning.',
           'Its correctness depends entirely on waiting for the thing to finish arriving.'] },
  { id: 'body', label: 'Body', tab: 'Body', sum: 'Listening as Regulation', glyph: 'circle',
    body: ['Regulation here is not calm. It is the nervous system agreeing to receive detail without bracing.',
           'The breath lengthens once the scanning stops.'] },
  { id: 'relations', label: 'Relations', tab: 'Relations', sum: 'The Ecology of Truth', glyph: 'rings',
    body: ['Truth between people is ecological, not declarative. It needs conditions, not announcements.',
           'Precision offered without warmth reads as correction; the same precision offered warmly reads as care.'] },
];

export const CardReadingPreview: React.FC = () => {
  const { search } = useLocation();
  const q = new URLSearchParams(search).get('variant');
  const variant = q === 'mobile' || q === 'desktop' ? q : undefined;

  /* data-sec is load-bearing: the design's scroll engine keys the rail, the
     progress marker and jump-to-section off it. */
  const reading = (
    <>
      {LENSES.map((l) => (
        <section
          key={l.id}
          data-sec={l.id}
          style={{ padding: '56px 8% 64px', maxWidth: '760px', margin: '0 auto' }}
        >
          <p style={{ margin: '0 0 10px', fontFamily: "'Cinzel',serif", fontSize: '11px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#c6a667' }}>
            {l.label}
          </p>
          <h2 style={{ margin: '0 0 22px', fontFamily: "'Cormorant Garamond',serif", fontWeight: 500, fontSize: '34px', lineHeight: 1.2, color: '#f3ecde' }}>
            {l.sum}
          </h2>
          {l.body.map((p, i) => (
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
      src={ulCardImageUrl(62, 1080)}
      alt="Universal Language 62"
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );

  return <CardReading variant={variant} lenses={LENSES} reading={reading} artwork={artwork} />;
};

export default CardReadingPreview;
