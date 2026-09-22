/* Host for the generated Card Reading (mobile) markup. The controller below is
   the template's own `class Component` (CardReadingMobile.controller.txt) ported
   VERBATIM — only three changes:
     1. it extends React.Component and renders <CardReadingMobileMarkup vals={...}/>,
     2. the reader lookup is scoped to this host's own root instead of `document`,
        so a desktop host mounted elsewhere can never be wired twice,
     3. the sample nav/tabs constants are injected from `props.data` so all 64
        cards drive it.
   The scroll engine is adapted for production iPhones: layout is measured only
   when its geometry changes, while marker updates are coalesced to one
   compositor-only write per animation frame. */
import React from 'react';
import { CardReadingMobileMarkup } from './CardReadingMobile.generated';

export interface CardReadingMobileNavItem {
  id: string;
  tab: string;
}

export interface CardReadingMobileTabItem {
  id: string;
  label: string;
  color: string;
  href: string;
}

export interface CardReadingMobileData {
  cardNumber?: string;
  nav?: CardReadingMobileNavItem[];
  tabs?: CardReadingMobileTabItem[];
}

interface HostProps {
  data?: CardReadingMobileData;
  /* Fills the design's <dc-import name="Reading"> slot — the six lens sections,
     each carrying data-sec so the scroll engine can wire them. */
  reading?: React.ReactNode;
  /* Fills the design's artwork slot (id "art-mobile"). */
  artwork?: React.ReactNode;
  /* Fills the design's top bar slot. The mobile file drew its own compact
     brand row; the app passes the site's real bar here instead. */
  topNav?: React.ReactNode;
}

/* The design file's own defaults, kept so the host renders identically to the
   source .dc.html when no data is supplied. */
const DEFAULT_NAV: CardReadingMobileNavItem[] = [
  { id: 'ul', tab: 'UL' },
  { id: 'iching', tab: 'I Ching' },
  { id: 'genekeys', tab: 'Gene Keys' },
  { id: 'humandesign', tab: 'H. Design' },
  { id: 'body', tab: 'Body' },
  { id: 'relations', tab: 'Relations' },
];

const DEFAULT_TABS: CardReadingMobileTabItem[] = [
  { id: 'family', label: 'Family', color: '#80735f', href: '/family' },
  { id: 'forme', label: 'For Me', color: '#80735f', href: '/profile' },
  { id: 'deck', label: 'The 64', color: '#c6a667', href: '/universal-language' },
  { id: 'piece', label: 'Piece', color: '#80735f', href: '/universal-language' },
  { id: 'share', label: 'Share', color: '#80735f', href: '#share' },
];

export class CardReadingMobileHost extends React.Component<HostProps> {
  rootEl: HTMLDivElement | null = null;
  _icons: Record<string, string> = {};
  _wired: WeakSet<Element> = new WeakSet();
  _timer: ReturnType<typeof setTimeout> | null = null;
  _anim: ReturnType<typeof setInterval> | null = null;
  _readerCleanup: Array<() => void> = [];

  renderVals() {
    const data = this.props.data ?? {};
    return {
      nav: data.nav ?? DEFAULT_NAV,
      tabs: data.tabs ?? DEFAULT_TABS,
      slots: { Reading: this.props.reading, TopNav: this.props.topNav },
      images: { 'art-mobile': this.props.artwork },
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
    this._icons = {
      family:'<svg width="22" height="22" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="13" cy="15" r="4"/><circle cx="27" cy="15" r="4"/><path d="M6 30c0-4 3.5-7 7-7s7 3 7 7M20 30c0-4 3.5-7 7-7s7 3 7 7"/></svg>',
      forme:'<svg width="22" height="22" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="4"/><path d="M20 7v5M20 28v5M7 20h5M28 20h5"/></svg>',
      deck:'<svg width="22" height="22" viewBox="0 0 40 40" fill="currentColor"><g><circle cx="11" cy="11" r="1.7"/><circle cx="20" cy="11" r="1.7"/><circle cx="29" cy="11" r="1.7"/><circle cx="11" cy="20" r="1.7"/><circle cx="20" cy="20" r="1.7"/><circle cx="29" cy="20" r="1.7"/><circle cx="11" cy="29" r="1.7"/><circle cx="20" cy="29" r="1.7"/><circle cx="29" cy="29" r="1.7"/></g></svg>',
      piece:'<svg width="22" height="22" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="9" width="24" height="22"/><path d="M8 9l12 11 12-11"/></svg>',
      share:'<svg width="22" height="22" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M10 30c0-9 6-13 15-13M18 10l8 7-8 7"/></svg>'
    };
    this.startReaders();
  }

  componentDidUpdate(previous: HostProps) {
    if (previous.data?.cardNumber === this.props.data?.cardNumber) return;
    // The outer shell survives card routes while its keyed chapters are replaced.
    // Keep its scroll position, but discard the old card's pending navigation
    // and reconnect observers to the new chapters. Prose updates keep their anchor.
    this.stopReaders();
    this.startReaders();
  }

  startReaders() {
    this._wired = new WeakSet();
    this.rootEl?.querySelector('[data-bar-tab="deck"]')?.setAttribute('data-current-hexagram', '');
    let tries = 0;
    const tick = () => {
      let pending = false;
      const scope: ParentNode = this.rootEl ?? document;
      scope.querySelectorAll('[data-tab]').forEach((a) => {
        const slot = a.querySelector('[data-tabicon]');
        if (slot && !slot.innerHTML) { const ic = this._icons[a.getAttribute('data-tab') as string]; if (ic) slot.innerHTML = ic; }
      });
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

  componentWillUnmount() {
    this.stopReaders();
  }

  stopReaders() {
    if (this._timer) clearTimeout(this._timer);
    if (this._anim) clearInterval(this._anim);
    this._timer = null;
    this._anim = null;
    this._readerCleanup.forEach((cleanup) => cleanup());
    this._readerCleanup = [];
  }

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


    const navs = Array.from(reader.querySelectorAll('[data-nav]')) as any[];
    const jb = reader.querySelector('[data-jumpbar]');
    const hfill = reader.querySelector('[data-progressfill-h]') as HTMLElement | null;
    const comet = reader.querySelector('[data-comet]') as HTMLElement | null;
    const artPar = reader.querySelector('[data-artparallax]') as HTMLElement | null;
    if (!navs.length) return;

    const setActive = (idx: number) => {
      navs.forEach((n: any, i: number) => {
        n.style.color = i === idx ? '#c6a667' : '#80735f';
        n.setAttribute('aria-current', i === idx ? 'true' : 'false');
        n.style.transform = i === idx ? 'scale(1.06)' : 'scale(1)';
      });
    };

    let secList: any[] = [];
    let breaks: number[] = [];
    let trackWidth = 0;
    const layout = () => {
      const sTop = scroll.getBoundingClientRect().top;
      secList = navs.map((n: any) => {
        const id = n.getAttribute('data-nav');
        const sec = secFor(id);
        const top = sec ? (sec.getBoundingClientRect().top - sTop + scroll.scrollTop) : 0;
        return { id, top, btn: n };
      }).sort((a: any, b: any) => a.top - b.top);
      breaks = secList.map((s: any) => s.top);
      trackWidth = reader.getBoundingClientRect().width;
    };

    if (hfill) {
      hfill.style.width = '100%';
      hfill.style.transformOrigin = 'left center';
      hfill.style.transition = 'none';
      hfill.style.willChange = 'transform';
    }
    if (comet) {
      comet.style.left = '0px';
      comet.style.transition = 'none';
      comet.style.willChange = 'transform';
    }

    let lastActive = -1;
    const renderScroll = () => {
      const n = breaks.length;
      if (!n) return;
      const pos = scroll.scrollTop;
      if (artPar) artPar.style.transform = 'scale(1.12) translateY(' + (pos * 0.12) + 'px)';
      const den = Math.max(1, scroll.scrollHeight - scroll.clientHeight);
      const frac = Math.max(0, Math.min(1, pos / den));
      if (hfill) hfill.setAttribute('aria-valuenow', String(Math.round(frac * 100)));

      /* Progress marker: the bar and its diamond track scroll across the full
         width of the reader, empty at the top and complete at the bottom, rather
         than hopping between section anchors. */
      const x = frac * trackWidth;
      if (hfill) hfill.style.transform = 'scaleX(' + frac + ')';
      if (comet) comet.style.transform = 'translate3d(' + x + 'px,0,0) translate(-50%,-50%) rotate(45deg)';
      let ak = 0;
      const jumpTop = jb ? jb.getBoundingClientRect().height : 0;
      for (let i = 0; i < n; i++) { if (pos + jumpTop + 20 >= breaks[i]) ak = i; }
      const idx = navs.indexOf(secList[ak].btn);
      if (idx !== lastActive) { lastActive = idx; setActive(idx); }
    };

    // Keep an explicit tab choice anchored while its manuscript/font layout
    // arrives. A wheel, touch, scrollbar or scroll key returns control to the reader.
    let selectedSection: string | null = null;
    const selectedTop = () => {
      const target = selectedSection ? secFor(selectedSection) : null;
      if (!target) return scroll.scrollTop;
      const jumpH = jb ? jb.getBoundingClientRect().height : 0;
      const top = target.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - jumpH - 8;
      return Math.max(0, Math.min(top, scroll.scrollHeight - scroll.clientHeight));
    };
    const releaseSelection = () => {
      selectedSection = null;
      if (this._anim) { clearInterval(this._anim); this._anim = null; }
    };
    const onScrollKey = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) releaseSelection();
    };
    scroll.addEventListener('wheel', releaseSelection, { passive: true });
    scroll.addEventListener('pointerdown', releaseSelection, { passive: true });
    reader.addEventListener('keydown', onScrollKey);

    let scrollFrame: number | null = null;
    const onScroll = () => {
      if (scrollFrame !== null) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        renderScroll();
      });
    };
    const relayout = () => {
      layout();
      if (selectedSection && !this._anim) scroll.scrollTop = selectedTop();
      onScroll();
    };

    layout();
    renderScroll();
    scroll.addEventListener('scroll', onScroll, { passive: true });
    const settleTimers = [
      setTimeout(relayout, 500),
      setTimeout(relayout, 1400),
    ];
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(relayout);
      ro.observe(scroll);
      ro.observe(reader);
      secList.forEach((section) => {
        const element = secFor(section.id);
        if (element) ro?.observe(element);
      });
    }

    const smoothTo = (section: string) => {
      selectedSection = section;
      const start = scroll.scrollTop;
      const dur = 500;
      const t0 = Date.now();
      const ease = (p: number) => 1 - Math.pow(1 - p, 3);
      if (this._anim) clearInterval(this._anim);
      this._anim = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / dur);
        scroll.scrollTop = start + (selectedTop() - start) * ease(p);
        onScroll();
        if (p >= 1) { clearInterval(this._anim as any); this._anim = null; }
      }, 16);
    };
    const onReaderClick = (e: any) => {
      const btn = e.target.closest && e.target.closest('[data-nav]');
      if (!btn || !reader.contains(btn)) return;
      const section = btn.getAttribute('data-nav');
      if (!section || !secFor(section)) return;
      smoothTo(section);
    };
    reader.addEventListener('click', onReaderClick);
    this._readerCleanup.push(() => {
      scroll.removeEventListener('scroll', onScroll);
      scroll.removeEventListener('wheel', releaseSelection);
      scroll.removeEventListener('pointerdown', releaseSelection);
      reader.removeEventListener('keydown', onScrollKey);
      reader.removeEventListener('click', onReaderClick);
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      settleTimers.forEach((timer) => clearTimeout(timer));
      ro?.disconnect();
    });
  }

  render() {
    return (
      <div className="card-reading card-reading--mobile" ref={(el) => { this.rootEl = el; }} onClick={this.handleShareClick}>
        <CardReadingMobileMarkup vals={this.renderVals()} />
      </div>
    );
  }
}

export default CardReadingMobileHost;
