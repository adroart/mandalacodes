import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { manuscriptSource } from '../../../lib/oracle/authoring/source';
import { approvedMarkdown, approveReview, addTranscript, correctTranscript, createSession, proposeSection } from '../../../lib/oracle/authoring/workflow';
import { importAudio, recoverCapture } from '../../../lib/oracle/authoring/recorder';
import { exportBundle, importBundle } from '../../../lib/oracle/authoring/transfer';
import { AuthoringStore } from '../../../lib/oracle/authoring/storage';
import 'fake-indexeddb/auto';

describe('canonical source boundaries', () => {
  it('resolves six nonoverlapping exact section bodies for every real manuscript', async () => {
    for (let n = 1; n <= 64; n++) {
      const text = readFileSync(`oracle/cards/${String(n).padStart(2, '0')}.md`, 'utf8');
      const source = await manuscriptSource(n, 'fixture', text);
      expect(source.sections.map(s => s.id)).toEqual(['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS']);
      for (const s of source.sections) expect(text.slice(s.start, s.end).trim()).not.toBe('');
    }
  });
  it('preserves headings, frontmatter, line endings and other sections when replacing one real lens', async () => {
    const text = readFileSync('oracle/cards/01.md', 'utf8').replace(/\n/g, '\r\n');
    const source = await manuscriptSource(1, 'r', text);
    let s = createSession(source);
    s.captures.push({ id: 'c', durationMs: 1000, mimeType: 'audio/webm', status: 'ready', origin: 'import', recordedAt: s.createdAt });
    s = addTranscript(s, 'c', [{ text: 'words', startMs: 0, endMs: 1000, sectionId: 'CODE', timing: 'manual' }], 'manual');
    s = correctTranscript(s, s.transcript[0].id, { sectionId: 'CODE' });
    s = proposeSection(s, { sectionId: 'CODE', text: 'Replacement.', evidenceIds: [s.transcript[0].id], author: { kind: 'manual' }, feedback: { changes: 'replacement', uncertainWords: '', omissions: '', contradictions: '', unsupportedAdditions: '' } });
    s = await approveReview(s, source, 'Adrian', true);
    const result = await approvedMarkdown(s, source);
    const range = source.sections[0];
    expect(result).toBe(text.slice(0, range.start) + 'Replacement.' + text.slice(range.end));
  });
  it('retains an interrupted capture with no received audio and permits a portable recovery record', async () => {
    const store = new AuthoringStore(`empty-${crypto.randomUUID()}`);
    const s = createSession(await manuscriptSource(1, 'r', readFileSync('oracle/cards/01.md', 'utf8')));
    s.captures.push({ id: 'empty', recordedAt: s.createdAt, mimeType: 'audio/webm', durationMs: 0, status: 'recording', origin: 'microphone' });
    const version = await store.save(s, 0);
    const recovered = await recoverCapture(store, { session: s, version }, 'empty');
    expect(recovered.session.captures[0].status).toBe('empty');
    const bundle = await exportBundle(store, s.id);
    const other = new AuthoringStore(`empty-transfer-${crypto.randomUUID()}`);
    const imported = await importBundle(other, bundle);
    expect(imported.session.captures[0].status).toBe('empty');
    expect(await other.chunks(imported.session.id)).toEqual([]);
  });
  it('imports audio atomically and recovers only timestamps covered by received chunks', async () => {
    const store = new AuthoringStore(`capture-${crypto.randomUUID()}`);
    const s = createSession(await manuscriptSource(1, 'r', readFileSync('oracle/cards/01.md', 'utf8')));
    const version = await store.save(s, 0);
    const imported = await importAudio(store, { session: s, version }, new Blob(['audio'], { type: 'audio/webm' }), 2000, 'CODE');
    expect(await (await store.audio(s.id, imported.session.captures[0].id)).text()).toBe('audio');
    const recovered = await recoverCapture(store, imported, imported.session.captures[0].id);
    expect(recovered.session.captures[0].status).toBe('interrupted');
    await expect(importAudio(store, imported, new Blob(['audio'], { type: 'audio/webm' }), 2000, 'CODE')).rejects.toThrow(/another/i);
    expect((await store.load(s.id))!.session.captures).toHaveLength(1);
  });
});
