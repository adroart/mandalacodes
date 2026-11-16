import {describe,expect,it,vi} from 'vitest';
import {checkAudioPlan,checkRowAudio,playCheckAudio,playableCaptures,type CheckAudioPlan} from '../../../components/oracle/authoring/studio/useCheckAudio';
import type {SavedSession} from '../../../lib/oracle/authoring/storage';
import type {VoiceReplayBounds} from '../../../src/mobile/authoring/voiceTargets';

const saved=(captures:{id:string;status?:string;durationMs?:number}[])=>({version:1,session:{captures:captures.map(c=>({recordedAt:'',mimeType:'audio/wav',origin:'import',status:'ready',durationMs:4000,...c}))}}) as unknown as SavedSession;
const issue={captureId:'clip-1',startMs:1000,endMs:1800,start:11,end:20};
const idle={owner:null,audioUrl:'',playing:false,started:'',failed:{}};

describe('which recordings a check can play',()=>{
 it('keeps finished and interrupted recordings with audio, and drops discarded, empty and unfinished ones',()=>{
  const ids=playableCaptures(saved([{id:'a'},{id:'b',status:'interrupted'},{id:'c',status:'recording'},{id:'d',durationMs:0},{id:'e'}]),['e']);
  expect([...ids]).toEqual(['a','b']);
  expect(playableCaptures(undefined).size).toBe(0);
 });
});

describe('what a check plays',()=>{
 it('plays the issue’s own saved bounds, with the usual context around them',()=>{
  expect(checkAudioPlan(issue,new Set(['clip-1']))).toEqual({kind:'clip',captureId:'clip-1',bounds:{captureId:'clip-1',startMs:700,endMs:2400,from:11,to:20}});
  expect(checkAudioPlan({...issue,startMs:100},null)).toMatchObject({kind:'clip',bounds:{startMs:0}});
 });
 it('never guesses timing: without a saved end, or with no issue at all, the whole recording plays from its start',()=>{
  expect(checkAudioPlan({...issue,endMs:undefined},new Set(['clip-1']))).toEqual({kind:'take',captureId:'clip-1'});
  expect(checkAudioPlan({...issue,startMs:undefined},new Set(['clip-1']))).toEqual({kind:'take',captureId:'clip-1'});
  expect(checkAudioPlan(undefined,new Set(['take-2']),[undefined,'take-1','take-2'])).toEqual({kind:'take',captureId:'take-2'});
  expect(checkAudioPlan({...issue,endMs:500},new Set(['clip-1']))).toEqual({kind:'take',captureId:'clip-1'});
 });
 it('says there is nothing to play only when it knows which recordings exist',()=>{
  expect(checkAudioPlan(issue,new Set())).toEqual({kind:'none'});
  expect(checkAudioPlan(undefined,new Set(),['take-1'])).toEqual({kind:'none'});
  expect(checkAudioPlan(undefined,null,['take-1'])).toEqual({kind:'take',captureId:'take-1'});
  expect(checkAudioPlan(undefined,null,[])).toEqual({kind:'none'});
 });
});

describe('a check row’s audio state',()=>{
 const clip:CheckAudioPlan={kind:'clip',captureId:'clip-1',bounds:{captureId:'clip-1',startMs:0,endMs:1,from:0,to:1}};
 it('offers Hear it for a clip and Listen to recording for a whole take',()=>{
  expect(checkRowAudio('a',clip,idle)).toEqual({canHear:true,playing:false});
  expect(checkRowAudio('a',{kind:'take',captureId:'x'},idle)).toEqual({canHear:false,playing:false});
 });
 it('is unavailable when nothing can play, and failed after an attempt that did not play',()=>{
  expect(checkRowAudio('a',{kind:'none'},idle)).toEqual({canHear:false,playing:false,audio:'unavailable'});
  expect(checkRowAudio('a',clip,{...idle,failed:{a:true}})).toMatchObject({audio:'failed',playing:false});
 });
 it('plays from loading until the clip pauses or ends, and only while the player still holds its clip',()=>{
  const owner={key:'a',url:'blob:1'};
  expect(checkRowAudio('a',clip,{...idle,owner,audioUrl:'blob:1'}).playing).toBe(true);
  expect(checkRowAudio('a',clip,{...idle,owner,audioUrl:'blob:1',playing:true,started:'blob:1'}).playing).toBe(true);
  expect(checkRowAudio('a',clip,{...idle,owner,audioUrl:'blob:1',started:'blob:1'}).playing).toBe(false);
  // Another check, Listen or a recording took the player over.
  expect(checkRowAudio('a',clip,{...idle,owner,audioUrl:'blob:2',playing:true,started:'blob:2'}).playing).toBe(false);
  expect(checkRowAudio('b',clip,{...idle,owner,audioUrl:'blob:1',playing:true}).playing).toBe(false);
  expect(checkRowAudio('a',clip,{...idle,owner,audioUrl:''}).playing).toBe(false);
 });
});

describe('playing a check',()=>{
 const deps=(over:Partial<Parameters<typeof playCheckAudio>[1]>={})=>({load:vi.fn(async()=>saved([{id:'clip-1'}])),captureSessionId:'s',discarded:[],playCapture:vi.fn(async()=>undefined),clipBounds:{current:null as VoiceReplayBounds|null},clearReplay:vi.fn(),...over});
 it('sets the clip’s bounds and starts at them, leaving word replay',async()=>{
  const d=deps(),plan=checkAudioPlan(issue,new Set(['clip-1']));
  expect(await playCheckAudio(plan,d)).toBe('started');
  expect(d.clearReplay).toHaveBeenCalled();expect(d.clipBounds.current).toEqual(plan.kind==='clip'&&plan.bounds);expect(d.playCapture).toHaveBeenCalledWith('clip-1',700);
 });
 it('plays a whole recording from its start with no bounds',async()=>{
  const d=deps({clipBounds:{current:{captureId:'old',startMs:1,endMs:2,from:0,to:1}}});
  expect(await playCheckAudio({kind:'take',captureId:'clip-1'},d)).toBe('started');
  expect(d.clipBounds.current).toBeNull();expect(d.playCapture).toHaveBeenCalledWith('clip-1',0);
 });
 it('tells a recording that is gone from one that could not be read',async()=>{
  const fail=vi.fn(async()=>{throw Error('No durable audio was received for this recording');});
  expect(await playCheckAudio({kind:'take',captureId:'clip-1'},deps({playCapture:fail}))).toBe('failed');
  const gone=deps({playCapture:fail,load:vi.fn(async()=>undefined)});
  expect(await playCheckAudio(checkAudioPlan(issue,null),gone)).toBe('unavailable');expect(gone.clipBounds.current).toBeNull();
  expect(await playCheckAudio({kind:'none'},deps())).toBe('unavailable');
  expect(await playCheckAudio({kind:'take',captureId:'clip-1'},deps({captureSessionId:undefined}))).toBe('unavailable');
 });
});
