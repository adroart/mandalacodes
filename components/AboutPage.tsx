import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export const ABOUT_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://mandalacodes.com/#website',
      name: 'Mandala Codes',
      url: 'https://mandalacodes.com',
      inLanguage: 'en',
    },
    {
      '@type': 'Organization',
      '@id': 'https://mandalacodes.com/#editorial-project',
      name: 'Mandala Codes',
      url: 'https://mandalacodes.com',
      description: 'An editorial project about mandala art and the Universal Language Oracle.',
    },
    {
      '@type': 'Person',
      '@id': 'https://mandalacodes.com/about#editor',
      name: 'Adrian Rasmussen',
      url: 'https://mandalacodes.com/about',
      sameAs: 'https://adrianrasmussen.com',
      jobTitle: 'Artist and editor',
      worksFor: { '@id': 'https://mandalacodes.com/#editorial-project' },
    },
  ],
};

const AboutPage: React.FC = () => {
  useEffect(() => {
    const script = (document.getElementById('about-structured-data') as HTMLScriptElement | null) ?? document.createElement('script');
    script.id = 'about-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ABOUT_SCHEMA);
    if (!script.isConnected) document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <article className="min-h-screen bg-paper-50 text-wood-900">
      <div className="mx-auto max-w-5xl px-5 pb-20 pt-[calc(var(--nav-height)+3rem)] sm:px-8 sm:pt-[calc(var(--nav-height)+4rem)]">
        <header className="max-w-3xl">
          <p className="mb-5 font-label text-xs font-semibold uppercase tracking-[0.12em] text-bronze-700">About Mandala Codes</p>
          <h1 className="font-display text-[clamp(2.7rem,7vw,5rem)] leading-[0.98] tracking-[-0.025em]">A place to read the mandala</h1>
          <p className="mt-7 max-w-2xl font-reading text-[19px] leading-[1.55] text-wood-800 sm:text-[22px]">
            Mandala Codes is an editorial home for mandala art, symbolism, and the Universal Language Oracle. We bring the artwork and the ideas behind it into one place for close looking and thoughtful reading.
          </p>
        </header>

        <nav aria-label="Explore Mandala Codes" className="mt-10 border-y border-wood-300 py-6 sm:mt-12 sm:py-8">
          <p className="mb-4 font-label text-xs font-semibold uppercase tracking-[0.12em] text-bronze-700">Explore</p>
          <div className="grid gap-x-9 gap-y-4 sm:grid-cols-3">
            <Link to="/universal-language" className="group block border-b border-wood-200 pb-3 no-underline hover:border-bronze-600 sm:border-b-0 sm:pb-0">
              <span className="block font-display text-[25px] leading-tight text-wood-900 group-hover:text-bronze-700">The Oracle</span>
              <span className="mt-1 block font-reading text-[15px] leading-[1.5] text-wood-700">Open the 64-card reader.</span>
            </Link>
            <Link to="/the-systems" className="group block border-b border-wood-200 pb-3 no-underline hover:border-bronze-600 sm:border-b-0 sm:pb-0">
              <span className="block font-display text-[25px] leading-tight text-wood-900 group-hover:text-bronze-700">The Systems</span>
              <span className="mt-1 block font-reading text-[15px] leading-[1.5] text-wood-700">Meet the traditions behind the deck.</span>
            </Link>
            <a href="/learn/" className="group block pb-1 no-underline hover:border-bronze-600 sm:pb-0">
              <span className="block font-display text-[25px] leading-tight text-wood-900 group-hover:text-bronze-700">Learn</span>
              <span className="mt-1 block font-reading text-[15px] leading-[1.5] text-wood-700">Read the library.</span>
            </a>
          </div>
        </nav>

        <div className="mt-9 grid gap-10 md:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.8fr)] md:gap-16">
          <section aria-labelledby="approach-title">
            <h2 id="approach-title" className="font-display text-[31px] leading-tight sm:text-[36px]">The editorial approach</h2>
            <div className="mt-4 space-y-4 font-reading text-[17px] leading-[1.65] text-wood-800">
              <p>We treat the mandala as both a living art form and a subject worth studying. The library explores its forms and meanings; the Oracle offers a way to contemplate the 64 codes through artwork and text.</p>
              <p>The I Ching, Gene Keys, and Human Design each have their own language and lineage. Our writing aims to name sources, keep those traditions distinct, and make room for interpretation without presenting it as historical fact.</p>
            </div>
            <Link to="/artists" className="mt-5 inline-flex min-h-11 items-center font-label text-[15px] font-semibold text-bronze-700 underline underline-offset-4 hover:text-bronze-600">Meet the featured artists →</Link>
          </section>

          <section aria-labelledby="editor-title" className="border-t border-wood-200 pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <p className="mb-3 font-label text-xs font-semibold uppercase tracking-[0.12em] text-bronze-700">Edited by</p>
            <h2 id="editor-title" className="font-display text-[30px] leading-tight">Adrian Rasmussen</h2>
            <p className="mt-4 font-reading text-[17px] leading-[1.6] text-wood-800">Adrian is the artist and editor behind Mandala Codes. His first-person writing and artwork live on his own site; here, the editorial voice stays focused on the subject and the work.</p>
            <a className="mt-5 inline-flex min-h-11 items-center font-label text-[15px] font-semibold text-bronze-700 underline underline-offset-4 hover:text-bronze-600" href="https://adrianrasmussen.com/">Visit Adrian’s site <span aria-hidden="true" className="ml-1">↗</span></a>
          </section>
        </div>

      </div>
    </article>
  );
};

export default AboutPage;
