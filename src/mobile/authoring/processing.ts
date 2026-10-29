import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { loadMacBridge, requestMacBridge } from './bridgeConnection';
import { createNativeAccountFetch } from '../account/nativeAccountTransport';
import { cardSections } from '../../../lib/oracle/authoring/cardSections';
import type { AuthoringServices } from '../../../lib/oracle/authoring/types';
export class AuthoringServiceError extends Error { constructor(public readonly status:number,message:string){super(message);} }
export async function requestAuthoringProcessing(body:unknown):Promise<{status:number;value:any}>{
 const operation=(body as {operation?:string})?.operation;
 if(Capacitor.isNativePlatform()&&['writing-status','transcription-status'].includes(operation??'')&&loadMacBridge())return requestMacBridge(body);
 const local=!Capacitor.isNativePlatform()&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const path=local?'/api/oracle/authoring/ar-create':'/api/oracle/authoring/process';
 const transport=Capacitor.isNativePlatform()?createNativeAccountFetch():fetch;
 const response=await transport(path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(110000)});
 const value=await response.json().catch(()=>null);
 if(response.ok&&(!value||typeof value!=='object')){
  if(!local&&Capacitor.isNativePlatform()&&loadMacBridge())return requestMacBridge(body);
  throw new AuthoringServiceError(503,'Hosted processing is not available yet. Your local recording and words are saved.');
 }
 if(!local&&Capacitor.isNativePlatform()&&[404,405,503].includes(response.status)&&loadMacBridge())return requestMacBridge(body);
 if(!response.ok)throw new AuthoringServiceError(response.status,response.status===401?'Sign in to process on this phone. Your recording is saved.':typeof value?.error==='string'?value.error:'AR Create could not finish. Your recording and words are saved.');
 return {status:response.status,value};
}
async function process(body:Record<string,unknown>):Promise<any>{
 let result=await requestAuthoringProcessing(body);const deadline=Date.now()+20*60*1000;
 while(result.status===202&&result.value?.pending===true){
   if(Date.now()>deadline)throw new AuthoringServiceError(202,'AR Create is still working. Your recording is saved; choose Try again to reconnect to its saved job.');
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
