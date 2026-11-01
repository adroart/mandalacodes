import type { R2Bucket } from '@cloudflare/workers-types';
import { requireUser, type AuthEnv } from '../../_lib/auth';
export interface AuthoringEnv extends AuthEnv { ORACLE_PRIVATE?: R2Bucket; GROQ_API_KEY?: string; OPENAI_API_KEY?: string; ORACLE_WRITING_PROVIDER?: string; ORACLE_WRITING_MODEL?: string }
export interface Context { request: Request; env: AuthoringEnv }
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
export async function authorize(request: Request, env: AuthoringEnv) {
 const origin=request.headers.get('Origin');
 const permitted=['https://mandalacodes.com','https://www.mandalacodes.com','capacitor://localhost'];
 if(origin && !permitted.includes(origin) && !(env.BETTER_AUTH_URL?.includes('localhost') && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))return json({error:'origin_forbidden'},403);
 return requireUser(request,env);
}
/** Read incrementally, including chunked bodies: Content-Length alone is not a bound. */
export async function boundedJson(request: Request, limit: number): Promise<any> {
 if(Number(request.headers.get('Content-Length'))>limit)throw new Error('body_too_large');
 const reader=request.body?.getReader();if(!reader)throw new Error('invalid_json');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('body_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
export function decodeAudio(value:unknown):Uint8Array<ArrayBuffer> {
 if(typeof value!=='string'||!value.length||value.length>14*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('invalid_audio');
 const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));if(!bytes.length||bytes.length>10*1024*1024)throw Error('audio_too_large');return bytes;
}
export async function digest(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),b=>b.toString(16).padStart(2,'0')).join('');}
