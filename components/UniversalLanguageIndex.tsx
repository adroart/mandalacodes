
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CODON_RINGS, ALL_CARDS, CARD_BY_NUMBER, type OracleCard } from '../data/oracleData';
import { ulCardImageUrl } from '../utils/universalLanguage';
import { HexagramSVG } from './oracle/HexagramGlyph';
import Constellation from './oracle/Constellation';
import { loadOracleIndex, rank, type SearchDoc } from '../lib/oracle/search';
import { useProfile } from '../lib/profile/context';
import { useJournal, relTime } from '../lib/oracle/journal';
import { elementForCard, tintForCard, ELEMENTS, ELEMENT_DOT, type Element } from '../lib/oracle/elements';

/* ─── The Oracle Table ───────────────────────────────────────────────────────
 * A two-pane reading room: a sticky ritual rail (title, invocation, Card of the
 * Day / Year, your astrology grid, learn-the-systems) beside the deck pane
 * (search, view tabs, element filters, the faithful I Ching flip wall, Artwork,
 * By Ring, and a Map constellation). Overlays: Your Grid, Systems, Reading,
 * Journal, Onboarding.
 *
 * Palette, fonts, hexagram renderer, card data, the deterministic Card-of-Day /
 * Year, and the Hologenetic Profile all come from the existing codebase — this
 * file recomposes them into the redesigned shape. */

type View = 'iching' | 'artwork' | 'rings' | 'map';

const cardImageUrl = ulCardImageUrl;

/* ─── Featured card-of helpers (deterministic, same as before) ─────────────── */

function hashTo64(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 64) + 1;
}
function cardForToday(now = new Date()): OracleCard {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return CARD_BY_NUMBER.get(hashTo64(`day:${y}-${m}-${d}`))!;
}
function cardForYear(now = new Date()): OracleCard {
  return CARD_BY_NUMBER.get(hashTo64(`year:${now.getFullYear()}`))!;
}

/* ─── Small shared pieces ────────────────────────────────────────────────── */

const CardHex: React.FC<{ card: OracleCard; width: number; color?: string }> = ({ card, width, color }) => (
  <HexagramSVG
    upper={card.iching.upper_trigram.symbol}
    lower={card.iching.lower_trigram.symbol}
    width={width}
    color={color}
    className="block"
  />
);

/* Element-tinted artwork panel (uses the real Cloudinary image, tint as the
 * loading/fallback ground so the panel always reads as its element). */
const ArtPanel: React.FC<{ card: OracleCard; rounded?: boolean; className?: string }> = ({
  card,
  className = '',
}) => {
  const [lo, hi] = tintForCard(card.number);
  return (
    <span
      className={`relative block w-full h-full overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${lo}, ${hi})` }}
    >
      <img
        src={cardImageUrl(card.number, 400)}
        alt={`${card.card_name}, Universal Language ${card.number}`}
        className="absolute inset-0 w-full h-full object-cover block"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
};

/* ─── Rail: featured tile (Card of the Day / Year) ───────────────────────────
 * A compact row: a tiny label, the small square painting, and a tiny hexagram
 * that links to the reading. No name shown — tap to go see what it is. */

const FeatTile: React.FC<{ eyebrow: string; date: string; card: OracleCard; onRead: () => void }> = ({
  eyebrow,
  date,
  card,
  onRead,
}) => (
  <button
    type="button"
    onClick={onRead}
    aria-label={`See the ${eyebrow} card`}
    className="group flex items-center gap-2.5 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
  >
    <span className="relative block w-12 h-12 flex-shrink-0 overflow-hidden">
      <ArtPanel card={card} />
    </span>
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="font-label text-[9px] font-bold uppercase tracking-[0.16em] text-bronze-600 truncate">
        {eyebrow} <span aria-hidden className="text-wood-300">·</span> <span className="text-wood-500">{date}</span>
      </span>
      <span className="flex items-center gap-1.5 text-wood-700 group-hover:text-bronze-600 transition-colors">
        <CardHex card={card} width={16} />
        <span className="font-label text-[10px] font-semibold uppercase tracking-[0.12em]">See it →</span>
      </span>
    </span>
  </button>
);

/* ─── Rail: the astrology grid module (wired to the real profile) ────────────
 * When a Hologenetic Profile is set, the rail shows the four Activation codes
 * and "View my grid". When not, it prompts the visitor to link their birth
 * moment — which opens the real /profile form (no fake hash codes). */

const ACTIVATION: Array<{ key: 'lifesWork' | 'evolution' | 'radiance' | 'purpose'; label: string }> = [
  { key: 'lifesWork', label: "Life's Work" },
  { key: 'evolution', label: 'Evolution' },
  { key: 'radiance', label: 'Radiance' },
  { key: 'purpose', label: 'Purpose' },
];

const AstrologyGrid: React.FC<{ onViewGrid: () => void; hasProfile: boolean; placeLabel?: string }> = ({
  onViewGrid,
  hasProfile,
  placeLabel,
}) => (
  <div className="border border-wood-300 bg-paper-100/40 px-4 pt-4 pb-[18px]">
    <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-wood-700 m-0">
      Your Astrology Grid
    </p>
    <p className="font-sans text-[12.5px] text-wood-600 leading-[1.5] mt-1.5 mb-3.5">
      Your exact birth moment links you to four codes. Time and place sharpen the reading.
    </p>
    {hasProfile ? (
      <button
        type="button"
        onClick={onViewGrid}
        className="flex items-center justify-center gap-2.5 w-full py-3 bg-wood-900 text-paper-50 font-label text-[11px] font-bold uppercase tracking-[0.18em] transition-colors hover:bg-bronze-600"
      >
        View my grid →
      </button>
    ) : (
      <Link
        to="/profile"
        className="flex items-center justify-center gap-2.5 w-full py-3 bg-wood-900 text-paper-50 font-label text-[11px] font-bold uppercase tracking-[0.18em] transition-colors hover:bg-bronze-600 no-underline"
      >
        Link your birth moment →
      </Link>
    )}
    {hasProfile && placeLabel && (
      <p className="font-label text-[9.5px] font-semibold tracking-[0.04em] text-bronze-600 flex items-center gap-1.5 mt-2.5 mb-0">
        <span aria-hidden>✓</span> Your codes are linked
      </p>
    )}
  </div>
);

/* ─── Deck: I Ching flip tile ────────────────────────────────────────────── */

const FlipTile: React.FC<{
  card: OracleCard;
  flipped: boolean;
  onFlip: () => void;
  onBack: () => void;
  onRead: () => void;
}> = ({ card, flipped, onFlip, onBack, onRead }) => {
  const el = elementForCard(card.number);
  const [lo, hi] = tintForCard(card.number);
  return (
    <div className={`relative [perspective:900px] ${flipped ? 'z-10' : ''}`} style={{ aspectRatio: '1 / 1' }}>
      <div
        className="absolute inset-0 [transform-style:preserve-3d] transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        {/* BACK — hexagram on bare paper */}
        <button
          type="button"
          onClick={onFlip}
          aria-label={`Reveal Card ${card.number}: ${card.iching.hexagram_name}`}
          className="absolute inset-0 [backface-visibility:hidden] flex flex-col items-center justify-center gap-1.5 bg-transparent cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
          style={{ opacity: flipped ? 0 : 1, transition: 'opacity .01s linear .28s' }}
        >
          <span className="leading-none text-wood-800">
            <CardHex card={card} width={46} />
          </span>
          <span className="font-label text-[13px] font-bold text-wood-500 tracking-[0.1em] leading-none">
            {String(card.number).padStart(2, '0')}
          </span>
        </button>

        {/* FRONT — artwork + Back · Read strip beneath */}
        <div
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col overflow-hidden shadow-[0_1px_3px_rgba(38,35,33,0.12)]"
          style={{ opacity: flipped ? 1 : 0, transition: 'opacity .01s linear .28s' }}
        >
          <button
            type="button"
            onClick={onRead}
            aria-label={`Read ${card.card_name}, Card ${card.number}`}
            className="relative flex-1 block min-h-0 overflow-hidden cursor-pointer focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
            style={{ background: `linear-gradient(150deg, ${lo}, ${hi})` }}
          >
            {/* the square painting, peeking through softly behind the colors */}
            <img
              src={cardImageUrl(card.number, 400)}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover block opacity-20"
              loading="lazy"
              decoding="async"
            />
            <span className="relative flex flex-col items-center justify-center gap-1 text-center h-full p-2">
              <span className="font-label text-[7.5px] font-semibold uppercase tracking-[0.16em] text-paper-50/70">
                Universal Language
              </span>
              <span className="font-serif font-medium leading-[1.12] text-paper-50 [text-wrap:balance] text-[clamp(15px,2.4vw,19px)]">
                {card.card_name}
              </span>
              <span className="font-label text-[7.5px] font-semibold uppercase tracking-[0.14em] text-paper-50/55 mt-0.5">
                {el}
              </span>
            </span>
          </button>
          <div className="h-[38px] flex-shrink-0 flex items-stretch bg-paper-100">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 flex items-center justify-center font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-wood-700 hover:text-wood-900 transition-colors cursor-pointer"
            >
              Back
            </button>
            <span aria-hidden className="w-px self-center h-[11px] bg-wood-400" />
            <button
              type="button"
              onClick={onRead}
              className="flex-1 flex items-center justify-center font-label text-[10px] font-bold uppercase tracking-[0.16em] text-bronze-700 hover:text-wood-900 transition-colors cursor-pointer"
            >
              Read
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Deck: artwork flat tile ────────────────────────────────────────────── */

const FlatTile: React.FC<{ card: OracleCard; onRead: () => void }> = ({ card, onRead }) => {
  return (
    <button
      type="button"
      onClick={onRead}
      aria-label={`Read ${card.card_name}, Card ${card.number}`}
      className="relative block w-full overflow-hidden transition-transform duration-200 hover:-translate-y-[3px] hover:shadow-[0_8px_20px_rgba(38,35,33,0.2)] focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px]"
      style={{ aspectRatio: '1 / 1' }}
    >
      {/* small card = the square painting only, no name overlay */}
      <ArtPanel card={card} />
    </button>
  );
};

/* ─── Deck: By Ring card ─────────────────────────────────────────────────── */

const RingCard: React.FC<{ card: OracleCard; onRead: () => void }> = ({ card, onRead }) => (
  <button type="button" onClick={onRead} className="flex flex-col text-left bg-transparent border-none p-0 cursor-pointer group">
    <span className="relative w-full overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
      <ArtPanel card={card} className="transition-transform duration-500 group-hover:scale-105" />
    </span>
    <span className="flex items-baseline gap-1.5 mt-2.5">
      <span className="font-label text-[10px] font-bold tracking-[0.08em] text-bronze-700">
        {String(card.number).padStart(2, '0')}
      </span>
      <span className="font-serif text-[17px] leading-[1.05] text-wood-900 group-hover:text-bronze-700 transition-colors">
        {card.card_name}
      </span>
    </span>
    <span className="font-sans text-xs text-wood-500 mt-0.5">{card.iching.hexagram_name}</span>
    <span className="font-label text-[9.5px] uppercase tracking-[0.06em] text-wood-400 mt-1.5">
      {card.gene_keys.shadow} · {card.gene_keys.gift} · {card.gene_keys.siddhi}
    </span>
  </button>
);

/* ─── Overlay shell ──────────────────────────────────────────────────────── */

const Overlay: React.FC<{ onClose: () => void; width: string; children: React.ReactNode }> = ({
  onClose,
  width,
  children,
}) => (
  <div
    onClick={onClose}
    className="fixed inset-0 z-[80] flex items-center justify-center p-6 overflow-auto bg-[rgba(30,26,22,0.55)] [backdrop-filter:blur(5px)]"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-paper-50 shadow-[0_24px_60px_rgba(30,26,22,0.4)] cursor-default"
      style={{ width }}
    >
      {children}
    </div>
  </div>
);

/* ─── Main component ─────────────────────────────────────────────────────── */

const UniversalLanguageIndex: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { entries: journal, record: recordJournal, clear: clearJournal } = useJournal();

  const [view, setView] = useState<View>('iching');
  const [query, setQuery] = useState('');
  const [elFilter, setElFilter] = useState<Element | 'All'>('All');
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  const [reading, setReading] = useState<OracleCard | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [toast, setToast] = useState('');

  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => cardForToday(now), [now]);
  const year = useMemo(() => cardForYear(now), [now]);

  /* The visitor's four Activation codes, from the real Hologenetic Profile. */
  const grid = useMemo(() => {
    if (!profile) return null;
    return ACTIVATION.map(({ key, label }) => {
      const gl = profile.computed[key];
      const card = CARD_BY_NUMBER.get(gl.gate);
      return card ? { label, card } : null;
    }).filter((x): x is { label: string; card: OracleCard } => Boolean(x));
  }, [profile]);

  const gridNums = useMemo(() => (grid ? new Set(grid.map((g) => g.card.number)) : null), [grid]);
  const gridLabelByNumber = useMemo(() => {
    const m = new Map<number, string>();
    grid?.forEach((g) => { if (!m.has(g.card.number)) m.set(g.card.number, g.label); });
    return m;
  }, [grid]);

  /* ── Search index (lazy, meaning-aware; substring fallback) ─────────────── */
  const [searchDocs, setSearchDocs] = useState<SearchDoc[] | null>(null);
  useEffect(() => {
    let live = true;
    loadOracleIndex().then((d) => { if (live) setSearchDocs(d); }).catch(() => {});
    return () => { live = false; };
  }, []);

  /* ── First-run onboarding + keyboard + deep link ────────────────────────── */
  useEffect(() => {
    try {
      if (!localStorage.getItem('ul-onboarded')) setOnboarding(true);
    } catch {}
    try {
      const cn = parseInt(new URLSearchParams(location.search).get('card') || '', 10);
      if (cn >= 1 && cn <= 64) {
        const c = CARD_BY_NUMBER.get(cn);
        if (c) { setReading(c); setOnboarding(false); }
      }
    } catch {}
  }, []);

  const finishOnboarding = useCallback(() => {
    try { localStorage.setItem('ul-onboarded', '1'); } catch {}
    setOnboarding(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || '';
      if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(tag)) {
        const el = document.getElementById('ul-search');
        if (el) { e.preventDefault(); (el as HTMLInputElement).focus(); }
      } else if (e.key === 'Escape') {
        if (reading) setReading(null);
        else if (gridOpen) setGridOpen(false);
        else if (systemsOpen) setSystemsOpen(false);
        else if (journalOpen) setJournalOpen(false);
        else if (onboarding) finishOnboarding();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reading, gridOpen, systemsOpen, journalOpen, onboarding, finishOnboarding]);

  /* ── Ranked search ──────────────────────────────────────────────────────── */
  const rankedNumbers = useMemo<number[] | null>(() => {
    const q = query.trim();
    if (!q) return null;
    if (/^\d{1,2}$/.test(q)) {
      const n = Number(q);
      return n >= 1 && n <= 64 ? [n] : [];
    }
    if (!searchDocs) return null;
    return rank(searchDocs, q, { limit: 64 }).map((h) => h.number);
  }, [query, searchDocs]);

  const matchCard = useCallback((c: OracleCard, q: string): boolean => {
    const lq = q.toLowerCase();
    return (
      c.card_name.toLowerCase().includes(lq) ||
      c.iching.hexagram_name.toLowerCase().includes(lq) ||
      c.gene_keys.shadow.toLowerCase().includes(lq) ||
      c.gene_keys.gift.toLowerCase().includes(lq) ||
      c.gene_keys.siddhi.toLowerCase().includes(lq) ||
      c.element.toLowerCase().includes(lq) ||
      c.ring_name.toLowerCase().includes(lq) ||
      String(c.number) === lq.trim()
    );
  }, []);

  const elOk = useCallback((c: OracleCard) => elFilter === 'All' || elementForCard(c.number) === elFilter, [elFilter]);

  const filtered = useMemo(() => {
    const q = query.trim();
    let base: OracleCard[];
    if (!q) base = ALL_CARDS;
    else if (rankedNumbers)
      base = rankedNumbers.map((n) => CARD_BY_NUMBER.get(n)).filter((c): c is OracleCard => Boolean(c));
    else base = ALL_CARDS.filter((c) => matchCard(c, q));
    return base.filter(elOk);
  }, [query, rankedNumbers, matchCard, elOk]);

  const ringSections = useMemo(() => {
    const q = query.trim();
    const keep = rankedNumbers ? new Set(rankedNumbers) : null;
    return CODON_RINGS.map((ring) => ({
      ring,
      cards: ring.cards.filter(
        (c) => elOk(c) && (!q || (keep ? keep.has(c.number) : matchCard(c, q))),
      ),
    })).filter((r) => r.cards.length > 0);
  }, [query, rankedNumbers, matchCard, elOk]);

  /* ── Actions ────────────────────────────────────────────────────────────── */
  const openReading = useCallback((c: OracleCard) => {
    recordJournal(c.number, c.card_name);
    setReading(c);
    setGridOpen(false);
  }, [recordJournal]);

  const goCardPage = useCallback((c: OracleCard) => {
    navigate(`/universal-language/${c.number}`, { state: { ritual: true } });
  }, [navigate]);

  const drawRandom = useCallback(() => {
    const c = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
    openReading(c);
  }, [openReading]);

  const flip = (n: number) => setFlipped((p) => new Set([...p, n]));
  const flipBack = (n: number) => setFlipped((p) => { const x = new Set(p); x.delete(n); return x; });

  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const copyText = useCallback((str: string) => {
    try {
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(str); showToast('Copied to clipboard'); return; }
    } catch {}
    showToast('Could not copy');
  }, [showToast]);

  const shareCard = useCallback((c: OracleCard) => {
    const url = location.origin + location.pathname + '?card=' + c.number;
    const text = `${c.card_name} — Universal Language ${String(c.number).padStart(2, '0')} · ${c.iching.hexagram_name}`;
    if (navigator.share) navigator.share({ title: c.card_name, text, url }).catch(() => {});
    else copyText(text + '\n' + url);
  }, [copyText]);

  /* ── Derived display values ─────────────────────────────────────────────── */
  const elFiltered = query.trim() || elFilter !== 'All';
  const matchSet = useMemo(() => (elFiltered ? new Set(filtered.map((c) => c.number)) : null), [elFiltered, filtered]);
  const total = view === 'rings' ? ringSections.reduce((n, r) => n + r.cards.length, 0) : filtered.length;

  const instruction =
    query.trim() || elFilter !== 'All'
      ? `${total} ${total === 1 ? 'card' : 'cards'} shown`
      : view === 'iching'
        ? 'Tap a hexagram to reveal its card · Read to enter'
        : view === 'artwork'
          ? 'Tap any card to enter'
          : view === 'map'
            ? 'The codon rings as a constellation · tap a star to read it'
            : 'The sixty-four, gathered into their codon rings';

  const showEmpty =
    view !== 'map' &&
    (view === 'rings' ? ringSections.length === 0 : filtered.length === 0) &&
    (!!query.trim() || elFilter !== 'All');

  const viewTabs: Array<{ label: string; v: View }> = [
    { label: 'I Ching', v: 'iching' },
    { label: 'Artwork', v: 'artwork' },
    { label: 'By Ring', v: 'rings' },
    { label: 'Map', v: 'map' },
  ];

  const tabBase =
    'font-label text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 h-[32px] border transition-colors cursor-pointer whitespace-nowrap -ml-px focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2';
  const tabActive = 'bg-wood-900 text-paper-50 border-wood-900 relative z-10';
  const tabIdle = 'bg-transparent text-wood-700 border-wood-300 hover:text-wood-900 hover:border-wood-700';

  const chipBase =
    'font-label text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-[4px] border transition-colors cursor-pointer inline-flex items-center gap-1 leading-none focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2';

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="sticky top-[var(--nav-height)] z-40 bg-paper-50/95 [backdrop-filter:blur(8px)] border-b border-wood-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[58px] flex items-center justify-between gap-2 sm:gap-4">
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2.5 font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 min-w-0">
            <Link to="/" className="text-wood-500 hover:text-wood-900 transition-colors">Mandala Codes</Link>
            <span aria-hidden>/</span>
            <span className="text-wood-900 font-semibold whitespace-nowrap">Universal Language</span>
          </nav>
          {/* On narrow screens the global nav already names the page; drop the
              breadcrumb entirely so the action cluster never collides with it.
              A spacer keeps the actions right-aligned. */}
          <span aria-hidden className="md:hidden flex-1" />
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            <button
              type="button"
              onClick={() => setJournalOpen(true)}
              className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-wood-700 hover:text-bronze-600 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              Journal
              {journal.length > 0 && (
                <span className="text-[9px] font-bold text-paper-50 bg-bronze-600 rounded-[9px] min-w-[16px] h-4 inline-flex items-center justify-center px-1">
                  {journal.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSystemsOpen(true)}
              className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-wood-700 hover:text-bronze-600 transition-colors whitespace-nowrap hidden sm:inline"
            >
              The Systems
            </button>
            <button
              type="button"
              onClick={() => setOnboarding(true)}
              aria-label="How to read a card"
              title="How to read a card"
              className="font-label text-xs font-bold w-[26px] h-[26px] rounded-full text-wood-600 border border-wood-300 hover:bg-paper-100 hover:border-bronze-600 transition-colors flex-shrink-0"
            >
              ?
            </button>
            <button
              type="button"
              onClick={drawRandom}
              className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-50 bg-wood-900 px-5 py-2.5 hover:bg-bronze-600 transition-colors whitespace-nowrap"
            >
              Draw at Random
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: two-pane reading room ──────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-6 pt-4 lg:pt-7 pb-2 grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] gap-x-12 gap-y-5 items-start">

        {/* LEFT RAIL */}
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--nav-height)+58px+24px)]">
          <h1 className="font-serif font-medium text-wood-900 leading-[0.96] tracking-[-0.01em] m-0 text-[clamp(36px,4.4vw,50px)]">
            Universal Language
          </h1>
          <p className="font-serif italic text-bronze-600 mt-1.5 text-[clamp(17px,2vw,21px)]">Sixty-Four Expressions</p>

          <div aria-hidden className="w-10 h-px bg-bronze-600/45 my-3.5" />

          <div className="font-serif italic text-base leading-[1.6] text-wood-800 flex flex-col gap-[11px] max-w-[30em]">
            <p className="m-0">
              <span aria-hidden className="not-italic text-bronze-600 mr-1.5">❧</span>
              Let this oracle be an instrument of attunement to the light within, as we move through the unfolding of this mystery.
            </p>
            <p className="m-0">Let it nurture harmony, clarity, and compassion in thought, word, and action.</p>
            <p className="m-0">Let us move beyond thoughts and in through the heart, in devotion and celebration of the perfection of this moment.</p>
          </div>

          <div aria-hidden className="h-px bg-wood-200 my-4" />

          {/* Card of the Day + Card of the Year — tiny art, side by side */}
          <div className="flex items-center gap-5">
            <FeatTile eyebrow="Day" date={now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} card={today} onRead={() => openReading(today)} />
            <FeatTile eyebrow="Year" date={String(now.getFullYear())} card={year} onRead={() => openReading(year)} />
          </div>

          {/* Sign in to yours + New here — side by side; sign-in says WHY */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <button
              type="button"
              onClick={() => setGridOpen(true)}
              className="flex flex-col gap-1 px-3.5 py-3 bg-wood-900 text-paper-50 hover:bg-bronze-600 transition-colors text-left"
            >
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.14em]">
                {grid && grid.length > 0 ? 'Your codes' : 'Sign in'}
              </span>
              <span className="font-sans text-[11.5px] leading-[1.35] text-paper-50/80">
                See your own chart light up in the cards as you read.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSystemsOpen(true)}
              className="flex flex-col gap-1 px-3.5 py-3 bg-transparent border border-wood-300 hover:bg-paper-100 transition-colors text-left"
            >
              <span className="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-wood-700">New here?</span>
              <span className="font-sans text-[11.5px] leading-[1.35] text-wood-600">How the four systems connect.</span>
            </button>
          </div>
        </aside>

        {/* RIGHT — the deck */}
        <main id="ul-main" className="min-w-0">
          {/* Controls — view mode (no search) */}
          <div className="sticky top-[calc(var(--nav-height)+58px)] z-20 bg-paper-50 flex flex-wrap gap-3 items-center py-3.5 border-b border-wood-200">
            <div role="group" aria-label="View mode" className="flex items-center flex-shrink-0">
              {viewTabs.map((t) => (
                <button key={t.v} type="button" onClick={() => setView(t.v)} className={`${tabBase} ${view === t.v ? tabActive : tabIdle}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Element filters */}
          <div role="group" aria-label="Filter by element" className="flex flex-wrap gap-1.5 pt-2.5">
            {(['All', ...ELEMENTS] as Array<Element | 'All'>).map((e) => {
              const active = elFilter === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setElFilter(e)}
                  className={`${chipBase} ${active ? 'bg-wood-900 text-paper-50 border-wood-900' : 'bg-transparent text-wood-700 border-wood-300'}`}
                >
                  {e !== 'All' && <span aria-hidden className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ELEMENT_DOT[e] }} />}
                  {e}
                </button>
              );
            })}
          </div>

          <p className="m-0 pt-3.5 font-label text-[11px] uppercase tracking-[0.18em] text-wood-500" aria-live="polite">
            {instruction}
          </p>

          {/* I CHING flip wall */}
          {view === 'iching' && filtered.length > 0 && (
            <div className="pt-3.5">
              <div className="grid grid-cols-4 gap-1">
                {filtered.map((c) => (
                  <FlipTile key={c.number} card={c} flipped={flipped.has(c.number)} onFlip={() => flip(c.number)} onBack={() => flipBack(c.number)} onRead={() => goCardPage(c)} />
                ))}
              </div>
            </div>
          )}

          {/* ARTWORK */}
          {view === 'artwork' && filtered.length > 0 && (
            <div className="pt-3.5">
              <div className="grid grid-cols-4 gap-1">
                {filtered.map((c) => (
                  <FlatTile key={c.number} card={c} onRead={() => goCardPage(c)} />
                ))}
              </div>
            </div>
          )}

          {/* BY RING */}
          {view === 'rings' && ringSections.length > 0 && (
            <div className="pt-2">
              {ringSections.map(({ ring, cards }) => (
                <section key={ring.ring_name} className="border-t border-wood-200 pt-[26px] pb-2">
                  <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1 mb-2">
                    <h3 className="m-0 font-serif text-2xl font-medium leading-tight text-wood-900 whitespace-nowrap">{ring.ring_name}</h3>
                    <span className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-600 whitespace-nowrap">{ring.tarot}</span>
                  </div>
                  <p className="m-0 mb-[18px] font-sans text-[13.5px] leading-[1.6] text-wood-600 max-w-[62ch]">{ring.description}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {cards.map((c) => <RingCard key={c.number} card={c} onRead={() => goCardPage(c)} />)}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* MAP */}
          {view === 'map' && (
            <div className="pt-4">
              <div className="py-1.5">
                <Constellation matchSet={matchSet} gridSet={gridNums} onRead={openReading} />
              </div>
              <div className="flex flex-wrap gap-x-[18px] gap-y-3 justify-center items-center mt-4 font-label text-[10px] uppercase tracking-[0.12em] text-wood-600">
                {ELEMENTS.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5">
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: ELEMENT_DOT[e] }} />
                    {e}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-[13px] h-[13px] rounded-full border-[1.5px] border-bronze-600" />
                  Your codes
                </span>
                <span className="text-wood-400">Lines link cards within a codon ring</span>
              </div>
            </div>
          )}

          {/* Empty */}
          {showEmpty && (
            <div className="border-t border-wood-200 mt-3.5 py-16 text-center">
              <p className="font-serif text-[22px] text-wood-600 mb-3.5">No cards match that search.</p>
              <button type="button" onClick={() => { setQuery(''); setElFilter('All'); }} className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 hover:text-wood-900 transition-colors border-b border-wood-700/50 pb-px">
                Clear search
              </button>
            </div>
          )}

          <p className="font-sans text-[13.5px] text-wood-500 mt-10 leading-[1.7]">
            Each card carries a hexagram from the I Ching, a Gene Key, and a gate from Human Design. Nothing needs to be understood to speak with them.
          </p>
        </main>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-wood-200 mt-2">
        <div className="max-w-[1280px] mx-auto px-6 py-7 flex items-center justify-between">
          <button type="button" onClick={() => setSystemsOpen(true)} className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 hover:text-wood-900 transition-colors">
            The Systems &amp; Connections →
          </button>
          <button type="button" onClick={drawRandom} className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-bronze-700 hover:text-wood-900 transition-colors border-b border-bronze-700/50 pb-px">
            Draw at Random →
          </button>
        </div>
      </footer>

      {/* ── Your Grid overlay ────────────────────────────────────────────── */}
      {gridOpen && grid && (
        <Overlay onClose={() => setGridOpen(false)} width="min(560px, 94vw)">
          <div className="px-8 pt-7 pb-[22px] border-b border-wood-200">
            <p className="m-0 mb-1.5 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-bronze-600">Your Grid</p>
            <h2 className="m-0 font-serif font-medium text-[33px] leading-[1.04] text-wood-900">Four codes, in totality</h2>
            {profile && (
              <p className="m-0 mt-2.5 font-label text-[10px] uppercase tracking-[0.14em] text-wood-400">
                {[profile.inputs.date, profile.inputs.time, profile.inputs.place.label].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="px-8 py-[22px] grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {grid.map((g) => (
              <button key={g.label} type="button" onClick={() => openReading(g.card)} aria-label={`Open ${g.label} code`} className="flex flex-col gap-2.5 p-4 bg-white border border-wood-200 hover:border-wood-400 transition-colors text-left">
                <span className="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-bronze-600">{g.label}</span>
                <span className="flex items-center gap-3 min-w-0">
                  <span className="leading-none flex-shrink-0 text-wood-800"><CardHex card={g.card} width={34} /></span>
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-label text-[9px] font-bold tracking-[0.08em] text-wood-400">No. {String(g.card.number).padStart(2, '0')}</span>
                    <span className="font-serif text-xl leading-[1.04] text-wood-900">{g.card.card_name}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="px-8 pt-5 pb-7 bg-paper-100 border-t border-wood-200">
            <p className="m-0 mb-[15px] font-sans text-[13.5px] leading-[1.55] text-wood-700 flex items-center gap-2.5">
              <span aria-hidden className="text-wood-600">✓</span> Your codes are linked from your Hologenetic Profile. Readings flag when one of your four appears.
            </p>
            <div className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5">
              <button type="button" onClick={() => setGridOpen(false)} className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-paper-50 bg-wood-900 px-6 py-3 hover:bg-bronze-600 transition-colors">Done</button>
              <Link to="/profile" className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-wood-700 border border-wood-300 px-5 py-3 hover:border-bronze-600 hover:text-wood-900 transition-colors no-underline">Full profile →</Link>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Sign-in / link-your-birth-moment popup (no profile yet) ──────────── */}
      {gridOpen && !(grid && grid.length > 0) && (
        <Overlay onClose={() => setGridOpen(false)} width="min(460px, 94vw)">
          <div className="px-8 pt-8 pb-7">
            <p className="m-0 mb-1.5 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-bronze-600">Sign in to yours</p>
            <h2 className="m-0 font-serif font-medium text-[30px] leading-[1.05] text-wood-900">Link your birth moment</h2>
            <p className="m-0 mt-3.5 font-sans text-[13.5px] leading-[1.6] text-wood-700 max-w-[34em]">
              Your exact birth moment links you to four of the sixty-four codes. Add your date, time, and place, and your readings will flag when one of your four appears.
            </p>
            <div className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5 mt-6">
              <Link to="/profile" className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-paper-50 bg-wood-900 px-6 py-3 hover:bg-bronze-600 transition-colors no-underline">Enter my birth moment →</Link>
              <button type="button" onClick={() => setGridOpen(false)} className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-wood-700 hover:text-wood-900 transition-colors">Not now</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Systems overlay ──────────────────────────────────────────────── */}
      {systemsOpen && (
        <Overlay onClose={() => setSystemsOpen(false)} width="min(580px, 94vw)">
          <div className="px-8 pt-[30px] pb-[22px] border-b border-wood-200">
            <p className="m-0 mb-1.5 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-bronze-600">The Universal Language</p>
            <h2 className="m-0 font-serif font-medium text-[34px] leading-[1.04] text-wood-900">Four systems, one frequency</h2>
          </div>
          <div className="px-8 pt-2 pb-3.5">
            {[
              ['I Ching', "The 64 hexagrams. Each card's six-line figure — the ancient Book of Changes, read here as living code."],
              ['Gene Keys', 'Shadow, Gift, and Siddhi — the spectrum each code travels, from reactive pattern to its realized essence.'],
              ['Human Design', 'The gate — where the code lives in the bodygraph, and how its energy wants to move through a life.'],
              ['Tarot', 'The codon rings gather the 64 into the Major Arcana — the archetypal throughline that orders the deck.'],
            ].map(([label, body], i, arr) => (
              <div key={label} className={`flex gap-4 py-[18px] ${i < arr.length - 1 ? 'border-b border-wood-100' : ''}`}>
                <span className="flex-[0_0_84px] font-label text-[11px] font-bold uppercase tracking-[0.14em] text-wood-700 pt-[3px]">{label}</span>
                <span className="font-sans text-sm leading-[1.6] text-wood-800">{body}</span>
              </div>
            ))}
          </div>
          <div className="px-8 pt-5 pb-[30px] bg-paper-100">
            <p className="m-0 mb-[18px] font-serif italic text-lg leading-[1.5] text-wood-700">
              Every card is one frequency spoken in four languages. The connections between them are the grammar of the whole.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/the-systems" className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-wood-700 border border-wood-300 px-6 py-3 hover:border-bronze-600 hover:text-wood-900 transition-colors no-underline">Read the full story →</Link>
              <button type="button" onClick={() => setSystemsOpen(false)} className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-50 bg-wood-900 px-7 py-3 hover:bg-bronze-600 transition-colors">Close</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Reading lightbox ─────────────────────────────────────────────── */}
      {reading && (() => {
        const c = reading;
        const [lo, hi] = tintForCard(c.number);
        const inGrid = gridLabelByNumber.get(c.number);
        return (
          <Overlay onClose={() => setReading(null)} width="min(400px, 92vw)">
            <div className="overflow-hidden">
              <div className="px-6 pt-[30px] pb-7 text-center flex flex-col items-center" style={{ background: `linear-gradient(150deg, ${lo}, ${hi})` }}>
                <span className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-paper-50/80">
                  Universal Language · {String(c.number).padStart(2, '0')}
                </span>
                <span className="leading-none block mt-3.5 text-paper-50"><CardHex card={c} width={58} color="#f7f5f1" /></span>
              </div>
              <div className="px-7 pt-[26px] pb-[30px] text-center">
                {inGrid && (
                  <p className="inline-flex items-center gap-[7px] font-label text-[10px] font-bold uppercase tracking-[0.16em] text-bronze-700 bg-[#e7decc] px-3.5 py-[7px] m-0 mb-[18px]">
                    <span aria-hidden>◆</span> In your grid · {inGrid}
                  </p>
                )}
                <h2 className="font-serif font-medium text-[31px] leading-[1.08] text-wood-900 m-0 mb-2">{c.card_name}</h2>
                <p className="font-serif italic text-lg text-wood-500 m-0 mb-[18px]">{c.iching.hexagram_name}</p>
                <div className="flex justify-center items-center flex-wrap gap-2 m-0 mb-6 font-label text-[11px] font-semibold uppercase tracking-[0.12em]">
                  <span className="text-wood-400">{c.gene_keys.shadow}</span>
                  <span aria-hidden className="text-wood-300">·</span>
                  <span className="text-bronze-700">{c.gene_keys.gift}</span>
                  <span aria-hidden className="text-wood-300">·</span>
                  <span className="text-bronze-600">{c.gene_keys.siddhi}</span>
                </div>
                <div className="flex gap-2.5 justify-center items-center flex-wrap">
                  <button type="button" onClick={() => shareCard(c)} className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-wood-700 border border-wood-300 px-5 py-3 hover:border-bronze-600 hover:text-wood-900 transition-colors">
                    {typeof navigator !== 'undefined' && navigator.share ? 'Share' : 'Copy link'}
                  </button>
                  <button type="button" onClick={() => goCardPage(c)} className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-50 bg-wood-900 px-6 py-3 hover:bg-bronze-600 transition-colors">
                    Enter the reading
                  </button>
                </div>
              </div>
            </div>
          </Overlay>
        );
      })()}

      {/* ── Journal overlay ──────────────────────────────────────────────── */}
      {journalOpen && (
        <Overlay onClose={() => setJournalOpen(false)} width="min(460px, 94vw)">
          <div className="max-h-[84vh] flex flex-col">
            <div className="px-7 pt-[26px] pb-[18px] border-b border-wood-200 flex items-end justify-between gap-3">
              <div>
                <p className="m-0 mb-1.5 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-bronze-600">Your Journal</p>
                <h2 className="m-0 font-serif font-medium text-[28px] leading-none text-wood-900">Cards you have drawn</h2>
              </div>
              {journal.length > 0 && (
                <button type="button" onClick={clearJournal} className="font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-wood-500 hover:text-wood-900 transition-colors whitespace-nowrap">Clear</button>
              )}
            </div>
            <div className="overflow-y-auto px-7 py-1.5">
              {journal.length > 0 ? (
                journal.map((e) => {
                  const c = CARD_BY_NUMBER.get(e.n);
                  if (!c) return null;
                  return (
                    <button key={e.n} type="button" onClick={() => openReading(c)} aria-label={`Reopen ${c.card_name}`} className="flex items-center gap-3.5 w-full py-3 border-b border-wood-100 hover:opacity-70 transition-opacity text-left">
                      <span className="leading-none flex-shrink-0 text-wood-800"><CardHex card={c} width={26} /></span>
                      <span className="flex items-baseline gap-2 min-w-0 flex-1">
                        <span className="font-label text-[10px] font-bold tracking-[0.08em] text-wood-400 flex-shrink-0">{String(c.number).padStart(2, '0')}</span>
                        <span className="font-serif text-[19px] leading-tight text-wood-900 truncate">{c.card_name}</span>
                      </span>
                      <span className="font-label text-[10px] tracking-[0.04em] text-wood-300 flex-shrink-0">{relTime(e.t)}</span>
                    </button>
                  );
                })
              ) : (
                <div className="py-9 text-center">
                  <p className="m-0 mb-2 font-serif italic text-xl text-wood-500">Nothing drawn yet.</p>
                  <p className="m-0 font-sans text-[13px] text-wood-400 leading-[1.6]">Every card you open is quietly kept here.</p>
                </div>
              )}
            </div>
            <div className="px-7 pt-4 pb-[22px] border-t border-wood-200 flex gap-3">
              <button type="button" onClick={drawRandom} className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-paper-50 bg-wood-900 px-5 py-3 hover:bg-bronze-600 transition-colors">Draw a card</button>
              <button type="button" onClick={() => setJournalOpen(false)} className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-wood-500 hover:text-wood-900 transition-colors">Close</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Onboarding overlay ───────────────────────────────────────────── */}
      {onboarding && (
        <div onClick={finishOnboarding} className="fixed inset-0 z-[90] flex items-center justify-center p-6 overflow-auto bg-[rgba(30,26,22,0.6)] [backdrop-filter:blur(6px)]">
          <div onClick={(e) => e.stopPropagation()} className="bg-paper-50 shadow-[0_24px_60px_rgba(30,26,22,0.45)] cursor-default" style={{ width: 'min(500px, 94vw)' }}>
            <div className="px-[34px] pt-[34px] pb-2 text-center">
              <p className="m-0 mb-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-bronze-600">Welcome</p>
              <h2 className="m-0 font-serif font-medium text-4xl leading-[1.02] text-wood-900">How to read a card</h2>
            </div>
            <div className="px-[34px] pt-[22px] pb-2 flex flex-col gap-[18px]">
              {[
                ['Draw or choose.', 'Tap Draw at Random, or pick any hexagram from the deck and flip it to reveal its card.'],
                ['Sit with it.', 'Each card holds an I Ching hexagram and a Gene Key spectrum — Shadow, Gift, Siddhi. Nothing needs to be understood to speak with it.'],
                ['Make it yours.', 'Add your birth moment to find your four codes, and your draws are kept in a private journal.'],
              ].map(([lead, body], i) => (
                <div key={i} className="flex gap-[15px] items-start">
                  <span className="flex-[0_0_28px] font-serif text-[26px] text-bronze-600 leading-none">{i + 1}</span>
                  <span className="font-sans text-sm leading-[1.6] text-wood-800"><strong className="font-semibold">{lead}</strong> {body}</span>
                </div>
              ))}
            </div>
            <div className="px-[34px] pt-[22px] pb-[30px] text-center">
              <button type="button" onClick={finishOnboarding} className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-paper-50 bg-wood-900 px-10 py-3.5 hover:bg-bronze-600 transition-colors">Begin</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed left-1/2 bottom-7 -translate-x-1/2 z-[95] bg-wood-900 text-paper-50 font-label text-xs font-semibold tracking-[0.06em] px-[22px] py-3.5 shadow-[0_12px_30px_rgba(30,26,22,0.35)] pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
};

export default UniversalLanguageIndex;
