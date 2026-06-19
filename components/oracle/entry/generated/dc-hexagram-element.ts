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

class DcImportHexagram extends HTMLElement {
  private _lines: boolean[] = [true, true, true, false, false, false];

  static get observedAttributes() {
    return ['name', 'color'];
  }

  // React assigns array/object props to the element as JS properties.
  set lines(v: boolean[]) {
    this._lines = Array.isArray(v) ? v : this._lines;
    this.render();
  }
  get lines() {
    return this._lines;
  }

  connectedCallback() {
    this.style.display = this.style.display || 'block';
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const color = this.getAttribute('color') || 'var(--ink, #262321)';
    const lines = this._lines || [true, true, true, false, false, false];

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
