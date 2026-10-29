import {cardSections,type CardSection} from '../../../lib/oracle/authoring/cardSections';
import type {WorkingSection} from '../../../lib/oracle/authoring/humanDrafts';
import {sectionTitleEdits,type SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
export interface NamedReadingRange {section:CardSection;start:number;end:number}
const uniqueAt=(text:string,quote:string)=>{if(!quote)return -1;const at=text.indexOf(quote);return at>=0&&text.indexOf(quote,at+1)<0?at:-1;};
function shiftRanges(ranges:NamedReadingRange[],start:number,end:number,length:number):NamedReadingRange[]{
 const delta=length-(end-start);
 return ranges.flatMap(range=>{
  if(end<=range.start)return [{...range,start:range.start+delta,end:range.end+delta}];
  if(start>=range.end)return [range];
  if(start>=range.start&&end<=range.end)return [{...range,end:range.end+delta}];
  // A span crossing two headings cannot safely acquire either heading's identity.
  return [];
 });
}
/** Canonical identities follow literal editorial replacements, never inferred meaning. */
export function namedReadingRanges(section:WorkingSection,drafts:SectionDraftSession[]):NamedReadingRange[]{
 let nodes:CardSection[];try{nodes=cardSections(section.source).filter(node=>node.lensId===section.sectionId);}catch{return [];}
 const sourceText=nodes[0]?.sectionText??'';
 const relevant=drafts.filter(draft=>draft.sourceHash===section.sourceHash);
 const titles=sectionTitleEdits(relevant,section.sourceHash);
 nodes=nodes.map(node=>({...node,title:titles[node.id]??node.title}));
 const receipts=relevant.flatMap(draft=>draft.results.flatMap(result=>{
  const node=draft.sections.find(node=>node.id===result.sectionId);
  if(!node||node.lensId!==section.sectionId||!result.beforeWorking||result.beforeText===undefined||!result.appliedText||!result.appliedAt)return [];
  const before=result.beforeWorking;let start=-1;
  if(node.sectionText===before.text&&before.text.slice(node.start,node.start+result.beforeText.length)===result.beforeText)start=node.start;
  else start=uniqueAt(before.text,result.beforeText);
  if(start<0)return [];
  return [{before,start,end:start+result.beforeText.length,text:result.appliedText,after:before.text.slice(0,start)+result.appliedText+before.text.slice(start+result.beforeText.length)}];
 }));
 const seen=new Set<string>();
 const resolve=(snapshot:WorkingSection,depth=0):NamedReadingRange[]=>{
  if(snapshot.text===sourceText)return nodes.map(node=>({section:node,start:node.start,end:node.end}));
  const key=snapshot.text;if(depth>32||seen.has(key))return [];seen.add(key);
  // The latest receipt carries a full pre-edit snapshot, including earlier provenance.
  for(const receipt of receipts){if(receipt.after!==snapshot.text||receipt.before.text===snapshot.text)continue;
   const prior=resolve(receipt.before,depth+1);
   if(prior.length){seen.delete(key);return shiftRanges(prior,receipt.start,receipt.end,receipt.text.length);}
  }
  // Legacy receipts may be absent. Only use exact source matches or uniquely
  // anchored literal displaced text; split/overlapping provenance is ambiguous.
  const ranges:NamedReadingRange[]=[];
  for(const node of nodes){
   let candidate=node.text;
   const replacements=snapshot.blocks.filter(block=>block.origin==='human'&&block.replacedText&&uniqueAt(sourceText,block.replacedText)>=0&&node.text.includes(block.replacedText));
   const patches=replacements.map(block=>({start:uniqueAt(node.text,block.replacedText!),end:uniqueAt(node.text,block.replacedText!)+block.replacedText!.length,text:block.text})).sort((a,b)=>a.start-b.start);
   const ambiguous=patches.some((patch,index)=>patch.start<0||(index>0&&patch.start<patches[index-1].end));
   if(!ambiguous)for(const patch of [...patches].reverse())candidate=candidate.slice(0,patch.start)+patch.text+candidate.slice(patch.end);
   const start=uniqueAt(snapshot.text,candidate);if(start>=0)ranges.push({section:node,start,end:start+candidate.length});
  }
  seen.delete(key);return ranges;
 };
 const ranges=resolve(section);
 return ranges.filter((range,index)=>range.end>range.start&&!ranges.some((other,j)=>index!==j&&range.start<other.end&&range.end>other.start));
}
