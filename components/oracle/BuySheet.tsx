import React, { useEffect, useRef } from 'react';
import type { Artwork } from '../../data/mockData';
import { ulCardArtFloatsFree } from '../../utils/universalLanguage';

const ART_SITE = 'https://adrianrasmussen.com';

export const BuySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  piece: Artwork | null;
  imageUrl: string;
  imageAlt: string;
  cardName: string;
  cardNumber: number;
}> = ({ open, onClose, piece, imageUrl, imageAlt, cardName, cardNumber }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    setTimeout(() => dialogRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const pieceHref = piece ? `${ART_SITE}/creations/${piece.id}` : null;
  const inquireHref = `${ART_SITE}/inquire`;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Acquire ${cardName}`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/65 backdrop-blur-[2px] motion-safe:animate-[buysheet-fade_180ms_ease-out]"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full sm:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto bg-paper-100 border-t sm:border border-wood-300/60 sm:rounded-md shadow-[0_-12px_40px_rgba(0,0,0,0.35)] sm:shadow-[0_18px_60px_rgba(0,0,0,0.45)] motion-safe:animate-[buysheet-rise_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="block w-10 h-1 rounded-full bg-wood-300/70" aria-hidden="true" />
        </div>

        <div className="px-6 sm:px-8 pt-4 pb-6">
          <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500">Code {cardNumber}</p>
          <h2 className="font-display text-[26px] leading-[1.15] text-wood-900 mt-1">{cardName}</h2>

          <div className="mt-5 flex gap-4">
            <img
              src={imageUrl}
              alt={imageAlt}
              /* The plates with transparent corners float free, so a border
                 there would box in empty space; the ones carrying their own
                 captured ground keep the edge that separates plate from sheet. */
              className={`w-24 h-24 object-contain flex-shrink-0 ${
                ulCardArtFloatsFree(cardNumber) ? '' : 'border border-wood-300/40'
              }`}
              crossOrigin="anonymous"
            />
            <div className="min-w-0 flex-1 space-y-2">
              {piece?.dimensions && (
                <p className="font-reading text-[13px] text-wood-700 leading-[1.4]">
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">Dimensions</span>
                  <br />{piece.dimensions}
                </p>
              )}
              {piece?.material && (
                <p className="font-reading text-[13px] text-wood-700 leading-[1.4]">
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500">Material</span>
                  <br />{piece.material}
                </p>
              )}
            </div>
          </div>

          {piece?.description && (
            <p className="font-reading text-[14px] text-wood-700 tracking-[0.015em] leading-[1.55] mt-4">
              {piece.description}
            </p>
          )}

          {pieceHref && (
            <div className="mt-7 pt-6 border-t border-wood-300/50">
              <a
                href={pieceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-paper-50 hover:bg-bronze-50/60 border border-bronze-400/50 hover:border-bronze-500/70 transition-colors"
              >
                <div className="h-[2px] w-full bg-bronze-500 group-hover:bg-bronze-400 motion-safe:transition-colors" aria-hidden="true" />
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-reading text-[17px] text-wood-900 group-hover:text-bronze-700 leading-tight">
                      View the original
                    </p>
                    <p className="font-label text-[10px] uppercase tracking-[0.22em] text-wood-500 mt-1.5">
                      On adrianrasmussen.com · Acquire or commission
                    </p>
                  </div>
                  <span className="font-reading text-[20px] text-bronze-500 group-hover:text-bronze-700" aria-hidden="true">↗</span>
                </div>
              </a>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-wood-300/40">
            <a
              href={inquireHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-label text-[11px] uppercase tracking-[0.22em] text-bronze-600 hover:text-bronze-500 font-semibold transition-colors"
            >
              Commission a custom piece ↗
            </a>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes buysheet-rise {
          from { transform: translateY(24%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes buysheet-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default BuySheet;
