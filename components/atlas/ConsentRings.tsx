import React, { useId, useState } from 'react';

/**
 * ConsentRings — the consent moment of the claim flow (M2).
 *
 * One active question, per the revised consent model:
 *   - Ring 1 (the private living record) is explanatory text only — it is
 *     always on and needs no toggle.
 *   - Ring 2 (map presence) is the single prominent, celebratory, UNTICKED
 *     choice. Never pre-ticked: placing a light on the world map is an
 *     active opt-in.
 *   - Rings 3–4 (chart presence, public identity) are not asked here; the
 *     server records them as 'deferred' and the piece's book offers them
 *     later. One quiet line says so.
 *
 * The claim ritual rides along: an optional prompt — "What do you hope this
 * piece holds for you?" — whose answer is stored privately on the steward
 * record (pendingFirstInscription), never publicly, never in the chain.
 *
 * Used by StewardClaim (after Phase A returns needsConsent) and by
 * StewardEdit (retro-consent for stewards bound before M2). The parent owns
 * the POST; this component only gathers the choice.
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
}

const ConsentRings: React.FC<ConsentRingsProps> = ({
  pieceTitle,
  submitting,
  error,
  onSubmit,
}) => {
  // Active opt-in: starts false, always. Never pre-ticked.
  const [mapPresence, setMapPresence] = useState(false);
  const [hope, setHope] = useState('');
  const hopeId = useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = hope.trim();
    onSubmit({
      ring2MapPresence: mapPresence,
      ...(trimmed ? { firstInscription: trimmed } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <h2
        className="font-display text-2xl text-wood-900 font-medium text-center mb-6"
        style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}
      >
        {pieceTitle ? `${pieceTitle} is yours` : 'Your piece is yours'}
      </h2>

      {/* Ring 1 — explanatory only, always on. */}
      <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700 text-center mb-10">
        Your piece keeps a private living record — always yours. What you and
        those after you write into it stays with the piece, seen by no one
        else.
      </p>

      {/* Ring 2 — the one active question. Unticked by design. */}
      <div className="border border-wood-200 bg-white px-6 py-7 mb-8">
        <p className="font-serif text-xl leading-snug text-wood-900 text-center mb-2">
          Place your piece as a light on the world map?
        </p>
        <p className="font-serif italic text-sm text-stone-600 text-center mb-6">
          City-level only — no name, no identity. You can change this at any
          time.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={mapPresence}
          aria-label="Place this piece as a light on the world map"
          onClick={() => setMapPresence(v => !v)}
          disabled={submitting}
          className="mx-auto flex items-center gap-4 min-h-[44px] font-sans text-base text-wood-800 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={`relative inline-block w-11 h-6 border transition-colors ${
              mapPresence
                ? 'bg-bronze-400 border-bronze-500'
                : 'bg-paper-100 border-wood-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white transition-transform ${
                mapPresence ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
          <span>{mapPresence ? 'Yes — light my city' : 'Not yet — keep it unlit'}</span>
        </button>
      </div>

      {/* The claim ritual — optional, private. */}
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
        <p className="font-serif italic text-sm text-stone-600 mt-2">
          Optional — kept in your piece&rsquo;s private book.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[48px] bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
      >
        {submitting ? 'Opening the record…' : 'Open the record'}
      </button>

      <div className="h-6 mt-4 text-center" aria-live="polite">
        {error && (
          <span className="font-serif italic text-sm text-stone-600">{error}</span>
        )}
      </div>

      {/* Rings 3–4 — deferred, one quiet line. */}
      <p className="font-serif italic text-xs text-stone-500 text-center">
        Chart presence and public identity can be opened later from your
        piece&rsquo;s book.
      </p>
    </form>
  );
};

export default ConsentRings;
