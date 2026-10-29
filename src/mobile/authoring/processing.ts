import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { requestMacBridge } from './bridgeConnection';
import type { AuthoringServices } from '../../../lib/oracle/authoring/types';
export class AuthoringServiceError extends Error { constructor(public readonly status:number,message:string){super(message);} }
async function request(body:unknown):Promise<{status:number;value:any}>{
 if(Capacitor.isNativePlatform()){try{return await requestMacBridge(body);}catch(error){throw new AuthoringServiceError(503,error instanceof Error?error.message:'Your Mac could not connect. Your recording is saved.');}}
 if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw new AuthoringServiceError(503,'AR Create runs on your Mac. Your recording is saved here; a private connection to that Mac is needed for phone processing.');
 const response=await fetch('/api/oracle/authoring/ar-create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const value=await response.json().catch(()=>null);
 if(!response.ok)throw new AuthoringServiceError(response.status,typeof value?.error==='string'?value.error:'AR Create could not finish. Your recording and words are saved.');
 return {status:response.status,value};
}
async function process(body:Record<string,unknown>):Promise<any>{
 let result=await request(body);const deadline=Date.now()+20*60*1000;
 while(result.status===202&&result.value?.pending===true){
   if(Date.now()>deadline)throw new AuthoringServiceError(202,'AR Create is still working. Your recording is saved; choose Try again to reconnect to its saved job.');
   await new Promise(resolve=>setTimeout(resolve,1500));
   const next=body.operation==='transcribe'?{operation:'transcription-status',sessionId:body.sessionId,captureId:body.captureId}:{operation:'writing-status',requestId:result.value.requestId};
   result=await request(next);
 }
 return result.value;
}
async function base64(blob:Blob){const bytes=new Uint8Array(await blob.arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(value);}
export const automaticTranscription:NonNullable<AuthoringServices['transcribe']>=async(session,capture,audio)=>{
 const markers=session.markers.filter(m=>m.captureId===capture.id),sectionId=markers.length===1&&markers[0].atMs===0?markers[0].sectionId:null;
 const result=await process({operation:'transcribe',sessionId:session.reflectionSessionId??session.id,captureId:capture.id,audioBase64:await base64(audio),mimeType:audio.type,durationMs:capture.durationMs,sectionId});
 return {...result,segments:result.segments.map(segment=>({...segment,cardNumber:capture.visibleCardNumber??session.source.cardNumber}))};
};
export const automaticProposals:NonNullable<AuthoringServices['propose']>=async session=>(await process({operation:'propose',session})).proposals;
