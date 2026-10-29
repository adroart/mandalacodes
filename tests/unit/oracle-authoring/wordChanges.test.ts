import { describe, expect, it } from 'vitest';
import { diffWords } from '../../../components/oracle/authoring/WordChanges';

function reconstruct(original:string,revised:string){
 const changes=diffWords(original,revised);
 expect(changes.filter(c=>c.kind!=='added').map(c=>c.text).join('')).toBe(original);
 expect(changes.filter(c=>c.kind!=='removed').map(c=>c.text).join('')).toBe(revised);
 expect(changes.every(c=>c.text.length>0)).toBe(true);
 expect(changes.every((c,i)=>i===0||c.kind!==changes[i-1].kind)).toBe(true);
 return changes;
}
describe('literal passage word comparison',()=>{
 it('isolates changed words while preserving the untouched wording',()=>{
  const changes=reconstruct('The quiet field receives the voice.','The open field receives the voice.');
  expect(changes.filter(c=>c.kind==='removed').map(c=>c.text).join('')).toBe('quiet');
  expect(changes.filter(c=>c.kind==='added').map(c=>c.text).join('')).toBe('open');
  expect(changes.filter(c=>c.kind==='same').map(c=>c.text).join('')).toBe('The  field receives the voice.');
 });
 it('preserves exact spaces, tabs, CRLF and paragraph breaks',()=>{
  reconstruct('  A quiet\tfield.\r\n\r\nThe voice returns.  ',' A quiet field.\n\nMy voice returns.\t');
 });
 it('keeps punctuation edits distinct from unchanged words',()=>{
  const changes=reconstruct('Receive, then listen.','Receive; then listen!');
  expect(changes.filter(c=>c.kind==='removed').map(c=>c.text).join('')).toBe(',.');
  expect(changes.filter(c=>c.kind==='added').map(c=>c.text).join('')).toBe(';!');
 });
 it('retains repeated words and Unicode without inventing a match',()=>{
  reconstruct('The field, the field, the field.','The field, my field.');
  reconstruct('Écoute: 地山謙 🌱. It’s here.','Écoute: 地水師 🌿. It’s still here.');
  reconstruct('cafe\u0301','café');
 });
 it('handles empty, added, removed and identical text explicitly',()=>{
  expect(reconstruct('','')).toEqual([]);
  expect(reconstruct('','My words.')).toEqual([{kind:'added',text:'My words.'}]);
  expect(reconstruct('Old words.','')).toEqual([{kind:'removed',text:'Old words.'}]);
  expect(reconstruct('No changes.','No changes.')).toEqual([{kind:'same',text:'No changes.'}]);
 });
 it('bounds large unrelated replacements while retaining shared ends exactly',()=>{
  const original='Shared beginning. '+Array.from({length:1200},(_,i)=>`old${i}`).join(' ')+' Shared ending.';
  const revised='Shared beginning. '+Array.from({length:1200},(_,i)=>`new${i}`).join(' ')+' Shared ending.';
  const changes=reconstruct(original,revised);
  expect(changes).toHaveLength(4);
  expect(changes[0]).toEqual({kind:'same',text:'Shared beginning. '});
  expect(changes.at(-1)).toEqual({kind:'same',text:' Shared ending.'});
 });
});
