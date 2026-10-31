import { describe, expect, it, vi } from 'vitest';
import { createNativeAccountFetch, accountResult, ACCOUNT_ORIGIN, NATIVE_ORIGIN, type NativeHttp } from '../../src/mobile/account/nativeAccountTransport';
import { createProfileBackup, readProfileBackup } from '../../src/mobile/account/profileBackup';

const good = {status:200,headers:{'Set-Cookie':'private'},data:{ok:true},url:ACCOUNT_ORIGIN+'/api/profile/get'};
describe('native account transport boundary',()=>{
  it('pins origin, strips caller credentials and prevents redirects',async()=>{
    const request=vi.fn<NativeHttp>(async()=>good);
    const response=await createNativeAccountFetch(request,true)('/api/profile/put',{method:'PUT',headers:{Authorization:'caller-secret',Cookie:'caller-cookie'},body:'{"inputs":{}}'});
    expect(request.mock.calls[0][0]).toMatchObject({url:ACCOUNT_ORIGIN+'/api/profile/put',method:'PUT',data:{inputs:{}},disableRedirects:true,headers:{Origin:NATIVE_ORIGIN}});
    expect(request.mock.calls[0][0].headers).not.toHaveProperty('Authorization');
    expect(request.mock.calls[0][0].headers).not.toHaveProperty('Cookie');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({ok:true});
  });
  it.each(['https://other.example/api/profile/get','//other.example/api/profile/get','/api/profile/get?target=elsewhere','/api/auth/../profile/get','/api/admin/delete'])('rejects unsupported target %s before native IO',async path=>{
    const request=vi.fn<NativeHttp>(async()=>good);
    await expect(createNativeAccountFetch(request,true)(path)).rejects.toThrow('Unsupported');
    expect(request).not.toHaveBeenCalled();
  });
  it('uses the full processing timeout on iOS, whose bridge takes connectTimeout before readTimeout',async()=>{
    const request=vi.fn<NativeHttp>(async()=>good);
    await createNativeAccountFetch(request,true)('/api/oracle/authoring/process',{method:'POST',body:'{}'});
    expect(request.mock.calls[0][0]).toMatchObject({connectTimeout:110000,readTimeout:110000});
  });
  it('does not silently fall back to browser cookies',async()=>{
    const request=vi.fn<NativeHttp>(async()=>good);
    await expect(createNativeAccountFetch(request,false)('/api/profile/get')).rejects.toThrow('installed');
    expect(request).not.toHaveBeenCalled();
  });
  it('rejects redirects and aborted stale replies',async()=>{
    await expect(createNativeAccountFetch(async()=>({...good,status:302}),true)('/api/profile/get')).rejects.toThrow('redirected');
    const controller=new AbortController();
    const fetch=createNativeAccountFetch(async()=>{controller.abort();return good;},true);
    await expect(fetch('/api/profile/get',{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
  });
  it('converts no-content without fabricating a remote profile',async()=>{
    const response=await createNativeAccountFetch(async()=>({...good,status:204,data:''}),true)('/api/profile/get');
    expect(response.status).toBe(204);expect(await response.text()).toBe('');
  });
  it('explains pending native trust and rate limiting without leaking service responses',async()=>{
    await expect(accountResult(new Response(JSON.stringify({code:'INVALID_ORIGIN',message:'internal'}),{status:403}))).rejects.toThrow('not enabled');
    await expect(accountResult(new Response('{}',{status:429}))).rejects.toThrow('Too many');
  });
});
const inputs={date:'1990-06-15',time:'14:30',place:{label:'Jakarta',lat:-6.2,lng:106.8,tzId:'Asia/Jakarta'}};
describe('Birthday backup validation',()=>{
  it('round trips inputs only; ignores untrusted computed chart',()=>{
    const raw=JSON.parse(createProfileBackup(inputs));raw.computed={lifesWork:{gate:999}};
    expect(readProfileBackup(JSON.stringify(raw))).toEqual(inputs);
    expect(createProfileBackup(inputs)).not.toContain('computed');
  });
  it.each([
    {date:'1990-02-31'}, {time:'99:00'}, {place:{...inputs.place,tzId:'Not/AZone'}},
    {place:{...inputs.place,lat:91}}, {place:{...inputs.place,lng:Infinity}},
  ])('rejects invalid restored birth details %j',change=>{
    const text=JSON.stringify({format:'oracle-birthday',version:1,inputs:{...inputs,...change}});
    expect(()=>readProfileBackup(text)).toThrow();
  });
  it('rejects unrelated documents and oversized backups',()=>{
    expect(()=>readProfileBackup('{}')).toThrow();
    expect(()=>readProfileBackup('x'.repeat(100001))).toThrow('too large');
  });
});
