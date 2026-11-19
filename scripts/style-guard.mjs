#!/usr/bin/env node
/**
 * Style guard: counts hard-coded colours, control sizes, font sizes and
 * font families in every app style and component file, outside the master
 * style file (src/theme.css).
 *
 * The master file owns colours, type, spacing, radii, control heights and
 * fonts; sections use its roles (text-body, text-ink, bg-page ...).
 * Anything written by hand elsewhere is drift. The counts per file are
 * frozen in tests/unit/style-guard.baseline.json; tests/unit/styleGuard.test.ts
 * fails when any file goes above its frozen count, so the number can only
 * fall. When you migrate a file to the tokens, lower its baseline:
 *
 *   node scripts/style-guard.mjs --write
 *
 * Usage: node scripts/style-guard.mjs          print the totals and worst files
 *        node scripts/style-guard.mjs --write  rewrite the baseline from today
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = path.join(ROOT, 'tests/unit/style-guard.baseline.json');

/** Folders whose files render the site, the admin and the sign-in. */
const SCAN_DIRS = ['components', 'src', 'shared'];
const SCAN_FILES = ['App.tsx'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
/** The master file itself, and tests, are allowed literals. */
const EXEMPT = new Set(['src/theme.css']);

/** A hard-coded colour: hex, rgb(), hsl(), oklch(). */
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/g;
/**
 * A hard-coded control size: a pixel height, min-height or padding written
 * by hand in CSS or an inline style object, or a Tailwind arbitrary
 * height/padding value like h-[46px] or py-[13px].
 */
const SIZE_RES = [
  /\b(?:min-)?height\s*:\s*[^;{}\n'"`,]*?\d+(?:\.\d+)?px/g,
  /\bpadding(?:-[a-z]+)?\s*:\s*[^;{}\n'"`,]*?\d+(?:\.\d+)?px/g,
  /\b(?:minHeight|height|padding(?:Top|Bottom|Left|Right|Inline|Block)?)\s*:\s*(?:['"`][^'"`]*\d+px|[1-9]\d*\b)/g,
  /\b(?:h|min-h|p|px|py|pt|pb|pl|pr)-\[\d+(?:\.\d+)?(?:px|rem)\]/g,
];

/**
 * A hard-coded font size: Tailwind arbitrary text-[13px], a CSS font-size in
 * px or rem, or an inline fontSize. (em sizes are relative, like a drop cap,
 * and are not counted.)
 */
const FONT_SIZE_RES = [
  /\btext-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
  /\bfont-size\s*:\s*[^;{}\n'"`,]*?\d+(?:\.\d+)?(?:px|rem)/g,
  /\bfontSize\s*:\s*(?:['"`][^'"`]*\d(?:px|rem)|[1-9]\d*(?:\.\d+)?\b)/g,
];
/** A hard-coded font family, named directly instead of var(--font-...). */
const FONT_RES = [
  /\bfont-family\s*:\s*['"]/g,
  /\bfontFamily\s*:\s*['"`](?!var\()/g,
];
export const KINDS = ['colors', 'sizes', 'fontSizes', 'fonts'];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

export function scanFiles() {
  const files = [];
  for (const d of SCAN_DIRS) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) walk(full, files);
  }
  for (const f of SCAN_FILES) files.push(path.join(ROOT, f));
  return files
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter((f) => !EXEMPT.has(f))
    .sort();
}

export function countText(text) {
  const colors = (text.match(COLOR_RE) || []).length;
  const sum = (res) => res.reduce((n, re) => n + (text.match(re) || []).length, 0);
  return { colors, sizes: sum(SIZE_RES), fontSizes: sum(FONT_SIZE_RES), fonts: sum(FONT_RES) };
}

export function countFile(rel) {
  return countText(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

export function countAll() {
  const result = {};
  for (const f of scanFiles()) {
    const c = countFile(f);
    if (KINDS.some((k) => c[k])) result[f] = c;
  }
  return result;
}

export function totals(counts) {
  const t = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const c of Object.values(counts)) for (const k of KINDS) t[k] += c[k] || 0;
  return t;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const counts = countAll();
  const t = totals(counts);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ totals: t, files: counts }, null, 2) + '\n');
    console.log(`baseline written: ${t.colors} colours, ${t.sizes} sizes, ${t.fontSizes} font sizes, ${t.fonts} font families in ${Object.keys(counts).length} files`);
  } else {
    console.log(`${t.colors} colours, ${t.sizes} control sizes, ${t.fontSizes} font sizes, ${t.fonts} font families (hard-coded)`);
    const sum = (c) => KINDS.reduce((n, k) => n + (c[k] || 0), 0);
    const worst = Object.entries(counts).sort((a, b) => sum(b[1]) - sum(a[1])).slice(0, 15);
    for (const [f, c] of worst) console.log(KINDS.map((k) => String(c[k] || 0).padStart(5)).join(' ') + `  ${f}`);
  }
}
