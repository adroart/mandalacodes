import type { AuthoringSession, StoredAudioChunk } from './types';
import { sourceSnapshot, sha256, proposeSection, addTranscript } from './workflow';
import { AuthoringStore, type SavedSession } from './storage';
const LIMIT = 80 * 1024 * 1024;
async function audioHash(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
}
function base64(bytes: Uint8Array) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 16384) result += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(result);
}
export async function exportBundle(store: AuthoringStore, sessionId: string): Promise<string> {
  const saved = await store.load(sessionId);
  if (!saved) throw new Error('Session not found');
  if (saved.session.captures.some(c => c.status === 'recording')) throw new Error('Finish or recover recording before export');
  const audio = [];
  for (const capture of saved.session.captures.filter(c => c.status !== 'empty')) {
    const blob = await store.audio(sessionId, capture.id);
    audio.push({ captureId: capture.id, mimeType: capture.mimeType, hash: await audioHash(blob), base64: base64(new Uint8Array(await blob.arrayBuffer())) });
  }
  const value = JSON.stringify({ format: 'oracle-authoring-review', version: 1, session: saved.session, reviewHash: await sha256(JSON.stringify(saved.session)), audio, receipts: await store.receipts(sessionId) });
  if (value.length > LIMIT) throw new Error('Review file exceeds 80 MiB. Use shorter recording sessions.');
  return value;
}
export async function importBundle(store: AuthoringStore, text: string): Promise<SavedSession> {
  if (text.length > LIMIT) throw new Error('Review file exceeds 80 MiB');
  const bundle = JSON.parse(text);
  if (bundle.format !== 'oracle-authoring-review' || bundle.version !== 1 || !bundle.session || !Array.isArray(bundle.audio)) throw new Error('Not an Oracle review file');
  const session = bundle.session as AuthoringSession;
  if (session.schema !== 1 || !Array.isArray(session.captures) || !Array.isArray(session.transcript) || !Array.isArray(session.markers) || !Array.isArray(session.proposals) || !Array.isArray(session.approvals)) throw new Error('Invalid review structure');
  if (await sha256(JSON.stringify(session)) !== bundle.reviewHash) throw new Error('Review hash mismatch');
  const snapshot = await sourceSnapshot(session.source.cardNumber, session.source.revision, session.source.markdown, session.source.sections);
  if (snapshot.hash !== session.source.hash) throw new Error('Source hash mismatch');
  if (session.captures.length > 100 || new Set(session.captures.map(c => c.id)).size !== session.captures.length || new Set(session.transcript.map(t => t.id)).size !== session.transcript.length) throw new Error('Invalid or duplicate sources');
  for (const c of session.captures) {
    if (!c.id || !c.mimeType?.startsWith('audio/') || !Number.isFinite(c.durationMs) || (c.status === 'empty' ? c.durationMs !== 0 : c.durationMs <= 0) || c.durationMs > 20 * 60 * 1000 || !['ready', 'interrupted', 'empty'].includes(c.status)) throw new Error('Invalid recording');
  }
  for (const t of session.transcript) {
    addTranscript(session, t.captureId, [{ startMs: t.startMs, endMs: t.endMs, text: t.raw, sectionId: t.sectionId, timing: t.timing }], t.provider);
    if (typeof t.corrected !== 'string' || !['hint', 'manual', 'unresolved'].includes(t.assignment) || !['recording', 'manual', 'provider'].includes(t.timing)) throw new Error('Invalid transcript');
  }
  session.proposals.forEach(p => proposeSection(session, p));
  for (const m of session.markers) {
    const c = session.captures.find(c => c.id === m.captureId);
    if (!c || !Number.isFinite(m.atMs) || m.atMs < 0 || m.atMs > c.durationMs || (m.sectionId !== null && !session.source.sections.some(s => s.id === m.sectionId))) throw new Error('Invalid section marker');
  }
  // Transfer checks detect damage, not authorship. Imported approvals never authorize a write.
  const id = crypto.randomUUID();
  const imported: AuthoringSession = { ...session, id, reflectionSessionId: session.reflectionSessionId ?? session.id, approvals: [] };
  if (bundle.audio.length !== imported.captures.filter(c => c.status !== 'empty').length || new Set(bundle.audio.map(a => a.captureId)).size !== bundle.audio.length) throw new Error('Missing or duplicate audio');
  const chunks: StoredAudioChunk[] = [];
  for (const a of bundle.audio) {
    const c = imported.captures.find(c => c.id === a.captureId);
    if (!c || c.status === 'empty' || a.mimeType !== c.mimeType || typeof a.base64 !== 'string') throw new Error('Audio metadata mismatch');
    const bytes = Uint8Array.from(atob(a.base64), ch => ch.charCodeAt(0));
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Audio exceeds 10 MiB');
    const blob = new Blob([bytes], { type: a.mimeType });
    if (await audioHash(blob) !== a.hash) throw new Error('Audio hash mismatch');
    chunks.push({ key: `${id}/${c.id}/0`, sessionId: id, captureId: c.id, index: 0, endMs: c.durationMs, blob });
  }
  if (!Array.isArray(bundle.receipts)) throw new Error('Invalid receipt archive');
  const receipts = bundle.receipts.map((r: unknown, index: number) => {
    if (!r || typeof r !== 'object' || typeof (r as { markdown?: unknown }).markdown !== 'string' || typeof (r as { digest?: unknown }).digest !== 'string') throw new Error('Invalid receipt archive');
    const receipt = r as { markdown: string; digest: string };
    return { id: `${id}/imported/${index}`, sessionId: id, markdown: receipt.markdown, digest: receipt.digest };
  });
  await store.importNew(imported, chunks, receipts);
  return { session: imported, version: 1 };
}
