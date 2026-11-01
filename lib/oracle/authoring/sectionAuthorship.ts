import type {SourceSnapshot} from './types';
import {cardSections,type CardSection} from './cardSections';
import type {WorkingSection} from './humanDrafts';
import type {SectionDraftSession,SectionDraftResult} from './sectionDrafts';
import {buildPassageComparison,comparisonRows,comparisonEdits} from './passageComparison';
import {namedReadingRanges} from '../../../components/oracle/authoring/namedReadingRanges';

export type SectionAuthorship='human'|'mixed'|'ai'|'unknown';
export interface ReadingOriginSpan {text:string;origin:'human'|'ai'|'unknown'}
export interface CardSectionAuthorship {human:number;total:number;sections:Record<string,SectionAuthorship>}

function slice(spans:ReadingOriginSpan[],start:number,end:number):ReadingOriginSpan[]{
 let cursor=0;return spans.flatMap(span=>{const from=Math.max(0,start-cursor),to=Math.min(span.text.length,end-cursor);cursor+=span.text.length;return to>from?[{...span,text:span.text.slice(from,to)}]:[];});
}
/** Literal block positions only. Unaccounted prose never inherits a neighboring origin. */
export function readingOriginSpans(section:WorkingSection,start=0,end=section.text.length):ReadingOriginSpan[]{
 const blocks=section.blocks;
 const join=blocks.map(block=>block.text).join('')===section.text?'':blocks.map(block=>block.text).join('\n\n')===section.text?'\n\n':undefined;
 if(join===undefined)return [{text:section.text.slice(start,end),origin:'unknown'}];
 const spans:ReadingOriginSpan[]=[];
 blocks.forEach((block,index)=>{if(index&&join)spans.push({text:join,origin:'unknown'});spans.push({text:block.text,origin:block.origin});});
 return slice(spans,start,end);
}
function classify(spans:ReadingOriginSpan[]):SectionAuthorship{
 const prose=spans.filter(span=>span.text.trim());
 if(!prose.length||prose.some(span=>span.origin==='unknown'))return 'unknown';
 const human=prose.some(span=>span.origin==='human'),ai=prose.some(span=>span.origin==='ai');
 return human?(ai?'mixed':'human'):'ai';
}
function patch(spans:ReadingOriginSpan[],edits:{start:number;end:number;words:string}[]):ReadingOriginSpan[]{
 const length=spans.reduce((n,span)=>n+span.text.length,0),out:ReadingOriginSpan[]=[];let cursor=0;
 for(const edit of [...edits].sort((a,b)=>a.start-b.start)){
  out.push(...slice(spans,cursor,edit.start));if(edit.words)out.push({text:edit.words,origin:'human'});cursor=edit.end;
 }
 out.push(...slice(spans,cursor,length));return out;
}
function introOriginSpans(node:CardSection,sessions:SectionDraftSession[]):ReadingOriginSpan[]{
 const records=sessions.flatMap(session=>session.results.filter(result=>result.sectionId===node.id&&result.appliedAt&&result.appliedText!==undefined))
  .sort((a,b)=>a.appliedAt!.localeCompare(b.appliedAt!));
 if(!records.length)return [{text:node.text,origin:'ai'}];
 const resolve=(text:string,before:string,visited:Set<SectionDraftResult>):ReadingOriginSpan[]=>{
  // Literal baseline identity preserves its AI attribution; resemblance is never evidence.
  if(text===node.text)return [{text,origin:'ai'}];
  if(visited.size>32)return [{text,origin:'unknown'}];
  for(const result of [...records].reverse()){
   if(visited.has(result)||result.appliedAt!>before||result.appliedText!==text||result.beforeText===undefined||(!result.applied&&!result.integrationId))continue;
   const seen=new Set(visited);seen.add(result);
   const prior=resolve(result.beforeText,result.appliedAt!,seen);
   let next:ReadingOriginSpan[];
   if(result.editIntent==='add')next=[...prior,{text:'\n\n'+result.text,origin:'human'}];
   else{
    const view=buildPassageComparison(result.beforeText,result.text,result.comparison);
    next=view.kind==='matched'?patch(prior,comparisonEdits(result.beforeText,comparisonRows(view,result.rowChoices))):[{text:result.text,origin:'human'}];
   }
   if(next.map(span=>span.text).join('')===text)return next;
  }
  return [{text,origin:'unknown'}];
 };
 const latest=records.at(-1)!;
 return resolve(latest.appliedText!,latest.appliedAt!,new Set());
}

/** Current named prose with literal origin coverage; undefined means its boundary is unprovable. */
export function namedSectionOriginSpans(source:SourceSnapshot,node:CardSection,working:WorkingSection[],sessions:SectionDraftSession[]):ReadingOriginSpan[]|undefined{
 if(node.cardNumber!==source.cardNumber||node.sourceHash!==source.hash)return;
 const relevant=sessions.filter(session=>session.cardNumber===source.cardNumber&&session.sourceHash===source.hash);
 if(node.kind==='intro')return introOriginSpans(node,relevant);
 const candidates=working.filter(section=>section.cardNumber===source.cardNumber&&section.sectionId===node.lensId);
 if(!candidates.length)return [{text:node.text,origin:'ai'}];
 const current=candidates.reduce((a,b)=>a.revision>=b.revision?a:b);if(current.sourceHash!==source.hash)return;
 const ranges=namedReadingRanges(current,relevant).filter(range=>range.section.id===node.id);
 if(ranges.length===1)return readingOriginSpans(current,ranges[0].start,ranges[0].end);
}

/** Completion follows the current reading, never the pending review queue or receipt count. */
export function cardSectionAuthorship(source:SourceSnapshot,nodes:CardSection[],working:WorkingSection[],sessions:SectionDraftSession[]):CardSectionAuthorship{
 const relevant=sessions.filter(session=>session.cardNumber===source.cardNumber&&session.sourceHash===source.hash);
 const intro=nodes.find(node=>node.kind==='intro'&&node.cardNumber===source.cardNumber&&node.sourceHash===source.hash);
 // Reparse the full manuscript so focused selection nodes and filtered queues cannot alter T.
 const canonical=cardSections(source,intro?.text),sections:Record<string,SectionAuthorship>={};
 const lenses=new Map<string,{section:WorkingSection;ranges:ReturnType<typeof namedReadingRanges>}>();
 for(const node of canonical){
  if(node.kind==='intro'){sections[node.id]=classify(introOriginSpans(node,relevant));continue;}
  const candidates=working.filter(section=>section.cardNumber===source.cardNumber&&section.sectionId===node.lensId);
  if(!candidates.length){sections[node.id]='ai';continue;}
  const current=candidates.reduce((a,b)=>a.revision>=b.revision?a:b);
  if(current.sourceHash!==source.hash){sections[node.id]='unknown';continue;}
  if(!lenses.has(node.lensId))lenses.set(node.lensId,{section:current,ranges:namedReadingRanges(current,relevant)});
  const lens=lenses.get(node.lensId)!,matches=lens.ranges.filter(range=>range.section.id===node.id);
  sections[node.id]=matches.length===1?classify(readingOriginSpans(lens.section,matches[0].start,matches[0].end)):'unknown';
 }
 return {human:Object.values(sections).filter(origin=>origin==='human').length,total:canonical.length,sections};
}
