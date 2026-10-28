import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createArCreateBridge,createArCreateMiddleware} from '../../tools/oracle-ar-create-bridge.mjs';
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
async function fixture(t,options={}) {
 const stateDir=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-ar-bridge-'));t.after(()=>fs.rm(stateDir,{recursive:true,force:true}));
 const sourceId=randomUUID(),jobId=randomUUID(),calls=[];
 const engine={ready:true,finish:true,started:false,imports:0,starts:0,loseImport:false,result:{segments:[{start:.1,end:1.7,text:'Synthetic original words.',speaker:'SPEAKER_00',words:[{start:.1,end:.4,word:'Synthetic',probability:.97}]}],metadata:{word_timestamps:'whisper-native',warnings:['Check uncertain speech.'],quality_flags:[]}}};
 const fetcher=async(url,init)=>{
   calls.push({url,init});assert.ok(url.startsWith('http://127.0.0.1:8841/'));assert.equal(init.redirect,'error');assert.equal(init.headers.Cookie,undefined);assert.equal(init.headers.cookie,undefined);
   if(init.method==='POST'){assert.equal(init.headers['X-AR-Actor'],'import:oracle');assert.equal(init.headers['X-AR-Client'],'http');}
   const route=new URL(url).pathname;
   if(route==='/api/capabilities')return reply({transcription:{ready:engine.ready,engine:'Magazine local intake/jobs/workshop/outputs'},retainedPrivateMetadata:'never return this'});
   if(route==='/api/sources/import'){engine.imports++;const b=JSON.parse(init.body);assert.equal(b.rootId,'library');assert.equal(b.folder,'Oracle');assert.equal(b.files.length,1);assert.deepEqual(b.urls,[]);if(engine.loseImport)throw new Error('response lost');return reply({receipts:[{ok:true,source:{id:sourceId,path:'/private/only-this-new-source'}}]});}
   if(route==='/api/recordings')return reply({jobs:[{id:randomUUID(),sourceId:randomUUID(),story:'private unrelated story'},{id:jobId,sourceId,state:'saved'}]});
   if(route===`/transcription/${jobId}/start`){engine.starts++;engine.started=true;return reply({job:{id:jobId,state:'running'}},202);}
   if(route===`/transcription/${jobId}`)return reply({job:{id:jobId,state:!engine.started?'saved':engine.finish?'done':'running',stage:'transcribe',transcriptReady:engine.started&&engine.finish},...(engine.started&&engine.finish?{result:engine.result}:{})});
   throw new Error('Unexpected AR path '+route);
 };
 const body={operation:'transcribe',sessionId:randomUUID(),captureId:randomUUID(),audioBase64:Buffer.from('synthetic-audio').toString('base64'),mimeType:'audio/webm',durationMs:2000,sectionId:'CODE'};
 return {stateDir,fetcher,body,sourceId,jobId,calls,engine,bridge:createArCreateBridge({stateDir,fetcher,pendingBudgetMs:0,...options})};
}
test('reuses existing AR import/start/result and preserves real segment/word offsets',async t=>{
 const f=await fixture(t);const value=await f.bridge.handle(f.body);assert.equal(value.status,200);assert.equal(f.engine.imports,1);assert.equal(f.engine.starts,1);assert.deepEqual(value.body.segments[0],{text:'Synthetic original words.',startMs:100,endMs:1700,sectionId:'CODE',timing:'provider',speaker:'SPEAKER_00',words:[{startMs:100,endMs:400,text:'Synthetic',probability:.97}]});assert.equal(value.body.arCreate.sourceId,f.sourceId);assert.equal(value.body.arCreate.jobId,f.jobId);assert.equal(JSON.stringify(value).includes('private unrelated'),false);assert.equal(JSON.stringify(value).includes('/private/'),false);
});
test('durable capture mapping survives adapter restart without another import or provider run',async t=>{
 const f=await fixture(t);const first=await f.bridge.handle(f.body);const total=f.calls.length;
 const resumed=createArCreateBridge({stateDir:f.stateDir,fetcher:f.fetcher,pendingBudgetMs:0});assert.deepEqual(await resumed.handle({operation:'transcription-status',sessionId:f.body.sessionId,captureId:f.body.captureId}),first);assert.equal(f.calls.length,total);assert.equal(f.engine.imports,1);
});
test('changed audio with a reused capture identity conflicts and preserves original connection',async t=>{
 const f=await fixture(t);await f.bridge.handle(f.body);const next=await f.bridge.handle({...f.body,audioBase64:Buffer.from('different-audio').toString('base64')});assert.equal(next.status,409);assert.equal(f.engine.imports,1);
});
test('bounded pending status resumes exact job without reupload or duplicate start',async t=>{
 const f=await fixture(t);f.engine.finish=false;const pending=await f.bridge.handle(f.body);assert.equal(pending.status,202);assert.equal(pending.body.pending,true);assert.equal(pending.body.jobId,f.jobId);
 f.engine.finish=true;const done=await f.bridge.handle({operation:'transcription-status',sessionId:f.body.sessionId,captureId:f.body.captureId});assert.equal(done.status,200);assert.equal(f.engine.imports,1);assert.equal(f.engine.starts,1);
});
test('unknown status never creates a recording',async t=>{
 const f=await fixture(t);const value=await f.bridge.handle({operation:'transcription-status',sessionId:f.body.sessionId,captureId:f.body.captureId});assert.equal(value.status,404);assert.equal(f.calls.length,0);
});
test('uncertain import outcomes fail closed rather than creating duplicate AR sources',async t=>{
 const f=await fixture(t);f.engine.loseImport=true;assert.equal((await f.bridge.handle(f.body)).status,503);f.engine.loseImport=false;assert.equal((await f.bridge.handle(f.body)).status,409);assert.equal(f.engine.imports,1);
});
test('unavailable capability, invalid encoding and invalid timing do not masquerade as transcripts',async t=>{
 const f=await fixture(t);f.engine.ready=false;assert.equal((await f.bridge.handle(f.body)).status,503);assert.equal(f.engine.imports,0);f.engine.ready=true;assert.equal((await f.bridge.handle({...f.body,audioBase64:'YQ==\n'})).status,400);assert.equal(f.engine.imports,0);f.engine.result.segments[0].start=-1;assert.equal((await f.bridge.handle(f.body)).status,502);
});
test('capability response exposes only relevant readiness, not unrelated app records',async t=>{
 const f=await fixture(t);const value=await f.bridge.handle({operation:'capabilities'});assert.equal(value.body.ready,true);assert.equal(value.body.phone.direct,false);assert.equal(JSON.stringify(value).includes('retainedPrivateMetadata'),false);
});
test('middleware enforces same-origin localhost and delegates bounded writing separately',async t=>{
 const f=await fixture(t);const middleware=createArCreateMiddleware({stateDir:f.stateDir,fetcher:f.fetcher,pendingBudgetMs:0,writingHandler:async body=>({status:200,body:{proposals:[],receivedOperation:body.operation}})});
 const server=http.createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/api/oracle/authoring/ar-create';
 let response=await fetch(url,{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify(f.body)});assert.equal(response.status,403);assert.equal(f.calls.length,0);
 response=await fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'never-forward=this'},body:JSON.stringify(f.body)});assert.equal(response.status,200);
 response=await fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({operation:'propose'})});assert.deepEqual(await response.json(),{proposals:[],receivedOperation:'propose'});
});
