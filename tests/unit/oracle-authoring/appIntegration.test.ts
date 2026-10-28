import { expect, it } from 'vitest';
import { visibleAuthoringSection } from '../../../src/mobile/authoring/readerContext';
it('maps reader lenses to manuscript sections and uses the visible section', () => {
  expect(visibleAuthoringSection([{ id: 'ul', top: -300, bottom: 20 }, { id: 'genekeys', top: 20, bottom: 500 }], 60)).toBe('KEYS');
  expect(visibleAuthoringSection([{ id: 'humandesign', top: 0, bottom: 500 }], 60)).toBe('DESIGN');
  expect(visibleAuthoringSection([], 60)).toBe('CODE');
});
