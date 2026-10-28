import type { AuthoringSession, Transcript } from './types';
import { correctTranscript } from './workflow';

export interface ReplacementPreview { id: string; before: string; after: string; count: number }
const MAX_HISTORY = 20;
const MAX_TEXT = 2_000_000;
function passage(session: AuthoringSession, id: string): Transcript {
  if (typeof id !== 'string' || !id) throw new Error('Choose a passage first.');
  const found = session.transcript.find(t => t.id === id);
  if (!found) throw new Error('This passage is no longer in the draft.');
  return found;
}
function textInput(text: string) {
  if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error('Passage text is invalid or too long.');
}
function storedHistory(session: AuthoringSession, id: string): string[] {
  const history = session.transcriptHistory?.[id] ?? [];
  if (!Array.isArray(history) || history.length > MAX_HISTORY || history.some(item => typeof item !== 'string' || item.length > MAX_TEXT)) throw new Error('This passage has an invalid edit history.');
  return history;
}

/** Corrected words can change; original words, source audio and proposals stay intact. */
export function editPassage(session: AuthoringSession, id: string, text: string): AuthoringSession {
  const current = passage(session, id);
  textInput(text);
  if (current.corrected === text) return session;
  const history = [...storedHistory(session, id), current.corrected].slice(-MAX_HISTORY);
  return { ...correctTranscript(session, id, { corrected: text }), transcriptHistory: { ...session.transcriptHistory, [id]: history } };
}

export function undoPassage(session: AuthoringSession, id: string): AuthoringSession {
  passage(session, id);
  const history = storedHistory(session, id);
  if (!history.length) return session;
  return { ...correctTranscript(session, id, { corrected: history[history.length - 1] }), transcriptHistory: { ...session.transcriptHistory, [id]: history.slice(0, -1) } };
}

/** Literal, case-sensitive, nonoverlapping replacement; dollar signs have no special meaning. */
export function previewReplacement(session: AuthoringSession, ids: string[], find: string, replace: string): ReplacementPreview[] {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new Error('Choose each passage only once.');
  if (typeof find !== 'string' || !find.trim()) throw new Error('Enter the exact words to find.');
  textInput(find); textInput(replace);
  return ids.flatMap(id => {
    const current = passage(session, id);
    if (current.referenceOnly) throw new Error('Restore this passage before changing its words.');
    const parts = current.corrected.split(find), count = parts.length - 1;
    if (!count || find === replace) return [];
    const after = parts.join(replace);
    textInput(after);
    return [{ id, before: current.corrected, after, count }];
  });
}

/** Recompute against the latest draft; a preview never holds an obsolete session snapshot. */
export function applyReplacement(session: AuthoringSession, ids: string[], find: string, replace: string): AuthoringSession {
  return previewReplacement(session, ids, find, replace).reduce((next, change) => editPassage(next, change.id, change.after), session);
}

export function parkPassage(session: AuthoringSession, id: string): AuthoringSession {
  const current = passage(session, id);
  if (current.referenceOnly || session.transcript.some(t => t.parentId === id)) throw new Error('Only an active passage without derived excerpts can be set aside.');
  return { ...correctTranscript(session, id, { referenceOnly: true }), parkedPassageIds: [...new Set([...(session.parkedPassageIds ?? []), id])] };
}

export function restorePassage(session: AuthoringSession, id: string): AuthoringSession {
  const current = passage(session, id);
  if (!session.parkedPassageIds?.includes(id) || !current.referenceOnly || session.transcript.some(t => t.parentId === id)) throw new Error('Only a passage you set aside can be restored here. Original transcript references stay protected.');
  return { ...correctTranscript(session, id, { referenceOnly: false }), parkedPassageIds: session.parkedPassageIds.filter(parked => parked !== id) };
}

export function setPassageNote(session: AuthoringSession, id: string, note: string): AuthoringSession {
  passage(session, id);
  if (typeof note !== 'string' || note.length > 4000) throw new Error('Keep passage notes under 4,000 characters.');
  return { ...session, passageNotes: { ...session.passageNotes, [id]: note } };
}

/** Optional editor state is validated on local saves and portable review import. */
export function validatePassageToolsState(session: AuthoringSession): void {
  const ids = new Set(session.transcript.map(t => t.id));
  const plain = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  if (session.title !== undefined && (typeof session.title !== 'string' || session.title.length > 120)) throw new Error('Draft names must be under 120 characters.');
  if (session.transcriptHistory !== undefined) {
    if (!plain(session.transcriptHistory) || Object.entries(session.transcriptHistory).some(([id, history]) => !ids.has(id) || !Array.isArray(history) || history.length > MAX_HISTORY || history.some(text => typeof text !== 'string' || text.length > MAX_TEXT))) throw new Error('Invalid passage edit history.');
  }
  if (session.passageNotes !== undefined) {
    if (!plain(session.passageNotes) || Object.entries(session.passageNotes).some(([id, note]) => !ids.has(id) || typeof note !== 'string' || note.length > 4000)) throw new Error('Invalid passage notes.');
  }
  if (session.parkedPassageIds !== undefined) {
    if (!Array.isArray(session.parkedPassageIds) || new Set(session.parkedPassageIds).size !== session.parkedPassageIds.length || session.parkedPassageIds.some(id => typeof id !== 'string' || !session.transcript.some(t => t.id === id && t.referenceOnly) || session.transcript.some(t => t.parentId === id))) throw new Error('Invalid set-aside passage list. Original transcript references stay protected.');
  }
}
