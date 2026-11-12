import {afterEach,describe,expect,it,vi} from 'vitest';

const native=vi.hoisted(()=>({value:false}));
vi.mock('../../../mobile/node_modules/@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>native.value}}));
vi.mock('../../../src/mobile/account/nativeAccountTransport',()=>({createNativeAccountFetch:()=>vi.fn()}));
vi.mock('../../../src/mobile/authoring/bridgeConnection',()=>({loadMacBridge:()=>null,requestMacBridge:vi.fn()}));

import {HEALTH_COPY,READINESS_COPY,ROUTE_NOTICE_MS,announcementFor,createReadinessTracker,isLocalDevelopment,listeningLine,microphoneHealth,readinessLine} from '../../../components/oracle/authoring/studio/useRecordingHealth';
import {startVoiceRouting,voiceRoutingDefault} from '../../../src/mobile/authoring/voiceCaptureRouting';
import type {HostedReadiness} from '../../../src/mobile/authoring/processing';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();native.value=false;});
const answer=(state:HostedReadiness['state'],extra:Partial<HostedReadiness>={}):HostedReadiness=>({state,checkedAt:0,...extra});

describe('the microphone, said plainly',()=>{
 it('calls a muted or interrupted microphone interrupted, and a changed input changed only briefly',()=>{
  expect(microphoneHealth(null,1000)).toBeNull();
  expect(microphoneHealth({kind:'muted',since:0},60_000)).toBe('interrupted');
  expect(microphoneHealth({kind:'interrupted',since:0},60_000)).toBe('interrupted');
  expect(microphoneHealth({kind:'route-changed',since:1000},1000+ROUTE_NOTICE_MS-1)).toBe('changed');
  expect(microphoneHealth({kind:'route-changed',since:1000},1000+ROUTE_NOTICE_MS)).toBeNull();
 });
 it('announces each change once, and the return only after an interruption',()=>{
  expect(announcementFor(null,'interrupted')).toBe(HEALTH_COPY.interrupted);
  expect(announcementFor('interrupted','interrupted')).toBeNull();
  expect(announcementFor('interrupted',null)).toBe(HEALTH_COPY.back);
  expect(announcementFor(null,'changed')).toBe(HEALTH_COPY.changed);
  expect(announcementFor('changed',null)).toBeNull();
 });
 it('uses no em dash in anything it says',()=>{
  for(const text of [...Object.values(HEALTH_COPY),...Object.values(READINESS_COPY)])expect(text).not.toContain(String.fromCharCode(0x2014));
 });
});

describe('section names',()=>{
 it('says whether saying a name will do anything, and nothing while re-recording a phrase',()=>{
  expect(listeningLine('listening',true)).toBe('Listening for section names');
  for(const status of ['stopped','unsupported','denied','unavailable'] as const)expect(listeningLine(status,true)).toBe('Not listening for section names');
  expect(listeningLine('listening',false)).toBeNull();
 });
 it('is off by default in the installed app and without recognition, and a saved choice wins',()=>{
  vi.stubGlobal('window',{SpeechRecognition:class{}});
  expect(voiceRoutingDefault(null,false)).toBe(true);
  expect(voiceRoutingDefault(null,true)).toBe(false);
  expect(voiceRoutingDefault('true',true)).toBe(true);
  expect(voiceRoutingDefault('false',false)).toBe(false);
  vi.stubGlobal('window',{});
  expect(voiceRoutingDefault(null,false)).toBe(false);
 });
 it('starts the recogniser again after it ends, waits longer each time, and stops after repeated quick failures',()=>{
  vi.useFakeTimers();const made:any[]=[];
  class Recognition{onresult:any;onerror:any;onend:any;start=vi.fn();stop=vi.fn();constructor(){made.push(this);}}
  vi.stubGlobal('window',{SpeechRecognition:Recognition});const onStatus=vi.fn();
  startVoiceRouting({sections:[],currentSectionId:()=>null,elapsed:()=>0,onRoute:vi.fn(),onStatus,restartMs:[100,200],failureLimit:3});
  expect(onStatus).toHaveBeenLastCalledWith('listening');expect(made).toHaveLength(1);
  made[0].onend();vi.advanceTimersByTime(99);expect(made).toHaveLength(1);vi.advanceTimersByTime(1);expect(made).toHaveLength(2);expect(made[1].start).toHaveBeenCalled();
  made[1].onerror({error:'network'});made[1].onend();vi.advanceTimersByTime(199);expect(made).toHaveLength(2);vi.advanceTimersByTime(1);expect(made).toHaveLength(3);
  made[2].onend();expect(onStatus).toHaveBeenLastCalledWith('unavailable');vi.advanceTimersByTime(10_000);expect(made).toHaveLength(3);
 });
 it('a heard result resets the count, a refusal stops at once, and stop() ends restarts',()=>{
  vi.useFakeTimers();const made:any[]=[];
  class Recognition{onresult:any;onerror:any;onend:any;start=vi.fn();stop=vi.fn();constructor(){made.push(this);}}
  vi.stubGlobal('window',{SpeechRecognition:Recognition});const onStatus=vi.fn();
  const control=startVoiceRouting({sections:[],currentSectionId:()=>null,elapsed:()=>0,onRoute:vi.fn(),onStatus,restartMs:[50],failureLimit:3});
  made[0].onend();vi.advanceTimersByTime(50);made[1].onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'hello'}}]});made[1].onend();vi.advanceTimersByTime(50);
  expect(made).toHaveLength(3);expect(onStatus).toHaveBeenLastCalledWith('listening');
  made[2].onend();control.stop();vi.advanceTimersByTime(1000);expect(made).toHaveLength(3);expect(onStatus).toHaveBeenLastCalledWith('stopped');
  const second=startVoiceRouting({sections:[],currentSectionId:()=>null,elapsed:()=>0,onRoute:vi.fn(),onStatus,restartMs:[50]});
  made[3].onerror({error:'not-allowed'});expect(onStatus).toHaveBeenLastCalledWith('denied');made[3].onend?.();vi.advanceTimersByTime(1000);expect(made).toHaveLength(4);second.stop();
 });
});

describe('readiness before the first recording',()=>{
 it('has a plain line for each problem, ending with what is true about the recordings',()=>{
  expect(readinessLine(answer('ready'))).toBeNull();
  expect(readinessLine(answer('signed_out'))).toBeNull();
  expect(readinessLine(answer('not_allowed'))).toBe('This account cannot prepare recordings. You can still record; everything is saved on this phone.');
  expect(readinessLine(answer('not_set_up'))).toBe('Preparing words is not set up yet. You can still record; everything is saved on this phone.');
  expect(readinessLine(answer('unreachable'))).toBe('No connection. You can still record; your words will be prepared when you are back online.');
  expect(readinessLine(answer('not_set_up',{macFallback:true}))).toBeNull();
 });
 it('treats localhost development as the Mac path, never the installed app',()=>{
  expect(isLocalDevelopment(false,'localhost')).toBe(true);
  expect(isLocalDevelopment(false,'127.0.0.1')).toBe(true);
  expect(isLocalDevelopment(true,'localhost')).toBe(false);
  expect(isLocalDevelopment(false,'mandalacodes.com')).toBe(false);
 });
 it('asks, clears on a successful preparation, and asks again after sign-in having forgotten the kept answer',async()=>{
  const ask=vi.fn().mockResolvedValueOnce(answer('unreachable')).mockResolvedValueOnce(answer('ready')),forget=vi.fn(),seen:(HostedReadiness|null)[]=[];
  const tracker=createReadinessTracker({onChange:value=>seen.push(value),ask,forget});
  await tracker.check();expect(tracker.current()?.state).toBe('unreachable');
  tracker.prepared();expect(tracker.current()?.state).toBe('ready');
  await tracker.signedIn();expect(forget).toHaveBeenCalledOnce();expect(ask).toHaveBeenLastCalledWith({force:true});
  expect(seen.map(v=>v?.state)).toEqual(['unreachable','ready','ready']);
 });
 it('ignores an answer that arrives after a successful preparation, and never asks on the Mac path',async()=>{
  let resolve!:(value:HostedReadiness)=>void;
  const ask=vi.fn(()=>new Promise<HostedReadiness>(r=>{resolve=r;}));
  const tracker=createReadinessTracker({onChange:()=>undefined,ask});
  const pending=tracker.check();tracker.prepared();resolve(answer('unreachable'));await pending;
  expect(tracker.current()).toBeNull();
  const local=createReadinessTracker({onChange:()=>undefined,ask:vi.fn(),local:true});await local.check();expect(local.current()).toBeNull();
 });
 it('keeps the last answer when asking fails and says nothing after disposal',async()=>{
  const onChange=vi.fn(),tracker=createReadinessTracker({onChange,ask:vi.fn().mockRejectedValue(new Error('x'))});
  await tracker.check();expect(onChange).not.toHaveBeenCalled();
  const later=createReadinessTracker({onChange,ask:vi.fn().mockResolvedValue(answer('not_allowed'))});const asked=later.check();later.dispose();await asked;expect(onChange).not.toHaveBeenCalled();
 });
});
