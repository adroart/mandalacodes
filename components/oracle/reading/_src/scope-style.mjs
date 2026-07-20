/* Post-converter pass for the Card Reading import.
   The converter emits the design file's <style> block verbatim, which includes
   page-level rules (*, body, a) that would leak into the whole app, and font
   URLs relative to the design project ("public/fonts/..."). This scopes those
   rules under the host's wrapper class and repoints the fonts at Vite's /fonts.

   Re-run after every converter run:
     node components/oracle/reading/_src/scope-style.mjs
   Idempotent — safe to run repeatedly. */
import { readFileSync, writeFileSync } from 'node:fs';

/* The reading body renders inside BOTH shells, so it scopes to the shared
   .card-reading wrapper rather than one variant. */
const TARGETS = [
  ['components/oracle/reading/generated/CardReadingMobile.style.css', '.card-reading--mobile'],
  ['components/oracle/reading/generated/CardReadingDesktop.style.css', '.card-reading--desktop'],
  ['components/oracle/reading/generated/CardReadingBody.style.css', '.card-reading'],
];

const MARKER = '/* scoped by scope-style.mjs */';

for (const [path, wrapper] of TARGETS) {
  let css = readFileSync(path, 'utf8');

  if (css.startsWith(MARKER)) {
    console.log(`${path} — already scoped, skipping`);
    continue;
  }

  // Font URLs: the design project's own relative path -> Vite's public root.
  css = css.replace(/url\('public\/fonts\//g, "url('/fonts/");

  // Split into top-level rules by brace depth. A line can hold several rules
  // (`a{...}a:hover{...}`), so line-splitting would leave the trailing ones
  // unscoped and they would leak into the app.
  const rules = [];
  let buf = '';
  let depth = 0;
  for (const ch of css) {
    buf += ch;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { rules.push(buf.trim()); buf = ''; }
    }
  }
  if (buf.trim()) rules.push(buf.trim());

  const out = [];
  for (const rule of rules) {
    if (!rule) continue;

    // @font-face and @keyframes are global by nature; leave them at top level.
    if (rule.startsWith('@font-face') || rule.startsWith('@keyframes')) {
      out.push(rule);
      continue;
    }

    const brace = rule.indexOf('{');
    if (brace === -1) { out.push(rule); continue; }
    const body = rule.slice(brace);

    const scoped = rule.slice(0, brace).split(',').map((raw) => {
      const s = raw.trim();
      if (!s) return null;
      // `*` -> the wrapper and everything inside it.
      if (s === '*') return `${wrapper},${wrapper} *`;
      // `body`/`html` -> the wrapper IS the page surface for this component.
      if (s === 'body' || s === 'html') return wrapper;
      return `${wrapper} ${s}`;
    }).filter(Boolean).join(',');

    out.push(scoped + body);
  }

  writeFileSync(path, `${MARKER}\n${out.join('\n')}\n`);
  console.log(`${path} — scoped under ${wrapper}`);
}
