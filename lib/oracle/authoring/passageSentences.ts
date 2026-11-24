import {buildPassageComparison,comparisonRows,type PassageChoice,type PassageComparison,type PassageRange} from './passageComparison';
import type {TextSpan} from './passageSpans';

/**
 * Speaking over a whole paragraph, then keeping the best of both: the paragraph and the spoken words are
 * lined up sentence by sentence, so each sentence can use the new words or keep the old ones.
 */

/** Sentences with their offsets. A sentence runs to its closing . ! ? or … (and any closing quote), or to the end. */
export function sentences(text:string):TextSpan[]{
 return [...text.matchAll(/[^.!?…\s][^.!?…]*(?:[.!?…]+["”’)\]]*|$)/g)].map(match=>{
  const raw=match[0],body=raw.trimEnd();
  return {start:match.index!,end:match.index!+body.length,text:body};
 }).filter(span=>span.text.trim());
}

const words=(text:string)=>new Set(text.toLowerCase().match(/[\p{L}\p{N}'’]+/gu)??[]);
/** Shared words over all words: 0 when nothing is shared, 1 for the same words. */
function similarity(a:string,b:string):number{
 const x=words(a),y=words(b);if(!x.size||!y.size)return 0;
 let shared=0;for(const w of x)if(y.has(w))shared++;
 return shared/(x.size+y.size-shared);
}

/**
 * A sentence spoken again with most of its words kept: the speaker polishing it. The new words are used
 * without asking, so only sentences that really changed are put to a choice.
 */
export function polished(original:string,spoken:string):boolean{
 return !!original.trim()&&!!spoken.trim()&&similarity(original,spoken)>=0.6;
}

/**
 * Line up the paragraph's sentences with the spoken ones, in order. Every pairing that keeps the order is
 * preferred over leaving a sentence alone, so a reworded sentence still stands against the one it replaces;
 * among those, the pairing whose sentences share the most words wins. Sentences left over are new (spoken
 * only) or unspoken (written only). Returns no comparison when there is only one sentence on each side,
 * where a sentence-by-sentence choice would be the same as the whole, or when every sentence was only
 * polished, where there is nothing to choose.
 */
export function sentenceComparison(original:string,spoken:string):PassageComparison|undefined{
 const a=sentences(original),b=sentences(spoken);
 if(!a.length||!b.length||a.length===1&&b.length===1)return;
 // Best score of the remaining sentences from (i, j) on. Read forwards, so when two line-ups score the
 // same, the earlier sentences are paired: a speaker starts at the start.
 const n=a.length,m=b.length,score=Array.from({length:n+1},()=>new Array<number>(m+1).fill(0));
 const pair=(i:number,j:number)=>score[i+1][j+1]+1+similarity(a[i].text,b[j].text);
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)score[i][j]=Math.max(score[i+1][j],score[i][j+1],pair(i,j));
 const steps:{i?:number;j?:number}[]=[];
 for(let i=0,j=0;i<n||j<m;){
  if(i<n&&j<m&&score[i][j]===pair(i,j)){steps.push({i,j});i++;j++;}
  else if(i<n&&(j===m||score[i][j]===score[i+1][j])){steps.push({i});i++;}
  else {steps.push({j});j++;}
 }
 const pairs:PassageRange[]=[];let originalCursor=0,textCursor=0;
 for(const step of steps){
  const o=step.i!==undefined?a[step.i]:undefined,s=step.j!==undefined?b[step.j]:undefined;
  const originalStart=o?.start??originalCursor,originalEnd=o?.end??originalCursor,textStart=s?.start??textCursor,textEnd=s?.end??textCursor;
  pairs.push({originalStart,originalEnd,textStart,textEnd});
  originalCursor=originalEnd;textCursor=textEnd;
 }
 if(steps.every(step=>step.i!==undefined&&step.j!==undefined&&polished(a[step.i].text,b[step.j].text)))return;
 return {originalText:original,spokenText:spoken,pairs};
}

/** Replacing a paragraph means replacing it: a written sentence that was not spoken starts out removed. */
export function defaultSentenceChoices(comparison:PassageComparison|undefined):Record<string,PassageChoice>|undefined{
 if(!comparison)return;
 const rows=comparisonRows(buildPassageComparison(comparison.originalText,comparison.spokenText,comparison));
 const unspoken=rows.filter(row=>row.kind==='unspoken');
 return unspoken.length?Object.fromEntries(unspoken.map(row=>[row.key,'mine' as const])):undefined;
}

/**
 * The words a passage replacement puts in the reading: each sentence's chosen side, in order, joined as
 * one paragraph. Without a sentence comparison it is the spoken text as it stands.
 */
export function chosenPassageText(original:string,text:string,comparison:PassageComparison|undefined,choices:Record<string,PassageChoice>|undefined):string{
 const view=buildPassageComparison(original,text,comparison);
 if(view.kind!=='matched')return text;
 return comparisonRows(view,choices).map(row=>row.kind==='unspoken'?(row.choice==='original'?row.original:''):row.choice==='mine'?row.text.trim():row.original.trim()).filter(Boolean).join(' ');
}

/** A passage review with the words that will actually be applied, for Apply and History. Other reviews are returned as they are. */
export function withChosenPassageText<T extends {text:string;comparison?:PassageComparison;rowChoices?:Record<string,PassageChoice>;passageEdit?:{operation:'add'|'replace';focus:TextSpan}}>(result:T):T{
 if(result.passageEdit?.operation!=='replace'||!result.comparison)return result;
 // Default rows describe the comparison, but applying them would reconstruct the
 // draft from sentence fragments. Only an explicit choice should change its words.
 const defaults=defaultSentenceChoices(result.comparison);
 if(!Object.entries(result.rowChoices??{}).some(([key,choice])=>choice!==(defaults?.[key]??'mine')))return result;
 return {...result,text:chosenPassageText(result.passageEdit.focus.text,result.text,result.comparison,result.rowChoices)};
}
