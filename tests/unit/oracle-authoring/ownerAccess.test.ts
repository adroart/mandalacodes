import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
/** The real admin guard runs here; only the session lookup behind it is replaced. */
const getSession=vi.fn();
vi.mock('../../../lib/account/auth.server.js',()=>({createAuth:()=>({api:{getSession}})}));
import {onRequestPost as process} from '../../../functions/api/oracle/authoring/process';
import {onRequestPost as sync} from '../../../functions/api/oracle/authoring/private';
import type {AuthoringEnv} from '../../../functions/api/oracle/authoring/_shared';

const KEY='private-credential-fixture',OWNER='a@example.com';
const owner={user:{id:'owner-1',email:OWNER,emailVerified:true},session:{id:'s'}};
const db=(count=0)=>({prepare:()=>({bind:()=>({first:async()=>count?{count,window_start:Date.now()}:null})})});
const env=(extra:Record<string,unknown>={})=>({DB:db(),ADMIN_EMAILS:` Someone@else.example , ${OWNER.toUpperCase()}`,GROQ_API_KEY:KEY,ORACLE_WRITING_PROVIDER:'groq',ORACLE_WRITING_MODEL:'fixture-model',...extra}) as unknown as AuthoringEnv;
const post=(path:string,body:unknown,origin='capacitor://localhost')=>new Request(`https://mandalacodes.com/api/oracle/authoring/${path}`,{method:'POST',headers:{Origin:origin},body:typeof body==='string'?body:JSON.stringify(body)});
const transcribe=(extra:Record<string,unknown>={})=>({operation:'transcribe',mimeType:'audio/mp4',durationMs:1000,audioBase64:'AQID',context:{glossary:['private-prompt-fixture']},...extra});
const groqJson=(body:unknown,status=200)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const contract=async(response:Response,status:number,code:string,retryable:boolean)=>{expect(response.status).toBe(status);const body=await response.json() as any;expect(body).toMatchObject({code,retryable});expect(typeof body.error).toBe('string');expect(body.error).not.toMatch(/groq|openai|whisper|HTTP/i);return body;};

beforeEach(()=>{vi.clearAllMocks();getSession.mockResolvedValue(owner);});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('voice workspace endpoints are the owner\'s only',()=>{
 it('answers a signed-out request with 401 signed_out on processing and private storage, before any provider or bucket',async()=>{
  getSession.mockResolvedValue(null);const upstream=vi.fn(),get=vi.fn();vi.stubGlobal('fetch',upstream);
  await contract(await process({request:post('process',transcribe()),env:env()}),401,'signed_out',false);
  await contract(await sync({request:post('private',{operation:'read',id:'session'}),env:env({ORACLE_PRIVATE:{get}})}),401,'signed_out',false);
  expect(upstream).not.toHaveBeenCalled();expect(get).not.toHaveBeenCalled();
 });
 it.each([
  ['a signed-in account that is not on the owner list',{user:{id:'other',email:'stranger@example.com',emailVerified:true}}],
  ['the owner\'s address before it is verified',{user:{id:'other',email:OWNER,emailVerified:false}}],
 ])('refuses %s with 403 forbidden',async(_label,session)=>{
  getSession.mockResolvedValue(session);const upstream=vi.fn(),get=vi.fn(),put=vi.fn();vi.stubGlobal('fetch',upstream);
  await contract(await process({request:post('process',transcribe()),env:env()}),403,'forbidden',false);
  await contract(await process({request:post('process',{operation:'capabilities'}),env:env()}),403,'forbidden',false);
  await contract(await sync({request:post('private',{operation:'read',id:'session'}),env:env({ORACLE_PRIVATE:{get,put}})}),403,'forbidden',false);
  expect(upstream).not.toHaveBeenCalled();expect(get).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();
 });
 it('refuses everyone when no owner is configured',async()=>{
  await contract(await process({request:post('process',{operation:'capabilities'}),env:env({ADMIN_EMAILS:''})}),403,'forbidden',false);
 });
 it('keeps the origin check first and its own code',async()=>{
  await contract(await process({request:post('process',{operation:'capabilities'},'https://evil.example'),env:env()}),403,'origin_forbidden',false);
  await contract(await sync({request:post('private',{},'https://evil.example'),env:env()}),403,'origin_forbidden',false);
  expect(getSession).not.toHaveBeenCalled();
 });
 it('lets the owner in and keeps private storage under the owner\'s user id',async()=>{
  expect((await process({request:post('process',{operation:'capabilities'}),env:env()})).status).toBe(200);
  const get=vi.fn().mockResolvedValue(null);expect((await sync({request:post('private',{operation:'read',id:'session'}),env:env({ORACLE_PRIVATE:{get}})})).status).toBe(200);
  expect(get).toHaveBeenCalledWith('authoring/owner-1/sessions/session');
 });
});

describe('processing failure contract',()=>{
 it('rejects a recording over twenty minutes and a non-audio type as invalid_request without calling the provider',async()=>{
  const upstream=vi.fn();vi.stubGlobal('fetch',upstream);
  await contract(await process({request:post('process',transcribe({durationMs:20*60*1000+1})),env:env()}),400,'invalid_request',false);
  await contract(await process({request:post('process',transcribe({mimeType:'video/mp4'})),env:env()}),400,'invalid_request',false);
  await contract(await process({request:post('process',{operation:'unknown'}),env:env()}),400,'invalid_request',false);
  await contract(await process({request:post('process','{not json'),env:env()}),400,'invalid_request',false);
  expect(upstream).not.toHaveBeenCalled();
 });
 it('answers 503 not_configured only when the service is missing',async()=>{
  await contract(await process({request:post('process',transcribe()),env:env({GROQ_API_KEY:undefined})}),503,'not_configured',false);
  await contract(await process({request:post('process',{operation:'propose',session:{}}),env:env({ORACLE_WRITING_MODEL:undefined})}),503,'not_configured',false);
  await contract(await sync({request:post('private',{operation:'list'}),env:env()}),503,'not_configured',false);
 });
 it('answers 413 audio_too_large for audio over 10 MiB, whether the base64 is too long or decodes too large',async()=>{
  const upstream=vi.fn();vi.stubGlobal('fetch',upstream);
  const decodesOver='A'.repeat(4*Math.ceil((10*1024*1024+3)/3));
  for(const audioBase64 of ['A'.repeat(14*1024*1024+4),decodesOver]){
   const body=await contract(await process({request:post('process',transcribe({audioBase64})),env:env()}),413,'audio_too_large',false);expect(body.error).toContain('Your recording is saved.');
  }
  const put=vi.fn();await contract(await sync({request:post('private',{operation:'audio-put',hash:'a'.repeat(64),mimeType:'audio/mp4',audioBase64:decodesOver}),env:env({ORACLE_PRIVATE:{put}})}),413,'audio_too_large',false);
  expect(upstream).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();
 });
 it('answers 413 body_too_large for a request over the 15 MiB bound',async()=>{
  await contract(await process({request:post('process',{operation:'transcribe',padding:'x'.repeat(15*1024*1024)}),env:env()}),413,'body_too_large',false);
  await contract(await sync({request:post('private',{operation:'list',padding:'x'.repeat(15*1024*1024)}),env:env({ORACLE_PRIVATE:{}})}),413,'body_too_large',false);
 });
 it('answers 422 no_speech when the provider hears nothing',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(groqJson({text:' ',segments:[]})));
  await contract(await process({request:post('process',transcribe()),env:env()}),422,'no_speech',false);
 });
 it('passes a provider 429 through as provider_busy, retryable',async()=>{
  vi.spyOn(console,'warn').mockImplementation(()=>undefined);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(groqJson({error:{message:'slow down'}},429)));
  await contract(await process({request:post('process',transcribe()),env:env()}),429,'provider_busy',true);
 });
 it.each([
  ['a network error',()=>Promise.reject(new TypeError('fetch failed')),502,'provider_failed','network'],
  ['a timeout',()=>Promise.reject(new DOMException('The operation was aborted due to timeout','TimeoutError')),504,'provider_timeout','timeout'],
 ] as const)('answers %s reaching the provider as retryable, and logs only its category',async(_label,fail,status,code,reason)=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  for(const [operation,body,provider] of [['transcribe',transcribe(),'groq'],['propose',{operation:'propose',session:{schema:1,transcript:[{id:'t'}],source:{sections:[]}}},'groq']] as const){
   warn.mockClear();vi.stubGlobal('fetch',vi.fn().mockImplementation(fail));
   await contract(await process({request:post('process',body),env:env()}),status,code,true);
   expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation,provider,reason}]]);
  }
 });
 it('answers 502 provider_failed for a provider 5xx or an unreadable success body, and never logs words, keys or accounts',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(groqJson({error:{message:'private-provider-body'}},503)));
  await contract(await process({request:post('process',transcribe()),env:env()}),502,'provider_failed',true);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(groqJson('<html>private-provider-body</html>')));
  await contract(await process({request:post('process',transcribe()),env:env()}),502,'provider_failed',true);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(groqJson({error:{message:'private-provider-body'}},500)));
  await contract(await process({request:post('process',{operation:'propose',session:{schema:1,transcript:[{id:'t',raw:'private spoken words'}],source:{sections:[]}}}),env:env()}),502,'provider_failed',true);
  expect(warn.mock.calls).toEqual([
   ['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',status:503,reason:'unclassified'}],
   ['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',status:200,reason:'non_json'}],
   ['oracle_authoring_provider_failure',{operation:'propose',provider:'groq',status:500,reason:'unclassified'}],
  ]);
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private|owner-1|example\.com|AQID/);expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY);
 });
 it('limits provider work per owner without limiting the readiness check',async()=>{
  const upstream=vi.fn();vi.stubGlobal('fetch',upstream);
  const response=await process({request:post('process',transcribe()),env:env({DB:db(301)})});
  const body=await contract(response,429,'rate_limited',true);expect(body.retryAfter).toBeGreaterThan(0);expect(response.headers.get('Retry-After')).toBe(String(body.retryAfter));
  expect(upstream).not.toHaveBeenCalled();
  expect((await process({request:post('process',{operation:'capabilities'}),env:env({DB:db(301)})})).status).toBe(200);
 });
 it('keeps the private conflict flag beside the contract fields',async()=>{
  const body=await contract(await sync({request:post('private',{operation:'save',id:'session',expectedRevision:'previous',document:{session:{schema:1,id:'session'},audio:[]}}),env:env({ORACLE_PRIVATE:{put:vi.fn().mockResolvedValue(null)}})}),409,'conflict',false);
  expect(body.conflict).toBe(true);
 });
});
