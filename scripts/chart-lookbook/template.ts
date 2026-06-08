/**
 * Print-ready HTML for the chart lookbook. Self-contained (one <style> block,
 * web fonts from Google) so it renders identically whether you run it through
 * Playwright or just open it and Print → Save as PDF.
 *
 * On-brand: paper ground, wood/bronze ink, serif display + humanist sans body.
 * One A4 spread per piece: the art, the sphere it answers in the chart, and the
 * energy (essence, the Gift, the Shadow→Gift→Siddhi spectrum, the line).
 */
import type { LookbookData, LookbookPiece } from './build-data.ts';

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function spread(p: LookbookPiece): string {
  const img = p.image
    ? `<img class="art" src="${p.image}" alt="${esc(p.cardName)}" />`
    : `<div class="art art--missing">image unavailable</div>`;
  const spectrum = [p.shadowName, p.giftName, p.siddhiName].filter(Boolean).join('  →  ');
  return `
  <section class="spread">
    <figure class="art-wrap">${img}
      <figcaption>Code ${p.gate} · Line ${p.line}${p.pieceTitle ? ` · <span class="muted">${esc(p.pieceTitle)}</span>` : ''}</figcaption>
    </figure>
    <div class="meta">
      <p class="sphere">${esc(p.sphere)}</p>
      <p class="role">${esc(p.role)}</p>
      <h2 class="name">${esc(p.cardName) || `Code ${p.gate}`}</h2>
      ${p.essence ? `<p class="essence">${esc(p.essence)}</p>` : ''}
      ${spectrum ? `<p class="spectrum">${esc(spectrum)}</p>` : ''}
      ${p.gift ? `<div class="gift"><span class="lbl">The Gift${p.giftName ? ` · ${esc(p.giftName)}` : ''}</span><p>${esc(p.gift)}</p></div>` : ''}
      ${p.lineReading ? `<div class="line"><span class="lbl">Your line</span><p>${esc(p.lineReading)}</p></div>` : ''}
      <p class="connect">Does this one move you? Sit with the piece, not the words.</p>
    </div>
  </section>`;
}

export function renderHtml(data: LookbookData): string {
  const contact = data.pieces
    .map((p) => `<div class="chip">${p.thumb ? `<img src="${p.thumb}" alt="" />` : ''}<span>${esc(p.sphere)}<br><b>${esc(p.cardName) || p.gate}</b></span></div>`)
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(data.clientName)} — Chart in Art</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Karla:wght@400;600&display=swap" rel="stylesheet" />
<style>
  :root{ --paper:#faf6ef; --ink:#2b2622; --wood:#6b5a48; --bronze:#9a7b4f; --line:#e5dccb; }
  *{ box-sizing:border-box; }
  html,body{ margin:0; background:var(--paper); color:var(--ink); font-family:'Karla',system-ui,sans-serif; }
  h1,h2,.sphere,.name,.display{ font-family:'Cormorant Garamond',Georgia,serif; font-weight:500; }
  .muted{ color:var(--wood); } .lbl{ font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--bronze); display:block; margin-bottom:4px; }

  @page{ size:A4; margin:0; }
  .page{ width:210mm; min-height:297mm; padding:22mm 20mm; page-break-after:always; position:relative; }
  .page:last-child{ page-break-after:auto; }

  /* Cover */
  .cover{ display:flex; flex-direction:column; justify-content:center; }
  .cover .kicker{ font-size:11px; letter-spacing:.32em; text-transform:uppercase; color:var(--bronze); }
  .cover h1{ font-size:64px; line-height:1.02; margin:.2em 0 .1em; }
  .cover .sub{ font-style:italic; font-size:20px; color:var(--wood); max-width:30ch; }
  .contact{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:40px; }
  .chip{ display:flex; gap:8px; align-items:center; font-size:11px; }
  .chip img{ width:42px; height:42px; object-fit:cover; border:1px solid var(--line); }
  .chip b{ font-size:12px; }

  /* Spread */
  .spread{ display:grid; grid-template-columns:1fr 1fr; gap:14mm; align-items:start; }
  .art-wrap{ margin:0; }
  .art{ width:100%; border:1px solid var(--line); background:#efe8da; display:block; }
  .art--missing{ aspect-ratio:1; display:flex; align-items:center; justify-content:center; color:var(--wood); font-size:12px; }
  figcaption{ font-size:11px; color:var(--wood); margin-top:8px; letter-spacing:.04em; }
  .sphere{ font-size:13px; letter-spacing:.22em; text-transform:uppercase; color:var(--bronze); margin:0; }
  .role{ font-style:italic; color:var(--wood); margin:.2em 0 .8em; font-size:14px; }
  .name{ font-size:38px; line-height:1.05; margin:0 0 .35em; }
  .essence{ font-size:16px; line-height:1.55; }
  .spectrum{ font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--bronze); margin:.4em 0 1em; }
  .gift p,.line p{ font-size:13.5px; line-height:1.6; margin:.2em 0 1em; }
  .connect{ font-style:italic; color:var(--wood); border-top:1px solid var(--line); padding-top:10px; margin-top:14px; font-size:13px; }

  .foot{ position:absolute; bottom:12mm; left:20mm; right:20mm; display:flex; justify-content:space-between; font-size:9.5px; color:var(--bronze); letter-spacing:.08em; }
</style></head>
<body>
  <div class="page cover">
    <p class="kicker">Mandala Codes · Universal Language</p>
    <h1>${esc(data.clientName)}<br>Chart in Art</h1>
    <p class="sub">${esc(data.subtitle)}</p>
    <div class="contact">${contact}</div>
    <div class="foot"><span>The codes of your hologenetic profile, rendered as art.</span><span>mandalacodes.com</span></div>
  </div>
  ${data.pieces.map((p) => `<div class="page">${spread(p)}<div class="foot"><span>${esc(p.sequence)} Sequence · ${esc(p.sphere)}</span><span>Code ${p.gate}</span></div></div>`).join('')}
</body></html>`;
}
