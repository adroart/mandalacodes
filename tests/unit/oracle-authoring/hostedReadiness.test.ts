import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const {nativeFetch,bridge}=vi.hoisted(()=>({nativeFetch:vi.fn(),bridge:{value:null as unknown}}));
vi.mock('../../../mobile/node_modules/@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('../../../src/mobile/account/nativeAccountTransport',()=>({createNativeAccountFetch:()=>nativeFetch}));
vi.mock('../../../src/mobile/authoring/bridgeConnection',()=>({loadMacBridge:()=>bridge.value,requestMacBridge:vi.fn()}));

import {forgetHostedReadiness,hostedReadiness,requestAuthoringProcessing,retryAfterMs} from '../../../src/mobile/authoring/processing';
import {retryableTakeFailure,takeRetryAt} from '../../../src/mobile/authoring/sectionTakes';

const respond=(value:unknown,status:number,headers:Record<string,string>={})=>nativeFetch.mockResolvedValue(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}}));
const capabilities=(transcription:boolean,writing:boolean)=>({service:'Oracle hosted authoring',hosted:true,transcription:{available:transcription},writing:{available:writing}});

describe('readiness before recording',()=>{
 beforeEach(()=>{forgetHostedReadiness();bridge.value=null;});
 afterEach(()=>vi.resetAllMocks());
 it('asks the capabilities operation and is ready when hearing and matching are both set up',async()=>{
  respond(capabilities(true,true),200);
  const answer=await hostedReadiness();
  expect(answer).toMatchObject({state:'ready',transcription:true,writing:true});
  expect(JSON.parse(nativeFetch.mock.calls[0][1].body)).toEqual({operation:'capabilities'});
  expect(nativeFetch.mock.calls[0][0]).toBe('/api/oracle/authoring/process');expect(nativeFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
 });
 it.each([[401,'signed_out'],[403,'not_allowed'],[503,'not_set_up'],[404,'not_set_up'],[500,'unreachable']] as const)('answers %i as %s',async(status,state)=>{
  respond({error:'x'},status);expect((await hostedReadiness()).state).toBe(state);
 });
 it('is not set up when a capability is missing',async()=>{
  respond(capabilities(true,false),200);expect(await hostedReadiness()).toMatchObject({state:'not_set_up',transcription:true,writing:false});
 });
 it('is unreachable when no answer comes back, and says the paired Mac is still there when the server is not set up',async()=>{
  nativeFetch.mockRejectedValue(new DOMException('timed out','TimeoutError'));expect((await hostedReadiness()).state).toBe('unreachable');
  forgetHostedReadiness();bridge.value={endpoint:'x'};respond({},503);expect(await hostedReadiness()).toMatchObject({state:'not_set_up',macFallback:true});
 });
 it('asks once and keeps the answer for a few minutes, sharing a question already in flight',async()=>{
  respond(capabilities(true,true),200);
  const [a,b]=await Promise.all([hostedReadiness(),hostedReadiness()]);await hostedReadiness();
  expect(a).toBe(b);expect(nativeFetch).toHaveBeenCalledTimes(1);
  await hostedReadiness({force:true});expect(nativeFetch).toHaveBeenCalledTimes(2);
 });
});

describe('the server retry advice reaches the queue',()=>{
 afterEach(()=>vi.resetAllMocks());
 it('reads Retry-After as seconds, as a date, or from the body',()=>{
  expect(retryAfterMs('120')).toBe(120000);
  expect(retryAfterMs(new Date(Date.UTC(2030,0,1,0,1)).toUTCString(),undefined,Date.UTC(2030,0,1))).toBe(60000);
  expect(retryAfterMs(null,{retryAfter:30})).toBe(30000);expect(retryAfterMs(null,{})).toBeUndefined();
 });
 it('carries a 429 pause onto the error, and the queue waits at least that long',async()=>{
  respond({error:'x',code:'rate_limited',retryable:true,retryAfter:600},429,{'Retry-After':'600'});
  const error=await requestAuthoringProcessing({operation:'transcribe'}).catch(e=>e);
  expect(error.retryAfterMs).toBe(600000);expect(retryableTakeFailure(error)).toBe(true);
  expect(takeRetryAt(error,1,0)).toBe(600000);
 });
 it('a 502 the server marks not retryable is final',async()=>{
  respond({error:'x',code:'provider_failed',retryable:false},502);
  expect(retryableTakeFailure(await requestAuthoringProcessing({operation:'transcribe'}).catch(e=>e))).toBe(false);
 });
 it('a 409 is not retried',async()=>{
  respond({error:'x'},409);
  const error=await requestAuthoringProcessing({operation:'transcribe'}).catch(e=>e);
  expect(error.retryable).toBe(false);expect(retryableTakeFailure(error)).toBe(false);
 });
});
