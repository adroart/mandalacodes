import { describe, it, expect } from 'vitest';
import {
  buildShareCardElement,
  ordinal,
  type CardNode,
} from '../../utils/atlas/shareCard';

/** Walk the satori element tree and collect every rendered string, so tests
 *  can assert what text does (and does NOT) appear on the card. */
function collectText(node: CardNode | string | undefined): string[] {
  if (node === undefined) return [];
  if (typeof node === 'string') return [node];
  const children = (node.props as { children?: unknown }).children;
  if (children === undefined) return [];
  const arr = Array.isArray(children) ? children : [children];
  return arr.flatMap((c) => collectText(c as CardNode | string));
}

const BASE = {
  title: "Earth's Breath",
  sigil: 'UL № 1',
  series: 'Universal Language',
  cityLabel: 'Denpasar, Indonesia',
  artworkDataUri: null,
};

describe('share card composition', () => {
  it('renders the title and sigil', () => {
    const text = collectText(buildShareCardElement({ ...BASE, dream: null, claimOrdinal: 1 }));
    expect(text.join(' ')).toContain("Earth's Breath");
    expect(text.join(' ')).toContain('UL № 1');
  });

  it('NEVER puts a private (unshared) dream on the card', () => {
    // A private dream is modelled by the caller passing dream: null (the
    // public projection carries no intention for an unshared piece). The card
    // must contain no dream text at all.
    const secret = 'a dream the steward kept private and never shared on the map';
    const text = collectText(
      buildShareCardElement({ ...BASE, dream: null, claimOrdinal: 1 }),
    ).join('\n');
    expect(text).not.toContain(secret);
    // And nothing dream-shaped leaks: only the known certificate strings appear.
    expect(text).toContain("Earth's Breath");
  });

  it('an empty-string dream is treated as no dream', () => {
    const text = collectText(
      buildShareCardElement({ ...BASE, dream: '   ', claimOrdinal: 1 }),
    ).join('\n');
    // The founding-light line is still there, but no dream block.
    expect(text).toContain('the 1st light');
  });

  it('shows a PUBLIC dream when one is provided', () => {
    const dream = 'That my daughters grow up certain their wildness is welcome.';
    const text = collectText(
      buildShareCardElement({ ...BASE, dream, claimOrdinal: 1 }),
    ).join('\n');
    expect(text).toContain(dream);
  });

  it('shows the founding-light line with city only when claimed', () => {
    const claimed = collectText(
      buildShareCardElement({ ...BASE, dream: null, claimOrdinal: 3 }),
    ).join('\n');
    expect(claimed).toContain('the 3rd light · anchored in Denpasar, Indonesia');

    const seeking = collectText(
      buildShareCardElement({ ...BASE, dream: null, claimOrdinal: null }),
    ).join('\n');
    expect(seeking).not.toMatch(/light · anchored/);
    // The seeking card still names the work and carries the seal placeholder.
    expect(seeking).toContain("Earth's Breath");
    expect(seeking).toContain('·');
  });

  it('carries no call to action or marketing furniture', () => {
    const text = collectText(
      buildShareCardElement({ ...BASE, dream: 'a shared dream', claimOrdinal: 1 }),
    )
      .join(' ')
      .toLowerCase();
    for (const banned of ['claim', 'buy', 'shop', 'begin →', 'mandalacodes', 'sign in', 'visit']) {
      expect(text).not.toContain(banned);
    }
  });

  it('ordinal() words match the certificate', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(100)).toBe('100th');
  });
});
