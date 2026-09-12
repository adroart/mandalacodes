import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../lib/profile/context';
import { useAccount } from '../../lib/account/useAccount';
import { channelStatusFor, type ChannelStatus } from '../../lib/astrology/channels';
import { LAUNCH_FLAGS } from '../../launchFlags';
import SignInTrigger from '../account/SignInTrigger';

interface Props {
  /** The card's Human Design gate (1..64). */
  gate: number;
}

/**
 * The one sentence for a channel, given what the chart holds. `named` is
 * for gates that sit in more than one channel, where each line has to say
 * which channel it is about.
 */
export function channelSentence(s: ChannelStatus, named = false): string {
  const name = s.channel.name;
  switch (s.status) {
    case 'defined':
      return named
        ? `${name}, defined in your chart: you carry gate ${s.gate} and gate ${s.partner}.`
        : `This channel is defined in your chart: you carry gate ${s.gate} and gate ${s.partner}.`;
    case 'gate-only':
      return `${named ? `${name}: you` : 'You'} carry gate ${s.gate}; the channel completes in someone who carries gate ${s.partner}.`;
    case 'partner-only':
      return `${named ? `${name}: you` : 'You'} carry gate ${s.partner}; the channel completes in someone who carries gate ${s.gate}.`;
    default:
      return `${named ? `${name}: neither` : 'Neither'} gate is in your chart.`;
  }
}

const lineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-reading)',
  fontSize: '16px',
  lineHeight: '1.78',
  color: 'var(--d-2)',
  // The prose above stacks with a 15px gap; this line keeps the same rhythm.
  margin: '15px 0 0',
};

const linkStyle: React.CSSProperties = {
  font: 'inherit',
  color: 'var(--accent-d)',
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: 'var(--d-rule)',
  textUnderlineOffset: '4px',
};

/**
 * One plain line under "What completes it" on the card's Human Design panel:
 * whether the reader's chart defines this channel. Signed out, it invites
 * sign-in through the site's own modal; signed in without a chart, it points
 * at the profile form; with a chart, it states what the chart holds. The
 * Integration gates (10, 20, 34, 57) sit in three channels each, so they get
 * one line per channel, each named.
 */
const ChannelStatusLine: React.FC<Props> = ({ gate }) => {
  const { profile } = useProfile();
  const { available, isSignedIn } = useAccount();

  const statuses = useMemo(
    () => (profile ? channelStatusFor(profile.computed, gate) : []),
    [profile, gate],
  );

  if (!LAUNCH_FLAGS.hologeneticProfile || !available) return null;

  if (!isSignedIn) {
    return (
      <p data-channel-status="signed-out" style={lineStyle}>
        <SignInTrigger>
          <button type="button" style={linkStyle}>
            Sign in to see whether this channel is defined in your chart.
          </button>
        </SignInTrigger>
      </p>
    );
  }

  if (!profile) {
    return (
      <p data-channel-status="no-chart" style={lineStyle}>
        <Link to="/profile" style={linkStyle}>
          Enter your birth data to see whether this channel is defined in your chart.
        </Link>
      </p>
    );
  }

  if (statuses.length === 0) return null;

  return (
    <>
      {statuses.map((s) => (
        <p key={s.partner} data-channel-status={s.status} style={lineStyle}>
          {channelSentence(s, statuses.length > 1)}
        </p>
      ))}
    </>
  );
};

export default ChannelStatusLine;
