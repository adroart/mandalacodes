import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import type {SavedSession} from '../../../../lib/oracle/authoring/storage';
import type {VoiceReplayBounds} from '../../../../src/mobile/authoring/voiceTargets';

/** The saved audio facts of one word check: the review issue's real timing, when it has one. */
export interface CheckAudioIssue {captureId?:string;startMs?:number;endMs?:number;start:number;end:number}
export interface CheckAudioTarget {key:string;issue?:CheckAudioIssue}
/**
 * What a check can play. `clip`: the issue's own saved bounds. `take`: no exact timing, so the whole saved
 * recording from its start. `none`: nothing on this device can be played.
 */
export type CheckAudioPlan=
 {kind:'clip';captureId:string;bounds:VoiceReplayBounds}|
 {kind:'take';captureId:string}|
 {kind:'none'};
/** The row's audio state, in the shape `CheckedEditableText` reads. */
export interface CheckRowAudio {canHear:boolean;playing:boolean;audio?:'unavailable'|'failed'}

/** Context around the word, as the review screen has always played it; the word's own timing is never moved. */
const BEFORE_MS=300,AFTER_MS=600;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);

/**
 * Captures that can be played: finished or interrupted, with audio, and not discarded.
 * `null` means unknown (nothing loaded yet), which never hides an action.
 */
export function playableCaptures(saved:SavedSession|undefined|null,discarded:Iterable<string>=[]):Set<string>{
 const gone=new Set(discarded);
 return new Set((saved?.session.captures??[]).filter(capture=>['ready','interrupted'].includes(capture.status)&&capture.durationMs>0&&!gone.has(capture.id)).map(capture=>capture.id));
}

/**
 * Which audio a check plays. A clip needs the issue's saved start and end on a playable recording; without them the
 * whole saved recording plays from its start. Timing is never guessed.
 */
export function checkAudioPlan(issue:CheckAudioIssue|undefined,playable:Set<string>|null,fallbackCaptureIds:(string|undefined)[]=[]):CheckAudioPlan{
 const can=(id:string|undefined):id is string=>!!id&&(playable===null||playable.has(id));
 if(issue&&can(issue.captureId)&&finite(issue.startMs)&&finite(issue.endMs)&&issue.startMs>=0&&issue.endMs>=issue.startMs)
  return {kind:'clip',captureId:issue.captureId,bounds:{captureId:issue.captureId,startMs:Math.max(0,issue.startMs-BEFORE_MS),endMs:issue.endMs+AFTER_MS,from:issue.start,to:issue.end}};
 const take=[issue?.captureId,...fallbackCaptureIds].find(can);
 return take?{kind:'take',captureId:take}:{kind:'none'};
}

/** The clip currently loaded in the player on behalf of one check. */
export interface CheckClipOwner {key:string;url:string}
/**
 * One row's state. `playing` holds from the moment its clip is loaded until it pauses or ends, and only while the
 * player still holds that clip: any other playback (another check, Listen, a recording) takes it over.
 */
export function checkRowAudio(key:string,plan:CheckAudioPlan,state:{owner:CheckClipOwner|null;audioUrl:string;playing:boolean;started:string;failed:Record<string,true>}):CheckRowAudio{
 if(plan.kind==='none')return {canHear:false,playing:false,audio:'unavailable'};
 const owned=!!state.audioUrl&&state.owner?.key===key&&state.owner.url===state.audioUrl;
 if(state.failed[key])return {canHear:plan.kind==='clip',playing:false,audio:'failed'};
 return {canHear:plan.kind==='clip',playing:owned&&(state.playing||state.started!==state.audioUrl)};
}

export interface CheckAudioDeps {
 /** Reads the saved recording session; used to tell a missing recording from one that would not play. */
 load:(sessionId:string)=>Promise<SavedSession|undefined|null>;
 captureSessionId?:string;
 discarded:Iterable<string>;
 playCapture:(captureId:string,startMs?:number)=>Promise<void>;
 clipBounds:MutableRefObject<VoiceReplayBounds|null>;
 clearReplay:()=>void;
}
/**
 * Plays one check's audio through the studio's single player. Resolves to what happened: `started`, `unavailable`
 * (no playable recording after all) or `failed` (the recording exists but could not be read).
 */
export async function playCheckAudio(plan:CheckAudioPlan,deps:CheckAudioDeps):Promise<'started'|'unavailable'|'failed'>{
 if(plan.kind==='none'||!deps.captureSessionId)return 'unavailable';
 deps.clearReplay();
 deps.clipBounds.current=plan.kind==='clip'?plan.bounds:null;
 try{
  await deps.playCapture(plan.captureId,plan.kind==='clip'?plan.bounds.startMs:0);
  return 'started';
 }catch{
  if(deps.clipBounds.current===(plan.kind==='clip'?plan.bounds:null))deps.clipBounds.current=null;
  const saved=await deps.load(deps.captureSessionId).catch(()=>undefined);
  return saved&&playableCaptures(saved,deps.discarded).has(plan.captureId)?'failed':'unavailable';
 }
}

interface Options extends CheckAudioDeps {
 audioUrl:string;playing:boolean;
 /** Changes whenever the saved session may have changed, so playability is read again. */
 version?:number;
 fallbackCaptureIds:(string|undefined)[];
 stopListening:()=>void;
}
/**
 * The audio of the review screen's word checks: which check's clip is playing, which recordings can be played,
 * and which attempt failed. All playback goes through the studio's one player, so starting anything else stops a clip.
 */
export function useCheckAudio(options:Options){
 const {audioUrl,playing,captureSessionId,version}=options;
 const latest=useRef(options);latest.current=options;
 const discardedKey=[...options.discarded].join('|');
 const [playable,setPlayable]=useState<{sessionId?:string;ids:Set<string>}|null>(null);
 const [failed,setFailed]=useState<Record<string,true>>({});
 const [owner,setOwner]=useState<CheckClipOwner|null>(null);
 const [started,setStarted]=useState('');
 const pending=useRef<string|null>(null);
 // Read which recordings exist whenever the session changes; until then nothing is hidden.
 useEffect(()=>{
  let alive=true;
  if(!captureSessionId){setPlayable({ids:new Set()});return;}
  void latest.current.load(captureSessionId).then(saved=>{if(alive)setPlayable({sessionId:captureSessionId,ids:playableCaptures(saved,latest.current.discarded)});}).catch(()=>{if(alive)setPlayable(null);});
  return ()=>{alive=false;};
 },[captureSessionId,version,discardedKey]);
 // The next clip the player loads belongs to the check that asked for it; anything else loaded is not a check's.
 useEffect(()=>{
  if(audioUrl&&pending.current){setOwner({key:pending.current,url:audioUrl});pending.current=null;}
 },[audioUrl]);
 useEffect(()=>{if(playing&&audioUrl)setStarted(audioUrl);},[playing,audioUrl]);
 const known=playable&&playable.sessionId===captureSessionId?playable.ids:captureSessionId?null:new Set<string>();
 const planFor=(target:CheckAudioTarget)=>checkAudioPlan(target.issue,known,latest.current.fallbackCaptureIds);
 const stateFor=(target:CheckAudioTarget):CheckRowAudio=>checkRowAudio(target.key,planFor(target),{owner,audioUrl,playing,started,failed});
 const hearCheck=async(target:CheckAudioTarget)=>{
  const plan=planFor(target);
  setFailed(value=>{if(!value[target.key])return value;const next={...value};delete next[target.key];return next;});
  pending.current=target.key;
  const outcome=await playCheckAudio(plan,latest.current);
  if(outcome==='started')return;
  if(pending.current===target.key)pending.current=null;
  if(outcome==='failed')setFailed(value=>({...value,[target.key]:true}));
  else if(captureSessionId){
   const saved=await latest.current.load(captureSessionId).catch(()=>undefined);
   setPlayable({sessionId:captureSessionId,ids:playableCaptures(saved,latest.current.discarded)});
  }
 };
 const stopCheck=(key:string)=>{if(owner?.key===key&&owner.url===audioUrl)latest.current.stopListening();};
 /** The player could not load or start what it was given: if that was a check's clip, say so on its row. */
 const playbackFailed=(url:string):boolean=>{
  const key=owner?.url===url?owner.key:pending.current&&url===latest.current.audioUrl?pending.current:null;
  if(!url||!key)return false;
  if(pending.current===key)pending.current=null;
  setFailed(value=>({...value,[key]:true}));return true;
 };
 return {stateFor,hearCheck,stopCheck,playbackFailed};
}
export type CheckAudio=ReturnType<typeof useCheckAudio>;
