import records from './lightCodes.json';

export type LightCodeCategory = 'frequency-foundation' | 'embodied-vibration' | 'resonant-formations';
export interface LightCode {
  number: number;
  category: LightCodeCategory;
}

export const categoryLabels: Record<LightCodeCategory, string> = {
  'frequency-foundation': 'Frequency Foundation',
  'embodied-vibration': 'Embodied Vibration',
  'resonant-formations': 'Resonant Formations',
};

/** Number and category only. The archived prose is deliberately absent. */
export const lightCodes = records as LightCode[];
export const lightCodeByNumber = (value: string) => {
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  return lightCodes[Number(value) - 1]?.number === Number(value) ? lightCodes[Number(value) - 1] : undefined;
};
export const lightCodeImagePath = (number: number) => `/images/light-codes/lightcodes-${String(number).padStart(2, '0')}.png`;
export const lightCodeTitle = (number: number) => `Light Code ${number}`;
