import {buildPassageComparison,normalizePassageComparison,type PassageComparison} from '../../../lib/oracle/authoring/passageComparison';
import type {SectionReviewIssue} from '../../../lib/oracle/authoring/sectionDrafts';
import {requestAuthoringProcessing as request} from './processing';
export interface SectionAssimilationInput {
 words:string;
 intent?:'replace'|'add'|'revise';
 relatedSources?:{cardNumber:number;sections:{id:string;title:string;path:string[];text:string}[]}[];
 sections:{id:string;title:string;path:string[];text:string}[];
 startSectionId:string;
 markers?:{atMs:number;sectionId:string}[];
 segments?:{text:string;startMs:number;endMs:number}[];
}
export interface SectionAssimilationResult {
 sections:{comparisonOriginal?:string;reviewIssues?:SectionReviewIssue[];destinationCardNumber?:number;comparison?:PassageComparison;sectionId:string;text:string;evidenceQuotes:string[];changes:{before:string;after:string;reason:string}[];warnings:string[]}[];
 unassigned:{text:string;reason:string}[];
}
export function validateSectionAssimilationResult(value:unknown,input:SectionAssimilationInput):SectionAssimilationResult {
 const destinations=[...input.sections,...(input.relatedSources??[]).flatMap(source=>source.sections)];
 const result=value as SectionAssimilationResult|undefined;
 const text=(v:unknown,max=120000):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 if(!result||!Array.isArray(result.sections)||result.sections.length>destinations.length||!Array.isArray(result.unassigned)||result.unassigned.length>256||new Set(result.sections.map(s=>s?.sectionId)).size!==result.sections.length||result.sections.some(s=>!s||!destinations.some(c=>c.id===s.sectionId)||!text(s.text)||/^\s*#{1,6}\s/m.test(s.text)||!Array.isArray(s.evidenceQuotes)||!s.evidenceQuotes.length||s.evidenceQuotes.some(q=>!text(q)||!input.words.includes(q))||!Array.isArray(s.changes)||s.changes.some(c=>!c||!text(c.before)||!input.words.includes(c.before)||typeof c.after!=='string'||c.after&&!s.text.includes(c.after)||!text(c.reason,2000))||!Array.isArray(s.warnings)||s.warnings.some(w=>!text(w,2000)))||result.unassigned.some(u=>!u||!text(u.text)||!input.words.includes(u.text)||!text(u.reason,2000))||!result.sections.length&&!result.unassigned.length)throw Error('The section review did not match your saved speech. Your card is unchanged.');
 const sections=result.sections.map(section=>{
  const original=destinations.find(candidate=>candidate.id===section.sectionId)!.text;
  const supplied=section.comparison as unknown;
  const comparison=Array.isArray(supplied)?normalizePassageComparison(original,section.text,supplied):buildPassageComparison(original,section.text,section.comparison).kind==='matched'?section.comparison:undefined;
  const {comparison:discarded,...words}=section;const reviewIssues=(section.reviewIssues??[]).filter(issue=>issue.kind==='ambiguity'&&issue.scope==='rawTranscript'&&Number.isInteger(issue.start)&&Number.isInteger(issue.end)&&issue.start>=0&&issue.end>issue.start&&input.words.slice(issue.start,issue.end)===issue.quote&&typeof issue.message==='string'&&issue.message.trim()).map(({kind,quote,start,end,message,scope})=>({kind,quote,start,end,message,scope}));
  const destination=input.relatedSources?.find(source=>source.sections.some(s=>s.id===section.sectionId));
  return {...words,comparisonOriginal:original,reviewIssues,...(destination?{destinationCardNumber:destination.cardNumber}:{}),...(comparison?{comparison}:{})};
 });
 return {...result,sections};
}
/** Routes and prepares evidence-linked human speech. Never applies or approves a section. */
export async function assimilateSections(input:SectionAssimilationInput):Promise<SectionAssimilationResult>{
 if(!input.words.trim()||!input.sections.length)throw Error('Finish a recording with words before reviewing.');
 let response=await request({operation:'assimilate-sections',assimilation:input});const deadline=Date.now()+20*60*1000;
 while(response.status===202&&response.value?.pending===true){
  if(Date.now()>deadline)throw Error('AI review is still working. Your recording is saved; retry to reconnect to the same review.');
  const requestId=response.value?.requestId;if(typeof requestId!=='string'||!/^writing-[a-f0-9]{64}$/.test(requestId))throw Error('The review did not return a saved request.');
  await new Promise(resolve=>setTimeout(resolve,1500));response=await request({operation:'writing-status',requestId});
 }
 return validateSectionAssimilationResult(response.value?.assimilation,input);
}
