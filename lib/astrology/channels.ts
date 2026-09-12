import type { GateLine, HologeneticProfile, ProfileKey } from './types';

/**
 * The 36 Human Design channels: two gates that, activated together in one
 * chart, define a channel. Names follow the card manuscripts
 * (oracle/cards/NN.md, `human_design.channel`); the four Integration gates
 * (10, 20, 34, 57) name a cluster there rather than a pair, so their six
 * channels carry the standard Human Design names instead. The canonical pair
 * list is the vault's 36 channel articles
 * (Mandala Codes/oracle/human-design/channels/channel-A-B.md).
 */
export interface Channel {
  /** The two gates, lower number first. */
  gates: readonly [number, number];
  name: string;
}

export const CHANNELS: readonly Channel[] = [
  { gates: [1, 8], name: 'Channel of Inspiration' },
  { gates: [2, 14], name: 'Channel of the Beat' },
  { gates: [3, 60], name: 'Channel of Mutation' },
  { gates: [4, 63], name: 'Channel of Logic' },
  { gates: [5, 15], name: 'Channel of Rhythm' },
  { gates: [6, 59], name: 'Channel of Mating' },
  { gates: [7, 31], name: 'Channel of the Alpha' },
  { gates: [9, 52], name: 'Channel of Concentration' },
  { gates: [10, 20], name: 'Channel of Awakening' },
  { gates: [10, 34], name: 'Channel of Exploration' },
  { gates: [10, 57], name: 'Channel of Perfected Form' },
  { gates: [11, 56], name: 'Channel of Curiosity' },
  { gates: [12, 22], name: 'Channel of Openness' },
  { gates: [13, 33], name: 'Channel of the Prodigal' },
  { gates: [16, 48], name: 'Channel of the Wavelength' },
  { gates: [17, 62], name: 'Channel of Acceptance' },
  { gates: [18, 58], name: 'Channel of Judgment' },
  { gates: [19, 49], name: 'Channel of Synthesis' },
  { gates: [20, 34], name: 'Channel of Charisma' },
  { gates: [20, 57], name: 'Channel of the Brainwave' },
  { gates: [21, 45], name: 'Channel of Money' },
  { gates: [23, 43], name: 'Channel of Structuring' },
  { gates: [24, 61], name: 'Channel of Awareness' },
  { gates: [25, 51], name: 'Channel of Initiation' },
  { gates: [26, 44], name: 'Channel of Surrender' },
  { gates: [27, 50], name: 'Channel of Preservation' },
  { gates: [28, 38], name: 'Channel of Struggle' },
  { gates: [29, 46], name: 'Channel of Discovery' },
  { gates: [30, 41], name: 'Channel of Recognition' },
  { gates: [32, 54], name: 'Channel of Transformation' },
  { gates: [34, 57], name: 'Channel of Power' },
  { gates: [35, 36], name: 'Channel of Transitoriness' },
  { gates: [37, 40], name: 'Channel of Community' },
  { gates: [39, 55], name: 'Channel of Emoting' },
  { gates: [42, 53], name: 'Channel of Maturation' },
  { gates: [47, 64], name: 'Channel of Abstraction' },
];

/**
 * The eleven profile positions in the order the chart lists them
 * (Activation, Venus, Pearl). Kept here rather than imported from
 * data/profilePositions so this module stays a pure function of the profile.
 */
export const PROFILE_POSITION_ORDER: readonly ProfileKey[] = [
  'lifesWork', 'evolution', 'radiance', 'purpose',
  'attraction', 'iq', 'eq', 'sq',
  'core', 'culture', 'pearl',
];

/** One profile position that lands on a gate. */
export interface GateActivation extends GateLine {
  key: ProfileKey;
}

export type ChannelStatusKind = 'defined' | 'gate-only' | 'partner-only' | 'neither';

export interface ChannelStatus {
  channel: Channel;
  /** The gate the question was asked about. */
  gate: number;
  /** The other gate of the channel. */
  partner: number;
  status: ChannelStatusKind;
  /** Positions in the profile that activate `gate`. Empty when none do. */
  gateActivations: GateActivation[];
  /** Positions in the profile that activate `partner`. Empty when none do. */
  partnerActivations: GateActivation[];
}

/** Every channel a gate belongs to: one for most gates, three for 10, 20, 34 and 57. */
export function channelsForGate(gate: number): Channel[] {
  return CHANNELS.filter(c => c.gates[0] === gate || c.gates[1] === gate);
}

/** Every position in the profile that sits on `gate`, in chart order. */
export function activationsForGate(profile: HologeneticProfile, gate: number): GateActivation[] {
  const out: GateActivation[] = [];
  for (const key of PROFILE_POSITION_ORDER) {
    const gl = profile[key];
    if (gl && gl.gate === gate) out.push({ key, gate: gl.gate, line: gl.line });
  }
  return out;
}

function statusOf(profile: HologeneticProfile, channel: Channel, gate: number): ChannelStatus {
  const partner = channel.gates[0] === gate ? channel.gates[1] : channel.gates[0];
  const gateActivations = activationsForGate(profile, gate);
  const partnerActivations = activationsForGate(profile, partner);
  const hasGate = gateActivations.length > 0;
  const hasPartner = partnerActivations.length > 0;
  const status: ChannelStatusKind =
    hasGate && hasPartner ? 'defined'
      : hasGate ? 'gate-only'
        : hasPartner ? 'partner-only'
          : 'neither';
  return { channel, gate, partner, status, gateActivations, partnerActivations };
}

/**
 * Whether the reader's chart activates this gate, its channel partner, both
 * (the channel is defined) or neither, and which positions do the activating.
 *
 * Returns one entry per channel the gate belongs to, so callers can render a
 * line per channel; an unknown gate returns an empty array. The chart here is
 * the eleven-position Hologenetic Profile the site computes, not a full
 * thirteen-planet Human Design bodygraph, so "defined" means defined within
 * those eleven positions.
 */
export function channelStatusFor(profile: HologeneticProfile, gate: number): ChannelStatus[] {
  return channelsForGate(gate).map(channel => statusOf(profile, channel, gate));
}

/**
 * Every channel the profile defines, each once, in channel-table order, with
 * `gate` set to the channel's lower-numbered gate.
 */
export function definedChannels(profile: HologeneticProfile): ChannelStatus[] {
  const out: ChannelStatus[] = [];
  for (const channel of CHANNELS) {
    const s = statusOf(profile, channel, channel.gates[0]);
    if (s.status === 'defined') out.push(s);
  }
  return out;
}
