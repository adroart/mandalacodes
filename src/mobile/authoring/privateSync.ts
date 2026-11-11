import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { createNativeAccountFetch } from '../account/nativeAccountTransport';
import { importBundle } from '../../../lib/oracle/authoring/transfer';
import type { AuthoringStore } from '../../../lib/oracle/authoring/storage';
export interface ResumePosition { captureId?:string; positionMs:number; cardNumber:number; sectionId?:string; mode?:string }
export interface PrivateDocument { session: unknown; audio: {captureId:string;mimeType:string;hash:string}[]; format:string;version:number;reviewHash:string;receipts:unknown[]; resume:ResumePosition|null; workspace:Record<string,unknown> }
export interface RemoteCopy {revision:string|null;document:PrivateDocument|null}
export class PrivateSyncConflict extends Error { constructor(){super('A newer copy exists on your account. Show the copies in your account and choose what to keep. Nothing on this phone has changed.');} }
/** The server asked for audio this phone believed it already held. The save did not commit. */
class MissingPrivateAudio extends Error {}
const MAX_AUDIO_BYTES=10*1024*1024;
async function audioHash(blob:Blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}
function base64(bytes:Uint8Array){let result='';for(let i=0;i<bytes.length;i+=16384)result+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(result);}
type AudioSource=Pick<AuthoringStore,'load'|'audio'|'receipts'>;
export class PrivateAuthoringSync {
 constructor(private readonly transport:(path:string,init?:RequestInit)=>Promise<Response>=Capacitor.isNativePlatform()?createNativeAccountFetch():fetch){}
 private async call(body:unknown){
  const response=await this.transport('/api/oracle/authoring/private',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const result=await response.json().catch(()=>null);
  if(response.status===409)throw new PrivateSyncConflict();
  if(response.status===400&&(result?.missingAudio===true||/Upload all private audio/.test(result?.error??'')))throw new MissingPrivateAudio();
  if(!response.ok)throw Error(response.status===401?'Sign in to keep a private copy. Everything is still on this phone.':result?.error??'Your account copy could not be reached. Everything is still on this phone.');
  return result;
 }
 list(cursor?:string):Promise<{documents:{id:string;revision:string;updatedAt:string}[];cursor:string|null}>{return this.call({operation:'list',cursor});}
 read(id:string):Promise<RemoteCopy>{return this.call({operation:'read',id});}
 /** Caller retains the acknowledged revision per account+remote id. Never guess it from a local save version.
  * With an accountId, each capture is uploaded at most once per account: hashes the server acknowledged are remembered locally.
  * A lost record only re-uploads; a record the server contradicts is forgotten and every capture is sent once more. */
 async save(store:AudioSource,sessionId:string,expectedRevision:string|null,resume:ResumePosition|null,workspace:Record<string,unknown>={},remoteId=sessionId,accountId?:string):Promise<string>{
  const saved=await store.load(sessionId);if(!saved)throw Error('Session not found');
  if(saved.session.captures.some(c=>c.status==='recording'))throw Error('Finish the current take before saving a copy.');
  const audio:{captureId:string;mimeType:string;hash:string}[]=[],blobs=new Map<string,Blob>();
  for(const capture of saved.session.captures.filter(c=>c.status!=='empty')){const blob=await store.audio(sessionId,capture.id),hash=await audioHash(blob);audio.push({captureId:capture.id,mimeType:capture.mimeType,hash});blobs.set(hash,blob);}
  // A restored local copy has a fresh id. The remote document retains its stable id.
  const session={...saved.session,id:remoteId};
  const {sha256}=await import('../../../lib/oracle/authoring/workflow');
  const document={format:'oracle-authoring-review',version:1,session,reviewHash:await sha256(JSON.stringify(session)),audio,receipts:await store.receipts(sessionId),resume,workspace};
  const upload=async(trustRecord:boolean)=>{
   const known=trustRecord&&accountId?knownPrivateAudio(accountId):new Set<string>(),sent=new Set<string>();
   for(const item of audio){
    if(known.has(item.hash)||sent.has(item.hash))continue;
    const blob=blobs.get(item.hash)!;if(blob.size>MAX_AUDIO_BYTES)throw Error('One recording is larger than 10 MB and cannot be copied. It is still on this phone.');
    // One capture per request; its bytes are encoded only for this request.
    const result=await this.call({operation:'audio-put',hash:item.hash,mimeType:item.mimeType,audioBase64:base64(new Uint8Array(await blob.arrayBuffer()))});
    sent.add(item.hash);if(accountId&&result?.hash===item.hash)rememberPrivateAudio(accountId,[item.hash]);
   }
  };
  const commit=async()=>(await this.call({operation:'save',id:remoteId,expectedRevision,document})).revision as string;
  await upload(true);
  try{return await commit();}
  catch(error){
   if(!(error instanceof MissingPrivateAudio))throw error;
   if(accountId)forgetPrivateAudio(accountId,audio.map(item=>item.hash));
   await upload(false);
   try{return await commit();}
   catch(again){if(again instanceof MissingPrivateAudio)throw Error('Your account could not keep every recording. Everything is still on this phone.');throw again;}
  }
 }
 /** Restore as a new local copy through the existing validated importer. No local overwrite, even after conflict. */
 async restore(store:AuthoringStore,id:string,accountId?:string){
  const copy=await this.read(id);if(!copy.document||!copy.revision)throw Error('This copy was not found in your account.');
  const audio=[];for(const item of copy.document.audio){const bytes=await this.call({operation:'audio-get',hash:item.hash});audio.push({...item,base64:bytes.audioBase64});}
  const saved=await importBundle(store,JSON.stringify({...copy.document,audio}));
  if(accountId)rememberPrivateAudio(accountId,copy.document.audio.map(item=>item.hash));
  return {saved,remoteId:id,revision:copy.revision,resume:copy.document.resume,workspace:copy.document.workspace};
 }
}

export interface PrivateSyncLink {remoteId:string;revision:string}
const LINK_KEY='oracle.privateSync.links.v1';
/** Account scoped acknowledgements only. Call after a successful save/restore, never on a conflict. */
export function loadPrivateSyncLink(accountId:string,localSessionId:string):PrivateSyncLink|null {
 try{const link=JSON.parse(localStorage.getItem(LINK_KEY)??'{}')[accountId]?.[localSessionId];return link&&typeof link.remoteId==='string'&&typeof link.revision==='string'?link:null;}catch{return null;}
}
export function acknowledgePrivateSync(accountId:string,localSessionId:string,link:PrivateSyncLink){
 if(!accountId||!localSessionId||!link.remoteId||!link.revision)throw Error('A signed-in account and saved revision are required.');
 let links:Record<string,Record<string,PrivateSyncLink>>={};try{links=JSON.parse(localStorage.getItem(LINK_KEY)??'{}');}catch{}
 links[accountId]??={};links[accountId][localSessionId]=link;localStorage.setItem(LINK_KEY,JSON.stringify(links));
}

const AUDIO_KEY='oracle.privateSync.audio.v1',AUDIO_RECORD_LIMIT=4000;
function readAudioRecord():Record<string,string[]>{try{const value=JSON.parse(localStorage.getItem(AUDIO_KEY)??'{}');return value&&typeof value==='object'?value:{};}catch{return {};}}
function writeAudioRecord(record:Record<string,string[]>){try{localStorage.setItem(AUDIO_KEY,JSON.stringify(record));}catch{/* A lost record only costs a re-upload. */}}
/** Audio hashes this account's server copy acknowledged. Advisory only: the server still checks every reference on save. */
export function knownPrivateAudio(accountId:string):Set<string>{const list=readAudioRecord()[accountId];return new Set(Array.isArray(list)?list.filter(hash=>typeof hash==='string'):[]);}
export function rememberPrivateAudio(accountId:string,hashes:string[]){
 if(!accountId)return;const record=readAudioRecord(),fresh=hashes.filter(hash=>/^[a-f0-9]{64}$/.test(hash));
 record[accountId]=[...[...knownPrivateAudio(accountId)].filter(hash=>!fresh.includes(hash)),...fresh].slice(-AUDIO_RECORD_LIMIT);writeAudioRecord(record);
}
export function forgetPrivateAudio(accountId:string,hashes?:string[]){
 const record=readAudioRecord();if(!hashes)delete record[accountId];else record[accountId]=[...knownPrivateAudio(accountId)].filter(hash=>!hashes.includes(hash));writeAudioRecord(record);
}
