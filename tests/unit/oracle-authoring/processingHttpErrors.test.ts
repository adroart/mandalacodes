import {afterEach,describe,expect,it,vi} from 'vitest';

const {nativeFetch}=vi.hoisted(()=>({nativeFetch:vi.fn()}));
vi.mock('../../../mobile/node_modules/@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('../../../src/mobile/account/nativeAccountTransport',()=>({createNativeAccountFetch:()=>nativeFetch}));
vi.mock('../../../src/mobile/authoring/bridgeConnection',()=>({loadMacBridge:()=>null,requestMacBridge:vi.fn()}));

import {AuthoringServiceError,processingFailureMessages,requestAuthoringProcessing} from '../../../src/mobile/authoring/processing';
import {isSignInBlocked} from '../../../src/mobile/authoring/accountRecovery';

const respond=(value:unknown,status:number)=>nativeFetch.mockResolvedValue(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
const request=()=>requestAuthoringProcessing({operation:'transcribe'});
/** No system, provider or HTTP wording in what the speaker reads. */
const internal=/AR Create|Groq|hosted|bridge|HTTP|\b\d{3}\b|HTML/i;

describe('phone processing errors in plain words',()=>{
 afterEach(()=>vi.resetAllMocks());

 it.each(['<!DOCTYPE html><html>private-edge-body-123</html>',' \n<HTML lang="en">private-edge-body-123</HTML>'])('maps an HTML 403 to a plain sentence and keeps the status as a detail',async html=>{
  respond(html,403);
  const error=await request().catch(error=>error);
  expect(error).toBeInstanceOf(AuthoringServiceError);
  expect(error.status).toBe(403);expect(error.detail).toBe('403');
  expect(error.message).toBe(processingFailureMessages.forbidden);
  expect(error.message).not.toContain('private-edge-body-123');
  expect(error.retryable).toBe(false);
 });

 it.each([{error:{detail:'private-provider-detail',token:'private-token'}},['private-provider-detail'],null,'private-provider-detail',{error:'Hosted transcription could not finish. private-provider-detail'}])('never reflects the server body and treats a 502 as passing',async body=>{
  respond(body,502);
  const error=await request().catch(error=>error);
  expect(error.status).toBe(502);
  expect(error.message).toBe(processingFailureMessages.failed);
  expect(error.message).not.toMatch(/private-provider-detail|private-token/);
  expect(error.retryable).toBe(true);
 });

 it('keeps the exact sign-in sentence that recovery after sign-in looks for',async()=>{
  respond({error:'unauthorized'},401);
  const error=await request().catch(error=>error);
  expect(error.status).toBe(401);
  expect(isSignInBlocked(error.message)).toBe(true);
  expect(error.retryable).toBe(false);
 });

 it.each([
  [401,'signed_out',false,'signed_out'],[403,'forbidden',false,'forbidden'],[400,'invalid_request',false,'invalid_request'],
  [413,'audio_too_large',false,'too_large'],[413,'body_too_large',false,'too_large'],[422,'no_speech',false,'no_speech'],
  [429,'provider_busy',true,'busy'],[502,'provider_failed',true,'failed'],[504,'provider_timeout',true,'timeout'],[503,'not_configured',false,'not_configured'],
 ] as const)('maps %i %s from the server contract',async(status,code,retryable,failure)=>{
  respond({error:'Server words are never shown.',code,retryable},status);
  const error=await request().catch(error=>error);
  expect(error.status).toBe(status);expect(error.failure).toBe(failure);expect(error.retryable).toBe(retryable);
  expect(error.message).toBe(processingFailureMessages[failure]);
 });

 it.each([[401,false],[403,false],[400,false],[413,false],[422,false],[429,true],[502,true],[504,true],[503,false],[500,true]] as const)('an older server that sends only status %i still maps',async(status,retryable)=>{
  respond({},status);
  const error=await request().catch(error=>error);
  expect(error.status).toBe(status);expect(error.retryable).toBe(retryable);
 });

 it('lets the server say a failure is not worth retrying',async()=>{
  respond({error:'x',code:'provider_failed',retryable:false},502);
  expect((await request().catch(error=>error)).retryable).toBe(false);
 });

 it('names no connection and a client timeout without a status',async()=>{
  nativeFetch.mockRejectedValueOnce(new TypeError('Load failed'));
  const offline=await request().catch(error=>error);
  expect(offline.status).toBe(0);expect(offline.detail).toBe('offline');expect(offline.retryable).toBe(true);expect(offline.message).toBe(processingFailureMessages.offline);
  nativeFetch.mockRejectedValueOnce(new DOMException('signal timed out','TimeoutError'));
  const late=await request().catch(error=>error);
  expect(late.detail).toBe('timeout');expect(late.retryable).toBe(true);expect(late.message).toBe(processingFailureMessages.timeout);
 });

 it('every sentence says the recording is kept and names no system',()=>{
  for(const message of Object.values(processingFailureMessages)){
   expect(message).toMatch(/saved/);
   expect(message).not.toMatch(internal);
   expect(message).not.toContain('\u2014');
  }
 });
});
