import type {AuthoringServices,SourceSnapshot} from '../../../lib/oracle/authoring/types';
import {matchPassages,passagesFromText,type PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {bundledSource} from './bundledSource';
import {plainSection} from './passageActions';
const cache=new WeakMap<AuthoringServices['loadSource'],Map<number,Promise<SourceSnapshot>>>();
/** Searches exact local manuscripts and current private words. No external model or audio upload. */
export async function findBookPassages(query:string,currentCard:number,loadSource:AuthoringServices['loadSource']=bundledSource):Promise<{anchor:PassageAnchor;score:number}[]>{
 if(query.trim().length<3)return[];
 let sources=cache.get(loadSource);if(!sources){sources=new Map();cache.set(loadSource,sources);}
 const working=await new WorkingCardStore().list(),anchors:PassageAnchor[]=[];
 const numbers=[currentCard,...Array.from({length:64},(_,i)=>i+1).filter(n=>n!==currentCard)];
 for(let start=0;start<numbers.length;start+=8){await Promise.all(numbers.slice(start,start+8).map(async number=>{let promise=sources!.get(number);if(!promise){promise=loadSource(number);sources!.set(number,promise);promise.catch(()=>sources!.delete(number));}const source=await promise;for(const section of source.sections){const draft=working.find(w=>w.cardNumber===number&&w.sectionId===section.id);anchors.push(...passagesFromText(number,section.id,draft?.text??plainSection(source,section.id),draft?.revision??0,source.hash));}}));}
 return matchPassages(query,anchors).sort((a,b)=>b.score-a.score||(a.anchor.cardNumber===currentCard?-1:b.anchor.cardNumber===currentCard?1:0)).slice(0,8);
}
