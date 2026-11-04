/* The microphone level meter and haptics are the shared microphone module;
   only the segment badge is the oracle's own. */
export { normalizeRecorderAmplitude, startMicrophoneMeter, triggerRecorderHaptic, type RecorderHaptic } from '../../shared/voice/microphone';

export function formatRecorderSegmentCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 9 ? '9+' : String(Math.floor(count));
}
