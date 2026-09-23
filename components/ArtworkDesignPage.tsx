import React from 'react';
import { Link } from 'react-router-dom';
import type { Artwork } from '../types';
import { img } from '../utils/media';
import { artDesignHref } from '../lib/atlas/artSite';

/** A catalogue design is not evidence that a physical object has been issued. */
export default function ArtworkDesignPage({ art }: { art: Artwork }) {
  return <article className="min-h-screen bg-paper-100 text-wood-900 px-6 pt-[calc(var(--nav-height)+2rem)] pb-24">
    <div className="max-w-2xl mx-auto">
      <Link className="inline-block min-h-[44px] underline" to={art.cardNumber ? `/universal-language/${art.cardNumber}` : '/universal-language'}>Return to the reading</Link>
      <p className="font-label text-xs uppercase tracking-widest mt-5">{art.series} · {art.id} · Artwork design</p>
      <h1 className="font-display text-4xl sm:text-5xl mt-4">{art.title}</h1>
      <img className="w-full max-w-md mx-auto my-8" src={img(art.coverImage, { w: 900 })} alt={art.title} />
      <p className="font-reading text-lg leading-relaxed">Made by hand by Adrian Rasmussen. This page describes the artwork design. A registered physical piece has its own public code and Piece Record.</p>
      {art.cardNumber && <p className="font-reading mt-4">Corresponding Oracle card: {art.cardNumber}.</p>}
      <a className="inline-block min-h-[44px] py-4 mt-6 text-bronze-700 underline" href={artDesignHref(art.id, art.cardNumber)}>View the sculpture and inquire</a>
    </div>
  </article>;
}
