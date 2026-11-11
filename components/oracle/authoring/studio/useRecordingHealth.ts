import {useEffect,useRef,useState} from 'react';
import {Capacitor} from '../../../../mobile/node_modules/@capacitor/core';
import type {CaptureInterruption} from '../../../../lib/oracle/authoring/recorder';
import {forgetHostedReadiness,hostedReadiness,type HostedReadiness,type HostedReadinessState} from '../../../../src/mobile/authoring/processing';
import type {VoiceRoutingStatus} from '../../../../src/mobile/authoring/voiceCaptureRouting';

/**
 * What the dock and the status band say about the microphone and about preparing words:
 * a microphone gone quiet, a changed input, a level meter that cannot read, whether spoken
 * section names are heard, and whether recordings can be prepared right now. Plain, neutral
 * words; red stays for a live microphone. Nothing here ever blocks or delays a recording.
 */

export const HEALTH_COPY={
 interrupted:'Microphone interrupted. What you said so far is saved.',
 changed:'Microphone changed.',
 back:'Microphone back. Recording.',
 meter:'Level meter unavailable',
 listening:'Listening for section names',
 notListening:'Not listening for section names',
} as const;

export const READINESS_COPY:Record<Exclude<HostedReadinessState,'ready'|'signed_out'>,string>={
 not_allowed:'This account cannot prepare recordings. You can still record; everything is saved on this phone.',
 not_set_up:'Preparing words is not set up yet. You can still record; everything is saved on this phone.',
 unreachable:'No connection. You can still record; your words will be prepared when you are back online.',
};

/** How long "Microphone changed." stays before it clears itself. */
export const ROUTE_NOTICE_MS=4000;
/** A meter that has not come up after this long is said to be unavailable, not shown as silence. */
export const METER_GRACE_MS=1200;

export type MicrophoneHealth='interrupted'|'changed'|null;

/** Muted or interrupted means the take is saving silence; a changed input is said briefly and clears itself. */
export function microphoneHealth(state:CaptureInterruption|null,now:number):MicrophoneHealth{
 if(!state)return null;
 if(state.kind==='muted'||state.kind==='interrupted')return 'interrupted';
 return now-state.since<ROUTE_NOTICE_MS?'changed':null;
}

/** What the live region says when the microphone's state changes: once per change, nothing for an unchanged state. */
export function announcementFor(before:MicrophoneHealth,after:MicrophoneHealth):string|null{
 if(before===after)return null;
 if(after==='interrupted')return HEALTH_COPY.interrupted;
 if(after==='changed')return HEALTH_COPY.changed;
 return before==='interrupted'?HEALTH_COPY.back:null;
}

/** The quiet line about spoken section names, or null where names are not used (a phrase re-record). */
export function listeningLine(status:VoiceRoutingStatus,applies:boolean):string|null{
 if(!applies)return null;
 return status==='listening'?HEALTH_COPY.listening:HEALTH_COPY.notListening;
}

/** The status band line for a readiness answer. Sign-in uses the existing sign-in band, so it has no line here. */
export function readinessLine(value:HostedReadiness|null|undefined):string|null{
 if(!value||value.state==='ready'||value.state==='signed_out')return null;
 // On the phone a paired Mac still prepares words when the server is not set up.
 if(value.state==='not_set_up'&&value.macFallback)return null;
 return READINESS_COPY[value.state];
}

/** On localhost development the Mac's own service prepares words, so a missing hosted service is no warning. Mirrors processing.ts. */
export function isLocalDevelopment(native=nativePlatform(),hostname=typeof location==='undefined'?'':location.hostname){
 return !native&&['localhost','127.0.0.1','[::1]'].includes(hostname);
}
function nativePlatform(){try{return Capacitor.isNativePlatform();}catch{return false;}}

/**
 * Asks once when the workspace opens and again on a later sign-in, coming back online or a
 * finished recording. A successful preparation proves readiness. Never waits on anything.
 */
export function createReadinessTracker(options:{onChange:(value:HostedReadiness|null)=>void;ask?:typeof hostedReadiness;forget?:()=>void;local?:boolean}){
 const ask=options.ask??hostedReadiness,forget=options.forget??forgetHostedReadiness;
 let value:HostedReadiness|null=null,disposed=false,request=0;
 const set=(next:HostedReadiness|null)=>{if(disposed)return;value=next;options.onChange(next);};
 const check=(force=false)=>{
  if(options.local||disposed)return Promise.resolve(value);
  const mine=++request;
  return ask(force?{force:true}:{}).then(answer=>{if(mine===request)set(answer);return answer;},()=>value);
 };
 return{
  current:()=>value,
  check,
  /** Words were prepared, so the service is there whatever the last answer said. */
  prepared:()=>{request++;if(value&&value.state!=='ready')set({state:'ready',checkedAt:Date.now()});},
  signedIn:()=>{forget();return check(true);},
  dispose:()=>{disposed=true;},
 };
}

type Pass={interruption?:()=>CaptureInterruption|null;meterAvailable?:()=>boolean;state:()=>string};

export interface RecordingHealthInput{
 active:Pass|null;
 paused:boolean;
 /** Whether spoken names apply to this recording (not a phrase re-record), and the recogniser's state. */
 namesApply:boolean;
 routingStatus:VoiceRoutingStatus;
 signedIn:boolean;
 /** Changes when the session changes; the count below is compared within one session only. */
 preparedKey?:string;
 /** Sections with prepared words in this session. */
 prepared:number;
}

export function useRecordingHealth({active,paused,namesApply,routingStatus,signedIn,preparedKey,prepared}:RecordingHealthInput){
 const [interruption,setInterruption]=useState<CaptureInterruption|null>(null);
 const [now,setNow]=useState(()=>Date.now());
 const [meterUnavailable,setMeterUnavailable]=useState(false);
 const [announcement,setAnnouncement]=useState('');
 const [readiness,setReadiness]=useState<HostedReadiness|null>(null);
 const tracker=useRef<ReturnType<typeof createReadinessTracker>|null>(null);
 const onInterruption=(state:CaptureInterruption|null)=>setInterruption(state);

 // The capture pass reports by callback; polling also catches a state that changed before the callback was wired.
 useEffect(()=>{
  setInterruption(null);setMeterUnavailable(false);
  if(!active)return;
  const started=Date.now();let missingSince:number|null=null;
  const tick=()=>{
   const at=Date.now();setNow(at);
   const state=active.interruption?.()??null;
   setInterruption(previous=>previous?.kind===state?.kind&&previous?.since===state?.since?previous:state);
   const available=active.meterAvailable?active.meterAvailable():true;
   if(available)missingSince=null;else missingSince??=at;
   setMeterUnavailable(missingSince!==null&&at-Math.max(missingSince,started)>=METER_GRACE_MS);
  };
  tick();
  const timer=setInterval(tick,250);
  return ()=>clearInterval(timer);
 },[active]);

 const microphone=active&&!paused?microphoneHealth(interruption,now):null;

 // Each change is announced once through the dock's polite live region.
 const previous=useRef<MicrophoneHealth>(null);
 useEffect(()=>{
  const before=previous.current;previous.current=microphone;
  if(!active){setAnnouncement('');return;}
  const message=announcementFor(before,microphone);
  if(message)setAnnouncement(message);
 },[microphone,active]);
 useEffect(()=>{if(active&&meterUnavailable)setAnnouncement(HEALTH_COPY.meter);},[meterUnavailable]);

 // Readiness: asked once on open, never blocking a recording.
 useEffect(()=>{
  const local=isLocalDevelopment();
  const t=createReadinessTracker({onChange:setReadiness,local});tracker.current=t;
  void t.check();
  const online=()=>void t.check(true);
  window.addEventListener('online',online);
  return ()=>{t.dispose();window.removeEventListener('online',online);if(tracker.current===t)tracker.current=null;};
 },[]);
 const wasSignedIn=useRef(signedIn);
 useEffect(()=>{if(signedIn&&!wasSignedIn.current)void tracker.current?.signedIn();wasSignedIn.current=signedIn;},[signedIn]);
 const baseline=useRef({key:preparedKey,count:prepared});
 useEffect(()=>{
  if(baseline.current.key!==preparedKey){baseline.current={key:preparedKey,count:prepared};return;}
  if(prepared>baseline.current.count)tracker.current?.prepared();
  baseline.current.count=prepared;
 },[preparedKey,prepared]);
 // A finished recording is a natural moment to ask again; the answer is kept for a few minutes.
 const hadActive=useRef(false);
 useEffect(()=>{if(hadActive.current&&!active)void tracker.current?.check();hadActive.current=!!active;},[active]);

 return{
  onInterruption,
  microphone,
  meterUnavailable:!!active&&meterUnavailable,
  listening:active?listeningLine(routingStatus,namesApply):null,
  announcement,
  readiness:readiness?.state&&readiness.state!=='ready'?readiness.state:null,
  readinessLine:readinessLine(readiness),
  /** After a sign-in: forget the kept answer and ask again. */
  signedIn:()=>void tracker.current?.signedIn(),
 };
}
export type RecordingHealth=ReturnType<typeof useRecordingHealth>;
