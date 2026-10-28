export interface SourceSection { id: string; title: string; start: number; end: number }
export interface SourceSnapshot {
  cardNumber: number; revision: string; hash: string; markdown: string; sections: SourceSection[];
}
export interface AlignedWord { startMs: number; endMs: number; text: string; probability?: number }
export interface ArCreateReceipt { sourceId: string; jobId: string; reviewUrl: string; wordTimestamps?: unknown; qualityFlags?: unknown[]; warnings?: string[] }
export interface Capture {
  id: string; recordedAt: string; mimeType: string; durationMs: number;
  status: 'recording' | 'ready' | 'interrupted' | 'empty'; origin: 'microphone' | 'import'; visibleCardNumber?: number; arCreate?: ArCreateReceipt;
}
export interface SectionMarker { captureId: string; atMs: number; sectionId: string | null }
export interface Transcript {
  id: string; captureId: string; startMs: number; endMs: number;
  raw: string; corrected: string; sectionId: string | null;
  assignment: 'hint' | 'manual' | 'unresolved'; timing: 'recording' | 'manual' | 'provider';
  provider: string; receivedAt: string; referenceOnly?: boolean;
  cardNumber?: number; order?: number; parentId?: string; words?: AlignedWord[]; speaker?: string;
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
export interface TranscriptInput { startMs: number; endMs: number; text: string; sectionId: string | null; timing: Transcript['timing']; cardNumber?: number; order?: number; parentId?: string; words?: AlignedWord[]; speaker?: string }
export interface StoredAudioChunk { key: string; sessionId: string; captureId: string; index: number; blob: Blob; endMs: number }
/** Host must fetch the CURRENT authoritative manuscript, not return the session snapshot. */
export interface AuthoringServices {
  loadSource(cardNumber: number): Promise<SourceSnapshot>;
  transcribe?: (session: AuthoringSession, capture: Capture, audio: Blob) => Promise<{ provider: string; segments: TranscriptInput[]; durationMs?: number; arCreate?: ArCreateReceipt }>;
  /** Server-side authenticated service only. The host is responsible for provider credentials. */
  propose?: (session: AuthoringSession) => Promise<Proposal[]>;
}
