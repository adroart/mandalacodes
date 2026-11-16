/**
 * scripts/voice-apply.ts against a temporary copy of the real cards.
 * The real oracle/cards are only read, never written.
 */
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {cardSections, type CardSection} from '../../lib/oracle/authoring/cardSections';
import {manuscriptSource} from '../../lib/oracle/authoring/source';
import {parseCardMarkdown} from '../../lib/oracle/card-markdown';
import {serializeVoiceBundle, type VoiceBundle, type VoiceBundleSection} from '../../lib/oracle/authoring/voiceExport';
import {sha256} from '../../lib/oracle/authoring/workflow';
import {loadCorpusFromDirectory} from '../../mcp/oracle-server/src/corpus';
import {formatVoiceApplyReport, runVoiceApply} from '../../scripts/voice-apply';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REAL_CARDS = join(ROOT, 'oracle', 'cards');
const REAL_CARD_2 = readFileSync(join(REAL_CARDS, '02.md'), 'utf8');
// The em dash, built from its code point (house rules keep the character out of files).
const EM_DASH = String.fromCodePoint(0x2014);
const AT = '2026-11-11T10:00:00.000Z';

let dir: string, cardsDir: string, cardFile: string, bundleFile: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'voice-apply-'));
  cardsDir = join(dir, 'cards');
  cpSync(REAL_CARDS, cardsDir, {recursive: true});
  cardFile = join(cardsDir, '02.md');
  bundleFile = join(dir, 'bundle.json');
});
afterEach(() => rmSync(dir, {recursive: true, force: true}));

const text = async (value: string) => ({text: value, sha256: await sha256(value), length: value.length});
const frontmatter = (markdown: string) => markdown.slice(0, markdown.indexOf('\n---\n', 4) + 5);
const headings = (markdown: string) => markdown.split('\n').filter(line => /^#{1,6}\s/.test(line));

async function sectionsOf(markdown: string): Promise<CardSection[]> {
  return cardSections(await manuscriptSource(2, 'test', markdown));
}

async function section(node: Pick<CardSection, 'id' | 'kind' | 'lensId' | 'path' | 'text'>, applied: string): Promise<VoiceBundleSection> {
  return {
    id: node.id, kind: node.kind, lensId: node.lensId as VoiceBundleSection['lensId'], path: node.path,
    original: await text(node.text), applied: await text(applied), appliedAt: AT,
    authorship: 'human', fullyHuman: true, blocks: [{origin: 'human', text: applied}],
  };
}

/** One whole section replaced, one paragraph changed, the entrance, and one section version 1 must skip. */
async function fixture() {
  const nodes = await sectionsOf(REAL_CARD_2);
  const drive = nodes.find(n => n.id === '2/DESIGN/the-drive')!;
  const physiology = nodes.find(n => n.id === '2/BODY/physiology')!;
  const line1 = nodes.find(n => n.id === '2/ICHING/moving-lines/line-1')!;
  const centre = (parseCardMarkdown(REAL_CARD_2).frontmatter.meta as Record<string, string>).centre;

  const newDrive = 'I can feel where my life is going before I choose it.\n\nThat is the whole of it, and I trust it.';
  const [firstParagraph, ...rest] = physiology.text.split('\n\n');
  const newFirst = `This bone is where the front of me comes together ${EM_DASH} and I feel it _really_ hold.`;
  const newPhysiology = [newFirst, ...rest].join('\n\n');
  const newCentre = 'Trust lets you take in what life brings and carry it until it grows.';

  const bundle: VoiceBundle = {
    format: 'mandala-codes/oracle-voice-bundle', version: 1, cardNumber: 2, exportedAt: AT,
    manuscript: {path: 'oracle/cards/02.md', revision: 'test', sha256: await sha256(REAL_CARD_2)},
    sections: [
      await section(drive, newDrive),
      await section(physiology, newPhysiology),
      await section({id: '2/INTRO', kind: 'intro', lensId: 'INTRO', path: ['Intro'], text: centre}, newCentre),
      await section(line1, 'Line 1, spoken over.'),
    ],
    titleEdits: [{sectionId: '2/BODY/amino-acid', path: ['Body', 'Amino acid'], original: 'Amino acid', edited: 'What the body makes'}],
    omitted: [],
  };
  writeFileSync(bundleFile, serializeVoiceBundle(bundle));
  return {bundle, drive, physiology, firstParagraph, newFirst, newDrive, newPhysiology, centre, newCentre};
}

describe('voice-apply', () => {
  it('writes the applied words, keeps every other byte, and is harmless to run twice', async () => {
    const f = await fixture();
    const report = await runVoiceApply({file: bundleFile, cardsDir});
    expect(report.applied.map(s => s.id)).toEqual(['2/INTRO', '2/DESIGN/the-drive', '2/BODY/physiology']);
    expect(report.skipped.map(s => s.id)).toEqual(['2/ICHING/moving-lines/line-1']);
    expect(report.conflicts).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(report.wrote).toBe(true);
    expect(report.exitCode).toBe(0);
    expect(report.manuscriptUnchanged).toBe(true);

    // Exactly these spans changed; the rest of the file is identical byte for byte.
    const expected = REAL_CARD_2
      .replace(`centre: "${f.centre}"`, `centre: "${f.newCentre}"`)
      .replace(f.drive.text, f.newDrive)
      .replace(f.firstParagraph, f.newFirst);
    const written = readFileSync(cardFile, 'utf8');
    expect(written).toBe(expected);
    expect(headings(written)).toEqual(headings(REAL_CARD_2));
    expect(frontmatter(written).replace(f.newCentre, f.centre)).toBe(frontmatter(REAL_CARD_2));
    expect(parseCardMarkdown(written).frontmatter.status).toEqual(parseCardMarkdown(REAL_CARD_2).frontmatter.status);

    // The app's parser and the build's fail-closed loader both read the new card.
    const after = await sectionsOf(written);
    expect(after.find(n => n.id === '2/DESIGN/the-drive')!.text).toBe(f.newDrive);
    expect(after.find(n => n.id === '2/BODY/physiology')!.text).toBe(f.newPhysiology);
    const cards = await loadCorpusFromDirectory(cardsDir);
    expect(cards).toHaveLength(64);

    // House-rule findings are reported, and the words are left as spoken.
    expect(report.notices.map(n => `${n.id} ${n.kind}`)).toEqual(['2/BODY/physiology em dash', '2/BODY/physiology underscore emphasis']);
    const printed = formatVoiceApplyReport(report);
    expect(printed).toContain('npm run card:gate -- 02');
    expect(printed).toContain('npm run lint:prose');
    expect(printed).toContain('Title edits carried but not applied by version 1: 1');

    // A second run changes nothing.
    const again = await runVoiceApply({file: bundleFile, cardsDir});
    expect(again.alreadyApplied.map(s => s.id)).toEqual(['2/INTRO', '2/DESIGN/the-drive', '2/BODY/physiology']);
    expect(again.applied).toEqual([]);
    expect(again.wrote).toBe(false);
    expect(again.exitCode).toBe(0);
    expect(again.manuscriptUnchanged).toBe(false);
    expect(readFileSync(cardFile, 'utf8')).toBe(written);

    // The real card was never touched.
    expect(readFileSync(join(REAL_CARDS, '02.md'), 'utf8')).toBe(REAL_CARD_2);
  }, 120_000);

  it('reports a hand-edited section as a conflict, applies the rest, and exits nonzero', async () => {
    const f = await fixture();
    const handEdited = REAL_CARD_2.replace(f.drive.text, f.drive.text.replace('You feel where', 'You sense where'));
    writeFileSync(cardFile, handEdited);
    const report = await runVoiceApply({file: bundleFile, cardsDir, dryRun: true});
    expect(report.conflicts.map(c => c.id)).toEqual(['2/DESIGN/the-drive']);
    expect(report.conflicts[0].current).toContain('You sense where');
    expect(report.conflicts[0].applied).toBe(f.newDrive);
    expect(report.applied.map(s => s.id)).toEqual(['2/INTRO', '2/BODY/physiology']);
    expect(report.exitCode).toBe(1);
    expect(readFileSync(cardFile, 'utf8')).toBe(handEdited);

    // Without --dry-run the conflicted section is still left exactly as edited.
    const written = await runVoiceApply({file: bundleFile, cardsDir});
    expect(written.exitCode).toBe(1);
    const now = readFileSync(cardFile, 'utf8');
    expect(now).toContain(f.drive.text.replace('You feel where', 'You sense where'));
    expect(now).not.toContain(f.newDrive);
  }, 120_000);

  it('a dry run writes nothing and prints a diff', async () => {
    const f = await fixture();
    const report = await runVoiceApply({file: bundleFile, cardsDir, dryRun: true});
    expect(report.wrote).toBe(false);
    expect(report.applied).toHaveLength(3);
    expect(readFileSync(cardFile, 'utf8')).toBe(REAL_CARD_2);
    expect(report.diff).toContain('--- a/oracle/cards/02.md');
    expect(report.diff).toContain(`+${f.newFirst}`);
    expect(report.diff).toContain(`-${f.firstParagraph}`);
    expect(formatVoiceApplyReport(report)).toContain('dry run');
  });

  it('restores the card when the corpus loader rejects it', async () => {
    await fixture();
    let calls = 0;
    const report = await runVoiceApply({file: bundleFile, cardsDir, loadCards: async () => { if (++calls === 2) throw new Error('simulated loader failure'); }});
    expect(report.wrote).toBe(false);
    expect(report.applied).toEqual([]);
    expect(report.failed.map(s => s.id)).toEqual(['2/INTRO', '2/DESIGN/the-drive', '2/BODY/physiology']);
    expect(report.exitCode).toBe(1);
    expect(readFileSync(cardFile, 'utf8')).toBe(REAL_CARD_2);
  });

  it('refuses a bundle for another card and a tampered bundle without writing', async () => {
    const f = await fixture();
    await expect(runVoiceApply({file: bundleFile, cardsDir, card: 3})).rejects.toThrow(/bundle is for card 2/);
    const tampered = structuredClone(f.bundle);
    tampered.sections[0].applied.text = 'Changed after export.';
    writeFileSync(bundleFile, JSON.stringify(tampered));
    await expect(runVoiceApply({file: bundleFile, cardsDir})).rejects.toThrow(/cannot be used/);
    expect(readFileSync(cardFile, 'utf8')).toBe(REAL_CARD_2);
  });

  it('runs as a command and exits 1 on a conflict', async () => {
    const f = await fixture();
    writeFileSync(cardFile, REAL_CARD_2.replace(f.drive.text, 'Somebody rewrote this by hand.'));
    const run = spawnSync(join(ROOT, 'node_modules', '.bin', 'tsx'), [join(ROOT, 'scripts', 'voice-apply.ts'), '--file', bundleFile, '--card', '2', '--dry-run', '--cards-dir', cardsDir], {encoding: 'utf8', cwd: ROOT});
    expect(run.status, run.stderr).toBe(1);
    expect(run.stdout).toContain('Conflicted (left untouched): 1');
    expect(run.stdout).toContain('Somebody rewrote this by hand.');
  }, 60_000);
});
