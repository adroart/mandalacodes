import type { PassageAnchor } from '../../../lib/oracle/authoring/passageContext';
import { interpretPassageSpeech, matchPassages } from '../../../lib/oracle/authoring/passageContext';

export interface SpokenPassageDecision {
  contextual: boolean;
  kind: 'replace' | 'append' | 'connect' | 'explain';
  words: string;
  targets: PassageAnchor[];
  candidates: PassageAnchor[];
  message?: string;
}

/** A reference is context, never permission to replace a whole reading. */
export function decideSpokenPassage(text: string, anchors: PassageAnchor[], focused: PassageAnchor[] = [], selectedIds: string[] = []): SpokenPassageDecision {
  const intent = interpretPassageSpeech(text);
  const contextual = intent.kind !== 'explain' || Boolean(intent.reference.trim()) || /\b(?:where you (?:said|wrote)|you (?:said|wrote)|(?:that|this|these|both|last|above|previous) (?:sentence|paragraph|passage)|both of these)\b/i.test(text);
  const base = { contextual, kind: intent.kind, words: intent.words, targets: [] as PassageAnchor[], candidates: [] as PassageAnchor[] };
  if (!contextual) {
    if(focused.length===1)return {...base,contextual:true,kind:'append',targets:focused,candidates:focused};
    if(focused.length>1)return {...base,contextual:true,kind:'append',candidates:focused,message:'Which selected passage should receive these words?'};
    return base;
  }
  const chosen = selectedIds.map(id => anchors.find(a => a.id === id) ?? focused.find(a => a.id === id)).filter((a): a is PassageAnchor => !!a);
  if (chosen.length) return { ...base, targets: chosen, candidates: chosen };
  if (intent.kind === 'connect' && focused.length > 1) return { ...base, targets: focused, candidates: focused };
  const relational = !intent.reference.trim() || /^(?:(?:this|that|the selected|the current)\s+(?:paragraph|passage|text)|it)[.!?,:;]*$/i.test(intent.reference.trim());
  if (relational && focused.length === 1) return { ...base, targets: focused, candidates: focused };
  const matches = matchPassages(intent.reference || text, anchors, focused.map(a => a.id));
  // A selected sentence and its enclosing paragraph describe the same place,
  // not two competing destinations. Prefer the exact smaller reference when
  // its wording matches at least as well; disjoint duplicates stay ambiguous.
  const ranked = matches.filter(hit=>!matches.some(other=>other!==hit && other.anchor.cardNumber===hit.anchor.cardNumber && other.anchor.sectionId===hit.anchor.sectionId && other.anchor.start>=hit.anchor.start && other.anchor.end<=hit.anchor.end && other.anchor.end-other.anchor.start<hit.anchor.end-hit.anchor.start && other.score>=hit.score-.02));
  const candidates = ranked.slice(0, 5).map(hit => hit.anchor);
  const best = ranked[0], second = ranked[1];
  // Strong and distinctly better evidence can select a target. Broad thematic
  // similarities only offer choices; provider confidence is not a guarantee.
  if (best && best.score >= .78 && (!second || best.score - second.score >= .16)) return { ...base, targets: [best.anchor], candidates };
  return { ...base, candidates: candidates.length ? candidates : focused, message: candidates.length ? 'Which passage did you mean? Choose it before these words are applied.' : 'Select the passage you mean. Your recording is saved.' };
}

export function passageSpeechNeedsCheck(text: string, reviewed: boolean, probabilities: number[] = []): boolean {
  return !reviewed && (probabilities.some(p => p < .45) || probabilities.filter(p => p < .6).length >= 2 || /\[inaudible\]|\[unclear\]|\[unknown\]|\?{2,}|\ba chain\b|\bthanks? (?:you )?for watching\b|\bsubtitles by\b/i.test(text));
}
