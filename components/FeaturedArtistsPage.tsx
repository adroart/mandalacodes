import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { artistBySlug, featuredArtists, type FeaturedArtist } from '../data/featuredArtists';
import { img } from '../utils/media';
import NotFound from './NotFound';

const origin = 'https://mandalacodes.com';
const imageUrl = (id: string) => `${origin}${img(id, { w: 1200 })}`;

export function artistSchema(artist: FeaturedArtist) {
  const page = `${origin}/artists/${artist.slug}`;
  const person = { '@type': 'Person', '@id': `${page}#person`, name: artist.name, url: artist.primarySite, image: artist.portrait || imageUrl(artist.hero.image), description: artist.summary, jobTitle: 'Artist', knowsAbout: ['Mandala art', artist.medium], sameAs: [artist.primarySite, ...(artist.instagram ? [artist.instagram] : [])] };
  return { '@context': 'https://schema.org', '@graph': [
    person,
    { '@type': 'Article', '@id': `${page}#article`, headline: `${artist.name} · Featured Mandala Artist`, mainEntityOfPage: page, author: { '@type': 'Organization', name: 'Mandala Codes', url: origin }, publisher: { '@type': 'Organization', name: 'Mandala Codes', url: origin }, datePublished: artist.featureDate, image: imageUrl(artist.hero.image), about: { '@id': person['@id'] } },
    ...artist.selectedWorks.map((work) => ({ '@type': 'CreativeWork', name: work.title, creator: { '@id': person['@id'] }, dateCreated: work.year, image: imageUrl(work.image), artMedium: work.medium, url: work.artistSiteUrl })),
  ] };
}

export function artistsSchema() {
  return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Featured Mandala Artists', url: `${origin}/artists`, description: 'Editorial features on contemporary mandala artists and their work.', hasPart: featuredArtists.map((artist) => ({ '@type': 'Person', name: artist.name, url: `${origin}/artists/${artist.slug}` })) };
}

function StructuredData({ id, data }: { id: string; data: object }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    return () => script.remove();
  }, [id, data]);
  return null;
}

const label = 'font-label text-xs font-semibold uppercase tracking-[0.12em] text-bronze-700';
const link = 'font-label text-[14px] font-semibold text-bronze-700 underline underline-offset-4 hover:text-bronze-600';

export function ArtistsHubPage() {
  return <article className="min-h-screen bg-paper-50 text-wood-900">
    <StructuredData id="artists-structured-data" data={artistsSchema()} />
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-[calc(var(--nav-height)+3rem)] sm:px-8">
      <header className="max-w-3xl">
        <p className={label}>Artists</p>
        <h1 className="mt-3 font-display text-[clamp(2.7rem,7vw,5rem)] leading-[0.98]">Featured Mandala Artists</h1>
        <p className="mt-6 font-reading text-[18px] leading-[1.55] text-wood-800 sm:text-[21px]">A close look at contemporary artists working with mandala forms. Each feature brings together the artist’s practice, selected work, and a path to their own site.</p>
      </header>
      <div className="mt-9 border-t border-wood-300 pt-6">
        {featuredArtists.map((artist) => <Link key={artist.slug} to={`/artists/${artist.slug}`} className="group grid gap-5 no-underline sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-center sm:gap-8">
          <img src={img(artist.hero.image, { w: 800 })} alt={artist.hero.title} className="aspect-[4/3] w-full bg-wood-200 object-contain" />
          <div>
            <p className={label}>{artist.medium}</p>
            <h2 className="mt-2 font-display text-[clamp(2rem,5vw,3.3rem)] leading-none group-hover:text-bronze-700">{artist.name}</h2>
            <p className="mt-4 max-w-lg font-reading text-[17px] leading-[1.55] text-wood-800">{artist.summary}</p>
            <span className={`mt-4 inline-block ${link}`}>Read the feature →</span>
          </div>
        </Link>)}
      </div>
    </div>
  </article>;
}

export function ArtistFeaturePage() {
  const { slug = '' } = useParams();
  const artist = artistBySlug(slug);
  if (!artist) return <NotFound />;
  return <ArtistFeature artist={artist} />;
}

export function ArtistFeature({ artist }: { artist: FeaturedArtist }) {
  useEffect(() => {
    const type = document.querySelector<HTMLMetaElement>('meta[property="og:type"]');
    if (!type) return;
    const previous = type.content;
    type.content = 'profile';
    return () => {
      if (type.content === 'profile') type.content = previous;
    };
  }, []);
  return <article className="min-h-screen bg-paper-50 text-wood-900">
    <StructuredData id="artist-structured-data" data={artistSchema(artist)} />
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-[calc(var(--nav-height)+2rem)] sm:px-8">
      <Link to="/artists" className={link}>← All artists</Link>
      <header className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-end md:gap-10">
        <div>
          <p className={label}>Featured artist</p>
          <h1 className="mt-3 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.9]">{artist.name}</h1>
          <p className="mt-5 font-reading text-[19px] leading-[1.5] text-wood-800">{artist.medium}</p>
        </div>
        <img src={img(artist.hero.image, { w: 1000 })} alt={`${artist.hero.title}, ${artist.name}`} className="aspect-[4/3] w-full bg-wood-200 object-contain" />
      </header>
      <div className="mt-9 grid gap-9 border-t border-wood-300 pt-8 md:grid-cols-[minmax(0,1.5fr)_minmax(14rem,0.8fr)] md:gap-14">
        <section aria-labelledby="intro-title">
          <h2 id="intro-title" className="font-display text-[33px] leading-tight">The work</h2>
          <div className="mt-4 space-y-4 font-reading text-[17px] leading-[1.65] text-wood-800">{artist.introduction.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        </section>
        <section aria-labelledby="bio-title" className="border-t border-wood-200 pt-6 md:border-l md:border-t-0 md:pl-7 md:pt-0">
          <h2 id="bio-title" className="font-display text-[30px]">About the artist</h2>
          {artist.portrait && <img src={artist.portrait} alt={`${artist.name} portrait`} className="mt-4 aspect-[4/3] w-full bg-wood-200 object-cover object-top" loading="lazy" />}
          <div className="mt-4 space-y-3 font-reading text-[16px] leading-[1.6] text-wood-800">{artist.biography.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          <a href={artist.primarySite} className={`mt-4 inline-block ${link}`}>Read his account ↗</a>
        </section>
      </div>
      <section aria-labelledby="works-title" className="mt-12 border-t border-wood-300 pt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="works-title" className="font-display text-[36px]">Selected works</h2><p className="font-reading text-[15px] text-wood-700">All works 2024 · Laser-cut wood, acrylic, gemstones</p></div>
        <div className="mt-5 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {artist.selectedWorks.map((work) => <figure key={work.id}>
            <a href={work.artistSiteUrl} aria-label={`View ${work.title} on ${artist.name}'s site`}><img src={img(work.image, { w: 700 })} alt={`${work.title}, ${work.medium}, ${work.year}`} loading="lazy" className="aspect-square w-full bg-wood-200 object-contain" /></a>
            <figcaption className="mt-3"><h3 className="font-display text-[24px] leading-tight">{work.title}</h3><a className={`mt-2 inline-block ${link}`} href={work.artistSiteUrl}>View on artist’s site ↗</a></figcaption>
          </figure>)}
        </div>
      </section>
      <section aria-labelledby="practice-title" className="mt-12 grid gap-5 border-t border-wood-300 pt-7 md:grid-cols-[minmax(12rem,0.6fr)_minmax(0,1.4fr)] md:gap-12"><h2 id="practice-title" className="font-display text-[33px] leading-tight">Practice and process</h2><div className="space-y-4 font-reading text-[17px] leading-[1.65] text-wood-800">{artist.practice.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-5 border-t border-wood-300 pt-7"><div><p className={label}>Find the work</p><div className="mt-3 flex flex-wrap gap-x-6 gap-y-3"><a href={artist.portfolioUrl} className={link}>Mandala portfolio ↗</a><a href={artist.primarySite} className={link}>Artist website ↗</a>{artist.instagram && <a href={artist.instagram} className={link}>Instagram ↗</a>}</div></div><Link to="/artists" className={link}>All featured artists →</Link></footer>
    </div>
  </article>;
}

export default ArtistFeaturePage;
