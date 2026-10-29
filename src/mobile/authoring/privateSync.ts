import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { createNativeAccountFetch } from '../account/nativeAccountTransport';
import { exportBundle, importBundle } from '../../../lib/oracle/authoring/transfer';
import type { AuthoringStore } from '../../../lib/oracle/authoring/storage';
export interface ResumePosition { captureId?:string; positionMs:number; cardNumber:number; sectionId?:string; mode?:string }
export interface PrivateDocument { session: unknown; audio: {captureId:string;mimeType:string;hash:string}[]; format:string;version:number;reviewHash:string;receipts:unknown[]; resume:ResumePosition|null; workspace:Record<string,unknown> }
export interface RemoteCopy {revision:string|null;document:PrivateDocument|null}
export class PrivateSyncConflict extends Error { constructor(){super('Another device changed this session. Open its copy and choose what to keep. Your local version is safe.');} }
export class PrivateAuthoringSync {
 constructor(private readonly transport:(path:string,init?:RequestInit)=>Promise<Response>=Capacitor.isNativePlatform()?createNativeAccountFetch():fetch){}
 private async call(body:unknown){
  const response=await this.transport('/api/oracle/authoring/private',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const result=await response.json().catch(()=>null);
  if(response.status===409)throw new PrivateSyncConflict();
  if(!response.ok)throw Error(response.status===401?'Sign in to sync your private work. Your local copy is safe.':result?.error??'Private sync is unavailable. Your local copy is safe.');
  return result;
 }
 list(cursor?:string):Promise<{documents:{id:string;revision:string;updatedAt:string}[];cursor:string|null}>{return this.call({operation:'list',cursor});}
 read(id:string):Promise<RemoteCopy>{return this.call({operation:'read',id});}
 /** Caller retains the acknowledged revision per account+remote id. Never guess it from a local save version. */
 async save(store:AuthoringStore,sessionId:string,expectedRevision:string|null,resume:ResumePosition|null,workspace:Record<string,unknown>={},remoteId=sessionId):Promise<string>{
  const bundle=JSON.parse(await exportBundle(store,sessionId));
  for(const audio of bundle.audio)await this.call({operation:'audio-put',hash:audio.hash,mimeType:audio.mimeType,audioBase64:audio.base64});
  // A restored local copy has a fresh id. The remote document retains its stable id.
  const session={...bundle.session,id:remoteId};
  const {sha256}=await import('../../../lib/oracle/authoring/workflow');
  const document={...bundle,session,reviewHash:await sha256(JSON.stringify(session)),audio:bundle.audio.map(({base64,...audio}:any)=>audio),resume,workspace};
  return (await this.call({operation:'save',id:remoteId,expectedRevision,document})).revision;
 }
 /** Restore as a new local copy through the existing validated importer. No local overwrite, even after conflict. */
 async restore(store:AuthoringStore,id:string){
  const copy=await this.read(id);if(!copy.document||!copy.revision)throw Error('Private session was not found.');
  const audio=[];for(const item of copy.document.audio){const bytes=await this.call({operation:'audio-get',hash:item.hash});audio.push({...item,base64:bytes.audioBase64});}
  const saved=await importBundle(store,JSON.stringify({...copy.document,audio}));
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
