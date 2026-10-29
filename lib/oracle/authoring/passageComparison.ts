/** An evidence-bound comparison of one complete original section and one spoken revision. */
export interface PassageRange {originalStart:number;originalEnd:number;textStart:number;textEnd:number}
export interface PassageComparison {originalText:string;spokenText:string;pairs:PassageRange[]}
export interface ComparedPassage extends PassageRange {original:string;text:string}
export interface PassageComparisonView {kind:'matched'|'whole-section';pairs:ComparedPassage[]}

const uniqueAt=(text:string,quote:string,after:number)=>{
 if(!quote)return after;
 const at=text.indexOf(quote);return at>=after&&text.indexOf(quote,at+1)<0?at:-1;
};
/** Optional model alignment may fail without invalidating the person's saved words. */
export function normalizePassageComparison(originalText:string,spokenText:string,value:unknown):PassageComparison|undefined {
 if(!Array.isArray(value)||!value.length||value.length>256)return;
 let originalCursor=0,textCursor=0;const pairs:PassageRange[]=[];
 for(const pair of value){
  if(!pair||typeof pair.original!=='string'||typeof pair.spoken!=='string'||(!pair.original.trim()&&!pair.spoken.trim()))return;
  const originalStart=uniqueAt(originalText,pair.original,originalCursor),textStart=uniqueAt(spokenText,pair.spoken,textCursor);
  if(originalStart<0||textStart<0||originalText.slice(originalCursor,originalStart).trim()||spokenText.slice(textCursor,textStart).trim())return;
  originalCursor=originalStart+pair.original.length;textCursor=textStart+pair.spoken.length;
  pairs.push({originalStart,originalEnd:originalCursor,textStart,textEnd:textCursor});
 }
 if(originalText.slice(originalCursor).trim()||spokenText.slice(textCursor).trim())return;
 return {originalText,spokenText,pairs};
}
function valid(original:string,text:string,snapshot:PassageComparison|undefined):snapshot is PassageComparison {
 if(!snapshot||snapshot.originalText!==original||snapshot.spokenText!==text||!Array.isArray(snapshot.pairs)||!snapshot.pairs.length||snapshot.pairs.length>256)return false;
 let originalCursor=0,textCursor=0;
 for(const range of snapshot.pairs){
  if(!range||![range.originalStart,range.originalEnd,range.textStart,range.textEnd].every(Number.isInteger)||range.originalStart<originalCursor||range.originalEnd<range.originalStart||range.originalEnd>original.length||range.textStart<textCursor||range.textEnd<range.textStart||range.textEnd>text.length||range.originalStart===range.originalEnd&&range.textStart===range.textEnd||original.slice(originalCursor,range.originalStart).trim()||text.slice(textCursor,range.textStart).trim())return false;
  originalCursor=range.originalEnd;textCursor=range.textEnd;
 }
 return !original.slice(originalCursor).trim()&&!text.slice(textCursor).trim();
}
/** Never infer paragraph relationships from position, paragraph count, or fuzzy words. */
export function buildPassageComparison(original:string,text:string,snapshot?:PassageComparison):PassageComparisonView {
 const matched=valid(original,text,snapshot),ranges=matched?snapshot.pairs:[{originalStart:0,originalEnd:original.length,textStart:0,textEnd:text.length}];
 return {kind:matched?'matched':'whole-section',pairs:ranges.map(range=>({...range,original:original.slice(range.originalStart,range.originalEnd),text:text.slice(range.textStart,range.textEnd)}))};
}
/** Editing one linked span preserves all neighboring text and their exact offset links. */
export function replaceComparisonPassage(original:string,text:string,snapshot:PassageComparison|undefined,index:number,replacement:string):{text:string;comparison?:PassageComparison}{
 const view=buildPassageComparison(original,text,snapshot),pair=view.pairs[index];
 if(!pair||!Number.isInteger(index)||typeof replacement!=='string')throw Error('This passage changed. Reopen its comparison before editing.');
 const updated=text.slice(0,pair.textStart)+replacement+text.slice(pair.textEnd);
 if(view.kind==='whole-section')return {text:updated};
 const shift=replacement.length-(pair.textEnd-pair.textStart);
 const pairs=snapshot!.pairs.map((range,i)=>i<index?{...range}:i===index?{...range,textEnd:range.textStart+replacement.length}:{...range,textStart:range.textStart+shift,textEnd:range.textEnd+shift}).filter(range=>range.originalStart!==range.originalEnd||range.textStart!==range.textEnd);
 const comparison={originalText:original,spokenText:updated,pairs};
 return {text:updated,...(valid(original,updated,comparison)?{comparison}:{})};
}
