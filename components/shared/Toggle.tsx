import React from 'react';
import { ATLAS_GOLD } from '../atlas/stageColors';

/**
 * Shared accessible switch, extracted from three hand-rolled copies:
 *
 *   - atlas/ConsentRings.tsx (the map-presence choice, both its 'panel' and
 *     'stage' seatings)
 *   - atlas/StewardClaim.tsx (the claim ceremony's map-presence restatement,
 *     dark stage only)
 *   - atlas/StewardEdit.tsx (the book's visibility toggle and its chart
 *     presence toggle, paper only)
 *
 * The three copies were not pixel-identical: StewardClaim used gap-3 and a
 * 15px label where the other two used gap-4 and the base (16px) size, and
 * StewardClaim's copy had no visible focus ring. This component matches
 * ConsentRings, the copy with a focus ring on both variants, and StewardClaim
 * and StewardEdit now render through it, so the small spacing difference and
 * the missing focus ring are folded into the one shared look.
 *
 * Two seatings, same as ConsentRings already drew them:
 *   - 'panel' (default): the paper form control, a bronze-filled track on a
 *     paper-colored one, a white thumb.
 *   - 'stage': seated on the Atlas dark stage, a gold-filled track on a warm
 *     translucent brown one, a thumb that swaps between ink and parchment so
 *     it stays legible in either state.
 */

export type ToggleVariant = 'panel' | 'stage';

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Text sitting beside the switch. Callers vary it with state themselves
      (e.g. "Show on the atlas" / "Keep this private"). */
  label: React.ReactNode;
  ariaLabel: string;
  variant?: ToggleVariant;
  disabled?: boolean;
  /** Extra classes on the outer button — layout only (e.g. `mx-auto`, `mt-7`).
      The switch's own look is fixed by `variant`. */
  className?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  ariaLabel,
  variant = 'panel',
  disabled = false,
  className = '',
}) => {
  const stage = variant === 'stage';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`flex items-center gap-4 min-h-[44px] font-reading text-base focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60 ${
        stage ? '' : 'text-wood-800'
      } ${className}`}
      style={stage ? { color: '#e7dcc7' } : undefined}
    >
      <span
        aria-hidden="true"
        className={`relative inline-block w-11 h-6 border transition-colors ${
          stage
            ? ''
            : checked
              ? 'bg-bronze-400 border-bronze-500'
              : 'bg-paper-100 border-wood-300'
        }`}
        style={
          stage
            ? checked
              ? { background: ATLAS_GOLD, borderColor: '#d4b88a' }
              : { background: 'rgba(60,50,38,0.6)', borderColor: 'rgba(196,170,124,0.35)' }
            : undefined
        }
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          } ${stage ? '' : 'bg-white'}`}
          style={stage ? { background: checked ? '#241e17' : '#e7dcc7' } : undefined}
        />
      </span>
      <span>{label}</span>
    </button>
  );
};

export default Toggle;
