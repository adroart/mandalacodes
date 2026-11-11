import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../../functions/api/_lib/auth.ts',()=>({requireAdmin:vi.fn(async()=>({userId:'owner'}))}));
import {requireAdmin} from '../../../functions/api/_lib/auth.ts';
import {onRequestPost} from '../../../functions/api/oracle/authoring/process';
import type {AuthoringEnv} from '../../../functions/api/oracle/authoring/_shared';

/** A long take is reviewed in parts: up front when clearly too long, or when an answer comes back cut off. */
const env={GROQ_API_KEY:'fixture-key',ORACLE_WRITING_PROVIDER:'groq',ORACLE_WRITING_MODEL:'fixture-model'} as AuthoringEnv;
const sectionId='2/DESIGN/the-drive';
const speech=(chars:number)=>{const out:string[]=[];for(let k=1;out.join(' ').length<chars;k++)out.push(`Sentence ${k} says what I mean.`);return out.join(' ');};
const assimilation=(words:string)=>({words,sections:[{id:sectionId,title:'The drive',path:['Human Design','The drive'],text:'The original reading.'},{id:'2/DESIGN/the-gift',title:'The gift',path:['Human Design','The gift'],text:'Another reading.'}],startSectionId:sectionId});
const complete=(output:unknown,finish_reason='stop',usage?:unknown)=>new Response(JSON.stringify({choices:[{finish_reason,message:{content:typeof output==='string'?output:JSON.stringify(output)}}],...(usage?{usage}:{})}),{headers:{'Content-Type':'application/json'}});
/** The words the server sent in this request. */
const sentWords=(init:RequestInit)=>JSON.parse(JSON.parse(String(init.body)).messages[1].content).words as string;
const faithful=(words:string)=>({sections:[{sectionId,text:words,evidenceQuotes:[words],changes:[],warnings:[]}],unassigned:[]});
const call=(words:string)=>onRequestPost({request:new Request('https://mandalacodes.com/api/oracle/authoring/process',{method:'POST',headers:{Origin:'capacitor://localhost'},body:JSON.stringify({operation:'assimilate-sections',assimilation:assimilation(words)})}),env});

beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAdmin).mockResolvedValue({userId:'owner'} as never);});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('long section reviews in parts',()=>{
 it('reviews clearly long words in parts up front and merges one section in spoken order with all its evidence',async()=>{
  const words=speech(20000);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>complete(faithful(sentWords(init))));vi.stubGlobal('fetch',upstream);
  const response=await call(words);expect(response.status).toBe(200);
  const parts=upstream.mock.calls.map(([,init])=>sentWords(init));
  expect(parts.length).toBe(2);expect(parts.join('')).toBe(words);
  for(const part of parts){expect(part.length).toBeLessThan(words.length);expect(part.trimEnd()).toMatch(/\.$/);}
  const {assimilation:result}=await response.json() as any;
  expect(result.unassigned).toEqual([]);expect(result.sections).toHaveLength(1);
  expect(result.sections[0].evidenceQuotes).toEqual(parts);expect(result.sections[0].text).toBe(parts.join('\n\n'));
  expect(result.sections[0].comparison).toBeUndefined();
 });
 it('splits a cut-off answer at a sentence, reviews both halves and merges them',async()=>{
  const words=speech(6000);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>{const sent=sentWords(init);return sent===words?complete(faithful(sent),'length'):complete(faithful(sent));});vi.stubGlobal('fetch',upstream);
  const response=await call(words);expect(response.status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(3);
  const halves=upstream.mock.calls.slice(1).map(([,init])=>sentWords(init));expect(halves.join('')).toBe(words);
  const {assimilation:result}=await response.json() as any;expect(result.sections[0].evidenceQuotes).toEqual(halves);
  for(const quote of result.sections[0].evidenceQuotes)expect(words).toContain(quote);
 });
 it('treats unreadable JSON at the token limit as cut off, not as a failed review',async()=>{
  const words=speech(6000);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>{const sent=sentWords(init);return sent===words?complete('{"sections":[{"sectionId":"2/DESIGN/the-dr','stop',{completion_tokens:24000}):complete(faithful(sent));});vi.stubGlobal('fetch',upstream);
  const response=await call(words);expect(response.status).toBe(200);expect(upstream).toHaveBeenCalledTimes(3);
  expect((await response.json() as any).assimilation.unassigned).toEqual([]);
 });
 it('routes parts to different sections and keeps each part in its own section',async()=>{
  const words=speech(20000);
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>{const sent=sentWords(init);const id=sent.startsWith('Sentence 1 ')?sectionId:'2/DESIGN/the-gift';return complete({sections:[{sectionId:id,text:sent,evidenceQuotes:[sent],changes:[],warnings:[]}],unassigned:[]});}));
  const {assimilation:result}=await (await call(words)).json() as any;
  expect(result.sections.map((s:any)=>s.sectionId)).toEqual([sectionId,'2/DESIGN/the-gift']);
 });
 it('returns the words of an invalid part as unassigned and keeps the valid part',async()=>{
  const words=speech(20000);const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>{const sent=sentWords(init);return sent.startsWith('Sentence 1 ')?complete(faithful(sent)):complete({...faithful(sent),sections:[{...faithful(sent).sections[0],evidenceQuotes:['Words never spoken.']}]});}));
  const response=await call(words);expect(response.status).toBe(200);
  const {assimilation:result}=await response.json() as any;
  expect(result.sections).toHaveLength(1);expect(result.sections[0].text.startsWith('Sentence 1 ')).toBe(true);
  expect(result.unassigned).toHaveLength(1);expect(result.unassigned[0].reason).toContain('AI review could not prepare');
  expect(result.sections[0].text.trim()+' '+result.unassigned[0].text).toBe(words);
  expect(warn.mock.calls).toEqual([['oracle_authoring_review_failure',{operation:'assimilate-sections',provider:'groq',stage:'evidence',reason:'invalid_evidence'}]]);
 });
 it('fails the whole review honestly when any part meets a busy provider',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  vi.stubGlobal('fetch',vi.fn(async(_url:string,init:RequestInit)=>sentWords(init).startsWith('Sentence 1 ')?complete(faithful(sentWords(init))):new Response('{}',{status:429})));
  const response=await call(speech(20000));expect(response.status).toBe(429);expect(await response.json()).toMatchObject({code:'provider_busy',retryable:true});
 });
 it('stops at a fixed number of requests and answers with the retryable provider failure',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>complete(faithful(sentWords(init)),'length'));vi.stubGlobal('fetch',upstream);
  const response=await call(speech(30000));
  expect(response.status).toBe(502);expect(await response.json()).toMatchObject({code:'provider_failed',retryable:true});
  expect(upstream.mock.calls.length).toBeLessThanOrEqual(6);
  for(const [,init] of upstream.mock.calls)expect(JSON.parse(String(init.body)).max_completion_tokens).toBe(24000);
 });
 it('does not start another part when too little time is left, and says it took too long',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  let now=1_800_000_000_000;vi.spyOn(Date,'now').mockImplementation(()=>now);
  const upstream=vi.fn(async(_url:string,init:RequestInit)=>{now+=85_000;return complete(faithful(sentWords(init)),'length');});vi.stubGlobal('fetch',upstream);
  const response=await call(speech(6000));
  expect(response.status).toBe(504);expect(await response.json()).toMatchObject({code:'provider_timeout',retryable:true});expect(upstream).toHaveBeenCalledTimes(1);
 });
});
