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
/** Read incrementally, including chunked bodies: Content-Length alone is not a bound. */
export async function boundedJson(request: Request, limit: number): Promise<any> {
 if(Number(request.headers.get('Content-Length'))>limit)throw new Error('body_too_large');
 const reader=request.body?.getReader();if(!reader)throw new Error('invalid_json');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('body_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
/** 10 MiB of audio is at most 13.4 MiB of base64, so a longer string is too large, not malformed. */
export function decodeAudio(value:unknown):Uint8Array<ArrayBuffer> {
 if(typeof value==='string'&&value.length>14*1024*1024)throw Error('audio_too_large');
 if(typeof value!=='string'||!value.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('invalid_audio');
 const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));if(!bytes.length)throw Error('invalid_audio');if(bytes.length>10*1024*1024)throw Error('audio_too_large');return bytes;
}
export async function digest(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),b=>b.toString(16).padStart(2,'0')).join('');}
