import { expect, it } from 'vitest';
import { suggestPassages } from '../../../lib/oracle/authoring/organization';
it('splits spoken changes across cards and lenses in spoken order', () => {
 const pieces = suggestPassages('This is the I Ching. Keep the first thought. Now hexagram twenty three. Human Design, the channel opens. Then card 2, Gene Keys. Another thought.', 1, 'CODE');
 expect(pieces.map(p => [p.cardNumber,p.sectionId])).toEqual([[1,'ICHING'],[23,'DESIGN'],[2,'KEYS']]);
 expect(pieces.map(p=>p.text).join(' ')).toContain('Keep the first thought.');
 expect(suggestPassages('Now hexagram twenty-three. A new thought.',1,'CODE')[0].cardNumber).toBe(23);
});
it('keeps references and uncertain words as editable hints rather than silent moves', () => {
 const reference = suggestPassages('This relates to hexagram 2. Keep this idea.', 23, 'CODE');
 expect(reference[0].cardNumber).toBe(23);
 const uncertain = suggestPassages('This is a chain. Here is the thought.', 23, 'CODE');
 expect(uncertain[0].sectionId).toBe('ICHING');
 expect(uncertain[0].reason).toMatch(/misheard|uncertain/i);
});
it('does not invent a destination for a question about which hexagram', () => {
 expect(suggestPassages('Which hexagram is this? I need to come back to this.',23,'CODE')[0].unresolved).toBe(true);
});

it('splits and re-splits passages while retaining the raw recording and ordered words', async () => {
 const {createSession,sourceSnapshot,addTranscript}=await import('../../../lib/oracle/authoring/workflow');
 const {splitPassage}=await import('../../../lib/oracle/authoring/organization');
 let s=createSession(await sourceSnapshot(1,'r','old words',[{id:'CODE',title:'Code',start:0,end:9}]));
 s.captures.push({id:'audio',recordedAt:s.createdAt,mimeType:'audio/webm',durationMs:1000,status:'ready',origin:'import'});
 s=addTranscript(s,'audio',[{text:'First thought. Second thought. Third thought.',startMs:0,endMs:1000,sectionId:'CODE',timing:'recording'}],'fixture');
 s=splitPassage(s,s.transcript[0].id,14,s.transcript[0].corrected);
 expect(s.transcript.filter(t=>!t.referenceOnly).map(t=>t.corrected)).toEqual(['First thought.','Second thought. Third thought.']);
 const second=s.transcript.filter(t=>!t.referenceOnly)[1];
 s=splitPassage(s,second.id,15,second.corrected);
 expect(s.transcript.filter(t=>!t.referenceOnly).sort((a,b)=>(a.order??0)-(b.order??0)).map(t=>t.corrected)).toEqual(['First thought.','Second thought.','Third thought.']);
 expect(s.transcript[0].raw).toBe('First thought. Second thought. Third thought.');
});

it('carries a spoken destination across AR timestamped segments and preserves speech order', async()=>{
 const {createSession,sourceSnapshot,addTranscript}=await import('../../../lib/oracle/authoring/workflow');
 const {organizeCapture}=await import('../../../lib/oracle/authoring/organization');
 const load=(n:number)=>sourceSnapshot(n,'r','Code. Design. Keys.',[{id:'CODE',title:'Code',start:0,end:5},{id:'DESIGN',title:'Human Design',start:6,end:13},{id:'KEYS',title:'Gene Keys',start:14,end:19}]);
 let s=createSession(await load(1));s.captures.push({id:'audio',recordedAt:s.createdAt,durationMs:6000,mimeType:'audio/wav',status:'ready',origin:'import'});
 s=addTranscript(s,'audio',[
  {text:'Now hexagram twenty-three. Human Design.',startMs:0,endMs:2000,timing:'provider',sectionId:'CODE',order:0},
  {text:'The next thought continues here.',startMs:2000,endMs:4000,timing:'provider',sectionId:'CODE',order:1},
  {text:'Then card two, Gene Keys. Last thought.',startMs:4000,endMs:6000,timing:'provider',sectionId:'CODE',order:2},
 ],'AR Create');
 s=await organizeCapture(s,'audio',load);
 const passages=s.transcript.filter(t=>!t.referenceOnly).sort((a,b)=>(a.order??0)-(b.order??0));
 expect(passages.map(t=>[t.cardNumber,t.sectionId])).toEqual([[23,'DESIGN'],[23,'DESIGN'],[2,'KEYS']]);
 expect(passages[1].raw).toBe('The next thought continues here.');expect(passages[1].startMs).toBe(2000);
});

it('uses a recorded section marker at the next provider segment without inventing a split',async()=>{
 const {createSession,sourceSnapshot,addTranscript}=await import('../../../lib/oracle/authoring/workflow');
 const {organizeCapture}=await import('../../../lib/oracle/authoring/organization');
 const load=(n:number)=>sourceSnapshot(n,'r','Code. Design. Keys.',[{id:'CODE',title:'Code',start:0,end:5},{id:'DESIGN',title:'Human Design',start:6,end:13},{id:'KEYS',title:'Gene Keys',start:14,end:19}]);
 let s=createSession(await load(1));s.captures.push({id:'audio',recordedAt:s.createdAt,durationMs:6000,mimeType:'audio/wav',status:'ready',origin:'microphone'});
 s.markers=[{captureId:'audio',atMs:0,sectionId:'CODE'},{captureId:'audio',atMs:3000,sectionId:'KEYS'}];
 s=addTranscript(s,'audio',[{text:'The first thought.',startMs:0,endMs:2000,timing:'provider',sectionId:'CODE'},{text:'A thought spanning the marker.',startMs:2000,endMs:4000,timing:'provider',sectionId:'CODE'},{text:'The next thought.',startMs:4000,endMs:6000,timing:'provider',sectionId:'CODE'}],'fixture');
 s=await organizeCapture(s,'audio',load);
 const active=s.transcript.filter(t=>!t.referenceOnly);expect(active.map(t=>t.sectionId)).toEqual(['CODE','CODE','KEYS']);expect(active.at(-1)?.startMs).toBe(4000);expect(s.transcript.filter(t=>!t.parentId)).toHaveLength(3);
});
