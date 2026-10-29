import type {PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import {buildWordReplay,type ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
import type {Transcript} from '../../../lib/oracle/authoring/types';

/** Snapshot the precise reviewed source selection; never reconstruct it from a section title. */
export function snapshotVoiceTargets(anchors:PassageAnchor[]):PassageAnchor[]{
 for(const anchor of anchors)if(!Number.isInteger(anchor.start)||!Number.isInteger(anchor.end)||anchor.start<0||anchor.end<=anchor.start||anchor.sectionText.slice(anchor.start,anchor.end)!==anchor.text)throw new Error('The selected passage changed. Select it again before recording.');
 return structuredClone(anchors);
}
export interface VoiceReplayBounds {captureId:string;startMs:number;endMs:number;from:number;to:number}
/** Reject partial words, ambiguous alignment, multi-recording ranges and untimed words.
 * Punctuation carries no timestamp and does not need one. */
export function phraseReplayBounds(words:ReplayWord[],from:number,to:number):VoiceReplayBounds|null{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<=from)return null;
 const selected=words.filter(word=>word.to>from&&word.from<to&&/[\p{L}\p{N}]/u.test(word.text));
 if(!selected.length||selected.some(word=>word.from<from||word.to>to||!word.captureId||word.startMs===undefined||word.endMs===undefined||!Number.isFinite(word.startMs)||!Number.isFinite(word.endMs)||word.endMs<=word.startMs))return null;
 const first=selected[0],last=selected.at(-1)!;
 if(selected.some((word,index)=>word.captureId!==first.captureId||(index>0&&word.startMs!<selected[index-1].endMs!)))return null;
 return{captureId:first.captureId!,startMs:first.startMs!,endMs:last.endMs!,from,to};
}
export function quoteReplayBounds(text:string,quote:string,transcripts:Transcript[],evidenceQuotes?:string[]):VoiceReplayBounds|null{
 const from=text.indexOf(quote);
 if(!quote.trim()||from<0||text.indexOf(quote,from+1)>=0)return null;
 return phraseReplayBounds(buildWordReplay(text,transcripts,evidenceQuotes),from,from+quote.length);
}
/** A non-destructive replacement plan. Original transcript and audio remain intact. */
export function phraseReplacement(text:string,from:number,to:number,replacement:string,bounds:VoiceReplayBounds|null,replacementCaptureId:string){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<=from||to>text.length||!replacement.trim()||!replacementCaptureId)throw new Error('Select the phrase and record its replacement first.');
 if(bounds&&(bounds.from!==from||bounds.to!==to))throw new Error('The audio selection does not match this phrase.');
 return {text:text.slice(0,from)+replacement+text.slice(to),replacement:{from,to,original:text.slice(from,to),replacement,replacementCaptureId,originalAudio:bounds?{...bounds}:null}};
}
/** Attach to a real audio element and dispose when its source or selection changes. */
export function loopVoicePhrase(audio:HTMLAudioElement,bounds:VoiceReplayBounds,loop=true):()=>void{
 const begin=bounds.startMs/1000,end=bounds.endMs/1000;
 if(!Number.isFinite(begin)||!Number.isFinite(end)||begin<0||end<=begin)throw new Error('This phrase has no reliable audio timing.');
 const update=()=>{if(audio.currentTime<begin||audio.currentTime>=end){if(loop){audio.currentTime=begin;}else{audio.pause();audio.currentTime=begin;}}};
 audio.currentTime=begin;audio.addEventListener('timeupdate',update);
 return()=>audio.removeEventListener('timeupdate',update);
}
