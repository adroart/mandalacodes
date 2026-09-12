import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../lib/profile/context';
import { useAccount } from '../../lib/account/useAccount';
import { channelStatusFor, channelsForGate, type ChannelStatus } from '../../lib/astrology/channels';
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
 * Under "What completes it" on the card's Human Design panel: a plain link to
 * the partner card for every reader (the prose names the partner gate once
 * and the UI carries the rest), then one line saying whether the reader's
 * chart defines this channel. Signed out, that line invites
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

  const channels = channelsForGate(gate);
  if (channels.length === 0) return null;

  const partnerLinks = (
    <p data-channel-partners style={lineStyle}>
      {channels.map((c, i) => {
        const partner = c.gates[0] === gate ? c.gates[1] : c.gates[0];
        return (
          <React.Fragment key={partner}>
            {i > 0 ? ' ' : ''}
            <Link to={`/universal-language/${partner}`} style={linkStyle} data-channel-partner-link={partner}>
              Read gate {partner} →
            </Link>
          </React.Fragment>
        );
      })}
    </p>
  );

  let status: React.ReactNode = null;
  if (LAUNCH_FLAGS.hologeneticProfile && available) {
    if (!isSignedIn) {
      status = (
        <p data-channel-status="signed-out" style={lineStyle}>
          <SignInTrigger>
            <button type="button" style={linkStyle}>
              Sign in to see whether this channel is defined in your chart.
            </button>
          </SignInTrigger>
        </p>
      );
    } else if (!profile) {
      status = (
        <p data-channel-status="no-chart" style={lineStyle}>
          <Link to="/profile" style={linkStyle}>
            Enter your birth data to see whether this channel is defined in your chart.
          </Link>
        </p>
      );
    } else {
      status = statuses.map((s) => (
        <p key={s.partner} data-channel-status={s.status} style={lineStyle}>
          {channelSentence(s, statuses.length > 1)}
        </p>
      ));
    }
  }

  return (
    <>
      {partnerLinks}
      {status}
    </>
  );
};

export default ChannelStatusLine;
