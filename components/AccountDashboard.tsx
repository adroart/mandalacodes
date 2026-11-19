import React from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from './account/AccountLayout';
import { useAccount } from '../lib/account/useAccount';

const AccountDashboard: React.FC = () => {
  const { email } = useAccount();

  return (
    <AccountLayout title="Your account">
      {email && (
        <p className="font-reading text-ink-soft mb-8">
          Signed in as <span className="text-ink">{email}</span>.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <Link
          to="/profile"
          className="block p-6 border border-line rounded hover:border-bronze-500/60 transition-colors"
        >
          <div className="font-label text-label uppercase tracking-[0.28em] text-accent mb-3">
            Hologenetic Profile
          </div>
          <div className="font-display text-card-title text-ink mb-1">
            Your birth chart
          </div>
          <p className="font-reading text-caption text-ink-soft">
            Enter your birth data once and your eleven positions follow you
            through every reading.
          </p>
        </Link>

        <Link
          to="/account/pieces"
          className="block p-6 border border-line rounded hover:border-bronze-500/60 transition-colors"
        >
          <div className="font-label text-label uppercase tracking-[0.28em] text-accent mb-3">
            Your pieces
          </div>
          <div className="font-display text-card-title text-ink mb-1">
            The artwork you hold
          </div>
          <p className="font-reading text-caption text-ink-soft">
            See where each piece rests, its inscribed intention, and its reading.
          </p>
        </Link>

        <Link
          to="/account/collections"
          className="block p-6 border border-line rounded hover:border-bronze-500/60 transition-colors"
        >
          <div className="font-label text-label uppercase tracking-[0.28em] text-accent mb-3">
            Collections
          </div>
          <div className="font-display text-card-title text-ink mb-1">
            Saved cards
          </div>
          <p className="font-reading text-caption text-ink-soft">
            Gather cards into named groupings.
          </p>
        </Link>
      </div>
    </AccountLayout>
  );
};

export default AccountDashboard;
