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
/** What happens to one compared passage. 'mine' uses the spoken words (or removes an unspoken original); 'original' keeps the written words. */
export type PassageChoice='mine'|'original';
export interface ComparisonRow extends ComparedPassage {key:string;kind:'replaced'|'unspoken'|'new';choice:PassageChoice;changes:boolean}
/** Unspoken original passages stay unless the speaker removes them; spoken words are used unless the original is kept. */
export function comparisonRows(view:PassageComparisonView,choices:Record<string,PassageChoice>={}):ComparisonRow[]{
 return view.pairs.map(pair=>{
  const kind=!pair.original.trim()?'new':!pair.text.trim()?'unspoken':'replaced',key=`${pair.originalStart}-${pair.originalEnd}`;
  const choice=choices[key]??(kind==='unspoken'?'original':'mine');
  return {...pair,key,kind,choice,changes:choice==='mine'&&pair.text!==pair.original};
 });
}
/** Exact spans of the original section that change. Kept passages and the space between them are never rewritten. */
export function comparisonEdits(original:string,rows:ComparisonRow[]):{start:number;end:number;words:string}[]{
 const edits:{start:number;end:number;words:string}[]=[];
 for(let i=0;i<rows.length;){
  if(!rows[i].changes){i++;continue;}
  let j=i;while(j+1<rows.length&&rows[j+1].changes)j++;
  const run=rows.slice(i,j+1),pieces:string[]=[];let previous:ComparisonRow|undefined;
  for(const row of run){const words=row.choice==='mine'?row.text.trim():row.original;if(!words)continue;if(pieces.length){const gap=previous?original.slice(previous.originalEnd,row.originalStart):'';pieces.push(gap&&!gap.trim()?gap:'\n\n');}pieces.push(words);previous=row;}
  let start=run[0].originalStart,end=run.at(-1)!.originalEnd,words=pieces.join('');
  if(!words){if(j+1<rows.length)end=rows[j+1].originalStart;else if(i>0)start=rows[i-1].originalEnd;}
  else if(start===end){if(start>0)words=`\n\n${words}`;else if(original.trim())words=`${words}\n\n`;}
  if(words||end>start)edits.push({start,end,words});
  i=j+1;
 }
 return edits;
}
export function applyComparisonEdits(original:string,edits:{start:number;end:number;words:string}[]){
 let text=original;for(const edit of [...edits].sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.words+text.slice(edit.end);return text;
}
/** A recording aimed at one passage: everything spoken belongs to it and every other passage is unspoken. */
export function focusedComparison(original:string,spoken:string,focus:{start:number;end:number;text:string}):PassageComparison|undefined{
 if(focus.end<=focus.start||original.slice(focus.start,focus.end)!==focus.text||!spoken.trim())return;
 const lead=original.slice(0,focus.start).trimEnd().length,tail=focus.end+(original.slice(focus.end).length-original.slice(focus.end).trimStart().length),textStart=spoken.length-spoken.trimStart().length,textEnd=spoken.trimEnd().length;
 const pairs:PassageRange[]=[...(lead?[{originalStart:original.length-original.trimStart().length,originalEnd:lead,textStart,textEnd:textStart}]:[]),{originalStart:focus.start,originalEnd:focus.end,textStart,textEnd},...(original.slice(focus.end).trim()?[{originalStart:tail,originalEnd:original.trimEnd().length,textStart:textEnd,textEnd}]:[])];
 const comparison={originalText:original,spokenText:spoken,pairs};
 return valid(original,spoken,comparison)?comparison:undefined;
}
/** Paragraphs of a reading with their exact offsets, for aiming a recording at one of them. */
export function readingParagraphs(text:string):{start:number;end:number;text:string}[]{
 return [...text.matchAll(/\S(?:[\s\S]*?\S)?(?=\s*\n\s*\n|\s*$)/g)].map(match=>({start:match.index!,end:match.index!+match[0].length,text:match[0]}));
}
