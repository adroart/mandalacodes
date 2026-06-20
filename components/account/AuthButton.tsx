import React from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';

/**
 * The single account door in the site header. A plain text "Account" word — no
 * icon, no dropdown, no modal. It always navigates to /account, which is a
 * whole page: signed out it shows the sign-in form embedded inside the account
 * framing; signed in it shows the person's space (chart, pieces, collections).
 * Renders nothing when accounts are off.
 */
const AuthButton: React.FC = () => {
  const { available } = useAccount();

  if (!available) return null;

  return (
    <Link
      to="/account"
      className="font-label text-[12px] uppercase tracking-[0.18em] font-semibold text-wood-700 hover:text-bronze-600 transition-colors px-2 py-2"
    >
      Account
    </Link>
  );
};

export default AuthButton;
