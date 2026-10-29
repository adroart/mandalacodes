export interface VoiceRouteSection {id:string;title:string;aliases?:string[]}
export interface VoiceRouteEvidence {sectionId:string;atMs:number;spoken:string;command:'heading'|'next';timing:'recognition-received'}
const normalized=(text:string)=>text.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
/** Only a complete, final recognition result acts as a command. Ordinary prose
 * mentioning a heading must never silently reroute a take. */
export function recognizeVoiceRoute(spoken:string,sections:VoiceRouteSection[],currentSectionId:string|null,atMs:number):VoiceRouteEvidence|null{
 if(!Number.isFinite(atMs)||atMs<0)return null;
 const text=normalized(spoken),current=sections.findIndex(section=>section.id===currentSectionId);
 if(text==='next section')return current>=0&&current+1<sections.length?{sectionId:sections[current+1].id,atMs,spoken,command:'next',timing:'recognition-received'}:null;
 const matches=sections.filter(section=>[section.title,...(section.aliases??[])].some(title=>[normalized(title),`section ${normalized(title)}`,`go to ${normalized(title)}`].includes(text)));
 return matches.length===1?{sectionId:matches[0].id,atMs,spoken,command:'heading',timing:'recognition-received'}:null;
}
interface Recognition {
 continuous:boolean;interimResults:boolean;lang:string;
 onresult:((event:{resultIndex:number;results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onend:(()=>void)|null;
 start:()=>void;stop:()=>void;
}
type RecognitionConstructor=new()=>Recognition;
function recognitionConstructor():RecognitionConstructor|undefined{
 if(typeof window==='undefined')return undefined;
 const browser=window as unknown as {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
 return browser.SpeechRecognition??browser.webkitSpeechRecognition;
}
export const supportsVoiceRouting=()=>Boolean(recognitionConstructor());
export type VoiceRoutingStatus='listening'|'unsupported'|'denied'|'unavailable'|'stopped';
/** Recognition is optional and browser provided. It may use the browser vendor's
 * speech service. atMs records receipt time, never an invented word onset. */
export function startVoiceRouting(options:{sections:VoiceRouteSection[];currentSectionId:()=>string|null;elapsed:()=>number;onRoute:(evidence:VoiceRouteEvidence)=>void;onStatus:(status:VoiceRoutingStatus)=>void;lang?:string}):{stop:()=>void;supported:boolean}{
 const Constructor=recognitionConstructor();
 if(!Constructor){options.onStatus('unsupported');return{stop:()=>undefined,supported:false};}
 let stopped=false;
 const recognition=new Constructor();recognition.continuous=true;recognition.interimResults=false;recognition.lang=options.lang??'en-US';
 recognition.onresult=event=>{
  if(stopped)return;
  for(let i=event.resultIndex;i<event.results.length;i++){
   const result=event.results[i];if(!result.isFinal)continue;
   const route=recognizeVoiceRoute(result[0].transcript,options.sections,options.currentSectionId(),options.elapsed());
   if(route)options.onRoute(route);
  }
 };
 recognition.onerror=event=>{if(stopped)return;stopped=true;options.onStatus(event.error==='not-allowed'||event.error==='service-not-allowed'?'denied':'unavailable');try{recognition.stop();}catch{/* Already stopped. */}};
 recognition.onend=()=>{if(!stopped){stopped=true;options.onStatus('stopped');}};
 try{recognition.start();if(!stopped)options.onStatus('listening');}catch{stopped=true;options.onStatus('unavailable');}
 return{supported:true,stop:()=>{if(stopped)return;stopped=true;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.stop();}catch{/* Already stopped. */}options.onStatus('stopped');}};
}
