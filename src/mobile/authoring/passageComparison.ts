import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { requestMacBridge } from './bridgeConnection';
import type { PassageAnchor } from '../../../lib/oracle/authoring/passageContext';
export interface PassageComparisonResult {
 matches:{passageId:string;reason:string}[];
 operation:'replace'|'append'|'unclear';
 explanation:string;
 warnings:string[];
}
export interface PassageComparisonInput {words:string;candidates:PassageAnchor[]}
async function request(body:unknown):Promise<{status:number;value:any}>{
 if(Capacitor.isNativePlatform())return requestMacBridge(body);
 if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('Connect to your Mac to compare this passage with AR Create. Your words are saved.');
 const response=await fetch('/api/oracle/authoring/ar-create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const value=await response.json().catch(()=>null);
 if(!response.ok)throw Error(typeof value?.error==='string'?value.error:'The comparison could not finish. Your words and card are unchanged.');
 return {status:response.status,value};
}
/** Semantic analysis only. Never changes the transcript, reading, or working card. */
export async function compareHumanPassage(input:PassageComparisonInput):Promise<PassageComparisonResult>{
 if(!input.words.trim()||!input.candidates.length)throw Error('Add your words and choose a reading before comparing.');
 let response=await request({operation:'compare-passage',comparison:input});
 const deadline=Date.now()+20*60*1000;
 while(response.status===202&&response.value?.pending===true){
  if(Date.now()>deadline)throw Error('AR Create is still comparing. Your words are saved; try again to reconnect to the same request.');
  const requestId=response.value.requestId;
  if(typeof requestId!=='string'||!/^writing-[a-f0-9]{64}$/.test(requestId))throw Error('The comparison did not return a saved request.');
  await new Promise(resolve=>setTimeout(resolve,1500));
  response=await request({operation:'writing-status',requestId});
 }
 const result=response.value?.comparison as PassageComparisonResult|undefined;
 const text=(value:unknown)=>typeof value==='string'&&value.trim().length>0&&value.length<=2000;
 if(!result||!['replace','append','unclear'].includes(result.operation)||!Array.isArray(result.matches)||result.matches.length>8||!text(result.explanation)||!Array.isArray(result.warnings)||result.warnings.length>8||result.warnings.some(w=>!text(w))||result.matches.some(m=>!m||!input.candidates.some(c=>c.id===m.passageId)||!text(m.reason))||new Set(result.matches.map(m=>m.passageId)).size!==result.matches.length||(result.matches.length!==1&&result.operation!=='unclear'))throw Error('The comparison did not match the selected reading. Your card is unchanged.');
 return result;
}
