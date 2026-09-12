#!/usr/bin/env node
// Refill empty oracle research extracts in the vault from the original chapter
// PDFs and the master spreadsheet. No model is involved: pdftotext (poppler)
// for the chapter families, a plain XML read of gene_keys_master.xlsx for the
// reference rows. Deterministic, re-runnable, dry-run by default.
//
//   node scripts/refill-vault-extracts.mjs                 # report what is empty and what would fill it
//   node scripts/refill-vault-extracts.mjs --write         # write the bodies
//   node scripts/refill-vault-extracts.mjs --only 50-64    # limit to a hexagram range
//   node scripts/refill-vault-extracts.mjs --family oracle # one family: gene-key | oracle | practical | wilhelm | reference
//   node scripts/refill-vault-extracts.mjs --force         # refill even files that already have a body (backs up to .bak)
//
// Paths below are the ones the source-file search found on 2026-09-12
// (todo/plans/writing-guideline/source-files-on-disk.md). Override with
// ORACLE_VAULT and ORACLE_SOURCE_MATERIAL if they move.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOME = process.env.HOME;
const VAULT = process.env.ORACLE_VAULT
  || path.join(HOME, 'Documents/Obsidian Vault/Mandala Codes/oracle/hexagrams');
const SOURCE = process.env.ORACLE_SOURCE_MATERIAL
  || path.join(HOME, 'Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material');
const EXTRACTED = path.join(SOURCE, 'extracted');
const XLSX = path.join(SOURCE, 'gene_keys_master.xlsx');

// A file counts as empty when its body (after the frontmatter) has fewer words than this.
const EMPTY_BELOW = 80;

const FAMILIES = {
  'gene-key': { vaultPrefix: (nn) => `gene-key-${nn}.md`, pdfDir: 'Gene Keys Chapters', label: 'Gene Keys chapter (Rudd)' },
  'oracle': { vaultPrefix: (nn) => `oracle-${nn}-`, pdfDir: 'I Ching Chapters/Oracle 2018', label: 'Eranos I Ching (Oracle 2018)' },
  'practical': { vaultPrefix: (nn) => `practical-${nn}-`, pdfDir: 'I Ching Chapters/Practical Guide', label: 'Benebell Wen, I Ching the Oracle (Practical Guide)' },
  'wilhelm': { vaultPrefix: (nn) => `wilhelm-${nn}-`, pdfDir: 'I Ching Chapters/Wilhelm', label: 'Wilhelm/Baynes (abridged)' },
  'reference': { vaultPrefix: (nn) => `gene-key-${nn}-`, exclude: (nn) => `gene-key-${nn}.md`, label: 'Gene Keys reference row (gene_keys_master.xlsx)' },
};

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const FORCE = args.includes('--force');
const onlyArg = args[args.indexOf('--only') + 1];
const familyArg = args[args.indexOf('--family') + 1];
const [lo, hi] = args.includes('--only') && onlyArg
  ? onlyArg.split('-').map(Number)
  : [1, 64];
const families = args.includes('--family') && familyArg ? [familyArg] : Object.keys(FAMILIES);

for (const f of families) if (!FAMILIES[f]) die(`unknown family ${f}; use ${Object.keys(FAMILIES).join(', ')}`);
for (const p of [VAULT, EXTRACTED]) if (!fs.existsSync(p)) die(`missing: ${p}`);
for (const tool of ['pdftotext', 'pdfinfo']) {
  try { execFileSync('which', [tool], { stdio: 'ignore' }); }
  catch { die(`${tool} not found; install poppler (brew install poppler)`); }
}

function die(msg) { console.error(`refill: ${msg}`); process.exit(2); }
const pad = (n) => String(n).padStart(2, '0');
const words = (s) => (s.trim().match(/\S+/g) || []).length;

function splitFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: '', body: raw };
  return { fm: m[0], body: raw.slice(m[0].length) };
}

function findVaultFile(nn, fam) {
  const dir = path.join(VAULT, nn);
  if (!fs.existsSync(dir)) return null;
  const spec = FAMILIES[fam];
  const want = spec.vaultPrefix(nn);
  const hits = fs.readdirSync(dir).filter((f) => f.startsWith(want) && f.endsWith('.md') && !(spec.exclude && f === spec.exclude(nn)));
  return hits.length ? path.join(dir, hits[0]) : null;
}

function findPdf(nn, fam) {
  const dir = path.join(EXTRACTED, FAMILIES[fam].pdfDir);
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => f.startsWith(`${nn}-`) && f.toLowerCase().endsWith('.pdf'));
  return hit ? path.join(dir, hit) : null;
}

function pdfPageCount(pdf) {
  const out = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  const m = out.match(/^Pages:\s+(\d+)/m);
  return m ? Number(m[1]) : 0;
}

// Some chapter PDFs (the ten thin Wilhelm ones) embed fonts with no unicode map, so
// pdftotext returns shifted garbage like "7KH-XGJHPHQW". Detect that by vowel ratio
// and fall back to OCR (pdftoppm + tesseract), which reads them cleanly.
function looksGarbled(text) {
  const toks = text.match(/[A-Za-z]{3,}/g) || [];
  if (toks.length < 10) return true;
  const withVowel = toks.filter((t) => /[aeiouAEIOU]/.test(t)).length;
  return withVowel / toks.length < 0.6;
}

function hasTool(t) { try { execFileSync('which', [t], { stdio: 'ignore' }); return true; } catch { return false; } }

// Scratch dir lives next to the script, not in /tmp: inside the Claude sandbox
// tesseract cannot open files under /tmp, and this way it works everywhere.
const SCRATCH = path.join(path.dirname(fileURLToPath(import.meta.url)), '.refill-tmp');

function ocrPage(pdf, i) {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(SCRATCH, 'p-'));
  try {
    execFileSync('pdftoppm', ['-r', '300', '-f', String(i), '-l', String(i), '-png', pdf, path.join(tmp, 'p')], { stdio: 'ignore' });
    const png = fs.readdirSync(tmp).find((f) => f.endsWith('.png'));
    return execFileSync('tesseract', [path.join(tmp, png), '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const tidy = (t) => t.replace(/\f/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Page by page, with the same "--- Page i/N ---" markers the populated extracts carry.
// Returns the body and the method used, so the frontmatter can record it.
function pdfBody(pdf, title) {
  const pages = pdfPageCount(pdf);
  const parts = [`# ${title}`, ''];
  let method = 'pdftotext';
  for (let i = 1; i <= pages; i++) {
    let text = tidy(execFileSync('pdftotext', ['-f', String(i), '-l', String(i), pdf, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    if (looksGarbled(text)) {
      if (!hasTool('tesseract') || !hasTool('pdftoppm')) {
        method = 'pdftotext (garbled; install tesseract for OCR)';
      } else {
        text = tidy(ocrPage(pdf, i));
        method = 'ocr (pdftoppm + tesseract)';
      }
    }
    parts.push(`--- Page ${i}/${pages} ---`, '', text, '');
  }
  return { body: parts.join('\n'), method };
}

function withSource(fm, sourceLine, method) {
  // Keep every existing frontmatter line; add a source if there is none, and a refill stamp.
  const stamp = `refilled: '${new Date().toISOString()}'\nrefill_method: ${method}\n`;
  if (!fm) return `---\n${sourceLine}${stamp}---\n`;
  const hasSource = /^source:/m.test(fm);
  const inner = fm.replace(/^---\n/, '').replace(/\n---\n?$/, '\n');
  return `---\n${hasSource ? '' : sourceLine}${inner}${stamp}---\n`;
}

// Spreadsheet rows, read straight from the xlsx zip (inline strings, no library).
let sheetRows = null;
function loadSheet() {
  if (sheetRows) return sheetRows;
  if (!fs.existsSync(XLSX)) die(`missing: ${XLSX}`);
  const xml = execFileSync('unzip', ['-p', XLSX, 'xl/worksheets/sheet1.xml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const rows = [...xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map((m) => {
    const cells = {};
    for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"[^>]*>(?:<is><t[^>]*>([\s\S]*?)<\/t><\/is>|<v>([\s\S]*?)<\/v>)/g)) {
      cells[c[1]] = decode(c[2] ?? c[3] ?? '').trim();
    }
    return cells;
  });
  const header = rows[0];
  const keyFor = {};
  for (const [col, name] of Object.entries(header)) keyFor[col] = name;
  sheetRows = {};
  for (const r of rows.slice(1)) {
    const rec = {};
    for (const [col, val] of Object.entries(r)) rec[keyFor[col]] = val;
    if (rec['GK #']) sheetRows[Number(rec['GK #'])] = rec;
  }
  return sheetRows;
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function referenceBody(n, r) {
  const nn = pad(n);
  const partner = pad(Number(r['Partner']));
  return [
    `# Gene Key ${n}: ${r['Card Name']}`, '',
    '| Property | Value |', '|----------|-------|',
    `| **GK #** | ${n} |`,
    `| **Card Name** | ${r['Card Name']} |`,
    `| **I Ching** | ${r['I Ching']} |`,
    `| **HD Keyword** | ${r['HD Keyword']} |`,
    `| **GK Keyword** | ${r['GK Keyword']} |`, '',
    '## Shadow → Gift → Siddhi', '',
    '| Shadow | Gift | Siddhi |', '|--------|------|--------|',
    `| **${r['Shadow']}** | **${r['Gift']}** | **${r['Siddhi']}** |`, '',
    '## Victim Pattern', '',
    `**Dilemma:** ${r['Dilemma']}  `,
    `**Repressed:** ${r['Repressed']}  `,
    `**Reactive:** ${r['Reactive']}`, '',
    '## Contemplations', '',
    `1. **${r['Contemplation 1']}**  `,
    `2. **${r['Contemplation 2']}**  `,
    `3. **${r['Contemplation 3']}**`, '',
    '## Relationships', '',
    '| Property | Value |', '|----------|-------|',
    `| **Partner Gene Key** | [[gene-key-${partner}]] |`,
    `| **Codon Ring** | ${r['Codon Ring']} |`,
    `| **Tarot Major Arcana** | ${r['Tarot Major Arcana']} |`, '', '',
    '## Related Content',
    `- [[gene-key-${nn}]] — Full chapter text`, '',
    'Extracted from gene_keys_master.xlsx, structured reference data for the Gene Keys system.', '',
  ].join('\n');
}

function referenceFrontmatterFields(r) {
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
  return [
    `gk_number: ${r['GK #']}`,
    `card_name: ${q(r['Card Name'])}`,
    `i_ching: ${q(r['I Ching'])}`,
    `hd_keyword: ${q(r['HD Keyword'])}`,
    `gk_keyword: ${q(r['GK Keyword'])}`,
    `shadow: ${q(r['Shadow'])}`,
    `gift: ${q(r['Gift'])}`,
    `siddhi: ${q(r['Siddhi'])}`,
    `dilemma: ${q(r['Dilemma'])}`,
    `repressed: ${q(r['Repressed'])}`,
    `reactive: ${q(r['Reactive'])}`,
    `contemplation_1: ${q(r['Contemplation 1'])}`,
    `contemplation_2: ${q(r['Contemplation 2'])}`,
    `contemplation_3: ${q(r['Contemplation 3'])}`,
    `partner: '${r['Partner']}'`,
    `codon_ring: ${q(r['Codon Ring'])}`,
    `tarot: ${q(r['Tarot Major Arcana'])}`,
  ].join('\n') + '\n';
}

let planned = 0, written = 0, skipped = 0, missing = 0;
console.log(`${WRITE ? 'WRITING' : 'DRY RUN'}  hexagrams ${pad(lo)}-${pad(hi)}  families: ${families.join(', ')}`);
console.log(`vault:  ${VAULT}\nsource: ${EXTRACTED}\n`);

for (let n = lo; n <= hi; n++) {
  const nn = pad(n);
  for (const fam of families) {
    const file = findVaultFile(nn, fam);
    if (!file) { console.log(`${nn} ${fam.padEnd(10)} no vault file`); missing++; continue; }
    const raw = fs.readFileSync(file, 'utf8');
    const { fm, body } = splitFrontmatter(raw);
    const have = words(body);
    if (have >= EMPTY_BELOW && !FORCE) { skipped++; continue; }

    let newFm, newBody, from;
    if (fam === 'reference') {
      const r = loadSheet()[n];
      if (!r) { console.log(`${nn} ${fam.padEnd(10)} no spreadsheet row`); missing++; continue; }
      newBody = referenceBody(n, r);
      const fields = /^gk_number:/m.test(fm) ? '' : referenceFrontmatterFields(r);
      newFm = withSource(fm, `source: 'file://gene_keys_master.xlsx'\ntype: reference\n${fields}`, 'xlsx');
      from = path.basename(XLSX);
    } else {
      const pdf = findPdf(nn, fam);
      if (!pdf) { console.log(`${nn} ${fam.padEnd(10)} EMPTY (${have} words) and no chapter PDF found`); missing++; continue; }
      const r = pdfBody(pdf, path.basename(pdf, '.pdf'));
      newBody = r.body;
      newFm = withSource(fm, `source: 'file://${path.relative(SOURCE, pdf)}'\ntype: document\n`, r.method);
      from = path.relative(EXTRACTED, pdf);
    }
    const got = words(newBody);
    const flag = got < EMPTY_BELOW ? '  (still thin after OCR: check the PDF by eye)' : '';
    console.log(`${nn} ${fam.padEnd(10)} ${String(have).padStart(5)} -> ${String(got).padStart(5)} words  from ${from}${flag}`);
    planned++;
    if (WRITE) {
      if (have > 0) fs.writeFileSync(`${file}.bak`, raw);
      fs.writeFileSync(file, newFm + '\n' + newBody);
      written++;
    }
  }
}

console.log(`\n${planned} file(s) ${WRITE ? 'written' : 'would be written'}, ${skipped} already populated, ${missing} with no source.`);
if (!WRITE && planned) console.log('Re-run with --write to apply.');
