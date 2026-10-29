import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {QuietContinuity,remapVoiceReview,workingSyncChoices,remapWorkingEvidence,safeResume,readVoiceWorkspace,remapLinkedVoiceReviews,remapWorkspaceEvidence,validateVoiceWorkspaceAudio} from '../../../src/mobile/authoring/voiceWorkspaceSync';
const source={cardNumber:1,hash:'hash',revision:'r',markdown:'original',sections:[]};
const section={id:'1/CODE/reading',cardNumber:1,sourceHash:'hash',text:'original'};
const draft:any={id:'remote-draft',cardNumber:1,sourceHash:'hash',source,sections:[section],version:4,captureSessionId:'old-audio',captureId:'capture',rawTranscript:'exact original speech',titleEdits:{'1/CODE/reading':{text:'Edited title',updatedAt:'2026-10-29'}},takes:[{id:'take',captureId:'capture',state:'assimilating'}],results:[{sectionId:section.id,text:'spoken',appliedText:'integrated speech',applied:true,checked:true,beforeText:'old',integrationId:'receipt',warnings:[],evidenceQuotes:['exact original speech'],changes:[]}],unassigned:[],state:'complete'};
const saved:any={session:{id:'new-audio',source,captures:[{id:'capture',durationMs:5000,status:'ready'}]},version:1};
const working:any={key:'1/CODE',cardNumber:1,sectionId:'CODE',text:'remote writing',revision:4,blocks:[{text:'remote writing',origin:'human',evidence:[{sessionId:'remote-draft',captureId:'capture',transcriptId:'receipt',signature:'exact original speech'}]}]};
describe('private Voice workspace restore',()=>{
 it('makes a new unchecked review while preserving source, speech, takes and receipts',()=>{const restored:any=remapVoiceReview({schema:1,draft,working:[]},saved,{[section.id]:'current local wording'},'fresh');expect(restored.id).toBe('fresh');expect(restored.captureSessionId).toBe('new-audio');expect(restored.rawTranscript).toBe(draft.rawTranscript);expect(restored.source).toEqual(draft.source);expect(restored.titleEdits).toEqual(draft.titleEdits);expect(restored.takes[0]).toMatchObject({id:'take',captureId:'capture',state:'queued'});expect(restored.results[0]).toMatchObject({checked:false,applied:false,text:'integrated speech',comparisonOriginal:'current local wording'});expect(restored.results[0].integrationId).toBeUndefined();expect(restored.syncedAppliedReceipts[0].integrationId).toBe('receipt');expect(draft.results[0].checked).toBe(true);});
 it('identifies same-lens differences and pins the exact local CAS revision',()=>{const choices=workingSyncChoices([working],[{...working,text:'local writing',revision:9}]);expect(choices[0]).toMatchObject({different:true,expectedRevision:9});expect(choices[0].local?.text).toBe('local writing');expect(workingSyncChoices([working],[working])[0].different).toBe(false);});
 it('maps only evidence belonging to the restored draft, preserving capture and receipts',()=>{const mapped=remapWorkingEvidence(working,'remote-draft','fresh');expect(mapped.blocks[0].evidence[0]).toEqual({...working.blocks[0].evidence[0],sessionId:'fresh'});expect(working.blocks[0].evidence[0].sessionId).toBe('remote-draft');});
 it('requires the compared local revision and preserves earlier writing in history',async()=>{const store=new WorkingCardStore('sync-cas-'+crypto.randomUUID());const first=await store.save({...working,text:'remote writing'},0);const choice=workingSyncChoices([{...working,text:'incoming',blocks:[{...working.blocks[0],text:'incoming'}]}],[first])[0];await store.save({...first,text:'new local words',blocks:[{...first.blocks[0],text:'new local words'}]},first.revision);await expect(store.save(choice.remote,choice.expectedRevision)).rejects.toThrow('Another tab');expect((await store.get(1,'CODE'))?.text).toBe('new local words');expect((await store.versions(1,'CODE')).map(v=>v.text)).toEqual(['remote writing','new local words']);});
 it('rewrites per-take and phrase-patch audio ids while retaining capture and receipt ids',()=>{
 const withPhrase={...draft,takes:[{id:'take',captureId:'capture',captureSessionId:'old-audio',state:'review',phrasePatchId:'original-patch'}],phrasePatches:[{id:'original-patch',captureId:'capture',captureSessionId:'old-audio'}],results:[{...draft.results[0],takeIds:['take']}]};
 const restored:any=remapVoiceReview({schema:1,draft:withPhrase,working:[]},saved,{},'fresh');
 expect(restored.takes[0]).toMatchObject({id:'take',captureId:'capture',captureSessionId:'new-audio',phrasePatchId:'original-patch'});expect(restored.phrasePatches[0]).toMatchObject({id:'original-patch',captureSessionId:'new-audio'});expect(restored.results[0].takeIds).toEqual(['take']);expect(withPhrase.takes[0].captureSessionId).toBe('old-audio');
 });
 it('refuses missing captures, missing takes and external audio sessions before acknowledging a copy',()=>{
 const checked={...draft,results:[{...draft.results[0],takeIds:['take']}]};
 expect(()=>validateVoiceWorkspaceAudio({schema:1,draft:{...checked,takes:[{id:'take',captureId:'not-transferred'}]} as any,working:[]},saved)).toThrow('not included');
 expect(()=>validateVoiceWorkspaceAudio({schema:1,draft:{...checked,takes:[]} as any,working:[]},saved)).toThrow('missing recording take');
 expect(()=>remapVoiceReview({schema:1,draft:{...checked,takes:[{id:'take',captureId:'capture',captureSessionId:'external-audio'}]} as any,working:[]},saved,{})).toThrow('not included');
 });
 it('restores cross-card links with fresh ids, peer source snapshots and mapped evidence',()=>{
 const main={...draft,linkedSessionIds:['peer-draft']};const peerSource={...source,cardNumber:2,hash:'peer-hash'};
 const peer={...draft,id:'peer-draft',cardNumber:2,source:peerSource,sourceHash:'peer-hash',sections:[{...section,id:'2/CODE/reading',cardNumber:2,sourceHash:'peer-hash'}],results:[{...draft.results[0],sectionId:'2/CODE/reading'}],linkedSessionIds:['remote-draft']};
 const peerWorking={...working,key:'2/CODE',cardNumber:2,source:peerSource,sourceHash:'peer-hash',blocks:[{...working.blocks[0],evidence:[{...working.blocks[0].evidence[0],sessionId:'peer-draft'}]}]};
 const workspace=readVoiceWorkspace({voice:{schema:1,draft:main,working:[],linked:[{draft:peer,working:[peerWorking]}]}});
 const restored:any[]=remapLinkedVoiceReviews(workspace,saved,{'peer-draft':{'2/CODE/reading':'local peer words'}},{'remote-draft':'fresh-main','peer-draft':'fresh-peer'});
 expect(restored[0].linkedSessionIds).toEqual(['fresh-peer']);expect(restored[1].linkedSessionIds).toEqual(['fresh-main']);expect(restored[1].source).toEqual(peerSource);expect(restored[1].captureSessionId).toBe('new-audio');expect(restored[1].results[0]).toMatchObject({checked:false,comparisonOriginal:'local peer words'});
 expect(remapWorkspaceEvidence(peerWorking,{'peer-draft':'fresh-peer'}).blocks[0].evidence[0]).toMatchObject({sessionId:'fresh-peer',captureId:'capture',transcriptId:'receipt'});
 expect(()=>readVoiceWorkspace({voice:{...workspace,linked:[{draft:peer,working:[{...peerWorking,sourceHash:'hash'}]}]}})).toThrow('linked card source');
 expect(()=>readVoiceWorkspace({voice:{...workspace,linked:[]}})).toThrow('linked card source');
 });
 it('restores only valid card/section positions and clamps to actual audio',()=>{expect(safeResume({cardNumber:2,positionMs:10},draft,saved)).toBeNull();expect(safeResume({cardNumber:1,sectionId:section.id,captureId:'capture',positionMs:9000},draft,saved)?.positionMs).toBe(5000);});
});
describe('quiet opt-in continuity',()=>{
 it('does no work before opt-in, during recording, or for unchanged state',async()=>{const gate=new QuietContinuity();let saves=0;const save=async()=>{saves++;};await gate.run(false,false,'one',save);await gate.run(true,true,'one',save);expect(saves).toBe(0);await gate.run(true,false,'one',save);await gate.run(true,false,'one',save);expect(saves).toBe(1);await gate.run(true,false,'two',save);expect(saves).toBe(2);});
 it('does not retry an unchanged failed/conflicting copy',async()=>{const gate=new QuietContinuity();let attempts=0;await expect(gate.run(true,false,'same',async()=>{attempts++;throw Error('conflict');})).rejects.toThrow('conflict');await gate.run(true,false,'same',async()=>{attempts++;});expect(attempts).toBe(1);});
});
