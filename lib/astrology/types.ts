export type PlanetKey =
  | 'sun'
  | 'earth'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter';

export interface GateLine {
  gate: number;        // 1..64
  line: number;        // 1..6
}

export type ProfileKey =
  | 'lifesWork'
  | 'evolution'
  | 'radiance'
  | 'purpose'
  | 'attraction'
  | 'iq'
  | 'eq'
  | 'sq'
  | 'venusCore'  // Venus Sequence 6th sphere (the Core / Core Wound)
  | 'core'       // Pearl 'Vocation' (legacy key name); re-read of venusCore's gate
  | 'culture'
  | 'brand'      // Pearl 3rd sphere; re-read of Life's Work's gate
  | 'pearl';

export type ProfileSequence = 'activation' | 'venus' | 'pearl';

export interface HologeneticProfile {
  lifesWork: GateLine;
  evolution: GateLine;
  radiance: GateLine;
  purpose: GateLine;
  attraction: GateLine;
  iq: GateLine;
  eq: GateLine;
  sq: GateLine;
  venusCore: GateLine;
  core: GateLine;
  culture: GateLine;
  brand: GateLine;
  pearl: GateLine;
}

export interface DailyEnergy {
  gate: number;
  line: number;
  computedAt: string;  // ISO 8601 UTC
}
