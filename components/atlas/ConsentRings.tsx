import React, { useId, useState } from 'react';

/**
 * ConsentRings, the consent moment of the claim flow (M2).
 *
 * One active question, per the revised consent model:
 *   - Ring 1 (the private living record) is explanatory text only, it is
 *     always on and needs no toggle.
 *   - Ring 2 (map presence) is the single prominent, celebratory, UNTICKED
 *     choice. Never pre-ticked: placing a light on the world map is an
 *     active opt-in.
 *   - Rings 3–4 (chart presence, public identity) are not asked here; the
 *     server records them as 'deferred' and the piece's book offers them
 *     later. One quiet line says so.
 *
 * The claim ritual rides along: an optional prompt, "What do you hope this
 * piece holds for you?", whose answer is stored privately on the steward
 * record (pendingFirstInscription), never publicly, never in the chain.
 *
 * Two variants:
 *   - 'panel' (default), the light, boxed form used by StewardEdit's
 *     retro-consent. Unchanged.
 *   - 'stage', seated inside the claim ceremony's dark shell: warm bronze on
 *     deep brown, no boxed web-form feel. The claim flow also passes
 *     showInscription={false}, since it gathers the first inscription in its
 *     own later "dream" beat; ConsentRings then reports only the Ring 2 choice
 *     and the flow carries it into the same Phase B POST.
 *
 * Used by StewardClaim (the claim ceremony) and by StewardEdit (retro-consent
 * for stewards bound before M2). The parent owns the POST; this component only
 * gathers the choice.
 */

export interface ConsentChoice {
  ring2MapPresence: boolean;
  firstInscription?: string;
}

interface ConsentRingsProps {
  /** Piece title for the heading copy, when known. */
  pieceTitle?: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (choice: ConsentChoice) => void;
  /** Visual seating. Default 'panel' (StewardEdit). 'stage' = dark shell. */
  variant?: 'panel' | 'stage';
  /** When false, the first-inscription textarea is omitted and onSubmit
   *  carries only the Ring 2 choice (the claim ceremony inscribes later, in
   *  its own beat). Default true. */
  showInscription?: boolean;
  /** Seed the Ring 2 toggle (so a choice already made upstream is reflected).
   *  Default false, an active opt-in is never pre-ticked. */
  initialMapPresence?: boolean;
  /** Label for the forward action. Defaults to the panel's "Open the record". */
  submitLabel?: string;
}

const ConsentRings: React.FC<ConsentRingsProps> = ({
  pieceTitle,
  submitting,
  error,
  onSubmit,
  variant = 'panel',
  showInscription = true,
  initialMapPresence = false,
  submitLabel,
}) => {
  // Active opt-in: starts false unless a prior beat already seeded it.
  const [mapPresence, setMapPresence] = useState(initialMapPresence);
  const [hope, setHope] = useState('');
  const hopeId = useId();
  const stage = variant === 'stage';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = hope.trim();
    onSubmit({
      ring2MapPresence: mapPresence,
      ...(showInscription && trimmed ? { firstInscription: trimmed } : {}),
    });
  };

  const forwardLabel =
    submitLabel ?? (submitting ? 'Opening the record…' : 'Open the record');

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <h2
        className="font-serif text-2xl font-medium text-center mb-6"
        style={
          stage
            ? { fontFamily: 'var(--font-display)', color: '#e7dcc7', letterSpacing: '0.02em' }
            : { fontFamily: 'var(--font-brand)', letterSpacing: '0.08em' }
        }
      >
        {!stage && (
          <span className="text-wood-900">
            {pieceTitle ? `${pieceTitle} is yours` : 'Your piece is yours'}
          </span>
        )}
        {stage && (pieceTitle ? `${pieceTitle} is yours` : 'Your piece is yours')}
      </h2>

      {/* Ring 1, explanatory only, always on. */}
      <p
        className={`font-serif text-[1.0625rem] leading-relaxed text-center mb-10 ${
          stage ? '' : 'text-stone-700'
        }`}
        style={stage ? { color: 'rgba(203,191,168,0.86)' } : undefined}
      >
        Your piece keeps a private living record, always yours. What you and
        those after you write into it stays with the piece, seen by no one
        else.
      </p>

      {/* Ring 2, the one active question. Unticked by design. On the stage
          it loses the boxed web-form frame for a quiet hairline seat. */}
      <div
        className={
          stage
            ? 'px-2 py-7 mb-8 border-y'
            : 'border border-wood-200 bg-white px-6 py-7 mb-8'
        }
        style={stage ? { borderColor: 'rgba(196,170,124,0.22)' } : undefined}
      >
        <p
          className="font-serif text-xl leading-snug text-center mb-2"
          style={stage ? { color: '#ece2cf' } : undefined}
        >
          <span className={stage ? '' : 'text-wood-900'}>
            Place your piece as a light on the world map?
          </span>
        </p>
        <p
          className={`font-serif text-sm text-center mb-6 ${stage ? '' : 'text-stone-600'}`}
          style={stage ? { color: 'rgba(203,191,168,0.62)' } : undefined}
        >
          City-level only, no name, no identity. You can change this at any
          time.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={mapPresence}
          aria-label="Place this piece as a light on the world map"
          onClick={() => setMapPresence(v => !v)}
          disabled={submitting}
          className={`mx-auto flex items-center gap-4 min-h-[44px] font-sans text-base focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60 ${
            stage ? '' : 'text-wood-800'
          }`}
          style={stage ? { color: '#e7dcc7' } : undefined}
        >
          <span
            aria-hidden="true"
            className={`relative inline-block w-11 h-6 border transition-colors ${
              stage
                ? mapPresence
                  ? ''
                  : ''
                : mapPresence
                ? 'bg-bronze-400 border-bronze-500'
                : 'bg-paper-100 border-wood-300'
            }`}
            style={
              stage
                ? mapPresence
                  ? { background: '#c4aa7c', borderColor: '#d4b88a' }
                  : { background: 'rgba(60,50,38,0.6)', borderColor: 'rgba(196,170,124,0.35)' }
                : undefined
            }
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 transition-transform ${
                mapPresence ? 'translate-x-5' : 'translate-x-0'
              } ${stage ? '' : 'bg-white'}`}
              style={stage ? { background: mapPresence ? '#241e17' : '#e7dcc7' } : undefined}
            />
          </span>
          <span>{mapPresence ? 'Yes, light my city' : 'Not yet, keep it unlit'}</span>
        </button>
      </div>

      {/* The claim ritual, optional, private. Omitted on the stage, where the
          ceremony gathers it in its own "dream" beat. */}
      {showInscription && (
        <div className="mb-8">
          <label
            htmlFor={hopeId}
            className="block font-serif text-[1.0625rem] leading-relaxed text-wood-900 mb-2"
          >
            What do you hope this piece holds for you?
          </label>
          <textarea
            id={hopeId}
            value={hope}
            onChange={e => setHope(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={submitting}
            placeholder="A few words, if you like."
            className="w-full border border-wood-300 bg-white px-4 py-3 font-serif text-base text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 focus:border-bronze-400 disabled:opacity-60"
          />
          <p className="font-serif text-sm text-stone-600 mt-2">
            Optional, kept in your piece&rsquo;s private book.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={
          stage
            ? 'w-full min-h-[48px] font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 transition-colors disabled:opacity-40 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2'
            : 'w-full min-h-[48px] bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2'
        }
        style={
          stage
            ? { background: '#c4aa7c', color: '#241e17' }
            : undefined
        }
      >
        {forwardLabel}
      </button>

      <div className="h-6 mt-4 text-center" aria-live="polite">
        {error && (
          <span
            className={`font-serif text-sm ${stage ? '' : 'text-stone-600'}`}
            style={stage ? { color: 'rgba(203,191,168,0.75)' } : undefined}
          >
            {error}
          </span>
        )}
      </div>

      {/* Rings 3–4, deferred, one quiet line. */}
      <p
        className={`font-serif text-xs text-center ${stage ? '' : 'text-stone-500'}`}
        style={stage ? { color: 'rgba(203,191,168,0.5)' } : undefined}
      >
        Chart presence and public identity can be opened later from your
        piece&rsquo;s book.
      </p>
    </form>
  );
};

export default ConsentRings;
