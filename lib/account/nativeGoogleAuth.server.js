import { createAuth } from './auth.server.js';
import { checkRateLimit, clientIp, tooManyRequests } from '../../functions/api/_lib/rate-limit.js';

const ORIGIN = 'https://mandalacodes.com';
const COOKIE = '__Host-oracle_native_flow';
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const sha = async value => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const validState = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
const validChallenge = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const headers = () => new Headers({'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff'});
function json(value, status = 200) { const h=headers();h.set('Content-Type','application/json');return new Response(JSON.stringify(value),{status,headers:h}); }
function browserCookie(value, age) { return `${COOKIE}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`; }
function copyCookies(source, destination) {
  const cookies = source?.getSetCookie?.() ?? source?.getAll?.('Set-Cookie') ?? [];
  if (!cookies.length && source?.has('set-cookie')) throw new Error('Cookie forwarding is unavailable');
  for (const cookie of cookies) destination.append('Set-Cookie',cookie);
  return cookies.length;
}
function back(state, code, error) {
  const target = new URL('oracle://auth');target.searchParams.set('state',state);target.searchParams.set(code ? 'code':'error',code || error || 'failed');
  const h=headers();h.set('Location',target.href);h.append('Set-Cookie',browserCookie('',0));return new Response(null,{status:302,headers:h});
}
async function encryptionKey(secret) {
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('Authentication not configured');
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`oracle-native-handoff-v1:${secret}`));
  return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function seal(value, secret) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(secret),new TextEncoder().encode(JSON.stringify(value)));
  return `${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}
async function open(value, secret) {
  const [iv,body]=value.split('.');
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await encryptionKey(secret),unb64(body))));
}
const unexpired = (row, now) => row && new Date(row.expiresAt).getTime() > now();

/** Uses the existing auth verification store. Flow and handoff rows are opaque,
 * expire quickly, and consume atomically through Better Auth's D1 adapter.
 * Browser OAuth cookies never have to be copied into the app's web view. */
export function createNativeGoogleHandler(authFactory = createAuth, now = Date.now) {
  return async (context, action) => {
    const {request,env}=context;
    const url=new URL(request.url);
    if (url.origin !== ORIGIN) return json({error:'invalid_host'},403);
    if (request.method !== (action === 'exchange' ? 'POST':'GET')) return json({error:'method_not_allowed'},405);
    if (action === 'exchange' && request.headers.get('Origin') !== 'capacitor://localhost') return json({error:'invalid_origin'},403);
    if (action === 'exchange' && !request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({error:'invalid_request'},400);
    let state;
    try {
      if (action === 'start') {
        state=url.searchParams.get('state');const challenge=url.searchParams.get('challenge');
        if (!validState(state) || !validChallenge(challenge) || Array.from(url.searchParams.keys()).length !== 2) return json({error:'invalid_request'},400);
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return back(state,null,'unavailable');
        const rate=await checkRateLimit(env,`auth:native-start:${clientIp(request)}`,{limit:20,windowMs:600000});
        if (!rate.ok) return tooManyRequests(rate.retryAfterSec);
        const auth=authFactory(env,context.waitUntil?.bind(context));const adapter=(await auth.$context).internalAdapter;
        const flow=random();
        const previousSession=await auth.api.getSession({headers:request.headers});
        await adapter.createVerificationValue({identifier:`oracle-native-flow:${await sha(flow)}`,value:JSON.stringify({state,challenge,previousSessionId:previousSession?.session?.id ?? null}),expiresAt:new Date(now()+600000)});
        const response=await auth.api.signInSocial({headers:request.headers,body:{provider:'google',callbackURL:`${ORIGIN}/api/auth/native/complete`,errorCallbackURL:`${ORIGIN}/api/auth/native/complete?failed=1`,disableRedirect:true},returnHeaders:true});
        const destination=new URL(response.response?.url);
        if (destination.protocol !== 'https:' || destination.hostname !== 'accounts.google.com' || destination.username || destination.password || destination.port) throw new Error('Invalid provider redirect');
        const h=headers();copyCookies(response.headers,h);h.append('Set-Cookie',browserCookie(flow,600));h.set('Location',destination.href);
        return new Response(null,{status:302,headers:h});
      }
      const auth=authFactory(env,context.waitUntil?.bind(context));const adapter=(await auth.$context).internalAdapter;
      if (action === 'complete') {
        const cookies=(request.headers.get('Cookie') || '').split(';').map(x=>x.trim()).filter(x=>x.startsWith(`${COOKIE}=`));
        const flow=cookies.length === 1 ? cookies[0].slice(COOKIE.length+1) : '';
        if (!validChallenge(flow)) return json({error:'expired_sign_in'},400);
        const row=await adapter.consumeVerificationValue(`oracle-native-flow:${await sha(flow)}`);
        if (!unexpired(row,now)) return json({error:'expired_sign_in'},400);
        const data=JSON.parse(row.value);state=data.state;
        if (!validState(state) || !validChallenge(data.challenge)) return json({error:'invalid_sign_in'},400);
        if (url.searchParams.has('failed') || url.searchParams.has('error')) return back(state,null,'cancelled');
        const session=await auth.api.getSession({headers:request.headers});
        if (!session?.user?.id || !session?.session?.id || session.session.id === data.previousSessionId || new Date(session.session.expiresAt).getTime() <= now()) return back(state,null,'failed');
        const minted=await auth.api.generateOneTimeToken({headers:request.headers});
        if (!minted?.token) return back(state,null,'failed');
        const code=random();
        await adapter.createVerificationValue({identifier:`oracle-native-code:${await sha(code)}:${data.challenge}`,value:await seal({state,token:minted.token},env.BETTER_AUTH_SECRET),expiresAt:new Date(now()+120000)});
        return back(state,code);
      }
      if (action === 'exchange') {
        const raw=await request.text();if(raw.length>2048) return json({error:'invalid_request'},400);
        const data=JSON.parse(raw);
        if (!validChallenge(data.code) || !validState(data.state) || typeof data.verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(data.verifier)) return json({error:'invalid_request'},400);
        const rate=await checkRateLimit(env,`auth:native-exchange:${clientIp(request)}`,{limit:30,windowMs:600000});
        if (!rate.ok) return tooManyRequests(rate.retryAfterSec);
        const identifier=`oracle-native-code:${await sha(data.code)}:${await sha(data.verifier)}`;
        const found=await adapter.findVerificationValue(identifier);
        if (!unexpired(found,now)) return json({error:'invalid_sign_in'},400);
        const material=await open(found.value,env.BETTER_AUTH_SECRET);
        if (material.state !== data.state) return json({error:'invalid_sign_in'},400);
        const consumed=await adapter.consumeVerificationValue(identifier);
        if (!unexpired(consumed,now) || consumed.value !== found.value) return json({error:'invalid_sign_in'},400);
        const result=await auth.api.verifyOneTimeToken({headers:request.headers,body:{token:material.token},returnHeaders:true});
        const h=headers();h.set('Content-Type','application/json');
        if (!copyCookies(result.headers,h)) throw new Error('Missing session cookie');
        return new Response(JSON.stringify({success:true}),{status:200,headers:h});
      }
      return json({error:'not_found'},404);
    } catch {
      if (action !== 'exchange' && validState(state)) return back(state,null,'failed');
      return json({error:'invalid_sign_in'},400);
    }
  };
}
export const nativeGoogleAuth = createNativeGoogleHandler();
