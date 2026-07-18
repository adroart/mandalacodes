/**
 * The share card: the certificate that travels.
 *
 * A single, pure, isomorphic composition of the piece's certificate at
 * 1200x630 — the artifact a piece link unfurls into when it lands in a chat
 * or a story, and the image a steward downloads from their book. It echoes
 * `components/PiecePage.tsx`: warm paper ground, a hairline frame, the artwork
 * as the crown, the title in Cinzel, the sigil, the dream (Cormorant) when it
 * is PUBLIC, the founding-light line when claimed, and the double-ring seal.
 *
 * This module does no I/O and knows nothing of Cloudflare, satori, or resvg.
 * It returns a satori-compatible element tree (the same `{ type, props }`
 * shape `React.createElement` produces), so both the edge renderer
 * (`functions/api/atlas/card/*` via workers-og) and the node verification
 * script (`scripts/render-share-card.ts` via satori) compose from one source.
 *
 * The one binding rule lives here and nowhere else: a dream is drawn ONLY
 * when `dream` is a non-empty string. The caller passes the piece's PUBLIC
 * intention or null; a private (unshared) dream never becomes a card, because
 * it never reaches this input in the first place, and even if it did the
 * composition would still only render what it is handed. No call to action,
 * no logo, no marketing furniture ever appears: the certificate, small.
 */

/** A satori element node — the `{ type, props }` shape satori consumes. */
export interface CardNode {
  type: string;
  // satori reads style, children, and element-specific attrs (src/width/height)
  props: Record<string, unknown>;
}

type Child = CardNode | string | null | undefined | false;

/** Hyperscript helper: build a satori node without needing React/JSX, so this
 *  stays importable from a plain Pages Function and a node script alike. */
function h(
  type: string,
  props: Record<string, unknown> | null,
  ...children: Child[]
): CardNode {
  const kids = children
    .flat()
    .filter((c): c is CardNode | string => c !== null && c !== undefined && c !== false);
  const childProp =
    kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids;
  return { type, props: { ...(props ?? {}), ...(childProp !== undefined ? { children: childProp } : {}) } };
}

/**
 * Certificate palette — the exact paper-surface token values from
 * `src/theme.css` (the light-theme values PiecePage holds via `dark-preserve`,
 * since the card is warm paper regardless of the viewer's theme).
 */
const C = {
  paper: '#f3efe7', // --color-paper-50, the certificate ground
  paperEdge: '#eae4d7', // --color-paper-100
  ink: '#272219', // --color-wood-900
  wood700: '#51493b',
  wood600: '#6b6253',
  wood500: '#8a8070',
  wood300: '#c6bca6', // hairline rules
  bronze500: '#a37b38', // --accent, the seal + eyebrow bronze
  bronze600: '#956e2a',
  bronzeBright: '#b0913c', // --color-bronze-400, the plate eyebrow
  plate: '#151311', // the dark mount the artwork sits on
  plateText: '#e0d8c6', // --color-paper-200, fallback plate title
} as const;

/** Ordinal word for the founding-light number: 1 -> "1st", 2 -> "2nd". Mirrors
 *  `ordinalLabel` in components/atlas/PieceSidePanel.tsx, kept local so this
 *  pure module pulls in no component code. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export interface ShareCardInput {
  /** Clean title, e.g. "Earth's Breath". */
  title: string;
  /** The piece sigil, e.g. "UL № 1". */
  sigil: string;
  /** Series line, e.g. "Universal Language". */
  series?: string | null;
  /** The PUBLIC dream, or null. NEVER pass a private/unshared dream here. */
  dream?: string | null;
  /** Founding-light ordinal when the piece is claimed, else null. */
  claimOrdinal?: number | null;
  /** "Denpasar, Indonesia" when placed in a known city, else null. */
  cityLabel?: string | null;
  /** A `data:` URI of the artwork (square), or null for the warm plate. */
  artworkDataUri?: string | null;
}

/** The longest dream we let ride the card. Shared dreams may run to 1200
 *  characters (utils/intentions.ts); the card carries the opening and the
 *  full text lives at the link, so this ceiling is a composition choice,
 *  not the data cap. */
const DREAM_MAX = 280;

function clampDream(dream: string): string {
  const trimmed = dream.trim();
  if (trimmed.length <= DREAM_MAX) return trimmed;
  const cut = trimmed.slice(0, DREAM_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 200 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Dream type sizes down as the dream gets longer, so short dreams read
 *  monumental and long ones still fit the plate. */
function dreamFontSize(len: number): number {
  if (len <= 90) return 40;
  if (len <= 160) return 33;
  if (len <= 220) return 28;
  return 24;
}

/**
 * Compose the certificate card as a satori element tree. Pure: the same input
 * always yields the same tree, and the dream is present in the tree if and
 * only if `dream` is a non-empty string.
 */
export function buildShareCardElement(input: ShareCardInput): CardNode {
  const { title, sigil, series, cityLabel, artworkDataUri } = input;
  const dream = input.dream && input.dream.trim() ? clampDream(input.dream) : null;
  const claimed = typeof input.claimOrdinal === 'number';

  // ── The artwork, the crown of the document (or the warm plate fallback) ──
  const plateInner = artworkDataUri
    ? h('img', {
        src: artworkDataUri,
        width: 356,
        height: 356,
        style: { width: '356px', height: '356px', objectFit: 'cover' },
      })
    : h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '356px',
            height: '356px',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontFamily: 'Karla',
              fontSize: '14px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: C.bronzeBright,
            },
          },
          'The plate',
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontFamily: 'Cormorant',
              fontSize: '24px',
              color: C.plateText,
              marginTop: '12px',
              textAlign: 'center',
              paddingLeft: '24px',
              paddingRight: '24px',
            },
          },
          title,
        ),
      );

  const plate = h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '470px',
        height: '100%',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: C.plate,
          padding: '18px',
          boxShadow: '0 2px 30px -8px rgba(0,0,0,0.55)',
        },
      },
      plateInner,
    ),
  );

  // ── The certificate text column ──
  const textChildren: Child[] = [];

  if (series) {
    textChildren.push(
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Karla',
            fontSize: '15px',
            letterSpacing: '3.5px',
            textTransform: 'uppercase',
            color: C.bronze600,
            marginBottom: '14px',
          },
        },
        series,
      ),
    );
  }

  textChildren.push(
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: 'Cinzel',
          fontSize: '54px',
          fontWeight: 600,
          lineHeight: 1.04,
          letterSpacing: '1px',
          color: C.ink,
        },
      },
      title,
    ),
  );

  textChildren.push(
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: 'Karla',
          fontSize: '16px',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          color: C.wood500,
          marginTop: '16px',
        },
      },
      sigil,
    ),
  );

  // Hairline rule, exactly as the certificate rules the dream.
  if (dream) {
    textChildren.push(
      h('div', {
        style: {
          display: 'flex',
          width: '90px',
          height: '1px',
          background: C.wood300,
          marginTop: '30px',
          marginBottom: '26px',
        },
      }),
    );
    textChildren.push(
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Cormorant',
            fontSize: `${dreamFontSize(dream.length)}px`,
            lineHeight: 1.3,
            color: C.ink,
          },
        },
        dream,
      ),
    );
  }

  // The founding-light line, only when claimed (the ordinal is the prize).
  if (claimed) {
    const line =
      `the ${ordinal(input.claimOrdinal as number)} light` +
      (cityLabel ? ` · anchored in ${cityLabel}` : '');
    textChildren.push(
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Cormorant',
            fontSize: '25px',
            color: C.wood600,
            marginTop: dream ? '26px' : '30px',
          },
        },
        line,
      ),
    );
  }

  const textColumn = h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        // Explicit width (1200 minus the 470 plate) so satori wraps the dream
        // within the column instead of letting a long line run off the card.
        width: '730px',
        height: '100%',
        paddingTop: '64px',
        paddingBottom: '64px',
        // Keeps every line clear of the bottom-right seal.
        paddingRight: '132px',
      },
    },
    ...textChildren,
  );

  // ── The double-ring seal, bottom-right, the recorded-in-the-ledger mark ──
  const seal = h(
    'div',
    {
      style: {
        display: 'flex',
        position: 'absolute',
        bottom: '52px',
        right: '54px',
        width: '76px',
        height: '76px',
        borderRadius: '76px',
        border: `1px solid ${C.bronze500}`,
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          position: 'absolute',
          top: '6px',
          left: '6px',
          right: '6px',
          bottom: '6px',
          borderRadius: '64px',
          border: `1px solid ${C.bronze500}`,
          opacity: 0.5,
        },
      },
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontFamily: 'Cinzel',
          fontSize: '26px',
          color: C.bronze600,
        },
      },
      claimed ? String(input.claimOrdinal) : '·',
    ),
  );

  // ── Root: warm paper, a hairline double frame, the two columns, the seal ──
  return h(
    'div',
    {
      style: {
        display: 'flex',
        position: 'relative',
        width: '1200px',
        height: '630px',
        background: C.paper,
      },
    },
    // Outer hairline frame.
    h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        top: '24px',
        left: '24px',
        right: '24px',
        bottom: '24px',
        border: `1px solid ${C.bronze500}`,
      },
    }),
    // Inner hairline frame — the fine-instrument double rule.
    h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        top: '31px',
        left: '31px',
        right: '31px',
        bottom: '31px',
        border: `1px solid ${C.wood300}`,
      },
    }),
    plate,
    textColumn,
    seal,
  );
}
