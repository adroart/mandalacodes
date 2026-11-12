import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../../functions/api/_lib/auth.ts',()=>({requireAdmin:vi.fn(async()=>({userId:'owner'}))}));
import {requireAdmin} from '../../../functions/api/_lib/auth.ts';
import {onRequestPost} from '../../../functions/api/oracle/authoring/process';
import type {AuthoringEnv} from '../../../functions/api/oracle/authoring/_shared';

/** Two listenings of one recording: the first (turbo, timed) is kept, the second (large-v3, text only) only raises doubts. */
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const timed=(text:string,{duration=2,extra={}}:{duration?:number;extra?:Record<string,unknown>}={})=>{
 const tokens=text.split(' ');const step=duration/tokens.length;
 return {text,duration,segments:[{start:0,end:duration,text,avg_logprob:-0.21,no_speech_prob:0.01,compression_ratio:1.4,...extra}],words:tokens.map((word,k)=>({word,start:+(k*step).toFixed(3),end:+((k+1)*step).toFixed(3)}))};
};
type Answer=Response|(()=>Promise<Response>);
function listenings(first:Answer,second:Answer){
 const upstream=vi.fn(async(_url:string,init:RequestInit)=>{const answer=(init.body as FormData).get('model')==='whisper-large-v3'?second:first;return typeof answer==='function'?answer():answer.clone();});
 vi.stubGlobal('fetch',upstream);return upstream;
}
const call=(env:Partial<AuthoringEnv>={},extra:Record<string,unknown>={})=>onRequestPost({request:new Request('https://mandalacodes.com/api/oracle/authoring/process',{method:'POST',headers:{Origin:'capacitor://localhost'},body:JSON.stringify({operation:'transcribe',mimeType:'audio/mp4',durationMs:2000,audioBase64:'AQID',sectionId:'2/DESIGN/the-drive',...extra})}),env:{GROQ_API_KEY:'fixture-key',...env} as AuthoringEnv});
const allWords=(body:any)=>body.segments.flatMap((s:any)=>s.words??[]);

beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAdmin).mockResolvedValue({userId:'owner'} as never);});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('a second listening flags the words the two passes heard differently',()=>{
 it('sends the kept pass with word timings and the second, another model, as text only',async()=>{
  const upstream=listenings(reply(timed('I trust my direction today.')),reply({text:'I trust my direction today.'}));
  expect((await call()).status).toBe(200);
  const forms=upstream.mock.calls.map(([,init])=>init.body as FormData);
  expect(forms.map(form=>[form.get('model'),form.get('response_format'),form.getAll('timestamp_granularities[]')])).toEqual([['whisper-large-v3-turbo','verbose_json',['word','segment']],['whisper-large-v3','json',[]]]);
  expect(forms[0].get('prompt')).toBe(forms[1].get('prompt'));
 });
 it('marks only the substantive disagreement, on the word and at the top level, and keeps the first pass as the transcript',async()=>{
  listenings(reply(timed('I trust my direction today.')),reply({text:'i trust my election today'}));
  const body=await (await call()).json() as any;
  expect(body.provider).toBe('groq:whisper-large-v3-turbo');expect(body.segments[0].text).toBe('I trust my direction today.');
  expect(body.doubtsAvailable).toBe(true);
  expect(body.doubts).toEqual([{text:'direction',startMs:1200,endMs:1600,heardAlso:'election'}]);
  expect(allWords(body).filter((w:any)=>w.doubt)).toEqual([{text:'direction',startMs:1200,endMs:1600,doubt:true,heardAlso:'election'}]);
  expect(allWords(body).filter((w:any)=>!w.doubt).every((w:any)=>!('heardAlso' in w))).toBe(true);
 });
 it('raises no doubt for identical passes, case, punctuation or a mishearing the shared word library already fixes',async()=>{
  for(const [first,second] of [['I trust my direction today.','I trust my direction today.'],['Then he poured tea. And I understood.','then he poured tea and, I understood'],['Reading Jean keys tonight.','Reading Gene Keys tonight.']]){
   listenings(reply(timed(first)),reply({text:second}));
   const body=await (await call()).json() as any;
   expect(body).toMatchObject({doubts:[],doubtsAvailable:true});expect(allWords(body).some((w:any)=>w.doubt)).toBe(false);
  }
 });
 it('never fabricates a probability or confidence for any word',async()=>{
  listenings(reply(timed('I trust my direction today.')),reply({text:'I trust my election today.'}));
  const text=JSON.stringify(await (await call()).json());
  expect(text).not.toMatch(/probability|confidence/i);
 });
 it('passes the provider\'s own segment signals through untouched',async()=>{
  listenings(reply(timed('I trust my direction today.')),reply({text:'I trust my direction today.'}));
  expect((await (await call()).json() as any).segments[0].quality).toEqual({avgLogprob:-0.21,noSpeechProb:0.01,compressionRatio:1.4});
 });
 it.each([
  ['rate limited',()=>Promise.resolve(reply({error:{message:'private-provider-body'}},429)),{status:429,reason:'rate_limit'}],
  ['failing',()=>Promise.resolve(reply({error:{message:'private-provider-body'}},500)),{status:500,reason:'unclassified'}],
  ['timed out',()=>Promise.reject(new DOMException('The operation was aborted due to timeout','TimeoutError')),{reason:'timeout'}],
  ['unreachable',()=>Promise.reject(new TypeError('private network detail')),{reason:'network'}],
  ['unreadable',()=>Promise.resolve(new Response('<html>private-provider-body</html>')),{reason:'non_json'}],
 ] as const)('still returns the kept transcript when the second pass is %s, saying doubts are unavailable and logging only a category',async(_label,second,detail)=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  listenings(reply(timed('I trust my direction today.')),second);
  const response=await call();expect(response.status).toBe(200);
  const body=await response.json() as any;expect(body).toMatchObject({doubts:[],doubtsAvailable:false});expect(body.segments[0].text).toBe('I trust my direction today.');
  expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',pass:'second',...detail}]]);
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private|direction|fixture-key/);
 });
 it('runs both passes at once, so the request waits only for the slower one',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const upstream=listenings(async()=>{await gate;return reply(timed('I trust my direction today.'));},reply({text:'I trust my direction today.'}));
  const pending=call();await vi.waitFor(()=>expect(upstream).toHaveBeenCalledTimes(2));
  release();expect((await pending).status).toBe(200);
 });
 it('does not wait for or log the second pass when the first fails',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  listenings(reply({error:{message:'x'}},503),reply({error:{message:'x'}},503));
  expect((await call()).status).toBe(502);
  expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',status:503,reason:'unclassified'}]]);
 });
});

describe('the Workers AI fallback for the first pass',()=>{
 const workersAi={text:'I trust my direction today.',transcription_info:{duration:2.4},segments:[{start:0,end:2.4,text:' I trust my direction today.',avg_logprob:-0.3,words:[{word:'I',start:0,end:0.2},{word:'trust',start:0.2,end:0.8},{word:'my',start:0.8,end:1},{word:'direction',start:1,end:1.8},{word:'today.',start:1.8,end:2.4}]}]};
 it.each([429,500,503,408])('answers from Workers AI, with word timings and an honest provider, when Groq returns %s',async status=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const run=vi.fn().mockResolvedValue(workersAi);listenings(reply({error:{message:'busy'}},status),reply({text:'I trust my election today.'}));
  const response=await call({AI:{run} as never});expect(response.status).toBe(200);
  const body=await response.json() as any;
  expect(body.provider).toBe('cloudflare:@cf/openai/whisper-large-v3-turbo');expect(body.durationMs).toBe(2400);
  expect(body.segments[0]).toMatchObject({timing:'provider',text:' I trust my direction today.',quality:{avgLogprob:-0.3}});
  expect(allWords(body).map((w:any)=>w.text)).toEqual(['I','trust','my','direction','today.']);
  expect(body.doubts).toEqual([{text:'direction',startMs:1000,endMs:1800,heardAlso:'election'}]);
  expect(run.mock.calls[0][0]).toBe('@cf/openai/whisper-large-v3-turbo');
 });
 it('answers from Workers AI when Groq cannot be reached',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const run=vi.fn().mockResolvedValue(workersAi);vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('fetch failed')));
  const response=await call({AI:{run} as never});expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({provider:'cloudflare:@cf/openai/whisper-large-v3-turbo',doubtsAvailable:false});
 });
 it('returns the fallback text over the whole recording when it gives no segments',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);vi.spyOn(console,'error').mockImplementation(()=>undefined);
  const run=vi.fn().mockRejectedValueOnce(new Error('turbo failed')).mockResolvedValueOnce({text:'I trust my direction today.',words:[{word:'I',start:0,end:0.1}]});
  listenings(reply({error:{message:'busy'}},429),reply({error:{message:'busy'}},429));
  const body=await (await call({AI:{run} as never})).json() as any;
  expect(body.provider).toBe('cloudflare:@cf/openai/whisper');
  expect(body.segments).toEqual([{startMs:0,endMs:2000,text:'I trust my direction today.',sectionId:'2/DESIGN/the-drive',timing:'recording'}]);
 });
 it('keeps the Groq answer when the fallback fails too, and never falls back on a request error',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);vi.spyOn(console,'error').mockImplementation(()=>undefined);
  const run=vi.fn().mockRejectedValue(new Error('down'));listenings(reply({error:{message:'busy'}},429),reply({text:'x'}));
  const busy=await call({AI:{run} as never});expect(busy.status).toBe(429);expect(await busy.json()).toMatchObject({code:'provider_busy',retryable:true});
  run.mockClear();listenings(reply({error:{code:'invalid_file',message:'bad audio'}},400),reply({text:'x'}));
  expect((await call({AI:{run} as never})).status).toBe(502);expect(run).not.toHaveBeenCalled();
 });
 it('behaves exactly as before without the binding',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);listenings(reply({error:{message:'busy'}},429),reply({text:'x'}));
  expect(await (await call()).json()).toEqual({error:'Transcription is busy right now. Your recording is saved, so try again in a minute.',code:'provider_busy',retryable:true});
 });
});

describe('the provider\'s own duration',()=>{
 it('keeps the trailing words when the phone\'s clock ran short of the audio',async()=>{
  listenings(reply(timed('one two three four five',{duration:2.5})),reply({text:'one two three four five'}));
  const body=await (await call({},{durationMs:1000})).json() as any;
  expect(body.durationMs).toBe(2500);expect(body.segments[0]).toMatchObject({startMs:0,endMs:2500});
  expect(allWords(body).map((w:any)=>[w.text,w.endMs])).toEqual([['one',500],['two',1000],['three',1500],['four',2000],['five',2500]]);
 });
 it('keeps the phone\'s duration when it is the longer, and never passes twenty minutes',async()=>{
  listenings(reply(timed('one two',{duration:1})),reply({text:'one two'}));
  expect((await (await call({},{durationMs:3000})).json() as any).durationMs).toBe(3000);
  listenings(reply(timed('one two',{duration:1300})),reply({text:'one two'}));
  const body=await (await call({},{durationMs:1000})).json() as any;expect(body.durationMs).toBe(20*60*1000);expect(body.segments[0].endMs).toBe(20*60*1000);
 });
});
