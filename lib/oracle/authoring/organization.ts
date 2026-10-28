import type { AuthoringSession } from './types';
import { addTranscript, correctTranscript, sessionSources } from './workflow';
export interface PassageSuggestion { text: string; cardNumber: number; sectionId: string; reason: string; unresolved: boolean }
const units = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens = ['', '', 'twenty','thirty','forty','fifty','sixty'];
const spoken = new Map<string, number>();
for (let n=1;n<=64;n++) spoken.set(n<20 ? units[n] : `${tens[Math.floor(n/10)]}${n%10 ? ` ${units[n%10]}` : ''}`,n);
const numberWords = [...spoken.keys()].sort((a,b)=>b.length-a.length).map(word=>word.replace(/ /g,'[ -]')).join('|');
const cardCue = new RegExp(`\\b(?:hexagram|card|code|gate)\\s+(?:number\\s+)?(\\d{1,2}|${numberWords})\\b`, 'i');
const lensCues: [RegExp,string][] = [[/\b(?:i\s*ching|eye\s*ching|a chain)\b/i,'ICHING'],[/\bgene\s*keys?\b/i,'KEYS'],[/\bhuman\s*design\b/i,'DESIGN'],[/\b(?:body section|physiology|amino acid)\b/i,'BODY'],[/\b(?:relations section|relationships section|codon ring)\b/i,'RELATIONS'],[/\b(?:code section|universal language section)\b/i,'CODE']];
function cues(text:string, cardNumber:number, sectionId:string) {
 const match = cardCue.exec(text);
 const reference = /\b(?:relates? to|related to|compared? (?:with|to)|paired with|partner (?:is|of)|reference to|opposite of)\s+(?:the\s+)?(?:hexagram|card|code|gate)\b/i.test(text);
 const number = match ? /^\d+$/.test(match[1]) ? Number(match[1]) : spoken.get(match[1].toLowerCase().replace(/-/g,' ')) : undefined;
 const lens = lensCues.find(([regex])=>regex.test(text));
 const unresolved = /\b(?:which|what)\s+(?:hexagram|card|code)\b/i.test(text);
 return { cardNumber: !reference && number && number<=64 ? number : cardNumber, sectionId:lens?.[1] ?? sectionId, unresolved, explicit:Boolean((match&&!reference)||lens||unresolved), reason: /\ba chain\b/i.test(text) ? 'Uncertain phrase “a chain” may be a misheard “I Ching”.' : unresolved ? 'No destination was named.' : reference ? 'Reference to another code; current destination retained.' : 'Spoken card/section keyword hint; editable before approval.' };
}
function routingOnly(text:string) {
 let rest=text.replace(cardCue,'');
 for(const [regex] of lensCues) rest=rest.replace(regex,'');
 return !rest.replace(/\b(?:now|then|this|is|the|next|moving|on|to|let|lets|s|for|about|section)\b/gi,'').replace(/[^a-z]/gi,'').length;
}
/** Remove only leading routing-only sentences; original speech is retained separately. */
export function spokenProse(text:string):string {
 const parts=text.match(/[^.!?\n]+[.!?]?|\n+/g)??[text];
 while(parts.length&&(!parts[0].trim()||routingOnly(parts[0])))parts.shift();
 return parts.join('').trim();
}
/** Explicit local keyword hints only. No AI inference or invented word-level times. */
export function suggestPassages(text:string, cardNumber:number, sectionId:string, unresolved=false):PassageSuggestion[] {
 const parts = text.match(/[^.!?\n]+[.!?]?|\n+/g)?.filter(p=>p.trim()) ?? [text];
 const result:PassageSuggestion[]=[];
 let current:PassageSuggestion={text:'',cardNumber,sectionId,reason:'Visible card and section hint.',unresolved};
 for(const part of parts) {
   const next=cues(part,current.cardNumber,current.sectionId);
   if(next.explicit && current.text && (next.cardNumber!==current.cardNumber||next.sectionId!==current.sectionId||next.unresolved!==current.unresolved)) {
     if(routingOnly(current.text)) { current={...current,...next,text:current.text}; }
     else { result.push(current); current={...next,text:''}; }
   } else if(next.explicit || /reference/i.test(next.reason)) current={...current,...next,text:current.text};
   current.text+=part;
 }
 if(current.text.trim()) result.push(current);
 return result.map(p=>({...p,text:p.text.trim()}));
}
export async function organizeOriginal(session:AuthoringSession,id:string,loadSource:(number:number)=>Promise<AuthoringSession['source']>, context?:{cardNumber:number;sectionId:string;unresolved?:boolean}):Promise<AuthoringSession> {
 const parent=session.transcript.find(t=>t.id===id);
 if(!parent || parent.parentId) throw new Error('Choose an original transcript to organize.');
 const pieces=suggestPassages(parent.raw,context?.cardNumber??parent.cardNumber??session.source.cardNumber,context?.sectionId??parent.sectionId??'CODE',context?.unresolved??false);
 let next=session;
 for(const number of new Set(pieces.map(p=>p.cardNumber))) if(!sessionSources(next).some(s=>s.cardNumber===number)) next={...next,relatedSources:[...(next.relatedSources??[]),await loadSource(number)]};
 if(pieces.length===1 && pieces[0].cardNumber===(parent.cardNumber??session.source.cardNumber) && pieces[0].sectionId===parent.sectionId && !pieces[0].unresolved) return next;
 const before=next.transcript.filter(t=>!t.referenceOnly).sort((a,b)=>(a.order??next.transcript.indexOf(a))-(b.order??next.transcript.indexOf(b)));
 next=correctTranscript(next,id,{referenceOnly:true});const newIds:string[]=[];
 for(const piece of pieces){next=addTranscript(next,parent.captureId,[{text:piece.text,startMs:parent.startMs,endMs:parent.endMs,timing:pieces.length===1?parent.timing:'recording',sectionId:piece.unresolved?null:piece.sectionId,cardNumber:piece.cardNumber,parentId:parent.id,order:next.transcript.length,...(pieces.length===1&&parent.words?{words:parent.words}:{}),...(parent.speaker?{speaker:parent.speaker}:{})}],parent.provider);newIds.push(next.transcript.at(-1)!.id);}
 before.flatMap(t=>t.id===id?newIds:[t.id]).forEach((target,order)=>{next=correctTranscript(next,target,{order});});
 return next;
}
export function splitPassage(session:AuthoringSession,id:string,position:number,corrected:string):AuthoringSession {
 const passage=session.transcript.find(t=>t.id===id);
 if(!passage || position<=0 || position>=corrected.length) throw new Error('Place the cursor between the words you want to split.');
 const before=session.transcript.filter(t=>!t.referenceOnly).sort((a,b)=>(a.order??session.transcript.indexOf(a))-(b.order??session.transcript.indexOf(b)));
 let next=correctTranscript(session,id,{corrected,referenceOnly:true});
 const newIds:string[]=[];
 const root=passage.parentId??passage.id;
 const pieces=[corrected.slice(0,position).trim(),corrected.slice(position).trim()];
 if(pieces.some(p=>!p)) throw new Error('Both passages need words.');
 for(let i=0;i<2;i++) {
   const raw=corrected===passage.raw?pieces[i]:passage.raw;
   next=addTranscript(next,passage.captureId,[{text:raw,startMs:passage.startMs,endMs:passage.endMs,timing:'recording',sectionId:passage.sectionId,cardNumber:passage.cardNumber??session.source.cardNumber,parentId:root,order:session.transcript.length+i}],passage.provider);
   newIds.push(next.transcript.at(-1)!.id);
   if(raw!==pieces[i]) next=correctTranscript(next,next.transcript.at(-1)!.id,{corrected:pieces[i]});
 }
 const ids=before.flatMap(t=>t.id===id?newIds:[t.id]);
 ids.forEach((target,order)=>{next=correctTranscript(next,target,{order});});
 return {...next};
}

/** AR supplies several aligned segments: a spoken card/lens change carries forward. */
export async function organizeCapture(session:AuthoringSession,captureId:string,loadSource:(number:number)=>Promise<AuthoringSession['source']>):Promise<AuthoringSession>{
 const capture=session.captures.find(c=>c.id===captureId);
 const originals=session.transcript.filter(t=>t.captureId===captureId&&!t.parentId&&!t.referenceOnly).sort((a,b)=>a.startMs-b.startMs);
 let next=session,context={cardNumber:capture?.visibleCardNumber??session.source.cardNumber,sectionId:session.markers.find(m=>m.captureId===captureId&&m.atMs===0)?.sectionId??originals[0]?.sectionId??'CODE',unresolved:false};
 let appliedMarker=-1;
 for(const original of originals){
  const marker=next.markers.filter(m=>m.captureId===captureId&&m.atMs<=original.startMs&&m.sectionId!==null).sort((a,b)=>a.atMs-b.atMs).at(-1);
  if(marker&&marker.atMs>appliedMarker){context={...context,sectionId:marker.sectionId!,unresolved:false};appliedMarker=marker.atMs;}
  next=await organizeOriginal(next,original.id,loadSource,context);const last=next.transcript.filter(t=>!t.referenceOnly&&(t.id===original.id||t.parentId===original.id)).sort((a,b)=>(a.order??0)-(b.order??0)).at(-1);if(last)context={cardNumber:last.cardNumber??next.source.cardNumber,sectionId:last.sectionId??context.sectionId,unresolved:last.sectionId===null};}
 return next;
}
