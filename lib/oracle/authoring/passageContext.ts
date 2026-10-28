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
export function interpretPassageSpeech(text: string): PassageIntent {
  const input = text.trim();
  const quotedReplacement = /^(?:where|when)\s+you\s+(?:said|wrote)\s+["“]([^"”]+)["”][,.:;\s]+(?:please\s+)?(?:replace|rewrite)\s+(?:it|that|this)(?:\s+(?:passage|paragraph|sentence))?\s+with(?:\s+(?:this|these words)(?=\s*:))?\s*:?\s+([\s\S]+)$/i.exec(input);
  if (quotedReplacement) return { kind: 'replace', reference: quotedReplacement[1].trim(), words: quotedReplacement[2].trim() };
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
  if (addition && addition[2]?.toLowerCase() !== 'before') return { kind: 'append', reference: addition[3]?.trim() ?? '', words: addition[4].trim() };
  if (/^(?:(?:these|those)\s+(?:two\s+)?passages\s+(?:belong together|are connected|are related)|connect\s+(?:these|those|the selected)\s+(?:two\s+)?passages)[.!?\s]*$/i.test(input)) return { kind: 'connect', reference: input, words: '' };
  const explanation = /^(?:here(?:'s| is)\s+what\s+i\s+mean(?:\s+by\s+([^:]+))?)\s*:\s*([\s\S]*)$/i.exec(input);
  if (explanation) return { kind: 'explain', reference: explanation[1]?.trim() ?? '', words: explanation[2].trim() };
  if (/^(?:(?:this|that)(?:\s+last)?\s+(?:sentence|passage|paragraph)|(?:the\s+)?paragraph\s+(?:above|below)|both\s+of\s+(?:these|those)|(?:these|those)\s+two)[.!?\s]*$/i.test(input)) return { kind: /both|two/i.test(input) ? 'connect' : 'explain', reference: input, words: '' };
  return { kind: 'explain', reference: '', words: input };
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
  if (/^(?:that|the)\s+last\s+sentence[.!?\s]*$/i.test(input)) {
    return anchors.filter(anchor => focus.has(anchor.id)).map(anchor => {
      const sentences = [...anchor.text.matchAll(/[^.!?]+(?:[.!?]+|$)/g)].filter(match => match[0].trim());
      const last = sentences.at(-1);
      if (!last) return { anchor, score: .95 };
      const leading = last[0].match(/^\s*/)?.[0].length ?? 0;
      const text = last[0].trim(), start = anchor.start + last.index! + leading;
      return { anchor: { ...anchor, id: `${anchor.cardNumber}/${anchor.sectionId}/${start}-${start + text.length}`, text, start, end: start + text.length }, score: .95 };
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
