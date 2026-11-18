#!/usr/bin/env node
/**
 * Style guard: counts hard-coded colours and hard-coded control sizes in
 * every app style and component file, outside the master style file
 * (src/theme.css).
 *
 * The master file owns colours, type, spacing, radii and control heights.
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
  let sizes = 0;
  for (const re of SIZE_RES) sizes += (text.match(re) || []).length;
  return { colors, sizes };
}

export function countFile(rel) {
  return countText(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

export function countAll() {
  const result = {};
  for (const f of scanFiles()) {
    const c = countFile(f);
    if (c.colors || c.sizes) result[f] = c;
  }
  return result;
}

export function totals(counts) {
  let colors = 0, sizes = 0;
  for (const c of Object.values(counts)) { colors += c.colors; sizes += c.sizes; }
  return { colors, sizes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const counts = countAll();
  const t = totals(counts);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ totals: t, files: counts }, null, 2) + '\n');
    console.log(`baseline written: ${t.colors} colours, ${t.sizes} sizes in ${Object.keys(counts).length} files`);
  } else {
    console.log(`${t.colors} hard-coded colours, ${t.sizes} hard-coded control sizes`);
    const worst = Object.entries(counts).sort((a, b) => (b[1].colors + b[1].sizes) - (a[1].colors + a[1].sizes)).slice(0, 15);
    for (const [f, c] of worst) console.log(`${String(c.colors).padStart(5)} ${String(c.sizes).padStart(5)}  ${f}`);
  }
}
