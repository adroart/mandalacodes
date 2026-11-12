import type {SectionAssimilationResult} from './sectionAssimilation';

/** One stretch of speech: `fix` stretches are where the shared word library corrected a known mishearing. */
interface SpeechPiece {rawFrom:number;rawTo:number;fixedFrom:number;fixedTo:number;fix:boolean}
/** The raw words exactly as heard and the same words with known mishearings fixed, joined the same way, with a map between them. */
export interface CorrectedSpeech {raw:string;corrected:string;pieces:SpeechPiece[]}
export const KNOWN_WORD_REASON='Corrected a known word.';
const MAX_FIX_CELLS=250_000;
function segmentPieces(raw:string,fixed:string,rawAt:number,fixedAt:number):SpeechPiece[]{
 const whole=(fix:boolean)=>[{rawFrom:rawAt,rawTo:rawAt+raw.length,fixedFrom:fixedAt,fixedTo:fixedAt+fixed.length,fix}];
 if(raw===fixed)return whole(false);
 const a=[...raw.matchAll(/\S+/g)],b=[...fixed.matchAll(/\S+/g)],width=b.length+1;
 if((a.length+1)*width>MAX_FIX_CELLS)return whole(true);
 const table=new Uint32Array((a.length+1)*width);
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i*width+j]=a[i][0]===b[j][0]?table[(i+1)*width+j+1]+1:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
 const pieces:SpeechPiece[]=[];let r=0,f=0;
 const same=(rawEnd:number,fixedEnd:number,rawFrom=r,fixedFrom=f)=>pieces.push({rawFrom:rawAt+rawFrom,rawTo:rawAt+rawEnd,fixedFrom:fixedAt+fixedFrom,fixedTo:fixedAt+fixedEnd,fix:false});
 const stretch=(rawEnd:number,fixedEnd:number)=>{
  if(rawEnd===r&&fixedEnd===f)return;
  const before=raw.slice(r,rawEnd),after=fixed.slice(f,fixedEnd);
  if(before===after){same(rawEnd,fixedEnd);return;}
  // Shared spacing at either edge stays outside the fix, so a fix names only the words that changed.
  let lead=0;while(lead<before.length&&lead<after.length&&before[lead]===after[lead]&&/\s/.test(before[lead]))lead++;
  let trail=0;while(trail<before.length-lead&&trail<after.length-lead&&before[before.length-1-trail]===after[after.length-1-trail]&&/\s/.test(before[before.length-1-trail]))trail++;
  if(lead)same(r+lead,f+lead);
  pieces.push({rawFrom:rawAt+r+lead,rawTo:rawAt+rawEnd-trail,fixedFrom:fixedAt+f+lead,fixedTo:fixedAt+fixedEnd-trail,fix:true});
  if(trail)same(rawEnd,fixedEnd,rawEnd-trail,fixedEnd-trail);
 };
 let i=0,j=0;
 while(i<a.length&&j<b.length){
  if(a[i][0]===b[j][0]){const ra=a[i].index!,fb=b[j].index!;stretch(ra,fb);same(ra+a[i][0].length,fb+b[j][0].length,ra,fb);r=ra+a[i][0].length;f=fb+b[j][0].length;i++;j++;}
  else if(table[(i+1)*width+j]>=table[i*width+j+1])i++;else j++;
 }
 stretch(raw.length,fixed.length);
 return pieces;
}
/** Section matching reads the fixed words; evidence, replay and review stay on the raw words. */
export function correctedSpeech(segments:{raw:string;corrected?:string}[]):CorrectedSpeech{
 let raw='',corrected='';const pieces:SpeechPiece[]=[];
 for(const [index,segment]of segments.entries()){
  if(index){pieces.push({rawFrom:raw.length,rawTo:raw.length+1,fixedFrom:corrected.length,fixedTo:corrected.length+1,fix:false});raw+='\n';corrected+='\n';}
  const fixed=typeof segment.corrected==='string'&&segment.corrected.trim()?segment.corrected:segment.raw;
  pieces.push(...segmentPieces(segment.raw,fixed,raw.length,corrected.length));raw+=segment.raw;corrected+=fixed;
 }
 return {raw,corrected,pieces};
}
/** A span of the fixed words, widened to whole fixes, as the same span of the raw words. */
export function rawSpan(speech:CorrectedSpeech,from:number,to:number):{from:number;to:number}{
 const start=speech.pieces.find(p=>from>=p.fixedFrom&&from<p.fixedTo)??speech.pieces.find(p=>from===p.fixedTo);
 const end=speech.pieces.find(p=>to>p.fixedFrom&&to<=p.fixedTo)??speech.pieces.find(p=>to===p.fixedFrom);
 const mapStart=!start?from:start.fix&&from<start.fixedTo?start.rawFrom:start.rawFrom+Math.min(from-start.fixedFrom,start.rawTo-start.rawFrom);
 const mapEnd=!end?to:end.fix&&to>end.fixedFrom?end.rawTo:end.rawFrom+Math.min(to-end.fixedFrom,end.rawTo-end.rawFrom);
 return {from:mapStart,to:Math.max(mapStart,mapEnd)};
}
const rawText=(speech:CorrectedSpeech,text:string)=>{const at=speech.corrected.indexOf(text);if(at<0)return text;const span=rawSpan(speech,at,at+text.length);return speech.raw.slice(span.from,span.to);};
/**
 * Each known-word fix inside the section's raw evidence, as a documented change the speaker can undo (the same list as a tidied stumble).
 * Every `before` is unique in the text it is replayed on, widened by whole words where the same mishearing repeats.
 */
function knownWordChanges(speech:CorrectedSpeech,quotes:{from:number;to:number}[]):{before:string;after:string;reason:string}[]{
 const source=quotes.map(q=>speech.raw.slice(q.from,q.to)).join(' ');let text=source;
 const fixes:{at:number;length:number;after:string}[]=[];let offset=0;
 for(const quote of quotes){
  for(const piece of speech.pieces)if(piece.fix&&piece.rawFrom>=quote.from&&piece.rawTo<=quote.to&&piece.rawTo>piece.rawFrom)fixes.push({at:offset+piece.rawFrom-quote.from,length:piece.rawTo-piece.rawFrom,after:speech.corrected.slice(piece.fixedFrom,piece.fixedTo)});
  offset+=quote.to-quote.from+1;
 }
 const changes:{before:string;after:string;reason:string}[]=[];let shift=0,floor=0;
 for(let k=0;k<fixes.length;){
  let start=fixes[k].at+shift,end=start+fixes[k].length,last=k;
  // Unique both with every earlier fix made and with none made, so restoring any one earlier fix still finds this one.
  const unique=()=>{const before=text.slice(start,end);return !!before&&text.indexOf(before)===start&&text.indexOf(before,start+1)<0&&source.indexOf(before)===start-shift&&source.indexOf(before,start-shift+1)<0;};
  while(!unique()&&(start>floor||end<text.length)){
   if(end<text.length){const next=/^\s*\S+/.exec(text.slice(end));end=next?end+next[0].length:text.length;}
   while(last+1<fixes.length&&fixes[last+1].at+shift<end){last++;end=Math.max(end,fixes[last].at+shift+fixes[last].length);}
   if(unique())break;
   // Never reach back into an earlier change: restoring that change would then hide this one.
   if(start>floor){const prior=/\S+\s*$/.exec(text.slice(floor,start));start=prior?start-prior[0].length:floor;}
  }
  const before=text.slice(start,end);let after=before;
  for(let m=last;m>=k;m--){const at=fixes[m].at+shift-start;after=after.slice(0,at)+fixes[m].after+after.slice(at+fixes[m].length);}
  changes.push({before,after,reason:KNOWN_WORD_REASON});
  text=text.slice(0,start)+after+text.slice(end);shift+=after.length-before.length;floor=start+after.length;k=last+1;
 }
 return changes;
}
/**
 * Bring a section review of the fixed words back to the speaker's raw words: evidence, unplaced words and review marks point at
 * what was actually said, and every known-word fix becomes a change listed before the review's own, so it can be restored.
 */
export function restoreSpokenWords(result:SectionAssimilationResult,speech:CorrectedSpeech):SectionAssimilationResult{
 if(!speech.pieces.some(piece=>piece.fix))return result;
 return {
  sections:result.sections.map(section=>{
   const quotes=section.evidenceQuotes.map(quote=>{const at=speech.corrected.indexOf(quote);return at<0?undefined:rawSpan(speech,at,at+quote.length);});
   if(quotes.some(quote=>!quote))return section;
   const spans=quotes as {from:number;to:number}[];
   const reviewIssues=section.reviewIssues?.map(issue=>{const span=rawSpan(speech,issue.start,issue.end);return {...issue,start:span.from,end:span.to,quote:speech.raw.slice(span.from,span.to)};});
   return {...section,evidenceQuotes:spans.map(span=>speech.raw.slice(span.from,span.to)),changes:[...knownWordChanges(speech,spans),...section.changes],...(reviewIssues?{reviewIssues}:{})};
  }),
  unassigned:result.unassigned.map(item=>({...item,text:rawText(speech,item.text)})),
 };
}
const holds=(text:string,quote:string)=>new RegExp(`(^|[^\\p{L}\\p{N}])${quote.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^\\p{L}\\p{N}]|$)`,'iu').test(text);
/**
 * A word check quotes the raw words, but where the shared word library fixed them the proposed text holds the fixed
 * wording instead. This is that wording for `quote` (the whole fix when the quote lies inside it, or the quote with the fix
 * made when the fix lies inside the quote), so the check stays on the words the speaker sees. Undefined when no fix touched it.
 */
export function correctedQuote(changes:{before:string;after:string;reason:string}[],quote:string):string|undefined{
 if(!quote.trim())return undefined;
 for(const change of changes){
  if(change.reason!==KNOWN_WORD_REASON)continue;
  // A fix can be widened by unchanged words on either side; only the words it changed count.
  const before=change.before.split(/(\s+)/),after=change.after.split(/(\s+)/);
  let lead=0;while(lead<before.length&&lead<after.length&&before[lead]===after[lead])lead++;
  let trail=0;while(trail<before.length-lead&&trail<after.length-lead&&before[before.length-1-trail]===after[after.length-1-trail])trail++;
  const was=before.slice(lead,before.length-trail).join('').trim(),now=after.slice(lead,after.length-trail).join('').trim();
  if(!was||!now)continue;
  if(holds(was,quote))return now;
  if(holds(quote,was)){const at=quote.toLowerCase().indexOf(was.toLowerCase());return quote.slice(0,at)+now+quote.slice(at+was.length);}
 }
 return undefined;
}
