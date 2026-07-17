import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProfileGraph from './oracle/ProfileGraph';
import { decodeSharedProfile } from '../lib/profile/share';
import { useMetaTags } from '../hooks/useMetaTags';

/**
 * /profile/shared/:data
 *
 * A read-only view of someone else's Hologenetic Profile, decoded entirely
 * from the URL. Carries only the eleven positions and the place label, never
 * the birth date or time, and needs no backend. Renders the same ProfileGraph
 * the owner sees, so the recipient can read each sphere and click into cards.
 */
const SharedProfile: React.FC = () => {
  const { data } = useParams<{ data: string }>();
  const decoded = useMemo(() => (data ? decodeSharedProfile(data) : null), [data]);

  useMetaTags({
    title: 'A Hologenetic Profile · Universal Language',
    description:
      'A shared Hologenetic Profile: eleven positions and the cards that meet them, in the Universal Language.',
  });

  return (
    <main className="min-h-screen pb-24 px-6 max-w-3xl mx-auto pt-[calc(var(--nav-height)+3rem)] sm:pt-[calc(var(--nav-height)+4rem)]">
      <header className="mb-10">
        <p
          style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--color-bronze-600)',
            marginBottom: 14,
          }}
        >
          Universal Language · Shared
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 36,
            color: 'var(--color-wood-900)',
            margin: 0,
          }}
        >
          A Hologenetic Profile
        </h1>
        {decoded?.placeLabel && (
          <p
            style={{
              fontFamily: 'var(--font-reading)',
              fontSize: 17,
              color: 'var(--color-wood-700)',
              marginTop: 12,
            }}
          >
            Born in {decoded.placeLabel}.
          </p>
        )}
        <p
          style={{
            fontFamily: 'var(--font-reading)',
            fontSize: 17,
            color: 'var(--color-wood-700)',
            marginTop: 12,
            maxWidth: 560,
            lineHeight: 1.5,
          }}
        >
          Eleven positions, each meeting one card. Click any sphere to read the
          card that meets it.
        </p>
      </header>

      {decoded ? (
        <ProfileGraph profile={decoded.computed} />
      ) : (
        <p
          style={{
            fontFamily: 'var(--font-reading)',
            fontSize: 17,
            color: 'var(--color-wood-700)',
          }}
        >
          This shared link could not be read. The link may be incomplete or out
          of date.
        </p>
      )}

      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: '1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent)',
          fontFamily: 'var(--font-reading)',
          fontSize: 11,
          color: 'var(--color-wood-600)',
          letterSpacing: '0.04em',
          lineHeight: 1.6,
        }}
      >
        <p>
          The Hologenetic Profile structure follows the Gene Keys synthesis by
          Richard Rudd. Artwork and interpretation by Adrian Rasmussen.
        </p>
        <p style={{ marginTop: 8 }}>
          Want your own?{' '}
          <Link
            to="/profile"
            style={{ color: 'var(--color-bronze-600)', textDecoration: 'none' }}
          >
            Build your Hologenetic Profile
          </Link>
          .
        </p>
      </footer>
    </main>
  );
};

export default SharedProfile;
