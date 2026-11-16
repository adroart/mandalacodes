import {Capacitor} from '../../../mobile/node_modules/@capacitor/core';
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
const isNative=()=>{try{return Capacitor.isNativePlatform();}catch{return false;}};
function storedChoice():string|null{try{return localStorage.getItem('oracle.voice.commands');}catch{return null;}}
/** "Move when I say a section's name": off in the installed app and wherever the browser has no
 * speech recognition; on elsewhere. A choice made in Settings wins. Send & next always works. */
export function voiceRoutingDefault(stored:string|null=storedChoice(),native=isNative()):boolean{
 if(stored==='true'||stored==='false')return stored==='true';
 return !native&&supportsVoiceRouting();
}
export type VoiceRoutingStatus='listening'|'unsupported'|'denied'|'unavailable'|'stopped';
/** Waits before starting recognition again after an end nobody asked for, longer each time. */
export const ROUTING_RESTART_MS=[300,1000,3000];
/** Quick ends in a row before listening stops for this recording. */
export const ROUTING_FAILURE_LIMIT=4;
/** A run at least this long was healthy, so its end starts the count again. */
const ROUTING_STEADY_MS=10_000;
/** Recognition is optional and browser provided. It may use the browser vendor's
 * speech service. atMs records receipt time, never an invented word onset.
 * Browsers end recognition by themselves after silence or a network hiccup. While the caller
 * has not stopped it, it is started again after a short wait; after repeated quick ends it
 * stops and reports `unavailable`, and a refusal reports `denied`. */
export function startVoiceRouting(options:{sections:VoiceRouteSection[];currentSectionId:()=>string|null;elapsed:()=>number;onRoute:(evidence:VoiceRouteEvidence)=>void;onStatus:(status:VoiceRoutingStatus)=>void;lang?:string;restartMs?:number[];failureLimit?:number}):{stop:()=>void;supported:boolean}{
 const Constructor=recognitionConstructor();
 if(!Constructor){options.onStatus('unsupported');return{stop:()=>undefined,supported:false};}
 const delays=options.restartMs?.length?options.restartMs:ROUTING_RESTART_MS,limit=options.failureLimit??ROUTING_FAILURE_LIMIT;
 let stopped=false,failures=0,startedAt=0,timer:ReturnType<typeof setTimeout>|undefined,recognition:Recognition|null=null;
 const detach=()=>{
  const r=recognition;recognition=null;if(!r)return;
  r.onresult=null;r.onerror=null;r.onend=null;
  try{r.stop();}catch{/* Already stopped. */}
 };
 const finish=(status:VoiceRoutingStatus)=>{if(stopped)return;stopped=true;if(timer)clearTimeout(timer);timer=undefined;detach();options.onStatus(status);};
 const restartLater=()=>{
  if(stopped)return;
  failures=Date.now()-startedAt>=ROUTING_STEADY_MS?1:failures+1;
  if(failures>=limit){finish('unavailable');return;}
  timer=setTimeout(()=>{timer=undefined;if(!stopped)open();},delays[Math.min(failures-1,delays.length-1)]);
 };
 const open=(first=false)=>{
  let r:Recognition;
  try{r=new Constructor();}catch{if(first)finish('unavailable');else restartLater();return;}
  recognition=r;
  r.continuous=true;r.interimResults=false;r.lang=options.lang??'en-US';
  r.onresult=event=>{
   if(stopped||recognition!==r)return;
   failures=0;
   for(let i=event.resultIndex;i<event.results.length;i++){
    const result=event.results[i];if(!result.isFinal)continue;
    const route=recognizeVoiceRoute(result[0].transcript,options.sections,options.currentSectionId(),options.elapsed());
    if(route)options.onRoute(route);
   }
  };
  // Other errors (no speech, network, aborted) end the run; onend starts it again.
  r.onerror=event=>{if(stopped||recognition!==r)return;if(event.error==='not-allowed'||event.error==='service-not-allowed')finish('denied');};
  r.onend=()=>{if(stopped||recognition!==r)return;recognition=null;restartLater();};
  startedAt=Date.now();
  try{r.start();}catch{if(recognition===r)recognition=null;if(first)finish('unavailable');else restartLater();}
 };
 open(true);
 if(!stopped)options.onStatus('listening');
 return{supported:true,stop:()=>finish('stopped')};
}
