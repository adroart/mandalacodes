/* Host for the generated Earth's Breath markup. The controller below is the
   template's own `class Component` (controller.txt) ported VERBATIM — only two
   changes: it extends React.Component and renders <EBReadingMarkup vals={...}/>,
   and the Card-1 constants (KEYWORDS / MOVING / OVERLAYS / SHARE /
   CURRENT_CODE / image) are injected from `props.data` so all 64 cards work.
   Animation + interaction logic is unchanged from the file, except that the
   Relations panel’s orbit (KIN / RELDATA / relSel) is gone: the panel now
   mounts `relationsSlot`, a React component with its own state. */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { themeCanvasFont } from '../../../../shared/themeFonts';
import { OracleEntrancePortal } from '../OracleEntrancePortal';
import { EBReadingMarkup } from './EBReading.generated';

export interface EBData {
  cardName: string;
  code: number;
  imageUrl: string;        // hero/lightbox/story image
  keywords: string[];
  shareUrl: string;
  shareText: string;
  moving: { n: number; image: string; becomes: string; text: string }[];
  overlays: Record<string, { kicker: string; title: string; sub: string; gratitude: string; paras: string[] }>;
  // UL panel reading + invocation, I Ching reading/judgement/image/combination, GK, HD, Body — bound text
  text: Record<string, any>;
}

interface HostProps {
  data: EBData;
  palette?: 'daybook' | 'nightfall' | 'stone';
  accent?: string;
  reduceMotion?: boolean;
  showEntrance?: boolean;
  onAcquire?: () => void;     // bridge to the app BuySheet (the previous Acquire panel)
  onShare?: () => void;       // bridge to the app share sheet (the previous Share panel)
  onOpenCode: (code: number) => void; // route from a cast directly to its resulting code
  chartSlot?: React.ReactNode; // the real profile-aware "in your chart" callout (legacy bottom mount)
  headerChartSlot?: React.ReactNode; // the in-your-chart line in the header, under Acquire/Share
  headerActionsSlot?: React.ReactNode; // the two hero action boxes (art + chart), replacing the built-in Acquire/Share pair
  invocationSlot?: React.ReactNode; // hand-authored live invocation, mounted immediately after UL prose
  relationsSlot?: React.ReactNode; // the Relations panel’s body: the stack of kin under the intro line
  hdChannelSlot?: React.ReactNode; // the is-this-channel-in-your-chart line, under What Completes It on the Human Design panel
}

type ChoreographyPhase = 'entrance' | 'exiting' | 'hero' | 'reading';

export class EBReadingHost extends React.Component<HostProps, any> {
  // ── refs / maps (verbatim) ──
  rootEl: any; veilEl: any; navIndEl: any; navScrollEl: any; trigramEl: any;
  chartInputEl: any; stageEl: any; coinsEl: any; ivLabelEl: any;
  navEls = new Map<string, any>();
  gkEls = new Map<string, any>();
  panelEls = new Map<string, any>();
  ivEls = new Map<string, any>();
  ivcEls = new Map<string, any>();
  observer: any; revealObs: any; glyphObs: any; repositionNav: any; updateReadingProgress: any; onKey: any;
  visibility: any;
  invocationMount: HTMLElement | null = null;
  invocationRoot: Root | null = null;
  invocationObserver: MutationObserver | null = null;
  entranceExitTimer: ReturnType<typeof setTimeout> | null = null;
  heroTimer: ReturnType<typeof setTimeout> | null = null;
  choreographySafetyTimer: ReturnType<typeof setTimeout> | null = null;
  castTimer: ReturnType<typeof setTimeout> | null = null;
  castInFlight = false;
  revealScanFrame: number | null = null;
  revealTargets = new WeakSet<HTMLElement>();
  glyphTargets = new WeakSet<HTMLElement>();
  rootAriaHidden: string | null = null;
  rootWasInert = false;

  state = {
    entranceDismissed: false,
    choreography: ((this.props.showEntrance ?? true) ? 'entrance' : 'reading') as ChoreographyPhase,
    active: 'ul',
    cast: null as any,
    casting: false,
    lightbox: false,
    share: false,
    buy: false,
    overlay: null as any,
    copied: false,
    storyLabel: 'Instagram Story',
    chartPreview: false,
    chartSubmitted: false,
    index: false,
    indexFocus: 1,
    readingProgress: 0,
  };

  // Card-specific constants now come from props.data (was hardcoded Card 1).
  get MOVING() { return this.props.data.moving; }
  get KEYWORDS() { return this.props.data.keywords; }
  get OVERLAYS() { return this.props.data.overlays; }
  get CURRENT_CODE() { return this.props.data.code; }
  get SHARE_URL() { return this.props.data.shareUrl; }
  get SHARE_TEXT() { return this.props.data.shareText; }

  // King Wen order (verbatim from the template)
  KINGWEN: [number, string, string][] = [
    [1,'The Creative','111111'],[2,'The Receptive','000000'],[3,'Difficulty at the Beginning','100010'],[4,'Youthful Folly','010001'],
    [5,'Waiting','111010'],[6,'Conflict','010111'],[7,'The Army','010000'],[8,'Holding Together','000010'],
    [9,'Small Taming','111011'],[10,'Treading','110111'],[11,'Peace','111000'],[12,'Standstill','000111'],
    [13,'Fellowship','101111'],[14,'Great Possession','111101'],[15,'Modesty','001000'],[16,'Enthusiasm','000100'],
    [17,'Following','100110'],[18,'Work on the Decayed','011001'],[19,'Approach','110000'],[20,'Contemplation','000011'],
    [21,'Biting Through','100101'],[22,'Grace','101001'],[23,'Splitting Apart','000001'],[24,'Return','100000'],
    [25,'Innocence','100111'],[26,'Great Taming','111001'],[27,'Nourishment','100001'],[28,'Great Preponderance','011110'],
    [29,'The Abysmal','010010'],[30,'The Clinging','101101'],[31,'Influence','001110'],[32,'Duration','011100'],
    [33,'Retreat','001111'],[34,'Great Power','111100'],[35,'Progress','000101'],[36,'Darkening of the Light','101000'],
    [37,'The Family','101011'],[38,'Opposition','110101'],[39,'Obstruction','001010'],[40,'Deliverance','010100'],
    [41,'Decrease','110001'],[42,'Increase','100011'],[43,'Breakthrough','111110'],[44,'Coming to Meet','011111'],
    [45,'Gathering Together','000110'],[46,'Pushing Upward','011000'],[47,'Oppression','010110'],[48,'The Well','011010'],
    [49,'Revolution','101110'],[50,'The Cauldron','011101'],[51,'The Arousing','100100'],[52,'Keeping Still','001001'],
    [53,'Development','001011'],[54,'The Marrying Maiden','110100'],[55,'Abundance','101100'],[56,'The Wanderer','001101'],
    [57,'The Gentle','011011'],[58,'The Joyous','110110'],[59,'Dispersion','010011'],[60,'Limitation','110010'],
    [61,'Inner Truth','110011'],[62,'Small Preponderance','001100'],[63,'After Completion','101010'],[64,'Before Completion','010101'],
  ];

  openIndex = () => this.setState({ index: true, indexFocus: this.props.data.code, share: false });
  closeIndex = () => this.setState({ index: false });
  setIndexFocus = (n: number) => this.setState({ indexFocus: n });
  toggleChartPreview = () => this.setState({ chartPreview: !this.state.chartPreview });
  submitChart = (e: any) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ chartSubmitted: true }); };
  registerChartInput = (el: any) => { this.chartInputEl = el; };
  registerRoot = (el: any) => {
    this.rootEl = el;
    if (!el) return;
    const generatedLayers = Array.from(el.children).filter((child: any) => child.getAttribute('aria-hidden') === 'true').slice(0, 2) as HTMLElement[];
    generatedLayers[0]?.setAttribute('data-oracle-generated-grain', '');
    generatedLayers[1]?.setAttribute('data-oracle-generated-veil', '');
  };
  registerVeil = (el: any) => { this.veilEl = el; };
  registerNavInd = (el: any) => { this.navIndEl = el; };
  registerNavScroll = (el: any) => { this.navScrollEl = el; };
  registerTrigram = (el: any) => { this.trigramEl = el; };

  scrollGK = (k: string) => {
    const el = this.gkEls.get(k);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    const se = document.scrollingElement || document.documentElement;
    se.scrollTop = top; window.scrollTo(0, top);
  };

  componentDidMount() {
    const appRoot = document.getElementById('root');
    this.rootAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null;
    this.rootWasInert = !!appRoot?.hasAttribute('inert');
    this.syncEntranceLayer();
    this.setBodyLock(this.isLocked());
    this.updateNav(this.state.active);
    this.onKey = (e: any) => {
      if (e.key === 'Escape') {
        if (this.state.index) return this.setState({ index: false });
        if (this.state.lightbox) return this.setState({ lightbox: false });
        if (this.state.share) return this.setState({ share: false });
        if (this.state.buy) return this.setState({ buy: false });
        if (this.state.overlay) return this.setState({ overlay: null });
        if (this.entranceActive()) return this.dismissEntrance();
      }
      if (this.entranceActive() && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.dismissEntrance(); }
    };
    window.addEventListener('keydown', this.onKey);

    if (this.rootEl) {
      const prose = this.rootEl.querySelector('section[data-chapter="ul"] > div > div[style*="flex-direction: column"]');
      if (prose?.parentElement) {
        this.invocationMount = document.createElement('div');
        this.invocationMount.className = 'oracle-invocation-mount';
        prose.insertAdjacentElement('afterend', this.invocationMount);
        this.invocationRoot = createRoot(this.invocationMount);
        if (typeof MutationObserver !== 'undefined') {
          this.invocationObserver = new MutationObserver(() => {
            if (this.state.choreography === 'reading') this.scheduleRevealScan();
          });
          this.invocationObserver.observe(this.invocationMount, { childList: true, subtree: true });
        }
        this.invocationRoot.render(this.props.invocationSlot ?? null);
      }
    }

    if (this.stageEl) {
      this.stageEl.setAttribute('data-oracle-flow', '');
      if (typeof IntersectionObserver !== 'undefined') {
        this.observer = new IntersectionObserver((entries) => {
          entries.forEach((en: any) => {
            const key = en.target.dataset.chapter;
            this.visibility = this.visibility || {};
            this.visibility[key] = en.intersectionRatio;
          });
          let best: any = null, bestR = 0;
          Object.keys(this.visibility || {}).forEach((k) => { if (this.visibility[k] > bestR) { bestR = this.visibility[k]; best = k; } });
          if (best && bestR > 0.5 && best !== this.state.active) { this.setState({ active: best }); this.updateNav(best); }
        }, { root: null, rootMargin: '-18% 0px -62% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
        this.panelEls.forEach((el) => { if (el) this.observer.observe(el); });
      }
    }

    if (this.rootEl) {
      const prose = this.rootEl.querySelector('section[data-chapter="ul"] > div > div[style*="flex-direction: column"]');
      if (prose) {
        prose.setAttribute('data-reading-prose', '');
        prose.setAttribute('data-oracle-reading-prose', '');
      }
      if (this.state.choreography === 'reading') this.armReadingReveals();
    }

    this.repositionNav = () => this.updateNav(this.state.active);
    window.addEventListener('resize', this.repositionNav);
    this.updateReadingProgress = () => {
      if (!this.rootEl) return;
      const rect = this.rootEl.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.max(0, Math.min(100, (-rect.top / distance) * 100));
      if (Math.abs(progress - this.state.readingProgress) > 0.25) this.setState({ readingProgress: progress });
    };
    window.addEventListener('scroll', this.updateReadingProgress, { passive: true });
    if (document.fonts && (document.fonts as any).ready) (document.fonts as any).ready.then(() => this.repositionNav()).catch(() => {});
    requestAnimationFrame(() => { this.updateNav(this.state.active); this.updateReadingProgress(); this.selectIv('hex'); });
  }

  componentDidUpdate() {
    this.syncEntranceLayer();
    this.setBodyLock(this.isLocked());
    this.invocationRoot?.render(this.props.invocationSlot ?? null);
    if (this.state.choreography === 'reading') this.scheduleRevealScan();
  }
  componentWillUnmount() {
    this.restoreEntranceLayer();
    window.removeEventListener('keydown', this.onKey);
    if (this.observer) this.observer.disconnect();
    if (this.revealObs) this.revealObs.disconnect();
    if (this.glyphObs) this.glyphObs.disconnect();
    if (this.entranceExitTimer) clearTimeout(this.entranceExitTimer);
    if (this.heroTimer) clearTimeout(this.heroTimer);
    if (this.choreographySafetyTimer) clearTimeout(this.choreographySafetyTimer);
    if (this.castTimer) clearTimeout(this.castTimer);
    this.castInFlight = false;
    if (this.revealScanFrame !== null) cancelAnimationFrame(this.revealScanFrame);
    this.invocationObserver?.disconnect();
    this.invocationObserver = null;
    if (this.repositionNav) window.removeEventListener('resize', this.repositionNav);
    // The host unmounts inside a React render whenever one card routes to
    // another (the page keys the host by card number), and unmounting a
    // nested root synchronously there is a React warning. Defer it a tick.
    const invocationRoot = this.invocationRoot;
    const invocationMount = this.invocationMount;
    this.invocationRoot = null;
    this.invocationMount = null;
    setTimeout(() => {
      invocationRoot?.unmount();
      invocationMount?.remove();
    }, 0);
    if (this.updateReadingProgress) window.removeEventListener('scroll', this.updateReadingProgress);
    this.setBodyLock(false);
  }

  entranceActive() { return (this.props.showEntrance ?? true) && !this.state.entranceDismissed; }
  syncEntranceLayer = () => {
    const active = this.entranceActive();
    document.documentElement.classList.toggle('oracle-entrance-active', active);
    const appRoot = document.getElementById('root');
    if (!appRoot) return;
    if (active) {
      appRoot.setAttribute('inert', '');
      appRoot.setAttribute('aria-hidden', 'true');
      return;
    }
    if (this.rootWasInert) appRoot.setAttribute('inert', ''); else appRoot.removeAttribute('inert');
    if (this.rootAriaHidden === null) appRoot.removeAttribute('aria-hidden'); else appRoot.setAttribute('aria-hidden', this.rootAriaHidden);
  };
  restoreEntranceLayer = () => {
    document.documentElement.classList.remove('oracle-entrance-active');
    const appRoot = document.getElementById('root');
    if (!appRoot) return;
    if (this.rootWasInert) appRoot.setAttribute('inert', ''); else appRoot.removeAttribute('inert');
    if (this.rootAriaHidden === null) appRoot.removeAttribute('aria-hidden'); else appRoot.setAttribute('aria-hidden', this.rootAriaHidden);
  };
  isLocked() { return this.state.choreography !== 'reading' || this.state.lightbox || this.state.share || this.state.buy || !!this.state.overlay || this.state.index; }
  setBodyLock(on: boolean) { try { document.body.style.overflow = on ? 'hidden' : ''; } catch (e) {} }

  scheduleRevealScan = () => {
    if (this.revealScanFrame !== null) cancelAnimationFrame(this.revealScanFrame);
    this.revealScanFrame = requestAnimationFrame(() => {
      this.revealScanFrame = null;
      this.armReadingReveals();
    });
  };

  showAllReadingContent = () => {
    if (!this.rootEl) return;
    const root = this.rootEl as HTMLElement;
    root.querySelectorAll<HTMLElement>('[data-oracle-reveal]').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    root.querySelectorAll<HTMLElement>('[data-glyph]').forEach((el) => {
      el.style.clipPath = 'none';
      el.style.opacity = '1';
    });
  };

  armReadingReveals = () => {
    if (!this.rootEl || this.state.choreography !== 'reading') return;

    const root = this.rootEl as HTMLElement;
    const prose = root.querySelector<HTMLElement>('[data-oracle-reading-prose]');
    const proseParagraphs = Array.from(root.querySelectorAll<HTMLElement>([
      'section[data-chapter="ul"] [data-oracle-reading-prose] > p',
      'section[data-chapter="iching"] div[style*="flex-direction: column"] > p',
      'section[data-chapter="genekeys"] [data-gk] div[style*="flex-direction: column"] > p',
      'section[data-chapter="humandesign"] div[style*="flex-direction: column"] > p',
      'section[data-chapter="body"] div[style*="flex-direction: column"] > p',
      'section[data-chapter="relations"] div[style*="flex-direction: column"] > p',
    ].join(',')));
    const invocationBlocks = Array.from(root.querySelectorAll<HTMLElement>(
      '.oracle-invocation-mount > article > :is(h2,h3,p)',
    ));
    const editorialBlocks = Array.from(root.querySelectorAll<HTMLElement>(
      'section[data-chapter] > div > :is(p,h2,h3,header,div,details,figure)',
    )).filter((el) => el !== prose && !proseParagraphs.some((paragraph) => el.contains(paragraph)));
    const authoredLeaves = Array.from(root.querySelectorAll<HTMLElement>(
      'section[data-chapter] > div > div > :is(p,h2,h3,header,details,figure), section[data-chapter] [data-gk] > :is(p,h2,h3,details)',
    )).filter((el) => !proseParagraphs.some((paragraph) => el !== paragraph && el.contains(paragraph)));
    const revealCandidates = Array.from(new Set([...editorialBlocks, ...authoredLeaves, ...proseParagraphs, ...invocationBlocks]));
    const reveal = revealCandidates.filter((candidate) => (
      !revealCandidates.some((other) => other !== candidate && candidate.contains(other))
    ));
    const glyphs = Array.from(root.querySelectorAll<HTMLElement>('[data-glyph]'));
    const reduce = !!this.props.reduceMotion || typeof IntersectionObserver === 'undefined';

    try {
      if (!reduce && !this.revealObs) {
        this.revealObs = new IntersectionObserver((entries) => {
          entries.forEach((entry: any) => {
            if (!entry.isIntersecting) return;
            const el = entry.target as HTMLElement;
            el.style.opacity = '1';
            el.style.transform = 'none';
            this.revealObs.unobserve(el);
          });
        }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });
      }
      if (!reduce && !this.glyphObs) {
        this.glyphObs = new IntersectionObserver((entries) => {
          entries.forEach((entry: any) => {
            if (!entry.isIntersecting) return;
            const el = entry.target as HTMLElement;
            el.style.clipPath = 'inset(0 0 0% 0)';
            el.style.opacity = '1';
            this.glyphObs.unobserve(el);
          });
        }, { threshold: 0.2 });
      }

      reveal.forEach((el) => {
        el.setAttribute('data-oracle-reveal', '');
        if (this.revealTargets.has(el)) return;
        this.revealTargets.add(el);
        if (reduce) {
          el.style.opacity = '1';
          el.style.transform = 'none';
          return;
        }
        el.style.opacity = '0';
        el.style.transform = 'translateY(26px)';
        el.style.transition = 'opacity 900ms cubic-bezier(.22,.61,.36,1), transform 900ms cubic-bezier(.22,.61,.36,1)';
        this.revealObs.observe(el);
      });
      glyphs.forEach((el) => {
        if (this.glyphTargets.has(el)) return;
        this.glyphTargets.add(el);
        if (reduce) {
          el.style.clipPath = 'none';
          el.style.opacity = '1';
          return;
        }
        el.style.clipPath = 'inset(0 0 100% 0)';
        el.style.opacity = '0';
        el.style.transition = 'clip-path 900ms cubic-bezier(.22,.61,.36,1), opacity 600ms ease';
        this.glyphObs.observe(el);
      });
    } catch (e) {
      reveal.forEach((el) => el.setAttribute('data-oracle-reveal', ''));
      this.showAllReadingContent();
    }
  };

  clearChoreographyTimers = () => {
    if (this.entranceExitTimer) clearTimeout(this.entranceExitTimer);
    if (this.heroTimer) clearTimeout(this.heroTimer);
    if (this.choreographySafetyTimer) clearTimeout(this.choreographySafetyTimer);
    this.entranceExitTimer = null;
    this.heroTimer = null;
    this.choreographySafetyTimer = null;
  };

  finishChoreography = () => {
    this.clearChoreographyTimers();
    this.setState({ entranceDismissed: true, choreography: 'reading' }, () => this.armReadingReveals());
  };

  dismissEntrance = () => {
    if (this.state.choreography !== 'entrance') return;
    this.clearChoreographyTimers();

    if (this.props.reduceMotion) {
      this.finishChoreography();
      return;
    }

    this.setState({ choreography: 'exiting' });
    try {
      this.choreographySafetyTimer = setTimeout(this.finishChoreography, 1_600);
      this.entranceExitTimer = setTimeout(() => {
        this.entranceExitTimer = null;
        this.setState({ entranceDismissed: true, choreography: 'hero' }, () => {
          this.heroTimer = setTimeout(this.finishChoreography, 620);
        });
      }, 420);
    } catch (e) {
      this.finishChoreography();
    }
  };

  go = (key: string) => {
    this.flashVeil(key);
    this.setState({ active: key });
    this.updateNav(key);
    const panel = this.panelEls.get(key);
    if (panel) {
      const y = panel.getBoundingClientRect().top + window.scrollY - 112;
      const target = Math.max(0, y);
      const se = document.scrollingElement || document.documentElement;
      se.scrollTop = target; window.scrollTo(0, target);
    }
  };

  flashVeil(key: string) {
    if (this.props.reduceMotion || !this.veilEl) return;
    const dark = key === 'iching' || key === 'humandesign';
    const tone = dark ? 'var(--d-bg)' : (key === 'relations' ? 'var(--l-soft)' : 'var(--l-bg)');
    this.veilEl.style.background = tone;
    this.veilEl.style.animation = 'none';
    void this.veilEl.offsetWidth;
    this.veilEl.style.animation = 'ulVeil 560ms ease both';
  }

  updateNav(active: string) {
    this.navEls.forEach((el, key) => {
      if (!el) return;
      const on = key === active;
      el.style.color = on ? 'var(--l-1)' : 'var(--l-3)';
      el.style.borderBottomColor = 'transparent';
      el.style.fontWeight = on ? '600' : '500';
    });
    const activeEl = this.navEls.get(active);
    if (this.navIndEl && activeEl) {
      this.navIndEl.style.opacity = '1';
      this.navIndEl.style.width = activeEl.offsetWidth + 'px';
      this.navIndEl.style.transform = 'translate(' + activeEl.offsetLeft + 'px,' + (activeEl.offsetTop + activeEl.offsetHeight - 2) + 'px)';
    }
    const sc = this.navScrollEl;
    if (sc && activeEl && sc.scrollWidth > sc.clientWidth + 2) {
      const target = activeEl.offsetLeft - (sc.clientWidth - activeEl.offsetWidth) / 2;
      const max = sc.scrollWidth - sc.clientWidth;
      sc.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: this.props.reduceMotion ? 'auto' : 'smooth' });
    }
  }

  selectIv(view: string) {
    this.ivEls.forEach((el, k) => { if (el) el.style.background = k === view ? 'rgba(199,160,91,0.06)' : 'none'; });
    this.ivcEls.forEach((el, k) => { if (el) el.style.display = k === view ? 'block' : 'none'; });
    if (this.ivLabelEl) this.ivLabelEl.textContent = view === 'hex' ? 'Combination' : view === 'upper' ? 'Upper nature' : 'Lower nature';
    if (this.trigramEl) {
      this.trigramEl.querySelectorAll('[data-line]').forEach((b: any) => {
        const n = parseInt(b.dataset.line, 10);
        let on = true;
        if (view === 'upper') on = n >= 4; else if (view === 'lower') on = n <= 3;
        b.style.opacity = on ? '1' : '0.18';
        b.style.transform = on ? 'scaleX(1)' : 'scaleX(0.82)';
      });
    }
  }

  doCast = () => {
    if (this.castInFlight || this.state.cast) return;
    this.castInFlight = true;
    this.setState({ casting: true });

    // The card carries the hexagram. The coins only resolve which of ITS lines
    // are moving — throwing a fresh hexagram would leave the reading below
    // describing a hexagram the reader never cast.
    //
    // With three coins a line is "old" (moving) on 1 throw in 8, and young on
    // 3 in 8. Holding the line's polarity fixed, that leaves it moving one
    // time in four. KINGWEN bits are bottom-to-top, same order as `lines`.
    const bits = (this.KINGWEN[this.CURRENT_CODE - 1] || this.KINGWEN[0])[2];
    const lines: any[] = [];
    for (let i = 0; i < 6; i++) {
      lines.push({ yang: bits[i] === '1', moving: Math.random() < 0.25 });
    }
    const finishCast = () => {
      this.castTimer = null;
      this.castInFlight = false;
      this.setState({ cast: { lines }, casting: false });
    };

    // The coins flip once, then the result takes their place. The final
    // sibling lands at 370ms, leaving one frame before the result appears.
    if (this.coinsEl && !this.props.reduceMotion) {
      Array.from(this.coinsEl.children).forEach((c: any, i: number) => {
        c.style.animation = 'none'; void c.offsetWidth;
        c.style.animation = `ulCoinTumble 300ms cubic-bezier(.16,1,.3,1) ${i * 35}ms both`;
      });
      this.castTimer = setTimeout(finishCast, 380);
    } else {
      finishCast();
    }
  };

  copyLink = () => {
    try { navigator.clipboard.writeText(this.SHARE_URL); } catch (e) {}
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 1800);
    setTimeout(() => this.setState({ share: false, copied: false }), 1600);
  };

  generateStory = async () => {
    this.setState({ storyLabel: 'Saving…' });
    try {
      await Promise.all([
        (document.fonts as any).load(themeCanvasFont('400', 88, 'display')),
        (document.fonts as any).load(themeCanvasFont('400', 32, 'ui')),
        (document.fonts as any).load(themeCanvasFont('400', 32, 'reading')),
      ]).catch(() => {});
      const cardImg: HTMLImageElement = await new Promise((res, rej) => {
        const im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = () => res(im); im.onerror = rej; im.src = this.props.data.imageUrl;
      });
      const W = 1080, H = 1920;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#16130E'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(cardImg, 0, 80, W, W);
      const g = ctx.createLinearGradient(0, 940, 0, 1180);
      g.addColorStop(0, 'rgba(22,19,14,0)'); g.addColorStop(1, 'rgba(22,19,14,1)');
      ctx.fillStyle = g; ctx.fillRect(0, 940, W, 240);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#C7A05B'; ctx.font = themeCanvasFont('400', 26, 'ui');
      ctx.fillText('UNIVERSAL LANGUAGE ORACLE', W / 2, 1240);
      ctx.fillStyle = '#ECE4D5'; ctx.font = themeCanvasFont('400', 84, 'display');
      ctx.fillText(this.props.data.cardName, W / 2, 1345);
      ctx.fillStyle = '#7A7160'; ctx.font = themeCanvasFont('400', 30, 'ui');
      ctx.fillText('Code ' + String(this.props.data.code).padStart(2, '0'), W / 2, 1418);
      ctx.fillStyle = '#ABA08C'; ctx.font = themeCanvasFont('400', 30, 'ui');
      ctx.fillText(this.props.data.keywords.slice(0, 3).join(' · '), W / 2, 1492);
      ctx.strokeStyle = '#3a342b'; ctx.beginPath(); ctx.moveTo(390, 1556); ctx.lineTo(690, 1556); ctx.stroke();
      ctx.fillStyle = '#7A7160'; ctx.font = themeCanvasFont('400', 30, 'reading');
      ctx.fillText('Open the reading and receive what it holds.', W / 2, 1620);
      const blob: Blob = await new Promise((res) => c.toBlob(res as any, 'image/jpeg', 0.92));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `universal-language-code-${String(this.props.data.code).padStart(2, '0')}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {}
    this.setState({ storyLabel: 'Instagram Story', share: false });
  };

  buildRing() {
    const CX = 550, CY = 550, R = 452, HEXW = 34, lineH = 4.5, gap = 2.4, brokenGap = 8;
    const HEXH = 5 * (lineH + gap) + lineH;
    const half = (HEXW - brokenGap) / 2;
    const motionOn = !this.props.reduceMotion;
    const items: any[] = [];
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * 2 * Math.PI - Math.PI / 2;
      const x = CX + Math.cos(ang) * R, y = CY + Math.sin(ang) * R;
      const rot = (i / 64) * 360 + 180;
      // Each ring position draws the REAL King Wen hexagram for that seat
      // (number i+1), not a raw binary count — so all 64 are true hexagrams.
      // KINGWEN bits are bottom-to-top; render top-to-bottom via bits[5 - li].
      const bits = this.KINGWEN[i][2];
      const current = this.KINGWEN[i][0] === this.props.data.code;
      const lines: boolean[] = [];
      for (let li = 0; li < 6; li++) lines.push(bits[5 - li] === '1');
      const fill = current ? 'var(--accent)' : 'var(--l-3)';
      const op = current ? 0.95 : 0.3;
      const lineEls = lines.map((solid, li) => {
        const ly = li * (lineH + gap);
        if (solid) return React.createElement('rect', { key: li, x: 0, y: ly, width: HEXW, height: lineH, fill, opacity: op });
        return React.createElement('g', { key: li },
          React.createElement('rect', { x: 0, y: ly, width: half, height: lineH, fill, opacity: op }),
          React.createElement('rect', { x: half + brokenGap, y: ly, width: half, height: lineH, fill, opacity: op }));
      });
      items.push(React.createElement('g', { key: i, transform: `translate(${x},${y}) rotate(${rot}) translate(${-HEXW / 2},${-HEXH / 2})` }, lineEls));
    }
    return React.createElement('svg', { viewBox: '0 0 1100 1100', 'aria-hidden': true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', animation: motionOn ? 'ulRingBloom 1400ms cubic-bezier(.16,1,.3,1) both' : 'none' } },
      React.createElement('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'var(--l-rule)', strokeWidth: 1 }),
      React.createElement('g', { style: { transformOrigin: '550px 550px', animation: motionOn ? 'ulRingSpin 120s linear infinite' : 'none' } }, items));
  }

  buildCastDisplay(lines: any[]) {
    const motionOn = !this.props.reduceMotion;
    const out: any[] = [];
    for (let dom = 0; dom < 6; dom++) {
      const lineNum = 6 - dom;
      const lo = lines[lineNum - 1];
      const delay = motionOn ? (lineNum - 1) * 130 : 0;
      out.push({ key: lineNum, tag: lo.moving ? 'moving' : '', bar: this.castBar(lo, delay, motionOn) });
    }
    return out;
  }

  castBar(lo: any, delay: number, motionOn: boolean) {
    const H = 7, W = 92, GAP = 10;
    const color = lo.moving ? 'var(--accent)' : 'var(--accent-d)';
    const glow = lo.moving ? '0 0 10px 1px var(--accent)' : 'none';
    const anim = motionOn ? `ulLineCast 520ms cubic-bezier(.16,1,.3,1) ${delay}ms both` : 'none';
    const wrap: any = { width: W + 'px', height: H + 'px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transformOrigin: 'center', animation: anim };
    let shape;
    if (lo.yang) {
      shape = React.createElement('span', { style: { width: W + 'px', height: H + 'px', background: color, display: 'block', boxShadow: glow } });
    } else {
      const seg = (W - GAP) / 2;
      shape = React.createElement('span', { style: { display: 'flex', gap: GAP + 'px', width: W + 'px' } },
        React.createElement('span', { style: { width: seg + 'px', height: H + 'px', background: color, display: 'block', boxShadow: glow } }),
        React.createElement('span', { style: { width: seg + 'px', height: H + 'px', background: color, display: 'block', boxShadow: glow } }));
    }
    return React.createElement('span', { style: wrap }, shape);
  }

  buildIndexRing(focus: number) {
    const motionOn = !this.props.reduceMotion;
    const CX = 300, CY = 300, R = 250, HEXW = 20, lineH = 2.6, gap = 1.8;
    const HEXH = 5 * (lineH + gap) + lineH;
    const items = this.KINGWEN.map((hx, k) => {
      const num = hx[0], bits = hx[2];
      const ang = (k / 64) * 2 * Math.PI - Math.PI / 2;
      const x = CX + Math.cos(ang) * R, y = CY + Math.sin(ang) * R;
      const rot = (k / 64) * 360 + 180;
      const isCurrent = num === this.CURRENT_CODE;
      const isFocus = num === focus;
      const fill = isCurrent ? 'var(--accent)' : (isFocus ? 'var(--accent-d)' : 'rgba(236,228,213,0.85)');
      const op = isCurrent || isFocus ? 1 : 0.32;
      const bars: any[] = [];
      for (let li = 0; li < 6; li++) {
        const ly = li * (lineH + gap);
        const solid = bits[5 - li] === '1';
        if (solid) bars.push(React.createElement('rect', { key: li, x: 0, y: ly, width: HEXW, height: lineH, fill, opacity: op }));
        else {
          const seg = (HEXW - 5) / 2;
          bars.push(React.createElement('g', { key: li },
            React.createElement('rect', { x: 0, y: ly, width: seg, height: lineH, fill, opacity: op }),
            React.createElement('rect', { x: seg + 5, y: ly, width: seg, height: lineH, fill, opacity: op })));
        }
      }
      const inner: any[] = [React.createElement('rect', { key: 'hit', x: -7, y: -7, width: HEXW + 14, height: HEXH + 14, fill: 'transparent' }), ...bars];
      if (isFocus && !isCurrent) inner.unshift(React.createElement('circle', { key: 'fr', cx: HEXW / 2, cy: HEXH / 2, r: 17, fill: 'none', stroke: 'var(--accent-d)', strokeWidth: 0.8, opacity: 0.6 }));
      if (isCurrent) inner.unshift(React.createElement('circle', { key: 'cr', cx: HEXW / 2, cy: HEXH / 2, r: 17, fill: 'none', stroke: 'var(--accent)', strokeWidth: 1, opacity: 0.85 }));
      return React.createElement('g', { key: num, transform: `translate(${x},${y}) rotate(${rot}) translate(${-HEXW / 2},${-HEXH / 2})`, style: { cursor: 'pointer' }, onClick: (e: any) => { if (e && e.stopPropagation) e.stopPropagation(); this.setIndexFocus(num); } }, inner);
    });
    return React.createElement('svg', { viewBox: '0 0 600 600', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } },
      React.createElement('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'rgba(236,228,213,0.12)', strokeWidth: 1 }),
      React.createElement('g', { style: { transformOrigin: '300px 300px', animation: motionOn ? 'ulRingSpin 220s linear infinite' : 'none' } }, items));
  }

  buildIndexCenter(focus: number) {
    const hx = this.KINGWEN[focus - 1];
    const isCurrent = focus === this.CURRENT_CODE;
    const action = isCurrent
      ? React.createElement('button', { onClick: () => { this.setState({ index: false }); this.go('iching'); }, style: { pointerEvents: 'auto', marginTop: '8px', fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#16130E', background: 'var(--accent-d)', border: 'none', cursor: 'pointer', padding: '9px 16px' } }, 'Open the reading')
      : React.createElement('a', { href: `/universal-language/${focus}?ref=index`, style: { pointerEvents: 'auto', marginTop: '6px', fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(236,228,213,0.6)', textDecoration: 'none' } }, 'Open Code ' + focus);
    return React.createElement('div', { style: { textAlign: 'center', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', maxWidth: '150px' } },
      React.createElement('div', { style: { fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent-d)' } }, isCurrent ? 'This card' : 'Code ' + focus),
      React.createElement('div', { style: { fontFamily: 'var(--font-display)', fontSize: '44px', lineHeight: 1, color: '#ECE4D5' } }, String(focus)),
      React.createElement('div', { style: { fontFamily: 'var(--font-reading)', letterSpacing: '0.01em', fontSize: '17px', lineHeight: 1.2, color: 'rgba(236,228,213,0.8)' } }, hx[1]),
      action);
  }

  buildCenter() {
    const motionOn = !this.props.reduceMotion;
    // THIS card's actual hexagram — the original prototype drew six solid
    // bars (hexagram 1) as a placeholder for every card. KINGWEN bits are
    // stored bottom-to-top ('1' = yang), same convention as the ring glyphs:
    // row i renders top-to-bottom, so line i reads bits[5 - i]. Broken (yin)
    // lines are two half-bars with the center gap.
    const bits = (this.KINGWEN[this.CURRENT_CODE - 1] || this.KINGWEN[0])[2];
    const rects: any[] = [];
    for (let i = 0; i < 6; i++) {
      const y = i * 13;
      const anim = motionOn ? `ulDraw 280ms ease-out ${560 + i * 110}ms both` : 'none';
      if (bits[5 - i] === '1') {
        rects.push(React.createElement('rect', { key: i, x: 4, y, width: 72, height: 9, fill: 'var(--l-1)', style: { transformBox: 'fill-box', transformOrigin: 'left center', animation: anim } }));
      } else {
        rects.push(React.createElement('rect', { key: `${i}a`, x: 4, y, width: 30, height: 9, fill: 'var(--l-1)', style: { transformBox: 'fill-box', transformOrigin: 'left center', animation: anim } }));
        rects.push(React.createElement('rect', { key: `${i}b`, x: 46, y, width: 30, height: 9, fill: 'var(--l-1)', style: { transformBox: 'fill-box', transformOrigin: 'right center', animation: anim } }));
      }
    }
    return React.createElement('svg', { width: 68, height: 80, viewBox: '0 0 80 80', 'aria-hidden': true }, rects);
  }

  renderVals() {
    const T = this.props.data.text;
    const motionOff = this.props.reduceMotion ? 'off' : 'on';
    const cast = this.state.cast;
    const lines = cast ? cast.lines : null;
    const movingNums = lines ? lines.map((l: any, i: number) => (l.moving ? i + 1 : 0)).filter(Boolean) : [];
    const hexGlyph = (num: number) => String.fromCodePoint(0x4DC0 + num - 1);
    const hexLook = (bits: string) => { const e = this.KINGWEN.find((x) => x[2] === bits); return e ? { num: e[0], name: e[1], glyph: hexGlyph(e[0]) } : null; };
    let primaryHex: any = null, relatingHex: any = null;
    if (cast && lines) {
      primaryHex = hexLook(lines.map((l: any) => (l.yang ? '1' : '0')).join(''));
      if (movingNums.length) relatingHex = hexLook(lines.map((l: any) => ((l.moving ? !l.yang : l.yang) ? '1' : '0')).join(''));
    }
    const centerHex = relatingHex || primaryHex;
    const castDisplay = lines ? this.buildCastDisplay(lines) : [];
    // The summary only speaks when nothing is moving. When lines ARE moving,
    // the box names both hexagrams and the moving-lines section below numbers
    // them, so a sentence restating either is redundant.
    let castSummary;
    if (cast && movingNums.length === 0) castSummary = (primaryHex ? primaryHex.name : 'The hexagram') + ' stands whole. No lines are moving.';
    else castSummary = '';

    const ov = this.state.overlay ? this.OVERLAYS[this.state.overlay] : null;
    const enc = encodeURIComponent;
    const movingShown = (cast && movingNums.length) ? this.MOVING.filter((m) => movingNums.includes(m.n)) : this.MOVING;
    const movingHeading = (cast && movingNums.length) ? 'Your Moving Lines' : 'The Six Moving Lines';
    // Say the mechanic in plain words. A reader who has never cast before has
    // to be told what a moving line is, and that flipping these is what turns
    // one hexagram into the other.
    const countWord = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][movingNums.length] || String(movingNums.length);
    const many = movingNums.length > 1;
    // Two sentences. Define the term, then name the consequence.
    let movingSub;
    if (cast && movingNums.length) {
      movingSub = countWord + ' of the six lines came up unstable, ' +
        (many ? 'places already in motion. Flip them and ' : 'a place already in motion. Flip it and ') +
        (primaryHex ? primaryHex.name : 'this hexagram') + ' becomes ' +
        (relatingHex ? relatingHex.name : 'the next hexagram') + '.';
    } else {
      movingSub = 'The arc of the lines, from the deep to one step too high.';
    }

    return {
      ...T, // card-bound prose (UL reading/invocation, I Ching, GK, HD, Body) merged in
      cardName: this.props.data.cardName,
      // Alt text names THIS card. It was hardcoded to card 1, so all 64 cards
      // announced themselves as Earth's Breath to screen readers and crawlers.
      // 'Handmade', never 'original' or 'one of one': pieces are made to order
      // and a design can exist in numbered editions. See utils/universalLanguage.ts.
      heroAlt: `${this.props.data.cardName}, Universal Language ${this.props.data.code}. Handmade multi-dimensional wooden sculpture by Adrian Rasmussen.`,
      palette: this.props.palette ?? 'daybook',
      accent: this.props.accent ?? 'bronze',
      motion: motionOff,
      keywords: this.KEYWORDS,
      movingLines: movingShown,
      movingHeading, movingSub,
      showMovingLines: !!(cast && movingNums.length),
      castHexKicker: relatingHex ? 'Moving toward' : 'Your cast',
      castHexGlyph: centerHex ? centerHex.glyph : '',
      castHexLabel: centerHex ? ('Hexagram ' + centerHex.num + ' · ' + centerHex.name) : '',
      // The hexagram the throw actually landed on, named under its own glyph.
      castPresentLabel: primaryHex ? ('Hexagram ' + primaryHex.num + ' · ' + primaryHex.name) : '',
      castMoving: !!relatingHex,
      castStill: !!(cast && !relatingHex),
      // With several lines moving, each line's own `becomes` is NOT the
      // destination above — it is where that line would lead alone. Label it so.
      castMultiMoving: movingNums.length > 1,
      openRelating: () => { if (centerHex) this.props.onOpenCode(centerHex.num); },
      entranceActive: this.entranceActive(),
      dismissEntrance: this.dismissEntrance,
      entranceRing: this.buildRing(),
      entranceCenter: this.buildCenter(),
      registerRoot: this.registerRoot,
      registerVeil: this.registerVeil,
      registerNavInd: this.registerNavInd,
      registerNavScroll: this.registerNavScroll,
      registerTrigram: this.registerTrigram,
      registerNav: (el: any) => { if (el) this.navEls.set(el.dataset.key, el); },
      registerGK: (el: any) => { if (el) this.gkEls.set(el.dataset.gk, el); },
      jumpShadow: () => this.scrollGK('shadow'),
      jumpGift: () => this.scrollGK('gift'),
      jumpSiddhi: () => this.scrollGK('siddhi'),
      registerStage: (el: any) => { this.stageEl = el; },
      registerPanel: (el: any) => { if (el) this.panelEls.set(el.dataset.chapter, el); },
      registerIv: (el: any) => { if (el) this.ivEls.set(el.dataset.iv, el); },
      registerIvc: (el: any) => { if (el) this.ivcEls.set(el.dataset.ivc, el); },
      registerIvLabel: (el: any) => { this.ivLabelEl = el; },
      registerCoins: (el: any) => { this.coinsEl = el; },
      goUL: () => this.go('ul'),
      goIching: () => this.go('iching'),
      goGenekeys: () => this.go('genekeys'),
      goHumandesign: () => this.go('humandesign'),
      goBody: () => this.go('body'),
      goRelations: () => this.go('relations'),
      selHex: () => this.selectIv('hex'),
      selUpper: () => this.selectIv('upper'),
      selLower: () => this.selectIv('lower'),
      doCast: this.doCast,
      casting: !!this.state.casting,
      hasCast: !!this.state.cast,
      noCast: !this.state.cast,
      castDisplay, castSummary,
      openLightbox: () => this.setState({ lightbox: true }),
      closeLightbox: () => this.setState({ lightbox: false }),
      lightboxOpen: this.state.lightbox,
      onImgError: (e: any) => { if (e && e.currentTarget) e.currentTarget.style.opacity = '0'; },
      toggleShare: () => { if (this.props.onShare) { this.props.onShare(); } else this.setState({ share: !this.state.share }); },
      closeShare: () => this.setState({ share: false }),
      shareOpen: this.state.share,
      copyLink: this.copyLink,
      copyLabel: this.state.copied ? 'Copied!' : 'Copy link',
      copyColor: this.state.copied ? 'var(--accent)' : 'var(--l-2)',
      storyLabel: this.state.storyLabel,
      generateStory: this.generateStory,
      waHref: 'https://wa.me/?text=' + enc(this.SHARE_TEXT + '\n' + this.SHARE_URL),
      tgHref: 'https://t.me/share/url?url=' + enc(this.SHARE_URL) + '&text=' + enc(this.SHARE_TEXT),
      twHref: 'https://twitter.com/intent/tweet?text=' + enc(this.SHARE_TEXT) + '&url=' + enc(this.SHARE_URL),
      mailHref: 'mailto:?subject=' + enc(this.SHARE_TEXT) + '&body=' + enc('I wanted to share this oracle card with you:\n\n' + this.SHARE_URL),
      openBuy: () => { if (this.props.onAcquire) this.props.onAcquire(); else this.setState({ buy: true, share: false }); },
      closeBuy: () => this.setState({ buy: false }),
      buyOpen: this.state.buy,
      openOverlayIching: () => this.setState({ overlay: 'iching' }),
      openOverlayGK: () => this.setState({ overlay: 'genekeys' }),
      openOverlayHD: () => this.setState({ overlay: 'humandesign' }),
      closeOverlay: () => this.setState({ overlay: null }),
      overlayOpen: !!this.state.overlay,
      overlayKicker: ov ? ov.kicker : '',
      overlayTitle: ov ? ov.title : '',
      overlaySub: ov ? ov.sub : '',
      overlayParas: ov ? ov.paras : [],
      overlayGratitude: ov ? ov.gratitude : '',
      indexOpen: this.state.index,
      openIndex: this.openIndex,
      closeIndex: this.closeIndex,
      indexRing: this.state.index ? this.buildIndexRing(this.state.indexFocus) : null,
      indexCenter: this.state.index ? this.buildIndexCenter(this.state.indexFocus) : null,
      // The template's built-in chart preview + prompt are disabled — the real
      // profile-aware callout is injected via chartSlot instead, which shows
      // nothing unless the card matches the visitor's saved profile.
      chartPreview: false,
      chartShowPrompt: false,
      chartToggleLabel: this.state.chartPreview ? 'Hide example' : 'See an example',
      toggleChartPreview: this.toggleChartPreview,
      submitChart: this.submitChart,
      registerChartInput: this.registerChartInput,
      relationsSlot: this.props.relationsSlot ?? null,
      stop: (e: any) => { if (e && e.stopPropagation) e.stopPropagation(); },
      chartSlot: this.props.chartSlot ?? null,
      hdChannelSlot: this.props.hdChannelSlot ?? null,
      headerChartSlot: this.props.headerChartSlot ?? null,
      headerActionsSlot: this.props.headerActionsSlot ?? null,
    };
  }

  render() {
    // Establish the template's CSS-variable scope. The design file's tokens
    // (--l-bg, --serif, --accent, the daybook/nightfall palette) are defined on
    // `.eb-reading[data-palette=…]`; this wrapper carries BOTH so every var()
    // in the generated markup resolves and inherits down. Without it the page
    // renders unstyled (the root cause of the "looks nothing like it" bug).
    const palette = this.props.palette ?? 'daybook';
    const motion = this.props.reduceMotion ? 'off' : 'on';
    const systems = [
      ['ul', 'Universal Language', 'UL'],
      ['iching', 'I Ching', 'I Ching'],
      ['genekeys', 'Gene Keys', 'Gene Keys'],
      ['humandesign', 'Human Design', 'Human Design'],
      ['body', 'Body', 'Body'],
      ['relations', 'Relations', null],
    ];
    const vals = this.renderVals();
    return (
      <>
      <div className="eb-reading" data-oracle-reader data-oracle-choreography={this.state.choreography} data-palette={palette} data-accent={this.props.accent ?? 'bronze'} data-motion={motion}>
        <nav className="oracle-reading-progress" data-oracle-progress-nav aria-label="Oracle reading">
          <div className="oracle-reading-progress__jumps" role="navigation" aria-label="Jump to system">
            {systems.map(([key, label, text]) => (
              <button key={key} type="button" aria-label={label} data-active={this.state.active === key ? 'true' : 'false'} onClick={() => this.go(key)}>
                {key === 'relations' ? (
                  <svg data-system-icon="connection" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.4 14.6-1.2 1.2a3.4 3.4 0 0 1-4.8-4.8l3.1-3.1a3.4 3.4 0 0 1 4.8 0m3.3 1.5 1.2-1.2a3.4 3.4 0 0 1 4.8 4.8l-3.1 3.1a3.4 3.4 0 0 1-4.8 0M8.8 15.2l6.4-6.4"/></svg>
                ) : text}
              </button>
            ))}
          </div>
          <div className="oracle-reading-progress__track" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(this.state.readingProgress)}>
            <span data-oracle-progress-fill style={{ transform: `scaleX(${this.state.readingProgress / 100})` }} />
          </div>
        </nav>
        <EBReadingMarkup vals={{ ...vals, entranceActive: false, registerVeil: () => {} }} />
      </div>
      <OracleEntrancePortal
        active={this.entranceActive()}
        choreography={this.state.choreography}
        cardName={vals.cardName}
        keywords={vals.keywords}
        entranceRing={vals.entranceRing}
        entranceCenter={vals.entranceCenter}
        palette={vals.palette}
        accent={vals.accent}
        motion={vals.motion}
        onDismiss={this.dismissEntrance}
        registerVeil={this.registerVeil}
      />
      </>
    );
  }
}

export default EBReadingHost;
