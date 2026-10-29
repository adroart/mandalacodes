import type {Transcript} from './types';

/** Exact character spans in the displayed text. Untimed spans are still readable. */
export interface ReplayWord {
 text:string;from:number;to:number;
 captureId?:string;startMs?:number;endMs?:number;
}
interface Token {text:string;from:number;to:number;key:string}
interface TimedToken extends Token {captureId:string;startMs:number;endMs:number}
const WORD=/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;
const normalize=(value:string)=>value.normalize('NFKC').replace(/’/g,"'").toLocaleLowerCase();
const tokens=(text:string):Token[]=>Array.from(text.matchAll(WORD),match=>({text:match[0],from:match.index!,to:match.index!+match[0].length,key:normalize(match[0])}));
// Two bounded matrices keep matching deterministic without allocating a whole-card
// quadratic table. Exceeding the bound produces honest, untimed text.
const MAX_CELLS=1_000_000;

/** Return only pairs present at the same source position in every optimal LCS. */
function uniqueAlignment(source:{key:string}[],target:{key:string}[]):Map<number,number>{
 const result=new Map<number,number>(),rows=source.length+1,width=target.length+1;
 if(!source.length||!target.length||rows*width>MAX_CELLS)return result;
 const before=new Uint16Array(rows*width),after=new Uint16Array(rows*width);
 for(let i=0;i<source.length;i++)for(let j=0;j<target.length;j++)before[(i+1)*width+j+1]=source[i].key===target[j].key?before[i*width+j]+1:Math.max(before[i*width+j+1],before[(i+1)*width+j]);
 for(let i=source.length-1;i>=0;i--)for(let j=target.length-1;j>=0;j--)after[i*width+j]=source[i].key===target[j].key?after[(i+1)*width+j+1]+1:Math.max(after[(i+1)*width+j],after[i*width+j+1]);
 const length=after[0];
 for(let j=0;j<target.length;j++){
  let found=-1;
  for(let i=0;i<source.length;i++)if(source[i].key===target[j].key&&before[i*width+j]+1+after[(i+1)*width+j+1]===length){if(found!==-1){found=-2;break;}found=i;}
  // An optimal alignment may omit this target word altogether. It is timed only
  // when omitting it lowers the best score; this protects inserted repetitions.
  if(found>=0){let without=0;for(let i=0;i<=source.length;i++)without=Math.max(without,before[i*width+j]+after[i*width+j+1]);if(without<length)result.set(j,found);}
 }
 return result;
}
function quoteRanges(text:string,quotes:string[]|undefined):{from:number;to:number}[]|undefined{
 if(!quotes?.length)return undefined;
 return quotes.flatMap(quote=>{if(!quote)return[];const at=text.indexOf(quote);return at>=0&&text.indexOf(quote,at+1)<0?[{from:at,to:at+quote.length}]:[];});
}

/**
 * Ground edited prose in immutable raw speech and actual provider word times.
 * No interpolation, guessed timing, or semantic matching is performed. A repeated
 * restart with several equally plausible matches remains deliberately untimed.
 */
export function buildWordReplay(text:string,transcripts:Transcript[],evidenceQuotes?:string[]):ReplayWord[]{
 const target=tokens(text),timed:TimedToken[]=[];
 const originals=transcripts.filter(t=>!t.referenceOnly),raw=originals.map(t=>t.raw).join('\n'),ranges=quoteRanges(raw,evidenceQuotes);
 let offset=0;
 for(const transcript of originals){
  const original=tokens(transcript.raw),provided=(transcript.words??[]).flatMap(word=>{
   const parts=tokens(word.text);
   if(parts.length!==1||!Number.isFinite(word.startMs)||!Number.isFinite(word.endMs)||word.startMs<0||word.endMs<=word.startMs)return[];
   return [{...parts[0],captureId:transcript.captureId,startMs:word.startMs,endMs:word.endMs}];
  });
  const alignment=uniqueAlignment(original,provided);
  for(const [providedIndex,originalIndex]of alignment){const word=original[originalIndex],from=offset+word.from,to=offset+word.to;if(ranges&&!ranges.some(range=>range.from<=from&&range.to>=to))continue;timed.push({...provided[providedIndex],from,to});}
  offset+=transcript.raw.length+1;
 }
 const alignment=uniqueAlignment(timed,target),mapped=new Map<number,TimedToken>();
 for(const [targetIndex,sourceIndex]of alignment)mapped.set(targetIndex,timed[sourceIndex]);
 const result:ReplayWord[]=[];let cursor=0;
 for(const [index,word]of target.entries()){
  if(cursor<word.from)result.push({text:text.slice(cursor,word.from),from:cursor,to:word.from});
  const timing=mapped.get(index);result.push({text:word.text,from:word.from,to:word.to,...(timing?{captureId:timing.captureId,startMs:timing.startMs,endMs:timing.endMs}:{})});cursor=word.to;
 }
 if(cursor<text.length)result.push({text:text.slice(cursor),from:cursor,to:text.length});
 return result;
}

/** Word intervals are end-exclusive; pauses and unmatched edits have no highlight. */
export function activeReplayWord(words:ReplayWord[],captureId:string,timeMs:number):number{
 if(!captureId||!Number.isFinite(timeMs)||timeMs<0)return-1;
 let index=-1,start=-1;
 for(let i=0;i<words.length;i++){
  const word=words[i];if(word.captureId!==captureId||word.startMs===undefined||word.endMs===undefined||word.endMs<=word.startMs||timeMs<word.startMs||timeMs>=word.endMs)continue;
  if(word.startMs>start){index=i;start=word.startMs;}else if(word.startMs===start)index=-1;
 }
 return index;
}
