import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {addTranscript,createSession,sourceSnapshot,correctTranscript} from '../../../lib/oracle/authoring/workflow';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
it('preserves AR word/speaker provenance independently of corrected speech',async()=>{
 let s=createSession(await sourceSnapshot(1,'r','Source.',[{id:'CODE',title:'Code',start:0,end:7}]));
 s.captures.push({id:'audio',recordedAt:s.createdAt,durationMs:1000,mimeType:'audio/wav',status:'ready',origin:'import'});
 const words=[{startMs:100,endMs:600,text:'Original',probability:.92}];
 s=addTranscript(s,'audio',[{text:'Original.',startMs:100,endMs:700,sectionId:'CODE',timing:'provider',words,speaker:'speaker_1'}],'AR Create · local Whisper');
 const store=new AuthoringStore(`alignment-${crypto.randomUUID()}`);let version=await store.save(s,0);
 s=correctTranscript(s,s.transcript[0].id,{corrected:'Corrected.'});version=await store.save(s,version);
 expect((await store.load(s.id))!.session.transcript[0].words).toEqual(words);
 await expect(store.save({...s,transcript:s.transcript.map(t=>({...t,words:[{...words[0],text:'Invented'}]}))},version)).rejects.toThrow(/Original/);
 expect(()=>addTranscript(s,'audio',[{text:'Bad',startMs:0,endMs:1000,sectionId:'CODE',timing:'provider',words:[{startMs:0,endMs:2000,text:'Bad'}]}],'AR Create')).toThrow(/alignment/);
});
