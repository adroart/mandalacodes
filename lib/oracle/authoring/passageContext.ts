/** Exact reading references. Offsets always address sectionText, never rendered HTML. */
export interface PassageAnchor {
  id: string;
  cardNumber: number;
  sectionId: string;
  text: string;
  sectionText: string;
  start: number;
  end: number;
  revision?: number;
  sourceHash?: string;
}
export interface PassageIntent {
  kind: 'replace' | 'append' | 'connect' | 'explain';
  words: string;
  reference: string;
  /** Unsupported or ambiguous editing commands require explicit human correction. */
  needsReview?: string;
}

/** Paragraph references preserve the source's punctuation and exact character ranges. */
export function passagesFromText(cardNumber: number, sectionId: string, text: string, revision?: number, sourceHash?: string): PassageAnchor[] {
  const anchors: PassageAnchor[] = [];
  const separator = /\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/g;
  let cursor = 0;
  const add = (limit: number) => {
    const raw = text.slice(cursor, limit);
    const leading = raw.match(/^\s*/)?.[0].length ?? 0;
    const body = raw.trim();
    if (body) {
      const start = cursor + leading, end = start + body.length;
      anchors.push({ id: `${cardNumber}/${sectionId}/${start}-${end}`, cardNumber, sectionId, text: body, sectionText: text, start, end, ...(revision === undefined ? {} : { revision }), ...(sourceHash === undefined ? {} : { sourceHash }) });
    }
  };
  for (const match of text.matchAll(separator)) { add(match.index!); cursor = match.index! + match[0].length; }
  add(text.length);
  return anchors;
}

/** Only bounded instruction syntax is removed. Everything else remains literal speech. */
function parsePassageSpeech(text: string): PassageIntent {
  const input = text.trim();
  const review = (words: string, reason: string, kind: PassageIntent['kind'] = 'explain', reference = ''): PassageIntent => ({ kind, reference, words, needsReview: reason });
  // A fully specified compound can address the remainder of one exact passage.
  // "Opening" alone is ambiguous: it might mean a word, sentence or paragraph.
  const keepOpening = /^(?:please\s+)?keep\s+the\s+opening(\s+sentence)?\s+of\s+(?:the\s+)?first(?:\s+(?:selected\s+)?passage)?[.,;]\s*(?:and\s+)?replace\s+the\s+(?:rest|explanation)\s+with(?:\s+(?:this|these words)(?=\s*:))?\s*:?\s+([\s\S]+)$/i.exec(input);
  if (keepOpening) {
    const words = keepOpening[2].trim();
    return keepOpening[1]
      ? { kind: 'replace', reference: 'the text after the opening sentence of the first selected passage', words }
      : review(words, 'Which opening should stay: a sentence or a longer passage?', 'replace', 'the first selected passage');
  }
  const quotedMeaning = /^(?:well[,\s]+)?(?:(?:where|when)\s+)?you\s+(?:said|wrote)\s+["“]([^"”]+)["”][,.:;\s]+(?:what\s+i\s+mean\s+is|here(?:'s| is)\s+what\s+i\s+mean)\s*:?\s+([\s\S]+)$/i.exec(input);
  if (quotedMeaning) return { kind: 'explain', reference: quotedMeaning[1].trim(), words: quotedMeaning[2].trim() };
  // Self-correction refers to spoken words, not necessarily to the manuscript.
  // Do not discard the first version and overwrite a guessed manuscript target.
  const selfCorrection = /(?:^|[.!?]\s+)(?:(?:scratch\s+that|no,?\s+instead|let\s+me\s+say\s+that\s+differently)[.!?,:;\s]+|correction[.!?,:;]\s*)([\s\S]*)$/i.exec(input);
  if (selfCorrection) return review(selfCorrection[1].trim(), 'Check which earlier spoken words this correction replaces.');
  const quotedReplacement = /^(?:where|when)\s+you\s+(?:said|wrote)\s+["“]([^"”]+)["”][,.:;\s]+(?:please\s+)?(?:replace|rewrite)\s+(?:it|that|this)(?:\s+(?:passage|paragraph|sentence))?\s+with(?:\s+(?:this|these words)(?=\s*:))?\s*:?\s+([\s\S]+)$/i.exec(input);
  if (quotedReplacement) return { kind: 'replace', reference: quotedReplacement[1].trim(), words: quotedReplacement[2].trim() };
  const unquotedMeaning = /^(?:where|when)\s+you\s+(?:said|wrote)\s+(.+?)[,;:]\s*(?:what\s+i\s+mean\s+is|here(?:'s| is)\s+what\s+i\s+mean)\s*:?\s+([\s\S]+)$/i.exec(input);
  if (unquotedMeaning) return { kind: 'explain', reference: unquotedMeaning[1].trim(), words: unquotedMeaning[2].trim() };
  const unquotedReplacement = /^(?:where|when)\s+you\s+(?:said|wrote)\s+(.+?)[,;:]\s*(?:please\s+)?(?:replace|rewrite)\s+(?:it|that|this)(?:\s+(?:passage|paragraph|sentence))?\s+with\s+([\s\S]+)$/i.exec(input);
  if (unquotedReplacement) return { kind: 'replace', reference: unquotedReplacement[1].trim(), words: unquotedReplacement[2].trim() };
  const quotedReference = /^(?:well[,\s]+)?(?:(?:where|when)\s+)?you\s+(?:said|wrote)\s+["“]([^"”]+)["”][.!?\s]*$/i.exec(input);
  if (quotedReference) return { kind: 'explain', reference: quotedReference[1].trim(), words: '' };
  const unquotedReference = /^(?:well[,\s]+)?(?:where|when)\s+you\s+(?:said|wrote)\s+([\s\S]+)$/i.exec(input);
  if (unquotedReference) return { kind: 'explain', reference: unquotedReference[1].trim(), words: '' };
  const commandOnly = /^(?:please\s+)?(?:replace|rewrite|re-record|rerecord)\s+((?:this|that|the selected)(?:\s+last)?\s+(?:passage|paragraph|sentence|text))[.!?\s]*$/i.exec(input);
  if (commandOnly) return { kind: 'replace', reference: commandOnly[1], words: '' };
  const replacement = /^(?:please\s+)?(?:replace|rewrite|re-record|rerecord)\s+(.+?)\s+with(?:\s+(?:this|these words|the following)(?=\s*:))?\s*:?\s+([\s\S]+)$/i.exec(input);
  if (replacement) return { kind: 'replace', reference: replacement[1].trim(), words: replacement[2].trim() };
  const shortReplacement = /^(?:please\s+)?(?:replace|rewrite|re-record|rerecord)\s+((?:this|that|the selected)\s+(?:passage|paragraph|sentence|text))\s*:\s*([\s\S]*)$/i.exec(input);
  if (shortReplacement) return { kind: 'replace', reference: shortReplacement[1], words: shortReplacement[2].trim() };
  const addition = /^(?:please\s+)?(?:add|append)\s+(this|these words|the following)(?:\s+(after|to|before)\s+([^:]+))?\s*:\s*([\s\S]*)$/i.exec(input);
  // "Before" needs a distinct insertion operation. Do not silently turn it into append.
  if (addition && addition[2]?.toLowerCase() === 'before') return review(addition[4].trim(), 'Choose the insertion point before this passage.', 'append', addition[3]?.trim() ?? '');
  if (addition && addition[2]?.toLowerCase() !== 'before') return { kind: 'append', reference: addition[3]?.trim() ?? '', words: addition[4].trim() };
  if (/^(?:(?:these|those)\s+(?:two\s+)?passages\s+(?:belong together|are connected|are related)|connect\s+(?:these|those|the selected)\s+(?:two\s+)?passages)[.!?\s]*$/i.test(input)) return { kind: 'connect', reference: input, words: '' };
  const explanation = /^(?:here(?:'s| is)\s+what\s+i\s+mean(?:\s+by\s+([^:]+))?)\s*:\s*([\s\S]*)$/i.exec(input);
  if (explanation) return { kind: 'explain', reference: explanation[1]?.trim() ?? '', words: explanation[2].trim() };
  if (/^(?:(?:this|that)(?:\s+(?:last|final|first|opening))?\s+(?:sentence|passage|paragraph)|(?:the\s+)?(?:last|final|first|opening)\s+sentence|(?:the\s+)?(?:paragraph|sentence)\s+(?:above|below)|both\s+of\s+(?:these|those)|(?:these|those)\s+two)[.!?\s]*$/i.test(input)) return { kind: /both|two/i.test(input) ? 'connect' : 'explain', reference: input, words: '' };
  // Command-shaped leftovers are never manuscript prose. Keep the raw transcript
  // outside this intent, and ask the person to make the actual edit explicit.
  if (/^(?:please\s+)?(?:keep\s+(?:the|this|that)\s+(?:opening|first|last|sentence|paragraph|passage)|replace\s+(?:the|this|that)|rewrite\s+(?:the|this|that)|move\s+(?:the|this|that)|delete\s+(?:the|this|that)|remove\s+(?:the|this|that)|add\s+(?:this|these words)|append\s+(?:this|these words)|(?:actually[,\s]+)?let\s+me\s+say\s+that\s+differently)\b/i.test(input)) {
    const afterColon = /:\s*([\s\S]+)$/.exec(input)?.[1]?.trim() ?? '';
    return review(afterColon, 'Check this editing instruction before applying any words.');
  }
  return { kind: 'explain', reference: '', words: input };
}

/** A second instruction embedded inside proposed prose cannot bypass review. */
export function interpretPassageSpeech(text: string): PassageIntent {
  const intent = parsePassageSpeech(text);
  if (intent.needsReview) return intent;
  const embedded = /(?:^|[.!?]\s+)(?:please\s+)?(?:replace|rewrite|re-record|delete|remove|move|keep)\s+(?:(?:this|that|the|these|those)\s+)?(?:paragraph|sentence|passage|opening|word|words)\b/i.test(intent.words);
  if (embedded) return { ...intent, needsReview: 'This thought still contains an editing instruction. Separate the instruction from your manuscript words.' };
  return intent;
}

const tokens = (text: string) => text.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) ?? [];
const normalized = (text: string) => tokens(text).join(' ');
const STOP = new Set('a an and are as at be been both by card did do for from had has have here i in is it its me my of on or our passage passages paragraph paragraphs said says section sentence text that the these this those to two was we were what where which with you your'.split(' '));

/** Ranked suggestions only: scores are lexical similarity, never transcription confidence. */
export function matchPassages(query: string, anchors: PassageAnchor[], focusIds: string[] = []): { anchor: PassageAnchor; score: number }[] {
  const input = query.trim();
  const focus = new Set(focusIds);
  if (/^(?:the\s+)?paragraph\s+(above|below)[.!?\s]*$/i.test(input)) {
    const selected = anchors.filter(anchor => focus.has(anchor.id));
    const direction = /above/i.test(input) ? -1 : 1;
    const result: { anchor: PassageAnchor; score: number }[] = [];
    for (const selectedAnchor of selected) {
      const adjacent = anchors.filter(anchor => anchor.cardNumber === selectedAnchor.cardNumber && anchor.sectionId === selectedAnchor.sectionId && (direction < 0 ? anchor.end <= selectedAnchor.start : anchor.start >= selectedAnchor.end)).sort((a, b) => direction < 0 ? b.end - a.end : a.start - b.start)[0];
      if (adjacent && !result.some(item => item.anchor.id === adjacent.id)) result.push({ anchor: adjacent, score: .95 });
    }
    return result;
  }
  const sentenceReference = /^(?:(?:that|this|the)\s+)?(?:(last|final|opening|first)\s+sentence|sentence\s+(above|below))[.!?\s]*$/i.exec(input);
  const remainderReference = /^the\s+text\s+after\s+the\s+opening\s+sentence\s+of\s+the\s+first\s+selected\s+passage[.!?\s]*$/i.test(input);
  if (sentenceReference || remainderReference) {
    const selected = focusIds.map(id=>anchors.find(anchor=>anchor.id===id)).filter((anchor):anchor is PassageAnchor=>!!anchor);
    const focused = remainderReference ? selected.slice(0, 1) : selected;
    return focused.flatMap(anchor => {
      const sentences = [...anchor.text.matchAll(/[^.!?]+(?:[.!?]+|$)/g)].filter(match => match[0].trim());
      let sentence = /last|final/i.test(sentenceReference?.[1] ?? '') ? sentences.at(-1) : sentences[0];
      if (sentenceReference?.[2]) {
        const local = anchors.filter(a => a.cardNumber === anchor.cardNumber && a.sectionId === anchor.sectionId);
        const before = /above/i.test(sentenceReference[2]);
        const adjacent = local.filter(a => before ? a.end <= anchor.start : a.start >= anchor.end).sort((a,b)=>before?b.end-a.end:a.start-b.start)[0];
        if (!adjacent) return [];
        const parts = [...adjacent.text.matchAll(/[^.!?]+(?:[.!?]+|$)/g)].filter(match=>match[0].trim());
        const part = before ? parts.at(-1) : parts[0];
        if (!part) return [];
        const text = part[0].trim(), start = adjacent.start + part.index! + (part[0].match(/^\s*/)?.[0].length ?? 0);
        return [{anchor:{...adjacent,id:`${adjacent.cardNumber}/${adjacent.sectionId}/${start}-${start+text.length}`,text,start,end:start+text.length},score:.95}];
      }
      if (!sentence) return [];
      let start = anchor.start + sentence.index! + (sentence[0].match(/^\s*/)?.[0].length ?? 0);
      let text = sentence[0].trim();
      if (remainderReference) {
        const afterFirst = sentence.index! + sentence[0].length;
        const rest = anchor.text.slice(afterFirst), leading = rest.match(/^\s*/)?.[0].length ?? 0;
        text = rest.trim(); start = anchor.start + afterFirst + leading;
        if (!text) return [];
      }
      return [{ anchor: { ...anchor, id: `${anchor.cardNumber}/${anchor.sectionId}/${start}-${start + text.length}`, text, start, end: start + text.length }, score: .95 }];
    });
  }
  if (/^(?:both of (?:these|those)|these two|those two|(?:this|that|the selected|the current) (?:passage|paragraph|text))[.!?\s]*$/i.test(input)) {
    return anchors.filter(anchor => focus.has(anchor.id)).map(anchor => ({ anchor, score: .95 }));
  }
  const quotes = [...input.matchAll(/["“]([^"”]+)["”]/g)].map(match => normalized(match[1])).filter(Boolean);
  const key = normalized(input.replace(/^(?:(?:where|when)\s+you\s+(?:said|wrote)|the\s+(?:passage|paragraph|sentence)\s+(?:about|where)|about)\s+/i, ''));
  if (!key) return [];
  const distinctive = [...new Set(tokens(key).filter(token => !STOP.has(token)))];
  const results: { anchor: PassageAnchor; score: number }[] = [];
  for (const anchor of anchors) {
    const body = normalized(anchor.text);
    if (!body) continue;
    let score = 0;
    if (body === key) score = 1;
    else if (quotes.some(quote => tokens(quote).length >= 2 && body.includes(quote))) score = .98;
    else if (tokens(key).length >= 3 && body.includes(key)) score = .96;
    else {
      const candidate = new Set(tokens(body));
      const shared = distinctive.filter(token => candidate.has(token));
      if (shared.length >= 2) {
        const coverage = shared.length / distinctive.length;
        if (coverage >= .5) {
          let consecutive = 0;
          const queryWords = tokens(key);
          for (let i = 0; i < queryWords.length - 1; i++) if (body.includes(`${queryWords[i]} ${queryWords[i + 1]}`)) consecutive++;
          score = .45 + .35 * coverage + Math.min(.1, consecutive * .025);
        }
      }
    }
    if (score) results.push({ anchor, score: Math.min(1, score + (focus.has(anchor.id) ? .02 : 0)) });
  }
  return results.sort((a, b) => b.score - a.score || anchors.indexOf(a.anchor) - anchors.indexOf(b.anchor));
}

/** Exact mutation only. A changed surrounding section is accepted only if the original
 * target still occurs once; a changed or ambiguous target always requires re-selection. */
export function replaceAnchoredText(current: string, anchor: PassageAnchor, replacement: string): string {
  if (!anchor.text || !Number.isInteger(anchor.start) || !Number.isInteger(anchor.end) || anchor.start < 0 || anchor.end <= anchor.start || anchor.end > anchor.sectionText.length || anchor.sectionText.slice(anchor.start, anchor.end) !== anchor.text) throw new Error('This passage reference is invalid. Select the passage again.');
  if (!replacement.trim()) throw new Error('Add your words before replacing this passage.');
  let start = anchor.start;
  if (current !== anchor.sectionText) {
    start = current.indexOf(anchor.text);
    if (start < 0 || current.indexOf(anchor.text, start + 1) !== -1) throw new Error('This passage changed or appears more than once. Select it again before replacing.');
  }
  if (current.slice(start, start + anchor.text.length) !== anchor.text) throw new Error('This passage changed. Select it again before replacing.');
  return current.slice(0, start) + replacement + current.slice(start + anchor.text.length);
}

/** Break at explicit spoken transitions without rewriting or discarding the cues. */
export function splitSpokenThoughts(text: string): string[] {
  if (!text.trim()) return [];
  const boundary = /(?<=[.!?])\s+(?=(?:here(?:'s| is)\s+(?:another|a new)\s+(?:concept|thought)|now\s+(?:(?:about|on to|for)\s+)?(?:card|code|gate|hexagram)\s+(?:\d+|[a-z]+)|actually\b|correction\b|instead\b))/gi;
  return text.split(boundary).map(part => part.trim()).filter(Boolean);
}
