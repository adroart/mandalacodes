import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const comparison=vi.hoisted(()=>({fail:false}));
vi.mock('../../../functions/api/_lib/auth.ts',()=>({requireAdmin:vi.fn(async()=>({userId:'owner'}))}));
vi.mock('../../../functions/api/_lib/transcriptDoubts',async importOriginal=>{
 const real=await importOriginal<typeof import('../../../functions/api/_lib/transcriptDoubts')>();
 return {...real,compareTranscripts:(...args:Parameters<typeof real.compareTranscripts>)=>{if(comparison.fail)throw new RangeError('Array buffer allocation failed');return real.compareTranscripts(...args);}};
});
import {requireAdmin} from '../../../functions/api/_lib/auth.ts';
import {onRequestPost} from '../../../functions/api/oracle/authoring/process';
import {decodeAudio,type AuthoringEnv} from '../../../functions/api/oracle/authoring/_shared';
import {bytesToBase64,workersAiTranscription} from '../../../functions/api/_lib/quickTranscription';

const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const timed=(text:string,duration=2)=>{const tokens=text.split(' '),step=duration/tokens.length;return {text,duration,segments:[{start:0,end:duration,text}],words:tokens.map((word,k)=>({word,start:k*step,end:(k+1)*step}))};};
const call=(env:Partial<AuthoringEnv>={},extra:Record<string,unknown>={})=>onRequestPost({request:new Request('https://mandalacodes.com/api/oracle/authoring/process',{method:'POST',headers:{Origin:'capacitor://localhost'},body:JSON.stringify({operation:'transcribe',mimeType:'audio/mp4',durationMs:2000,audioBase64:'AQID',...extra})}),env:{GROQ_API_KEY:'fixture-key',...env} as AuthoringEnv});
const isSecond=(init:RequestInit)=>(init.body as FormData).get('model')==='whisper-large-v3';
/** A provider that never answers on its own: it settles only when its signal aborts, with the signal's reason. */
const hang=(init:RequestInit)=>new Promise<Response>((_,reject)=>{const signal=init.signal!;if(signal.aborted)reject(signal.reason);signal.addEventListener('abort',()=>reject(signal.reason));});
const turns=async(count=20)=>{for(let k=0;k<count;k+=1)await new Promise(resolve=>setImmediate(resolve));};
const bytesOf=(length:number,seed=length)=>Uint8Array.from({length},(_,k)=>(k*31+seed*7)&255);

beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAdmin).mockResolvedValue({userId:'owner'} as never);comparison.fail=false;});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('decoding the take without full-size intermediates',()=>{
 it('decodes every size around the piece boundaries, padded and unpadded, exactly as Node does',()=>{
  for(const chunk of [4,8,12,64*1024])for(const length of [1,2,3,4,5,6,7,8,9,10,11,12,13,47,48,49,49151,49152,49153,98304,98305]){
   if(chunk<64*1024&&length>200)continue;
   const bytes=bytesOf(length),padded=Buffer.from(bytes).toString('base64');
   expect(Array.from(decodeAudio(padded,chunk))).toEqual(Array.from(bytes));
   expect(Array.from(decodeAudio(padded.replace(/=+$/,''),chunk))).toEqual(Array.from(bytes));
  }
 });
 it('refuses malformed base64 and refuses an oversized take from its length alone',()=>{
  for(const bad of ['A','AQ=','AQ===','AQ=D','****',''])expect(()=>decodeAudio(bad,8)).toThrow();
  const started=Date.now();expect(()=>decodeAudio('A'.repeat(4*Math.ceil((10*1024*1024+3)/3)))).toThrow('audio_too_large');expect(Date.now()-started).toBeLessThan(1000);
  expect(decodeAudio('A'.repeat(4*Math.floor(10*1024*1024/3))).length).toBe(3*Math.floor(10*1024*1024/3));
 });
 it('uses the runtime\'s own Uint8Array.fromBase64 when it has one',()=>{
  const native=vi.fn((text:string)=>new Uint8Array(Buffer.from(text,'base64')));
  const holder=Uint8Array as unknown as {fromBase64?:unknown},before=holder.fromBase64;holder.fromBase64=native;
  try{expect(Array.from(decodeAudio('AQID'))).toEqual([1,2,3]);}finally{if(before)holder.fromBase64=before;else delete holder.fromBase64;}
  expect(native).toHaveBeenCalledWith('AQID');
 });
 it('encodes the fallback\'s base64 in aligned pieces, or with the runtime\'s toBase64',()=>{
  for(const piece of [3,6,24576])for(const length of [1,2,3,4,5,6,7,24575,24576,24577,49153]){
   if(piece<24576&&length>100)continue;
   const bytes=bytesOf(length);expect(bytesToBase64(bytes,piece)).toBe(Buffer.from(bytes).toString('base64'));
  }
  const bytes=new Uint8Array([1,2,3]) as Uint8Array&{toBase64?:()=>string};bytes.toBase64=vi.fn(()=>'native');
  expect(bytesToBase64(bytes)).toBe('native');
 });
});

describe('one upload copy, and the fallback\'s copy only on fallback',()=>{
 it('builds one File and gives the very same object to both passes, never reading it back when Groq answers',async()=>{
  let built=0;const RealFile=File;vi.stubGlobal('File',class extends RealFile{constructor(...args:ConstructorParameters<typeof File>){super(...args);built+=1;}});
  const readBack=vi.spyOn(Blob.prototype,'arrayBuffer');
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>isSecond(init)?reply({text:'I trust my direction today.'}):reply(timed('I trust my direction today.')));vi.stubGlobal('fetch',upstream);
  const run=vi.fn();
  expect((await call({AI:{run} as never})).status).toBe(200);
  const files=upstream.mock.calls.map(([,init])=>(init.body as FormData).get('file') as File);
  expect(files).toHaveLength(2);expect(files[0]).toBe(files[1]);expect(built).toBe(1);
  expect(files[0].name).toBe('recording.m4a');expect(files[0].type).toBe('audio/mp4');expect(Array.from(new Uint8Array(await files[0].arrayBuffer()))).toEqual([1,2,3]);
  expect(readBack).toHaveBeenCalledTimes(1);expect(run).not.toHaveBeenCalled();
 });
 it('reads the File back and encodes it only when the fallback runs, passing it the deadline',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const readBack=vi.spyOn(Blob.prototype,'arrayBuffer');
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>isSecond(init)?reply({text:'I trust my direction today.'}):reply({error:{message:'busy'}},429)));
  const run=vi.fn().mockResolvedValue({text:'I trust my direction today.'});
  expect((await call({AI:{run} as never})).status).toBe(200);
  expect(readBack).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][1]).toEqual({audio:'AQID',initial_prompt:expect.any(String)});
  expect(run.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
 });
 it('keeps the existing two-argument Workers AI call when no signal is given',async()=>{
  const run=vi.fn().mockResolvedValue({text:'One.'});
  await workersAiTranscription({run} as never,new Blob([new Uint8Array([1,2])]),{prompt:'p'});
  expect(run.mock.calls[0]).toEqual(['@cf/openai/whisper-large-v3-turbo',{audio:'AQI=',initial_prompt:'p'}]);
 });
});

describe('one deadline that really stops every provider call',()=>{
 beforeEach(()=>{vi.useFakeTimers({toFake:['setTimeout','clearTimeout','Date']});});
 it('aborts both passes at the deadline, with a timeout, and answers provider_timeout',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>hang(init));vi.stubGlobal('fetch',upstream);
  const pending=call();await turns();expect(upstream).toHaveBeenCalledTimes(2);
  const signals=upstream.mock.calls.map(([,init])=>init.signal!);
  await vi.advanceTimersByTimeAsync(89_999);expect(signals.some(signal=>signal.aborted)).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const response=await pending;expect(response.status).toBe(504);expect(await response.json()).toMatchObject({code:'provider_timeout',retryable:true});
  for(const signal of signals){expect(signal.aborted).toBe(true);expect((signal.reason as DOMException).name).toBe('TimeoutError');}
 });
 it('keeps the first pass when the second is still listening at the deadline, saying doubts are unavailable',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>isSecond(init)?hang(init):reply(timed('I trust my direction today.')));vi.stubGlobal('fetch',upstream);
  const pending=call();await turns();
  await vi.advanceTimersByTimeAsync(90_000);
  const response=await pending;expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({doubts:[],doubtsAvailable:false,segments:[{text:'I trust my direction today.'}]});
  expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',pass:'second',reason:'timeout'}]]);
  expect(upstream.mock.calls.find(([,init])=>isSecond(init))![1].signal!.aborted).toBe(true);
 });
 it('stops the second pass as soon as the first has failed for good, without waiting for the deadline',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>isSecond(init)?hang(init):reply({error:{message:'x'}},503));vi.stubGlobal('fetch',upstream);
  expect((await call()).status).toBe(502);
  const signal=upstream.mock.calls.find(([,init])=>isSecond(init))![1].signal!;
  expect(signal.aborted).toBe(true);expect((signal.reason as DOMException).name).toBe('AbortError');
 });
 it('stops a Workers AI fallback that is still running at the deadline, and answers with Groq\'s status',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);vi.spyOn(console,'error').mockImplementation(()=>undefined);
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>isSecond(init)?reply({text:'x'}):reply({error:{message:'busy'}},429)));
  const run=vi.fn((_model:string,_input:unknown,options:{signal:AbortSignal})=>hang(options));
  const pending=call({AI:{run} as never});await turns();expect(run).toHaveBeenCalledTimes(1);
  const signal=run.mock.calls[0][2].signal;expect(signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(90_000);
  const response=await pending;expect(response.status).toBe(429);expect(signal.aborted).toBe(true);
  expect(run).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls.at(-1)).toEqual(['oracle_authoring_provider_failure',{operation:'transcribe',provider:'cloudflare',reason:'timeout'}]);
 });
});

describe('the comparison can never fail the take',()=>{
 it('returns the first pass with doubts unavailable past the work budget, logging only a category',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const text=Array.from({length:4100},(_,k)=>`w${k%50}`).join(' ');
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>isSecond(init)?reply({text}):reply(timed(text,600))));
  const response=await call({},{durationMs:600_000});expect(response.status).toBe(200);
  const body=await response.json() as any;expect(body).toMatchObject({doubts:[],doubtsAvailable:false});expect(body.segments[0].words).toHaveLength(4100);
  expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',pass:'second',reason:'too_long'}]]);
 });
 it('returns the first pass, unmarked, when the comparison itself throws',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);comparison.fail=true;
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>isSecond(init)?reply({text:'I trust my election today.'}):reply(timed('I trust my direction today.'))));
  const response=await call();expect(response.status).toBe(200);
  const body=await response.json() as any;expect(body).toMatchObject({doubts:[],doubtsAvailable:false});
  expect(body.segments[0].words.some((w:any)=>'doubt' in w||'heardAlso' in w)).toBe(false);
  expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',pass:'second',reason:'comparison_failed'}]]);
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/direction|election|fixture-key/);
 });
});
