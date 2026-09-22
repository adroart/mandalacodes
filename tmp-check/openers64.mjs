import fs from 'fs';
import { proseOf } from '../todo/plans/writing-guideline/sentence-check.mjs';
const normal = (s) => ' ' + s.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const openers = {};
for (let i = 1; i <= 64; i++) {
  const t = fs.readFileSync(`oracle/cards/${String(i).padStart(2,'0')}.md`,'utf8');
  for (const p of proseOf(t)) { const o = normal(p).trim().split(' ').slice(0,3).join(' '); (openers[o] ||= new Set()).add(i); }
}
const t = fs.readFileSync(process.argv[2] || 'oracle/cards/64.md','utf8');
for (const p of proseOf(t)) {
  const o = normal(p).trim().split(' ').slice(0,3).join(' ');
  const n = (openers[o]||new Set()).size;
  if (n > 3) console.log(`${n} cards  "${o}"  <-- ${p.slice(0,70)}`);
}
