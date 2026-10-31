import {describe,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {createNativeGoogleHandler} from '../../lib/account/nativeGoogleAuth.server.js';
const origin='https://mandalacodes.com';
const secret='test-only-secret-not-used-in-production';
const verifier='v'.repeat(43),state='s'.repeat(43);
const hash=async(s:string)=>Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('base64url');
function fixture(){
 let time=Date.now();const rows=new Map<string,any>();let signedIn=false;let previous=false;
 const adapter={
  createVerificationValue:vi.fn(async(row:any)=>{rows.set(row.identifier,{...row});return row;}),
  findVerificationValue:vi.fn(async(id:string)=>rows.get(id)),
  consumeVerificationValue:vi.fn(async(id:string)=>{const row=rows.get(id);rows.delete(id);return row;}),
 };
 const api={
  getSession:vi.fn(async()=>signedIn||previous?{user:{id:'test-user'},session:{id:previous?'old-session':'new-session',expiresAt:new Date(time+3600000)}}:null),
  signInSocial:vi.fn(async(_input: unknown)=>({response:{url:'https://accounts.google.com/o/oauth2/v2/auth?state=oauth-state'},headers:new Headers([['Set-Cookie','oauth=state; Secure; HttpOnly'],['Set-Cookie','other=value; Expires=Wed, 28 Oct 2026 23:59:59 GMT']])})),
  generateOneTimeToken:vi.fn(async()=>({token:'server-only-opaque-token'})),
  verifyOneTimeToken:vi.fn(async()=>({response:{session:{token:'never-return-this'}},headers:new Headers({'Set-Cookie':'session=native; HttpOnly; Secure; SameSite=Lax'})})),
 };
 const fakeFactory=()=>({$context:Promise.resolve({internalAdapter:adapter}),api});
 const handler=createNativeGoogleHandler(fakeFactory as unknown as Parameters<typeof createNativeGoogleHandler>[0],()=>time);
 const env={BETTER_AUTH_SECRET:secret,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-provider-secret'};
 const call=(action:string,request:Request)=>handler({request,env},action);
 const exchange=(code:string,overrides:Record<string,unknown>={},requestOrigin='capacitor://localhost')=>call('exchange',new Request(origin+'/api/auth/native/exchange',{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify({code,state,verifier,...overrides})}));
 async function start(){const challenge=await hash(verifier);const response=await call('start',new Request(`${origin}/api/auth/native/start?state=${state}&challenge=${challenge}`));const cookie=response.headers.getSetCookie().find(s=>s.startsWith('__Host-oracle_native_flow='))!.split(';')[0];return{response,cookie};}
 async function finish(cookie:string){signedIn=true;return call('complete',new Request(origin+'/api/auth/native/complete',{headers:{Cookie:cookie}}));}
 async function code(){const s=await start();const result=await finish(s.cookie);return new URL(result.headers.get('Location')!).searchParams.get('code')!;}
 return{rows,adapter,api,env,call,exchange,start,finish,code,advance:(ms:number)=>{time+=ms;},setPrevious:()=>{previous=true;}};
}
describe('native Google browser handoff',()=>{
 it('keeps OAuth in Google, preserves cookies and returns only a proof-bound handoff code',async()=>{
  const f=fixture();const {response,cookie}=await f.start();
  expect(response.status).toBe(302);expect(new URL(response.headers.get('Location')!).origin).toBe('https://accounts.google.com');
  expect(response.headers.getSetCookie()).toHaveLength(3);expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.getSetCookie().find(s=>s.startsWith('__Host-'))).toMatch(/Secure; HttpOnly; SameSite=Lax/);
  expect(f.api.signInSocial.mock.calls[0][0]).toMatchObject({body:{provider:'google',callbackURL:origin+'/api/auth/native/complete',disableRedirect:true}});
  const complete=await f.finish(cookie);const url=new URL(complete.headers.get('Location')!);
  expect(url.origin).toBe('null');expect(url.protocol).toBe('oracle:');expect(url.host).toBe('auth');expect(url.searchParams.get('state')).toBe(state);
  const code=url.searchParams.get('code')!;expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(url.href).not.toContain('server-only');
  expect(JSON.stringify([...f.rows.values()])).not.toContain('server-only-opaque-token');
  const exchanged=await f.exchange(code);expect(exchanged.status).toBe(200);expect(await exchanged.json()).toEqual({success:true});expect(exchanged.headers.getSetCookie()[0]).toContain('HttpOnly');
  expect((await f.exchange(code)).status).toBe(400);expect(f.api.verifyOneTimeToken).toHaveBeenCalledTimes(1);
  expect((await f.finish(cookie)).status).toBe(400);
 });
 it('rejects a wrong proof or state without consuming the valid attempt',async()=>{
  const f=fixture(),code=await f.code();
  expect((await f.exchange(code,{verifier:'x'.repeat(43)})).status).toBe(400);
  expect((await f.exchange(code,{state:'x'.repeat(43)})).status).toBe(400);
  expect(f.api.verifyOneTimeToken).not.toHaveBeenCalled();expect((await f.exchange(code)).status).toBe(200);
 });
 it('atomically consumes parallel exchanges once',async()=>{
  const f=fixture(),code=await f.code();const replies=await Promise.all([f.exchange(code),f.exchange(code)]);
  expect(replies.map(r=>r.status).sort()).toEqual([200,400]);expect(f.api.verifyOneTimeToken).toHaveBeenCalledTimes(1);
 });
 it('expires browser contexts and exchange codes',async()=>{
  const f=fixture();const {cookie}=await f.start();f.advance(600001);expect((await f.finish(cookie)).status).toBe(400);
  const g=fixture(),code=await g.code();g.advance(120001);expect((await g.exchange(code)).status).toBe(400);expect(g.api.verifyOneTimeToken).not.toHaveBeenCalled();
 });
 it('does not accept an old browser session as completion of the new Google flow',async()=>{
  const f=fixture();f.setPrevious();const {cookie}=await f.start();const done=await f.finish(cookie);
  expect(new URL(done.headers.get('Location')!).searchParams.get('error')).toBe('failed');expect(f.api.generateOneTimeToken).not.toHaveBeenCalled();
 });
 it('restricts exchange origin and rejects malformed or injected return paths',async()=>{
  const f=fixture(),code=await f.code();expect((await f.exchange(code,{},'https://evil.example')).status).toBe(403);
  expect((await f.call('exchange',new Request(origin+'/api/auth/native/exchange'))).status).toBe(405);
  const challenge=await hash(verifier);expect((await f.call('start',new Request(`${origin}/api/auth/native/start?state=${state}&challenge=${challenge}&callbackURL=https://evil.example`))).status).toBe(400);
  expect((await f.call('start',new Request(`https://evil.example/api/auth/native/start?state=${state}&challenge=${challenge}`))).status).toBe(403);
  expect(f.api.verifyOneTimeToken).not.toHaveBeenCalled();
 });
 it('rejects a foreign provider redirect and returns a safe native error',async()=>{
  const f=fixture();f.api.signInSocial.mockResolvedValueOnce({response:{url:'https://evil.example/auth'},headers:new Headers()});
  const result=await f.call('start',new Request(`${origin}/api/auth/native/start?state=${state}&challenge=${await hash(verifier)}`));
  const url=new URL(result.headers.get('Location')!);expect(url.host).toBe('auth');expect(url.searchParams.get('error')).toBe('failed');
 });
 it('rejects absent flow cookies and missing session cookies',async()=>{
  const f=fixture();expect((await f.call('complete',new Request(origin+'/api/auth/native/complete'))).status).toBe(400);
  const code=await f.code();f.api.verifyOneTimeToken.mockResolvedValueOnce({response:{session:{token:'never-return-this'}},headers:new Headers()});const result=await f.exchange(code);
  expect(result.status).toBe(400);expect(result.headers.has('Set-Cookie')).toBe(false);expect(await result.text()).not.toContain('never-return-this');
 });
});

// Exercise the real library contract without contacting Google or a live account.
it('starts Google through the installed Better Auth API and preserves its state cookie', async()=>{
 const handler=createNativeGoogleHandler();
 const response=await handler({request:new Request(`${origin}/api/auth/native/start?state=${state}&challenge=${await hash(verifier)}`),env:{BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:secret,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'}},'start');
 expect(response.status).toBe(302);
 const target=new URL(response.headers.get('Location')!);
 expect(target.origin).toBe('https://accounts.google.com');
 expect(target.searchParams.get('include_granted_scopes')).toBe('false');
 expect(target.searchParams.get('scope')?.split(' ').sort()).toEqual(['email','openid','profile']);
 expect(target.searchParams.get('code_challenge_method')).toBe('S256');
 expect(target.searchParams.get('redirect_uri')).toBe(origin+'/api/auth/callback/google');
 expect(response.headers.getSetCookie().some(cookie=>cookie.includes('oauth_state'))).toBe(true);
});

it('exchanges a real library session into a native cookie and rejects replay',async()=>{
 const {createAuth}=await import('../../lib/account/auth.server.js');
 const env={BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:secret,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'};
 const auth=createAuth(env);
 const handler=createNativeGoogleHandler(()=>auth);
 const start=await handler({request:new Request(`${origin}/api/auth/native/start?state=${state}&challenge=${await hash(verifier)}`),env},'start');
 const flowCookie=start.headers.getSetCookie().find(cookie=>cookie.startsWith('__Host-oracle_native_flow='))!.split(';')[0];
 // A fresh test-only session substitutes for Google's callback, without a network request.
 const signedIn=await auth.api.signUpEmail({body:{name:'Local test',email:`local-${Date.now()}@example.test`,password:'test-only-password'},returnHeaders:true});
 const cookies=[flowCookie,...signedIn.headers.getSetCookie().map(cookie=>cookie.split(';')[0])].join('; ');
 const complete=await handler({request:new Request(origin+'/api/auth/native/complete',{headers:{Cookie:cookies}}),env},'complete');
 const code=new URL(complete.headers.get('Location')!).searchParams.get('code');
 expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
 const request=()=>new Request(origin+'/api/auth/native/exchange',{method:'POST',headers:{Origin:'capacitor://localhost','Content-Type':'application/json'},body:JSON.stringify({code,state,verifier})});
 const exchanged=await handler({request:request(),env},'exchange');
 expect(exchanged.status).toBe(200);
 const nativeCookies=exchanged.headers.getSetCookie().map(cookie=>cookie.split(';')[0]).join('; ');
 const session=await auth.api.getSession({headers:new Headers({Cookie:nativeCookies})});
 expect(session?.user.id).toBe(signedIn.response.user.id);
 expect((await handler({request:request(),env},'exchange')).status).toBe(400);
});
