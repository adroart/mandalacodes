import type { QuickSegment, QuickTranscript } from './quickTranscription';
import { buildWordsPrompt } from '../../../shared/words';

/**
 * The text side of a memo, with no site dependencies, so the transcriber on the VPS can use it without the site's
 * sign-in code: the vocabulary prompt and the timed transcript AR Create reads.
 */
/** The memo's vocabulary prompt: its own sentence, then the shared library's words (tea, people and places first). */
export const memoTranscriptionPrompt = () => buildWordsPrompt(undefined, {
  intro: 'A voice memo about tea, ceramics, art, travel and the people met. Preserve these spellings and natural punctuation.',
  head: 'Terms: ',
  order: 'category-first',
  categories: ['person', 'place', 'tea-term', 'other'],
}).prompt;

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600), m = Math.floor(whole / 60) % 60, s = whole % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(s).padStart(2, '0');
};

// A new paragraph at a pause this long, or once a paragraph has run this long; each one starts with its time.
const PARAGRAPH_PAUSE_S = 2;
const PARAGRAPH_MAX_S = 60;

/**
 * The transcript as AR Create reads it: paragraphs separated by blank lines, each opening with "[m:ss]" so every
 * moment keeps its real time. The words are the transcript's own; nothing is added between them.
 */
export function timedTranscriptText(transcript: Pick<QuickTranscript, 'text' | 'segments'>): string {
  const segments: QuickSegment[] = transcript.segments ?? [];
  if (!segments.length) return transcript.text.trim() + '\n';
  const paragraphs: { at: number; parts: string[] }[] = [];
  let previousEnd = -Infinity;
  for (const segment of segments) {
    const current = paragraphs[paragraphs.length - 1];
    if (!current || segment.start - previousEnd >= PARAGRAPH_PAUSE_S || segment.start - current.at >= PARAGRAPH_MAX_S) paragraphs.push({ at: segment.start, parts: [] });
    paragraphs[paragraphs.length - 1].parts.push(segment.text.trim());
    previousEnd = segment.end;
  }
  return paragraphs.map((p) => `[${clock(p.at)}] ${p.parts.filter(Boolean).join(' ')}`).join('\n\n') + '\n';
}
