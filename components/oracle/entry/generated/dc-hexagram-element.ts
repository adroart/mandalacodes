/* Web Component shim for the generated markup's <dc-import name="Hexagram" …>.
 * The generated OracleEntry.generated.tsx emits <dc-import> custom elements
 * verbatim from the design file — that is correct and must not be hand-edited.
 * This registers a real <dc-import> element that renders the hexagram SVG using
 * the EXACT geometry from the design's Hexagram.dc.html, so the generated markup
 * renders identically without touching the generated file.
 *
 * React passes `lines` (a boolean[]) as a DOM property on the custom element and
 * `color` / `name` / `hint-size` as attributes. We re-render whenever any change. */

const TAG = 'dc-import';

const DEFAULT_LINES: boolean[] = [true, true, true, false, false, false];

class DcImportHexagram extends HTMLElement {
  private _lines: boolean[] | null = null;

  static get observedAttributes() {
    // `lines` MUST be observed: React renders <dc-import lines={boolean[]}> by
    // SERIALIZING the array to an attribute string ("true,false,…"), not by
    // assigning a JS property — so without observing the attribute, every tile
    // kept the default glyph. We parse the CSV in render().
    return ['name', 'color', 'lines'];
  }

  // React may also assign array props directly as a JS property in some paths;
  // honor that too, preferring it over the attribute when present.
  set lines(v: boolean[]) {
    this._lines = Array.isArray(v) ? v : this._lines;
    this.render();
  }
  get lines() {
    return this._lines ?? this._linesFromAttr();
  }

  /* Parse the `lines` attribute ("true,false,true,…") into a boolean[]. */
  private _linesFromAttr(): boolean[] {
    const raw = this.getAttribute('lines');
    if (!raw) return DEFAULT_LINES;
    const parsed = raw.split(',').map((s) => s.trim() === 'true');
    return parsed.length === 6 ? parsed : DEFAULT_LINES;
  }

  connectedCallback() {
    // Upgrade-safe: if React assigned the `lines` property BEFORE this custom
    // element was defined/upgraded, the value landed as a plain own-property that
    // now shadows the class accessor — so the setter never ran and every tile
    // kept the default glyph. Lift that own-property back through the accessor.
    this._upgradeProperty('lines');
    this.style.display = this.style.display || 'block';
    this.render();
  }

  private _upgradeProperty(prop: 'lines') {
    if (Object.prototype.hasOwnProperty.call(this, prop)) {
      const value = (this as any)[prop];
      delete (this as any)[prop];
      (this as any)[prop] = value;
    }
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const color = this.getAttribute('color') || 'var(--ink, #262321)';
    const lines = this._lines ?? this._linesFromAttr();

    // Geometry copied verbatim from Hexagram.dc.html renderVals().
    const LH = 9.6,
      GAP = 6.2;
    const total = 6 * LH + 5 * GAP; // 90.4
    const y0 = (100 - total) / 2;
    const FULL_X = 8,
      FULL_W = 84;
    const HALF_W = 34,
      GAP_X = 16;

    const rects: string[] = [];
    lines.forEach((solid, i) => {
      const y = y0 + i * (LH + GAP);
      if (solid) {
        rects.push(`<rect x="${FULL_X}" y="${y}" width="${FULL_W}" height="${LH}" rx="0.6" fill="${color}" opacity="1"></rect>`);
      } else {
        rects.push(`<rect x="${FULL_X}" y="${y}" width="${HALF_W}" height="${LH}" rx="0.6" fill="${color}" opacity="1"></rect>`);
        rects.push(`<rect x="${FULL_X + HALF_W + GAP_X}" y="${y}" width="${HALF_W}" height="${LH}" rx="0.6" fill="${color}" opacity="1"></rect>`);
      }
    });

    this.innerHTML =
      `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block;overflow:visible">` +
      rects.join('') +
      `</svg>`;
  }
}

let registered = false;
export function ensureDcHexagramElement() {
  if (registered || typeof window === 'undefined' || !window.customElements) return;
  if (!customElements.get(TAG)) {
    customElements.define(TAG, DcImportHexagram);
  }
  registered = true;
}
