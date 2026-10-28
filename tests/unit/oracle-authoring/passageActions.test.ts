import 'fake-indexeddb/auto';
import {beforeAll,describe,it,expect,vi} from 'vitest';
import {passagesFromText} from '../../../lib/oracle/authoring/passageContext';
import {WorkingCardStore,sectionHumanPercent} from '../../../lib/oracle/authoring/humanDrafts';
import {applyPassageReplacement,applyPassageAddition,undoPassageReplacement,plainSection,savePassageConnection,passageConnections} from '../../../src/mobile/authoring/passageActions';
import type {SourceSnapshot} from '../../../lib/oracle/authoring/types';
const storage=new Map<string,string>();
beforeAll(()=>{vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});vi.stubGlobal('window',new EventTarget());});
const source=(cardNumber:number):SourceSnapshot=>{const markdown='First published paragraph.\n\nSecond published paragraph.\n\nThird published paragraph.';return {cardNumber,markdown,hash:'source-hash',revision:'source-revision',sections:[{id:'CODE',title:'Code',start:0,end:markdown.length}]};};
const services=(s:SourceSnapshot)=>({loadSource:async()=>s});
const anchors=(s:SourceSnapshot)=>passagesFromText(s.cardNumber,'CODE',plainSection(s,'CODE'),0,s.hash);
describe('passage application boundaries',()=>{
 it('replaces only the selected passage, preserves exact neighbours and attributes only new words to the human',async()=>{
 const s=source(50),a=anchors(s)[1];await applyPassageReplacement([a],'My own new sentence.',services(s));const saved=(await new WorkingCardStore().get(50,'CODE'))!;
 expect(saved.text).toBe('First published paragraph.\n\nMy own new sentence.\n\nThird published paragraph.');expect(sectionHumanPercent(saved)).toBeGreaterThan(0);expect(sectionHumanPercent(saved)).toBeLessThan(100);expect(saved.blocks.filter(b=>b.origin==='human').map(b=>b.text)).toEqual(['My own new sentence.']);expect(s.markdown).toContain('Second published paragraph.');
 await undoPassageReplacement();expect((await new WorkingCardStore().get(50,'CODE'))?.text).toBe(s.markdown);
 });
 it('rejects stale selection and makes evidence replay idempotent',async()=>{
 const s=source(51),a=anchors(s)[0],e={sessionId:'session',captureId:'audio',transcriptId:'transcript'};await applyPassageReplacement([a],'Literal first replacement.',services(s),e);await applyPassageReplacement([a],'Literal first replacement.',services(s),e);expect((await new WorkingCardStore().get(51,'CODE'))?.revision).toBe(1);await expect(applyPassageReplacement([a],'A stale overwriting attempt.',services(s))).rejects.toThrow(/New words/);
 });
 it('adds after a passage without changing its words or duplicating the recording',async()=>{
 const s=source(52),a=anchors(s)[0];await applyPassageAddition(a,'An added human thought.',services(s),{sessionId:'session',captureId:'audio',transcriptId:'addition'});const saved=(await new WorkingCardStore().get(52,'CODE'))!;expect(saved.text).toBe('First published paragraph.\n\nAn added human thought.\n\nSecond published paragraph.\n\nThird published paragraph.');
 });
 it('does not replace disjoint paragraphs or duplicate prose for connections',async()=>{
 const s=source(53),aa=anchors(s);await expect(applyPassageReplacement([aa[0],aa[2]],'Combined.',services(s))).rejects.toThrow(/adjacent/);savePassageConnection([aa[0],aa[2]],'The same concept.');savePassageConnection([aa[0],aa[2]],'The same concept.');expect(passageConnections()).toHaveLength(1);expect(await new WorkingCardStore().get(53,'CODE')).toBeUndefined();
 });
 it('undo refuses to overwrite subsequent writing',async()=>{
 const s=source(54),a=anchors(s)[0];await applyPassageReplacement([a],'My first thought.',services(s));const store=new WorkingCardStore(),saved=(await store.get(54,'CODE'))!;await store.save(saved,saved.revision);await expect(undoPassageReplacement()).rejects.toThrow(/newer edits/);
 });
});
