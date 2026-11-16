import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../../functions/api/_lib/auth.ts',()=>({requireAdmin:vi.fn(async()=>({userId:'fixture-user'}))}));
import {requireAdmin} from '../../../functions/api/_lib/auth.ts';
import {onRequestPost} from '../../../functions/api/oracle/authoring/process';

const savedError=(retryable:boolean)=>({error:'Hosted transcription could not finish. Your recording is saved.',code:'provider_failed',retryable});
const call=()=>onRequestPost({
 request:new Request('https://mandalacodes.com/api/oracle/authoring/process',{method:'POST',headers:{Origin:'capacitor://localhost'},body:JSON.stringify({operation:'transcribe',mimeType:'audio/mp4',durationMs:1000,audioBase64:'AQID',context:{glossary:['private-prompt-fixture']}})}),
 env:{GROQ_API_KEY:'private-credential-fixture'},
});

describe('privacy-preserving hosted transcription failure diagnostics',()=>{
 beforeEach(()=>vi.mocked(requireAdmin).mockResolvedValue({userId:'fixture-user'} as never));
 afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

 it.each([
  [400,{error:{code:'invalid_file',type:'invalid_request_error',message:'Invalid audio file format: private-provider-body'}},'audio_format',502,'provider_failed',false],
  [401,{error:{message:'private-provider-body'}},'credentials',502,'provider_failed',false],
  [429,{error:{message:'private-provider-body'}},'rate_limit',429,'provider_busy',true],
  [413,{error:{message:'private-provider-body'}},'file_size',413,'audio_too_large',false],
  [400,{error:{code:'model_not_found',message:'private-provider-body'}},'model',502,'provider_failed',false],
  [400,{error:{message:'timestamp_granularities is unsupported: private-provider-body'}},'timestamp_options',502,'provider_failed',false],
  [400,{error:{type:'invalid_request_error',message:'private-provider-body'}},'request_options',502,'provider_failed',false],
  [500,{error:{message:'private-provider-body',nested:{credential:'private-nested-fixture'}}},'unclassified',502,'provider_failed',true],
 ] as const)('logs only the closed reason and status for provider HTTP %s',async(status,body,reason,returned,code,retryable)=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})));
  const response=await call();
  expect(response.status).toBe(returned);
  const result=await response.json() as any;
  expect(result).toMatchObject({code,retryable,error:expect.stringContaining('Your recording is saved')});expect(JSON.stringify(result)).not.toMatch(/private|groq/i);
  expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',status,reason}]]);
 });

 it('classifies a non-JSON upstream failure without logging its private body',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>private-provider-body</html>',{status:503,headers:{'Content-Type':'text/html'}})));
  const response=await call();
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual(savedError(true));
  expect(warn.mock.calls).toEqual([['oracle_authoring_provider_failure',{operation:'transcribe',provider:'groq',status:503,reason:'non_json'}]]);
 });

 it('keeps authentication ahead of processing and emits no provider failure diagnostic',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{}),upstream=vi.fn();
  vi.stubGlobal('fetch',upstream);vi.mocked(requireAdmin).mockResolvedValue(new Response('',{status:401}));
  expect((await call()).status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();expect(warn).not.toHaveBeenCalled();
 });
});
