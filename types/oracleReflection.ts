export const REFLECTION_LIMITS = {
  maxSegmentBytes: 10 * 1024 * 1024,
  maxSegmentDurationMs: 20 * 60 * 1000,
  longPressMs: 650,
} as const;

export type TranscriptionStatus = 'uploading' | 'transcription_pending' | 'transcribing' | 'transcribed' | 'failed';

export interface ReflectionSession { id: string; hexagramNumber: number; createdAt: string; updatedAt: string; finishedAt: string | null }
export interface ReflectionSegment {
  id: string; sessionId: string; sequence: number; recordedAt: string; durationMs: number; mimeType: string;
  byteSize: number; transcript: string; transcriptionStatus: TranscriptionStatus; transcriptionError: string | null; transcriptionStartedAt: string | null; updatedAt: string;
}
export interface SegmentMetadataInput {
  id: string; sessionId: string; hexagramNumber: number; recordedAt: string; durationMs: number; mimeType: string; byteSize: number;
}
export interface ReflectionSessionsResponse { current: ReflectionSession | null; history: ReflectionSession[] }
