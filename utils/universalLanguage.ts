import { Artwork } from '../types';
import { CARD_BY_NUMBER } from '../data/oracleData';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from './cloudinary';

/**
 * Parse the card number from a Universal Language coverImage public ID.
 * Images are named like "32_x9qxas" or "adrian-website/creations/universal-language/art-of-living-32".
 * Returns null if the number cannot be determined.
 */
export function ulCardNumber(coverImage: string): number | null {
  // Pattern 1: "32_x9qxas" - number is before the first underscore
  const shortMatch = coverImage.match(/^(\d+)_/);
  if (shortMatch) return parseInt(shortMatch[1], 10);

  // Pattern 2: ends with "-32" - number is after the last hyphen
  const longMatch = coverImage.match(/-(\d+)$/);
  if (longMatch) return parseInt(longMatch[1], 10);

  return null;
}

/**
 * SEO-optimised alt text for a Universal Language artwork.
 * Pattern: "[Piece Name], Universal Language [Number]. Handmade multi-dimensional wooden sculpture by Adrian Rasmussen."
 * ("Handmade", never "original" or "one of one": pieces are made to order
 * and a design can exist in numbered editions.)
 */
export function ulAltText(art: Artwork, number?: number | null): string {
  const num = number ?? ulCardNumber(art.coverImage);
  const numberPart = num != null ? ` ${num}` : '';
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');
  return `${cleanTitle}, Universal Language${numberPart}. Handmade multi-dimensional wooden sculpture by Adrian Rasmussen.`;
}

/**
 * SEO-optimised meta description for a Universal Language piece page.
 * Pulls hexagram and Gene Key data from oracleData when available.
 */
export function ulMetaDescription(art: Artwork): string {
  const num = ulCardNumber(art.coverImage);
  if (num != null) {
    const card = CARD_BY_NUMBER.get(num);
    if (card) {
      return `Handmade multi-dimensional wooden sculpture, connected to ${card.iching.hexagram_name} (Hexagram ${num}) of the I Ching and Gene Key ${num}: ${card.gene_keys.gift}. One of 64 designs by Adrian Rasmussen.`;
    }
  }
  return `Handmade multi-dimensional wooden sculpture. One of 64 designs in the Universal Language series by Adrian Rasmussen, each connected to a hexagram of the I Ching and a corresponding Gene Key.`;
}

/**
 * SEO-optimised page title for a Universal Language piece.
 * The useMetaTags hook appends "| Adrian Rasmussen" automatically.
 */
export function ulMetaTitle(art: Artwork): string {
  return `${art.title} · Universal Language · Mandala Art`;
}

/** Universal Language card number → archive piece. One physical sculpture per code. */
const UL_PIECE_BY_NUMBER = new Map<number, Artwork>(
  FULL_ARCHIVE
    .filter(a => a.series === 'Universal Language')
    .map(a => [ulCardNumber(a.coverImage), a] as const)
    .filter((pair): pair is readonly [number, Artwork] => pair[0] != null)
);

/** The physical Universal Language piece for a card number, when one exists. */
export function ulPieceForCard(number: number): Artwork | undefined {
  return UL_PIECE_BY_NUMBER.get(number);
}

/** Cloudinary public ID for a card's artwork, when one exists. */
export function ulCardPublicId(number: number): string | undefined {
  return UL_PIECE_BY_NUMBER.get(number)?.coverImage;
}

/** Universal Language card number → Cloudinary public ID. */
const UL_IMAGE_BY_NUMBER = new Map<number, string>(
  Array.from(UL_PIECE_BY_NUMBER, ([num, a]) => [num, a.coverImage] as const)
);

/* These are the source plates where the white capture/background needs to be
 * made transparent. Cloudinary's background-removal delivery transform keeps
 * the complete square canvas; it does not trim or crop the artwork. Add future
 * plates here as they are identified. */
const UL_CARDS_WITH_TRANSPARENT_BACKGROUND = new Set<number>([22]);

/* The plates that arrive with genuinely transparent corners, so the mandala
 * reads as a shape floating on whatever is behind it rather than as a picture
 * on a rectangle. Everything else is an opaque square with its own captured
 * ground baked in, dark on some plates and near-white on others.
 *
 * That difference decides whether a frame is decoration or structure. Around a
 * floating mandala a border boxes in four empty corners, which is exactly what
 * it looks like. Around an opaque plate it is the only thing separating a dark
 * capture ground from the dark page behind it, so it stays.
 *
 * Measured from the delivered images, not from the source files: each plate was
 * fetched through the same transform the app uses and its four corners sampled
 * for alpha. Re-measure if the plates are ever recaptured or re-uploaded. */
const UL_CARDS_THAT_FLOAT = new Set<number>([6, 9, 19, 32, 35, 39, 47, 51]);

/**
 * Whether a card's artwork sits on the page with no ground of its own, and so
 * wants no frame around it. See UL_CARDS_THAT_FLOAT.
 */
export function ulCardArtFloatsFree(number: number): boolean {
  return UL_CARDS_THAT_FLOAT.has(number);
}

/**
 * Square Cloudinary URL for a Universal Language card's artwork.
 * Falls back to the oracle-card placeholder if the number is unknown.
 * Shared by the card page, the deck index, and the cast preview modal.
 */
export function ulCardImageUrl(number: number, size: number): string {
  const publicId = UL_IMAGE_BY_NUMBER.get(number);
  if (!publicId) return img('adrian-website/placeholders/oracle-card-3', { w: size, h: size });
  const backgroundRemoval = UL_CARDS_WITH_TRANSPARENT_BACKGROUND.has(number);
  return img(publicId, {
    w: size,
    h: size,
    crop: 'fill',
    gravity: 'center',
    format: backgroundRemoval ? 'png' : 'webp',
    backgroundRemoval,
  });
}
