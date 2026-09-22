/* Host for the generated Card Reading v2 (Wide Image, desktop — locked) markup.
   The controller below is the template's own `class Component`
   (CardReadingDesktop.controller.txt) ported VERBATIM — only three changes:
     1. it extends React.Component and renders <CardReadingDesktopMarkup vals={...}/>,
     2. the reader lookup is scoped to this host's own root instead of `document`,
        so a mobile host mounted elsewhere can never be wired twice,
     3. the sample headerNav/meta/nav constants are injected from `props.data` so
        all 64 cards drive it.
   Focus-fade, piecewise marker, collapsing jump-bar, aside parallax and the
   section-reveal observer are unchanged from the design file. */
import React from 'react';
import { CardReadingDesktopMarkup } from './CardReadingDesktop.generated';

export interface CardReadingDesktopNavItem {
  id: string;
  label: string;
  sum: string;
  tab: string;
  gStar?: boolean;
  gHex?: boolean;
  gSprout?: boolean;
  gDiamond?: boolean;
  gCircle?: boolean;
  gRings?: boolean;
}

export interface CardReadingDesktopMetaItem {
  k: string;
  v: string;
}

export interface CardReadingDesktopHeaderLabel {
  label: string;
  href: string;
  active?: boolean;
}

export interface CardReadingDesktopData {
  headerLabels?: CardReadingDesktopHeaderLabel[];
  meta?: CardReadingDesktopMetaItem[];
  nav?: CardReadingDesktopNavItem[];
  /* Header title block. "No. 62 · Universal Language" */
  cardKicker?: string;
  /* Header title block. "Voice of Nature" */
  cardName?: string;
  /* The side column's title plate: hexagram lines (top to bottom), the card
     number under them, the element line in gold, the small gate line, and the
     keynotes as one sentence. */
  hexLines?: { solid: boolean; broken: boolean }[];
  hexHref?: string;
  cardNumber?: string;
  elementLine?: string;
  gateLine?: string;
  keynotes?: string[];
  /* The side column's three links. The piece one is per-card. */
  forMeHref?: string;
  pieceHref?: string;
  familyHref?: string;
  deckHref?: string;
  shareHref?: string;
}

interface HostProps {
  data?: CardReadingDesktopData;
  /* 'glyph' (default) or 'ring' — the design file's own rail-node modes. */
  railNode?: 'glyph' | 'ring';
  /* Fills the design's <dc-import name="Reading"> slot — the six lens sections,
     each carrying data-sec so the scroll engine can wire them. */
  reading?: React.ReactNode;
  /* Fills the design's artwork slot (id "art-desktop"). */
  artwork?: React.ReactNode;
}

/* The design file's own defaults, kept so the host renders identically to the
   source .dc.html when no data is supplied. */
const DEFAULT_HEADER_LABELS: CardReadingDesktopHeaderLabel[] = [
  { label: 'Deck', href: '/universal-language', active: true },
  { label: 'Systems', href: '/the-systems' },
  { label: 'Learn', href: '/learn' },
  { label: 'Atlas', href: '/atlas' },
  { label: 'Account', href: '/account' },
];

const DEFAULT_META: CardReadingDesktopMetaItem[] = [
  { k: 'Element', v: 'Wind / Thunder' },
  { k: 'Gate', v: '62 · Precision' },
  { k: 'Keynotes', v: 'Discernment, Pattern, Truth' },
];

/* Hexagram 62, thunder over mountain, top line first. */
const DEFAULT_HEX_LINES = [false, false, true, true, false, false].map((solid) => ({ solid, broken: !solid }));

const DEFAULT_NAV: CardReadingDesktopNavItem[] = [
  { id: 'ul', label: 'Universal Language', sum: '62', tab: 'UL', gStar: true },
  { id: 'iching', label: 'I Ching', sum: 'Hexagram 62', tab: 'I Ching', gHex: true },
  { id: 'genekeys', label: 'Gene Keys', sum: 'Sphere of Genius', tab: 'Gene Keys', gSprout: true },
  { id: 'humandesign', label: 'Human Design', sum: 'Channel of Discernment', tab: 'Human Design', gDiamond: true },
  { id: 'body', label: 'Body', sum: 'Listening as Regulation', tab: 'Body', gCircle: true },
  { id: 'relations', label: 'Relations', sum: 'The Ecology of Truth', tab: 'Relations', gRings: true },
];

export class CardReadingDesktopHost extends React.Component<HostProps> {
  rootEl: HTMLDivElement | null = null;
  _wired: WeakSet<Element> = new WeakSet();
  _timer: ReturnType<typeof setTimeout> | null = null;
  _anim: ReturnType<typeof setInterval> | null = null;

  renderVals() {
    const data = this.props.data ?? {};
    const labels = data.headerLabels ?? DEFAULT_HEADER_LABELS;
    const headerNav = labels.map((h, i) => ({
      label: h.label,
      href: h.href,
      active: !!h.active,
      divider: i > 0,
      color: h.active ? "#f3ecde" : "#ddd4c2"
    }));
    const mode = this.props.railNode === 'ring' ? 'ring' : 'glyph';
    return {
      headerNav,
      glyphMode: mode === 'glyph',
      ringMode: mode === 'ring',
      meta: data.meta ?? DEFAULT_META,
      nav: data.nav ?? DEFAULT_NAV,
      cardKicker: data.cardKicker ?? 'No. 62 · Universal Language',
      cardName: data.cardName ?? 'Voice of Nature',
      hexLines: data.hexLines ?? DEFAULT_HEX_LINES,
      hexHref: data.hexHref ?? '#iching',
      cardNumber: data.cardNumber ?? '62',
      elementLine: data.elementLine ?? 'Wind / Thunder',
      gateLine: data.gateLine ?? 'Gate 62 · Precision · Universal Language',
      keynotes: data.keynotes ?? ['Discernment', 'Pattern', 'Truth'],
      forMeHref: data.forMeHref ?? '/profile',
      pieceHref: data.pieceHref ?? '/universal-language',
      familyHref: data.familyHref ?? '/family',
      deckHref: data.deckHref ?? '/universal-language',
      shareHref: data.shareHref ?? '#share',
      slots: { Reading: this.props.reading },
      images: { 'art-desktop': this.props.artwork },
    };
  }


  /* The design's bar has a Share link where the reading has a Share button.
     Rather than plumb a second share sheet, a click on it is handed to the
     reading's own hidden button, so there is one sheet and one implementation. */
  handleShareClick = (e: any) => {
    const a = e.target?.closest?.('[data-bar-share], [data-bar-tab="share"]');
    if (!a || !this.rootEl?.contains(a)) return;
    e.preventDefault();
    /* document, not the frame: the reading's bar sits beside the frame now. */
    const real = document.querySelector('.oracle-bottom-nav [aria-label="Share this code"]') as HTMLElement | null;
    real?.click();
  };

  componentDidMount() {
    this._wired = new WeakSet();
    let tries = 0;
    const tick = () => {
      let pending = false;
      const scope: ParentNode = this.rootEl ?? document;
      const readers = scope.querySelectorAll('[data-reader]');
      readers.forEach((reader) => {
        if (this._wired.has(reader)) return;
        const ready = reader.querySelector('[data-scroll]')
          && reader.querySelectorAll('[data-sec], [data-chapter]').length >= 6
          && reader.querySelectorAll('[data-nav]').length;
        if (ready) { this._wired.add(reader); this.wireReader(reader); }
        else pending = true;
      });
      if ((pending || readers.length === 0) && tries++ < 160) this._timer = setTimeout(tick, 120);
    };
    tick();
  }

  componentWillUnmount() { if (this._timer) clearTimeout(this._timer); if (this._anim) clearInterval(this._anim); }

  /* Section lookup: the live reading marks its six chapters with data-chapter,
     the imported design used data-sec. The engine accepts either so the shell
     can drive the live body. Ids match on both (ul, iching, genekeys,
     humandesign, body, relations). */
  wireReader(reader: any) {
    const scroll = reader.querySelector('[data-scroll]');
    if (!scroll) return;
    /* Prefer the live reading's chapter over anything marked data-sec. A
       selector list returns whichever element comes first in the document, and
       the designed header block above the reading also carries data-sec="ul",
       so "ul" was resolving to the header rather than to the chapter. That put
       the first anchor in the wrong place and threw the whole rail off, so the
       lit label stopped matching the section on screen. */
    const secFor = (id: string) =>
      reader.querySelector('[data-chapter="' + id + '"]')
      || reader.querySelector('[data-sec="' + id + '"]');


    const secs = Array.from(reader.querySelectorAll('[data-sec], [data-chapter]')) as any[];
    const navs = Array.from(reader.querySelectorAll('[data-nav]')) as any[];
    if (!secs.length || !navs.length) return;

    const vfill = reader.querySelector('[data-progressfill]');
    const hfill = reader.querySelector('[data-progressfill-h]');

    // Focus-fade: labels dim by distance from the active section. Active also
    // brightens its glyph node; in ring mode the active node shows % read.
    const jb = reader.querySelector('[data-jumpbar]');
    const aside = reader.querySelector('aside');
    const artPar = reader.querySelector('[data-artparallax]');
    const comet = reader.querySelector('[data-comet]');
    const grain = reader.querySelector('[data-grain]');
    const setActive = (idx: number) => {
      navs.forEach((n: any, i: number) => {
        n.style.color = i === idx ? '#c6a667' : '#80735f';
        n.setAttribute('aria-current', i === idx ? 'true' : 'false');
        n.style.transition = 'color .3s ease, transform .35s cubic-bezier(.4,0,.2,1)';
        n.style.transformOrigin = 'center';
        n.style.display = 'inline-block';
        n.style.transform = i === idx ? 'scale(1.06)' : 'scale(1)';
      });
    };
    if (aside && artPar) aside.addEventListener('scroll', () => {
      artPar.style.transform = 'scale(1.14) translateY(' + (aside.scrollTop * 0.06) + 'px)';
    }, { passive: true });

    // Map each label to its section's real position in the reading, so the rail
    // is a proportional map (Gene Keys occupies more of it because it's longer).
    let secList: any[] = [];
    let trackLen = 0;
    let breaks: number[] = [];
    let railY: number[] = [];
    let maxScrollRef = 1;
    let lastSH = 0;
    const layout = () => {
      const sTop = scroll.getBoundingClientRect().top;
      secList = navs.map((n: any) => {
        const id = n.getAttribute('data-nav');
        const sec = secFor(id);
        const top = sec ? (sec.getBoundingClientRect().top - sTop + scroll.scrollTop) : 0;
        return { id, top, btn: n };
      }).sort((a: any, b: any) => a.top - b.top);
      breaks = secList.map((s: any) => s.top);
      const jbLeft = jb ? jb.getBoundingClientRect().left : 0;
      secList.forEach((s: any) => { const rr = s.btn.getBoundingClientRect(); const padL = parseFloat(getComputedStyle(s.btn).paddingLeft) || 0; s.cx = rr.left - jbLeft + padL; });
      maxScrollRef = Math.max(1, scroll.scrollHeight - scroll.clientHeight);
      lastSH = scroll.scrollHeight;
    };

    // Marker, fill and active label all track scroll progress against the same
    // range, so they stay locked to each other and reach the bottom at the end.
    const onScroll = () => {
      layout();
      const n = breaks.length;
      if (!n) return;
      const pos = scroll.scrollTop;
      // Marker moves piecewise between label anchors by real position within each
      // section, so it stays aligned to the labels AND spans top -> bottom.
      const den = Math.max(1, scroll.scrollHeight - scroll.clientHeight);
      const frac = Math.max(0, Math.min(1, pos / den));
      const barH = pos > 24 ? 38 : 49;
      if (jb) { jb.style.height = barH + 'px'; jb.style.background = pos > 24 ? '#15110c' : '#191510'; jb.style.boxShadow = pos > 24 ? '0 1px 0 rgba(168,135,77,.28)' : 'none'; }
      [aside, scroll, grain].forEach((el: any) => { if (el) el.style.top = barH + 'px'; });
      if (hfill) hfill.style.top = '0px';
      if (comet) comet.style.top = '1px';
      let ak = 0;
      for (let i = 0; i < n; i++) { if (pos >= breaks[i]) ak = i; }

    /* Progress marker: the bar and its diamond track scroll across the full
       width of the reader, empty at the top and complete at the bottom, rather
       than hopping between section anchors. */
      const track = reader.getBoundingClientRect().width;
      const cx = frac * track;
      if (hfill) hfill.style.width = cx + 'px';
      if (comet) comet.style.left = cx + 'px';
      setActive(navs.indexOf(secList[ak].btn));
    };

    layout();
    onScroll();
    scroll.addEventListener('scroll', onScroll, { passive: true });
    // Re-measure once fonts/images settle (they change section heights).
    setTimeout(() => { layout(); onScroll(); }, 500);
    setTimeout(() => { layout(); onScroll(); }, 1400);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => { layout(); onScroll(); });
      ro.observe(scroll);
      ro.observe(reader);
    }
    // gentle section reveal as each enters view
    if (typeof IntersectionObserver !== 'undefined') {
      const io2 = new IntersectionObserver((es) => {
        es.forEach((e: any) => {
          if (!e.isIntersecting) return;
          e.target.style.opacity = '1';
          e.target.style.transform = 'none';
          Array.from(e.target.children).forEach((k: any, i: number) => {
            k.style.transition = 'opacity .5s ease, transform .5s ease';
            k.style.transitionDelay = Math.min(i * 60, 360) + 'ms';
            k.style.opacity = '0'; k.style.transform = 'translateY(10px)';
            requestAnimationFrame(() => requestAnimationFrame(() => { k.style.opacity = '1'; k.style.transform = 'none'; }));
          });
          io2.unobserve(e.target);
        });
      }, { root: scroll, threshold: 0.08 });
      secs.forEach((s: any) => {
        s.style.transition = 'opacity .6s ease, transform .6s ease';
        const rTop = s.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
        if (rTop > scroll.clientHeight * 0.85) { s.style.opacity = '0'; s.style.transform = 'translateY(16px)'; }
        io2.observe(s);
      });
    }

    const smoothTo = (to: number) => {
      const start = scroll.scrollTop;
      const dist = to - start;
      const dur = 500;
      const t0 = Date.now();
      const ease = (p: number) => 1 - Math.pow(1 - p, 3);
      if (this._anim) clearInterval(this._anim);
      this._anim = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / dur);
        scroll.scrollTop = start + dist * ease(p);
        onScroll();
        if (p >= 1) { clearInterval(this._anim as any); this._anim = null; }
      }, 16);
    };
    // Delegate on the stable reader element so clicks survive template re-renders.
    reader.addEventListener('click', (e: any) => {
      // [data-nav] is a rail label; [data-jump] is any other element (the side
      // column's hexagram) that scrolls to a section without joining the rail.
      const btn = e.target.closest && e.target.closest('[data-nav], [data-jump]');
      if (!btn || !reader.contains(btn)) return;
      const target = secFor(btn.getAttribute('data-nav') || btn.getAttribute('data-jump'));
      if (!target) return;
      if (btn.tagName === 'A') e.preventDefault();
      const top = target.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 12;
      const max = scroll.scrollHeight - scroll.clientHeight;
      smoothTo(Math.max(0, Math.min(top, max)));
    });
  }

  render() {
    return (
      <div className="card-reading card-reading--desktop" ref={(el) => { this.rootEl = el; }} onClick={this.handleShareClick}>
        <CardReadingDesktopMarkup vals={this.renderVals()} />
      </div>
    );
  }
}

export default CardReadingDesktopHost;
