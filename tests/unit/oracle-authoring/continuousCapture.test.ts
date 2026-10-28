import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {ActiveCapture} from '../../../lib/oracle/authoring/recorder';
import type {AuthoringStore,SavedSession} from '../../../lib/oracle/authoring/storage';
import type {AuthoringSession} from '../../../lib/oracle/authoring/types';
const fake=vi.hoisted(()=>({start:vi.fn(),handles:[] as ActiveCapture[],level:0 as number|null,opening:undefined as Promise<void>|undefined,failNext:false}));
vi.mock('../../../lib/oracle/authoring/recorder',()=>({startCapture:fake.start}));
import {startContinuousCapture} from '../../../src/mobile/authoring/continuousCapture';
function memory(){
 let value:SavedSession={version:1,session:{schema:1,id:'session',createdAt:'today',source:{cardNumber:2,revision:'base',hash:'test',markdown:'words',sections:[{id:'CODE',title:'Code',start:0,end:5}]},captures:[],markers:[],transcript:[],proposals:[],approvals:[]}};
 let conflict=false;
 const store={load:vi.fn(async()=>structuredClone(value)),save:vi.fn(async(session:AuthoringSession,expected:number)=>{
  if(conflict&&session.captures.some(c=>c.status==='ready')){conflict=false;value={version:value.version+1,session:{...value.session,title:'Background transcript result'}};throw new Error('Another tab changed this session.');}
  if(expected!==value.version)throw new Error('Another tab changed this session.');value={session:structuredClone(session),version:value.version+1};return value.version;
 })} as unknown as AuthoringStore;
 return{store,saved:()=>structuredClone(value),conflict:()=>{conflict=true;}};
}
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();}
beforeEach(()=>{
 vi.useFakeTimers();fake.start.mockReset();fake.handles=[];fake.level=0;fake.opening=undefined;fake.failNext=false;
 fake.start.mockImplementation(async(store:AuthoringStore,saved:SavedSession,sectionId:string)=>{
  if(fake.failNext){fake.failNext=false;throw new Error('Microphone no longer available');}
  if(fake.opening){const gate=fake.opening;fake.opening=undefined;await gate;}
  const id=`capture-${fake.handles.length}`,start=performance.now();let state:RecordingState='recording',pausedAt:number|null=null,pausedTotal=0,final:number|null=null;
  const session={...saved.session,captures:[...saved.session.captures,{id,recordedAt:'today',mimeType:'audio/webm',durationMs:0,status:'recording' as const,origin:'microphone' as const}],markers:[...saved.session.markers,{captureId:id,sectionId,atMs:0}]};
  await store.save(session,saved.version);
  let resolve!:(saved:SavedSession)=>void;const completion=new Promise<SavedSession>(yes=>{resolve=yes;});
  const elapsed=()=>final??(pausedAt??performance.now())-start-pausedTotal;
  const handle:ActiveCapture={captureId:id,elapsed,state:()=>state,pause:vi.fn(()=>{if(state==='recording'){state='paused';pausedAt=performance.now();}}),resume:vi.fn(()=>{if(state==='paused'){pausedTotal+=performance.now()-pausedAt!;pausedAt=null;state='recording';}}),level:()=>fake.level,muted:()=>false,mark:vi.fn(),stop:vi.fn(()=>{if(state!=='inactive'){final=elapsed();state='inactive';void(async()=>{const latest=(await store.load(saved.session.id))!;const next={...latest.session,captures:latest.session.captures.map(c=>c.id===id?{...c,durationMs:Math.max(1,final!),status:'ready' as const}:c)};const version=await store.save(next,latest.version);resolve({session:next,version});})();}return completion;}),completion};
  fake.handles.push(handle);return handle;
 });
});
afterEach(()=>vi.useRealTimers());
describe('continuous ordinary recording',()=>{
 it('waits for a quiet boundary then publishes each durable segment exactly once while the next records',async()=>{
  const m=memory(),onSegment=vi.fn(),failure=vi.fn();const active=await startContinuousCapture(m.store,m.saved(),'CODE',failure,2,{segmentMs:1000,onSegment});
  fake.level=.2;await vi.advanceTimersByTimeAsync(3000);expect(fake.handles).toHaveLength(1);
  fake.level=0;await vi.advanceTimersByTimeAsync(1000);expect(fake.handles).toHaveLength(2);expect(onSegment).toHaveBeenCalledTimes(1);expect(fake.handles[0].state()).toBe('inactive');expect(active.state()).toBe('recording');
  await vi.advanceTimersByTimeAsync(500);await active.stop();expect(onSegment).toHaveBeenCalledTimes(2);expect(active.elapsed()).toBeGreaterThanOrEqual(4500);expect(failure).not.toHaveBeenCalled();
 });
 it('does not cut unsupported-meter audio and allows explicitly applying a thought',async()=>{
  const m=memory(),onSegment=vi.fn();fake.level=null;const active=await startContinuousCapture(m.store,m.saved(),'CODE',vi.fn(),2,{segmentMs:1000,onSegment});await vi.advanceTimersByTimeAsync(8000);expect(fake.handles).toHaveLength(1);await active.flush();expect(fake.handles).toHaveLength(2);expect(onSegment).toHaveBeenCalledTimes(1);await active.stop();expect(onSegment).toHaveBeenCalledTimes(2);
 });
 it('pauses rotation and accumulated media time, then carries the selected section into the next take',async()=>{
  const m=memory(),active=await startContinuousCapture(m.store,m.saved(),'CODE',vi.fn(),2,{segmentMs:1000});await vi.advanceTimersByTimeAsync(500);active.pause();await vi.advanceTimersByTimeAsync(5000);expect(active.elapsed()).toBe(500);expect(fake.handles).toHaveLength(1);active.mark('ICHING');active.resume();await active.flush();expect(fake.start.mock.calls[1][2]).toBe('ICHING');await active.stop();
 });
 it('rebases recorder-only writes after a background session save without losing it',async()=>{
  const m=memory(),active=await startContinuousCapture(m.store,m.saved(),'CODE',vi.fn());m.conflict();await active.flush();expect(m.saved().session.title).toBe('Background transcript result');expect(m.saved().session.captures).toHaveLength(2);await active.stop();expect(m.saved().session.title).toBe('Background transcript result');
 });
 it('retains the published first take and stops after the next microphone fails',async()=>{
  const m=memory(),onSegment=vi.fn(),failure=vi.fn(),active=await startContinuousCapture(m.store,m.saved(),'CODE',failure,2,{onSegment});fake.failNext=true;await expect(active.flush()).rejects.toThrow('Microphone no longer available');await expect(active.completion).rejects.toThrow('Microphone no longer available');expect(onSegment).toHaveBeenCalledTimes(1);expect(failure).toHaveBeenCalledTimes(1);expect(m.saved().session.captures[0].status).toBe('ready');
 });
 it('honours Finish while a boundary microphone is opening and opens no third take',async()=>{
  const m=memory(),active=await startContinuousCapture(m.store,m.saved(),'CODE',vi.fn());let allow!:()=>void;fake.opening=new Promise<void>(r=>{allow=r;});const flushing=active.flush();await settle();const stopping=active.stop();allow();await flushing;await stopping;expect(active.state()).toBe('inactive');expect(fake.handles).toHaveLength(2);expect(fake.handles.every(h=>h.state()==='inactive')).toBe(true);
 });
 it('keeps the twenty-minute wall-clock ceiling even without metering and while paused',async()=>{
  const m=memory(),onSegment=vi.fn();fake.level=null;const active=await startContinuousCapture(m.store,m.saved(),'CODE',vi.fn(),2,{onSegment});await vi.advanceTimersByTimeAsync(500);active.pause();await vi.advanceTimersByTimeAsync(20*60*1000);await active.completion;expect(active.state()).toBe('inactive');expect(fake.handles).toHaveLength(1);expect(active.elapsed()).toBe(500);expect(onSegment).toHaveBeenCalledTimes(1);
 });

});
