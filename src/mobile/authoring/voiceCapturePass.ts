import {acquireCaptureMicrophone,startCapture,type ActiveCapture} from '../../../lib/oracle/authoring/recorder';
import type {AuthoringStore,SavedSession} from '../../../lib/oracle/authoring/storage';
import {recordingStore} from './continuousCapture';

export interface VoiceCaptureSegmentMetadata {reason:'boundary'|'send'|'stop'}
export interface VoiceCapturePassOptions {
 continuous?:boolean;rollOnBoundary?:boolean;
 maxDurationMs?:number;
 maxBytes?:number;
 /** Starts asynchronous work after durable finalization; it never delays the next take. */
 onSegmentReady?:(saved:SavedSession,captureId:string,metadata:VoiceCaptureSegmentMetadata)=>void|Promise<void>;
 onSegment?:(saved:SavedSession,captureId:string)=>void|Promise<void>;
 onActive?:(captureId:string)=>void;
 onProcessingFailure?:(error:Error,captureId:string)=>void;
}
export type VoiceCapturePass=ActiveCapture&{
 flush:(options?:{continue?:boolean;nextSectionId?:string|null})=>Promise<void>;
 setContinuous:(enabled:boolean)=>void;
 currentCaptureId:()=>string|null;
 pendingProcessing:()=>number;
};

/** Every delivered chunk is saved before publication. Rollover retains microphone
 * permission and the stream, but MediaRecorder restart can leave a brief audio gap.
 * A browser crash can lose the last undelivered timeslice. Never claim lossless audio. */
export async function startVoiceCapturePass(store:AuthoringStore,saved:SavedSession,sectionId:string|null,onFailure:(error:Error)=>void,visibleCardNumber=saved.session.source.cardNumber,options:VoiceCapturePassOptions={}):Promise<VoiceCapturePass>{
 const stream=await acquireCaptureMicrophone();
 let current:ActiveCapture|null=null,nextSection=sectionId,continuous=options.continuous??false,paused=false,stopping=false,finished=false,total=0,pending=0;
 let failureReported=false,stopReason:VoiceCaptureSegmentMetadata['reason']='stop';
 let lastSaved=saved,transition:Promise<void>=Promise.resolve(),boundary=false,continueAfterSend:boolean|undefined;
 let resolve!:(value:SavedSession)=>void,reject!:(error:Error)=>void;
 const completion=new Promise<SavedSession>((yes,no)=>{resolve=yes;reject=no;});
 void completion.catch(()=>undefined);
 const release=()=>stream.getTracks().forEach(track=>track.stop());
 const report=(error:unknown)=>{stopping=true;if(!failureReported){failureReported=true;onFailure(error instanceof Error?error:new Error('Recording interrupted. Received audio remains saved.'));}};
 const finish=()=>{if(finished)return;finished=true;release();resolve(lastSaved);};
 const abort=(error:unknown)=>{if(finished)return;report(error);finished=true;release();reject(error instanceof Error?error:new Error(String(error)));};
 const process=(result:SavedSession,id:string)=>{
  const capture=result.session.captures.find(item=>item.id===id);
  if(!capture||capture.status==='empty'||capture.durationMs<=0)return;
  pending++;
  void Promise.resolve().then(()=>options.onSegment?.(result,id)).catch(error=>options.onProcessingFailure?.(error instanceof Error?error:new Error(String(error)),id)).finally(()=>{pending--;});
 };
 const open=async():Promise<void>=>{
  if(stopping){finish();return;}
  const latest=await store.load(saved.session.id);
  if(!latest)throw new Error('The recording session could not be reopened.');
  if(stopping){finish();return;}
  boundary=false;stopReason='stop';
  const handle=await startCapture(recordingStore(store,latest),latest,nextSection,report,visibleCardNumber,{
   stream,retainStream:true,maxDurationMs:options.maxDurationMs??19*60*1000,maxBytes:options.maxBytes,
   onBoundary:()=>{if(stopping||stopReason==='send')return;boundary=true;stopReason='boundary';},
  });
  current=handle;
  if(paused)handle.pause();
  options.onActive?.(handle.captureId);
  transition=handle.completion.then(async result=>{
   total+=handle.elapsed();current=null;lastSaved=(await store.load(saved.session.id))??result;
   await options.onSegmentReady?.(lastSaved,handle.captureId,{reason:stopReason});
   process(lastSaved,handle.captureId);
   // Safety limits roll even a single continuous thought; explicit Send advances
   // only when continuous mode was enabled by the speaker.
   const shouldContinue=stopReason==='boundary'?(!paused&&options.rollOnBoundary!==false):(continueAfterSend??continuous);continueAfterSend=undefined;
   if(stopping||!shouldContinue){finish();return;}
   await open();
  });
  void transition.catch(abort);
  if(stopping)void handle.stop().catch(abort);
 };
 try{await open();}catch(error){release();throw error;}
 const captureId=current!.captureId;
 return {
  captureId,completion,
  currentCaptureId:()=>current?.captureId??null,
  pendingProcessing:()=>pending,
  setContinuous:enabled=>{continuous=enabled;},
  elapsed:()=>total+(current?.elapsed()??0),
  state:()=>finished?'inactive':paused?'paused':'recording',
  pause:()=>{paused=true;current?.pause();},
  resume:()=>{paused=false;current?.resume();},
  level:()=>current?.level()??null,
  muted:()=>current?.muted()??false,
  mark:id=>{nextSection=id;current?.mark(id);},
  flush:async(config={})=>{continueAfterSend=config.continue;if(config.nextSectionId!==undefined)nextSection=config.nextSectionId;const handle=current;if(!handle||finished||stopping)return;stopReason='send';const published=transition;await handle.stop();await published;},
  stop:()=>{stopping=true;if(current)stopReason='stop';if(current)void current.stop().catch(abort);else if(!finished)void transition.then(finish,abort);return completion;},
 };
}
