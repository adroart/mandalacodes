import 'fake-indexeddb/auto';
import { beforeEach, vi, describe, expect, it } from 'vitest';
import { passagesFromText,type PassageAnchor } from '../../../lib/oracle/authoring/passageContext';
import { decideSpokenPassage, passageSpeechNeedsCheck } from '../../../src/mobile/authoring/spokenPassageContext';

const anchors = passagesFromText(2, 'CODE', 'A quiet field receives the whole movement. The roots hold firm.\n\nThe open hand makes room for the unexpected.\n\nA quiet field receives the whole movement.');
describe('spoken passage context', () => {
 it('leaves ordinary literal words on the existing automatic path', () => {
  const decision = decideSpokenPassage('I feel a patient movement toward the open air.', anchors);
  expect(decision.contextual).toBe(false);
  expect(decision.words).toBe('I feel a patient movement toward the open air.');
 });
 it('appends ordinary speech after the one focused passage', () => {
  const result=decideSpokenPassage('A new thought in my own words.',anchors,[anchors[0]]);
  expect(result.contextual).toBe(true);expect(result.kind).toBe('append');expect(result.targets).toEqual([anchors[0]]);
 });
 it('asks where ordinary speech belongs when several passages are selected', () => {
  const result=decideSpokenPassage('A new thought in my own words.',anchors,anchors.slice(0,2));
  expect(result.targets).toHaveLength(0);expect(result.candidates).toHaveLength(2);
 });
 it('keeps duplicate quoted references ambiguous instead of choosing a whole section', () => {
  const result = decideSpokenPassage('Where you said “quiet field”, replace it with My own quiet words.', anchors);
  expect(result.kind).toBe('replace');
  expect(result.words).toBe('My own quiet words.');
  expect(result.targets).toHaveLength(0);
  expect(result.candidates).toHaveLength(2);
 });
 it('treats a selected sentence and its surrounding paragraph as one location',()=>{
  const paragraph=anchors[1],text='open hand makes room',start=paragraph.start+paragraph.text.indexOf(text);
  const selected={...paragraph,id:'selected-sentence',text,start,end:start+text.length};
  const result=decideSpokenPassage('Where you said “open hand makes room”, replace it with My human thought.',[selected,...anchors],[selected]);
  expect(result.targets).toEqual([selected]);
 });
 it('connects a distinct printed-book quote to the correct paragraph', () => {
  const result = decideSpokenPassage('Where you said “open hand makes room”, replace it with My human thought.', anchors);
  expect(result.targets.map(a => a.id)).toEqual([anchors[1].id]);
 });
 it('uses captured reading context for a direct passage reference', () => {
  const result = decideSpokenPassage('Replace this passage with My human replacement.', anchors, [anchors[1]]);
  expect(result.targets.map(a => a.id)).toEqual([anchors[1].id]);
 });
 it('targets only the last sentence, not its entire paragraph', () => {
  const result = decideSpokenPassage('Replace that last sentence with A living root.', anchors, [anchors[0]]);
  expect(result.targets).toHaveLength(1);
  expect(result.targets[0].text).toBe('The roots hold firm.');
 });
 it('does not infer which of several focused paragraphs a singular reference means', () => {
  const result = decideSpokenPassage('Replace this passage with A new thought.', anchors, anchors.slice(0, 2));
  expect(result.targets).toHaveLength(0);
  expect(result.candidates).toHaveLength(2);
 });
 it('honours the explicitly selected ambiguity candidate', () => {
  const result = decideSpokenPassage('Where you said “quiet field”, replace it with My exact words.', anchors, [], [anchors[2].id]);
  expect(result.targets).toEqual([anchors[2]]);
 });
 it('keeps an explicit two-passage connection as references without duplicate prose', () => {
  const result = decideSpokenPassage('These two passages belong together.', anchors, anchors.slice(0, 2));
  expect(result.kind).toBe('connect');expect(result.words).toBe('');expect(result.targets).toHaveLength(2);
 });
 it('recognizes extracted explanations as contextual additions', () => {
  const result = decideSpokenPassage('Here is what I mean by “open hand”: Leave a little room.', anchors);
  expect(result.contextual).toBe(true);expect(result.words).toBe('Leave a little room.');expect(result.targets[0].id).toBe(anchors[1].id);
 });
 it('requests a check for a possible mishearing until exact words were reviewed', () => {
  expect(passageSpeechNeedsCheck('A chain is moving.', false)).toBe(true);
  expect(passageSpeechNeedsCheck('A clear root.', false, [.2])).toBe(true);
  expect(passageSpeechNeedsCheck('A clear root.', true, [.2])).toBe(false);
 });
});


import { AuthoringStore } from '../../../lib/oracle/authoring/storage';
import { WorkingCardStore } from '../../../lib/oracle/authoring/humanDrafts';
import { createSession, sourceSnapshot } from '../../../lib/oracle/authoring/workflow';
import { humanJobs, queueHumanCapture } from '../../../src/mobile/authoring/humanCaptureJobs';

describe('passage-aware capture jobs',()=>{
 const audio=new AuthoringStore(),cards=new WorkingCardStore();
 beforeEach(async()=>{
  const values=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
  vi.stubGlobal('window',new EventTarget());
  for(const name of ['oracle-authoring-v1','oracle-working-cards-v1'])await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
 });
 async function setup(texts:string[]){
  const text='The quiet field receives.\n\nThe roots hold firm.';
  const source=await sourceSnapshot(2,'original',text,[{id:'CODE',title:'Code',start:0,end:text.length}]);
  const session=createSession(source);session.captures.push({id:'clip',recordedAt:session.createdAt,mimeType:'audio/wav',durationMs:1000,status:'ready',origin:'import'});
  await audio.save(session,0);await audio.appendChunk(session.id,'clip',0,new Blob(['original audio']),1000);
  const transcribe=vi.fn(async()=>({provider:'fixture',segments:texts.map((text,i)=>({text,startMs:i*100,endMs:(i+1)*100,timing:'provider' as const,sectionId:'CODE'}))}));
  const services={loadSource:async()=>source,transcribe};
  return {source,session,services,anchor:passagesFromText(2,'CODE',text,undefined,source.hash)[0]};
 }
 it('holds a replacement for review and changes only the linked paragraph',async()=>{
  const {session,services,anchor}=await setup(['Replace this passage with My own field.']);
  queueHumanCapture(session.id,'clip',services,{anchors:[anchor]});
  await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('attention'));
  expect(await cards.get(2,'CODE')).toBeUndefined();
  const t=(await audio.load(session.id))!.session.transcript[0];
  queueHumanCapture(session.id,'clip',services,{reviewed:{[t.id]:t.corrected}});
  await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('ready'));
  expect((await cards.get(2,'CODE'))!.text).toBe('My own field.\n\nThe roots hold firm.');
  expect(services.transcribe).toHaveBeenCalledTimes(1);
 });
 it('appends successive literal thoughts in order beside the focused passage',async()=>{
  const {session,services,anchor}=await setup(['My first human thought.','My second human thought.']);
  queueHumanCapture(session.id,'clip',services,{anchors:[anchor]});
  await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('ready'));
  expect((await cards.get(2,'CODE'))!.text).toBe('The quiet field receives.\n\nMy first human thought.\n\nMy second human thought.\n\nThe roots hold firm.');
 });
});

describe('compound instruction review',()=>{
 it('holds unsupported compound edits even if a focused target is known',()=>{
  const anchor:PassageAnchor={id:'focus',cardNumber:2,sectionId:'CODE',text:'The opening. The rest.',sectionText:'The opening. The rest.',start:0,end:22};
  const decision=decideSpokenPassage('Keep the opening of the first. Replace the explanation with this: My own words.',[anchor],[anchor]);
  expect(decision.needsReview).toBeTruthy();expect(decision.targets).toEqual([]);
 });
});
