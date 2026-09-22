import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FULL_ARCHIVE } from '../../data/mockData';
import { artDesignHref, ART_ORIGIN } from '../../lib/atlas/artSite';

/** Retired entrances disclose the boundary before credentials or private input. */
export default function CollectorBoundaryPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requestedPiece = params.get('piece') ?? '';
  const identity = /^([A-Za-z0-9-]+)(?::(\d+))?$/.exec(requestedPiece);
  const piece = FULL_ARCHIVE.find(art => art.id === identity?.[1]);
  const making = location.pathname === '/make';
  return <section className="min-h-screen bg-paper-50 text-wood-900 px-6 pt-[calc(var(--nav-height)+4rem)] pb-20">
    <div className="max-w-xl mx-auto">
      <p className="font-label text-xs uppercase tracking-widest text-bronze-600">{piece?.id ?? 'Physical artwork'}</p>
      <h1 className="font-display text-4xl mt-4">{making ? 'Have a piece made' : 'Your physical piece'}</h1>
      {piece && <p className="font-reading text-xl mt-4">{piece.title}{identity?.[2] ? ` · Edition ${identity[2]}` : ''}</p>}
      <p className="font-reading text-lg leading-relaxed mt-6">{making
        ? 'Artwork details and inquiries are handled on the artist site.'
        : 'Collector registration is not open here. The artist site holds the public artwork record; viewing it does not register ownership.'}</p>
      <a className="inline-block min-h-[44px] py-4 mt-5 text-bronze-700 underline" href={piece ? artDesignHref(piece.id, piece.cardNumber) : `${ART_ORIGIN}/atlas`}>
        {piece ? 'View this artwork on the artist site' : 'View the public artwork atlas'}
      </a>
      <div><Link className="inline-block py-3 underline" to={piece?.cardNumber ? `/universal-language/${piece.cardNumber}` : '/universal-language'}>Return to the Oracle</Link></div>
    </div>
  </section>;
}
