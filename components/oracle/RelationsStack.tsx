import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import type { OracleRelations } from '../../lib/oracle/types';
import { useProfile } from '../../lib/profile/context';
import { useAccount } from '../../lib/account/useAccount';
import { channelsForGate, channelStatusFor, type ChannelStatus } from '../../lib/astrology/channels';
import { POSITIONS_BY_KEY, POSITION_KEYS } from '../../data/profilePositions';
import type { ProfileKey } from '../../lib/astrology/types';
import { LAUNCH_FLAGS } from '../../launchFlags';
import './relations-stack.css';

interface Props {
  /** The card being read (1..64). */
  code: number;
  /** The card's Human Design gate, the same number on this deck. */
  gate: number;
  /** The compiled RELATIONS section of the card manuscript. */
  relations?: OracleRelations;
  /** The DESIGN section's "What completes it" prose, the channel's teaching. */
  channelProse?: string;
}

/** A row inside the ring bar: one sibling code. */
interface RingMember {
  code: number;
  name: string;
}

/** One bar of the stack: a bond, the kin it names, and what to do with it. */
interface Bar {
  key: string;
  /**
   * The word on the folded bar, in a life's words (Where it goes, What it
   * lacks, Its family, What completes it), never the lineage's. Chosen with
   * the Relations direction of 2026-09-16: each kin is a direction the energy
   * moves in a life, and the label names the road, not the bond.
   */
  label: string;
  /** The kicker on the open bar: the bond spelled out in the lineage's word. */
  bond: string;
  /** The kin's name, the largest line of the open bar. */
  kin: string;
  /** Small line under the name: code and hexagram, or a plain descriptor. */
  detail?: string;
  /** The teaching, split into paragraphs. */
  paras: string[];
  /** The kin card to open, when the kin is a card in the deck. */
  code?: number;
  /** The kin's gate, when the kin is a chart fact. */
  gate?: number;
  /** The channel, when the bar is one. */
  channel?: { partner: number; name: string };
  /** The ring's members, when the bar is the ring. */
  members?: RingMember[];
  /** Which family the bar belongs to. */
  group: 'deck' | 'around';
}

const paras = (s?: string): string[] => (s ?? '').split('\n\n').map((x) => x.trim()).filter(Boolean);
const cardName = (n?: number): string => (n != null ? CARD_BY_NUMBER.get(n)?.card_name ?? `Code ${n}` : '');
const hexName = (n?: number): string => (n != null ? CARD_BY_NUMBER.get(n)?.iching.hexagram_name ?? '' : '');
const detailFor = (n: number): string => (hexName(n) ? `Code ${n} · ${hexName(n)}` : `Code ${n}`);
/** Sky and letter teachings are authored as clauses ("the fixed water that ..."); lead them with their name. */
const lead = (name: string, teaching?: string): string => {
  const t = (teaching ?? '').trim();
  if (!t) return '';
  return `${name}: ${t.charAt(0).toLowerCase() + t.slice(1)}`;
};

/**
 * Build the bars in reading order. Cards that meet the same kin under two
 * bonds (64 pairs with 63 and partners it too) say so once, in one bar, the
 * way the manuscript does.
 */
export function buildBars(code: number, gate: number, relations: OracleRelations | undefined, channelProse: string | undefined): Bar[] {
  const out: Bar[] = [];
  const r = relations;
  const pairNum = r?.pair?.number;
  const inverse = r?.inverse;
  const partnerNum = r?.programming_partner?.number;

  // Pair, with the inverse folded in when it is the same card, and the
  // partner folded in when it is the same card again.
  if (pairNum != null) {
    const sameInverse = inverse && !inverse.is_self_inverse && inverse.number === pairNum;
    const samePartner = partnerNum === pairNum;
    const label = samePartner ? 'Where it goes, what it lacks' : 'Where it goes';
    const bond = [sameInverse ? 'Pair and inverse' : 'Pair', samePartner ? 'partner in the Gene Keys' : ''].filter(Boolean).join(', ');
    const body = [r?.pair?.teaching, samePartner ? r?.programming_partner?.teaching : ''].filter((t) => t && t.trim());
    out.push({ key: 'pair', label, bond, kin: cardName(pairNum), detail: detailFor(pairNum), paras: body.flatMap(paras), code: pairNum, gate: pairNum, group: 'deck' });
  }

  // The inverse gets its own bar when it differs from the pair, and a
  // reflection bar when the card is its own inverse.
  if (inverse) {
    if (inverse.is_self_inverse) {
      out.push({ key: 'inverse', label: 'No other side', bond: 'Inverse, its own reflection', kin: 'Itself, turned over', detail: 'One of eight codes that meet their own reflection', paras: paras(inverse.teaching), group: 'deck' });
    } else if (inverse.number !== pairNum) {
      out.push({ key: 'inverse', label: 'The other side', bond: 'Inverse', kin: cardName(inverse.number), detail: detailFor(inverse.number), paras: paras(inverse.teaching), code: inverse.number, gate: inverse.number, group: 'deck' });
    }
  }

  if (partnerNum != null && partnerNum !== pairNum) {
    out.push({ key: 'partner', label: 'What it lacks', bond: 'Partner in the Gene Keys', kin: cardName(partnerNum), detail: detailFor(partnerNum), paras: paras(r?.programming_partner?.teaching), code: partnerNum, gate: partnerNum, group: 'deck' });
  }

  // The Human Design channel: the gate's partner gate is a card on this deck.
  // Integration gates sit in three channels, so they get three bars.
  const channels = channelsForGate(gate);
  channels.forEach((ch) => {
    const partner = ch.gates[0] === gate ? ch.gates[1] : ch.gates[0];
    out.push({
      key: channels.length > 1 ? `channel-${partner}` : 'channel',
      label: 'What completes it',
      bond: ch.name,
      kin: cardName(partner),
      detail: detailFor(partner),
      paras: paras(channelProse),
      code: partner,
      gate: partner,
      channel: { partner, name: ch.name },
      group: 'deck',
    });
  });

  if (r?.codon_ring) {
    const members = (r.codon_ring.siblings ?? []).filter((n) => n !== code).map((n) => ({ code: n, name: cardName(n) }));
    out.push({ key: 'ring', label: 'Its family', bond: 'Codon ring', kin: r.codon_ring.name, detail: `${members.length + 1} codes, one family`, paras: paras(r.codon_ring.teaching), members, group: 'deck' });
  }

  if (r?.tarot?.teaching) {
    out.push({ key: 'tarot', label: 'Tarot', bond: 'Tarot', kin: r.tarot.card ?? r.codon_ring?.tarot ?? 'The arcana', detail: 'The ring’s arcana, and the two trigrams’', paras: paras(r.tarot.teaching), group: 'around' });
  }

  if (r?.immortals?.teaching) {
    const im = r.immortals;
    const kin = im.same_trigram ? im.upper.name : `${im.upper.name}, ${im.lower.name}`;
    out.push({ key: 'immortals', label: 'Immortals', bond: 'Immortals', kin, detail: im.same_trigram ? 'Above and below, the same' : 'Above, and below', paras: paras(im.teaching), group: 'around' });
  }

  if (r?.sky?.value || r?.hebrew_letter?.letter) {
    const names = [r?.sky?.value, r?.hebrew_letter?.letter].filter(Boolean);
    const body = [lead(r?.sky?.value ?? '', r?.sky?.teaching), lead(r?.hebrew_letter?.letter ?? '', r?.hebrew_letter?.teaching)].filter(Boolean);
    out.push({ key: 'deeper', label: 'Deeper', bond: 'Deeper correlation', kin: names.join(', and '), detail: 'Sky, and letter', paras: body, group: 'around' });
  }

  return out;
}

/** The short chart word for one gate: which positions carry it. */
function chartWordFor(matches: ProfileKey[]): string {
  if (matches.length === 0) return 'Not in profile';
  if (matches.length === 1) return `In your profile, your ${POSITIONS_BY_KEY[matches[0]].label}`;
  return `In your profile, ${matches.length} times`;
}

function channelWord(s: ChannelStatus | undefined, gate: number): string {
  if (!s) return '';
  switch (s.status) {
    case 'defined': return `Defined in your profile: you carry gate ${gate} and gate ${s.partner}`;
    case 'gate-only': return `You carry gate ${gate}; gate ${s.partner} completes it`;
    case 'partner-only': return `You carry gate ${s.partner}; gate ${gate} completes it`;
    default: return 'Neither gate in your profile';
  }
}

/** The folded bar has room for a few words: keep the verdict, drop the where. */
function shortLine(line: string): string {
  if (line.startsWith('Defined')) return 'Defined in your profile';
  if (line.startsWith('In your profile')) return 'In your profile';
  if (line.startsWith('You carry')) return line.split(';')[0];
  if (line.startsWith('Neither')) return 'Not in profile';
  return line;
}

/**
 * The Relations panel's body: the card's kin as a stack of bars in two
 * families. "In the deck" holds the kin that are cards (pair, inverse,
 * partner, the channel's other gate, the codon ring); "Gathered around it"
 * holds the lore (tarot, immortals, sky and letter). One bar is open at a
 * time; the rest fold to a line that still names the kin and, for a reader
 * with a chart, says whether the chart carries it. Every kin card links to
 * its own page.
 */
const RelationsStack: React.FC<Props> = ({ code, gate, relations, channelProse }) => {
  const { profile } = useProfile();
  const { available } = useAccount();
  const chartOn = LAUNCH_FLAGS.hologeneticProfile && available;
  const hasChart = chartOn && !!profile;

  const bars = useMemo(() => buildBars(code, gate, relations, channelProse), [code, gate, relations, channelProse]);
  // Null until the reader chooses, and null means the first bar. The
  // relations arrive a beat after the channel table, so the bars grow after
  // mount and a choice fixed at mount would pin the wrong one.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openIdx = Math.max(0, bars.findIndex((b) => b.key === openKey));

  // Which positions of the chart carry each gate. Empty when there is no chart.
  const positionsByGate = useMemo(() => {
    const map = new Map<number, ProfileKey[]>();
    if (!hasChart || !profile) return map;
    for (const key of POSITION_KEYS) {
      const gl = profile.computed[key];
      if (!gl) continue;
      const list = map.get(gl.gate) ?? [];
      list.push(key);
      map.set(gl.gate, list);
    }
    return map;
  }, [hasChart, profile]);
  const channelStatuses = useMemo(
    () => (hasChart && profile ? channelStatusFor(profile.computed, gate) : []),
    [hasChart, profile, gate],
  );

  const inChart = (g?: number): boolean => g != null && (positionsByGate.get(g)?.length ?? 0) > 0;
  const chartLine = (b: Bar): string => {
    if (!hasChart) return '';
    if (b.channel) return channelWord(channelStatuses.find((s) => s.partner === b.channel!.partner), gate);
    if (b.members) {
      const n = b.members.filter((m) => inChart(m.code)).length + (inChart(code) ? 1 : 0);
      return `${n} of ${b.members.length + 1} in your profile`;
    }
    if (b.gate != null) return chartWordFor(positionsByGate.get(b.gate) ?? []);
    return '';
  };
  const lit = (b: Bar): boolean => {
    if (!hasChart) return false;
    if (b.channel) return channelStatuses.find((s) => s.partner === b.channel!.partner)?.status === 'defined';
    if (b.members) return b.members.some((m) => inChart(m.code));
    return inChart(b.gate);
  };

  // The header count: every kin gate in the deck family, once each.
  const deckGates = Array.from(new Set(bars.flatMap((b) => (b.members ? b.members.map((m) => m.code) : b.gate != null ? [b.gate] : []))));
  const carried = deckGates.filter((g) => inChart(g)).length;

  if (bars.length === 0) return null;
  const deckBars = bars.filter((b) => b.group === 'deck');
  const aroundBars = bars.filter((b) => b.group === 'around');

  const renderBar = (b: Bar) => {
    const i = bars.indexOf(b);
    const open = i === openIdx;
    const next = bars[i + 1];
    const line = chartLine(b);
    if (!open) {
      return (
        <button
          key={b.key}
          type="button"
          className={`ul-rs-bar${lit(b) ? ' is-lit' : ''}`}
          data-bar={b.key}
          data-open="false"
          onClick={() => setOpenKey(b.key)}
        >
          <span className="ul-rs-bar__text">
            <span className="ul-rs-bar__label">{b.label}</span>
            <span className="ul-rs-bar__kin">{b.kin}</span>
          </span>
          {line ? <span className={`ul-rs-bar__chart${lit(b) ? ' is-lit' : ''}`}>{shortLine(line)}</span> : null}
        </button>
      );
    }
    return (
      <div key={b.key} className={`ul-rs-open${lit(b) ? ' is-lit' : ''}`} data-bar={b.key} data-open="true">
        <p className="ul-rs-open__bond">{b.bond} · {i + 1} of {bars.length}</p>
        <p className="ul-rs-open__kin">
          {b.code != null ? <Link to={`/universal-language/${b.code}`}>{b.kin}</Link> : b.kin}
        </p>
        {b.detail ? <p className="ul-rs-open__detail">{b.detail}</p> : null}
        {line ? <p className={`ul-rs-open__chart${lit(b) ? ' is-lit' : ''}`} data-chart-line>{line}</p> : null}
        {b.paras.map((p, k) => (
          <p key={k} className="ul-rs-open__para">{p}</p>
        ))}
        {b.members ? (
          <div className="ul-rs-members">
            {b.members.map((m) => {
              const on = inChart(m.code);
              return (
                <Link key={m.code} to={`/universal-language/${m.code}`} className={`ul-rs-member${on ? ' is-lit' : ''}`} data-member={m.code}>
                  <span className="ul-rs-member__text">
                    <span className="ul-rs-member__name">{m.name}</span>
                    <span className="ul-rs-member__code">Code {m.code}</span>
                  </span>
                  {hasChart ? <span className={`ul-rs-member__chart${on ? ' is-lit' : ''}`}>{on ? 'In your profile' : 'Not in profile'}</span> : null}
                  <span className="ul-rs-member__open">Open</span>
                </Link>
              );
            })}
          </div>
        ) : null}
        <div className="ul-rs-actions">
          {b.code != null ? (
            <Link to={`/universal-language/${b.code}`} className="ul-rs-btn is-primary">Open the card</Link>
          ) : b.group === 'around' ? (
            <Link to="/the-systems" className="ul-rs-btn is-primary">The traditions</Link>
          ) : null}
          {next ? (
            <button type="button" className="ul-rs-btn" onClick={() => setOpenKey(next.key)} data-next>
              Next: {next.label}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const chartLink = !chartOn ? null : hasChart
    ? <Link to="/profile" className="ul-rs-group__link" data-chart-summary>{carried} of {deckGates.length} in your profile</Link>
    : <Link to="/profile" className="ul-rs-group__link" data-chart-summary>Add your profile</Link>;

  return (
    <div className="ul-rs" data-relations-stack>
      <div className="ul-rs-group__head">
        <p className="ul-rs-group__label">In the deck</p>
        {chartLink}
      </div>
      <div className="ul-rs-stack">{deckBars.map(renderBar)}</div>
      {aroundBars.length ? (
        <>
          <div className="ul-rs-group__head">
            <p className="ul-rs-group__label">Gathered around it</p>
            <Link to="/the-systems" className="ul-rs-group__link">The traditions</Link>
          </div>
          <div className="ul-rs-stack">{aroundBars.map(renderBar)}</div>
        </>
      ) : null}
    </div>
  );
};

export default RelationsStack;
