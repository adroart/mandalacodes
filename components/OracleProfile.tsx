import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../lib/profile/context';
import ProfileForm from './oracle/ProfileForm';
import ProfileGraph from './oracle/ProfileGraph';
import TodayEnergyPanel from './oracle/TodayEnergyPanel';
import YearEnergyPanel from './oracle/YearEnergyPanel';
import { encodeSharedProfile } from '../lib/profile/share';
import { useMetaTags } from '../hooks/useMetaTags';

/**
 * /profile
 *
 * Renders the birth-data form when no profile is saved; the graph + summary
 * when one is. Local-first: works without signing in. Sync to D1 happens
 * silently when accounts are configured AND the user is signed in.
 */
const OracleProfile: React.FC = () => {
  const { profile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  const shareProfile = async () => {
    if (!profile) return;
    const token = encodeSharedProfile(profile.computed, profile.inputs.place.label);
    const url = `${window.location.origin}/profile/shared/${token}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Hologenetic Profile', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2400);
    } catch {
      // User dismissed the share sheet, or clipboard denied; leave state idle.
    }
  };

  useMetaTags({
    title: 'Your Hologenetic Profile · Universal Language',
    description:
      'Enter your birth data once and your eleven positions follow you through every Universal Language reading.',
  });

  const showForm = editing || !profile;

  return (
    <main className="min-h-screen pb-24 px-6 mx-auto pt-[calc(var(--nav-height)+3rem)] sm:pt-[calc(var(--nav-height)+4rem)]" style={{ maxWidth: '1560px' }}>
      <header className="mb-10">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24 }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 36,
              color: 'var(--color-wood-900)',
              margin: 0,
            }}
          >
            Your Hologenetic Profile
          </h1>
          {!showForm && (
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexShrink: 0 }}>
              <button
                type="button"
                onClick={shareProfile}
                style={{
                  fontFamily: "'Lato', Helvetica, sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: shareState === 'copied' ? 'var(--color-wood-600)' : 'var(--color-bronze-600)',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  padding: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {shareState === 'copied' ? 'Link copied' : 'Share'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{
                  fontFamily: "'Lato', Helvetica, sans-serif",
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--color-bronze-600)',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
        {!showForm && (
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 15,
              color: 'var(--color-wood-700)',
              marginTop: 8,
            }}
          >
            {profile!.inputs.date} at {profile!.inputs.time} ·{' '}
            <Link
              to="/atlas?piece=__birth-place__"
              style={{ color: 'var(--color-bronze-600)', textDecoration: 'none' }}
            >
              {profile!.inputs.place.label} — on the Atlas →
            </Link>
          </div>
        )}
        <p
          data-profile-introduction
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 17,
            color: 'var(--color-wood-700)',
            marginTop: 10,
            lineHeight: 1.35,
          }}
        >
          This chart connects the elements of your life to the 64 codes, helping
          you understand their influences more deeply.{' '}
          <a
            href="https://genekeys.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-bronze-600)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Explore the Gene Keys system to learn more →
          </a>
        </p>
      </header>

      {showForm ? (
        <ProfileForm
          initial={profile?.inputs ?? null}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <ProfileGraph profile={profile!.computed} />
        </>
      )}

      {/* The sky right now: today's Sun-transit gate and the year's keynote.
          Rendered in both branches; the panels need no profile. */}
      <section aria-label="The sky right now" style={{ marginTop: 48 }}>
        <p
          style={{
            fontFamily: 'Cinzel, Palatino, serif',
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--color-bronze-600)',
            marginBottom: 14,
          }}
        >
          The sky right now
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <TodayEnergyPanel />
          <YearEnergyPanel />
        </div>
      </section>

      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: '1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent)',
          fontFamily: "'Lato', Helvetica, sans-serif",
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
          Your birth data is stored on this device only. When you sign in, it
          syncs to your account so it follows you across browsers.
        </p>
        <p style={{ marginTop: 8 }}>
          Place data from{' '}
          <a
            href="https://www.geonames.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-bronze-600)', textDecoration: 'none' }}
          >
            GeoNames
          </a>
          , licensed under CC BY 4.0.
        </p>
      </footer>
    </main>
  );
};

export default OracleProfile;
