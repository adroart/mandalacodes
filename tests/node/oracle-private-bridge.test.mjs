import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPrivateBridge,loadPairingKey,BRIDGE_PATH } from '../../tools/oracle-private-bridge.mjs';
const token='a'.repeat(43),endpoint=`https://test.example.ts.net:8443${BRIDGE_PATH}`;
test('private bridge authenticates before forwarding, forbids other origins and exposes read-only capabilities',async()=>{
 let calls=0;
 const server=createPrivateBridge({token,endpoint,transcription:{handle:async()=>{calls++;return{status:200,body:{service:'AR Create',ready:true}};}},writing:{capabilities:async()=>({available:true})}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}${BRIDGE_PATH}`;
 try{
  const headers={'Content-Type':'application/json',Origin:'capacitor://localhost'};
  assert.equal((await fetch(url,{method:'POST',headers,body:'{"operation":"capabilities"}'})).status,401);assert.equal(calls,0);
  assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'https://evil.example',Authorization:`Bearer ${token}`},body:'{}'})).status,403);assert.equal(calls,0);
  const response=await fetch(url,{method:'POST',headers:{...headers,Authorization:`Bearer ${token}`},body:'{"operation":"capabilities"}'});assert.equal(response.status,200);assert.equal((await response.json()).phone.direct,true);assert.equal(calls,1);
  assert.equal((await fetch(url.replace(BRIDGE_PATH,'/pairing'),{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(url.replace(BRIDGE_PATH,'/pairing'),{headers:{'x-forwarded-for':'100.1.1.1'}})).status,403);
 }finally{await new Promise(r=>server.close(r));}
});
test('key creation is private and stable, insecure key file fails closed',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-bridge-'));try{const file=path.join(dir,'key');const first=await loadPairingKey(file);assert.equal(first.length,43);assert.equal(await loadPairingKey(file),first);assert.equal((await fs.stat(file)).mode&0o777,0o600);await fs.chmod(file,0o644);await assert.rejects(loadPairingKey(file),/0600/);}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('endpoint requires a private HTTPS tailnet address without userinfo',()=>{for(const invalid of ['http://test.ts.net'+BRIDGE_PATH,'https://evil.example'+BRIDGE_PATH,'https://user:pass@test.ts.net'+BRIDGE_PATH])assert.throws(()=>createPrivateBridge({token,endpoint:invalid}));});
