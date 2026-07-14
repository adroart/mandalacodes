export type RecorderHaptic = 'press' | 'saved' | 'error';

export function formatRecorderSegmentCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 9 ? '9+' : String(Math.floor(count));
}

export function normalizeRecorderAmplitude(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128) / 128);
  return Math.min(1, Math.max(0, peak));
}

export function triggerRecorderHaptic(
  kind: RecorderHaptic,
  vibrate?: (pattern: number | number[]) => boolean,
): void {
  const vibration = vibrate ?? (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
    ? navigator.vibrate.bind(navigator)
    : null);
  if (!vibration) return;
  const pattern = kind === 'saved' ? [8, 40, 8] : kind === 'error' ? 20 : 8;
  try { vibration(pattern); } catch { /* Haptics never gate recorder behavior. */ }
}

export function startMicrophoneMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return () => undefined;

  let frame = 0;
  let stopped = false;
  let lastEmission = Number.NEGATIVE_INFINITY;
  try {
    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = .72;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const sample = (timestamp: number) => {
      if (stopped) return;
      if (timestamp - lastEmission >= 75) {
        analyser.getByteTimeDomainData(samples);
        onLevel(normalizeRecorderAmplitude(samples));
        lastEmission = timestamp;
      }
      frame = window.requestAnimationFrame(sample);
    };
    frame = window.requestAnimationFrame(sample);
    return () => {
      if (stopped) return;
      stopped = true;
      window.cancelAnimationFrame(frame);
      source.disconnect();
      analyser.disconnect();
      onLevel(0);
      void context.close().catch(() => undefined);
    };
  } catch {
    onLevel(0);
    return () => undefined;
  }
}
