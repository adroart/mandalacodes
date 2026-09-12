import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CHANNELS,
  activationsForGate,
  channelStatusFor,
  channelsForGate,
  definedChannels,
} from '../../lib/astrology/channels';
import type { HologeneticProfile } from '../../lib/astrology/types';

/** A profile where every position sits on gate 64, then the given overrides. */
function profileWith(overrides: Partial<HologeneticProfile>): HologeneticProfile {
  const blank = { gate: 64, line: 1 };
  return {
    lifesWork: blank, evolution: blank, radiance: blank, purpose: blank,
    attraction: blank, iq: blank, eq: blank, sq: blank,
    core: blank, culture: blank, pearl: blank,
    ...overrides,
  };
}

/* Fixture charts. Gate 64 is the filler, so any test asking about gate 64
 * or 47 (its partner) must use `emptyOf` instead. */
const mutationDefined = profileWith({
  lifesWork: { gate: 3, line: 2 },     // Sun on gate 3
  attraction: { gate: 60, line: 5 },   // design Moon on gate 60
  pearl: { gate: 3, line: 6 },         // Jupiter also on gate 3
});
const gateThreeOnly = profileWith({ evolution: { gate: 3, line: 4 } });
const gateSixtyOnly = profileWith({ sq: { gate: 60, line: 1 } });
const neitherOfThem = profileWith({ iq: { gate: 1, line: 3 } });

describe('channelStatusFor', () => {
  it('reports a defined channel with the positions on each gate', () => {
    const [s] = channelStatusFor(mutationDefined, 3);
    expect(s.status).toBe('defined');
    expect(s.channel.name).toBe('Channel of Mutation');
    expect(s.partner).toBe(60);
    expect(s.gateActivations.map(a => a.key)).toEqual(['lifesWork', 'pearl']);
    expect(s.gateActivations.map(a => a.line)).toEqual([2, 6]);
    expect(s.partnerActivations).toEqual([{ key: 'attraction', gate: 60, line: 5 }]);
  });

  it('reads the same channel from the partner side', () => {
    const [s] = channelStatusFor(mutationDefined, 60);
    expect(s.status).toBe('defined');
    expect(s.gate).toBe(60);
    expect(s.partner).toBe(3);
    expect(s.gateActivations.map(a => a.key)).toEqual(['attraction']);
    expect(s.partnerActivations.map(a => a.key)).toEqual(['lifesWork', 'pearl']);
  });

  it('reports gate-only when only the asked gate is in the chart', () => {
    const [s] = channelStatusFor(gateThreeOnly, 3);
    expect(s.status).toBe('gate-only');
    expect(s.gateActivations.map(a => a.key)).toEqual(['evolution']);
    expect(s.partnerActivations).toEqual([]);
  });

  it('reports partner-only when only the other gate is in the chart', () => {
    const [s] = channelStatusFor(gateSixtyOnly, 3);
    expect(s.status).toBe('partner-only');
    expect(s.gateActivations).toEqual([]);
    expect(s.partnerActivations.map(a => a.key)).toEqual(['sq']);
  });

  it('reports neither when the chart holds neither gate', () => {
    const [s] = channelStatusFor(neitherOfThem, 3);
    expect(s.status).toBe('neither');
    expect(s.gateActivations).toEqual([]);
    expect(s.partnerActivations).toEqual([]);
  });

  it('returns one entry per channel for the Integration gates', () => {
    const chart = profileWith({
      lifesWork: { gate: 20, line: 1 },
      eq: { gate: 57, line: 3 },
    });
    const statuses = channelStatusFor(chart, 20);
    expect(statuses.map(s => [s.partner, s.status])).toEqual([
      [10, 'gate-only'],
      [34, 'gate-only'],
      [57, 'defined'],
    ]);
    expect(channelsForGate(10)).toHaveLength(3);
    expect(channelsForGate(34)).toHaveLength(3);
    expect(channelsForGate(57)).toHaveLength(3);
  });

  it('returns nothing for a gate outside 1..64', () => {
    expect(channelStatusFor(mutationDefined, 0)).toEqual([]);
    expect(channelStatusFor(mutationDefined, 65)).toEqual([]);
  });
});

describe('activationsForGate', () => {
  it('lists positions in chart order', () => {
    const chart = profileWith({
      pearl: { gate: 8, line: 1 },
      radiance: { gate: 8, line: 2 },
      attraction: { gate: 8, line: 3 },
    });
    expect(activationsForGate(chart, 8).map(a => a.key)).toEqual(['radiance', 'attraction', 'pearl']);
  });
});

describe('definedChannels', () => {
  it('lists each defined channel once, lower gate first', () => {
    const chart = profileWith({
      lifesWork: { gate: 8, line: 1 },
      evolution: { gate: 1, line: 1 },
      radiance: { gate: 60, line: 1 },
      purpose: { gate: 3, line: 1 },
      sq: { gate: 60, line: 4 },
    });
    const defined = definedChannels(chart);
    expect(defined.map(s => s.channel.gates)).toEqual([[1, 8], [3, 60]]);
    expect(defined.map(s => s.gate)).toEqual([1, 3]);
  });

  it('is empty when no pair is complete', () => {
    expect(definedChannels(gateThreeOnly)).toEqual([]);
  });
});

describe('the channel table', () => {
  it('holds 36 channels, every gate in at least one, no duplicate pairs', () => {
    expect(CHANNELS).toHaveLength(36);
    const seen = new Set<string>();
    for (const c of CHANNELS) {
      expect(c.gates[0]).toBeLessThan(c.gates[1]);
      seen.add(c.gates.join('-'));
    }
    expect(seen.size).toBe(36);
    for (let gate = 1; gate <= 64; gate += 1) {
      expect(channelsForGate(gate).length, `gate ${gate}`).toBeGreaterThan(0);
    }
  });

  it('matches the pair each card manuscript names under "What completes it"', () => {
    const dir = resolve('oracle/cards');
    const files = readdirSync(dir).filter(f => /^\d\d\.md$/.test(f));
    expect(files).toHaveLength(64);
    for (const file of files) {
      const raw = readFileSync(resolve(dir, file), 'utf8');
      const number = Number(raw.match(/^number:\s*(\d+)/m)?.[1]);
      const heading = raw.match(/^### What completes it[^\n]*/m)?.[0] ?? '';
      const pair = heading.match(/\((\d+)\s*[–—-]\s*(\d+)\)/);
      // The Integration cards (20, 34, 57) name a cluster, not one pair.
      if (!pair) {
        expect([20, 34, 57], `${file}: ${heading}`).toContain(number);
        continue;
      }
      const a = Number(pair[1]);
      const b = Number(pair[2]);
      const partner = a === number ? b : a;
      expect(channelsForGate(number).map(c => c.gates[0] === number ? c.gates[1] : c.gates[0]), file)
        .toContain(partner);
    }
  });
});
