/** Supplied only from a deliberately published listening catalogue, never a dictation session. */
export interface PublishedOracleRecording {
  id: string;
  cardNumber: number;
  title: string;
  sourceUrl: string;
  publishedAt: string;
  publication: 'approved-public-listening';
}

/** This guards accidental wiring; the publishing service must enforce actual author approval. */
export function publishedRecordingSource(recording: PublishedOracleRecording | null | undefined, cardNumber: number): string | null {
  if (!recording || recording.publication !== 'approved-public-listening' || recording.cardNumber !== cardNumber
    || typeof recording.id !== 'string' || !recording.id.trim() || typeof recording.title !== 'string' || !recording.title.trim()
    || typeof recording.publishedAt !== 'string' || !Number.isFinite(Date.parse(recording.publishedAt))) return null;
  try {
    const url = new URL(recording.sourceUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // Authoring media is private evidence, even when its URL happens to use HTTPS.
    if (/\/api\/oracle\/(reflections|authoring)(?:\/|$)/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

export function formatAudioTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
export function boundedSeek(value: number, duration: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, value));
}
export type SleepMinutes = 5 | 15 | 30;

/** A wall-clock deadline also catches expiry when a suspended app becomes visible again. */
export function createAudioSleepTimer(onExpire: () => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let deadline: number | null = null;
  const cancel = () => { if (timeout !== undefined) clearTimeout(timeout); timeout = undefined; deadline = null; };
  const check = () => {
    if (deadline === null) return;
    if (timeout !== undefined) clearTimeout(timeout);
    const remaining = deadline - Date.now();
    if (remaining <= 0) { cancel(); onExpire(); }
    else timeout = setTimeout(check, remaining);
  };
  return {
    arm(minutes: SleepMinutes) { cancel(); deadline = Date.now() + minutes * 60_000; check(); },
    cancel,
    check,
    deadline: () => deadline,
  };
}
