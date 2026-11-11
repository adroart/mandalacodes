import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { loadMacBridge, requestMacBridge } from './bridgeConnection';
import { createNativeAccountFetch } from '../account/nativeAccountTransport';
import { cardSections } from '../../../lib/oracle/authoring/cardSections';
import type { AuthoringServices } from '../../../lib/oracle/authoring/types';
/** What went wrong, in words the speaker can act on. The status (or offline/timeout) stays on the error as a quiet detail to report. */
export type ProcessingFailure='signed_out'|'forbidden'|'invalid_request'|'too_large'|'no_speech'|'busy'|'failed'|'timeout'|'offline'|'not_configured'|'local_not_running'|'in_progress'|'still_working';
export const processingFailureMessages:Record<ProcessingFailure,string>={
 // accountRecovery.ts matches this exact sentence to resume recordings after sign-in.
 signed_out:'Sign in to process on this phone. Your recording is saved.',
 forbidden:'This account cannot prepare recordings. Your recording is saved. Sign in with your own account, then try again.',
 invalid_request:'This recording could not be sent. It is saved on this device. Try again, or record the section again.',
 too_large:'This recording is too long to send in one piece. It is saved on this device. Record the section again in shorter parts.',
 no_speech:'No speech was heard in this recording. It is saved on this device. Record the section again.',
 busy:'Too many recordings are being prepared right now. Yours is saved and will be tried again shortly.',
 failed:'Your words could not be prepared this time. Your recording is saved and will be tried again shortly.',
 timeout:'Preparing your words took too long. Your recording is saved and will be tried again shortly.',
 offline:'No connection right now. Your recording is saved and will be tried again when you are back online.',
 not_configured:'Preparing words is not set up yet. Your recording is saved on this device. Try again later.',
 local_not_running:'The speech service on this computer is not running. Your recording is saved. Start it, then choose Retry.',
 in_progress:'This recording is already being prepared. It is saved and will be tried again shortly.',
 still_working:'Your words are still being prepared. Your recording is saved and will be checked again shortly.',
};
const retryableFailures=new Set<ProcessingFailure>(['busy','failed','timeout','offline','in_progress','still_working']);
export class AuthoringServiceError extends Error {
 readonly failure?:ProcessingFailure;readonly retryable?:boolean;
 constructor(public readonly status:number,message:string,options:{failure?:ProcessingFailure;retryable?:boolean}={}){super(message);this.name='AuthoringServiceError';this.failure=options.failure;this.retryable=options.retryable;}
 /** The quiet detail shown after the sentence: the HTTP status, or offline/timeout when no response came back. */
 get detail(){return this.status?String(this.status):this.failure==='timeout'?'timeout':this.failure==='offline'?'offline':'';}
}
/** Server codes first (`{error,code,retryable}`), then the status, so an older server that sends neither still maps. */
export function processingFailure(status:number,code:unknown,local=false):ProcessingFailure{
 switch(code){
  case 'signed_out':return 'signed_out';case 'forbidden':return 'forbidden';case 'invalid_request':return 'invalid_request';
  case 'audio_too_large':case 'body_too_large':return 'too_large';case 'no_speech':return 'no_speech';
  case 'provider_busy':return 'busy';case 'provider_failed':return 'failed';case 'provider_timeout':return 'timeout';
  case 'not_configured':return local?'local_not_running':'not_configured';
 }
 if(status===401)return 'signed_out';if(status===403)return 'forbidden';if(status===413)return 'too_large';if(status===422)return 'no_speech';
 if(status===429)return 'busy';if(status===408||status===504)return 'timeout';if(status===409)return 'in_progress';
 if(status===503)return local?'local_not_running':'not_configured';if(status===404||status===405)return 'not_configured';
 return status>=500?'failed':'invalid_request';
}
export function processingError(status:number,failure:ProcessingFailure,retryable?:unknown){
 return new AuthoringServiceError(status,processingFailureMessages[failure],{failure,retryable:typeof retryable==='boolean'?retryable:retryableFailures.has(failure)});
}
export async function requestAuthoringProcessing(body:unknown):Promise<{status:number;value:any}>{
 const operation=(body as {operation?:string})?.operation;
 if(Capacitor.isNativePlatform()&&['writing-status','transcription-status'].includes(operation??'')&&loadMacBridge())return requestMacBridge(body);
 const local=!Capacitor.isNativePlatform()&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const path=local?'/api/oracle/authoring/ar-create':'/api/oracle/authoring/process';
 const transport=Capacitor.isNativePlatform()?createNativeAccountFetch():fetch;
 let response:Response;
 try{response=await transport(path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(110000)});}
 catch(error){
  const name=error&&typeof error==='object'&&'name' in error?String(error.name):'';
  throw processingError(0,name==='TimeoutError'||name==='AbortError'?'timeout':local?'local_not_running':'offline');
 }
 const value=await response.json().catch(()=>null);
 if(response.ok&&(!value||typeof value!=='object')){
  if(!local&&Capacitor.isNativePlatform()&&loadMacBridge())return requestMacBridge(body);
  throw processingError(503,local?'local_not_running':'not_configured');
 }
 if(!local&&Capacitor.isNativePlatform()&&[404,405,503].includes(response.status)&&loadMacBridge())return requestMacBridge(body);
 if(!response.ok){
  // The response body is never shown: it can be an HTML page or a provider's private detail.
  const fields=value&&typeof value==='object'&&!Array.isArray(value)?value as {code?:unknown;retryable?:unknown}:{};
  throw processingError(response.status,processingFailure(response.status,fields.code,local),fields.retryable);
 }
 return {status:response.status,value};
}
async function process(body:Record<string,unknown>):Promise<any>{
 let result=await requestAuthoringProcessing(body);const deadline=Date.now()+20*60*1000;
 while(result.status===202&&result.value?.pending===true){
   if(Date.now()>deadline)throw processingError(202,'still_working');
   await new Promise(resolve=>setTimeout(resolve,1500));
   const next=body.operation==='transcribe'?{operation:'transcription-status',sessionId:body.sessionId,captureId:body.captureId}:{operation:'writing-status',requestId:result.value.requestId};
   result=await requestAuthoringProcessing(next);
 }
 return result.value;
}
async function base64(blob:Blob){const bytes=new Uint8Array(await blob.arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(value);}
export const automaticTranscription:NonNullable<AuthoringServices['transcribe']>=async(session,capture,audio)=>{
 const markers=session.markers.filter(m=>m.captureId===capture.id),sectionId=markers.length===1&&markers[0].atMs===0?markers[0].sectionId:null;
 const source=[session.source,...session.relatedSources??[]].find(s=>s.cardNumber===(capture.visibleCardNumber??session.source.cardNumber))??session.source;
 const context={cardNumber:source.cardNumber,sectionTitles:cardSections(source).map(section=>section.title),glossary:['I Ching','Gene Keys','Human Design','hexagram','trigram','codon ring','Shadow','Gift','Siddhi']};
 const result=await process({context,operation:'transcribe',sessionId:session.reflectionSessionId??session.id,captureId:capture.id,audioBase64:await base64(audio),mimeType:audio.type,durationMs:capture.durationMs,sectionId});
 return {...result,segments:result.segments.map(segment=>({...segment,cardNumber:capture.visibleCardNumber??session.source.cardNumber}))};
};
export const automaticProposals:NonNullable<AuthoringServices['propose']>=async session=>(await process({operation:'propose',session})).proposals;
