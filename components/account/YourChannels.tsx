import React from 'react';
import { Link } from 'react-router-dom';
import { definedChannels } from '../../lib/astrology/channels';
import type { HologeneticProfile } from '../../lib/astrology/types';
import { CARD_BY_NUMBER } from '../../data/oracleData';

interface Props {
  profile: HologeneticProfile;
}

/**
 * The channels a chart defines, listed by name with both gates, each gate a
 * link to its card. Sits under the profile graph on /profile. A chart that
 * completes no pair says so in one line rather than rendering an empty list.
 */
const YourChannels: React.FC<Props> = ({ profile }) => {
  const defined = definedChannels(profile);

  return (
    <section aria-label="Your channels" className="yc" data-your-channels>
      <p className="yc__eyebrow">Your channels</p>
      {defined.length === 0 ? (
        <p className="yc__empty" data-your-channels-empty>
          Your eleven positions do not complete a channel. Each gate you carry
          finds its other half in someone else.
        </p>
      ) : (
        <ul className="yc__list">
          {defined.map((s) => (
            <li key={s.channel.gates.join('-')} className="yc__row" data-your-channel={s.channel.gates.join('-')}>
              <div className="yc__name">{s.channel.name}</div>
              <div className="yc__gates">
                {s.channel.gates.map((gate) => {
                  const card = CARD_BY_NUMBER.get(gate);
                  return (
                    <Link key={gate} to={`/universal-language/${gate}`} className="yc__gate">
                      Gate {gate}{card ? `, ${card.card_name}` : ''}
                    </Link>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <style>{styles}</style>
    </section>
  );
};

const styles = `
  .yc { margin-top: 48px; }
  .yc__eyebrow {
    font-family: var(--font-brand);
    font-size: 10px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--color-bronze-600);
    margin: 0 0 14px;
  }
  .yc__empty {
    font-family: var(--font-reading);
    font-size: 15px;
    line-height: 1.5;
    color: var(--color-wood-700);
    max-width: 52ch;
    margin: 0;
  }
  .yc__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .yc__row {
    flex: 1 1 260px;
    max-width: 420px;
    padding: 14px 16px;
    background: color-mix(in oklab, var(--color-paper-50) 92%, transparent);
    border: 1px solid color-mix(in oklab, var(--color-wood-600) 18%, transparent);
    border-radius: 3px;
  }
  .yc__name {
    font-family: var(--font-display);
    font-size: 19px;
    line-height: 1.15;
    color: var(--color-wood-900);
  }
  .yc__gates {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 6px;
    font-family: var(--font-ui);
    font-size: 11px;
    letter-spacing: 0.06em;
  }
  /* Each gate is its own row and its own touch target (the global coarse
     pointer rule gives links 44px), so the underline rides the text, not the
     bottom of the box. */
  .yc__gate {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    color: var(--color-bronze-600);
    text-decoration: underline;
    text-decoration-color: color-mix(in oklab, var(--color-bronze-600) 35%, transparent);
    text-underline-offset: 3px;
    transition: text-decoration-color 0.2s;
  }
  .yc__gate:hover { text-decoration-color: var(--color-bronze-600); }
`;

export default YourChannels;
