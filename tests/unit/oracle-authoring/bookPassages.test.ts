import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {findBookPassages} from '../../../src/mobile/authoring/bookPassages';
import {WorkingCardStore,createWorkingText} from '../../../lib/oracle/authoring/humanDrafts';
import type {SourceSnapshot} from '../../../lib/oracle/authoring/types';
const loadSource=async(cardNumber:number):Promise<SourceSnapshot>=>{const markdown=cardNumber===61?'The lantern crosses the winter river.\n\nThe returning voice keeps its own measure.':`Published words for card ${cardNumber}.`;return {cardNumber,markdown,revision:'base',hash:`hash-${cardNumber}`,sections:[{id:'CODE',title:'Code',start:0,end:markdown.length}]};};
describe('printed-book corpus search',()=>{
 it('finds a distinctive phrase beyond the currently open card without changing any writing',async()=>{const results=await findBookPassages('lantern crosses the winter river',2,loadSource);expect(results[0].anchor.cardNumber).toBe(61);expect(results[0].anchor.text).toBe('The lantern crosses the winter river.');expect(await new WorkingCardStore().get(61,'CODE')).toBeUndefined();});
 it('includes current private wording and its revision rather than stale manuscript words',async()=>{const source=await loadSource(60);await new WorkingCardStore().save(createWorkingText(source,'CODE','My turquoise compass is a human thought.'),0);const results=await findBookPassages('turquoise compass',2,loadSource);expect(results[0].anchor.cardNumber).toBe(60);expect(results[0].anchor.revision).toBe(1);});
 it('does not launch corpus reads for an empty phrase',async()=>{let reads=0;expect(await findBookPassages(' ',2,async n=>{reads++;return loadSource(n);})).toEqual([]);expect(reads).toBe(0);});
});
