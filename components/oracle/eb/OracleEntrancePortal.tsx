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

  useEffect(() => {
    if (active) dialogRef.current?.focus();
  }, [active]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div data-oracle-grain aria-hidden="true" />
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
