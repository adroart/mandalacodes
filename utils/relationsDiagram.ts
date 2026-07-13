const ROMAN_VALUES: ReadonlyArray<readonly [number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

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
  if (/^va[uv]$/i.test(authored)) return 'ו';
  return authored;
}
