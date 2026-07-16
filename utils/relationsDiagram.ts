const ROMAN_VALUES: ReadonlyArray<readonly [number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

const HEBREW_LETTERS: Readonly<Record<string, string>> = {
  aleph: 'א',
  alif: 'א',
  beth: 'ב',
  bet: 'ב',
  gimel: 'ג',
  ghimel: 'ג',
  daleth: 'ד',
  dalet: 'ד',
  he: 'ה',
  heh: 'ה',
  vav: 'ו',
  vau: 'ו',
  waw: 'ו',
  zayin: 'ז',
  zain: 'ז',
  cheth: 'ח',
  chet: 'ח',
  het: 'ח',
  teth: 'ט',
  tet: 'ט',
  yod: 'י',
  yud: 'י',
  kaph: 'כ',
  kaf: 'כ',
  lamed: 'ל',
  mem: 'מ',
  nun: 'נ',
  samekh: 'ס',
  samech: 'ס',
  ayin: 'ע',
  ain: 'ע',
  pe: 'פ',
  peh: 'פ',
  tsadi: 'צ',
  tzadi: 'צ',
  qoph: 'ק',
  qof: 'ק',
  resh: 'ר',
  shin: 'ש',
  tav: 'ת',
  tau: 'ת',
};

const ASTROLOGY_GLYPHS: Readonly<Record<string, string>> = {
  aries: '♈',
  taurus: '♉',
  gemini: '♊',
  cancer: '♋',
  leo: '♌',
  virgo: '♍',
  libra: '♎',
  scorpio: '♏',
  sagittarius: '♐',
  capricorn: '♑',
  aquarius: '♒',
  pisces: '♓',
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
};

function toRoman(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 21) return '';
  if (value === 0) return '0';

  let remainder = value;
  let result = '';
  for (const [amount, numeral] of ROMAN_VALUES) {
    while (remainder >= amount) {
      result += numeral;
      remainder -= amount;
    }
  }
  return result;
}

/** Extract the Major Arcana number from the authored relation label. */
export function tarotNumeral(value?: string): string {
  const authored = (value ?? '').trim();
  const roman = authored.match(/^([IVXLCDM]+|0)\b/i)?.[1];
  if (roman) return roman.toUpperCase();

  const arabic = authored.match(/^(\d{1,2})\b/)?.[1];
  return arabic ? toRoman(Number(arabic)) : '';
}

/** Normalize common transliterations so the diagram always shows the letter. */
export function hebrewLetterGlyph(value?: string): string {
  const authored = (value ?? '').trim();
  if (!authored) return '';
  if (Object.values(HEBREW_LETTERS).includes(authored)) return authored;
  return HEBREW_LETTERS[authored.toLowerCase()] ?? authored;
}

/** Return the monochrome Unicode glyph for an authored sign or planet. */
export function astrologyGlyph(value?: string): string {
  const authored = (value ?? '').trim().toLowerCase();
  return ASTROLOGY_GLYPHS[authored] ?? '';
}
