export interface SourceSection { id: string; title: string; start: number; end: number }
export interface SourceSnapshot {
  cardNumber: number; revision: string; hash: string; markdown: string; sections: SourceSection[];
}
/** `doubt` marks a word a second listening heard differently, `heardAlso` what it heard ('' when it heard nothing there). */
export interface AlignedWord { startMs: number; endMs: number; text: string; probability?: number; doubt?: true; heardAlso?: string }
/** A run of the kept words that a second listening heard differently. `text` is exact; times are within its own recording. */
export interface TranscriptDoubt { text: string; startMs: number; endMs: number; heardAlso: string }
export interface ArCreateReceipt { sourceId: string; jobId: string; reviewUrl: string; wordTimestamps?: unknown; qualityFlags?: unknown[]; warnings?: string[] }
export interface Capture {
  id: string; recordedAt: string; mimeType: string; durationMs: number;
  status: 'recording' | 'ready' | 'interrupted' | 'empty'; origin: 'microphone' | 'import'; visibleCardNumber?: number; arCreate?: ArCreateReceipt;
  /** Running total of audio bytes saved for this capture; absent on captures saved before it was kept. */
  audioBytes?: number;
}
export interface SectionMarker { captureId: string; atMs: number; sectionId: string | null }
export interface Transcript {
  id: string; captureId: string; startMs: number; endMs: number;
  raw: string; corrected: string; sectionId: string | null;
  assignment: 'hint' | 'manual' | 'unresolved'; timing: 'recording' | 'manual' | 'provider';
  provider: string; receivedAt: string; referenceOnly?: boolean;
  cardNumber?: number; order?: number; parentId?: string; words?: AlignedWord[]; speaker?: string;
  /** Doubts kept for a passage without word timings (words carry their own `doubt` otherwise). */
  doubts?: TranscriptDoubt[];
  /** true: a second listening checked these words. false: it was not checked. Absent: an older path that never checks. */
  doubtsAvailable?: boolean;
}
export interface Feedback {
  changes: string; uncertainWords: string; omissions: string; contradictions: string; unsupportedAdditions: string;
}
export interface Proposal {
  sectionId: string; cardNumber?: number; text: string; evidenceIds: string[];
  author: { kind: 'manual' } | { kind: 'ai'; provider: string; model: string };
  feedback: Feedback;
  reconciliation?: import('./reconciliation').Reconciliation;
}
export interface Approval { id: string; digest: string; sourceHash: string; sourceRevision: string; approvedBy: string; approvedAt: string; sourceHashes?: Record<number, string>; sourceRevisions?: Record<number, string> }
export interface AuthoringSession {
  schema: 1; id: string; title?: string; transcriptHistory?: Record<string, string[]>; passageNotes?: Record<string, string>; parkedPassageIds?: string[]; reflectionSessionId?: string; createdAt: string; source: SourceSnapshot; relatedSources?: SourceSnapshot[];
  captures: Capture[]; markers: SectionMarker[]; transcript: Transcript[]; proposals: Proposal[]; earlierProposals?: Proposal[]; approvals: Approval[];
}
export interface TranscriptInput { startMs: number; endMs: number; text: string; /** The speech model's words with known mishearings fixed; `text` stays the raw words. */ corrected?: string; sectionId: string | null; timing: Transcript['timing']; cardNumber?: number; order?: number; parentId?: string; words?: AlignedWord[]; speaker?: string; doubts?: TranscriptDoubt[]; doubtsAvailable?: boolean }
export interface StoredAudioChunk { key: string; sessionId: string; captureId: string; index: number; blob: Blob; endMs: number }
/** Host must fetch the CURRENT authoritative manuscript, not return the session snapshot. */
export interface AuthoringServices {
  loadSource(cardNumber: number): Promise<SourceSnapshot>;
  transcribe?: (session: AuthoringSession, capture: Capture, audio: Blob) => Promise<{ provider: string; segments: TranscriptInput[]; durationMs?: number; arCreate?: ArCreateReceipt; doubts?: TranscriptDoubt[]; doubtsAvailable?: boolean }>;
  /** Server-side authenticated service only. The host is responsible for provider credentials. */
  propose?: (session: AuthoringSession) => Promise<Proposal[]>;
}
