import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {AuthoringStore,SavedSession} from '../../../lib/oracle/authoring/storage';
import type {AuthoringSession} from '../../../lib/oracle/authoring/types';
const native=vi.hoisted(()=>({active:[] as boolean[],listeners:[] as ((event:{kind:string})=>void)[]}));
vi.mock('../../../src/mobile/authoring/nativeRecordingGuard',()=>({
 setRecordingActive:(value:boolean)=>{native.active.push(value);},
 onNativeRecordingEvent:(listener:(event:{kind:string})=>void)=>{native.listeners.push(listener);return()=>{native.listeners=native.listeners.filter(item=>item!==listener);};},
}));
import {isCaptureLive,startCapture} from '../../../lib/oracle/authoring/recorder';
import {startVoiceCapturePass} from '../../../src/mobile/authoring/voiceCapturePass';

class Track extends EventTarget {
 muted=false;enabled=true;readyState:MediaStreamTrackState='live';
 stop=vi.fn(()=>{this.readyState='ended';});
 end(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}
 mute(on:boolean){this.muted=on;this.dispatchEvent(new Event(on?'mute':'unmute'));}
}
const log:string[]=[];
class Recorder {
 static all:Recorder[]=[];static isTypeSupported=()=>true;static exclusive=false;static refuse=0;
 static onStart:((recorder:Recorder)=>void)|undefined;static onStop:((recorder:Recorder)=>void)|undefined;
 static get latest(){return Recorder.all[Recorder.all.length-1];}
 readonly n=Recorder.all.length;
 state:RecordingState='inactive';mimeType='audio/webm';
 ondataavailable:((event:{data:Blob})=>void)|null=null;onstop:(()=>void)|null=null;onpause:(()=>void)|null=null;onresume:(()=>void)|null=null;onerror:(()=>void)|null=null;
 constructor(){Recorder.all.push(this);}
 start=vi.fn(()=>{if(Recorder.refuse>0||Recorder.exclusive&&Recorder.all.some(r=>r!==this&&r.state!=='inactive')){Recorder.refuse=Math.max(0,Recorder.refuse-1);throw Object.assign(new Error('busy'),{name:'NotReadableError'});}log.push(`start ${this.n}`);Recorder.onStart?.(this);this.state='recording';});
 requestData=vi.fn(()=>this.emit('chunk'));
 emit(text:string){this.ondataavailable?.({data:new Blob([text],{type:this.mimeType})});}
 pause=vi.fn(()=>{this.state='paused';this.onpause?.();});
 resume=vi.fn(()=>{this.state='recording';this.onresume?.();});
 stop=vi.fn(()=>{log.push(`stop ${this.n}`);Recorder.onStop?.(this);this.state='inactive';this.emit('final');this.onstop?.();});
}
class Page extends EventTarget {visibilityState:DocumentVisibilityState='visible';}
function memoryStore(){
 const initial:AuthoringSession={schema:1,id:'session',createdAt:'2026-11-11',source:{cardNumber:2,revision:'r',hash:'test',markdown:'words',sections:[{id:'CODE',title:'Code',start:0,end:5}]},captures:[],markers:[],transcript:[],proposals:[],approvals:[]};
 let current:SavedSession={session:structuredClone(initial),version:1};
 const chunks:{captureId:string;index:number;text:Promise<string>;endMs:number}[]=[];
 const failOn={text:''};
 const store={
  save:vi.fn(async(session:AuthoringSession,version:number)=>{if(version!==current.version)throw new Error('Another tab changed this session.');current={session:structuredClone(session),version:version+1};return current.version;}),
  load:vi.fn(async()=>structuredClone(current)),
  appendChunk:vi.fn(async(_session:string,captureId:string,index:number,blob:Blob,endMs:number)=>{
   const text=await blob.text();if(failOn.text&&text===failOn.text)throw new Error('Disk full');
   chunks.push({captureId,index,text:Promise.resolve(text),endMs});
   current.session.captures=current.session.captures.map(c=>c.id===captureId?{...c,durationMs:endMs}:c);current.version++;
  }),
  chunks:vi.fn(async()=>[]),captureChunks:vi.fn(async()=>[]),
 };
 return {initial:{session:initial,version:1},store:store as unknown as AuthoringStore,chunks,failOn,current:()=>current};
}
let now:number,track:Track,page:Page,meter:{level:number}|null;
class Context {
 state='running';
 createMediaStreamSource(){return {connect:vi.fn(),disconnect:vi.fn()};}
 createAnalyser(){return {fftSize:256,getFloatTimeDomainData:(values:Float32Array)=>values.fill(meter?.level??0),disconnect:vi.fn()};}
 resume=vi.fn(async()=>{this.state='running';});close=vi.fn(async()=>{this.state='closed';});
}
async function settle(){for(let i=0;i<80;i++)await Promise.resolve();}
beforeEach(()=>{
 now=0;track=new Track();page=new Page();meter=null;log.length=0;Recorder.all=[];Recorder.exclusive=false;Recorder.refuse=0;Recorder.onStart=Recorder.onStop=undefined;native.active=[];native.listeners=[];
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]}))}});
 vi.stubGlobal('MediaRecorder',Recorder);
 vi.stubGlobal('window',{setTimeout,clearTimeout});
 vi.stubGlobal('document',page);
 vi.spyOn(performance,'now').mockImplementation(()=>now);
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
const withMeter=(level:number)=>{meter={level};vi.stubGlobal('window',{setTimeout,clearTimeout,AudioContext:Context});};

describe('take boundaries without a gap',()=>{
 it('starts the next recorder on the kept stream before stopping the old one',async()=>{
  const {store,initial,current}=memoryStore();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{continuous:true});
  now=1000;await active.flush({nextSectionId:'ICHING'});
  expect(log).toEqual(['start 0','start 1','stop 0']);
  expect(active.state()).toBe('recording');expect(track.stop).not.toHaveBeenCalled();
  const [first,second]=current().session.captures;
  expect(first).toMatchObject({status:'ready',durationMs:1000});expect(second.status).toBe('recording');
  expect(current().session.markers.find(m=>m.captureId===second.id)?.sectionId).toBe('ICHING');
  now=1600;Recorder.latest.emit('next');now=2000;const saved=await active.stop();
  expect(saved.session.captures.map(c=>c.status)).toEqual(['ready','ready']);expect(active.elapsed()).toBe(2000);
 });
 it('keeps recording the new take while a slow onSegmentReady runs',async()=>{
  const {store,initial,chunks}=memoryStore();let register!:()=>void;const onActive=vi.fn();
  const onSegmentReady=vi.fn((_saved:SavedSession,_id:string,meta:{reason:string})=>meta.reason==='send'?new Promise<void>(yes=>{register=yes;}):undefined);
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{continuous:true,onSegmentReady,onActive});
  now=1000;const flushing=active.flush();await settle();
  expect(onSegmentReady).toHaveBeenCalledTimes(1);expect(Recorder.all).toHaveLength(2);expect(Recorder.latest.state).toBe('recording');
  const second=active.currentCaptureId()!;expect(second).not.toBe(active.captureId);
  now=2000;Recorder.latest.emit('spoken while registering');await settle();
  expect(chunks.some(c=>c.captureId===second)).toBe(true);
  // The studio's per-take state is set in onActive, so it still follows registration.
  expect(onActive).toHaveBeenCalledTimes(1);register();await flushing;expect(onActive).toHaveBeenLastCalledWith(second);
  await active.stop();
 });
 it('reports a failure while finishing the old take and keeps the new take recording',async()=>{
  const {store,initial,failOn,current}=memoryStore(),failure=vi.fn();
  const onSegmentReady=vi.fn((_saved:SavedSession,_id:string,meta:{reason:string})=>{if(meta.reason==='send')throw new Error('Could not queue the take');});
  const active=await startVoiceCapturePass(store,initial,'CODE',failure,2,{continuous:true,onSegmentReady});
  now=1000;Recorder.latest.emit('spoken');failOn.text='final';await active.flush();await settle();
  expect(failure.mock.calls.map(call=>call[0].message)).toEqual(['Disk full','Could not queue the take']);
  expect(active.state()).toBe('recording');expect(Recorder.latest.state).toBe('recording');expect(track.stop).not.toHaveBeenCalled();
  failOn.text='';now=1500;Recorder.latest.emit('still here');now=2000;const saved=await active.stop();
  expect(saved.session.captures.at(-1)).toMatchObject({status:'ready',durationMs:1000});expect(current().session.captures[0]).toMatchObject({status:'interrupted',durationMs:1000});
 });
 it('falls back to stop-then-start when a second recorder on one stream is refused',async()=>{
  Recorder.exclusive=true;const {store,initial}=memoryStore(),failure=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',failure,2,{continuous:true});
  now=1000;await active.flush();
  // The refused start is retried on the same prepared take right after the old one stops.
  expect(log).toEqual(['start 0','stop 0','start 1']);expect(active.state()).toBe('recording');expect(failure).not.toHaveBeenCalled();
  now=1500;const saved=await active.stop();expect(saved.session.captures.map(c=>c.status)).toEqual(['ready','ready']);
 });
 it('opens a fresh take when the prepared one is refused twice',async()=>{
  const {store,initial,current}=memoryStore(),failure=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',failure,2,{continuous:true});
  Recorder.refuse=2;now=1000;await active.flush();await settle();
  expect(log).toEqual(['start 0','stop 0','start 2']);expect(active.state()).toBe('recording');expect(failure).not.toHaveBeenCalled();
  now=1500;await active.stop();await settle();expect(current().session.captures.map(c=>c.status)).toEqual(['ready','empty','ready']);
 });
 it('prepares the next take first, then starts it and stops the old one in the same tick',async()=>{
  const {store,initial,current}=memoryStore();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{continuous:true});
  let ticked=false,atStart:string[]=[],tickedAtStop:boolean|undefined;
  Recorder.onStart=()=>{atStart=current().session.captures.map(c=>c.status);ticked=false;queueMicrotask(()=>{ticked=true;});};
  Recorder.onStop=recorder=>{if(recorder.n===0)tickedAtStop=ticked;};
  now=1000;await active.flush();
  expect(log).toEqual(['start 0','start 1','stop 0']);
  // The next capture was saved before its recorder started, and no awaited work ran between start and stop.
  expect(atStart).toEqual(['recording','recording']);expect(tickedAtStop).toBe(false);
  now=2000;await active.stop();
 });
 it('keeps the current take recording when the next take cannot be prepared',async()=>{
  const {store,initial}=memoryStore(),failure=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',failure,2,{continuous:true});
  vi.mocked(store.load).mockRejectedValueOnce(new Error('Storage unavailable'));
  now=1000;await active.flush();await settle();
  expect(failure.mock.calls.map(call=>call[0].message)).toEqual(['Storage unavailable']);
  expect(log).toEqual(['start 0']);expect(Recorder.latest.state).toBe('recording');expect(active.state()).toBe('recording');expect(active.currentCaptureId()).toBe(active.captureId);
  now=2000;const saved=await active.stop();expect(saved.session.captures.map(c=>c.status)).toEqual(['ready']);
 });
 it('closes and queues a take whose closing save keeps failing, and reports the failure',async()=>{
  const {store,initial,current,chunks}=memoryStore(),failure=vi.fn(),onSegmentReady=vi.fn();
  vi.mocked(store.captureChunks).mockImplementation(async(_session,id)=>chunks.filter(c=>c.captureId===id).map(c=>({key:`${id}/${c.index}`,sessionId:'session',captureId:id,index:c.index,endMs:c.endMs,blob:new Blob([])})));
  const active=await startVoiceCapturePass(store,initial,'CODE',failure,2,{continuous:true,onSegmentReady});
  const first=active.captureId,save=vi.mocked(store.save),real=save.getMockImplementation()!;
  save.mockImplementation(async(session,version)=>{if(session.captures.find(c=>c.id===first)?.status==='ready')throw new Error('Disk full');return real(session,version);});
  now=1000;Recorder.latest.emit('spoken');await active.flush();await settle();
  expect(failure.mock.calls.map(call=>call[0].message)).toEqual(['Disk full']);
  expect(isCaptureLive(first)).toBe(false);
  expect(current().session.captures.find(c=>c.id===first)).toMatchObject({status:'interrupted',durationMs:1000});
  expect(onSegmentReady).toHaveBeenCalledWith(expect.anything(),first,{reason:'send'});
  expect(Recorder.latest.state).toBe('recording');
  now=2000;await active.stop();
 });
});

describe('automatic rollover',()=>{
 async function speak(until:number){while(now<until){now+=100;if(now%1000===0)Recorder.latest.emit('x');await vi.advanceTimersByTimeAsync(100);await settle();}}
 it('rolls at the first quiet moment inside the last thirty seconds',async()=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval']});withMeter(.5);
  const {store,initial}=memoryStore(),onSegmentReady=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{maxDurationMs:60_000,onSegmentReady});
  expect(active.meterAvailable()).toBe(true);
  await speak(29_000);meter!.level=0;await speak(29_600);expect(Recorder.all).toHaveLength(1);
  meter!.level=.5;await speak(40_000);expect(Recorder.all).toHaveLength(1);
  meter!.level=0;await speak(40_300);expect(Recorder.all).toHaveLength(1);
  await speak(40_600);expect(Recorder.all).toHaveLength(2);expect(log).toEqual(['start 0','start 1','stop 0']);
  expect(onSegmentReady.mock.calls.map(call=>call[2].reason)).toEqual(['boundary']);expect(active.state()).toBe('recording');
  await active.stop();
 });
 it('rolls unconditionally at the ceiling through speech, and without a meter only at the ceiling',async()=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval']});withMeter(.5);
  const loud=memoryStore();const speaking=await startVoiceCapturePass(loud.store,loud.initial,'CODE',vi.fn(),2,{maxDurationMs:60_000});
  await speak(59_900);expect(Recorder.all).toHaveLength(1);await speak(60_200);expect(Recorder.all).toHaveLength(2);await speaking.stop();
  vi.stubGlobal('window',{setTimeout,clearTimeout});Recorder.all=[];log.length=0;now=0;
  const quiet=memoryStore();const unmetered=await startVoiceCapturePass(quiet.store,quiet.initial,'CODE',vi.fn(),2,{maxDurationMs:60_000});
  expect(unmetered.meterAvailable()).toBe(false);expect(unmetered.level()).toBeNull();
  await speak(59_900);expect(Recorder.all).toHaveLength(1);await speak(60_200);expect(log).toEqual(['start 0','start 1','stop 0']);
  await unmetered.stop();
 });
});

describe('pause at a boundary',()=>{
 it('Next while paused finishes the take and leaves the next one paused on the same stream',async()=>{
  const {store,initial}=memoryStore(),onSegmentReady=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{onSegmentReady});
  now=1000;active.pause();now=5000;await active.flush({continue:true,nextSectionId:'ICHING'});
  expect(onSegmentReady.mock.calls.map(call=>[call[2].reason,call[0].session.captures[0].durationMs])).toEqual([['send',1000]]);
  expect(active.state()).toBe('paused');expect(Recorder.latest.state).toBe('paused');expect(Recorder.all).toHaveLength(2);expect(track.stop).not.toHaveBeenCalled();
  active.resume();expect(Recorder.latest.state).toBe('recording');
  now=6000;await active.stop();expect(track.stop).toHaveBeenCalledTimes(1);
 });
});

describe('a microphone that goes silent',()=>{
 it('sets and clears the interruption on mute and unmute without ending the take',async()=>{
  const {store,initial}=memoryStore(),onInterruption=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{onInterruption});
  expect(active.interruption()).toBeNull();
  track.mute(true);expect(active.interruption()).toMatchObject({kind:'muted',since:expect.any(Number)});
  expect(active.state()).toBe('recording');expect(Recorder.latest.stop).not.toHaveBeenCalled();
  track.mute(false);expect(active.interruption()).toBeNull();
  expect(onInterruption.mock.calls.map(call=>call[0]?.kind??null)).toEqual(['muted',null]);
  native.listeners.forEach(listen=>listen({kind:'interruption-began'}));expect(active.interruption()?.kind).toBe('interrupted');
  native.listeners.forEach(listen=>listen({kind:'interruption-ended'}));expect(active.interruption()).toBeNull();
  now=1000;await active.stop();expect(native.listeners).toHaveLength(0);
 });
 it('clears an interruption when chunks with real input arrive, and reports it on a single capture',async()=>{
  withMeter(0);const {store,initial}=memoryStore(),onInterruption=vi.fn();
  const single=await startCapture(store,initial,'CODE',vi.fn(),2,{onInterruption});
  expect(single.meterAvailable?.()).toBe(true);
  native.listeners.forEach(listen=>listen({kind:'route-changed'}));expect(single.interruption?.()?.kind).toBe('route-changed');
  now=1000;Recorder.latest.emit('silence');expect(single.interruption?.()?.kind).toBe('route-changed');
  meter!.level=.5;now=2000;Recorder.latest.emit('words');expect(single.interruption?.()).toBeNull();
  expect(onInterruption.mock.calls.map(call=>call[0]?.kind??null)).toEqual(['route-changed',null]);
  await single.stop();
 });
 it('resumes a suspended meter when the page becomes visible again',async()=>{
  meter={level:.5};const contexts:Context[]=[];vi.stubGlobal('window',{setTimeout,clearTimeout,AudioContext:class extends Context{constructor(){super();contexts.push(this);}}});
  const {store,initial}=memoryStore();const other=await startCapture(store,initial,'CODE',vi.fn());
  expect(other.level()).toBeGreaterThan(0);contexts[0].state='suspended';expect(other.meterAvailable?.()).toBe(false);expect(other.level()).toBeNull();
  page.visibilityState='hidden';page.dispatchEvent(new Event('visibilitychange'));expect(contexts[0].resume).not.toHaveBeenCalled();
  page.visibilityState='visible';page.dispatchEvent(new Event('visibilitychange'));expect(contexts[0].resume).toHaveBeenCalledTimes(1);
  await settle();expect(other.meterAvailable?.()).toBe(true);
  await other.stop();
 });
});

describe('keeping the screen awake',()=>{
 it('holds it for a whole pass across overlapping takes and lets go at the end',async()=>{
  const {store,initial}=memoryStore();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{continuous:true});
  expect(native.active).toEqual([true]);now=1000;await active.flush();expect(native.active).toEqual([true]);
  now=2000;await active.stop();expect(native.active).toEqual([true,false]);
 });
 it('lets go when a pass ends on a track end',async()=>{
  const {store,initial}=memoryStore(),failure=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',failure,2);
  now=1000;track.end();await active.completion;expect(failure).toHaveBeenCalledTimes(1);expect(native.active).toEqual([true,false]);
 });
 it.each([
  ['stop',async(capture:Awaited<ReturnType<typeof startCapture>>)=>{await capture.stop();}],
  ['recorder error',async(capture:Awaited<ReturnType<typeof startCapture>>)=>{Recorder.latest.onerror?.();await capture.completion;}],
  ['track end',async(capture:Awaited<ReturnType<typeof startCapture>>)=>{track.end();await capture.completion;}],
 ])('pairs true with false for a single capture on %s',async(_name,end)=>{
  const {store,initial}=memoryStore();const capture=await startCapture(store,initial,'CODE',vi.fn());
  expect(native.active).toEqual([true]);now=1000;await end(capture);expect(native.active).toEqual([true,false]);
 });
});
