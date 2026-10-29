import {describe,expect,it} from 'vitest';
import {buildWordReplay,activeReplayWord,type ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
import type {Transcript,AlignedWord} from '../../../lib/oracle/authoring/types';
function speech(raw:string,words?:string[]|AlignedWord[],captureId='capture-a'):Transcript{
 return {id:`${captureId}/transcript`,captureId,raw,corrected:raw,startMs:0,endMs:10000,sectionId:'CODE',assignment:'hint',timing:'provider',provider:'fixture',receivedAt:'2026-10-29T00:00:00Z',...(words?{words:words.map((word,index)=>typeof word==='string'?{text:word,startMs:index*100,endMs:index*100+90}:word)}:{})};
}
const mapped=(words:ReplayWord[])=>words.filter(word=>word.captureId!==undefined);
describe('recording word replay',()=>{
 it('retains exact displayed spaces, punctuation and paragraph breaks with real word intervals',()=>{
  const text='  Receive,\nthen listen.  ';const words=buildWordReplay(text,[speech('Receive, then listen.',['Receive,','then','listen.'])]);
  expect(words.map(w=>w.text).join('')).toBe(text);expect(words.every(w=>text.slice(w.from,w.to)===w.text)).toBe(true);
  expect(mapped(words).map(({text,startMs,endMs})=>({text,startMs,endMs}))).toEqual([{text:'Receive',startMs:0,endMs:90},{text:'then',startMs:100,endMs:190},{text:'listen',startMs:200,endMs:290}]);
 });
 it('uses end-exclusive intervals and removes highlighting during silence and after the recording',()=>{
  const words=buildWordReplay('Receive then.',[speech('Receive then.',['Receive','then'])]);const first=words.findIndex(w=>w.text==='Receive'),second=words.findIndex(w=>w.text==='then');
  expect(activeReplayWord(words,'capture-a',0)).toBe(first);expect(activeReplayWord(words,'capture-a',89)).toBe(first);expect(activeReplayWord(words,'capture-a',90)).toBe(-1);expect(activeReplayWord(words,'capture-a',100)).toBe(second);expect(activeReplayWord(words,'capture-a',190)).toBe(-1);expect(activeReplayWord(words,'capture-b',120)).toBe(-1);expect(activeReplayWord(words,'capture-a',NaN)).toBe(-1);
 });
 it('leaves an ambiguous removed stutter untimed while aligning the following words',()=>{
  const words=buildWordReplay('I receive direction.',[speech('I I receive direction.',['I','I','receive','direction'])]);
  expect(words.find(w=>w.text==='I')?.captureId).toBeUndefined();expect(mapped(words).map(w=>[w.text,w.startMs])).toEqual([['receive',200],['direction',300]]);
 });
 it('does not assign one recorded word to an inserted repetition',()=>{
  const words=buildWordReplay('I I receive direction.',[speech('I receive direction.',['I','receive','direction'])]);
  expect(words.filter(w=>w.text==='I').every(w=>w.captureId===undefined)).toBe(true);expect(mapped(words).map(w=>w.text)).toEqual(['receive','direction']);
 });
 it('bounds an explicit restart to its unique evidence instead of highlighting an abandoned take',()=>{
  const source=speech('I receive direction. No, I receive direction.',['I','receive','direction','No','I','receive','direction']);
  expect(mapped(buildWordReplay('I receive direction.',[source]))).toEqual([]);
  expect(mapped(buildWordReplay('I receive direction.',[source],['No, I receive direction.'])).map(w=>[w.text,w.startMs])).toEqual([['I',400],['receive',500],['direction',600]]);
  expect(mapped(buildWordReplay('I receive direction.',[source],['I receive direction.']))).toEqual([]);
 });
 it('keeps new or corrected wording readable without fabricating its timing',()=>{
  const words=buildWordReplay('The road receives you.',[speech('The field receives you.',['The','field','receives','you'])]);
  expect(words.map(w=>w.text).join('')).toBe('The road receives you.');expect(words.find(w=>w.text==='road')?.startMs).toBeUndefined();expect(mapped(words).map(w=>w.text)).toEqual(['The','receives','you']);
 });
 it('supports actual timestamps in multiple saved captures',()=>{
  const a=speech('Receive the field.',['Receive','the','field'],'first'),b=speech('Listen to the voice.',['Listen','to','the','voice'],'second');const words=buildWordReplay('Receive the field.\n\nListen to the voice.',[a,b],['Receive the field.','Listen to the voice.']);
  expect(mapped(words).map(w=>w.captureId)).toEqual(['first','first','first','second','second','second','second']);expect(words[activeReplayWord(words,'second',120)].text).toBe('to');
 });
 it('normalizes casing, Unicode composition and typographic apostrophes without semantic substitutions',()=>{
  const words=buildWordReplay("Café: I'm here.",[speech('Cafe\u0301. I’m here!',['Cafe\u0301','I’m','here'])]);expect(mapped(words).map(w=>w.text)).toEqual(['Café',"I'm",'here']);
 });
 it('never interpolates missing, zero-width, invalid or grouped provider word times',()=>{
  expect(mapped(buildWordReplay('No timing here.',[speech('No timing here.')]))).toEqual([]);
  const words=buildWordReplay('A quiet field grows.',[speech('A quiet field grows.',[{text:'A',startMs:0,endMs:0},{text:'quiet field',startMs:10,endMs:200},{text:'grows',startMs:200,endMs:290}])]);expect(mapped(words).map(w=>w.text)).toEqual(['grows']);
  expect(mapped(buildWordReplay('A word.',[speech('A word.',[{text:'A',startMs:-10,endMs:10},{text:'word',startMs:80,endMs:40}])]))).toEqual([]);
 });
 it('does not highlight when explicit evidence does not match the immutable transcript',()=>{
  expect(mapped(buildWordReplay('I receive direction.',[speech('I receive direction.',['I','receive','direction'])],['An unrelated quote.']))).toEqual([]);
 });
 it('ignores reference-only transcripts and bounds large alignment work',()=>{
  const source=speech('Read this.',['Read','this']);source.referenceOnly=true;expect(mapped(buildWordReplay('Read this.',[source]))).toEqual([]);
  const tokens=Array.from({length:1100},(_,i)=>`word${i}`),text=tokens.join(' '),words=buildWordReplay(text,[speech(text,tokens)]);expect(words.map(w=>w.text).join('')).toBe(text);expect(mapped(words)).toEqual([]);
 });
 it('does not claim two words sharing an identical interval are uniquely spoken',()=>{
  expect(activeReplayWord([{text:'first',from:0,to:5,captureId:'a',startMs:0,endMs:100},{text:'second',from:6,to:12,captureId:'a',startMs:0,endMs:100}],'a',50)).toBe(-1);
 });
});
