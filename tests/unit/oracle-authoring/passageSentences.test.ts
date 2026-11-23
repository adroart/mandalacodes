import {describe,expect,it} from 'vitest';
import {buildPassageComparison,comparisonRows} from '../../../lib/oracle/authoring/passageComparison';
import {chosenPassageText,defaultSentenceChoices,sentenceComparison,sentences,withChosenPassageText} from '../../../lib/oracle/authoring/passageSentences';
import {rebasePassageEdit,spansOverlap} from '../../../lib/oracle/authoring/passageSpans';

const original='The gift is quiet. It grows when you rest. Then it waits for you.';

describe('lining up a paragraph and the words spoken over it',()=>{
 it('splits sentences with offsets, keeping closing punctuation and a last sentence without any',()=>{
  expect(sentences('One thing. Two “things.” And three').map(s=>s.text)).toEqual(['One thing.','Two “things.”','And three']);
  const [, second]=sentences(original);expect(original.slice(second.start,second.end)).toBe('It grows when you rest.');
 });
 it('pairs reworded sentences in order and marks a spoken sentence as new',()=>{
  const spoken='The gift is calm. It opens when you stop. A new thought arrives. Then it waits for you.';
  const comparison=sentenceComparison(original,spoken)!;
  const rows=comparisonRows(buildPassageComparison(original,spoken,comparison));
  expect(rows.map(r=>[r.kind,r.original,r.text])).toEqual([
   ['replaced','The gift is quiet.','The gift is calm.'],
   ['replaced','It grows when you rest.','It opens when you stop.'],
   ['new','','A new thought arrives.'],
   ['replaced','Then it waits for you.','Then it waits for you.'],
  ]);
 });
 it('leaves out a sentence that was not spoken unless it is kept',()=>{
  const spoken='The gift is calm. Then it waits for you.';
  const comparison=sentenceComparison(original,spoken)!,choices=defaultSentenceChoices(comparison)!;
  const rows=comparisonRows(buildPassageComparison(original,spoken,comparison),choices);
  expect(rows.map(r=>r.kind)).toEqual(['replaced','unspoken','replaced']);
  expect(chosenPassageText(original,spoken,comparison,choices)).toBe('The gift is calm. Then it waits for you.');
  const keep={...choices,[rows[1].key]:'original' as const,[rows[0].key]:'original' as const};
  expect(chosenPassageText(original,spoken,comparison,keep)).toBe('The gift is quiet. It grows when you rest. Then it waits for you.');
 });
 it('needs no sentence choice for one sentence against one',()=>{
  expect(sentenceComparison('Only one.','Just this.')).toBeUndefined();
  expect(chosenPassageText('Only one.','Just this.',undefined,undefined)).toBe('Just this.');
 });
 it('applies the chosen sentences only to a passage replacement',()=>{
  const spoken='The gift is calm. It opens when you stop. Then it waits for you.',comparison=sentenceComparison(original,spoken)!;
  const rows=comparisonRows(buildPassageComparison(original,spoken,comparison));
  const result={text:spoken,comparison,rowChoices:{[rows[1].key]:'original' as const},passageEdit:{operation:'replace' as const,focus:{start:0,end:original.length,text:original}}};
  expect(withChosenPassageText(result).text).toBe('The gift is calm. It grows when you rest. Then it waits for you.');
  expect(withChosenPassageText({...result,passageEdit:{...result.passageEdit,operation:'add' as const}}).text).toBe(spoken);
 });
});

describe('passages recorded one after another',()=>{
 const text='First paragraph.\n\nIt waits for you.';
 const edit={operation:'replace' as const,focus:{start:18,end:35,text:'It waits for you.'},sectionText:text};
 it('finds clashing spans only when they share words',()=>{
  expect(spansOverlap({start:0,end:5},{start:4,end:9})).toBe(true);
  expect(spansOverlap({start:0,end:5},{start:5,end:9})).toBe(false);
 });
 it('carries a waiting edit onto the newer section, or refuses when its words are gone or doubled',()=>{
  expect(rebasePassageEdit(edit,text)).toBe(edit);
  const newer='A new opening, longer.\n\nIt waits for you.',moved=rebasePassageEdit(edit,newer)!;
  expect(newer.slice(moved.focus.start,moved.focus.end)).toBe('It waits for you.');
  expect(rebasePassageEdit(edit,'Nothing like it.')).toBeUndefined();
  expect(rebasePassageEdit(edit,'It waits for you.\n\nIt waits for you.')).toBeUndefined();
 });
});
