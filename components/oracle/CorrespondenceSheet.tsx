import React, { useEffect } from 'react';

export interface CorrespondenceChainStep {
  /** Short label for the step in the chain (e.g. "Codon Ring of Fire"). */
  label: string;
  /** Optional source/system note (e.g. "Gene Keys"). */
  source?: string;
}

export interface Correspondence {
  /** What kind of correspondence this is — affects framing copy. */
  kind: 'tarot' | 'zodiac' | 'immortal' | 'hebrew';
  /** The headline of the sheet, e.g. "XIV · The Art" or "Sagittarius". */
  name: string;
  /** A single sentence on what this correspondence means for the card. */
  meaning: string;
  /** The trace chain from the code back to this correspondence, in order. */
  chain: CorrespondenceChainStep[];
  /** Optional deeper-reference link slug (e.g. "tarot-xuan-system"). */
  referenceSlug?: string;
}

/**
 * CorrespondenceSheet — the generic tap-to-trace bottom sheet.
 *
 * One sheet, four kinds (tarot, zodiac, immortal, hebrew). The reader
 * taps a correspondence in the hero (or anywhere else the pattern
 * appears) and a panel slides up from the bottom showing:
 *
 *   1. The chain from the code back to this correspondence.
 *   2. One sentence of meaning.
 *   3. A link to the master lineage page for the deeper read.
 *
 * Mobile-first: full-bleed on small screens, max-width on larger. Tap
 * outside or hit the close button to dismiss. No hover anywhere — the
 * deck's global interaction rule.
 */
const CorrespondenceSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  data: Correspondence | null;
}> = ({ open, onClose, data }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !data) return null;

  const KIND_LABEL: Record<Correspondence['kind'], string> = {
    tarot:    'Tarot Arcana',
    zodiac:   'Zodiac',
    immortal: 'Eight Immortals',
    hebrew:   'Hebrew Letter',
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correspondence-sheet-name"
    >
      {/* Scrim — tap to dismiss. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-wood-900/45 motion-safe:animate-[fadeIn_180ms_ease-out]"
      />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md sm:mx-4 bg-paper-50 rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(60,44,22,0.18)] sm:shadow-[0_8px_40px_rgba(60,44,22,0.18)] border-t sm:border border-wood-200/70 motion-safe:animate-[slideUp_220ms_cubic-bezier(0.22,1,0.36,1)]">
        {/* Drag-handle hint — purely visual. */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <span className="block h-1 w-10 rounded-full bg-wood-300/70" aria-hidden="true" />
        </div>

        <div className="px-6 pt-3 pb-7">
          <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500 text-center mb-2">
            {KIND_LABEL[data.kind]}
          </p>
          <h2
            id="correspondence-sheet-name"
            className="font-serif text-[24px] sm:text-[26px] text-wood-900 leading-[1.15] tracking-[-0.005em] text-center"
          >
            {data.name}
          </h2>

          <p className="font-serif text-[15px] sm:text-[16px] text-wood-700 leading-[1.7] text-center mt-5">
            {data.meaning}
          </p>

          {/* Chain — small breadcrumb showing the trace path. */}
          {data.chain.length > 0 && (
            <div className="mt-6">
              <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500 text-center mb-3">
                The trace
              </p>
              <ol className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center">
                {data.chain.map((step, i) => (
                  <React.Fragment key={i}>
                    <li className="font-serif text-[14px] text-wood-800">
                      {step.label}
                      {step.source && (
                        <span className="font-label text-[9px] uppercase tracking-[0.2em] text-wood-400 ml-1.5">
                          {step.source}
                        </span>
                      )}
                    </li>
                    {i < data.chain.length - 1 && (
                      <li aria-hidden="true" className="text-wood-400 font-serif text-[14px]">→</li>
                    )}
                  </React.Fragment>
                ))}
              </ol>
            </div>
          )}

          {/* Close — explicit dignified affordance. */}
          <div className="mt-7 text-center">
            <button
              type="button"
              onClick={onClose}
              className="font-label text-[11px] uppercase tracking-[0.22em] text-wood-600 hover:text-bronze-700 px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500/40 rounded-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Local keyframes — kept here so the sheet is self-contained. */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default CorrespondenceSheet;
