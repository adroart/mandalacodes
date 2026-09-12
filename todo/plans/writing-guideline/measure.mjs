#!/usr/bin/env node
// Survey script for Mandala Codes oracle card manuscripts (Part A).
import fs from 'fs';
import path from 'path';

const CARDS_DIR = path.resolve(process.cwd(), 'oracle/cards');
const OUT_JSON = path.resolve(process.cwd(), 'todo/plans/writing-guideline/measure-output.json');

function wordCount(str) {
  const m = str.trim().match(/\S+/g);
  return m ? m.length : 0;
}

// crude frontmatter parser: we only need specific scalar/nested fields, not a full YAML parser.
function parseFrontmatter(raw) {
  const fm = {};
  // status block
  const statusBlock = raw.match(/status:\n((?:\s{2}.*\n)+)/);
  if (statusBlock) {
    fm.status = {};
    for (const line of statusBlock[1].split('\n')) {
      const m = line.match(/^\s{2}(\w+):\s*(\S+)/);
      if (m) fm.status[m[1]] = m[2];
    }
  }
  const geneKeys = raw.match(/gene_keys:\n((?:\s{2}.*\n)+)/);
  if (geneKeys) {
    fm.gene_keys = {};
    for (const line of geneKeys[1].split('\n')) {
      const m = line.match(/^\s{2}(\w+):\s*(.+)/);
      if (m) fm.gene_keys[m[1]] = m[2].trim();
    }
  }
  const hd = raw.match(/human_design:\n((?:\s{2}.*\n)+)/);
  if (hd) {
    fm.human_design = {};
    for (const line of hd[1].split('\n')) {
      const m = line.match(/^\s{2}(\w+):\s*(.+)/);
      if (m) fm.human_design[m[1]] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  const body = raw.match(/\nbody:\n((?:\s{2}.*\n)+)/);
  if (body) {
    fm.body = {};
    for (const line of body[1].split('\n')) {
      const m = line.match(/^\s{2}(\w+):\s*(.+)/);
      if (m) fm.body[m[1]] = m[2].trim();
    }
  }
  const cardName = raw.match(/^card_name:\s*(.+)$/m);
  fm.card_name = cardName ? cardName[1].trim() : null;
  const hexName = raw.match(/^hexagram_name:\s*(.+)$/m);
  fm.hexagram_name = hexName ? hexName[1].trim() : null;
  const number = raw.match(/^number:\s*(\d+)/m);
  fm.number = number ? parseInt(number[1], 10) : null;
  const trigrams = raw.match(/\ntrigrams:\n((?:\s{2}.*\n)+)/);
  if (trigrams) {
    fm.trigrams = {};
    for (const line of trigrams[1].split('\n')) {
      const m = line.match(/^\s{2}(\w+):\s*(.+)/);
      if (m) fm.trigrams[m[1]] = m[2].trim();
    }
  }
  return fm;
}

function splitFrontmatterAndBody(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: '', body: raw };
  let body = m[2];
  // Strip trailing/embedded HTML comment blocks (many cards carry a <!-- meta: sourcing_log ... -->
  // block after the visible prose, which is not part of the writing and must not be counted).
  const commentCount = (body.match(/<!--/g) || []).length;
  body = body.replace(/<!--[\s\S]*?-->/g, '');
  return { fm: m[1], body, commentCount };
}

// Parse body into sections (H2) each containing subsections (H3, keyed by name before em dash)
function parseSections(body) {
  const lines = body.split('\n');
  const sections = []; // {name, startLine, contentLines:[], subsections: [{name, fullHeading, contentLines:[]}]}
  let current = null;
  let currentSub = null;

  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    const h1 = line.match(/^# (.+)$/);
    if (h1) continue;
    if (h2) {
      current = { name: h2[1].trim(), contentLines: [], subsections: [] };
      sections.push(current);
      currentSub = null;
      continue;
    }
    if (h3) {
      if (!current) continue;
      const full = h3[1].trim();
      // split on em dash delimiter " — "
      const parts = full.split(/\s+—\s+/);
      const name = parts[0].trim();
      currentSub = { name, fullHeading: full, contentLines: [] };
      current.subsections.push(currentSub);
      continue;
    }
    if (currentSub) {
      currentSub.contentLines.push(line);
    } else if (current) {
      current.contentLines.push(line);
    }
  }
  return sections;
}

function stripMarkup(text) {
  // remove markdown list markers, bold/italic markers for word counting purposes is not necessary;
  // word count via \S+ already handles punctuation fine. Keep raw.
  return text;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function firstSentenceFirstNWords(text, n) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // find first sentence: up to first '. ' or end
  const m = trimmed.match(/^.*?[.!?](?=\s|$)/s);
  const sentence = m ? m[0] : trimmed;
  const words = sentence.match(/\S+/g) || [];
  return words.slice(0, n).join(' ').toLowerCase().replace(/[.,;:!?"']/g, '');
}

function paragraphsOf(contentLines) {
  const text = contentLines.join('\n');
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).filter(p => !p.startsWith('-') && !p.startsWith('_') );
}

// em dash counting: em dash char is —
function countEmDashesInSentences(bodyText) {
  // exclude heading lines (### ... — ...) since those are structural delimiters
  const lines = bodyText.split('\n');
  let count = 0;
  for (const line of lines) {
    if (/^#{1,3} /.test(line)) continue; // skip headings
    const matches = line.match(/—/g);
    if (matches) count += matches.length;
  }
  return count;
}

function countEmphasis(bodyText) {
  const lines = bodyText.split('\n');
  let italic = 0;
  for (const line of lines) {
    if (/^#{1,3} /.test(line)) continue;
    // count _..._ pairs (italic via underscore) - the "Keywords:" line legitimately uses _Keywords:_ style, still count as emphasis usage
    const underscoreMatches = line.match(/_[^_]+_/g);
    if (underscoreMatches) italic += underscoreMatches.length;
    // also *_..._* or single asterisk italics (not bold **)
    const singleAsteriskMatches = line.match(/(?<!\*)\*(?!\*)[^*]+\*(?!\*)/g);
    if (singleAsteriskMatches) italic += singleAsteriskMatches.length;
  }
  return italic;
}

const files = fs.readdirSync(CARDS_DIR).filter(f => /^\d+\.md$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));

const allCardData = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(CARDS_DIR, file), 'utf8');
  const cardNum = parseInt(file, 10);
  const { fm: fmRaw, body, commentCount } = splitFrontmatterAndBody(raw);
  const fm = parseFrontmatter(fmRaw);
  const sections = parseSections(body);
  const emDashes = countEmDashesInSentences(body);
  const emphasisCount = countEmphasis(body);

  allCardData.push({
    cardNum,
    file,
    fm,
    sections,
    emDashes,
    emphasisCount,
    rawBody: body,
    hadTrailingComment: commentCount > 0,
  });
}

// ---- Part A.1: word counts per section/subsection ----
const sectionStats = {}; // sectionName -> {wordsPerCard: [{cardNum, words}]}
const subsectionStats = {}; // "SECTION > subname" -> [{cardNum, words}]

for (const card of allCardData) {
  for (const sec of card.sections) {
    const secWords = wordCount(sec.contentLines.join(' ')) +
      sec.subsections.reduce((sum, sub) => sum + wordCount(sub.contentLines.join(' ')), 0);
    if (!sectionStats[sec.name]) sectionStats[sec.name] = [];
    sectionStats[sec.name].push({ cardNum: card.cardNum, words: secWords });

    for (const sub of sec.subsections) {
      const key = `${sec.name} > ${sub.name}`;
      const w = wordCount(sub.contentLines.join(' '));
      if (!subsectionStats[key]) subsectionStats[key] = [];
      subsectionStats[key].push({ cardNum: card.cardNum, words: w });
    }
  }
}

function summarize(arr) {
  const words = arr.map(x => x.words);
  const min = Math.min(...words);
  const max = Math.max(...words);
  const med = median(words);
  const minCards = arr.filter(x => x.words === min).map(x => x.cardNum);
  const maxCards = arr.filter(x => x.words === max).map(x => x.cardNum);
  return { min, median: med, max, minCards, maxCards, n: arr.length };
}

const sectionSummary = {};
for (const [name, arr] of Object.entries(sectionStats)) {
  sectionSummary[name] = summarize(arr);
}
const subsectionSummary = {};
for (const [name, arr] of Object.entries(subsectionStats)) {
  subsectionSummary[name] = summarize(arr);
}

// ---- Part A.2: status per lens ----
const statusCounts = {}; // lens -> {status: count}
for (const card of allCardData) {
  const st = card.fm.status || {};
  for (const [lens, val] of Object.entries(st)) {
    if (!statusCounts[lens]) statusCounts[lens] = {};
    statusCounts[lens][val] = (statusCounts[lens][val] || 0) + 1;
  }
}

// ---- Part A.3: formula detection ----
// For each subsection NAME (canonical, e.g. "Shadow", "Reading"), collect first-5-words of first sentence across cards
const openingsBySubsectionName = {}; // subsection canonical name -> Map(opening -> [cardNums])
for (const card of allCardData) {
  for (const sec of card.sections) {
    for (const sub of sec.subsections) {
      const text = sub.contentLines.join('\n');
      const paras = paragraphsOf(sub.contentLines);
      if (paras.length === 0) continue;
      const opening = firstSentenceFirstNWords(paras[0], 5);
      if (!opening) continue;
      const key = sub.name;
      if (!openingsBySubsectionName[key]) openingsBySubsectionName[key] = {};
      if (!openingsBySubsectionName[key][opening]) openingsBySubsectionName[key][opening] = [];
      openingsBySubsectionName[key][opening].push(card.cardNum);
    }
  }
}

const sharedOpeningsBySubsection = {};
for (const [subName, openings] of Object.entries(openingsBySubsectionName)) {
  const shared = Object.entries(openings).filter(([, cards]) => cards.length >= 3);
  if (shared.length > 0) {
    sharedOpeningsBySubsection[subName] = shared.map(([opening, cards]) => ({ opening, cards }));
  }
}

// CODE section: first 5 words of every paragraph
const codeParaOpenings = {}; // opening -> [cardNums] (with paragraph index)
for (const card of allCardData) {
  const codeSec = card.sections.find(s => s.name === 'CODE');
  if (!codeSec) continue;
  const paras = paragraphsOf(codeSec.contentLines);
  for (const p of paras) {
    const opening = firstSentenceFirstNWords(p, 5);
    if (!opening) continue;
    if (!codeParaOpenings[opening]) codeParaOpenings[opening] = [];
    codeParaOpenings[opening].push(card.cardNum);
  }
}
const sharedCodeOpenings = Object.entries(codeParaOpenings)
  .filter(([, cards]) => cards.length >= 3)
  .map(([opening, cards]) => ({ opening, cards }));

// ---- Part A.4: interconnection ----
// For each section, count refs to: card's own name, "code", trigrams (upper/lower name), gene keys terms (shadow/gift/siddhi), HD gate keyword, organ/amino acid
function countOccurrences(text, term) {
  if (!term) return 0;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'gi');
  const m = text.match(re);
  return m ? m.length : 0;
}

const interconnection = {}; // sectionName -> array of per-card counts, aggregated

const SECTION_NAMES = ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'];
for (const secName of SECTION_NAMES) {
  interconnection[secName] = {
    cardNameRefs: 0, codeWordRefs: 0, trigramRefs: 0, geneKeysTermRefs: 0, hdGateRefs: 0, organAminoRefs: 0,
    cardsWithCardNameRef: 0, cardsWithCodeWordRef: 0, cardsWithTrigramRef: 0, cardsWithGeneKeysRef: 0, cardsWithHdRef: 0, cardsWithOrganAminoRef: 0,
    totalCards: 0,
  };
}

for (const card of allCardData) {
  const cardName = card.fm.card_name;
  const gk = card.fm.gene_keys || {};
  const hd = card.fm.human_design || {};
  const bodyFm = card.fm.body || {};
  const trigrams = card.fm.trigrams || {};

  for (const sec of card.sections) {
    if (!SECTION_NAMES.includes(sec.name)) continue;
    const fullText = sec.contentLines.join(' ') + ' ' + sec.subsections.map(s => s.contentLines.join(' ')).join(' ');
    const stat = interconnection[sec.name];
    stat.totalCards++;

    const cnRefs = countOccurrences(fullText, cardName);
    stat.cardNameRefs += cnRefs;
    if (cnRefs > 0) stat.cardsWithCardNameRef++;

    // "code" word - use word boundary, case-insensitive, but avoid matching inside other words like "coded"? use \bcode\b
    const codeMatches = fullText.match(/\bcode\b/gi);
    const codeCount = codeMatches ? codeMatches.length : 0;
    stat.codeWordRefs += codeCount;
    if (codeCount > 0) stat.cardsWithCodeWordRef++;

    let trigramCount = 0;
    for (const tName of Object.values(trigrams)) {
      trigramCount += countOccurrences(fullText, tName);
    }
    stat.trigramRefs += trigramCount;
    if (trigramCount > 0) stat.cardsWithTrigramRef++;

    let gkCount = 0;
    for (const term of Object.values(gk)) {
      if (typeof term === 'string' && term) gkCount += countOccurrences(fullText, term);
    }
    stat.geneKeysTermRefs += gkCount;
    if (gkCount > 0) stat.cardsWithGeneKeysRef++;

    let hdCount = 0;
    if (hd.gate_keyword) hdCount += countOccurrences(fullText, hd.gate_keyword);
    stat.hdGateRefs += hdCount;
    if (hdCount > 0) stat.cardsWithHdRef++;

    let oaCount = 0;
    if (bodyFm.organ) oaCount += countOccurrences(fullText, bodyFm.organ.replace(/\s*\(.*\)/, ''));
    if (bodyFm.amino_acid) oaCount += countOccurrences(fullText, bodyFm.amino_acid);
    stat.organAminoRefs += oaCount;
    if (oaCount > 0) stat.cardsWithOrganAminoRef++;
  }
}

// ---- Part A.5: missing sections/subsections & heading deviations ----
const expectedSections = ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'];
const expectedSubsBysection = {
  ICHING: ['Combination', 'Upper trigram', 'Lower trigram', 'Reading', 'Judgement', 'Image', 'Moving lines'],
  KEYS: ['Shadow', 'Repressive nature', 'Reactive nature', 'Gift', 'Siddhi'],
  DESIGN: ['The drive', 'Where it lives', 'What completes it'],
  BODY: ['Physiology', 'Amino acid'],
  RELATIONS: ['Pair', 'Inverse', 'Programming partner', 'Codon ring', 'Tarot', 'Immortals', 'Deeper correlation'],
};

const missingReport = [];
const deviationReport = [];

for (const card of allCardData) {
  const secNames = card.sections.map(s => s.name);
  for (const es of expectedSections) {
    if (!secNames.includes(es)) {
      missingReport.push({ card: card.cardNum, missing: `section ${es}` });
    }
  }
  for (const sec of card.sections) {
    const expectedSubs = expectedSubsBysection[sec.name];
    if (!expectedSubs) continue;
    const subNames = sec.subsections.map(s => s.name);
    for (const es of expectedSubs) {
      if (es === 'Pair' || es === 'Inverse') {
        // handled specially: self-inverse cards may merge these
        continue;
      }
      if (!subNames.includes(es)) {
        missingReport.push({ card: card.cardNum, missing: `${sec.name} > ${es}` });
      }
    }
    // deviation: any subsection name not in expected list (for RELATIONS, allow special merged names)
    for (const subName of subNames) {
      if (sec.name === 'RELATIONS') {
        const allowed = ['Pair', 'Inverse', 'Opposite', 'Programming partner', 'Codon ring', 'Tarot', 'Immortals', 'Deeper correlation',
          'Pair and inverse', 'This code and itself', 'Upper and lower share Wood', 'Pair / Inverse'];
        if (!allowed.includes(subName)) {
          deviationReport.push({ card: card.cardNum, section: sec.name, subsection: subName });
        }
      } else if (expectedSubs && !expectedSubs.includes(subName)) {
        deviationReport.push({ card: card.cardNum, section: sec.name, subsection: subName });
      }
    }
  }
}

// Check RELATIONS: does each card have EITHER (Pair AND Inverse) OR one of the merged/self-inverse forms?
const relationsPairInverseCheck = [];
for (const card of allCardData) {
  const rel = card.sections.find(s => s.name === 'RELATIONS');
  if (!rel) continue;
  const subNames = rel.subsections.map(s => s.name);
  const hasPair = subNames.includes('Pair');
  const hasInverse = subNames.includes('Inverse');
  const hasMerged = subNames.some(n => ['Pair and inverse', 'This code and itself', 'Upper and lower share Wood', 'Pair / Inverse', 'Opposite'].includes(n));
  if (!(hasPair && hasInverse) && !hasMerged) {
    relationsPairInverseCheck.push({ card: card.cardNum, subNames });
  }
}

// ---- Part A.6: em dashes & emphasis per card ----
const emDashEmphasisPerCard = allCardData.map(c => ({ card: c.cardNum, emDashes: c.emDashes, emphasisMarks: c.emphasisCount }));

// ---- output ----
const cardsWithTrailingComment = allCardData.filter(c => c.hadTrailingComment).map(c => c.cardNum);

const output = {
  cardsWithTrailingComment,
  sectionSummary,
  subsectionSummary,
  statusCounts,
  sharedOpeningsBySubsection,
  sharedCodeOpenings,
  interconnection,
  missingReport,
  deviationReport,
  relationsPairInverseCheck,
  emDashEmphasisPerCard,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2));
console.log('Wrote', OUT_JSON);
console.log('Total cards processed:', allCardData.length);
