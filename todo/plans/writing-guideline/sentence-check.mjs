// Mechanical sentence check for the split pass (2026-09-18).
// Usage: node todo/plans/writing-guideline/sentence-check.mjs <file-or-paragraph.txt> [--deck]
// Flags, per sentence: over 25 words; 3+ commas/semicolons/colons; passive with no actor
// ("was/were/is/are + -ed" and no "by"); fragment under 5 words; em dash; underscore or
// asterisk italics; a content word twice; a general truth in the past simple
// ("everything/nothing/every/always/never" with a past-tense verb and no time word).
// Exit 1 on any flag so a run can gate on it.
import fs from 'fs';
const STOP = new Set('a an the and or but so of to in on at for with from by as is are was were be been being it its this that these those you your yours i we they them their he she his her him not no nor if then than when where which who whom what how do does did done have has had will would can could may might shall should must into onto out up down over under again once here there all any each few more most other some such only own same too very just about above after before between through during without within along across behind beyond off per until while one two three'.split(' '));
const PAST = /\b(came|grew|was|were|had|did|went|made|took|gave|found|stood|held|ran|fell|left|kept|rose|lost|became|began|brought|thought|knew|got|said|told|felt|meant|put|set|let|showed|turned|lived|died|moved|passed|ended|started|opened|closed)\b/;
const TIME = /\b(once|when|then|ago|last|that day|one day|the day|the year|the week|after|before|until|since|in the end|at first|first|for years|for a long time|at seven|at birth)\b/;
export function checkSentence(s) {
  const flags = [];
  const words = s.trim().split(/\s+/);
  const w = words.length;
  if (w > 25) flags.push(`${w} words`);
  const punct = (s.match(/[,;:]/g) || []).length;
  if (punct >= 3) flags.push(`${punct} clause marks`);
  if (w < 5 && !/^(so|then|yes|no)\b/i.test(s)) flags.push('fragment');
  if (/—|–/.test(s)) flags.push('em dash');
  if (/(^|\s)_[^_]+_(\s|[.,;:]|$)|\*[^*]+\*/.test(s)) flags.push('italics');
  if (/\b(was|were|is|are|be|been)\s+(\w+ed|\w+en|built|kept|held|made|put|set|left|lost|felt|hurried|rushed)\b/.test(s) && !/\bby\b/.test(s)) flags.push('passive? (advisory)');
  const content = words.map(x => x.toLowerCase().replace(/[^a-z']/g, '')).filter(x => x && !STOP.has(x) && x.length > 3);
  const seen = new Set(); for (const c of content) { if (seen.has(c)) { flags.push(`"${c}" twice`); break; } seen.add(c); }
  if (/\b(everything|nothing|every|always|never|anyone|no one|nobody)\b/i.test(s) && PAST.test(s) && !TIME.test(s)) flags.push('general truth in past tense');
  return flags;
}
export function checkText(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || /^[#_\-*]/.test(line) || /^\*\*Line/.test(line)) continue;
    for (const s of line.split(/(?<=[.!?])\s+(?=[A-Z"])/)) { const f = checkSentence(s); if (f.length) out.push({ s, f }); }
  }
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('sentence-check.mjs')) {
  const arg = process.argv[2];
  if (process.argv.includes('--deck')) {
    let total = 0, bad = 0;
    for (let i = 1; i <= 64; i++) {
      const t = fs.readFileSync(`oracle/cards/${String(i).padStart(2, '0')}.md`, 'utf8');
      const body = t.slice(t.indexOf('\n## CODE')).split('\n## RELATIONS')[0].replace(/\nmeta:[\s\S]*$/, '');
      const r = checkText(body).filter(x => x.f.some(f => !f.includes("advisory"))); bad += r.length;
      total += body.split('\n').filter(l => l.trim() && !/^[#_\-*]/.test(l)).join(' ').split(/(?<=[.!?])\s+/).length;
    }
    console.log(`${bad} flagged of ${total} sentences`); process.exit(bad ? 1 : 0);
  }
  const r = checkText(fs.readFileSync(arg, 'utf8'));
  for (const { s, f } of r) console.log(`[${f.join('; ')}] ${s}`);
  const gating = r.filter(x => x.f.some(f => !f.includes('advisory'))).length; console.log(r.length ? `${gating} gating, ${r.length - gating} advisory` : 'clean'); process.exit(gating ? 1 : 0);
}
