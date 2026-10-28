import { createReflectionSession, getReflectionCapability, transcribeReflectionSegment, uploadReflectionSegment } from '../reflectionApi';
import { validateSegmentMetadata } from '../../../utils/oracleReflection';
import type { AuthoringServices } from './types';
/** Opt-in adapter: uploads editing audio to the existing authenticated private reflection service.
 * Existing API returns full-recording text only. Never manufactures word/section timestamps.
 * Stable IDs make retries idempotent; do not PATCH that service's original transcript.
 */
export const reflectionTranscription: NonNullable<AuthoringServices['transcribe']> = async (session, capture, audio) => {
  validateSegmentMetadata({ durationMs: capture.durationMs, byteSize: audio.size, mimeType: audio.type });
  await getReflectionCapability();
  const sessionId = session.reflectionSessionId ?? session.id;
  await createReflectionSession(sessionId, session.source.cardNumber);
  await uploadReflectionSegment({ id: capture.id, sessionId, hexagramNumber: session.source.cardNumber, recordedAt: capture.recordedAt, durationMs: capture.durationMs, mimeType: capture.mimeType, byteSize: audio.size, blob: audio });
  const segment = await transcribeReflectionSegment(capture.id);
  if (segment.transcriptionStatus !== 'transcribed' || !segment.transcript.trim()) throw new Error(segment.transcriptionError ?? 'Transcription is still pending. Your audio is saved; retry later.');
  const markers = session.markers.filter(m => m.captureId === capture.id);
  // A recording crossing sections is unresolved until manually split/assigned.
  const sectionId = markers.length === 1 && markers[0].atMs === 0 ? markers[0].sectionId : null;
  return { provider: 'Oracle private reflection service (recording-level timing)', segments: [{ text: segment.transcript, startMs: 0, endMs: capture.durationMs, sectionId, timing: 'recording' }] };
};
