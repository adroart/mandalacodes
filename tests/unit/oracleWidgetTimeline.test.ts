import { describe, expect, it } from 'vitest';
import { buildWidgetTimeline } from '../../scripts/build-oracle-widget';
import { todaysEnergy } from '../../lib/astrology/today';
import { bitsForCard } from '../../utils/ichingCasting';
import { ALL_CARDS } from '../../data/oracleData';

describe('bundled Oracle widget solar timeline', () => {
  const start = new Date('2026-10-21T00:00:00Z');
  const end = new Date('2027-11-01T00:00:00Z');
  const timeline = buildWidgetTimeline(start,end,start);
  it('uses all 64 canonical names, gifts and top-to-bottom hexagram lines', () => {
    expect(timeline.cards).toHaveLength(64);
    for(const card of ALL_CARDS) {
      const bundled=timeline.cards.find(item=>item.number===card.number)!;
      expect(bundled.name).toBe(card.card_name);
      expect(bundled.gift).toBe(card.gene_keys.gift);
      expect(bundled.lines).toEqual(bitsForCard(card.number)!.slice().reverse());
    }
  });
  it('agrees with the app on both sides of every transit to millisecond resolution', () => {
    expect(timeline.transitions.length).toBeGreaterThan(64);
    expect(timeline.transitions[0].at).toBe(start.getTime()/1000);
    for(let i=1;i<timeline.transitions.length;i++) {
      const transition=timeline.transitions[i];
      const time=Math.round(transition.at*1000);
      expect(todaysEnergy(new Date(time-1)).gate).toBe(timeline.transitions[i-1].gate);
      expect(todaysEnergy(new Date(time)).gate).toBe(transition.gate);
      expect(transition.at).toBeLessThan(timeline.validUntil);
    }
  });
  it('matches daily app values throughout the coverage period including new year', () => {
    for(let time=start.getTime();time<end.getTime();time+=86400000) {
      const current=timeline.transitions.filter(change=>change.at<=time/1000).at(-1)!;
      expect(current.gate).toBe(todaysEnergy(new Date(time)).gate);
    }
  });
  it('rejects a missing or reversed validity interval', () => {
    expect(()=>buildWidgetTimeline(end,start)).toThrow();
    expect(()=>buildWidgetTimeline(new Date(NaN),end)).toThrow();
  });
});
