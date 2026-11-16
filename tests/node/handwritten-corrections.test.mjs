import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join, resolve, relative} from 'node:path';
import {prepare, apply} from '../../scripts/handwritten-corrections.ts';

const source = resolve('oracle/cards');
const run = promisify(execFile);
const cli = resolve('scripts/handwritten-corrections.ts');
const batch = (...edits) => ({format: 'mandala-codes/handwritten-corrections', version: 1, cardNumber: 2, edits});
const edit = (quote, text, section = 'CODE', subsection) => ({section, ...(subsection ? {subsection} : {}), quote, action: 'replace', text});
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'oracle-correction-test-'));
  const cards = join(root, 'cards');
  await cp(source, cards, {recursive: true});
  t.after(() => rm(root, {recursive: true, force: true}));
  return {cards, path: join(cards, '02.md')};
}

test('exact quote changes only the intended bytes and leaves metadata/status intact', async t => {
  const {cards, path} = await fixture(t);
  const before = await readFile(path, 'utf8');
  const old = 'Trust lets life reach you all the way';
  const replacement = 'Trust lets life reach you fully';
  const prepared = await prepare(batch(edit(old, replacement)), cards);
  assert.equal(prepared.review[0].before, old);
  assert.match(prepared.review[0].paragraphBefore, /even what you would not have chosen/);
  assert.match(prepared.review[0].paragraphAfter, /fully, even what you would not have chosen/);
  await apply(prepared, prepared.approvalDigest, cards);
  const after = await readFile(path, 'utf8');
  assert.equal(after, before.replace(old, replacement));
  assert.equal(after.slice(0, before.indexOf('# UL 2')), before.slice(0, before.indexOf('# UL 2')));
});

test('missing and ambiguous quotes stop without writing', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  await assert.rejects(prepare(batch(edit('This quote is absent.', 'X')), cards), /missing/);
  await assert.rejects(prepare(batch(edit('you are', 'X')), cards), /ambiguous/);
  assert.equal(await readFile(path, 'utf8'), original);
});

test('section and subsection narrow repeated quotes', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  const quote = 'the ground';
  await assert.rejects(prepare(batch(edit(quote, 'the earth', 'ICHING')), cards), /ambiguous/);
  const prepared = await prepare(batch(edit(quote, 'the earth', 'ICHING', 'Combination')), cards);
  assert.equal(prepared.review[0].subsection, 'Combination');
  assert.equal(await readFile(path, 'utf8'), original);
});

test('drift, wrong approval and tampered review stop before mutation', async t => {
  const {cards, path} = await fixture(t);
  const prepared = await prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you')), cards);
  const original = await readFile(path, 'utf8');
  await assert.rejects(apply(prepared, '0'.repeat(64), cards), /digest mismatch/);
  await assert.rejects(apply({...prepared, review: []}, prepared.approvalDigest, cards), /tampered/);
  assert.equal(await readFile(path, 'utf8'), original);
  await writeFile(path, original + '\n');
  await assert.rejects(apply(prepared, prepared.approvalDigest, cards), /drifted/);
  assert.equal(await readFile(path, 'utf8'), original + '\n');
});

test('one-card batch is all or nothing and rejects wrong card', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  await assert.rejects(prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you'), edit('missing phrase', 'X')), cards), /missing/);
  await assert.rejects(prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you'), edit('life reach you', 'reach us')), cards), /Overlapping/);
  await writeFile(join(cards, '03.md'), original);
  await assert.rejects(prepare({...batch(edit('Trust lets life reach you all the way', 'Trust reaches you')), cardNumber: 3}, cards), /Wrong card/);
  await cp(join(source, '03.md'), join(cards, '03.md'));
  assert.equal(await readFile(path, 'utf8'), original);
  const prepared = await prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you'), edit('Some days you feel out of place', 'Some days you feel adrift')), cards);
  await apply(prepared, prepared.approvalDigest, cards);
  assert.equal(await readFile(path, 'utf8'), original.replace('Trust lets life reach you all the way', 'Trust reaches you').replace('Some days you feel out of place', 'Some days you feel adrift'));
});

test('explicit insertion and deletion preserve all surrounding bytes', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  const edits = [
    {section: 'CODE', quote: 'even what you would not have chosen', action: 'insert-before', text: 'especially '},
    {section: 'CODE', quote: 'Chance meetings and small openings find you when you are not looking.', action: 'delete'},
  ];
  const prepared = await prepare(batch(...edits), cards);
  await apply(prepared, prepared.approvalDigest, cards);
  const bodyAt = original.indexOf('## CODE');
  const expected = original.slice(0, bodyAt) + original.slice(bodyAt).replace('even what you would not have chosen', 'especially even what you would not have chosen').replace('Chance meetings and small openings find you when you are not looking.', '');
  assert.equal(await readFile(path, 'utf8'), expected);
});

test('two edits in one paragraph show the cumulative final paragraph', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  const prepared = await prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you'), edit('You feel it in the middle of your chest.', 'You feel it in your chest.')), cards);
  assert.equal(prepared.review[0].paragraphAfter, prepared.review[1].paragraphAfter);
  assert.match(prepared.review[0].paragraphAfter, /Trust reaches you, even/);
  assert.match(prepared.review[0].paragraphAfter, /You feel it in your chest/);
  await apply(prepared, prepared.approvalDigest, cards);
  assert.equal(await readFile(path, 'utf8'), original.replace('Trust lets life reach you all the way', 'Trust reaches you').replace('You feel it in the middle of your chest.', 'You feel it in your chest.'));
});

test('prepared output is exclusive and cannot overwrite a manuscript or input batch', async t => {
  const {cards, path} = await fixture(t);
  const input = join(cards, 'batch.json');
  await writeFile(input, JSON.stringify(batch(edit('Trust lets life reach you all the way', 'Trust reaches you'))));
  const cardBefore = await readFile(path, 'utf8');
  const batchBefore = await readFile(input, 'utf8');
  for (const out of [path, input]) {
    await assert.rejects(run(process.execPath, ['--import', 'tsx', cli, 'prepare', '--file', input, '--out', out, '--cards-dir', cards]), /EEXIST/);
  }
  assert.equal(await readFile(path, 'utf8'), cardBefore);
  assert.equal(await readFile(input, 'utf8'), batchBefore);
});

test('prepare CLI names the card and target manuscript before the review', async t => {
  const {cards, path} = await fixture(t);
  const input = join(cards, 'batch.json');
  const output = join(cards, 'prepared.json');
  await writeFile(input, JSON.stringify(batch(edit('Trust lets life reach you all the way', 'Trust reaches you'))));
  const {stdout} = await run(process.execPath, ['--import', 'tsx', cli, 'prepare', '--file', input, '--out', output, '--cards-dir', cards]);
  assert.ok(stdout.startsWith(`Card 2: ${path}\n`));
  assert.ok(stdout.indexOf('Card 2:') < stdout.indexOf('Edit 1 CODE'));
});

test('CLI rejects unknown, duplicate, and valueless flags before apply', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  const prepared = await prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you')), cards);
  const file = join(cards, 'prepared.json');
  await writeFile(file, JSON.stringify(prepared));
  const base = [cli, 'apply', '--file', file, '--approve', prepared.approvalDigest, '--cards-dir', cards];
  for (const args of [[...base, '--dry-run'], [...base, '--approve', prepared.approvalDigest], [...base, '--cards-dir']]) {
    await assert.rejects(run(process.execPath, ['--import', 'tsx', ...args]), /Unknown flag|Duplicate flag|Missing value/);
    assert.equal(await readFile(path, 'utf8'), original);
  }
});

test('relative cards directory validates and applies against the same complete corpus', async t => {
  const {cards, path} = await fixture(t);
  const relativeCards = relative(process.cwd(), cards);
  const original = await readFile(path, 'utf8');
  const prepared = await prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you')), relativeCards);
  await apply(prepared, prepared.approvalDigest, relativeCards);
  assert.equal(await readFile(path, 'utf8'), original.replace('Trust lets life reach you all the way', 'Trust reaches you'));
});

test('heading and structural marker edits are rejected', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  for (const attempted of [edit('Keywords', 'Topics'), edit('Line 1', 'Line 2', 'ICHING', 'Moving lines')]) {
    await assert.rejects(prepare(batch(attempted), cards), /structural markers|missing/);
  }
  const modified = original.replace('### Combination', '### Combination\n#### Small heading');
  await writeFile(path, modified);
  await assert.rejects(prepare(batch(edit('Small heading', 'Other heading', 'ICHING', 'Combination')), cards), /missing|headings/);
  assert.equal(await readFile(path, 'utf8'), modified);
});

test('prospective corpus failure leaves manuscript untouched; unclear text stops', async t => {
  const {cards, path} = await fixture(t);
  const original = await readFile(path, 'utf8');
  await assert.rejects(prepare(batch(edit('Trust lets life reach you all the way', '[[unclear: trust?]]')), cards), /unclear transcription/);
  await assert.rejects(prepare(batch(edit('Trust lets life reach you all the way', '[unclear]')), cards), /unclear transcription/);
  const prepared = await prepare(batch(edit('Trust lets life reach you all the way', 'Trust reaches you')), cards);
  await assert.rejects(apply(prepared, prepared.approvalDigest, cards, async () => {throw new Error('invalid corpus')}), /invalid corpus/);
  assert.equal(await readFile(path, 'utf8'), original);
});
