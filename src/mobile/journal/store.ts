import type { CastResult } from '../../../utils/ichingCasting';

export const JOURNAL_KEY = 'oracle.reading-journal.v1';
const CHANGED_EVENT = 'oracle:reading-journal-changed';
export interface ReadingFollowUp { id: string; text: string; createdAt: number }
export interface ReadingEntry {
  id: string;
  eventId?: string;
  cardNumber: number;
  question: string;
  cast?: CastResult;
  createdAt: number;
  updatedAt: number;
  reflection: string;
  followUps: ReadingFollowUp[];
}
export interface RecordReadingInput { cardNumber: number; question?: string; cast?: CastResult; eventId?: string }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface JournalDocument { version: 1; entries: ReadingEntry[] }
const isCard = (n: unknown): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 64;
const isTime = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isText = (s: unknown): s is string => typeof s === 'string';
const fail = (message: string): never => { throw new Error(message); };
function validCast(cast: unknown): cast is CastResult {
  if (!cast || typeof cast !== 'object') return false;
  const c = cast as CastResult;
  return isCard(c.primaryNumber) && (c.changedNumber === null || isCard(c.changedNumber))
    && Array.isArray(c.lines) && c.lines.length === 6
    && c.lines.every((line, i) => line && line.position === i + 1 && [6, 7, 8, 9].includes(line.value)
      && line.yang === (line.value === 7 || line.value === 9) && line.moving === (line.value === 6 || line.value === 9))
    && Array.isArray(c.movingPositions)
    && JSON.stringify(c.movingPositions) === JSON.stringify(c.lines.filter(line => line.moving).map(line => line.position));
}
function validEntry(value: unknown): value is ReadingEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as ReadingEntry;
  return isText(e.id) && !!e.id && (e.eventId === undefined || (isText(e.eventId) && !!e.eventId))
    && isCard(e.cardNumber) && isText(e.question) && isText(e.reflection)
    && isTime(e.createdAt) && isTime(e.updatedAt) && e.updatedAt >= e.createdAt
    && (e.cast === undefined || validCast(e.cast))
    && Array.isArray(e.followUps) && e.followUps.every(f => f && isText(f.id) && !!f.id && isText(f.text) && isTime(f.createdAt));
}
function decode(raw: string | null): JournalDocument {
  if (raw === null) return { version: 1, entries: [] };
  try {
    const doc = JSON.parse(raw);
    if (doc?.version !== 1 || !Array.isArray(doc.entries) || !doc.entries.every(validEntry)) throw new Error();
    if (new Set(doc.entries.map((entry: ReadingEntry) => entry.id)).size !== doc.entries.length) throw new Error();
    return doc;
  } catch {
    return fail('Your saved journal could not be read. It has not been overwritten. Keep a backup before recovering it.');
  }
}

/** Each mutation reads the latest document. Malformed or newer data is never replaced. */
export function createJournalStore(storage: StorageLike, now: () => number = Date.now, makeId: () => string = () => crypto.randomUUID(), changed: () => void = () => {}) {
  const read = () => {
    let raw: string | null;
    try { raw = storage.getItem(JOURNAL_KEY); }
    catch { return fail('Your journal is unavailable on this device. Try again before leaving this reading.'); }
    return decode(raw);
  };
  const write = (doc: JournalDocument) => {
    try { storage.setItem(JOURNAL_KEY, JSON.stringify(doc)); }
    catch { return fail('Your journal could not be saved. Keep this page open and copy your writing before trying again.'); }
    changed();
  };
  const update = (id: string, transform: (entry: ReadingEntry) => ReadingEntry) => {
    const doc = read();
    const index = doc.entries.findIndex(entry => entry.id === id);
    if (index < 0) return fail('This reading could not be found. Your writing has not been saved.');
    const entry = transform(doc.entries[index]);
    doc.entries[index] = entry;
    write(doc);
    return entry;
  };
  return {
    getReadings: () => read().entries.slice().sort((a, b) => b.createdAt - a.createdAt),
    recordReading(input: RecordReadingInput): ReadingEntry {
      if (!isCard(input.cardNumber) || (input.cast !== undefined && !validCast(input.cast))) return fail('This reading is incomplete and could not be saved.');
      if (input.question !== undefined && !isText(input.question)) return fail('The reading question must be text.');
      if (input.eventId !== undefined && (!isText(input.eventId) || !input.eventId.trim())) return fail('The reading event needs a valid identifier.');
      const doc = read();
      const existing = input.eventId ? doc.entries.find(entry => entry.eventId === input.eventId) : undefined;
      if (existing) return existing;
      const timestamp = now();
      const entry: ReadingEntry = {
        id: makeId(), ...(input.eventId ? {eventId:input.eventId} : {}), cardNumber: input.cardNumber,
        question: (input.question ?? '').trim(), ...(input.cast ? {cast:JSON.parse(JSON.stringify(input.cast)) as CastResult} : {}),
        createdAt: timestamp, updatedAt: timestamp, reflection: '', followUps: [],
      };
      doc.entries.unshift(entry);
      write(doc);
      return entry;
    },
    saveReflection(id: string, reflection: string) {
      if (!isText(reflection)) return fail('Your reflection must be text.');
      return update(id, entry => ({...entry, reflection, updatedAt:Math.max(now(), entry.updatedAt)}));
    },
    addFollowUp(id: string, text: string) {
      if (!isText(text) || !text.trim()) return fail('Write a follow-up before saving it.');
      return update(id, entry => ({...entry, updatedAt:Math.max(now(), entry.updatedAt), followUps:[...entry.followUps, {id:makeId(), text:text.trim(), createdAt:now()}]}));
    },
    exportBackup: () => JSON.stringify(read(), null, 2),
    // Available even when parsing is blocked, so a malformed file can be recovered.
    exportRawBackup: () => storage.getItem(JOURNAL_KEY) ?? JSON.stringify({version:1, entries:[]}),
  };
}
function browserStore() {
  let storage: Storage;
  try { storage = window.localStorage; }
  catch { return fail('Your journal is unavailable on this device. Try again before leaving this reading.'); }
  return createJournalStore(storage, Date.now, () => crypto.randomUUID(), () => window.dispatchEvent(new Event(CHANGED_EVENT)));
}
export const getReadings = () => browserStore().getReadings();
export const recordReading = (input: RecordReadingInput) => browserStore().recordReading(input);
export const saveReflection = (id: string, text: string) => browserStore().saveReflection(id, text);
export const addFollowUp = (id: string, text: string) => browserStore().addFollowUp(id, text);
export const exportJournalBackup = () => browserStore().exportRawBackup();
export function subscribeReadings(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === JOURNAL_KEY || event.key === null) listener(); };
  window.addEventListener(CHANGED_EVENT, listener);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(CHANGED_EVENT, listener); window.removeEventListener('storage', storage); };
}
export function journalMarkdown(entries: ReadingEntry[], cardName: (number: number) => string = number => `Card ${number}`) {
  return ['# Oracle reading journal', '', ...entries.flatMap(entry => [
    `## ${cardName(entry.cardNumber)} · ${entry.cardNumber}`, '',
    `Reading ID: ${entry.id}`, `Drawn: ${new Date(entry.createdAt).toISOString()}`, '',
    ...(entry.question ? ['### Question', '', entry.question, ''] : []),
    ...(entry.cast ? [`Primary hexagram: ${entry.cast.primaryNumber}`, `Changing lines: ${entry.cast.movingPositions.join(', ') || 'None'}`, `Changed hexagram: ${entry.cast.changedNumber ?? 'None'}`, ''] : []),
    '### Reflection', '', entry.reflection || '(Not yet written)', '',
    ...entry.followUps.flatMap(followUp => [`### Follow-up · ${new Date(followUp.createdAt).toISOString()}`, '', followUp.text, '']),
  ])].join('\n');
}
