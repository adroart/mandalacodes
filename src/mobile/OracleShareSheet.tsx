import React, { useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
export default function OracleShareSheet({ open, onClose, cardNumber, cardName }: { open: boolean; onClose: () => void; cardNumber: number; cardName: string; keywords?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  useDialogFocus(ref, open, onClose);
  if (!open) return null;
  const url = `https://mandalacodes.com/universal-language/${cardNumber}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: cardName, url });
      else { await navigator.clipboard.writeText(url); setMessage('Link copied'); }
    } catch (error) { if (!(error instanceof Error && /cancel|abort/i.test(error.message))) setMessage('Could not share. Try copying the link.'); }
  };
  return <div className="oracle-app-share-backdrop" onClick={onClose}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`Share ${cardName}`} tabIndex={-1} className="oracle-app-share" onClick={event => event.stopPropagation()}>
      <h2>{cardName}</h2><p>Share this Oracle reading.</p>
      <button onClick={share}>Share reading</button>
      <button onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage('Link copied'); } catch { setMessage('Could not copy the link.'); } }}>Copy link</button>
      <button onClick={onClose}>Close</button><p role="status">{message}</p>
    </div>
  </div>;
}
