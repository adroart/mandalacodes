/** A compact selection action beside the globe. Dream prose belongs in the opened card. */
export interface SelectionInscriptionProps {
  title: string;
  standing: string;
  awayLeft: boolean;
  onOpenBook: () => void;
}

export default function SelectionInscription({ title, standing, awayLeft, onOpenBook }: SelectionInscriptionProps) {
  return (
    <div
      data-atlas-inscription
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-30 max-w-[22rem] p-6 ${awayLeft ? 'left-8 text-left' : 'right-8 text-right'}`}
      style={{ background: 'radial-gradient(ellipse, rgba(7,5,3,0.8), rgba(7,5,3,0) 75%)' }}
    >
      <h3 className="font-display text-[24px] leading-tight text-paper-50">{title}</h3>
      <p className="mt-3 font-label text-[11px] uppercase tracking-[0.14em] text-bronze-300">{standing}</p>
      <button type="button" onClick={onOpenBook} className="pointer-events-auto mt-6 min-h-[44px] font-label text-[12px] uppercase tracking-[0.2em] text-bronze-200 underline underline-offset-4 hover:text-paper-50">
        open the book
      </button>
    </div>
  );
}
