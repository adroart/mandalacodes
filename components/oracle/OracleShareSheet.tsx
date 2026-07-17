import React, { useEffect, useRef, useState } from 'react';
import { ulCardPublicId } from '../../utils/universalLanguage';
import { themeCanvasFont } from '../../shared/themeFonts';

/* The Share panel as it was on the version live before the Earth's Breath
   rebuild — the richer sheet with brand icons (Copy link / WhatsApp / Telegram /
   X / Email / Instagram Story), the Instagram-story image export included.
   Restored per request; opens as a centered card over a scrim. */

const CLOUDINARY_BASE = 'https://res.cloudinary.com/dobbosnda/image/upload';
const LABEL = 'font-label text-[14px] uppercase tracking-[0.2em] font-bold';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxSize: number, minSize: number, makeFont: (s: number) => string) {
  let size = maxSize; ctx.font = makeFont(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) { size -= 4; ctx.font = makeFont(size); }
}

async function generateStoryBlob(number: number, cardName: string, keywords: string): Promise<Blob> {
  const publicId = ulCardPublicId(number);
  if (!publicId) throw new Error('no image');
  await Promise.all([
    document.fonts.load(themeCanvasFont('400', 88, 'display')),
    document.fonts.load(themeCanvasFont('400', 32, 'ui')),
    document.fonts.load(themeCanvasFont('400', 32, 'reading')),
  ]).catch(() => {});
  const imgUrl = `${CLOUDINARY_BASE}/f_jpg,q_auto,w_1080,h_1080,c_fill,g_center/${publicId}`;
  const cardImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = reject; i.src = imgUrl;
  });
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#16130E'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(cardImg, 0, 80, W, W);
  const grad = ctx.createLinearGradient(0, 940, 0, 1180);
  grad.addColorStop(0, 'rgba(22,19,14,0)'); grad.addColorStop(1, 'rgba(22,19,14,1)');
  ctx.fillStyle = grad; ctx.fillRect(0, 940, W, 240);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const cx = W / 2;
  ctx.fillStyle = '#C7A05B'; ctx.font = themeCanvasFont('400', 26, 'ui');
  ctx.fillText('UNIVERSAL LANGUAGE ORACLE', cx, 1240);
  ctx.fillStyle = '#ECE4D5'; fitText(ctx, cardName, 960, 84, 52, s => themeCanvasFont('400', s, 'display'));
  ctx.fillText(cardName, cx, 1345);
  ctx.fillStyle = '#7A7160'; ctx.font = themeCanvasFont('400', 30, 'ui');
  ctx.fillText(`Code ${String(number).padStart(2, '0')}`, cx, 1418);
  ctx.fillStyle = '#ABA08C'; fitText(ctx, keywords, 900, 30, 22, s => themeCanvasFont('400', s, 'ui'));
  ctx.fillText(keywords, cx, 1492);
  ctx.strokeStyle = '#3a342b'; ctx.beginPath(); ctx.moveTo(390, 1556); ctx.lineTo(690, 1556); ctx.stroke();
  ctx.fillStyle = '#7A7160'; ctx.font = themeCanvasFont('italic 400', 30, 'reading');
  ctx.fillText('Open the reading and receive what it holds.', cx, 1620);
  return new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', 0.92));
}

export const OracleShareSheet: React.FC<{
  open: boolean; onClose: () => void;
  cardName: string; cardNumber: number; keywords: string[];
}> = ({ open, onClose, cardName, cardNumber, keywords }) => {
  const [copied, setCopied] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  const storyFileRef = useRef<File | null>(null);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `${cardName} · Code ${cardNumber} · Universal Language Oracle by Adrian Rasmussen`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    if (!storyFileRef.current) {
      const kw = keywords.slice(0, 3).join(' · ');
      generateStoryBlob(cardNumber, cardName, kw)
        .then(blob => { storyFileRef.current = new File([blob], `universal-language-code-${cardNumber}.jpg`, { type: 'image/jpeg' }); })
        .catch(() => {});
    }
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, cardNumber, cardName, keywords]);

  if (!open) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000); setTimeout(onClose, 1500);
  };
  const handleInstagram = async () => {
    const file = storyFileRef.current;
    if (file && 'canShare' in navigator && (navigator as any).canShare({ files: [file] })) {
      try { await (navigator as any).share({ files: [file], title: shareText, url: shareUrl }); } catch {}
    } else { await handleDownload(); }
    onClose();
  };
  const handleDownload = async () => {
    setStoryLoading(true);
    try {
      const blob = storyFileRef.current ?? await generateStoryBlob(cardNumber, cardName, keywords.slice(0, 3).join(' · '));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `universal-language-code-${cardNumber}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch {} finally { setStoryLoading(false); }
  };

  const tile = 'flex items-center gap-3 px-4 py-3 bg-paper-50 hover:bg-paper-100 border border-wood-200/60 hover:border-wood-300 transition-colors';
  return (
    <div className="eb-reading fixed inset-0 z-[300] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`Share ${cardName}`} data-palette="daybook">
      <button type="button" aria-label="Dismiss" onClick={onClose} className="absolute inset-0 bg-stone-900/55 backdrop-blur-[2px]" style={{ animation: 'ulFadeIn 200ms ease both' }} />
      <div className="relative w-full sm:max-w-[460px] bg-paper-100 border border-wood-200/60 sm:rounded-lg overflow-hidden" style={{ animation: 'ulRise 320ms cubic-bezier(.16,1,.3,1) both' }}>
        <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
          <p className="font-display text-[22px] text-wood-900">Send a code</p>
          <button onClick={onClose} aria-label="Close" className="text-wood-400 hover:text-wood-700 text-2xl leading-none">×</button>
        </div>
        <div className="grid grid-cols-2 gap-2 px-5 pb-5">
          <button onClick={handleCopy} className={`${tile} text-left`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wood-500 flex-shrink-0"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span className={`${LABEL} ${copied ? 'text-bronze-600' : 'text-wood-600'}`}>{copied ? 'Copied!' : 'Copy link'}</span>
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`} target="_blank" rel="noopener noreferrer" onClick={onClose} className={tile}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-[#25D366] flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>
            <span className={`${LABEL} text-wood-600`}>WhatsApp</span>
          </a>
          <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" onClick={onClose} className={tile}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-[#2AABEE] flex-shrink-0"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            <span className={`${LABEL} text-wood-600`}>Telegram</span>
          </a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" onClick={onClose} className={tile}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-wood-700 flex-shrink-0"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span className={`${LABEL} text-wood-600`}>X / Twitter</span>
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent('I wanted to share this oracle card with you:\n\n' + shareUrl)}`} onClick={onClose} className={tile}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wood-500 flex-shrink-0"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span className={`${LABEL} text-wood-600`}>Email</span>
          </a>
          <button onClick={handleInstagram} disabled={storyLoading} className={`${tile} text-left disabled:opacity-50`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wood-500 flex-shrink-0"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            <span className={`${LABEL} text-wood-600`}>{storyLoading ? 'Saving…' : 'Instagram Story'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OracleShareSheet;
