import {describe,expect,it} from 'vitest';
import {buildPassageComparison,normalizePassageComparison,replaceComparisonPassage,type PassageComparison} from '../../../lib/oracle/authoring/passageComparison';
const original='First original paragraph.\n\nSecond original paragraph.';
const spoken='My first thought.\n\nMy second thought.';
const quotes=[{original:'First original paragraph.',spoken:'My first thought.'},{original:'Second original paragraph.',spoken:'My second thought.'}];
describe('evidence-bound passage comparison',()=>{
 it('uses explicit complete links, never infers matching paragraphs from count',()=>{
  const comparison=normalizePassageComparison(original,spoken,quotes)!;
  expect(buildPassageComparison(original,spoken,comparison)).toEqual({kind:'matched',pairs:[{originalStart:0,originalEnd:25,textStart:0,textEnd:17,original:quotes[0].original,text:quotes[0].spoken},{originalStart:27,originalEnd:53,textStart:19,textEnd:37,original:quotes[1].original,text:quotes[1].spoken}]});
  expect(buildPassageComparison(original,spoken).kind).toBe('whole-section');
 });
 it('rejects invented, partial, overlapping, reordered and ambiguous repeated quote links',()=>{
  const invalid=[[],[{...quotes[0],original:'Invented original.'},quotes[1]],[quotes[0]],[quotes[1],quotes[0]],[quotes[0],quotes[0],quotes[1]],[{...quotes[0],spoken:'My made up thought.'},quotes[1]]];
  for(const value of invalid)expect(normalizePassageComparison(original,spoken,value)).toBeUndefined();
  expect(normalizePassageComparison('Same. Same.','One. Two.',[{original:'Same.',spoken:'One.'},{original:'Same.',spoken:'Two.'}])).toBeUndefined();
 });
 it('falls back to the full section when either exact baseline changes',()=>{
  const comparison=normalizePassageComparison(original,spoken,quotes)!;
  for(const [before,after]of [[original+' More.',spoken],[original,spoken+' More.']]){
   const view=buildPassageComparison(before,after,comparison);expect(view.kind).toBe('whole-section');expect(view.pairs).toHaveLength(1);expect(view.pairs[0].original).toBe(before);expect(view.pairs[0].text).toBe(after);
  }
 });
 it('rejects tampered ranges instead of clipping, skipping, or hiding words',()=>{
  const comparison=normalizePassageComparison(original,spoken,quotes)!;
  for(const pairs of [[{...comparison.pairs[0],textStart:-1},comparison.pairs[1]],[{...comparison.pairs[0],textEnd:4},comparison.pairs[1]],[...comparison.pairs].reverse(),[{...comparison.pairs[0],originalEnd:999},comparison.pairs[1]]])expect(buildPassageComparison(original,spoken,{...comparison,pairs}).kind).toBe('whole-section');
 });
 it('edits just one linked passage and shifts the remaining exact ranges',()=>{
  const comparison=normalizePassageComparison(original,spoken,quotes)!;
  const edited=replaceComparisonPassage(original,spoken,comparison,0,'A longer first thought, in my words.');
  expect(edited.text).toBe('A longer first thought, in my words.\n\nMy second thought.');
  const view=buildPassageComparison(original,edited.text,edited.comparison);expect(view.kind).toBe('matched');expect(view.pairs[1].text).toBe('My second thought.');expect(view.pairs[1].original).toBe('Second original paragraph.');
  const last=replaceComparisonPassage(original,edited.text,edited.comparison,1,'A revised second thought.');expect(last.text).toBe('A longer first thought, in my words.\n\nA revised second thought.');expect(buildPassageComparison(original,last.text,last.comparison).kind).toBe('matched');
 });
 it('keeps unmapped edits as a whole-section replacement and rejects stale passage indexes',()=>{
  const edited=replaceComparisonPassage(original,spoken,undefined,0,'A whole new section.');expect(edited).toEqual({text:'A whole new section.'});
  expect(()=>replaceComparisonPassage(original,spoken,undefined,1,'X')).toThrow('changed');
 });
 it('represents original omissions and new spoken additions without pretending they match',()=>{
  const comparison=normalizePassageComparison('Old one.\n\nOld two.','New one.\n\nAn addition.',[{original:'Old one.',spoken:'New one.'},{original:'Old two.',spoken:''},{original:'',spoken:'An addition.'}])!;
  const view=buildPassageComparison('Old one.\n\nOld two.','New one.\n\nAn addition.',comparison);expect(view.kind).toBe('matched');expect(view.pairs[1].text).toBe('');expect(view.pairs[2].original).toBe('');
 });
 it('does not accept malformed snapshot shapes',()=>{
  for(const bad of [null,{}, {originalText:original,spokenText:spoken,pairs:[null]}, {originalText:original,spokenText:spoken,pairs:[{originalStart:0,originalEnd:0,textStart:0,textEnd:0}]}])expect(buildPassageComparison(original,spoken,bad as PassageComparison).kind).toBe('whole-section');
 });
});
