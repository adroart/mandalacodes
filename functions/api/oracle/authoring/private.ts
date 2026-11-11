import { authorize, boundedJson, decodeAudio, digest, failure, json, validId, type Context } from './_shared';
import { betterKeyOf, cleanTakeDetails, DETAILS_VERSION, parseStoredBetter } from '../pickup/takes/_shared';
const invalid=(error:string)=>failure(400,'invalid_request',error);
const HASH=/^[a-f0-9]{64}$/;
/** A list of distinct audio hashes, at most `max`, or null. */
const hashList=(value:unknown,max:number):string[]|null=>Array.isArray(value)&&value.length<=max&&value.every(h=>typeof h==='string'&&HASH.test(h))?[...new Set(value as string[])]:null;
/** Better transcripts handed back in one reply, at most this many bytes; the rest are named in `more` for another call. */
const BETTER_REPLY_BYTES=8*1024*1024;
/** Owner-scoped R2 objects only. Conditional writes atomically reject stale devices. */
export async function onRequestPost({request,env}:Context){
 const auth=await authorize(request,env);if(auth instanceof Response)return auth;
 if(!env.ORACLE_PRIVATE)return failure(503,'not_configured','Private storage is not configured. Your local work is safe.');
 try{
  const body=await boundedJson(request,15*1024*1024);const bucket=env.ORACLE_PRIVATE;
  const prefix=`authoring/${encodeURIComponent(auth.userId)}/`;
  if(body.operation==='list'){
   const listed=await bucket.list({prefix:prefix+'sessions/',limit:100,cursor:typeof body.cursor==='string'?body.cursor:undefined});
   return json({documents:listed.objects.map(o=>({id:o.key.slice((prefix+'sessions/').length),revision:o.etag,updatedAt:o.uploaded.toISOString()})),cursor:listed.truncated?listed.cursor:null});
  }
  if(body.operation==='audio-has'){
   // Which of these the account already holds, so a phone that lost its own record does not upload everything again.
   const hashes=hashList(body.hashes,100);if(!hashes)return invalid('Send at most 100 audio hashes.');
   const present:string[]=[];
   for(let i=0;i<hashes.length;i+=10)await Promise.all(hashes.slice(i,i+10).map(async hash=>{if(await bucket.head(prefix+'audio/'+hash))present.push(hash);}));
   return json({present:hashes.filter(hash=>present.includes(hash))});
  }
  if(body.operation==='better-get'){
   // The Mac's better transcripts for this account's own recordings. Only the caller's prefix is read.
   const hashes=hashList(body.hashes,50);if(!hashes)return invalid('Send at most 50 audio hashes.');
   const user=encodeURIComponent(auth.userId),results:unknown[]=[],skipped:string[]=[],more:string[]=[];let size=0;
   for(const hash of hashes){
    if(size>=BETTER_REPLY_BYTES){more.push(hash);continue;}
    const object=await bucket.get(betterKeyOf(user,hash));if(!object)continue;
    const record=parseStoredBetter(await object.json().catch(()=>null));if(!record||record.audioHash!==hash)continue;
    if(record.outcome==='skipped'){skipped.push(hash);continue;}
    const {format:_format,version:_version,reason:_reason,outcome:_outcome,audioHash:_audioHash,...rest}=record;
    const entry={hash,...rest};const bytes=JSON.stringify(entry).length;
    if(size+bytes>BETTER_REPLY_BYTES&&results.length){more.push(hash);size=BETTER_REPLY_BYTES;continue;}
    results.push(entry);size+=bytes;
   }
   return json({results,skipped,more});
  }
  if(body.operation==='audio-put'||body.operation==='audio-get'){
   if(typeof body.hash!=='string'||!HASH.test(body.hash))return invalid('Invalid audio hash.');
   const key=prefix+'audio/'+body.hash;
   if(body.operation==='audio-get'){
    const object=await bucket.get(key);if(!object)return failure(404,'not_found','Private audio not found.');
    const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return json({audioBase64:btoa(binary),mimeType:object.httpMetadata?.contentType??'audio/webm'});
   }
   if(typeof body.mimeType!=='string'||(body.mimeType.length>160||!/^audio\/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9=._, -]+)?$/.test(body.mimeType)))return invalid('Invalid audio type.');
   const bytes=decodeAudio(body.audioBase64);if(await digest(bytes)!==body.hash)return invalid('Audio hash mismatch.');
   // What the Mac needs to transcribe it and the phone needs to match the result. Invalid fields are dropped, never stored.
   const customMetadata=body.details===undefined?undefined:cleanTakeDetails(body.details);
   const written=await bucket.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:body.mimeType},...(customMetadata?{customMetadata}:{})});
   if(!written&&customMetadata){
    // Already held. An object kept before details existed gets them now; the bytes are the same, their hash says so.
    const held=await bucket.head(key);
    if(held&&held.customMetadata?.v!==DETAILS_VERSION)await bucket.put(key,bytes,{onlyIf:{etagMatches:held.etag},httpMetadata:{contentType:held.httpMetadata?.contentType??body.mimeType},customMetadata});
   }
   return json({ok:true,hash:body.hash});
  }
  if(!validId(body.id))return invalid('Invalid session id.');
  const key=prefix+'sessions/'+body.id;
  if(body.operation==='read'){
   const object=await bucket.get(key);return object?json({revision:object.etag,document:await object.json()}):json({revision:null,document:null});
  }
  if(body.operation!=='save')return invalid('Unknown operation.');
  const document=body.document;
  if(!document||document.session?.id!==body.id||document.session?.schema!==1||!Array.isArray(document.audio)||document.audio.length>100)return invalid('Invalid document.');
  if(new TextEncoder().encode(JSON.stringify(document)).byteLength>2*1024*1024)return failure(413,'body_too_large','This session is too large to save privately. Your local work is safe.');
  if(body.expectedRevision!==null&&(typeof body.expectedRevision!=='string'||!body.expectedRevision.length))return invalid('A previous revision is required.');
  for(const audio of document.audio){if(!validId(audio.captureId)||!HASH.test(audio.hash)||!await bucket.head(prefix+'audio/'+audio.hash))return failure(400,'invalid_request','Upload all private audio before saving.',false,{missingAudio:true});}
  const result=await bucket.put(key,JSON.stringify(document),{onlyIf:body.expectedRevision===null?{etagDoesNotMatch:'*'}:{etagMatches:body.expectedRevision},httpMetadata:{contentType:'application/json'}});
  if(!result)return failure(409,'conflict','Another device changed this session. Load its copy before choosing which changes to keep.',false,{conflict:true});
  return json({revision:result.etag});
 }catch(error){
  const reason=error instanceof Error?error.message:'';
  if(reason==='body_too_large')return failure(413,'body_too_large','Upload exceeds the private storage limit. Your local work is safe.');
  if(reason==='audio_too_large')return failure(413,'audio_too_large','This recording is too large to store privately in one piece. Your local work is safe.');
  return invalid('Private sync could not finish. Your local work is safe.');
 }
}
