import { FULL_ARCHIVE } from '../../data/mockData';

export const ART_ORIGIN = 'https://adrianrasmussen.com';

/** Catalogue identity is explicit. A card number is never a catalogue suffix. */
export function artDesignHref(pieceId: string, cardNumber?: number | null): string {
  const art = FULL_ARCHIVE.find(item => item.id === pieceId);
  const url = new URL(`/creations/${encodeURIComponent(pieceId)}`, ART_ORIGIN);
  if (art && Number.isInteger(cardNumber) && cardNumber! >= 1 && cardNumber! <= 64 && art.cardNumber === cardNumber) {
    url.searchParams.set('from', 'mandalacodes');
    url.searchParams.set('card', String(cardNumber));
  }
  return url.href;
}

/** Only public identity provided by the canonical projection may name an instance. */
export function artInstanceHref(pieceId: string, publicCode?: string): string | null {
  if (!publicCode || !/^AR-[A-Z0-9-]+$/.test(publicCode)) return null;
  return `${ART_ORIGIN}/works/${encodeURIComponent(pieceId)}?instance=${encodeURIComponent(publicCode)}`;
}
