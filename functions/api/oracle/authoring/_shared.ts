import type { Ai, R2Bucket } from '@cloudflare/workers-types';
import { requireAdmin, type AuthEnv } from '../../_lib/auth.ts';
/** AI is the Workers AI binding (wrangler.toml [ai]): the transcription fallback when Groq is busy or failing. Optional; without it a Groq failure is final, as before. */
export interface AuthoringEnv extends AuthEnv { ORACLE_PRIVATE?: R2Bucket; AI?: Ai; GROQ_API_KEY?: string; OPENAI_API_KEY?: string; ORACLE_WRITING_PROVIDER?: string; ORACLE_WRITING_MODEL?: string }
export interface Context { request: Request; env: AuthoringEnv }
export const json = (body: unknown, status = 200, headers: Record<string,string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...headers } });
/** Failure codes a client may retry unchanged, later: the provider was busy, failed or slow, or the hourly limit was reached. Never the request itself. */
const RETRYABLE=new Set(['provider_busy','provider_failed','provider_timeout','rate_limited']);
/** Every error carries a plain sentence, a stable code and whether sending the same request again can help. */
export const failure = (status: number, code: string, error: string, retryable = RETRYABLE.has(code), extra: Record<string,unknown> = {}, headers: Record<string,string> = {}) => json({ error, code, retryable, ...extra }, status, headers);
/** Owner only: the same admin guard as reflections and memos (verified email on ADMIN_EMAILS). The origin allowlist runs first. */
export async function authorize(request: Request, env: AuthoringEnv) {
 const origin=request.headers.get('Origin');
 const permitted=['https://mandalacodes.com','https://www.mandalacodes.com','capacitor://localhost'];
 if(origin && !permitted.includes(origin) && !(env.BETTER_AUTH_URL?.includes('localhost') && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))return failure(403,'origin_forbidden','This page is not allowed to use the voice workspace.');
 const auth=await requireAdmin(request,env);
 if(!(auth instanceof Response))return auth;
 return auth.status===401?failure(401,'signed_out','Sign in to use the voice workspace. Your work on this device is saved.'):failure(403,'forbidden','This account cannot use the voice workspace. Your work on this device is saved.');
}
/**
 * Read incrementally, including chunked bodies: Content-Length alone is not a bound. The body is gathered into one
 * buffer sized from Content-Length when given (grown by doubling otherwise), so the chunks are never held beside a
 * joined copy, and that buffer is unreachable once the text is decoded: a 13 MiB body peaks at the text plus the
 * parsed value, not four copies.
 */
export async function boundedJson(request: Request, limit: number): Promise<any> {
 const declared=Number(request.headers.get('Content-Length'));
 if(declared>limit)throw new Error('body_too_large');
 const reader=request.body?.getReader();if(!reader)throw new Error('invalid_json');
 return JSON.parse(await boundedText(reader,limit,declared>0?declared:64*1024));
}
async function boundedText(reader:ReadableStreamDefaultReader<Uint8Array>,limit:number,initial:number):Promise<string>{
 let bytes=new Uint8Array(Math.min(limit,initial)),size=0;
 for(;;){
  const {done,value}=await reader.read();if(done)break;
  if(size+value.byteLength>limit){await reader.cancel();throw new Error('body_too_large');}
  if(size+value.byteLength>bytes.length){const grown=new Uint8Array(Math.min(limit,Math.max(bytes.length*2,size+value.byteLength)));grown.set(bytes.subarray(0,size));bytes=grown;}
  bytes.set(value,size);size+=value.byteLength;
 }
 return new TextDecoder().decode(bytes.subarray(0,size));
}
export const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const MAX_AUDIO_BYTES=10*1024*1024;
/** Characters decoded per step on the chunked path: a multiple of 4, so each piece decodes exactly as it would inside the whole. */
export const DECODE_CHUNK_CHARS=64*1024;
/**
 * 10 MiB of audio is at most 13.4 MiB of base64, so a longer string is too large, not malformed. The decoded size is
 * known from the length, so an oversized recording is refused before anything is allocated. Decoding uses the
 * runtime's Uint8Array.fromBase64 where present, otherwise atob over 64 KiB pieces written straight into the result:
 * never a second full-size string, and no list of every byte.
 */
export function decodeAudio(value:unknown,chunkChars=DECODE_CHUNK_CHARS):Uint8Array<ArrayBuffer> {
 if(typeof value==='string'&&value.length>14*1024*1024)throw Error('audio_too_large');
 if(typeof value!=='string'||!value.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('invalid_audio');
 const padding=value.endsWith('==')?2:value.endsWith('=')?1:0,size=Math.floor((value.length-padding)*3/4);
 if(size>MAX_AUDIO_BYTES)throw Error('audio_too_large');if(!size)throw Error('invalid_audio');
 const native=(Uint8Array as unknown as {fromBase64?:(text:string)=>Uint8Array<ArrayBuffer>}).fromBase64;
 if(typeof native==='function'){const bytes=native.call(Uint8Array,value);if(!bytes.length)throw Error('invalid_audio');if(bytes.length>MAX_AUDIO_BYTES)throw Error('audio_too_large');return bytes;}
 if(chunkChars<=0||chunkChars%4)throw Error('invalid_chunk');
 const bytes=new Uint8Array(size);let offset=0;
 for(let at=0;at<value.length;at+=chunkChars){const piece=atob(value.slice(at,at+chunkChars));if(offset+piece.length>size)throw Error('invalid_audio');for(let k=0;k<piece.length;k+=1)bytes[offset++]=piece.charCodeAt(k);}
 if(offset!==size)throw Error('invalid_audio');
 return bytes;
}
export async function digest(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),b=>b.toString(16).padStart(2,'0')).join('');}
