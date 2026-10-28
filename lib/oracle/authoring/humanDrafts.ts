import type { SourceSnapshot, Transcript } from './types';

export interface HumanEvidence { sessionId: string; transcriptId: string; captureId: string; signature: string }
export interface HumanBlock {
  id: string; text: string; origin: 'human' | 'ai'; evidence: HumanEvidence[];
  /** Literal words at incorporation, used to protect subsequent manual edits. */
  sourceText?: string;
  /** Exact displaced passage for in-place provenance review. */
  replacedText?: string;
}
export interface WorkingSection {
  key: string; cardNumber: number; sectionId: string; text: string; revision: number;
  sourceHash: string; source: SourceSnapshot; savedAt: string; blocks: HumanBlock[];
  humanWords: number; totalWords: number;
}
export interface HumanIssue { code: 'assignment' | 'confidence' | 'uncertain' | 'revision'; message: string; transcriptIds: string[] }
export type HumanMode = 'auto' | 'replace' | 'append';
export const workingSectionKey = (card: number, section: string) => `${card}/${section}`;
const words = (text: string) => text.trim().match(/\S+/g)?.length ?? 0;
// Exact literal words are the freshness token: collision-free and never a security hash.
const signature = (text: string) => text;
function counted(section: WorkingSection): WorkingSection {
  return { ...section, text: section.blocks.map(b => b.text).filter(Boolean).join('\n\n'), humanWords: section.blocks.reduce((n, b) => n + (b.origin === 'human' ? words(b.text) : 0), 0), totalWords: section.blocks.reduce((n, b) => n + words(b.text), 0) };
}
export function sectionHumanPercent(section: WorkingSection): number { return section.totalWords ? Math.floor(100 * section.humanWords / section.totalWords) : 0; }
const LENSES = ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'];
/** All six lenses must contain exclusively human words before the card reaches 100%. */
export function cardHumanPercent(sections: WorkingSection[]): number {
  return Math.floor(LENSES.reduce((n, lens) => n + sectionHumanPercent(sections.find(s => s.sectionId === lens) ?? { totalWords: 0 } as WorkingSection), 0) / LENSES.length);
}
const sameEvidence = (a: HumanEvidence, b: HumanEvidence) => a.sessionId === b.sessionId && a.transcriptId === b.transcriptId;
function likelyRevision(a: string, b: string): boolean {
  if (/\b(actually|i mean|replace that|change that|scratch that|instead of|correction)\b/i.test(b)) return true;
  const tokens = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const aa = tokens(a), bb = tokens(b);
  const overlap = [...bb].filter(t => aa.has(t)).length;
  return Math.min(aa.size, bb.size) >= 4 && overlap / Math.min(aa.size, bb.size) >= .6;
}

/** Preserves literal corrected words. No generated prose, source mutation, or inference of missing words. */
export function reconcileHumanPassages(existing: WorkingSection | undefined, source: SourceSnapshot, passages: Transcript[], sessionId: string, mode: HumanMode = 'auto', reviewedIds: string[] = []): { draft: WorkingSection; issues: HumanIssue[]; alreadyApplied: boolean } {
  const sectionId = existing?.sectionId ?? passages.find(t => t.sectionId)?.sectionId ?? '';
  if (existing && existing.cardNumber !== source.cardNumber) throw new Error('Working card and source do not match');
  let blocks = (existing?.blocks ?? []).map(b => ({ ...b, evidence: b.evidence.map(e => ({ ...e })) }));
  const issues: HumanIssue[] = [];
  const issue = (code: HumanIssue['code'], message: string, t: Transcript) => issues.push({ code, message, transcriptIds: [t.id] });
  if (mode === 'replace') blocks = [];
  let changed = mode === 'replace' && !!existing?.blocks.length;
  for (const t of passages) {
    if (t.referenceOnly) continue;
    if (!sectionId || !source.sections.some(s => s.id === sectionId) || t.sectionId !== sectionId || t.assignment === 'unresolved' || (t.cardNumber !== undefined && t.cardNumber !== source.cardNumber)) { issue('assignment', 'Choose a card and lens for these words.', t); continue; }
    const text = t.corrected.trim();
    if (!text) continue;
    if (!reviewedIds.includes(t.id)) {
      const probabilities = (t.words ?? []).flatMap(w => w.probability === undefined ? [] : [w.probability]);
      if (probabilities.some(p => p < .45) || probabilities.filter(p => p < .6).length >= 2) issue('confidence', 'Check the uncertain words against the recording.', t);
      if (/\[inaudible\]|\[unclear\]|\[unknown\]|\?{2,}|\ba chain\b|\bthanks? (?:you )?for watching\b|\bsubtitles by\b|^\s*(?:\[music\]|\(music\)|music|[♪♫]+)[.!\s]*$/i.test(text)) issue('uncertain', 'Check a possible mishearing in these words.', t);
    }
    const evidence: HumanEvidence = { sessionId, transcriptId: t.id, captureId: t.captureId, signature: signature(text) };
    if (blocks.some(b => b.evidence.some(e => sameEvidence(e, evidence) && e.signature === evidence.signature))) continue;
    const found = blocks.find(b => b.evidence.some(e => sameEvidence(e, evidence)));
    if (found) {
      // Only the exact single passage originally inserted can be updated automatically.
      if (found.sourceText === found.text && found.evidence.length === 1) {
        found.text = text; found.sourceText = text; found.evidence = [evidence]; changed = true;
        continue;
      } else if (mode !== 'append') {
        issue('revision', 'These corrected words also have later edits. Choose how to combine them.', t);
        continue;
      }
    }
    const duplicate = blocks.find(b => b.origin === 'human' && b.text === text);
    if (duplicate) { duplicate.evidence.push(evidence); changed = true; continue; }
    if (mode === 'auto' && (existing?.blocks ?? []).some(b => b.origin === 'human' && !b.evidence.some(e => e.sessionId === sessionId && e.captureId === t.captureId) && likelyRevision(b.text, text))) {
      issue('revision', 'These words may revise an earlier passage. Choose replace or append.', t); continue;
    }
    // The first human recording replaces the AI scaffold for this lens.
    if (!blocks.some(b => b.origin === 'human')) blocks = [];
    blocks.push({ id: found ? `${sessionId}/${t.id}/append-${blocks.length}` : `${sessionId}/${t.id}`, text, sourceText: text, origin: 'human', evidence: [evidence] }); changed = true;
  }
  const draft = counted({ key: workingSectionKey(source.cardNumber, sectionId), cardNumber: source.cardNumber, sectionId, revision: existing?.revision ?? 0, sourceHash: existing?.sourceHash ?? source.hash, source: existing?.source ?? structuredClone(source), savedAt: existing?.savedAt ?? '', blocks, text: '', humanWords: 0, totalWords: 0 });
  return { draft: !changed && existing ? structuredClone(existing) : draft, issues, alreadyApplied: !changed && issues.length === 0 };
}

/** Human typing starts a private section without inventing a spoken source. */
export function createWorkingText(source:SourceSnapshot,sectionId:string,text:string):WorkingSection {
 if(!source.sections.some(s=>s.id===sectionId))throw new Error('Choose an existing reading section.');
 return {key:workingSectionKey(source.cardNumber,sectionId),cardNumber:source.cardNumber,sectionId,sourceHash:source.hash,source:structuredClone(source),text,revision:0,savedAt:'',blocks:[{id:'manual',text,origin:'human',evidence:[]}],humanWords:words(text),totalWords:words(text)};
}

export function editWorkingText(existing: WorkingSection, text: string): WorkingSection {
  if (text === existing.text) return structuredClone(existing);
  const evidence = existing.blocks.flatMap(b => b.evidence).map(e => ({ ...e }));
  // Existing AI words keep their attribution when a future mixed draft is edited.
  if (existing.blocks.some(b => b.origin === 'ai')) {
    const remaining = text.trim();
    const aiBlocks = existing.blocks.filter(b => b.origin === 'ai' && b.text && remaining.includes(b.text));
    let cursor = 0; const blocks: HumanBlock[] = [];
    for (const block of aiBlocks) {
      const at = remaining.indexOf(block.text, cursor); if (at < 0) continue;
      if (at > cursor) blocks.push({ id: `manual/${cursor}`, text: remaining.slice(cursor, at), origin: 'human', evidence });
      blocks.push(structuredClone(block)); cursor = at + block.text.length;
    }
    if (cursor < remaining.length) blocks.push({ id: `manual/${cursor}`, text: remaining.slice(cursor), origin: 'human', evidence });
    // Preserve the editor's exact spacing; block joins are only for spoken passages.
    return { ...existing, text, blocks, humanWords: blocks.reduce((n, b) => n + (b.origin === 'human' ? words(b.text) : 0), 0), totalWords: words(text) };
  }
  return { ...existing, text, blocks: [{ id: 'manual', text, origin: 'human', evidence }], humanWords: words(text), totalWords: words(text) };
}

const listeners = new Map<string, Set<() => void>>();
/** Private local working copy. Every successful CAS appends a durable version; no deletion API. */
export class WorkingCardStore {
  constructor(private readonly name = 'oracle-working-cards-v1') {}
  subscribe(listener: () => void): () => void {
    const set = listeners.get(this.name) ?? new Set(); listeners.set(this.name, set); set.add(listener);
    return () => { set.delete(listener); };
  }
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => {
        const sections = req.result.createObjectStore('sections', { keyPath: 'key' }); sections.createIndex('cardNumber', 'cardNumber');
        const history = req.result.createObjectStore('history', { keyPath: ['key', 'revision'] }); history.createIndex('key', 'key');
      };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error('Cannot open private working cards'));
    });
  }
  private async run<T>(names: string[], mode: IDBTransactionMode, body: (tx: IDBTransaction, done: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode); let value: T; let failure: Error | undefined;
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('Private working card save failed')); };
      try { body(tx, v => { value = v; }, e => { failure = e; tx.abort(); }); } catch (e) { failure = e as Error; tx.abort(); }
    });
  }
  get(card: number, section: string): Promise<WorkingSection | undefined> { return this.run(['sections'], 'readonly', (tx, done) => { const req = tx.objectStore('sections').get(workingSectionKey(card, section)); req.onsuccess = () => done(req.result); }); }
  list(card?: number): Promise<WorkingSection[]> { return this.run(['sections'], 'readonly', (tx, done) => { const store = tx.objectStore('sections'); const req = card === undefined ? store.getAll() : store.index('cardNumber').getAll(card); req.onsuccess = () => done(req.result); }); }
  versions(card: number, section: string): Promise<WorkingSection[]> { return this.run(['history'], 'readonly', (tx, done) => { const req = tx.objectStore('history').index('key').getAll(workingSectionKey(card, section)); req.onsuccess = () => done(req.result.sort((a: WorkingSection, b: WorkingSection) => a.revision - b.revision)); }); }
  async save(next: WorkingSection, expectedRevision: number): Promise<WorkingSection> {
    if (!LENSES.includes(next.sectionId) || next.key !== workingSectionKey(next.cardNumber, next.sectionId) || next.cardNumber < 1 || next.cardNumber > 64 || !Number.isInteger(next.cardNumber)) throw new Error('Invalid working card or lens');
    if (next.text !== next.blocks.map(b => b.text).join('\n\n') && next.text !== next.blocks.map(b => b.text).join('')) throw new Error('Working words do not match their provenance');
    const saved = await this.run<WorkingSection>(['sections', 'history'], 'readwrite', (tx, done, fail) => {
      const store = tx.objectStore('sections'); const req = store.get(next.key);
      req.onsuccess = () => {
        const previous = req.result as WorkingSection | undefined;
        if ((previous?.revision ?? 0) !== expectedRevision) return fail(new Error('Another tab changed this working card. Reopen it before editing.'));
        const saved = structuredClone({ ...next, revision: expectedRevision + 1, savedAt: new Date().toISOString() });
        store.put(saved); tx.objectStore('history').add(saved); done(saved);
      };
    });
    for (const listener of listeners.get(this.name) ?? []) { try { listener(); } catch { /* A reader cannot invalidate a committed save. */ } }
    return saved;
  }
}
