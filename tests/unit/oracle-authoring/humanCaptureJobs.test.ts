import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {createSession,sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {queueHumanCapture,humanJobs,editJobPassage} from '../../../src/mobile/authoring/humanCaptureJobs';
const audio=new AuthoringStore(),cards=new WorkingCardStore();
beforeEach(async()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});for(const name of ['oracle-authoring-v1','oracle-working-cards-v1'])await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});});
async function setup(){const source=await sourceSnapshot(2,'original','Published scaffold',[{id:'CODE',title:'Code',start:0,end:18}]);const session=createSession(source);session.captures.push({id:'clip',recordedAt:session.createdAt,mimeType:'audio/wav',durationMs:1000,status:'ready',origin:'import'});await audio.save(session,0);await audio.appendChunk(session.id,'clip',0,new Blob(['unchanged audio'],{type:'audio/wav'}),1000);return{source,session};}
it('keeps processing independent, preserves concurrent recording metadata and applies literal words once',async()=>{
 const {source,session}=await setup();let finish:(v:any)=>void;const transcription=new Promise(resolve=>{finish=resolve;});const services={loadSource:async()=>source,transcribe:vi.fn(()=>transcription as any),propose:vi.fn(()=>{throw Error('AI prose must not run');})};
 queueHumanCapture(session.id,'clip',services);await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('transcribing'));
 const latest=(await audio.load(session.id))!;await audio.save({...latest.session,captures:[...latest.session.captures,{...session.captures[0],id:'next',status:'recording'}]},latest.version);
 finish!({provider:'fixture',segments:[{text:'My own thought belongs here.',startMs:0,endMs:1000,timing:'provider',sectionId:'CODE'}]});await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('ready'));
 expect((await cards.get(2,'CODE'))?.text).toBe('My own thought belongs here.');expect((await audio.load(session.id))!.session.captures.some(c=>c.id==='next')).toBe(true);expect(services.propose).not.toHaveBeenCalled();
 queueHumanCapture(session.id,'clip',services);await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('ready'));expect((await cards.get(2,'CODE'))!.revision).toBe(1);expect(services.transcribe).toHaveBeenCalledTimes(1);expect(await(await audio.audio(session.id,'clip')).text()).toBe('unchanged audio');
});
it('holds uncertain transcription for a human, then saves the corrected exact words without retranscribing',async()=>{
 const {source,session}=await setup();const transcribe=vi.fn(async()=>({provider:'fixture',segments:[{text:'A misheard word.',startMs:0,endMs:1000,timing:'provider' as const,sectionId:'CODE',words:[{text:'misheard',startMs:100,endMs:600,probability:.2}]}]}));const services={loadSource:async()=>source,transcribe};queueHumanCapture(session.id,'clip',services);
 await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('attention'));expect(await cards.get(2,'CODE')).toBeUndefined();const recorded=(await audio.load(session.id))!.session.transcript[0];await editJobPassage(session.id,recorded.id,'My chosen exact words.');
 queueHumanCapture(session.id,'clip',services,{reviewed:{[recorded.id]:'My chosen exact words.'}});await vi.waitFor(()=>expect(humanJobs()[0].state).toBe('ready'));expect((await cards.get(2,'CODE'))!.text).toBe('My chosen exact words.');expect((await audio.load(session.id))!.session.transcript[0].raw).toBe('A misheard word.');expect(transcribe).toHaveBeenCalledTimes(1);
});
