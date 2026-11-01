import type {ComparisonRow} from './passageComparison';

export interface InlineWordCheck {key:string;quote?:string;message:string;done:boolean;canHear:boolean;unanchored?:boolean}
export interface PlacedWordCheck extends InlineWordCheck {from?:number;to?:number}
/** Display order is independent of comparison/edit indices and of the final reading order. */
export function initialReviewOrder(rows:ComparisonRow[]):string[]{
 return [...rows.filter(row=>row.kind!=='unspoken'&&row.choice==='mine'),...rows.filter(row=>row.kind==='unspoken'||row.choice!=='mine')].map(row=>row.key);
}
/** Raw transcript offsets must never be reused in edited prose. Only a unique exact word/phrase is safe. */
export function placeReviewChecks(text:string,checks:InlineWordCheck[]):PlacedWordCheck[]{
 const result:PlacedWordCheck[]=[];
 for(const check of checks){
  if(check.unanchored||!check.quote?.trim()){result.push({...check});continue;}
  const escaped=check.quote.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const matches=[...text.matchAll(new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`,'giu'))];
  if(!matches.length&&check.done)continue;
  if(matches.length!==1){result.push({...check});continue;}
  const from=matches[0].index!+matches[0][1].length,to=from+matches[0][2].length;
  const overlaps=result.some(value=>value.from!==undefined&&value.to!==undefined&&value.from<to&&value.to>from);
  result.push(overlaps?{...check}:{...check,from,to});
 }
 return result;
}
