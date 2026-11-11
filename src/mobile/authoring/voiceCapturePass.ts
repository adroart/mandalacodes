import {acquireCaptureMicrophone,holdRecordingActive,REAL_INPUT_LEVEL,startCapture,watchInterruptions,type ActiveCapture,type CaptureInterruption} from '../../../lib/oracle/authoring/recorder';
import type {AuthoringStore,SavedSession} from '../../../lib/oracle/authoring/storage';
import {recordingStore} from './continuousCapture';

export interface VoiceCaptureSegmentMetadata {reason:'boundary'|'send'|'stop'}
export interface VoiceCapturePassOptions {
 continuous?:boolean;rollOnBoundary?:boolean;
 maxDurationMs?:number;
 maxBytes?:number;
 /** Runs after the finished take is durably saved, while the next take already records.
  * Calls are in take order; the next take's onActive waits for it, the recording does not. */
 onSegmentReady?:(saved:SavedSession,captureId:string,metadata:VoiceCaptureSegmentMetadata)=>void|Promise<void>;
 onSegment?:(saved:SavedSession,captureId:string)=>void|Promise<void>;
 onActive?:(captureId:string)=>void;
 onProcessingFailure?:(error:Error,captureId:string)=>void;
 /** Set when the microphone is muted or the phone takes the audio session; null when it is back. */
 onInterruption?:(state:CaptureInterruption|null)=>void;
}
export type VoiceCapturePass=ActiveCapture&{
 flush:(options?:{continue?:boolean;nextSectionId?:string|null})=>Promise<void>;
 setContinuous:(enabled:boolean)=>void;
 currentCaptureId:()=>string|null;
 pendingProcessing:()=>number;
 interruption:()=>CaptureInterruption|null;
 meterAvailable:()=>boolean;
 /** Media time of the take now recording, from its own start. */
 takeElapsed:()=>number;
};

/** Before a ceiling, roll at the first quiet stretch of this length within the lead. */
const QUIET_LEAD_MS=30_000,QUIET_MS=400,BYTE_MARGIN_MS=3000,CHECK_MS=100,BYTE_LIMIT=9*1024*1024;
interface Take {handle:ActiveCapture;section:string|null;bytes:number;retired:boolean;link?:Promise<void>}

/** Every delivered chunk is saved before publication. At a boundary the next take starts on
 * the kept stream before the old one stops, so the two overlap briefly instead of leaving a
 * gap; the old take is drained and saved in the background. If a browser refuses a second
 * recorder on one stream, the old take stops first and the gap returns for that boundary.
 * A browser crash can lose the last undelivered timeslice. Never claim lossless audio. */
export async function startVoiceCapturePass(store:AuthoringStore,saved:SavedSession,sectionId:string|null,onFailure:(error:Error)=>void,visibleCardNumber=saved.session.source.cardNumber,options:VoiceCapturePassOptions={}):Promise<VoiceCapturePass>{
 const stream=await acquireCaptureMicrophone();
 const softMs=options.maxDurationMs??19*60*1000,byteLimit=Math.min(options.maxBytes??BYTE_LIMIT,BYTE_LIMIT);
 let active:Take|null=null,nextSection=sectionId,continuous=options.continuous??false,paused=false,stopping=false,finished=false,total=0,pending=0;
 let failureReported=false,lastSaved=saved,published:Promise<void>=Promise.resolve(),continueAfterSend:boolean|undefined,quietSince:number|null=null;
 let resolve!:(value:SavedSession)=>void,reject!:(error:Error)=>void;
 const completion=new Promise<SavedSession>((yes,no)=>{resolve=yes;reject=no;});
 void completion.catch(()=>undefined);
 const awake=holdRecordingActive(),watch=watchInterruptions(stream,options.onInterruption);
 const asError=(error:unknown)=>error instanceof Error?error:new Error(String(error));
 const release=()=>{clearInterval(timer);watch.stop();awake();stream.getTracks().forEach(track=>track.stop());};
 const report=(error:unknown)=>{stopping=true;if(!failureReported){failureReported=true;onFailure(error instanceof Error?error:new Error('Recording interrupted. Received audio remains saved.'));}};
 const finish=()=>{if(finished)return;finished=true;release();resolve(lastSaved);};
 const abort=(error:unknown)=>{if(finished)return;report(error);finished=true;release();reject(asError(error));};
 const process=(result:SavedSession,id:string)=>{
  const capture=result.session.captures.find(item=>item.id===id);
  if(!capture||capture.status==='empty'||capture.durationMs<=0)return;
  pending++;
  void Promise.resolve().then(()=>options.onSegment?.(result,id)).catch(error=>options.onProcessingFailure?.(asError(error),id)).finally(()=>{pending--;});
 };
 const begin=async():Promise<Take|null>=>{
  const latest=await store.load(saved.session.id);
  if(!latest)throw new Error('The recording session could not be reopened.');
  if(stopping)return null;
  const take={section:nextSection,bytes:0,retired:false} as Take;
  // A retired take is finishing in the background: its failures are reported but never end the pass.
  take.handle=await startCapture(recordingStore(store,latest),latest,take.section,error=>take.retired?onFailure(error):report(error),visibleCardNumber,{
   stream,retainStream:true,maxDurationMs:softMs+QUIET_LEAD_MS,maxBytes:options.maxBytes,
   // The recorder's own ceiling has already stopped it: start the next take at once.
   onBoundary:()=>{if(!take.retired&&!stopping)void roll('boundary',take);},
   onChunk:(_size,bytes)=>{take.bytes=bytes;if(watch.current()&&(take.handle?.level()??0)>=REAL_INPUT_LEVEL)watch.clear();},
  });
  // A take that ends by itself (track ended, recorder error, failed save) ends the pass.
  void take.handle.completion.then(()=>{if(!take.retired)void roll('stop',take);},()=>{if(!take.retired)void roll('stop',take);});
  return take;
 };
 const roll=(reason:VoiceCaptureSegmentMetadata['reason'],take:Take):Promise<void>=>{
  if(take.retired)return take.link??published;
  take.retired=true;
  // Safety limits roll even a single continuous thought; explicit Send advances
  // only when continuous mode was enabled by the speaker. A paused pass stays paused.
  const proceed=!stopping&&(reason==='boundary'?options.rollOnBoundary!==false:(continueAfterSend??continuous));continueAfterSend=undefined;
  let handoverError:Error|undefined;
  const handover=(proceed?begin().catch(async()=>{
   // Some browsers may refuse a second recorder on one stream: stop the old one first and try once more.
   void take.handle.stop();
   return begin();
  }):Promise.resolve(null)).then(successor=>{
   void take.handle.stop();total+=take.handle.elapsed();
   if(!successor){if(active===take)active=null;return null;}
   active=successor;quietSince=null;
   if(paused)successor.handle.pause();
   if(nextSection!==successor.section)successor.handle.mark(nextSection);
   if(stopping)void roll('stop',successor);
   return successor;
  },error=>{void take.handle.stop();total+=take.handle.elapsed();if(active===take)active=null;handoverError=asError(error);return null;});
  const id=take.handle.captureId;
  const link=published.then(async()=>{
   const successor=await handover;
   try{
    const result=await take.handle.completion;
    lastSaved=(await store.load(saved.session.id))??result;
    await options.onSegmentReady?.(lastSaved,id,{reason});
    process(lastSaved,id);
   }catch(error){if(!successor)throw error;onFailure(asError(error));}
   if(successor){options.onActive?.(successor.handle.captureId);return;}
   if(handoverError)throw handoverError;
   finish();
  }).catch(abort);
  take.link=published=link;
  return link;
 };
 const timer=setInterval(()=>{
  const take=active;
  if(!take||take.retired||finished||stopping||paused||take.handle.state()!=='recording'){quietSince=null;return;}
  const elapsed=take.handle.elapsed(),rate=take.bytes/Math.max(1,elapsed);
  const left=Math.min(softMs-elapsed,rate>0?(byteLimit-take.bytes)/rate:Infinity);
  if(elapsed>=softMs||(rate>0&&(byteLimit-take.bytes)/rate<=BYTE_MARGIN_MS)){void roll('boundary',take);return;}
  if(left>QUIET_LEAD_MS||options.rollOnBoundary===false){quietSince=null;return;}
  // Near a ceiling, prefer a pause in speech. Without a meter, roll at the ceiling as before.
  const level=take.handle.level();
  if(level===null||level>=REAL_INPUT_LEVEL){quietSince=null;return;}
  quietSince??=performance.now();
  if(performance.now()-quietSince>=QUIET_MS){quietSince=null;void roll('boundary',take);}
 },CHECK_MS);
 try{active=await begin();}catch(error){release();throw error;}
 const first=active!;
 options.onActive?.(first.handle.captureId);
 return {
  captureId:first.handle.captureId,completion,
  currentCaptureId:()=>active?.handle.captureId??null,
  pendingProcessing:()=>pending,
  setContinuous:enabled=>{continuous=enabled;},
  elapsed:()=>total+(active?.handle.elapsed()??0),
  takeElapsed:()=>active?.handle.elapsed()??0,
  state:()=>finished?'inactive':paused?'paused':'recording',
  pause:()=>{paused=true;active?.handle.pause();},
  resume:()=>{paused=false;active?.handle.resume();},
  level:()=>active?.handle.level()??null,
  muted:()=>active?.handle.muted()??false,
  interruption:()=>watch.current(),
  meterAvailable:()=>active?.handle.meterAvailable?.()??false,
  mark:id=>{nextSection=id;active?.handle.mark(id);},
  flush:async(config={})=>{continueAfterSend=config.continue;if(config.nextSectionId!==undefined)nextSection=config.nextSectionId;const take=active;if(!take||take.retired||finished||stopping)return;await roll('send',take);},
  stop:()=>{stopping=true;const take=active;if(take&&!take.retired)void roll('stop',take);else if(!take&&!finished)void published.then(finish);return completion;},
 };
}
