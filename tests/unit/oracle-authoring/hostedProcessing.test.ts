import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../../functions/api/_lib/auth',()=>({requireUser:vi.fn(async()=>({userId:'owner'}))}));
import {requireUser} from '../../../functions/api/_lib/auth';
import {onRequestPost} from '../../../functions/api/oracle/authoring/process';
import type {AuthoringEnv} from '../../../functions/api/oracle/authoring/_shared';
const groq={GROQ_API_KEY:'fixture-groq-key',ORACLE_WRITING_PROVIDER:'groq',ORACLE_WRITING_MODEL:'openai/gpt-oss-120b'};
const openai={OPENAI_API_KEY:'fixture-openai-key',ORACLE_WRITING_MODEL:'configured-openai-model'};
const words='I trust my direction.',sectionId='2/DESIGN/the-drive',original='The original reading.';
const assimilation={words,sections:[{id:sectionId,title:'The drive',path:['Human Design','The drive'],text:original}],startSectionId:sectionId};
const faithful={sections:[{sectionId,text:words,evidenceQuotes:[words],changes:[],warnings:[]}],unassigned:[]};
const request=(body:unknown,origin='capacitor://localhost')=>new Request('https://mandalacodes.com/api/oracle/authoring/process',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
const call=(body:unknown,env:Record<string,string>={})=>onRequestPost({request:request(body),env:env as AuthoringEnv});
const complete=(output:unknown,finish_reason='stop')=>new Response(JSON.stringify({choices:[{finish_reason,message:{content:JSON.stringify(output)}}]}),{headers:{'Content-Type':'application/json'}});
function writingSession(){return {schema:1,id:'session',createdAt:'2026-10-31T12:00:00Z',source:{cardNumber:2,revision:'fixture',hash:'fixture-hash',markdown:original,sections:[{id:'DESIGN',title:'Human Design',start:0,end:original.length}]},captures:[],markers:[],transcript:[{id:'transcript',captureId:'capture',startMs:0,endMs:1000,raw:words,corrected:words,sectionId:'DESIGN',assignment:'manual',timing:'provider',provider:'fixture',receivedAt:'2026-10-31T12:00:00Z'}],proposals:[],approvals:[]};}
describe('authenticated hosted authoring provider selection',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireUser).mockResolvedValue({userId:'owner'} as never);});
 afterEach(()=>vi.unstubAllGlobals());
 it('keeps authentication and origin checks ahead of all provider calls',async()=>{
  const upstream=vi.fn();vi.stubGlobal('fetch',upstream);vi.mocked(requireUser).mockResolvedValue(new Response('',{status:401}));
  expect((await call({operation:'assimilate-sections',assimilation},groq)).status).toBe(401);expect(upstream).not.toHaveBeenCalled();
  vi.mocked(requireUser).mockClear();expect((await onRequestPost({request:request({operation:'capabilities'},'https://evil.example'),env:groq})).status).toBe(403);expect(requireUser).not.toHaveBeenCalled();
 });
 it('reports readiness only for the explicitly selected configured provider',async()=>{
  const cases:[Record<string,string>,boolean][]=[
   [{GROQ_API_KEY:groq.GROQ_API_KEY},false],
   [{...groq,ORACLE_WRITING_MODEL:''},false],
   [{...openai,ORACLE_WRITING_PROVIDER:'groq'},false],
   [{...groq,ORACLE_WRITING_PROVIDER:'untrusted'},false],
   [groq,true],[openai,true],[{...openai,ORACLE_WRITING_PROVIDER:'openai'},true],
  ];
  for(const [env,available] of cases){const response=await call({operation:'capabilities'},env);expect(response.status).toBe(200);expect(await response.json()).toMatchObject({writing:{available}});}
 });
 it('uses the existing Groq credential and fixed endpoint while preserving faithful review validation',async()=>{
  const upstream=vi.fn().mockResolvedValue(complete(faithful));vi.stubGlobal('fetch',upstream);
  const body={operation:'assimilate-sections',assimilation,provider:'openai',model:'caller-model',url:'https://evil.example',apiKey:'caller-key'};
  const snapshot=structuredClone(body),response=await call(body,{...groq,...openai,ORACLE_WRITING_MODEL:groq.ORACLE_WRITING_MODEL});
  expect(response.status).toBe(200);expect(body).toEqual(snapshot);expect((await response.json() as any).assimilation.sections[0]).toMatchObject({text:words,comparisonOriginal:original});
  expect(upstream).toHaveBeenCalledTimes(1);const [url,init]=upstream.mock.calls[0];expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');expect(init.headers.Authorization).toBe(`Bearer ${groq.GROQ_API_KEY}`);
  const sent=JSON.parse(init.body);expect(sent.model).toBe(groq.ORACLE_WRITING_MODEL);expect(sent.max_completion_tokens).toBe(24000);expect(sent.response_format).toEqual({type:'json_object'});expect(sent.messages[0].content).toContain('You are an editor');expect(sent.messages[0].content).toContain('Return ONLY a JSON object');expect(sent.messages[0].content).not.toContain('Return ONLY an artifact');expect(JSON.parse(sent.messages[1].content).words).toBe(words);
 });
 it('preserves the existing OpenAI route when no provider override is configured',async()=>{
  const upstream=vi.fn().mockResolvedValue(complete(faithful));vi.stubGlobal('fetch',upstream);expect((await call({operation:'assimilate-sections',assimilation},openai)).status).toBe(200);expect(upstream.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');expect(JSON.parse(upstream.mock.calls[0][1].body).model).toBe(openai.ORACLE_WRITING_MODEL);
 });
 it('fails closed without a selected provider credential and never falls back or calls upstream',async()=>{
  const upstream=vi.fn();vi.stubGlobal('fetch',upstream);const response=await call({operation:'assimilate-sections',assimilation},{...openai,ORACLE_WRITING_PROVIDER:'groq'});expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'Hosted writing is not configured. Your words are saved.'});expect(upstream).not.toHaveBeenCalled();
 });
 it('rejects malformed source boundaries before sending any transcript',async()=>{
  const upstream=vi.fn();vi.stubGlobal('fetch',upstream);const response=await call({operation:'assimilate-sections',assimilation:{...assimilation,startSectionId:'missing'}},groq);expect(response.status).toBe(400);expect(upstream).not.toHaveBeenCalled();expect(await response.json()).toMatchObject({error:expect.stringContaining('saved')});
 });
 it('retains an honest failure response for unavailable providers without leaking their response',async()=>{
  const upstream=vi.fn().mockResolvedValue(new Response('private provider diagnostic',{status:429}));vi.stubGlobal('fetch',upstream);const response=await call({operation:'assimilate-sections',assimilation},groq);expect(response.status).toBe(502);expect(await response.json()).toEqual({error:'Hosted review could not finish. Your words are saved.'});expect(upstream).toHaveBeenCalledTimes(1);
 });
 it.each([
  ['invented wording',{...faithful,sections:[{...faithful.sections[0],text:words+' An invented sentence.'}]}],
  ['unsupported evidence',{...faithful,sections:[{...faithful.sections[0],evidenceQuotes:['Words never spoken.']}]}],
  ['unknown section',{...faithful,sections:[{...faithful.sections[0],sectionId:'2/BODY/unknown'}]}],
 ])('rejects %s instead of returning an applyable result',async(_label,output)=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(complete(output)));const response=await call({operation:'assimilate-sections',assimilation},groq);expect(response.status).toBe(400);const result=await response.json() as any;expect(result.assimilation).toBeUndefined();expect(result.error).toContain('saved');
 });
 it('does not accept a token-limited partial completion even when its JSON parses',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(complete(faithful,'length')));const response=await call({operation:'assimilate-sections',assimilation},groq);expect(response.status).toBe(502);expect(await response.json()).toMatchObject({error:expect.stringContaining('saved')});
 });
 it('uses the selected provider for legacy proposals and attributes the author accurately',async()=>{
  const proposals=[{sectionId:'DESIGN',text:words,evidenceIds:['transcript'],feedback:{changes:'Preserved the spoken words.',uncertainWords:'',omissions:'',contradictions:'',unsupportedAdditions:''}}];
  const upstream=vi.fn().mockResolvedValue(complete({proposals}));vi.stubGlobal('fetch',upstream);const response=await call({operation:'propose',session:writingSession()},groq);expect(response.status).toBe(200);expect((await response.json() as any).proposals[0].author).toEqual({kind:'ai',provider:'groq',model:groq.ORACLE_WRITING_MODEL});expect(upstream.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');expect(JSON.parse(upstream.mock.calls[0][1].body).max_completion_tokens).toBe(8000);
 });
 it('keeps proposal evidence validation when switching providers',async()=>{
  const proposals=[{sectionId:'DESIGN',text:words,evidenceIds:['missing'],feedback:{changes:'Preserved the spoken words.',uncertainWords:'',omissions:'',contradictions:'',unsupportedAdditions:''}}];
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(complete({proposals})));const response=await call({operation:'propose',session:writingSession()},groq);expect(response.status).toBe(400);expect(await response.json()).not.toHaveProperty('proposals');
 });
});
