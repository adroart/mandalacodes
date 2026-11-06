import {afterEach,describe,expect,it,vi} from 'vitest';

const {nativeFetch}=vi.hoisted(()=>({nativeFetch:vi.fn()}));
vi.mock('../../../mobile/node_modules/@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('../../../src/mobile/account/nativeAccountTransport',()=>({createNativeAccountFetch:()=>nativeFetch}));
vi.mock('../../../src/mobile/authoring/bridgeConnection',()=>({loadMacBridge:()=>null,requestMacBridge:vi.fn()}));

import {AuthoringServiceError,requestAuthoringProcessing} from '../../../src/mobile/authoring/processing';

const respond=(value:unknown,status:number)=>nativeFetch.mockResolvedValue(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
const request=()=>requestAuthoringProcessing({operation:'transcribe'});

describe('native hosted processing HTTP error diagnostics',()=>{
 afterEach(()=>vi.resetAllMocks());

 it.each(['<!DOCTYPE html><html>private-edge-body-123</html>',' \n<HTML lang="en">private-edge-body-123</HTML>'])('identifies an HTML 403 without exposing the response body',async html=>{
  respond(html,403);
  const error=await request().catch(error=>error);
  expect(error).toBeInstanceOf(AuthoringServiceError);
  expect(error.status).toBe(403);
  expect(error.message).toBe('Hosted processing returned HTTP 403 (HTML response). Your recording and words are saved.');
  expect(error.message).not.toContain('private-edge-body-123');
  expect(error.message).not.toContain('<');
 });

 it.each([{error:{detail:'private-provider-detail',token:'private-token'}},['private-provider-detail'],null,'private-provider-detail'])('keeps the status and never reflects an unrecognized error value',async body=>{
  respond(body,502);
  const error=await request().catch(error=>error);
  expect(error.status).toBe(502);
  expect(error.message).toBe('Hosted processing returned HTTP 502. Your recording and words are saved.');
  expect(error.message).not.toMatch(/private-provider-detail|private-token/);
 });

 it('preserves the sign-in recovery message for a 401',async()=>{
  respond({error:'unauthorized'},401);
  const error=await request().catch(error=>error);
  expect(error.status).toBe(401);
  expect(error.message).toBe('Sign in to process on this phone. Your recording is saved.');
 });

 it('preserves an existing string provider error',async()=>{
  const message='Hosted transcription could not finish. Your recording is saved.';
  respond({error:message},502);
  const error=await request().catch(error=>error);
  expect(error.status).toBe(502);
  expect(error.message).toBe(message);
 });
});
