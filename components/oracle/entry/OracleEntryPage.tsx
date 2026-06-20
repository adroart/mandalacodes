/* Data adapter — the ONLY hand-written seam between the app and the mechanically
   imported Oracle Entry design. It:
     1. maps the real 64 OracleCards into the design's lightweight EntryCard shape,
     2. supplies the real element/tint/image helpers (the design's oracle-cards.js
        equivalents, sourced from the live codebase),
     3. bridges the design's rail links + "Enter the reading" to the app: Systems
        and "your codes" open the existing overlays; entering a reading routes to
        the full card page; opening a card is recorded in the journal.
   Everything visible is the generated design; this file is the wiring. */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../../DarkModeContext';
import { ALL_CARDS, CARD_BY_NUMBER, type OracleCard } from '../../../data/oracleData';
import { ulCardImageUrl } from '../../../utils/universalLanguage';
import {
  elementForCard,
  tintForCard,
  ELEMENTS,
  ELEMENT_DOT,
  primaryElement as appPrimaryElement,
} from '../../../lib/oracle/elements';
import { useJournal } from '../../../lib/oracle/journal';
import { useProfile } from '../../../lib/profile/context';
import { useAccount } from '../../../lib/account/useAccount';
import { POSITION_KEYS } from '../../../data/profilePositions';
import { LAUNCH_FLAGS } from '../../../launchFlags';
import { OracleEntryHost, type EntryCard, type EntryAdapter } from './generated/OracleEntry.host';
import './OracleEntry.scoped.css';

/* ── deterministic Card-of-Day / Year (same hash as the previous index) ─────── */
function hashTo64(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 64) + 1;
}

/* Trigram names carry a parenthetical Chinese name ("Heaven (Ch'ien)"); the deck
   tiles want the plain element word only — "Heaven". Strip the parenthetical. */
function plainTrigram(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').trim();
}

/* ── map a real OracleCard → the design's EntryCard ─────────────────────────── */
function toEntryCard(c: OracleCard): EntryCard {
  return {
    n: c.number,
    name: c.card_name,
    u: c.iching.upper_trigram.symbol,
    l: c.iching.lower_trigram.symbol,
    un: plainTrigram(c.iching.upper_trigram.name),
    ln: plainTrigram(c.iching.lower_trigram.name),
    hx: c.iching.hexagram_name,
    el: c.element,
  };
}

/* The design's hexLines: derive the 6 boolean lines from the two trigram symbols. */
const TRIGRAM_LINES: Record<string, boolean[]> = {
  '☰': [true, true, true],
  '☷': [false, false, false],
  '☳': [false, false, true],
  '☵': [false, true, false],
  '☶': [true, false, false],
  '☴': [true, true, false],
  '☲': [true, false, true],
  '☱': [false, true, true],
};
function hexLines(u: string, l: string): boolean[] {
  const U = TRIGRAM_LINES[u] || [true, true, true];
  const L = TRIGRAM_LINES[l] || [false, false, false];
  return [...U, ...L];
}

/* ── reused overlay shell ───────────────────────────────────────────────────── */
const Overlay: React.FC<{ onClose: () => void; width: string; children: React.ReactNode }> = ({ onClose, width, children }) => (
  <div onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center p-6 overflow-auto bg-[rgba(30,26,22,0.55)] [backdrop-filter:blur(5px)]">
    <div onClick={(e) => e.stopPropagation()} className="bg-paper-50 shadow-[0_24px_60px_rgba(30,26,22,0.4)] cursor-default" style={{ width }}>
      {children}
    </div>
  </div>
);

const OracleEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useDarkMode();
  const { record: recordJournal } = useJournal();
  const { profile } = useProfile();
  const account = useAccount();
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);

  /* The visitor's own codes: the set of card numbers (gate == card number) drawn
     from the 11 hologenetic positions of their saved profile. Empty until a birth
     moment is entered. Drives both the rail's "Your codes" state and the deck glow.

     The codes are ACCOUNT-BOUND: the birth moment is stored on the account, so a
     signed-out visitor must see no data. When accounts are available we require
     a live session before surfacing any codes — otherwise a stale local profile
     would keep the deck "lit" after sign-out. When accounts aren't configured
     (guest-only build), fall back to the local profile so the guest isn't stranded.
     Gated by the same launch flag as YourPositionCallout. */
  const accountGateOk = !account.available || account.isSignedIn;
  const yourCodes = useMemo(() => {
    if (!LAUNCH_FLAGS.hologeneticProfile || !profile || !accountGateOk) return new Set<number>();
    const set = new Set<number>();
    for (const key of POSITION_KEYS) {
      const gl = profile.computed[key];
      if (gl?.gate) set.add(gl.gate);
    }
    return set;
  }, [profile, accountGateOk]);
  const hasCodes = yourCodes.size > 0;

  /* Build the adapter once. All 64 real cards, real images, real element model. */
  const entryCards = useMemo(() => ALL_CARDS.map(toEntryCard), []);
  const byNumber = useMemo(() => new Map(entryCards.map((c) => [c.n, c])), [entryCards]);

  const adapter = useMemo<EntryAdapter>(() => {
    const ELEMENT_DOT_MAP: Record<string, string> = { ...ELEMENT_DOT };
    return {
      CARDS: entryCards,
      ELEMENT_DOT: ELEMENT_DOT_MAP,
      ELEMENTS: [...ELEMENTS],
      hexLines,
      // The design filters by primaryElement(prose); reuse the app's real model,
      // keyed by card number for exact parity with the rest of the site.
      primaryElement: (prose: string) => appPrimaryElement(prose),
      tintFor: (card: EntryCard) => tintForCard(card.n),
      cardImg: (card: EntryCard, size: number) => ulCardImageUrl(card.n, size),
      cardForToday: () => {
        const now = new Date();
        const y = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return byNumber.get(hashTo64(`day:${y}-${mm}-${d}`));
      },
      cardForYear: () => byNumber.get(hashTo64(`year:${new Date().getFullYear()}`)),
    };
  }, [entryCards, byNumber]);

  const onEnterReading = useCallback(
    (n: number) => {
      const c = CARD_BY_NUMBER.get(n);
      // No `quiet` state → the reading plays its full entrance (fresh arrival).
      navigate(`/universal-language/${n}`);
      return c;
    },
    [navigate],
  );

  const onCardOpened = useCallback(
    (n: number) => {
      const c = CARD_BY_NUMBER.get(n);
      if (c) recordJournal(c.number, c.card_name);
    },
    [recordJournal],
  );

  // Close overlays on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (systemsOpen) setSystemsOpen(false);
        else if (gridOpen) setGridOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [systemsOpen, gridOpen]);

  return (
    <div className="oe-root pt-[var(--nav-height)]">
      <OracleEntryHost
        adapter={adapter}
        theme={isDarkMode ? 'dark' : 'light'}
        yourCodes={yourCodes}
        hasCodes={hasCodes}
        onEnterReading={onEnterReading}
        onCardOpened={onCardOpened}
        onOpenSystems={() => setSystemsOpen(true)}
        onOpenGrid={() => {
          // Always open the sign-in / birth-moment overlay: this is where you
          // enter your birthday and sign in so all four of your codes light up
          // across the chart. (Was wrongly routing the linked state to /atlas.)
          setGridOpen(true);
        }}
      />

      {/* Systems overlay (kept from the previous index — the rail links target it) */}
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

      {/* "Your codes" → link your birth moment (kept from the previous index) */}
      {gridOpen && (
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
    </div>
  );
};

export default OracleEntryPage;
