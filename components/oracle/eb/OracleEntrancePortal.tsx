import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface OracleEntrancePortalProps {
  active: boolean;
  choreography: 'entrance' | 'exiting' | 'hero' | 'reading';
  cardName: string;
  keywords: string[];
  entranceRing: React.ReactNode;
  entranceCenter: React.ReactNode;
  palette: string;
  accent: string;
  motion: string;
  onDismiss: () => void;
  registerVeil: (element: HTMLDivElement | null) => void;
}

export function OracleEntrancePortal({
  active,
  choreography,
  cardName,
  keywords,
  entranceRing,
  entranceCenter,
  palette,
  accent,
  motion,
  onDismiss,
  registerVeil,
}: OracleEntrancePortalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let scroller: HTMLElement | null = null;
    let connectFrame = 0;
    let syncFrame = 0;
    let disposed = false;

    const syncPaper = () => {
      syncFrame = 0;
      if (!scroller || !grainRef.current) return;
      grainRef.current.style.setProperty('--oracle-paper-scroll-y', `${-scroller.scrollTop}px`);
    };
    const queueSync = () => {
      if (!syncFrame) syncFrame = requestAnimationFrame(syncPaper);
    };
    const connect = () => {
      if (disposed) return;
      scroller = document.querySelector<HTMLElement>('.card-reading [data-scroll]');
      if (!scroller) {
        connectFrame = requestAnimationFrame(connect);
        return;
      }
      scroller.addEventListener('scroll', queueSync, { passive: true });
      syncPaper();
    };

    connect();
    return () => {
      disposed = true;
      if (connectFrame) cancelAnimationFrame(connectFrame);
      if (syncFrame) cancelAnimationFrame(syncFrame);
      scroller?.removeEventListener('scroll', queueSync);
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    const current = document.activeElement;
    if (current instanceof HTMLElement && current !== document.body && current !== document.documentElement && current !== dialogRef.current) {
      returnFocusRef.current = current;
    }
    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      const previous = returnFocusRef.current;
      if (previous?.isConnected && previous !== document.body && previous !== document.documentElement) {
        previous.focus({ preventScroll: true });
        return;
      }

      const landmark = document.querySelector<HTMLElement>('[data-oracle-reader] [data-oracle-flow], [data-oracle-reader]');
      if (!landmark) return;
      if (!landmark.hasAttribute('tabindex')) landmark.setAttribute('tabindex', '-1');
      landmark.focus({ preventScroll: true });
    };
  }, [active]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div ref={grainRef} data-oracle-grain="reading" aria-hidden="true" />
      <div ref={registerVeil} data-oracle-veil aria-hidden="true" />
      {active ? (
        <div
          ref={dialogRef}
          className="eb-entrance oracle-entrance-portal"
          data-palette={palette}
          data-accent={accent}
          data-motion={motion}
          data-oracle-entrance-choreography={choreography}
          role="dialog"
          aria-modal="true"
          aria-label="Card entrance. Tap to begin."
          tabIndex={-1}
          onClick={onDismiss}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onDismiss();
            }
          }}
        >
          <p className="oracle-entrance-portal__title">{cardName}</p>
          <div className="oracle-entrance-portal__ring">
            {entranceRing}
            <div className="oracle-entrance-portal__center">
              {entranceCenter}
              <ul>
                {keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
              </ul>
            </div>
          </div>
          <p className="oracle-entrance-portal__prompt">tap to begin</p>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
