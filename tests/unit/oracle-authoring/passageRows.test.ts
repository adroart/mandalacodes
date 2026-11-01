import {describe,expect,it} from 'vitest';
import {applyComparisonEdits,buildPassageComparison,comparisonEdits,comparisonRows,focusedComparison,normalizePassageComparison,readingParagraphs} from '../../../lib/oracle/authoring/passageComparison';
const original='First written paragraph.\n\nSecond written paragraph.\n\nThird written paragraph.';
const spoken='My second thought.';
const partial=normalizePassageComparison(original,spoken,[{original:'First written paragraph.',spoken:''},{original:'Second written paragraph.',spoken},{original:'Third written paragraph.',spoken:''}])!;
const result=(choices={})=>{const rows=comparisonRows(buildPassageComparison(original,spoken,partial),choices);const edits=comparisonEdits(original,rows);return {rows,edits,text:applyComparisonEdits(original,edits)};};

describe('passage rows',()=>{
 it('replaces only the passage that was spoken about and keeps the rest exactly',()=>{
  const {rows,edits,text}=result();
  expect(rows.map(r=>[r.kind,r.choice])).toEqual([['unspoken','original'],['replaced','mine'],['unspoken','original']]);
  expect(edits).toEqual([{start:26,end:51,words:spoken}]);
  expect(text).toBe('First written paragraph.\n\nMy second thought.\n\nThird written paragraph.');
 });
 it('removes an unspoken passage only when asked, without leaving a double gap',()=>{
  expect(result({'0-24':'mine'}).text).toBe('My second thought.\n\nThird written paragraph.');
  expect(result({'53-77':'mine'}).text).toBe('First written paragraph.\n\nMy second thought.');
  expect(result({'0-24':'mine','53-77':'mine'}).text).toBe('My second thought.');
 });
 it('keeping the original instead changes nothing',()=>{
  const {edits,text}=result({'26-51':'original'});expect(edits).toEqual([]);expect(text).toBe(original);
 });
 it('inserts a new spoken passage between kept passages with its own paragraph break',()=>{
  const said='A new thought.';const comparison=normalizePassageComparison(original,said,[{original:'First written paragraph.',spoken:''},{original:'',spoken:said},{original:'Second written paragraph.\n\nThird written paragraph.',spoken:''}])!;
  const rows=comparisonRows(buildPassageComparison(original,said,comparison));expect(rows.map(r=>r.kind)).toEqual(['unspoken','new','unspoken']);
  expect(applyComparisonEdits(original,comparisonEdits(original,rows))).toBe('First written paragraph.\n\nA new thought.\n\nSecond written paragraph.\n\nThird written paragraph.');
 });
 it('a whole-section comparison replaces the whole section',()=>{
  const rows=comparisonRows(buildPassageComparison(original,spoken));expect(rows).toHaveLength(1);expect(applyComparisonEdits(original,comparisonEdits(original,rows))).toBe(spoken);
 });
});

describe('aiming at one paragraph',()=>{
 it('finds paragraphs with exact offsets',()=>{
  expect(readingParagraphs(original).map(p=>[p.start,p.end,p.text])).toEqual([[0,24,'First written paragraph.'],[26,51,'Second written paragraph.'],[53,77,'Third written paragraph.']]);
  expect(readingParagraphs('One line\ncontinues.\n\nNext.')).toEqual([{start:0,end:19,text:'One line\ncontinues.'},{start:21,end:26,text:'Next.'}]);
 });
 it('gives all spoken words to the aimed paragraph and keeps its neighbours',()=>{
  const said='Everything I said is about the middle one.';const comparison=focusedComparison(original,said,{start:26,end:51,text:'Second written paragraph.'})!;
  const rows=comparisonRows(buildPassageComparison(original,said,comparison));expect(rows.map(r=>[r.kind,r.text])).toEqual([['unspoken',''],['replaced',said],['unspoken','']]);
  expect(applyComparisonEdits(original,comparisonEdits(original,rows))).toBe(`First written paragraph.\n\n${said}\n\nThird written paragraph.`);
 });
 it('works for the first and last paragraph and refuses a stale aim',()=>{
  expect(focusedComparison(original,'Opening.',{start:0,end:24,text:'First written paragraph.'})!.pairs).toHaveLength(2);
  expect(focusedComparison(original,'Closing.',{start:53,end:77,text:'Third written paragraph.'})!.pairs).toHaveLength(2);
  expect(focusedComparison(original,'Words.',{start:26,end:51,text:'Something that changed.'})).toBeUndefined();
 });
});
