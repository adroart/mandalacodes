import { CapacitorHttp } from '../../../mobile/node_modules/@capacitor/core';
import type { HttpOptions, HttpResponse } from '../../../mobile/node_modules/@capacitor/core';
const KEY='oracle.privateMacBridge.v1';
export const BRIDGE_PATH='/api/oracle/authoring/ar-create';
export interface MacBridgeConnection { endpoint:string; token:string }
/** An explicitly paired HTTPS endpoint only. Never reinterpret phone localhost as the Mac. */
export function validateMacBridge(connection:MacBridgeConnection):MacBridgeConnection {
 let url:URL;try{url=new URL(connection.endpoint.trim());}catch{throw Error('Enter the private HTTPS address shown on your Mac.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!==BRIDGE_PATH||['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Use the full private HTTPS bridge address, without a password, query or fragment.');
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(connection.token.trim()))throw Error('Paste the pairing key shown on your Mac.');
 return {endpoint:url.href,token:connection.token.trim()};
}
export function loadMacBridge():MacBridgeConnection|null {try{const v=localStorage.getItem(KEY);return v?validateMacBridge(JSON.parse(v)):null;}catch{return null;}}
export function saveMacBridge(value:MacBridgeConnection){localStorage.setItem(KEY,JSON.stringify(validateMacBridge(value)));}
export function clearMacBridge(){localStorage.removeItem(KEY);}
export async function requestMacBridge(body:unknown,connection=loadMacBridge(),http:(options:HttpOptions)=>Promise<HttpResponse>=CapacitorHttp.request):Promise<{status:number;value:any}>{
 if(!connection)throw Error('Connect to your Mac to process this recording. Your audio is saved on this device.');
 const config=validateMacBridge(connection);
 let response:HttpResponse;
 try{response=await http({url:config.endpoint,method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Origin:'capacitor://localhost',Authorization:`Bearer ${config.token}`},data:body,responseType:'json',disableRedirects:true,connectTimeout:15000,readTimeout:30000});}catch{throw Error('Your Mac is unreachable. Keep it awake and connect both devices to your private Tailscale network. Your audio is saved.');}
 if((response.url&&response.url!==config.endpoint)||(response.status>=300&&response.status<400))throw Error('The bridge redirected. Check the original private address on your Mac.');
 const value=response.data;
 if(response.status<200||response.status>=300)throw Error(response.status===401?'The pairing key was not accepted. Copy the current key from your Mac.':typeof value?.error==='string'?value.error:'Your Mac could not finish. Your recording is saved.');
 return {status:response.status,value};
}
export async function testMacBridge(connection:MacBridgeConnection){
 const {value}=await requestMacBridge({operation:'capabilities'},connection);
 if(value?.service!=='AR Create'||value?.phone?.direct!==true)throw Error('This address did not confirm the private Oracle bridge.');
 return value as {ready:boolean;writing?:{available:boolean};transcription?:{problem?:string}};
}
