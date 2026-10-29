import {startCapture,type ActiveCapture} from '../../../lib/oracle/authoring/recorder';
import type {AuthoringStore,SavedSession} from '../../../lib/oracle/authoring/storage';
import type {AuthoringSession} from '../../../lib/oracle/authoring/types';

/** Restrict recorder retries to its own capture and markers. Background transcript
 * jobs may save the same session; their words, receipts and sources always win. */
export function recordingStore(store:AuthoringStore,initial:SavedSession):AuthoringStore {
 let ownCapture='';
 const initialIds=new Set(initial.session.captures.map(c=>c.id));
 const save=async(incoming:AuthoringSession,_expectedVersion:number):Promise<number>=>{
  if(!ownCapture){const added=incoming.captures.filter(c=>!initialIds.has(c.id));if(added.length!==1)throw new Error('The recording capture could not be identified safely.');ownCapture=added[0].id;}
  const own=incoming.captures.find(c=>c.id===ownCapture);
  if(!own)throw new Error('The active recording is missing. Received audio remains saved.');
  for(let attempt=0;attempt<4;attempt++){
   const latest=await store.load(incoming.id);
   if(!latest)throw new Error('The recording session could not be reopened.');
   const previous=latest.session.captures.find(c=>c.id===ownCapture);
   const capture={...previous,...own,durationMs:Math.max(previous?.durationMs??0,own.durationMs)};
   const next={...latest.session,captures:previous?latest.session.captures.map(c=>c.id===ownCapture?capture:c):[...latest.session.captures,capture],markers:[...latest.session.markers.filter(m=>m.captureId!==ownCapture),...incoming.markers.filter(m=>m.captureId===ownCapture)]};
   try{return await store.save(next,latest.version);}catch(error){if(attempt===3||!/another tab/i.test(String(error)))throw error;}
  }
  throw new Error('The recording changed while saving. Received audio remains on this device.');
 };
 return new Proxy(store,{get(target,key){if(key==='save')return save;const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}

/** One visible recording, several independently decodable, durable takes. A
 * completed take can transcribe while the next records. Automatic boundaries wait
 * for a quiet break with supported metering; flush() explicitly sends a thought.
 * Without metering a take stays intact until flush or Finish. Closing/reopening the
 * microphone at boundaries can leave a short gap; this is not word streaming. */
export type ContinuousCapture=ActiveCapture&{flush:()=>Promise<void>};
export async function startContinuousCapture(
 store:AuthoringStore,saved:SavedSession,sectionId:string,
 onFailure:(error:Error)=>void,visibleCardNumber=saved.session.source.cardNumber,
 options:{segmentMs?:number;onSegment?:(saved:SavedSession,captureId:string)=>void}={},
):Promise<ContinuousCapture>{
 const segmentMs=Math.max(1000,Math.min(options.segmentMs??12000,60000));
 let current:ActiveCapture|null=null,total=0,stopRequested=false,paused=false,finished=false;
 let nextSection:string|null=sectionId,timer:ReturnType<typeof setInterval>|undefined;
 let resolve!:(value:SavedSession)=>void,reject!:(error:Error)=>void;
 let lastSaved=saved,failureReported=false,quietSince:number|null=null;
 const openedAt=performance.now();
 let transition:Promise<void>=Promise.resolve();
 const completion=new Promise<SavedSession>((yes,no)=>{resolve=yes;reject=no;});
 void completion.catch(()=>undefined);
 const fail=(error:unknown)=>{
  if(finished)return;
  stopRequested=true;
  const value=error instanceof Error?error:new Error('Recording stopped. Received audio remains saved.');
  if(!failureReported){failureReported=true;onFailure(value);}
 };
 const finish=(value:SavedSession)=>{if(finished)return;finished=true;clearInterval(timer);current=null;resolve(value);};
 const abort=(error:unknown)=>{if(finished)return;fail(error);finished=true;clearInterval(timer);current=null;reject(error instanceof Error?error:new Error('Recording stopped. Received audio remains saved.'));};
 const publish=async(handle:ActiveCapture)=>{
  const result=await handle.completion;
  total+=handle.elapsed();
  if(current===handle)current=null;
  const latest=await store.load(saved.session.id);
  lastSaved=latest??result;
  const capture=lastSaved.session.captures.find(c=>c.id===handle.captureId);
  if(capture&&capture.status!=='empty'&&capture.durationMs>0)options.onSegment?.(lastSaved,handle.captureId);
  if(stopRequested){finish(lastSaved);return;}
  await open();
 };
 const open=async()=>{
  if(stopRequested){finish(lastSaved);return;}
  const latest=await store.load(saved.session.id);
  if(!latest)throw new Error('The recording session could not be reopened.');
  if(stopRequested){finish(lastSaved);return;}
  const handle=await startCapture(recordingStore(store,latest),latest,nextSection,fail,visibleCardNumber);
  current=handle;
  // A user can pause or finish while microphone opening is awaiting permission.
  if(paused)handle.pause();
  transition=publish(handle);
  void transition.catch(abort);
  if(stopRequested)void handle.stop().catch(abort);
 };
 await open();
 const captureId=current!.captureId;
 timer=setInterval(()=>{
  const handle=current;
  if(finished||stopRequested)return;
  // Keep the original twenty-minute wall-clock recording ceiling, including pauses.
  if(performance.now()-openedAt>=20*60*1000){stopRequested=true;clearInterval(timer);if(handle)void handle.stop().catch(abort);return;}
  if(paused||!handle||handle.state()!=='recording'||handle.elapsed()<segmentMs){quietSince=null;return;}
  const level=handle.level();
  // Unsupported metering keeps a whole take. Never cut unknown or audible speech.
  if(level===null||level>=.025){quietSince=null;return;}
  quietSince??=performance.now();
  if(performance.now()-quietSince>=700){quietSince=null;void handle.stop().catch(abort);}
 },200);
 return {
  captureId,
  elapsed:()=>total+(current?.elapsed()??0),
  state:()=>finished?'inactive':paused?'paused':'recording',
  pause:()=>{if(finished||stopRequested)return;paused=true;current?.pause();},
  resume:()=>{if(finished||stopRequested)return;paused=false;current?.resume();},
  level:()=>paused?0:current?.level()??null,
  muted:()=>current?.muted()??false,
  mark:(id:string|null)=>{nextSection=id;current?.mark(id);},
  stop:()=>{if(!finished){stopRequested=true;clearInterval(timer);if(current)void current.stop().catch(abort);}return completion;},
  flush:async()=>{const handle=current;if(!handle||finished||stopRequested)return;const previousTransition=transition;await handle.stop();await previousTransition;},
  completion,
 };
}
