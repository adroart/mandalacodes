import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createArCreateWriting} from '../../tools/oracle-ar-create-writing.mjs';
const source={cardNumber:1,revision:'fixture',markdown:'Original.',hash:createHash('sha256').update('Original.').digest('hex'),sections:[{id:'CODE',title:'Code',start:0,end:9}]};
const session={source,transcript:[{id:'t1',raw:'Spoken.',corrected:'Spoken.',sectionId:'CODE',order:0}]};
const proposal={sectionId:'CODE',text:'Revised.',evidenceIds:['t1'],feedback:{changes:'Clarified.',uncertainWords:'',omissions:'',contradictions:'',unsupportedAdditions:''}};
function fixture(t,execute){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oracle-writing-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return createArCreateWriting({stateDir:dir,execute});}
test('existing runner returns validated proposals and repeated requests reuse their receipt',async t=>{let calls=0;const bridge=fixture(t,async()=>{calls++;return{response:{artifacts:{'proposals.json':JSON.stringify({proposals:[proposal]})}},model:'fixture model'};});const start=await bridge.handle({operation:'propose',session});assert.equal(start.status,202);await bridge.wait(start.body.requestId);const result=await bridge.handle({operation:'writing-status',requestId:start.body.requestId});assert.equal(result.status,200);assert.equal(result.body.proposals[0].author.provider,'AR Create · Codex');assert.equal((await bridge.handle({operation:'propose',session})).status,200);assert.equal(calls,1);});
test('unassigned evidence and unsafe provider output never become writing',async t=>{const bridge=fixture(t,async()=>({response:{artifacts:{'proposals.json':JSON.stringify({proposals:[{...proposal,evidenceIds:['invented']}]})}}}));assert.equal((await bridge.handle({operation:'propose',session:{...session,transcript:[{...session.transcript[0],sectionId:null}]}})).status,400);const start=await bridge.handle({operation:'propose',session});await bridge.wait(start.body.requestId);assert.equal((await bridge.handle({operation:'writing-status',requestId:start.body.requestId})).status,503);});
test('polling unknown or hostile identities cannot create or read jobs',async t=>{let calls=0;const bridge=fixture(t,async()=>{calls++;});assert.equal((await bridge.handle({operation:'writing-status',requestId:'../../outside'})).status,404);assert.equal(calls,0);assert.equal(await bridge.handle({operation:'transcribe'}),null);});
test('parallel preview instances do not launch duplicate writing',async t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oracle-writing-concurrent-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let calls=0,finish;const execute=()=>{calls++;return new Promise(resolve=>{finish=()=>resolve({response:{artifacts:{'proposals.json':JSON.stringify({proposals:[proposal]})}},model:'fixture'});});};const a=createArCreateWriting({stateDir:dir,execute}),b=createArCreateWriting({stateDir:dir,execute});const first=await a.handle({operation:'propose',session});await new Promise(resolve=>setImmediate(resolve));const second=await b.handle({operation:'propose',session});assert.equal(second.status,202);assert.equal(calls,1);finish();await a.wait(first.body.requestId);assert.equal((await b.handle({operation:'writing-status',requestId:first.body.requestId})).status,200);});

const comparison={words:'My own words about the original.',candidates:[{id:'1/CODE/0-9',cardNumber:1,sectionId:'CODE',text:'Original.',sectionText:'Original.',start:0,end:9}]};
const comparisonResult={matches:[{passageId:'1/CODE/0-9',reason:'Both describe the same opening thought.'}],operation:'replace',explanation:'Your words restate the opening passage.',warnings:[]};
test('AI comparison uses the bounded runner, exact source context and a reusable receipt',async t=>{
 let calls=0;const bridge=fixture(t,async payload=>{calls++;assert.ok(payload.prompt.includes(comparison.words));assert.ok(payload.prompt.includes('Original.'));assert.ok(payload.prompt.includes('Do NOT rewrite'));assert.deepEqual(payload.names,['comparison.json']);return {response:{artifacts:{'comparison.json':JSON.stringify(comparisonResult)}},model:'fixture model'};});
 const start=await bridge.handle({operation:'compare-passage',comparison});assert.equal(start.status,202);await bridge.wait(start.body.requestId);
 const result=await bridge.handle({operation:'writing-status',requestId:start.body.requestId});assert.equal(result.status,200);assert.deepEqual(result.body.comparison,comparisonResult);assert.equal(result.body.proposals,undefined);
 assert.equal((await bridge.handle({operation:'compare-passage',comparison})).status,200);assert.equal(calls,1);
});
test('AI comparison rejects stale offsets before executing and invented destinations after execution',async t=>{
 let calls=0;const bridge=fixture(t,async()=>{calls++;return {response:{artifacts:{'comparison.json':JSON.stringify({...comparisonResult,matches:[{passageId:'2/BODY/0-9',reason:'Invented.'}]})}}};});
 assert.equal((await bridge.handle({operation:'compare-passage',comparison:{...comparison,candidates:[{...comparison.candidates[0],text:'Changed.'}]}})).status,400);assert.equal(calls,0);
 const start=await bridge.handle({operation:'compare-passage',comparison});await bridge.wait(start.body.requestId);assert.equal((await bridge.handle({operation:'writing-status',requestId:start.body.requestId})).status,503);
});
test('AI comparison allows honest no-match results and forbids automatic edits across multiple matches',async t=>{
 const bridge=fixture(t,async()=>({response:{artifacts:{'comparison.json':JSON.stringify({matches:[],operation:'unclear',explanation:'The speaker introduces a different topic.',warnings:['Choose the passage you intended.']})}}}));
 const start=await bridge.handle({operation:'compare-passage',comparison});await bridge.wait(start.body.requestId);assert.equal((await bridge.handle({operation:'writing-status',requestId:start.body.requestId})).status,200);
 const unsafe=fixture(t,async()=>({response:{artifacts:{'comparison.json':JSON.stringify({...comparisonResult,matches:[]})}}}));const pending=await unsafe.handle({operation:'compare-passage',comparison});await unsafe.wait(pending.body.requestId);assert.equal((await unsafe.handle({operation:'writing-status',requestId:pending.body.requestId})).status,503);
});
