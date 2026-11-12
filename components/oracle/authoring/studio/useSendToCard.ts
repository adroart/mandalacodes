import {useEffect,useRef,useState} from 'react';
import {getSynthesis} from '../../../../data/synthesisData';
import {WorkingCardStore} from '../../../../lib/oracle/authoring/humanDrafts';
import {SectionDraftStore} from '../../../../lib/oracle/authoring/sectionDrafts';
import type {AuthoringServices,SourceSnapshot} from '../../../../lib/oracle/authoring/types';
import {buildVoiceBundle,serializeVoiceBundle,validateVoiceBundle,type VoiceBundle} from '../../../../lib/oracle/authoring/voiceExport';
import {handOffAuthoringFile,type AuthoringHandOff} from '../../../../src/mobile/authoring/nativeExport';
import {plural} from './format';

/**
 * "Send finished sections to the card": gathers the card's applied sections into one file and hands it
 * to the share sheet (phone) or a download (browser). It only reads the working card, the drafts and
 * nothing else; the one thing it writes is a small local note of what was last sent.
 */

/** What was last sent for one card: when, and each section with the hash of its applied words. */
export interface SentRecord{at:string;manuscript:string;sections:{id:string;sha256:string}[]}

type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
const defaultStorage=():Storage|null=>{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}};

export const sentKey=(cardNumber:number)=>`oracle.voice.sent.${cardNumber}`;

export function readSent(cardNumber:number,storage:Storage|null=defaultStorage()):SentRecord|null{
 try{
  const value=JSON.parse(storage?.getItem(sentKey(cardNumber))??'null');
  if(!value||typeof value.at!=='string'||!Array.isArray(value.sections))return null;
  return {at:value.at,manuscript:String(value.manuscript??''),sections:value.sections.filter((s:unknown):s is SentRecord['sections'][number]=>!!s&&typeof (s as {id?:unknown}).id==='string'&&typeof (s as {sha256?:unknown}).sha256==='string')};
 }catch{return null;}
}

export function sentRecordFor(bundle:VoiceBundle,at:string):SentRecord{
 return {at,manuscript:bundle.manuscript.sha256,sections:bundle.sections.map(s=>({id:s.id,sha256:s.applied.sha256}))};
}

/** Section ids in the bundle that were not in the last send, or whose words changed since. */
export function newSinceSent(bundle:VoiceBundle,sent:SentRecord|null):Set<string>{
 const before=new Map((sent?.sections??[]).map(s=>[s.id,s.sha256]));
 return new Set(bundle.sections.filter(s=>before.get(s.id)!==s.applied.sha256).map(s=>s.id));
}

const shortDate=(iso:string)=>new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

/** The one line of status under the settings row. */
export function sendStatus(bundle:VoiceBundle|null,sent:SentRecord|null,failed=false):string{
 if(failed)return 'Your sections could not be gathered. Nothing was sent.';
 if(!bundle)return 'Checking your sections.';
 const n=bundle.sections.length;
 if(!n)return 'Nothing to send yet. Apply a section first.';
 if(!sent)return `${plural(n,'section')} with your words ${n===1?'is':'are'} ready.`;
 const fresh=newSinceSent(bundle,sent).size;
 return `Sent ${plural(sent.sections.length,'section')} on ${shortDate(sent.at)}. ${fresh?`${fresh} more since then.`:'Nothing new since then.'}`;
}

/** `oracle-voice-card-02-2026-11-11.json`, dated by the local calendar. */
export function voiceFileName(cardNumber:number,now=new Date()):string{
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `oracle-voice-card-${pad(cardNumber)}-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}.json`;
}

export type SendOutcome=
 |{kind:'sent';record:SentRecord;how:AuthoringHandOff}
 |{kind:'cancelled'}
 |{kind:'unconfirmed'}
 |{kind:'invalid'}
 |{kind:'failed';message:string};

export interface SendDeps{
 build:()=>Promise<VoiceBundle>;
 handOff:(name:string,text:string,type:string)=>Promise<AuthoringHandOff>;
 storage?:Storage|null;
 now?:()=>Date;
}

/** Build, check, hand over, and only then remember. A cancelled or unconfirmed hand-off records nothing. */
export async function sendSectionsToCard(cardNumber:number,deps:SendDeps):Promise<SendOutcome>{
 const now=deps.now?.()??new Date();
 let bundle:VoiceBundle,text:string;
 try{
  bundle=await deps.build();
  if(!bundle.sections.length)return {kind:'invalid'};
  text=serializeVoiceBundle(bundle);
  await validateVoiceBundle(JSON.parse(text));
 }catch{return {kind:'invalid'};}
 let how:AuthoringHandOff;
 try{how=await deps.handOff(voiceFileName(cardNumber,now),text,'application/json');}
 catch(error){return {kind:'failed',message:error instanceof Error?error.message:'The file could not be handed over. Nothing was sent.'};}
 if(how==='cancelled')return {kind:'cancelled'};
 if(how==='opened')return {kind:'unconfirmed'};
 const record=sentRecordFor(bundle,now.toISOString());
 try{(deps.storage===undefined?defaultStorage():deps.storage)?.setItem(sentKey(cardNumber),JSON.stringify(record));}catch{/* The file left; only the note of it could not be kept. */}
 return {kind:'sent',record,how};
}

/** Gathers one card's applied sections from the app's private stores. */
export async function gatherVoiceBundle(cardNumber:number,services:Pick<AuthoringServices,'loadSource'>,stores:{working:Pick<WorkingCardStore,'list'>;drafts:Pick<SectionDraftStore,'list'>}={working:new WorkingCardStore(),drafts:new SectionDraftStore()}):Promise<VoiceBundle>{
 const [source,synthesis,working,sessions]=await Promise.all([services.loadSource(cardNumber),getSynthesis(cardNumber),stores.working.list(cardNumber),stores.drafts.list(cardNumber)]);
 return buildVoiceBundle({source,introText:synthesis?.summary,working,sessions});
}

export function outcomeMessage(outcome:SendOutcome):{text:string;alert:boolean}{
 switch(outcome.kind){
  case 'sent':return {alert:false,text:outcome.how==='downloaded'
   ?`Saved the file with ${plural(outcome.record.sections.length,'section')}. Open it on your Mac to put them into the card.`
   :`Sent ${plural(outcome.record.sections.length,'section')}. Open the file on your Mac to put them into the card.`};
  case 'cancelled':return {alert:false,text:'Nothing was sent.'};
  case 'unconfirmed':return {alert:false,text:'The share sheet opened, but the app cannot tell whether the file was saved, so nothing is marked as sent.'};
  case 'invalid':return {alert:true,text:'These sections could not be gathered safely, so nothing was sent.'};
  case 'failed':return {alert:true,text:outcome.message};
 }
}

export interface SendToCardOptions{
 source:SourceSnapshot;
 services:Pick<AuthoringServices,'loadSource'>;
 /** Recording settings is on screen. */
 visible:boolean;
 /** A recording is live. */
 recording:boolean;
 /** A section is still being prepared. */
 preparing:boolean;
}

export function useSendToCard({source,services,visible,recording,preparing}:SendToCardOptions){
 const cardNumber=source.cardNumber;
 const [bundle,setBundle]=useState<VoiceBundle|null>(null);
 const [failed,setFailed]=useState(false);
 const [sent,setSent]=useState<SentRecord|null>(()=>readSent(cardNumber));
 const [open,setOpen]=useState(false);
 const [sending,setSending]=useState(false);
 const [message,setMessage]=useState<{text:string;alert:boolean}|null>(null);
 const latest=useRef(0);

 useEffect(()=>{setSent(readSent(cardNumber));},[cardNumber]);
 useEffect(()=>{if(!visible){setOpen(false);setMessage(null);}},[visible]);
 useEffect(()=>{
  if(!visible)return;
  let alive=true;
  const working=new WorkingCardStore(),drafts=new SectionDraftStore();
  const refresh=()=>{const request=++latest.current;void gatherVoiceBundle(cardNumber,services,{working,drafts}).then(value=>{if(alive&&request===latest.current){setBundle(value);setFailed(false);}},()=>{if(alive&&request===latest.current){setBundle(null);setFailed(true);}});};
  refresh();
  const stop=[working.subscribe(refresh),drafts.subscribe(refresh)];
  return ()=>{alive=false;stop.forEach(s=>s());};
 },[visible,cardNumber,source.hash]);

 const blocked=recording?'Finish the recording before sending.':preparing?'Wait until every section is prepared.':'';
 const count=bundle?.sections.length??0;
 const send=async()=>{
  if(blocked||sending||!count)return;
  setSending(true);setMessage(null);
  try{
   const outcome=await sendSectionsToCard(cardNumber,{build:()=>gatherVoiceBundle(cardNumber,services),handOff:handOffAuthoringFile});
   if(outcome.kind==='sent')setSent(outcome.record);
   setMessage(outcomeMessage(outcome));
  }finally{setSending(false);}
 };
 return {
  open,setOpen:(value:boolean)=>{setOpen(value);setMessage(null);},
  bundle,failed,sent,count,blocked,sending,message,send,
  status:sendStatus(bundle,sent,failed),
  fresh:bundle&&sent?newSinceSent(bundle,sent):null,
 };
}

export type SendToCardState=ReturnType<typeof useSendToCard>;
