import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { categoryLabels, lightCodeByNumber, lightCodeImagePath, lightCodes, lightCodeTitle, type LightCode, type LightCodeCategory } from '../data/lightCodes';
import NotFound from './NotFound';

const origin = 'https://mandalacodes.com';
const label = 'font-label text-xs font-semibold uppercase tracking-[0.12em] text-bronze-700';
const textLink = 'inline-flex min-h-11 items-center font-label text-[15px] font-semibold text-bronze-700 underline underline-offset-4 hover:text-bronze-600 focus-visible:outline-2 focus-visible:outline-offset-4';

export const lightCodesSchema = () => ({
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  name: 'Light Codes', url: `${origin}/light-codes`,
  description: 'Browse the artwork of 68 numbered Light Codes.',
  hasPart: lightCodes.map(({ number }) => ({ '@type': 'VisualArtwork', name: lightCodeTitle(number), url: `${origin}/light-codes/${number}`, image: `${origin}${lightCodeImagePath(number)}` })),
});

export const lightCodeSchema = (card: LightCode) => ({
  '@context': 'https://schema.org', '@type': 'VisualArtwork',
  name: lightCodeTitle(card.number), url: `${origin}/light-codes/${card.number}`,
  image: `${origin}${lightCodeImagePath(card.number)}`,
  isPartOf: { '@type': 'CollectionPage', name: 'Light Codes', url: `${origin}/light-codes` },
});

const filterLabels: Record<LightCodeCategory, string> = {
  'frequency-foundation': 'Foundation',
  'embodied-vibration': 'Embodied',
  'resonant-formations': 'Resonant',
};

function StructuredData({ id, data }: { id: string; data: object }) {
  useEffect(() => {
    const script = (document.getElementById(id) as HTMLScriptElement | null) ?? document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    if (!script.isConnected) document.head.appendChild(script);
    return () => script.remove();
  }, [id, data]);
  return null;
}

function ArtworkImageMeta({ width }: { width: number }) {
  useEffect(() => {
    const widthTag = document.querySelector<HTMLMetaElement>('meta[property="og:image:width"]');
    const heightTag = document.querySelector<HTMLMetaElement>('meta[property="og:image:height"]');
    if (!widthTag || !heightTag) return;
    const priorWidth = widthTag.content === String(width) && heightTag.content === '1200' ? '1200' : widthTag.content;
    const priorHeight = widthTag.content === String(width) && heightTag.content === '1200' ? '630' : heightTag.content;
    widthTag.content = String(width);
    heightTag.content = '1200';
    return () => {
      if (widthTag.content === String(width) && heightTag.content === '1200') {
        widthTag.content = priorWidth;
        heightTag.content = priorHeight;
      }
    };
  }, [width]);
  return null;
}

export function LightCodesPage() {
  const [category, setCategory] = useState<LightCodeCategory | 'all'>('all');
  const shown = category === 'all' ? lightCodes : lightCodes.filter((card) => card.category === category);
  const counts = lightCodes.reduce<Record<LightCodeCategory, number>>((result, card) => {
    result[card.category] += 1;
    return result;
  }, { 'frequency-foundation': 0, 'embodied-vibration': 0, 'resonant-formations': 0 });
  return <article className="min-h-screen bg-paper-50 text-wood-900">
    <StructuredData id="light-codes-structured-data" data={lightCodesSchema()} />
    <ArtworkImageMeta width={1200} />
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-8">
      <header className="max-w-3xl">
        <p className={label}>Artwork archive</p>
        <h1 className="mt-3 font-display text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.95]">Light Codes</h1>
        <p className="mt-5 font-reading text-[18px] leading-[1.5] text-wood-800 sm:text-[20px]">Browse 68 numbered works from the Light Codes series.</p>
      </header>
      <div className="mt-7 flex flex-wrap gap-2 border-y border-wood-300 py-4" role="group" aria-label="Filter artwork by category">
        {(['all', 'frequency-foundation', 'embodied-vibration', 'resonant-formations'] as const).map((value) => <button
          key={value} type="button" aria-label={`${value === 'all' ? 'All artwork' : categoryLabels[value]} (${value === 'all' ? lightCodes.length : counts[value]})`} aria-pressed={category === value} onClick={() => setCategory(value)}
          className={`min-h-11 rounded-full border px-4 py-2 font-label text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${category === value ? 'border-wood-900 bg-wood-900 text-paper-50' : 'border-wood-300 text-wood-800 hover:border-bronze-700'}`}>
          {value === 'all' ? 'All' : filterLabels[value]} <span aria-hidden="true">{value === 'all' ? lightCodes.length : counts[value]}</span>
        </button>)}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-6" aria-live="polite">
        {shown.map((card) => <Link key={card.number} to={`/light-codes/${card.number}`} className="group block min-w-0 no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bronze-700" aria-label={`View ${lightCodeTitle(card.number)}, ${categoryLabels[card.category]}`}>
          <div className="aspect-square bg-wood-200"><img src={lightCodeImagePath(card.number)} alt={`Artwork for ${lightCodeTitle(card.number)}`} loading={card.number > 8 ? 'lazy' : 'eager'} className="h-full w-full object-contain" /></div>
          <h2 className="mt-2 font-display text-[21px] leading-tight text-wood-900 group-hover:text-bronze-700">{lightCodeTitle(card.number)}</h2>
          <p className="mt-0.5 font-reading text-[13px] leading-tight text-wood-700">{categoryLabels[card.category]}</p>
        </Link>)}
      </div>
    </div>
  </article>;
}

export function LightCodePage() {
  const { number = '' } = useParams();
  const card = lightCodeByNumber(number);
  if (!card) return <NotFound />;
  return <LightCodeArtwork card={card} />;
}

export function LightCodeArtwork({ card }: { card: LightCode }) {
  const previous = card.number > 1 ? card.number - 1 : undefined;
  const next = card.number < lightCodes.length ? card.number + 1 : undefined;
  return <article className="min-h-screen bg-paper-50 text-wood-900">
    <StructuredData id="light-code-structured-data" data={lightCodeSchema(card)} />
    <ArtworkImageMeta width={card.number === 51 ? 1059 : 1200} />
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-[calc(var(--nav-height)+1.5rem)] sm:px-8">
      <nav aria-label="Light Code artwork navigation" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Link to="/light-codes" className={textLink}>← All</Link>
        <div className="flex items-center gap-4">
          {previous && <Link className={textLink} to={`/light-codes/${previous}`} aria-label={`Previous artwork, ${lightCodeTitle(previous)}`}>← Previous</Link>}
          {next && <Link className={textLink} to={`/light-codes/${next}`} aria-label={`Next artwork, ${lightCodeTitle(next)}`}>Next →</Link>}
        </div>
      </nav>
      <div className="mt-4 grid gap-5 border-t border-wood-300 pt-5 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.4fr)] md:gap-10">
        <div className="min-w-0"><img src={lightCodeImagePath(card.number)} alt={`Artwork for ${lightCodeTitle(card.number)}`} className="mx-auto max-h-[min(72vh,760px)] w-full bg-wood-200 object-contain" /></div>
        <div>
          <div><p className={label}>Artwork {card.number} of {lightCodes.length}</p><h1 className="mt-3 font-display text-[clamp(2.8rem,7vw,4.7rem)] leading-[0.95]">{lightCodeTitle(card.number)}</h1><p className="mt-4 font-reading text-[17px] text-wood-700">{categoryLabels[card.category]}</p></div>
        </div>
      </div>
    </div>
  </article>;
}

export default LightCodePage;
