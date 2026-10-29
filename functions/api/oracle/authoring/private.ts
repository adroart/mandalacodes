import { authorize, boundedJson, decodeAudio, digest, json, validId, type Context } from './_shared';
/** Owner-scoped R2 objects only. Conditional writes atomically reject stale devices. */
export async function onRequestPost({request,env}:Context){
 const auth=await authorize(request,env);if(auth instanceof Response)return auth;
 if(!env.ORACLE_PRIVATE)return json({error:'Private storage is not configured.'},503);
 try{
  const body=await boundedJson(request,15*1024*1024);const bucket=env.ORACLE_PRIVATE;
  const prefix=`authoring/${encodeURIComponent(auth.userId)}/`;
  if(body.operation==='list'){
   const listed=await bucket.list({prefix:prefix+'sessions/',limit:100,cursor:typeof body.cursor==='string'?body.cursor:undefined});
   return json({documents:listed.objects.map(o=>({id:o.key.slice((prefix+'sessions/').length),revision:o.etag,updatedAt:o.uploaded.toISOString()})),cursor:listed.truncated?listed.cursor:null});
  }
  if(body.operation==='audio-put'||body.operation==='audio-get'){
   if(typeof body.hash!=='string'||!/^[a-f0-9]{64}$/.test(body.hash))return json({error:'Invalid audio hash.'},400);
   const key=prefix+'audio/'+body.hash;
   if(body.operation==='audio-get'){
    const object=await bucket.get(key);if(!object)return json({error:'Private audio not found.'},404);
    const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return json({audioBase64:btoa(binary),mimeType:object.httpMetadata?.contentType??'audio/webm'});
   }
   if(typeof body.mimeType!=='string'||(body.mimeType.length>160||!/^audio\/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9=._, -]+)?$/.test(body.mimeType)))return json({error:'Invalid audio type.'},400);
   const bytes=decodeAudio(body.audioBase64);if(await digest(bytes)!==body.hash)return json({error:'Audio hash mismatch.'},400);
   await bucket.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:body.mimeType}});
   return json({ok:true,hash:body.hash});
  }
  if(!validId(body.id))return json({error:'Invalid session id.'},400);
  const key=prefix+'sessions/'+body.id;
  if(body.operation==='read'){
   const object=await bucket.get(key);return object?json({revision:object.etag,document:await object.json()}):json({revision:null,document:null});
  }
  if(body.operation!=='save')return json({error:'Unknown operation.'},400);
  const document=body.document;
  if(!document||document.session?.id!==body.id||document.session?.schema!==1||!Array.isArray(document.audio)||document.audio.length>100||new TextEncoder().encode(JSON.stringify(document)).byteLength>2*1024*1024)return json({error:'Invalid document.'},400);
  if(body.expectedRevision!==null&&(typeof body.expectedRevision!=='string'||!body.expectedRevision.length))return json({error:'A previous revision is required.'},400);
  for(const audio of document.audio){if(!validId(audio.captureId)||!/^[a-f0-9]{64}$/.test(audio.hash)||!await bucket.head(prefix+'audio/'+audio.hash))return json({error:'Upload all private audio before saving.'},400);}
  const result=await bucket.put(key,JSON.stringify(document),{onlyIf:body.expectedRevision===null?{etagDoesNotMatch:'*'}:{etagMatches:body.expectedRevision},httpMetadata:{contentType:'application/json'}});
  if(!result)return json({error:'Another device changed this session. Load its copy before choosing which changes to keep.',conflict:true},409);
  return json({revision:result.etag});
 }catch(error){return json({error:error instanceof Error&&error.message==='body_too_large'?'Upload exceeds the private storage limit.':'Private sync could not finish. Your local work is safe.'},400);}
}
