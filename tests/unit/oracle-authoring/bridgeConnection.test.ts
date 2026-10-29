import { describe,it,expect,vi } from 'vitest';
vi.mock('../../../mobile/node_modules/@capacitor/core',()=>({CapacitorHttp:{request:vi.fn()}}));
import { validateMacBridge,requestMacBridge } from '../../../src/mobile/authoring/bridgeConnection';
const connection={endpoint:'https://mac.example.ts.net:8443/api/oracle/authoring/ar-create',token:'a'.repeat(43)};
describe('explicit private Mac connection',()=>{
 it('requires HTTPS, exact route and no URL credentials',()=>{for(const endpoint of ['http://mac.ts.net/api/oracle/authoring/ar-create','https://user:pass@mac.ts.net/api/oracle/authoring/ar-create','https://localhost/api/oracle/authoring/ar-create',connection.endpoint+'?token=x'])expect(()=>validateMacBridge({...connection,endpoint})).toThrow();});
 it('uses native HTTP with bearer, exact endpoint and redirects disabled',async()=>{const http=vi.fn().mockResolvedValue({status:200,url:connection.endpoint,data:{ready:true},headers:{}});expect((await requestMacBridge({operation:'capabilities'},connection,http)).value.ready).toBe(true);expect(http).toHaveBeenCalledWith(expect.objectContaining({url:connection.endpoint,disableRedirects:true,headers:expect.objectContaining({Authorization:`Bearer ${connection.token}`,Origin:'capacitor://localhost'})}));});
 it('rejects redirects and changed final addresses',async()=>{for(const response of [{status:302,url:connection.endpoint,data:{}},{status:200,url:'https://other.example/',data:{}}])await expect(requestMacBridge({},connection,vi.fn().mockResolvedValue(response))).rejects.toThrow(/redirect/);});
 it('retains a clear connect prompt without a configured Mac',async()=>{await expect(requestMacBridge({},null)).rejects.toThrow(/audio is saved/);});
});
