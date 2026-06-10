import { eclipticLongitudes } from './ephemeris';
import { findDesignTime, longitudeToGateLine } from './gates';
import type { GateLine, HologeneticProfile } from './types';

export interface ProfileInputs {
  /** UTC birth moment derived from local birth date + time + IANA tz id. */
  utcBirth: Date;
}

/**
 * Build the 11-position Hologenetic Profile for a given UTC birth moment.
 *
 * Positions follow the Gene Keys synthesis (Richard Rudd) of Activation,
 * Venus and Pearl Sequences over the Human Design wheel:
 *
 *   Activation
 *     - Life's Work   (Persona Sun)
 *     - Evolution     (Persona Earth = Sun + 180)
 *     - Radiance      (Design Sun, ~88 degrees back along the ecliptic)
 *     - Purpose       (Design Earth)
 *
 *   Venus
 *     - Attraction    (Design Moon)
 *     - IQ            (Persona Venus)
 *     - EQ            (Persona Mars)
 *     - SQ            (Design Venus)
 *
 *   Pearl
 *     - Vocation      (Design Mars)
 *     - Culture       (Design Jupiter)
 *     - Pearl         (Persona Jupiter, the synthesis)
 *
 * Planet-to-position mapping verified against an official Gene Keys
 * Publishing chart (see scripts/verify-chart for the fixture).
 */
export function buildHologeneticProfile({ utcBirth }: ProfileInputs): HologeneticProfile {
  const natal = eclipticLongitudes(utcBirth);
  const designSunTarget = (((natal.sun - 88) % 360) + 360) % 360;
  const utcDesign = findDesignTime(utcBirth, designSunTarget);
  const design = eclipticLongitudes(utcDesign);

  const toGL = (lon: number): GateLine => longitudeToGateLine(lon);

  return {
    lifesWork:  toGL(natal.sun),
    evolution:  toGL(natal.earth),
    radiance:   toGL(design.sun),
    purpose:    toGL(design.earth),

    attraction: toGL(design.moon),
    iq:         toGL(natal.venus),
    eq:         toGL(natal.mars),
    sq:         toGL(design.venus),
    // Venus Core (6th Venus sphere). Re-read of the same gate as the Pearl's
    // Vocation (`core`), per the Golden Path (wound -> gift).
    venusCore:  toGL(design.mars),

    core:       toGL(design.mars),   // Pearl "Vocation"
    culture:    toGL(design.jupiter),
    // Brand re-reads the Personality Sun gate — the same Gene Key as Life's Work.
    brand:      toGL(natal.sun),
    pearl:      toGL(natal.jupiter),
  };
}
