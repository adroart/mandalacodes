import { describe, expect, it } from 'vitest';
import { astrologyGlyph, hebrewLetterGlyph, tarotNumeral } from '../../utils/relationsDiagram';

describe('tarotNumeral', () => {
  it('reads the authored numeral from comma-separated tarot data', () => {
    expect(tarotNumeral('V, The Hierophant')).toBe('V');
  });

  it('reads the authored numeral from dot-separated tarot data', () => {
    expect(tarotNumeral('XIV · Temperance')).toBe('XIV');
  });

  it('converts an authored Arabic tarot number to Roman numerals', () => {
    expect(tarotNumeral('5 - The Hierophant')).toBe('V');
  });
});

describe('hebrewLetterGlyph', () => {
  it('resolves authored Hebrew letter names to their actual glyphs', () => {
    expect(hebrewLetterGlyph('Cheth')).toBe('ח');
    expect(hebrewLetterGlyph('Beth')).toBe('ב');
  });

  it('normalizes both English spellings of Vav to the Hebrew letter', () => {
    expect(hebrewLetterGlyph('Vav')).toBe('ו');
    expect(hebrewLetterGlyph('Vau')).toBe('ו');
  });

  it('leaves an authored Hebrew glyph unchanged', () => {
    expect(hebrewLetterGlyph('ס')).toBe('ס');
  });
});

describe('astrologyGlyph', () => {
  it('returns the actual zodiac glyph for a named sign', () => {
    expect(astrologyGlyph('Cancer')).toBe('♋');
  });

  it('returns the actual planetary glyph for a named planet', () => {
    expect(astrologyGlyph('Mercury')).toBe('☿');
  });
});
