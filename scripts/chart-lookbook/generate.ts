#!/usr/bin/env -S npx tsx
/**
 * Generate a personalized "chart in art" lookbook.
 *
 *   npx tsx scripts/chart-lookbook/generate.ts <profile.json> [--name "Adrian"] [--pdf]
 *
 * Input: a profile JSON — the 11 spheres, each { "gate": N, "line": N }. You can
 * include only the spheres you want featured. Produce it either by:
 *   • reading a client's chart PDF with Claude (vision) → write the gates, or
 *   • computing it from birth data via lib/astrology/buildHologeneticProfile.
 *
 * Output: an HTML file next to the input (always), and a PDF (with --pdf, if
 * Playwright's chromium is installed: `npx playwright install chromium`). With
 * no --pdf, just open the HTML and Print → Save as PDF.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { buildLookbookData } from './build-data.ts';
import { renderHtml } from './template.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const name = (() => { const i = args.indexOf('--name'); return i >= 0 ? args[i + 1] : undefined; })();
const wantPdf = args.includes('--pdf');

if (!file) {
  console.error('usage: generate.ts <profile.json> [--name "Adrian"] [--pdf]');
  process.exit(1);
}

const profile = JSON.parse(await readFile(resolve(file), 'utf8'));
const data = await buildLookbookData(profile, { clientName: name });
const html = renderHtml(data);

const outBase = resolve(dirname(file), basename(file).replace(/\.json$/, '') + '-lookbook');
const htmlPath = `${outBase}.html`;
await writeFile(htmlPath, html);
console.log(`[lookbook] ${data.pieces.length} pieces → ${htmlPath}`);
const missing = data.pieces.filter((p) => !p.cardName).map((p) => p.gate);
if (missing.length) console.warn(`[lookbook] no code found for gate(s): ${missing.join(', ')}`);

if (wantPdf) {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    const pdfPath = `${outBase}.pdf`;
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    await browser.close();
    console.log(`[lookbook] → ${pdfPath}`);
  } catch (err) {
    console.warn(`[lookbook] PDF skipped (${(err as Error).message}).`);
    console.warn('[lookbook] Install once with: npx playwright install chromium — or open the HTML and Print → Save as PDF.');
  }
}
