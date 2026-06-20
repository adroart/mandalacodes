/* Host for the generated Oracle Entry markup. The controller below is the
   design file's own `class Component` (controller.txt) ported VERBATIM — the
   ONLY changes are the data seam and the app bridges:

   - It extends React.Component and renders <OracleEntryMarkup vals={…}/>.
   - Instead of importing the design's bundled `oracle-cards.js`, `this.state.mod`
     is built from the REAL app data passed in `props.adapter` (all 64 cards,
     the real Cloudinary images, the real element/tint helpers) so the live page
     IS the design driven by real data.
   - `openSystems` / `openGrid` / `enterReading` / `onRead` (card open) bridge to
     the app via `props` (overlays + routing), replacing the design's no-ops.
   - The fixed light/dark toggle, hero treatment switcher, flip wall, search,
     element filters, and reading lightbox are the file's own logic, unchanged.

   The site's own top nav bar is supplied by the app shell, not this component
   (per the import brief: match the design exactly except for the title nav bar). */
import React from 'react';
import { OracleEntryMarkup } from './OracleEntry.generated';
import { ensureDcHexagramElement } from './dc-hexagram-element';

/* Register the <dc-import> custom element at MODULE LOAD, before React ever
   renders the grid. If registration is deferred to componentDidMount, every
   <dc-import> is created as an undefined element first; React sets the `lines`
   property on it, then the later upgrade shadows the accessor and every tile
   renders the default hexagram. Defining the element up front means each
   `lines` assignment flows through the live accessor and each glyph is its own. */
ensureDcHexagramElement();

/* The lightweight card shape the design's renderVals expects. The adapter maps
   each real OracleCard into one of these so the verbatim logic is untouched. */
export interface EntryCard {
  n: number;
  name: string;
  u: string; // upper trigram symbol
  l: string; // lower trigram symbol
  un: string; // upper trigram name
  ln: string; // lower trigram name
  hx: string; // hexagram name
  el: string; // element prose (drives primaryElement)
}

/* Everything the controller pulled from the design's oracle-cards.js, now
   sourced from the real app. The adapter component builds this from real data. */
export interface EntryAdapter {
  CARDS: EntryCard[];
  ELEMENT_DOT: Record<string, string>;
  ELEMENTS: string[];
  hexLines: (u: string, l: string) => boolean[];
  primaryElement: (prose: string) => string;
  tintFor: (card: EntryCard) => [string, string] | readonly [string, string];
  cardImg: (card: EntryCard, size: number) => string;
  cardForToday: () => EntryCard | undefined;
  cardForYear: () => EntryCard | undefined;
}

interface HostProps {
  adapter: EntryAdapter;
  theme?: 'light' | 'dark';
  invocationStyle?: 'altar' | 'illuminated' | 'constellation';
  /** The visitor's own card numbers (from their saved birth profile). Cards in
   *  this set glow in the deck. Empty when no birth moment has been entered. */
  yourCodes?: Set<number>;
  /** Whether a birth moment has been entered (yourCodes is non-empty). Switches
   *  the rail's "Your codes" tile from invitation to confirmation. */
  hasCodes?: boolean;
  /** Open a card (the design's openReading lightbox stays; "Enter the reading"
   *  and the flipped Read action route to the full card page through these). */
  onOpenCard?: (n: number) => void; // open the design's own lightbox preview
  onEnterReading?: (n: number) => void; // route to the full card reading page
  onOpenSystems?: () => void; // app Systems overlay / page
  onOpenGrid?: () => void; // app "your codes" grid / sign-in
  /** Open the visitor's Hologenetic profile (shown once a birth moment is saved). */
  onOpenProfile?: () => void;
  /** The birth-date/time/place form, rendered inline when the invite expands.
   *  Supplied by the page so it can own profile context + post-save behaviour. */
  inviteForm?: React.ReactNode;
  /** Notify the app each time a card preview is opened (e.g. journal record). */
  onCardOpened?: (n: number) => void;
}

export class OracleEntryHost extends React.Component<HostProps, any> {
  // state shape verbatim from the controller (mod is the adapter here)
  state = {
    mod: null as EntryAdapter | null,
    view: 'iching',
    query: '',
    elFilter: 'All',
    flipped: {} as Record<number, boolean>,
    reading: null as EntryCard | null,
    themeOverride: null as string | null,
    invOverride: null as string | null,
    inviteExpanded: false,
  };

  componentDidMount() {
    ensureDcHexagramElement();
    // Seam: the design did `import('./oracle-cards.js')`; we use the real adapter.
    this.setState({ mod: this.props.adapter });
  }

  componentDidUpdate(prev: HostProps) {
    if (prev.adapter !== this.props.adapter) this.setState({ mod: this.props.adapter });
  }

  // ── verbatim getters ──
  get theme() {
    return this.state.themeOverride || this.props.theme || 'dark';
  }
  get inv() {
    return 'altar';
  }

  renderVals() {
    const m = this.state.mod;
    const theme = this.theme;
    const inv = this.inv;
    const ELEMENT_DOT: any = m ? m.ELEMENT_DOT : {};
    const ELEMENTS = m ? m.ELEMENTS : ['Fire', 'Water', 'Earth', 'Metal', 'Wood'];

    const navLinks = ['Universal', 'I Ching', 'Gene Keys', 'Human Design', 'Body', 'Relations'].map((label, i) => ({
      label,
      color: i === 0 ? 'var(--ink,#262321)' : 'var(--ink3,#8a7a5e)',
      border: i === 0 ? 'var(--accent,#8a744e)' : 'transparent',
    }));

    // constellation ticks
    const ringTicks: any[] = [];
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * 2 * Math.PI - Math.PI / 2;
      const r = 210,
        cx = 300,
        cy = 300;
      const x = cx + Math.cos(ang) * r,
        y = cy + Math.sin(ang) * r;
      ringTicks.push({ x: (x - 1.2).toFixed(1), y: (y - 4.5).toFixed(1), cx, cy, rot: ((i / 64) * 360 + 90).toFixed(1), op: (0.18 + 0.5 * (i % 4 === 0 ? 1 : 0)).toFixed(2) });
    }

    const lines = (c: EntryCard) => (m ? m.hexLines(c.u, c.l) : [true, true, true, false, false, false]);
    const today = m ? m.cardForToday() : null;
    const year = m ? m.cardForYear() : null;
    const now = new Date();
    const heroLines = today ? lines(today) : [true, true, true, true, true, true];

    // ── The energy band: today + this year shown together, slim ──
    // Two compact chips, each a hexagram glyph + a tight TODAY/THIS YEAR · №.
    // Whole chip opens that card's reading. No slab, no serif, no sentence —
    // a ledger line that reads in one glance and barely costs vertical room.
    const energy = [
      today && {
        key: 'today',
        eyebrow: 'Today',
        sub: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        lines: lines(today),
        cardNum: String(today.n),
        cardName: today.name,
        aria: 'Open today’s card, ' + today.name,
        onOpen: () => this.openReading(today),
      },
      year && {
        key: 'year',
        eyebrow: 'This year',
        sub: String(now.getFullYear()),
        lines: lines(year),
        cardNum: String(year.n),
        cardName: year.name,
        aria: 'Open this year’s card, ' + year.name,
        onOpen: () => this.openReading(year),
      },
    ].filter(Boolean) as any[];

    // ── The three actions, as real buttons (the page's existing actions,
    //    pulled up into one slim row above the deck): learn / draw / birth. ──
    // Two compact utility buttons stay as a pair; "enter your birthday" graduates
    // to its own full-width invitation bar (below) because it has to TEACH the
    // offer, not just label it — a first-timer doesn't know what "your codes" are.
    const ghostBg = 'transparent';
    const ghostBorder = '1px solid var(--line2,#d2c7b4)';
    const ghostFg = 'var(--ink2,#524330)';
    const fillBg = 'var(--accent,#8a744e)';
    const fillBorder = '1px solid var(--accent,#8a744e)';
    const fillFg = 'var(--onAccent,#f7f5f1)';
    const actions = [
      { key: 'systems', label: 'The systems', emphasis: false, bg: ghostBg, border: ghostBorder, fg: ghostFg, aria: 'Open the systems overlay', onClick: () => this.props.onOpenSystems?.() },
      { key: 'draw', label: 'Draw a card', emphasis: true, bg: fillBg, border: fillBorder, fg: fillFg, aria: 'Draw a random card', onClick: () => { const c = all[Math.floor(Math.random() * all.length)]; if (c) this.openReading(c); } },
    ];

    // The invitation. Until a birth moment is saved it's a centered button that
    // expands an inline dropdown (the app's birth-date/time/place form, passed in
    // as props.inviteForm). Once saved (hasCodes) it collapses to a quiet
    // confirmation that points to the Hologenetic profile.
    const invite = this.props.hasCodes
      ? {
          done: true,
          expanded: false,
          form: null,
          title: 'Your placement is illuminated',
          sub: 'Throughout the sixty-four. See your full Hologenetic profile.',
          aria: 'Your placement is illuminated throughout the sixty-four. Open your Hologenetic profile.',
          onClick: () => this.props.onOpenProfile?.(),
        }
      : {
          done: false,
          expanded: this.state.inviteExpanded,
          form: this.props.inviteForm,
          title: 'Enter your birth time',
          sub: 'See which cards are most relevant to you, lit throughout the oracle.',
          aria: 'Enter your birth time to see which cards are most relevant to you',
          onClick: () => this.setState((s: any) => ({ inviteExpanded: !s.inviteExpanded })),
        };

    // tabs
    const tabDefs = [
      { v: 'iching', label: 'I Ching' },
      { v: 'artwork', label: 'Artwork' },
    ];
    const tabs = tabDefs.map((t) => ({
      label: t.label,
      onClick: () => this.setState({ view: t.v }),
      color: this.state.view === t.v ? 'var(--ink,#262321)' : 'var(--faint,#a89070)',
      border: this.state.view === t.v ? 'var(--accent,#8a744e)' : 'transparent',
    }));

    // element chips
    const elChips = [{ name: 'All', el: 'All' }, ...ELEMENTS.map((e) => ({ name: e, el: e }))].map((e) => {
      const active = this.state.elFilter === e.el;
      const dot = e.el === 'All' ? 'var(--accent,#8a744e)' : ELEMENT_DOT[e.el] || 'var(--accent)';
      return {
        name: e.name,
        onClick: () => this.setState({ elFilter: e.el }),
        color: active ? 'var(--ink,#262321)' : 'var(--faint,#a89070)',
        dotBg: active ? dot : 'transparent',
        dotRing: active ? 'none' : 'inset 0 0 0 1px ' + dot,
      };
    });

    // filter cards
    const all = m ? m.CARDS : [];
    const q = this.state.query.trim().toLowerCase();
    const elOk = (c: EntryCard) => this.state.elFilter === 'All' || (m && m.primaryElement(c.el) === this.state.elFilter);
    const qOk = (c: EntryCard) => !q || c.name.toLowerCase().includes(q) || c.hx.toLowerCase().includes(q) || String(c.n) === q;
    const filtered = all.filter((c) => elOk(c) && qOk(c));

    const yourCodes = this.props.yourCodes;
    const gridCards = filtered.map((c) => {
      const tint = m ? m.tintFor(c) : ['#9d7c48', '#65502f'];
      const flipped = !!this.state.flipped[c.n];
      const yours = !!yourCodes && yourCodes.has(c.n);
      return {
        n: c.n,
        name: c.name,
        hx: c.hx,
        num2: String(c.n).padStart(2, '0'),
        lines: lines(c),
        art: m ? m.cardImg(c, 320) : '',
        grad: 'linear-gradient(150deg,' + tint[0] + ',' + tint[1] + ')',
        yours,
        flipped,
        closed: !flipped,
        flipTransform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        cardNum: String(c.n),
        upperTrigram: c.un || '',
        lowerTrigram: c.ln || '',
        aria: 'Card ' + c.n + ': ' + c.name,
        onTile: flipped ? () => this.openReading(c) : () => this.flip(c.n),
        onBack: () => this.flipBack(c.n),
        onRead: () => this.openReading(c),
      };
    });

    const filtering = q || this.state.elFilter !== 'All';
    // Idle instruction line removed by request; only the filter-count feedback remains.
    const instruction = filtering ? filtered.length + ' of 64 shown' : '';

    // reading vm
    let reading: any = null;
    if (this.state.reading) {
      const c = this.state.reading;
      const tint = m ? m.tintFor(c) : ['#9d7c48', '#65502f'];
      reading = { name: c.name, hx: c.hx, num2: String(c.n).padStart(2, '0'), grad: 'linear-gradient(150deg,' + tint[0] + ',' + tint[1] + ')', artBig: m ? m.cardImg(c, 760) : '' };
    }

    return {
      theme,
      isA: inv === 'illuminated',
      isB: inv === 'altar',
      isC: inv === 'constellation',
      heroLines,
      ringTicks,
      navLinks,
      energy,
      actions,
      invite,
      // Right-hand door tiles, stacked. "Learn" opens the Systems overlay
      // (what the 64 are, the four systems they speak). "Your codes" switches
      // on whether a birth moment has been entered.
      systemsTile: {
        eyebrow: 'The sixty-four',
        body: 'What the cards are, and the four systems they speak',
      },
      codesTile: this.props.hasCodes
        ? {
            done: true,
            eyebrow: 'Your codes are linked',
            body: 'They glow in the deck below when one of yours appears',
          }
        : {
            done: false,
            eyebrow: 'Your codes',
            body: 'Add your birth moment and your cards light up in every reading',
          },
      tabs,
      elChips,
      gridCards,
      isIChing: this.state.view === 'iching',
      isArtwork: this.state.view === 'artwork',
      query: this.state.query,
      instruction,
      drawHint: filtering ? filtered.length + ' of 64 shown' : 'or choose one below',
      reading,
      readingArtBig: reading ? reading.artBig : 'data:,',
      readingName: reading ? reading.name : '',
      readingHx: reading ? reading.hx : '',
      readingNum2: reading ? reading.num2 : '',
      readingGrad: reading ? reading.grad : 'transparent',
      themeIcon: theme === 'dark' ? '☽' : '☀',
      themeLabel: theme === 'dark' ? 'Light' : 'Dark',
      onQuery: (e: any) => this.setState({ query: e.target.value }),
      toggleTheme: () => this.setState({ themeOverride: this.theme === 'dark' ? 'light' : 'dark' }),
      drawRandom: () => {
        const c = all[Math.floor(Math.random() * all.length)];
        if (c) this.openReading(c);
      },
      // App bridges (the design's no-ops are replaced with real app actions):
      openSystems: () => this.props.onOpenSystems?.(),
      openGrid: () => this.props.onOpenGrid?.(),
      closeReading: () => this.setState({ reading: null }),
      enterReading: () => {
        const c = this.state.reading;
        this.setState({ reading: null });
        if (c) this.props.onEnterReading?.(c.n);
      },
      stop: (e: any) => e.stopPropagation(),
    };
  }

  flip(n: number) {
    this.setState((s: any) => ({ flipped: { ...s.flipped, [n]: true } }));
  }
  flipBack(n: number) {
    this.setState((s: any) => {
      const f = { ...s.flipped };
      delete f[n];
      return { flipped: f };
    });
  }
  openReading(c: EntryCard) {
    // Go straight into the full reading (the EBReading page + its entrance
    // animation). The design's preview lightbox is intentionally skipped — a
    // card click loads the reading directly.
    this.props.onCardOpened?.(c.n);
    if (this.props.onEnterReading) this.props.onEnterReading(c.n);
    else this.setState({ reading: c });
  }

  render() {
    return <OracleEntryMarkup vals={this.renderVals()} />;
  }
}
