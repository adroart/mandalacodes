export interface SourceSection { id: string; title: string; start: number; end: number }
export interface SourceSnapshot {
  cardNumber: number; revision: string; hash: string; markdown: string; sections: SourceSection[];
}
export interface Capture {
  id: string; recordedAt: string; mimeType: string; durationMs: number;
  status: 'recording' | 'ready' | 'interrupted' | 'empty'; origin: 'microphone' | 'import';
}
export interface SectionMarker { captureId: string; atMs: number; sectionId: string | null }
export interface Transcript {
  id: string; captureId: string; startMs: number; endMs: number;
  raw: string; corrected: string; sectionId: string | null;
  assignment: 'hint' | 'manual' | 'unresolved'; timing: 'recording' | 'manual' | 'provider';
  provider: string; receivedAt: string; referenceOnly?: boolean;
}
export interface Feedback {
  changes: string; uncertainWords: string; omissions: string; contradictions: string; unsupportedAdditions: string;
}
export interface Proposal {
  sectionId: string; text: string; evidenceIds: string[];
  author: { kind: 'manual' } | { kind: 'ai'; provider: string; model: string };
  feedback: Feedback;
}
export interface Approval { id: string; digest: string; sourceHash: string; sourceRevision: string; approvedBy: string; approvedAt: string }
export interface AuthoringSession {
  schema: 1; id: string; reflectionSessionId?: string; createdAt: string; source: SourceSnapshot;
  captures: Capture[]; markers: SectionMarker[]; transcript: Transcript[]; proposals: Proposal[]; approvals: Approval[];
}
export interface TranscriptInput { startMs: number; endMs: number; text: string; sectionId: string | null; timing: Transcript['timing'] }
export interface StoredAudioChunk { key: string; sessionId: string; captureId: string; index: number; blob: Blob; endMs: number }
/** Host must fetch the CURRENT authoritative manuscript, not return the session snapshot. */
export interface AuthoringServices {
  loadSource(cardNumber: number): Promise<SourceSnapshot>;
  transcribe?: (session: AuthoringSession, capture: Capture, audio: Blob) => Promise<{ provider: string; segments: TranscriptInput[] }>;
  /** Server-side authenticated service only. The host is responsible for provider credentials. */
  propose?: (session: AuthoringSession) => Promise<Proposal[]>;
}
