import {ChevronLeft,ChevronRight,X,List,Settings2,Mic,Pause,Play,Check,Repeat,Undo2,Volume2,BookOpen} from 'lucide-react';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {AuthoringServices,SourceSnapshot} from '../../../lib/oracle/authoring/types';
import {AuthoringStore,type SavedSession} from '../../../lib/oracle/authoring/storage';
import {createSession} from '../../../lib/oracle/authoring/workflow';
import {importAudio} from '../../../lib/oracle/authoring/recorder';
import {cardSections,type CardSection} from '../../../lib/oracle/authoring/cardSections';
import {SectionDraftStore,sectionTitleEdits,createSectionDraftSession,integrateSectionDraft,undoIntegratedSection,sectionComparisonOriginal,sectionReviewExceptions,type SectionDraftSession,type SectionDraftResult} from '../../../lib/oracle/authoring/sectionDrafts';
import {changeSectionSession,processSectionSession,currentSectionTexts} from '../../../src/mobile/authoring/sectionWorkflow';
import {currentNamedReaderSection} from '../../../src/mobile/authoring/readerContext';
import {getSynthesis} from '../../../data/synthesisData';
import {CARD_BY_NUMBER} from '../../../data/oracleData';
import CaptureShelf from './CaptureShelf';
import SectionPassageReview from './SectionPassageReview';
import {replaceComparisonPassage,buildPassageComparison,comparisonRows,readingParagraphs,type PassageChoice} from '../../../lib/oracle/authoring/passageComparison';
import {BridgeConnection} from '../../../src/mobile/authoring/MacBridgeConnection';
import {queueSectionTake,discardSectionTake,restoreSectionTake,type TakeSession} from '../../../src/mobile/authoring/sectionTakes';
import {buildWordReplay,activeReplayWord,type ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
import type {PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import {focusedVoiceSections} from '../../../src/mobile/authoring/focusSections';
import {startVoiceCapturePass,type VoiceCapturePass} from '../../../src/mobile/authoring/voiceCapturePass';
import {startVoiceRouting,type VoiceRouteEvidence,type VoiceRoutingStatus} from '../../../src/mobile/authoring/voiceCaptureRouting';
import {phraseReplayBounds,loopVoicePhrase,type VoiceReplayBounds} from '../../../src/mobile/authoring/voiceTargets';
import VoiceSyncTools from './VoiceSyncTools';
import {restoreDocumentedCleanup} from '../../../src/mobile/authoring/speechCleanupReview';
import {enqueueVoicePhraseRevision} from '../../../src/mobile/authoring/voicePhraseRevision';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {cardSectionAuthorship,readingOriginSpans,namedSectionOriginSpans} from '../../../lib/oracle/authoring/sectionAuthorship';
import {useAccount} from '../../../lib/account/useAccount';
import {useNativeAccountActions} from '../../../src/mobile/account/NativeAccountProvider';
import {isSignInBlocked,resumeSignInBlockedRecordings} from '../../../src/mobile/authoring/accountRecovery';
import './SectionVoiceStudio.css';
interface Props{source:SourceSnapshot;services:AuthoringServices;sectionId:string;onClose:()=>void;onEarlier:()=>void;namedSectionId?:string;initialAnchors?:PassageAnchor[];onNavigateCard?:(card:number,sessionId?:string)=>void;initialSessionId?:string}
type View='work'|'review'|'settings'|'audio'|'sessions'|'sections'|'cleanup'|'unplaced';
type Tone='rec'|'busy'|'ready'|'check'|'human'|'alert';
const time=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;
/** The processing summary of timed mishearings is not repeated beside the timed words themselves.
 * An issue is settled once its exact quote is gone from the human words or the speaker confirms it. */
const bare=(quote:string)=>quote.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')||quote;
const issueKeys=(result:SectionDraftResult)=>[...(result.reviewIssues??[]).map((issue,index)=>({key:`i${index}/${issue.start}`,quote:bare(issue.quote),message:issue.message,issue})),...result.warnings.filter(warning=>!(result.reviewIssues?.length&&/^Check possible mishearings/.test(warning))).map((warning,index)=>({key:`w${index}`,quote:/[“"]([^”"]+)[”"]/.exec(warning)?.[1],message:warning,issue:undefined}))];
const quoted=(text:string,quote?:string)=>!quote||new RegExp(`(^|[^\\p{L}])${quote.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^\\p{L}]|$)`,'iu').test(text);

/** One manuscript to read and record over, one focused screen to compare, and plain screens for everything else. */
export default function SectionVoiceStudio({source,services,sectionId,onClose,onEarlier,namedSectionId,initialAnchors,onNavigateCard,initialSessionId}:Props){
 const account=useAccount(),accountActions=useNativeAccountActions();
 const [retrying,setRetrying]=useState(false);
 const store=useMemo(()=>new SectionDraftStore(),[]),audio=useMemo(()=>new AuthoringStore(),[]),workingStore=useMemo(()=>new WorkingCardStore(),[]);
 const [authorship,setAuthorship]=useState<ReturnType<typeof cardSectionAuthorship>>(),[authorshipFailed,setAuthorshipFailed]=useState(false);
 const [appliedOrigins,setAppliedOrigins]=useState<Record<string,ReturnType<typeof readingOriginSpans>>>({});
 const [draft,setDraft]=useState<SectionDraftSession>(),[savedAudio,setSavedAudio]=useState<SavedSession>(),[focusId,setFocusId]=useState(''),[targetId,setTargetId]=useState(''),[error,setError]=useState(''),[opening,setOpening]=useState(false),[integrating,setIntegrating]=useState(false),[active,setActive]=useState<VoiceCapturePass|null>(null),[monitor,setMonitor]=useState({elapsed:0,paused:false,level:null as number|null}),[audioUrl,setAudioUrl]=useState(''),[history,setHistory]=useState<SectionDraftSession[]>([]);
 const [view,setView]=useState<View>('work');
 const seekAt=useRef(0),clipBounds=useRef<VoiceReplayBounds|null>(null),loopCleanup=useRef<(()=>void)|null>(null);
 const [continuous,setContinuous]=useState(()=>localStorage.getItem('oracle.voice.continuous')==='true'),[voiceCommands,setVoiceCommands]=useState(()=>localStorage.getItem('oracle.voice.commands')!=='false'),[routingStatus,setRoutingStatus]=useState<VoiceRoutingStatus>('stopped'),[intent,setIntent]=useState<'auto'|'replace'|'add'|'revise'>('auto'),[loop,setLoop]=useState(false),[notice,setNotice]=useState(''),[linkedDrafts,setLinkedDrafts]=useState<SectionDraftSession[]>([]);
 const [phrase,setPhrase]=useState<{sectionId:string;from:number;to:number;text:string;baseText:string}|null>(null);
 const [paragraphAim,setParagraphAim]=useState<{sectionId:string;start:number;end:number;text:string}|null>(null);
 const focusByCapture=useRef(new Map<string,{start:number;end:number;text:string}|undefined>()),captureFocus=useRef<{start:number;end:number;text:string}|undefined>();
 const [resolved,setResolved]=useState<Record<string,true>>({}),[placing,setPlacing]=useState<number|null>(null),[caret,setCaret]=useState<number|undefined>(),[playhead,setPlayhead]=useState(0);
 const phraseCapture=useRef<typeof phrase>(null);
 const pickerReturn=useRef<'work'|'unplaced'|'review'>('work');
 const explicitChoice=useRef(false),reviewArrival=useRef(false);
 const continuation=useRef<string|undefined>(),nextContinuation=useRef<string|undefined>(),resumePlayback=useRef<{captureId:string;positionMs:number}|null>(null);
 const routeConfig=useRef<Parameters<typeof startVoiceRouting>[0]|null>(null);
 const routeHandle=useRef<ReturnType<typeof startVoiceRouting>|null>(null),captureTarget=useRef(''),segmentStart=useRef(0),markers=useRef<{atMs:number;sectionId:string}[]>([]),pendingNext=useRef<string|null>(null);
 const [playing,setPlaying]=useState(false);
 const manuscript=useRef<HTMLDivElement>(null),player=useRef<HTMLAudioElement>(null),recordingTarget=useRef(''),stopMode=useRef<'next'|'review'>('review');
 const [stopping,setStopping]=useState(false),[replay,setReplay]=useState<{text:string;words:ReplayWord[];captureId:string}|null>(null),[activeWord,setActiveWord]=useState(-1);
 const [titles,setTitles]=useState<Record<string,string>>({});
 const [references,setReferences]=useState<Record<string,string>>({});
 /** Latest application of each section across every session; an undo clears its integration. */
 const [authored,setAuthored]=useState<Record<string,{human:boolean;add:boolean;sessionId:string}>>({});
 const current=useRef(draft),handle=useRef<VoiceCapturePass|null>(null),mounted=useRef(true),pending=useRef(Promise.resolve()),failed=useRef(false);current.current=draft;
 const accept=(value:SectionDraftSession)=>{if(current.current?.id===value.id&&current.current.version>value.version)return;current.current=value;if(mounted.current)setDraft(value);};
 const report=(e:unknown)=>{if(mounted.current)setError(e instanceof Error?e.message:'Your recording is saved. Try again.');};
 const loadAudio=async(value:SectionDraftSession)=>{if(value.captureSessionId){const loaded=await audio.load(value.captureSessionId);if(mounted.current&&current.current?.id===value.id)setSavedAudio(loaded??undefined);}else if(mounted.current)setSavedAudio(undefined);};
 const reveal=(id:string,smooth=false)=>{const root=manuscript.current,element=root?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`);if(root&&element)root.scrollTo({top:Math.max(0,element.getBoundingClientRect().top-root.getBoundingClientRect().top+root.scrollTop-4),behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});};
 const make=async()=>{await pending.current;if(failed.current)throw Error('Save your current words before starting another session.');const synthesis=await getSynthesis(source.cardNumber),allNodes=cardSections(source,synthesis?.summary),nodes=initialAnchors?.length?focusedVoiceSections(source,allNodes,initialAnchors):allNodes;const visible=namedSectionId??currentNamedReaderSection(nodes);const start=nodes.find(s=>s.id===visible)??(sectionId==='CODE'?nodes[0]:nodes.find(s=>s.lensId===sectionId))??nodes[0];const value=await store.save(createSectionDraftSession(source,nodes,start.id),0);accept(value);setFocusId(start.id);setTargetId(start.id);setSavedAudio(undefined);setView('work');return value;};
 useEffect(()=>{mounted.current=true;let alive=true;void(async()=>{const previous=initialSessionId?await store.get(initialSessionId):(await store.list(source.cardNumber)).find(s=>s.sourceHash===source.hash&&s.state!=='complete'&&(!initialAnchors?.length||s.sections.length===initialAnchors.filter(anchor=>anchor.cardNumber===source.cardNumber).length&&s.sections.every(node=>initialAnchors.some(anchor=>anchor.cardNumber===source.cardNumber&&anchor.text===node.text&&anchor.sectionText===node.sectionText&&anchor.start===node.start))));if(!alive)return;if(previous&&previous.sourceHash===source.hash){accept(previous);
   // Opening Record aims at what was being read; an older resume point never silently wins.
   const reading=namedSectionId&&previous.sections.some(n=>n.id===namedSectionId)?namedSectionId:undefined;
   setTargetId(reading??previous.resume?.sectionId??previous.startSectionId);
   setFocusId(initialSessionId?previous.results[0]?.sectionId??previous.startSectionId:reading??previous.resume?.sectionId??previous.results[0]?.sectionId??previous.startSectionId);
   if(initialSessionId)setView('review');
   await loadAudio(previous);if(['transcribing','assimilating'].includes(previous.state))void processSectionSession(previous.id,services).catch(report);}else await make();})().catch(report);const unsubscribe=store.subscribe(()=>{const id=current.current?.id;if(id)void store.get(id).then(value=>{if(value&&current.current?.id===id&&value.version>=(current.current?.version??0)){accept(value);void loadAudio(value);}}).catch(report);});return()=>{alive=false;mounted.current=false;unsubscribe();routeHandle.current?.stop();loopCleanup.current?.();void handle.current?.stop();};},[source.cardNumber]);
 useEffect(()=>{if(!active)return;const tick=()=>setMonitor({elapsed:active.elapsed(),paused:active.state()==='paused',level:active.level()});const timer=setInterval(tick,150);const before=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',before);return()=>{clearInterval(timer);window.removeEventListener('beforeunload',before);};},[active]);
 useEffect(()=>()=>{if(audioUrl)URL.revokeObjectURL(audioUrl);},[audioUrl]);
 const nodes=draft?.sections??[],review=view==='review',processing=draft?.state==='transcribing'||draft?.state==='assimilating';
 const section=nodes.find(s=>s.id===focusId)??nodes.find(s=>s.id===draft?.startSectionId)??nodes[0],result=draft?.results.find(r=>r.sectionId===section?.id),results=draft?.results??[];
 const target=nodes.find(n=>n.id===targetId)??nodes.find(n=>n.id===draft?.startSectionId)??nodes[0];
 const prepare=async(id:string)=>{try{await processSectionSession(id,services);const value=await store.get(id);if(value&&mounted.current){accept(value);setFocusId(value.results[0]?.sectionId??value.startSectionId);setView('review');await loadAudio(value);}}catch(e){report(e);}};
 const patch=async(change:(s:SectionDraftSession)=>SectionDraftSession)=>{if(!current.current)throw Error('Wait for your card to open.');const value=await changeSectionSession(current.current.id,change);accept(value);return value;};
 const stopListening=()=>{const at=replay?.words[activeWord]?.from;player.current?.pause();loopCleanup.current?.();loopCleanup.current=null;clipBounds.current=null;setReplay(null);setActiveWord(-1);setAudioUrl('');setPlaying(false);setCaret(at);};
 const choose=async(id:string)=>{explicitChoice.current=true;await flush();setFocusId(id);setPhrase(null);if(audioUrl)stopListening();};
 /** Aiming never starts the microphone and never moves while a recording is running. */
 const aim=(id:string,scroll=false)=>{if(handle.current||opening)return;setTargetId(id);setFocusId(id);setParagraphAim(null);setError('');if(scroll)requestAnimationFrame(()=>reveal(id,true));};
 /** A section applied in an earlier session reopens that session, where its undo lives. */
 const openApplied=async(id:string)=>{const sessionId=results.some(r=>r.sectionId===id)?undefined:authored[id]?.sessionId;if(sessionId&&sessionId!==draft?.id){await flush();const value=await store.get(sessionId);if(!value)return;accept(value);await loadAudio(value);}reviewAt(id);};
 /** Only this paragraph can change; its neighbours stay whatever is said. */
 const aimParagraph=(id:string,paragraph:{start:number;end:number;text:string})=>{if(handle.current||opening)return;setTargetId(id);setFocusId(id);setParagraphAim({sectionId:id,...paragraph});setError('');};
 const reviewAt=(id:string)=>{explicitChoice.current=true;setFocusId(id);setPhrase(null);if(audioUrl)stopListening();setView('review');};
 const record=async(phraseTarget:typeof phrase=null,targetSection=targetId)=>{if(!current.current||opening||handle.current||stopping)return;setOpening(true);explicitChoice.current=false;setError('');setNotice('');setView('work');setReplay(null);player.current?.pause();setAudioUrl('');try{
  await flush();if(phraseTarget&&current.current?.results.find(r=>r.sectionId===phraseTarget.sectionId)?.text!==phraseTarget.baseText)throw Error('Those words changed. Select the phrase again.');if(intent==='revise'&&!phraseTarget&&!initialAnchors?.length)throw Error('Select the exact words to revise first.');let value=current.current!;phraseCapture.current=phraseTarget;
  let saved=value.captureSessionId?await audio.load(value.captureSessionId):null;
  if(!saved){const session=createSession(source);saved={session,version:await audio.save(session,0)};}
  if(saved.session.captures.some(c=>c.status==='recording'))throw Error('Recover your saved recording before starting another take.');
  const target=value.sections.find(s=>s.id===targetSection)??value.sections.find(s=>s.id===value.startSectionId)!;
  captureFocus.current=!phraseTarget&&paragraphAim?.sectionId===target.id?{start:paragraphAim.start,end:paragraphAim.end,text:paragraphAim.text}:undefined;
  continuation.current=undefined;nextContinuation.current=undefined;recordingTarget.current=target.id;captureTarget.current=target.id;markers.current=[{atMs:0,sectionId:target.id}];pendingNext.current=null;stopMode.current='review';
  value=await changeSectionSession(value.id,s=>({...s,captureSessionId:saved!.session.id}));accept(value);const id=value.id;
  const recorder=await startVoiceCapturePass(audio,saved,target.lensId==='INTRO'?'CODE':target.lensId,report,source.cardNumber,{
   continuous:phraseTarget?false:continuous,rollOnBoundary:!phraseTarget,
   onActive:captureId=>{focusByCapture.current.set(captureId,captureFocus.current);continuation.current=nextContinuation.current;nextContinuation.current=undefined;captureTarget.current=recordingTarget.current;segmentStart.current=handle.current?.elapsed()??0;markers.current=[{atMs:0,sectionId:captureTarget.current}];void changeSectionSession(id,s=>({...s,state:'recording',captureId,error:undefined})).then(accept).catch(report);},
   onSegmentReady:async(savedTake,captureId,metadata)=>{const finished=savedTake.session.captures.find(c=>c.id===captureId);if(!finished||finished.status==='empty'||finished.durationMs<=0)return;await changeSectionSession(id,s=>({...s,state:'ready'}));if(phraseCapture.current){const selected=phraseCapture.current;const queued=await enqueueVoicePhraseRevision({draftId:id,sectionId:selected.sectionId,from:selected.from,to:selected.to,baseText:selected.baseText,captureSessionId:savedTake.session.id,captureId},services);accept(queued);setPhrase(null);phraseCapture.current=null;return;}const queued=await queueSectionTake(id,captureId,captureTarget.current,services,markers.current,{intent:intent==='auto'?undefined:intent,continuationOf:continuation.current,focus:focusByCapture.current.get(captureId)});nextContinuation.current=metadata.reason==='boundary'?captureId:undefined;if(current.current?.id===id){accept(queued);await loadAudio(queued);}if(pendingNext.current){recordingTarget.current=pendingNext.current;setFocusId(pendingNext.current);setTargetId(pendingNext.current);reveal(pendingNext.current);pendingNext.current=null;}},
   onProcessingFailure:report,
  });handle.current=recorder;setActive(recorder);setMonitor({elapsed:0,paused:false,level:null});setFocusId(target.id);setTargetId(target.id);
  routeConfig.current={sections:value.sections.map(node=>({id:node.id,title:node.title,aliases:[titleFor(node),node.title.split(/\s+[—–]\s+/)[0],...(node.id===value.sections[0].id?['intro']:[])]})),currentSectionId:()=>recordingTarget.current,elapsed:()=>Math.max(0,recorder.elapsed()-segmentStart.current),onStatus:setRoutingStatus,onRoute:(event:VoiceRouteEvidence)=>{const node=value.sections.find(n=>n.id===event.sectionId);if(!node)return;markers.current.push({atMs:event.atMs,sectionId:node.id});recordingTarget.current=node.id;captureFocus.current=undefined;setParagraphAim(null);recorder.mark(node.lensId==='INTRO'?'CODE':node.lensId);setFocusId(node.id);setTargetId(node.id);reveal(node.id,true);setNotice(`Heard “${titleFor(node)}”. Recording into it now.`);}};if(voiceCommands&&!phraseTarget)routeHandle.current=startVoiceRouting(routeConfig.current);
  void recorder.completion.then(async()=>{routeHandle.current?.stop();routeHandle.current=null;handle.current=null;const latest=await changeSectionSession(id,s=>({...s,state:s.results.length?'review':'ready'}));accept(latest);if(mounted.current){setActive(null);setStopping(false);if(stopMode.current==='next')setView('work');else{explicitChoice.current=true;setFocusId(recordingTarget.current);setView('review');}}}).catch(e=>{handle.current=null;routeHandle.current?.stop();if(mounted.current){setActive(null);setStopping(false);}report(e);});
 }catch(e){report(e);}finally{setOpening(false);}};
 const stop=(mode:'next'|'review')=>{const capture=handle.current;if(!capture||stopping)return;stopMode.current=mode;if(mode==='review')reviewArrival.current=true;setStopping(true);if(mode==='next'&&!phraseCapture.current){const index=nodes.findIndex(node=>node.id===recordingTarget.current),next=nodes[index+1];pendingNext.current=next?.id??null;captureFocus.current=undefined;setParagraphAim(null);if(next){setTargetId(next.id);reveal(next.id,true);}void capture.flush({continue:continuous&&!!next,nextSectionId:next?(next.lensId==='INTRO'?'CODE':next.lensId):undefined}).then(()=>{if(mounted.current)setStopping(false);}).catch(e=>{setStopping(false);report(e);});}else void capture.stop().catch(e=>{setStopping(false);report(e);});};
 const togglePause=()=>{if(!active)return;if(active.state()==='paused'){active.resume();if(voiceCommands&&routeConfig.current&&!phraseCapture.current)routeHandle.current=startVoiceRouting(routeConfig.current);}else{active.pause();routeHandle.current?.stop();routeHandle.current=null;}};

 const edit=(id:string,original:string,index:number,replacement:string)=>{failed.current=false;const task=pending.current.then(()=>patch(s=>({...s,results:s.results.map(r=>{if(r.sectionId!==id)return r;const next=replaceComparisonPassage(original,r.text,r.editIntent==='add'?undefined:r.comparison,index,replacement);return {...r,...next,comparison:next.comparison,checked:false,applied:false};})}))).then(()=>undefined);pending.current=task.catch(e=>{failed.current=true;report(e);});return task;};
 const choosePassage=(id:string,key:string,choice:PassageChoice)=>{failed.current=false;const task=pending.current.then(()=>patch(s=>({...s,results:s.results.map(r=>r.sectionId===id?{...r,rowChoices:{...r.rowChoices,[key]:choice}}:r)}))).then(()=>undefined);pending.current=task.catch(e=>{failed.current=true;report(e);});};
 const checkWords=(id:string,checked:boolean)=>{if(!current.current)return;const update=(s:SectionDraftSession)=>({...s,results:s.results.map(r=>r.sectionId===id?{...r,checked}:r)});accept(update(current.current));failed.current=false;const task=pending.current.then(()=>patch(update)).then(()=>undefined);pending.current=task.catch(e=>{failed.current=true;report(e);});};
 const flush=async()=>{(document.activeElement as HTMLElement)?.blur();await pending.current;if(failed.current)throw Error('Your edit could not be saved. Retry saving it before integrating.');};
 const integrate=async(all=false)=>{if(!draft||!section)return;setIntegrating(true);setError('');setNotice('');try{await flush();let value=(await store.get(draft.id))!;const targets=all?value.results.filter(r=>!r.applied&&(!sectionReviewExceptions(r).needsReview||r.checked)):value.results.filter(r=>r.sectionId===section.id&&!r.applied);if(!targets.length)throw Error('Choose a section with words to integrate.');for(const target of targets){if(sectionReviewExceptions(target).needsReview&&!target.checked)throw Error('Check the flagged words against your recording first.');await changeSectionSession(value.id,s=>({...s,results:s.results.map(r=>r.sectionId===target.sectionId?{...r,checked:true}:r)}));value=await integrateSectionDraft(value.id,target.sectionId,services);accept(value);if(initialAnchors?.length&&value.results.every(r=>r.applied)){onClose();const node=value.sections.find(n=>n.id===target.sectionId);requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('oracle:focus-passage',{detail:{cardNumber:value.cardNumber,sectionId:node?.lensId,text:target.text.split(/\n\s*\n/)[0]}})));}}if(all)setNotice(`${plural(targets.length,'section')} saved to your reading.`);}catch(e){report(e);}finally{setIntegrating(false);}};
 const playCapture=async(captureId:string,startMs=0)=>{if(clipBounds.current?.captureId!==captureId)clipBounds.current=null;const value=current.current;if(!value?.captureSessionId)return;const url=URL.createObjectURL(await audio.audio(value.captureSessionId,captureId));seekAt.current=startMs/1000;setAudioUrl(url);setReplay(r=>r?{...r,captureId}:r);};
 const listen=async(from=0,to?:number)=>{if(!draft?.captureSessionId)return;try{await flush();const latest=await store.get(draft.id),candidate=latest?.results.find(r=>r.sectionId===section?.id);if(!candidate)return;const saved=await audio.load(draft.captureSessionId);const words=buildWordReplay(candidate.text,saved?.session.transcript??[],candidate.evidenceQuotes);const bounds=phraseReplayBounds(words,from,to??candidate.text.length),captureId=bounds?.captureId??words.find(w=>w.captureId)?.captureId??candidate.takeIds?.[0]??draft.captureId??saved?.session.captures[0]?.id;if(!captureId)return;clipBounds.current=bounds;if(!bounds)setNotice('Exact word timing is unavailable here, so the whole take plays.');setReplay({text:candidate.text,words,captureId});setActiveWord(-1);const resume=resumePlayback.current?.captureId===captureId?resumePlayback.current.positionMs:undefined;resumePlayback.current=null;await playCapture(captureId,resume!==undefined&&(!bounds||resume<bounds.endMs)?Math.max(bounds?.startMs??0,resume):bounds?.startMs??words.find(w=>w.captureId===captureId)?.startMs??0);}catch(e){report(e);}};
 const hear=(issue:NonNullable<SectionDraftResult['reviewIssues']>[number])=>{if(!issue.captureId||issue.startMs===undefined)return;setReplay(null);clipBounds.current={captureId:issue.captureId,startMs:Math.max(0,issue.startMs-300),endMs:(issue.endMs??issue.startMs)+600,from:issue.start,to:issue.end};void playCapture(issue.captureId,clipBounds.current.startMs).catch(report);};

 const addAudio=async(file:File,duration:number)=>{if(!current.current)return;explicitChoice.current=false;reviewArrival.current=true;setNotice('');setError('');let value=current.current;let saved=value.captureSessionId?await audio.load(value.captureSessionId):null;if(!saved){const session=createSession(source);saved={session,version:await audio.save(session,0)};}const target=value.sections.find(s=>s.id===targetId)??value.sections[0];saved=await importAudio(audio,saved,file,duration,target.lensId==='INTRO'?'CODE':target.lensId,source.cardNumber);const captureId=saved.session.captures.at(-1)!.id;value=await changeSectionSession(value.id,s=>({...s,captureSessionId:saved!.session.id,captureId}));accept(value);setSavedAudio(saved);accept(await queueSectionTake(value.id,captureId,target.id,services));setView('review');};
 const discard=async(captureId:string)=>{if(!current.current)return;await flush();const value=await discardSectionTake(current.current.id,captureId);accept(value);player.current?.pause();setAudioUrl('');setReplay(null);await loadAudio(value);};
 const showAudio=async()=>{if(!current.current)return;let value=current.current;if(!value.captureSessionId){const session=createSession(source);const saved={session,version:await audio.save(session,0)};value=await patch(s=>({...s,captureSessionId:session.id}));setSavedAudio(saved);}await loadAudio(value);};
 const close=async()=>{try{await flush();if(!handle.current)onClose();}catch(e){report(e);}};
 const openView=(next:View)=>{player.current?.pause();setReplay(null);setAudioUrl('');setView(next);setError('');if(next==='review'&&!(explicitChoice.current&&results.some(r=>r.sectionId===focusId))){const first=results.find(r=>!r.applied&&sectionReviewExceptions(r).needsReview&&!r.checked)??results.find(r=>!r.applied)??results[0];if(first)setFocusId(first.sectionId);}if(next==='audio')void showAudio().catch(report);if(next==='sessions')void store.list(source.cardNumber).then(setHistory).catch(report);};
 useEffect(()=>{let alive=true;if(draft)void currentSectionTexts(draft).then(value=>{if(alive)setReferences(value);}).catch(report);return()=>{alive=false;};},[draft?.id,draft?.results.map(r=>r.appliedText).join('|')]);
 const takes=(draft as TakeSession|undefined)?.takes??[],queued=takes.filter(t=>['queued','transcribing','assimilating'].includes(t.state)),discarded=new Set(takes.filter(t=>t.state==='discarded').map(t=>t.captureId));
 const failedTakes=takes.filter(take=>take.state==='failed');
 const signInBlocked=failedTakes.some(take=>isSignInBlocked(take.error))||isSignInBlocked(draft?.error);
 const processingMessage=(failedTakes[0]?.error??draft?.error??'').replace(/\s*Your (?:local )?(?:recording|words|recording and words) (?:is|are) saved\.?\s*$/i,'');
 const savedCaptures=savedAudio?.session.captures.filter(capture=>!discarded.has(capture.id)&&['ready','interrupted'].includes(capture.status)&&capture.durationMs>0)??[];
 const needsSignIn=accountActions.enabled&&account.isLoaded&&(!account.isSignedIn||signInBlocked);
 const retrySaved=async()=>{if(!draft||retrying)return;setRetrying(true);setError('');try{await flush();for(const take of failedTakes)accept(await queueSectionTake(draft.id,take.captureId,take.startSectionId,services,take.markers));if(!takes.length)await prepare(draft.id);}catch(e){report(e);}finally{if(mounted.current)setRetrying(false);}};
 const signInAndResume=async()=>{setError('');try{await flush();await accountActions.signInWithGoogle();await resumeSignInBlockedRecordings(services);}catch(e){report(e);}};
 useEffect(()=>{if(view==='review'&&results.length&&((!explicitChoice.current&&reviewArrival.current&&!queued.length)||!results.some(r=>r.sectionId===focusId))){const first=results.find(r=>!r.applied&&sectionReviewExceptions(r).needsReview&&!r.checked)??results.find(r=>!r.applied)??results[0];setFocusId(first.sectionId);reviewArrival.current=false;}},[view,draft?.version]);
 useEffect(()=>{if(view==='work'&&nodes.length)reveal(handle.current?recordingTarget.current:targetId);},[draft?.id,view]);
 useEffect(()=>{if(!playing)return;let frame=0;const tick=()=>{if(player.current){setPlayhead(player.current.currentTime*1000);if(replay)setActiveWord(activeReplayWord(replay.words,replay.captureId,player.current.currentTime*1000));}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[playing,replay]);
 const titleFor=(node:CardSection)=>draft?.titleEdits?.[node.id]?.text??titles[node.id]??node.title;
 const saveTitle=(id:string,text:string)=>{failed.current=false;const task=pending.current.then(()=>patch(s=>({...s,titleEdits:{...s.titleEdits,[id]:{text:text.trim(),updatedAt:new Date().toISOString()}}}))).then(()=>undefined);pending.current=task.catch(e=>{failed.current=true;report(e);});return task;};
 useEffect(()=>{let alive=true;void store.list(source.cardNumber).then(values=>{if(alive)setTitles(sectionTitleEdits(values,source.hash));}).catch(report);return()=>{alive=false;};},[draft?.id,source.hash]);
 useEffect(()=>{
  let alive=true,request=0;
  const refresh=async()=>{const version=++request;try{
   const [values,working,synthesis]=await Promise.all([store.list(source.cardNumber),workingStore.list(source.cardNumber),getSynthesis(source.cardNumber)]);
   if(!alive||version!==request)return;
   const latest:typeof authored={};values.filter(s=>s.sourceHash===source.hash).flatMap(s=>s.results.filter(r=>r.appliedAt).map(r=>({id:r.sectionId,at:r.appliedAt!,human:!!r.integrationId,add:r.editIntent==='add',sessionId:s.id}))).sort((a,b)=>a.at.localeCompare(b.at)).forEach(({id,at,...value})=>{latest[id]=value;});setAuthored(latest);
   const all=cardSections(source,synthesis?.summary),coverage=cardSectionAuthorship(source,all,working,values),origins:typeof appliedOrigins={};
   for(const node of all){const spans=namedSectionOriginSpans(source,node,working,values);if(spans)origins[node.id]=spans;}
   setAppliedOrigins(origins);setAuthorship(coverage);setAuthorshipFailed(false);
  }catch{if(alive&&version===request){setAuthorshipFailed(true);}}};
  void refresh();const unsubscribe=workingStore.subscribe(()=>void refresh());
  return()=>{alive=false;unsubscribe();};
 },[draft?.id,draft?.version,source.hash]);
 useEffect(()=>{let alive=true;void Promise.all(((draft as TakeSession|undefined)?.linkedSessionIds??[]).map(id=>store.get(id))).then(values=>{if(alive){const latest=new Map<number,SectionDraftSession>();values.filter((v):v is SectionDraftSession=>!!v).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).forEach(value=>latest.set(value.cardNumber,value));setLinkedDrafts([...latest.values()]);}}).catch(report);return()=>{alive=false;};},[draft?.id,(draft as TakeSession|undefined)?.linkedSessionIds?.join('|')]);
 const readUpdated=()=>{const node=section,r=result;if(!node||!r?.appliedText)return;onClose();requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('oracle:focus-passage',{detail:{cardNumber:source.cardNumber,sectionId:node.lensId,text:r.appliedText.split(/\n\s*\n/)[0]}})));};
 useEffect(()=>{if(!draft||active||!focusId)return;const id=draft.id,timer=setTimeout(()=>void changeSectionSession(id,s=>({...s,resume:{sectionId:focusId,mode:view,positionMs:(player.current?.currentTime??0)*1000}})).then(value=>{if(current.current?.id===id)accept(value);}).catch(report),500);return()=>clearTimeout(timer);},[draft?.id,focusId,view,!!active]);
 useEffect(()=>{setResolved({});setCaret(undefined);},[draft?.id,focusId]);

 const chip=(node:CardSection):{label:string;tone:Tone}|null=>{
  if(active&&recordingTarget.current===node.id)return {label:monitor.paused?'Paused':'Recording',tone:monitor.paused?'busy':'rec'};
  const r=results.find(x=>x.sectionId===node.id);
  if(r?.applied)return {label:authorship?.sections[node.id]==='human'?'Your words':r.editIntent==='add'?'Your addition':'Partly your words',tone:'human'};
  if(r)return sectionReviewExceptions(r).needsReview&&!r.checked?{label:'Check words',tone:'check'}:{label:'Ready to review',tone:'ready'};
  if(authored[node.id]?.human)return {label:authorship?.sections[node.id]==='human'?'Your words':authored[node.id].add?'Your addition':'Partly your words',tone:'human'};
  if(takes.some(t=>t.startSectionId===node.id&&queued.includes(t)))return {label:'Processing',tone:'busy'};
  if(takes.some(t=>t.startSectionId===node.id&&t.state==='failed'))return {label:'Needs attention',tone:'alert'};
  return null;
 };
 const reviewList=nodes.filter(n=>results.some(r=>r.sectionId===n.id)),position=reviewList.findIndex(n=>n.id===section?.id);
 const step=(direction:number)=>{const next=reviewList[position+direction];if(next)void choose(next.id).catch(report);};
 const waiting=results.filter(r=>!r.applied).length+(draft?.unassigned.length??0);
 const checks=result&&!result.applied&&!result.checked&&sectionReviewExceptions(result).needsReview?issueKeys(result).map(item=>({...item,done:!!resolved[item.key]||!!item.quote&&!quoted(result.text,item.quote)})):[];
 const open=checks.filter(c=>!c.done).length;
 const generalCheck=checks.some(c=>!c.quote);
 const progressText=authorshipFailed?'Authorship unavailable':!authorship?'Checking authorship…':authorship.total?`${authorship.human} of ${authorship.total} ${authorship.total===1?'section':'sections'} in your words`:'No recordable sections';
 const pathFor=(node:CardSection)=>[...node.path.slice(0,-1),titleFor(node)].filter((part,i,all)=>i===0||part!==all[i-1]).join(' · ');
 const scopeFor=(node:CardSection,focus?:{start:number;text:string})=>{const ps=readingParagraphs(references[node.id]??node.text);const i=focus?ps.findIndex(p=>p.start===focus.start&&p.text===focus.text):-1;return i>=0?`Paragraph ${i+1} of ${ps.length}`:ps.length>1?`All ${ps.length} paragraphs`:'Whole section';};
 const spanLabel=(node:CardSection,focus?:{start:number;text:string})=>{const paragraphs=readingParagraphs(references[node.id]??node.text);if(focus){const i=paragraphs.findIndex(p=>p.start===focus.start&&p.text===focus.text);return i>=0?` · paragraph ${i+1}`:'';}return paragraphs.length>1?` · all ${paragraphs.length} paragraphs`:'';};
 const nextAfter=(id?:string)=>nodes[nodes.findIndex(n=>n.id===id)+1];
 const nextReview=reviewList.find((n,index)=>index>position&&!results.find(r=>r.sectionId===n.id)?.applied)??reviewList.find(n=>!results.find(r=>r.sectionId===n.id)?.applied&&n.id!==section?.id);
 const readyClean=results.filter(r=>!r.applied&&(!sectionReviewExceptions(r).needsReview||r.checked));
 const applyLabel=(()=>{if(!result||!section)return {text:'',empty:false};if(result.editIntent==='add')return {text:'Add my words',empty:false};const base=sectionComparisonOriginal(result,references[section.id]??section.text),view=buildPassageComparison(base,result.text,result.comparison);
  if(view.kind!=='matched'||view.pairs.length<2){const n=readingParagraphs(base).length;return {text:n>1?`Replace all ${n} paragraphs`:'Replace with my words',empty:false};}
  const rows=comparisonRows(view,result.rowChoices),replace=rows.filter(r=>r.kind==='replaced'&&r.changes).length,added=rows.filter(r=>r.kind==='new'&&r.changes).length,removed=rows.filter(r=>r.kind==='unspoken'&&r.choice==='mine').length;
  const parts=[replace&&`replace ${plural(replace,'passage')}`,added&&`add ${plural(added,'passage')}`,removed&&`remove ${removed}`].filter(Boolean) as string[];
  return parts.length?{text:parts.join(' · ').replace(/^./,c=>c.toUpperCase()),empty:false}:{text:'Nothing to change',empty:true};})();
 const applySection=async()=>{if(!result||!section)return;if(checks.length&&!open)checkWords(section.id,true);await integrate();};
 const recordingNode=active?nodes.find(n=>n.id===recordingTarget.current)??target:target,upcoming=active&&!phraseCapture.current?nextAfter(recordingTarget.current):undefined;
 const nextRecording=result?.applied&&!initialAnchors?.length?nextAfter(section?.id):undefined;
 const appliedText=result?.appliedText??result?.text??'';
 const originSpans=section?appliedOrigins[section.id]:undefined;
 const displayOrigins=originSpans?.map(part=>part.text).join('')===appliedText?originSpans:[{text:appliedText,origin:section&&authorship?.sections[section.id]==='human'?'human':'unknown'}];
 const locked=!!active||opening||integrating;
 const back=(to:View)=><button className="vs-icon" aria-label="Back" onClick={()=>openView(to)}>Back</button>;
 const screenTitle:Record<View,string>={work:'',review:'',settings:'Recording settings',audio:'Recordings',sessions:'Sessions',sections:placing!==null?'Place these words':'Sections',cleanup:'Speech cleanup',unplaced:'Unplaced words'};

 const index=(onPick:(node:CardSection)=>void,mode:'rail'|'screen')=><nav className={mode==='rail'?'vs-rail':'vs-index'} aria-label={mode==='rail'?'Card sections':'Choose a card section'}>{nodes.map((node,i)=>{const state=chip(node);return <React.Fragment key={node.id}>{node.lensId!==nodes[i-1]?.lensId&&node.path.length>1&&<h3>{node.path[0]}</h3>}<button data-section-id={node.id} aria-current={(view==='review'?focusId:targetId)===node.id?'step':undefined} onClick={()=>onPick(node)}><span>{titleFor(node)}</span>{state&&<i data-tone={state.tone} aria-label={state.label}/>}</button></React.Fragment>;})}</nav>;
 const pickFromRail=(node:CardSection)=>{if(view==='review'&&results.some(r=>r.sectionId===node.id))void choose(node.id).catch(report);else{if(view!=='work')openView('work');aim(node.id,true);}};

 return <section className="section-voice-studio" aria-label="Voice recording" data-view={view} data-recording-section-id={active?recordingTarget.current:undefined} data-authoring-protected={!!active||opening||integrating||undefined} onKeyDown={e=>{if(view!=='review'||(e.target as HTMLElement).closest('textarea,input,[contenteditable=true],button'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}}}>
  <header className="vs-bar" data-card-header={view==='work'||undefined}>
   {view==='work'?<button className="vs-icon" aria-label="Close recording" disabled={locked} onClick={()=>void close()}><span>Close</span></button>:view==='review'?back('work'):back(view==='audio'||view==='sessions'?'settings':view==='settings'?'work':view==='sections'?pickerReturn.current:view==='unplaced'&&!results.length?'work':'review')}
   {view==='work'&&<div className="vs-bar-title"><strong>Code {source.cardNumber} · {CARD_BY_NUMBER.get(source.cardNumber)?.card_name??'Oracle'}</strong></div>}
   {view==='review'&&<button className="vs-bar-title vs-bar-title--button" aria-label="Choose a section to review" onClick={()=>{pickerReturn.current='review';setPlacing(null);openView('sections');}}><strong>{result?.applied?'Applied':'Review'}</strong><small>{position>=0?`${position+1} of ${reviewList.length}`:queued.length?'Processing':savedCaptures.length?'Transcript pending':'Nothing to review yet'}</small></button>}
   {view!=='work'&&view!=='review'&&<div className="vs-bar-title"><strong>{screenTitle[view]}</strong></div>}
   <div className="vs-bar-end">
    {view==='work'&&<><button className="vs-icon vs-only-narrow" aria-label="Sections" onClick={()=>{pickerReturn.current='work';setPlacing(null);openView('sections');}}><span>Sections</span></button><button className="vs-icon" aria-label="Recording settings" disabled={!!active} onClick={()=>openView('settings')}><span>Settings</span></button></>}
    {view==='review'&&<><button className="vs-icon" aria-label="Previous section" disabled={position<=0||integrating} onClick={()=>step(-1)}><span>Previous</span></button><button className="vs-icon" aria-label="Next section" disabled={position<0||position>=reviewList.length-1||integrating} onClick={()=>step(1)}><span>Next</span></button></>}
   </div>
   {view==='work'&&<div className="vs-card-progress" aria-label="Card authorship"><span>{progressText}</span>{authorship&&!authorshipFailed&&authorship.total>0&&<div className="vs-authorship-track" role="progressbar" aria-label="Sections entirely in your words" aria-valuemin={0} aria-valuemax={authorship.total} aria-valuenow={authorship.human} aria-valuetext={progressText}><i style={{width:`${authorship.human/authorship.total*100}%`}}/></div>}</div>}
  </header>
  {!active&&!opening&&(needsSignIn||savedCaptures.length>0&&(failedTakes.length>0||!!draft?.error))&&<section className="vs-processing-status" aria-label="Recording and transcription status">
   <div><strong>{savedCaptures.length?`${plural(savedCaptures.length,'recording')} saved on this device`:'Sign in once for automatic transcription'}</strong><span>{needsSignIn?'Your sign-in will be remembered. Saved recordings will resume.':processingMessage}</span></div>
   <div className="vs-processing-actions">{savedCaptures.length>0&&view!=='audio'&&<button className="vs-btn" onClick={()=>openView('audio')}>Listen</button>}{needsSignIn?<button className="vs-btn vs-btn--primary" disabled={accountActions.busy||retrying} onClick={()=>void signInAndResume()}>{accountActions.busy?'Signing in…':account.isSignedIn?'Reconnect':'Sign in'}</button>:<button className="vs-btn vs-btn--primary" disabled={retrying||processing||!!queued.length} onClick={()=>void retrySaved()}>{retrying?'Retrying…':'Retry'}</button>}</div>
  </section>}
  <div className="vs-main">
   {(view==='work'||view==='review')&&index(pickFromRail,'rail')}

   {view==='work'&&(active&&phraseCapture.current?<section className="vs-prompt" aria-label="Selected phrase recording"><small>Say these words again</small><p>{phraseCapture.current.text}</p><span>Everything around them stays as it is.</span></section>:
    <div ref={manuscript} className="vs-stage vs-manuscript" aria-label="Card manuscript">
     {!!initialAnchors?.length&&<p className="vs-lead">Your selected {initialAnchors.length>1?'passages':'passage'}. Only these words are replaced.</p>}
     {nodes.map((node,i)=>{const state=chip(node),aimed=(active?recordingTarget.current:targetId)===node.id;return <section key={node.id} className="vs-section" data-paragraph-aim={(active?!!captureFocus.current&&recordingTarget.current===node.id:paragraphAim?.sectionId===node.id)||undefined} data-section-id={node.id} aria-label={node.path.join(' · ')} aria-current={aimed?'step':undefined} data-recording={active&&!monitor.paused&&recordingTarget.current===node.id||undefined}>
      {node.lensId!==nodes[i-1]?.lensId&&node.path.length>1&&<p className="vs-lens">{node.path[0]}</p>}
      <button className="vs-section-head" aria-pressed={aimed} aria-label={`${titleFor(node)}${aimed?', recording destination':', make this the recording destination'}`} disabled={!!active||opening} onClick={()=>aim(node.id)}>
       <span className="vs-aim" aria-hidden="true"><Mic size={14}/></span><span className="vs-section-title">{titleFor(node)}</span>{state&&<span className="vs-chip" data-tone={state.tone}>{state.label}</span>}
      </button>
      {(()=>{const text=references[node.id]??node.text,paragraphs=readingParagraphs(text),focus=(active?captureFocus.current&&recordingTarget.current===node.id?captureFocus.current:undefined:paragraphAim?.sectionId===node.id?paragraphAim:undefined);
       if(paragraphs.length<2)return <div className="vs-section-text">{text}</div>;
       return <div className="vs-section-text vs-section-text--paragraphs">{paragraphs.map((p,i)=>{const on=!!focus&&focus.start===p.start&&focus.text===p.text;return <p key={p.start} className="vs-para" data-aimed={on||undefined} role="button" tabIndex={active||opening?-1:0} aria-pressed={on} aria-disabled={!!active||opening||undefined} aria-label={`Paragraph ${i+1}${on?', recording destination':', record over only this paragraph'}`} onClick={()=>{if(!active&&!opening)aimParagraph(node.id,p);}} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!active&&!opening){e.preventDefault();aimParagraph(node.id,p);}}}>{on&&<span className="vs-para-tag">{active?'Recording over this paragraph':'Only this paragraph will change'}</span>}{p.text}</p>;})}</div>;})()}
      {(state?.tone==='ready'||state?.tone==='check')&&<button className="vs-link" onClick={()=>reviewAt(node.id)}>Review your words<ChevronRight size={15}/></button>}
      {state?.tone==='human'&&<button className="vs-link vs-link--quiet" onClick={()=>void openApplied(node.id).catch(report)}>See what changed<ChevronRight size={15}/></button>}
     </section>;})}
     {!!draft?.unassigned.length&&<button className="vs-link vs-link--block" onClick={()=>openView('unplaced')}>{plural(draft.unassigned.length,'passage')} not placed yet<ChevronRight size={15}/></button>}
    </div>)}

   {view==='review'&&<div className="vs-stage vs-review">
    {section&&result?<>
     <div className="vs-review-head" data-section-id={section.id}>
      <small>{section.path.slice(0,-1).join(' · ')||'Card'}{section.id.includes('/selection-')?' · selected passage':''}</small>
      <TitleField key={`${draft!.id}/${section.id}`} label="Section title" value={titleFor(section)} disabled={integrating} save={text=>saveTitle(section.id,text)}/>
     </div>
     {result.applied?<section className="vs-applied" aria-label="Now in your reading" data-has-next={!!nextRecording||undefined}>
      <p className="vs-applied-state"><Check size={16}/>{result.editIntent==='add'?'Your words were added to the reading.':authorship?.sections[section.id]==='human'?'Your words are in the reading.':'Your changes are in the reading.'}</p>
      {nextRecording&&<section className="vs-next-recording" aria-label="Next section to record">
       <small>Record next</small><h3>{pathFor(nextRecording)}</h3>
       <p>{references[nextRecording.id]??nextRecording.text}</p>
       <button className="vs-btn vs-btn--primary" disabled={opening||stopping} onClick={()=>{setParagraphAim(null);captureFocus.current=undefined;setTargetId(nextRecording.id);void record(null,nextRecording.id);}}>{opening?'Opening microphone…':'Record this section'}</button>
      </section>}
      <div className="vs-just-applied"><h3>Just applied</h3>{displayOrigins.map((part,i)=><span key={i} className={part.origin==='human'?'vs-applied-text':'vs-applied-kept'}>{part.text}</span>)}</div>
     </section>:<>
      <SectionPassageReview checks={checks.map(c=>({key:c.key,quote:c.quote,message:c.message,done:c.done,canHear:!!c.issue?.captureId&&c.issue.startMs!==undefined}))} onHearCheck={key=>{const c=checks.find(c=>c.key===key);if(c?.issue?.captureId&&c.issue.startMs!==undefined)hear(c.issue);else void listen();}} onConfirmCheck={key=>setResolved(r=>({...r,[key]:true}))} onReopenCheck={key=>setResolved(r=>{const n={...r};delete n[key];return n;})} original={sectionComparisonOriginal(result,references[section.id]??section.text)} text={result.text} comparison={result.comparison} choices={result.rowChoices} onChoose={(key,choice)=>choosePassage(section.id,key,choice)} intent={result.editIntent} sessionKey={`${draft!.id}/${section.id}`} disabled={integrating} replay={replay} activeWord={activeWord} caret={caret} cleanupCount={result.changes.length} onCleanup={()=>setView('cleanup')} replayDisabled={integrating||!!active} onSelection={(from,to,text,baseText)=>{if(to>from&&text.trim())setPhrase({sectionId:section.id,from,to,text,baseText});else setPhrase(null);}} onReplay={(from,to)=>void listen(from,to)} onSeek={word=>{if(word.captureId)void playCapture(word.captureId,word.startMs).catch(report);}} onEdit={(i,replacement)=>edit(section.id,sectionComparisonOriginal(result,references[section.id]??section.text),i,replacement)}/>
     </>}
    </>:<div className="vs-empty"><p>{queued.length||processing?'Your recording is saved. Preparing your words…':savedCaptures.length?'Your audio is saved. The transcript is not ready yet.':'Nothing to review yet. Record a section, then come back here.'}</p><button className="vs-btn" onClick={()=>openView('work')}>Back to the card</button></div>}
    {!!draft?.unassigned.length&&<button className="vs-note" onClick={()=>openView('unplaced')}><span>{plural(draft.unassigned.length,'passage')} from your recording {draft.unassigned.length===1?'was':'were'} not placed.</span><strong>Place {draft.unassigned.length===1?'it':'them'}<ChevronRight size={15}/></strong></button>}
    {!!linkedDrafts.length&&<nav aria-label="Connected card recordings">{linkedDrafts.map(value=><button key={value.id} className="vs-note" onClick={()=>{onClose();onNavigateCard?.(value.cardNumber,value.id);}}><span>You also spoke about Code {value.cardNumber}.</span><strong>Review {plural(value.results.length,'passage')}<ChevronRight size={15}/></strong></button>)}</nav>}
   </div>}

   {view==='sections'&&<div className="vs-stage vs-screen">{placing!==null&&draft?.unassigned[placing]&&<blockquote className="vs-quote">{draft.unassigned[placing].text}</blockquote>}{index(node=>{if(placing!==null)void place(placing,node.id);else if(pickerReturn.current==='review'&&results.some(r=>r.sectionId===node.id)){reviewAt(node.id);}else{setView('work');aim(node.id,true);}},'screen')}</div>}

   {view==='unplaced'&&draft&&<section className="vs-stage vs-screen" aria-label="Unplaced words">
    <p className="vs-lead">These words are saved, but they did not clearly belong to a section. Choose where each one goes. You will compare it before anything changes.</p>
    {draft.unassigned.map((u,i)=><section className="vs-unplaced" key={`${i}/${u.text}`}><blockquote className="vs-quote">{u.text}</blockquote>{u.reason&&<small>{u.reason}</small>}<button className="vs-btn" onClick={()=>{setPlacing(i);pickerReturn.current='unplaced';setView('sections');}}>Choose a section<ChevronRight size={15}/></button></section>)}
    {!draft.unassigned.length&&<p className="vs-lead">Everything is placed.</p>}
   </section>}

   {view==='cleanup'&&result&&<section className="vs-stage vs-screen" aria-label="Speech cleanup review">
    <p className="vs-lead">Stumbles and repeated starts were tidied in {titleFor(section!)}. Your recording and every original word are kept.</p>
    {result.changes.map((change,i)=><section className="vs-row" key={i}><div><p><del>{change.before}</del>{change.after&&<> → {change.after}</>}</p><small>{change.reason}</small></div><button className="vs-btn" disabled={integrating||!!result.applied} onClick={()=>void patch(s=>({...s,results:s.results.map(r=>r.sectionId===section?.id?restoreDocumentedCleanup(r,i):r)})).catch(report)}>Keep what I said</button></section>)}
    <h3>What you said</h3><pre className="vs-pre">{result.evidenceQuotes.join('\n\n')}</pre>
   </section>}

   <section className="vs-stage vs-screen" aria-label="Recording settings" hidden={view!=='settings'}>
    <h3>While recording</h3>
    <label className="vs-switch"><span><strong>Keep recording after Send &amp; next</strong><small>Sends this section and keeps the microphone on for the next one.</small></span><input type="checkbox" role="switch" checked={continuous} onChange={e=>{setContinuous(e.target.checked);handle.current?.setContinuous(e.target.checked);localStorage.setItem('oracle.voice.continuous',String(e.target.checked));}}/></label>
    <label className="vs-switch"><span><strong>Move when I say a section’s name</strong><small>{routingStatus==='unsupported'?'Not available on this device. The Next button always works.':'Uses your browser’s speech service where available. The Next button always works.'}</small></span><input type="checkbox" role="switch" checked={voiceCommands} disabled={!!active} onChange={e=>{setVoiceCommands(e.target.checked);localStorage.setItem('oracle.voice.commands',String(e.target.checked));}}/></label>
    <fieldset className="vs-choice"><legend><strong>When a section already has my words</strong></legend>{([['auto','Decide from what I say'],['replace','Replace them'],['add','Add after them']] as const).map(([value,label])=><label key={value}><input type="radio" name="vs-intent" value={value} checked={intent===value||intent==='revise'&&value==='auto'} disabled={!!active} onChange={()=>setIntent(value)}/>{label}</label>)}</fieldset>
    {readyClean.length>1&&<><h3>Review</h3><div className="vs-row"><div><p>{plural(readyClean.length,'section')} checked and ready</p><small>Each is saved to your reading with its recording, and each can be undone.</small></div><button className="vs-btn" disabled={integrating} onClick={()=>void integrate(true)}>Use all {readyClean.length}</button></div></>}
    <h3>Files</h3>
    <button className="vs-row vs-row--nav" onClick={()=>openView('audio')}><div><p>Recordings and transcript</p><small>Listen, add an audio file, discard or restore a take</small></div><ChevronRight size={18}/></button>
    <button className="vs-row vs-row--nav" onClick={()=>openView('sessions')}><div><p>Sessions</p><small>Earlier sessions for this card and the Mac connection</small></div><ChevronRight size={18}/></button>
   <div className="vs-sync">{draft&&<VoiceSyncTools draft={draft} savedAudio={savedAudio} resume={{sectionId:focusId,mode:view,positionMs:(player.current?.currentTime??0)*1000}} onRestored={(value,saved,resume)=>{if(value.cardNumber!==source.cardNumber){onClose();onNavigateCard?.(value.cardNumber,value.id);return;}accept(value);setSavedAudio(saved);setFocusId(resume?.sectionId??value.startSectionId);if(resume?.captureId)resumePlayback.current={captureId:resume.captureId,positionMs:resume.positionMs};setView(resume?.mode==='work'?'work':'review');}}/>}</div>
   </section>

   {view==='audio'&&<section className="vs-stage vs-screen" aria-label="Audio and transcript">
    {savedAudio&&<CaptureShelf expanded session={{...savedAudio.session,captures:savedAudio.session.captures.filter(c=>!discarded.has(c.id))}} onDiscard={discard} disabled={!!active||processing||opening||integrating} onListen={id=>{clipBounds.current=null;setReplay(null);void playCapture(id).catch(report);}} onTranscribe={async(id)=>{if(draft)accept(await queueSectionTake(draft.id,id,takes.find(t=>t.captureId===id)?.startSectionId??targetId,services));}} onImport={addAudio}/>}
    {takes.filter(t=>t.state==='failed'||t.state==='discarded').map(t=><section className="vs-row" key={t.id}><div><p>{nodes.find(n=>n.id===t.startSectionId)?.title}</p><small>{t.state==='discarded'?'Discarded recording':t.error}</small></div><button className="vs-btn" onClick={()=>void (t.state==='discarded'?restoreSectionTake(draft!.id,t.captureId,services):queueSectionTake(draft!.id,t.captureId,t.startSectionId,services,t.markers)).then(accept).catch(report)}>{t.state==='discarded'?'Restore':'Try again'}</button></section>)}
    {draft?.rawTranscript&&<><h3>Original transcript</h3><pre className="vs-pre">{draft.rawTranscript}</pre></>}
    {!takes.length&&draft?.captureSessionId&&!active&&!!savedAudio?.session.captures.length&&<button className="vs-btn" disabled={processing||draft.results.some(r=>r.applied)} onClick={()=>void prepare(draft.id)}>Prepare sections again</button>}
   </section>}

   {view==='sessions'&&<section className="vs-stage vs-screen" aria-label="Voice setup">
    <button className="vs-btn" disabled={!!active||processing} onClick={()=>void make().catch(report)}>Start a new session</button>
    {history.map(s=><button className="vs-row vs-row--nav" disabled={!!active||processing||integrating} key={s.id} aria-current={s.id===draft?.id?'true':undefined} onClick={()=>void(async()=>{await flush();const latest=await store.get(s.id);if(!latest)return;accept(latest);setFocusId(latest.results[0]?.sectionId??latest.startSectionId);setTargetId(latest.startSectionId);setView('work');await loadAudio(latest);})().catch(report)}><div><p>{new Date(s.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</p><small>{plural(s.results.length,'section')} · {s.results.filter(r=>r.applied).length} used{s.id===draft?.id?' · open now':''}</small></div><ChevronRight size={18}/></button>)}
    <button className="vs-row vs-row--nav" disabled={!!active} onClick={onEarlier}><div><p>Earlier recordings and writing</p><small>The previous recorder, kept for older work</small></div><ChevronRight size={18}/></button>
    <BridgeConnection expanded/>
   </section>}
  </div>

  {(notice||error||draft?.error)&&<div className="vs-toast" role={error||draft?.error?'alert':'status'} data-tone={error||draft?.error?'alert':undefined}><span>{error||draft?.error||notice}</span><button className="vs-icon" aria-label="Dismiss" onClick={()=>{setError('');setNotice('');}}><X size={16}/></button></div>}

  {view==='work'&&<footer className="vs-dock" data-recording={!!active||undefined}>
   {active?<>
    <div className="vs-recording-status"><span className="vs-dot" data-paused={monitor.paused||undefined}/><span>{stopping?'Saving recording…':monitor.paused?'Paused':'Recording'} · {time(monitor.elapsed)}</span><span className="vs-level" aria-hidden="true" style={{'--level':monitor.paused?0:monitor.level??0} as React.CSSProperties}/></div>
    <div className="vs-dock-target" aria-live="polite"><strong>{pathFor(recordingNode)}</strong><span>{phraseCapture.current?'Selected words':scopeFor(recordingNode,captureFocus.current)}</span></div>
    {upcoming&&<p className="vs-recording-next">{continuous?'Next, recording continues':'Next'} · {pathFor(upcoming)}</p>}
    <div className="vs-recording-actions">
     <button className="vs-btn" disabled={stopping} onClick={togglePause}>{monitor.paused?'Resume':'Pause'}</button>
     <button className={`vs-btn${upcoming?'':' vs-btn--primary'}`} disabled={stopping} onClick={()=>stop('review')}>Stop &amp; review</button>
     {upcoming&&<button className="vs-btn vs-btn--primary" disabled={stopping} aria-label={`Send this recording and ${continuous?'keep recording in':'go to'} ${pathFor(upcoming)}`} onClick={()=>stop('next')}>Send &amp; next</button>}
    </div>
   </>:<>
    <div className="vs-dock-target"><small>Record over{queued.length?<span> · {queued.length} processing</span>:null}</small><strong>{target?titleFor(target):'Opening…'}<span className="vs-span">{target?spanLabel(target,paragraphAim?.sectionId===target.id?paragraphAim:undefined):''}</span></strong></div>
    {waiting>0&&<button className="vs-btn" onClick={()=>{reviewArrival.current=true;explicitChoice.current=false;openView(results.some(r=>!r.applied)?'review':'unplaced');}}>Review {waiting}</button>}
    <button className="vs-record" disabled={opening||stopping||!target} onClick={()=>void record(null,target?.id)}>{opening?'Opening microphone…':'Record'}</button>
   </>}
  </footer>}

  {view==='review'&&section&&result&&<footer className="vs-dock vs-dock--review">
   {audioUrl?<>
    <button className="vs-icon vs-icon--ring" aria-label={playing?'Pause playback':'Play'} onClick={()=>{if(playing)player.current?.pause();else void player.current?.play().catch(report);}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
    <div className="vs-progress"><span style={{'--at':clipBounds.current?Math.min(1,Math.max(0,(playhead-clipBounds.current.startMs)/Math.max(1,clipBounds.current.endMs-clipBounds.current.startMs))):player.current?.duration?Math.min(1,playhead/1000/player.current.duration):0} as React.CSSProperties}/><small>{time(clipBounds.current?Math.max(0,playhead-clipBounds.current.startMs):playhead)}</small></div>
    {clipBounds.current&&<button className="vs-icon" aria-label="Loop this passage" aria-pressed={loop} onClick={()=>{const next=!loop;setLoop(next);loopCleanup.current?.();if(player.current&&clipBounds.current)loopCleanup.current=loopVoicePhrase(player.current,clipBounds.current,next);}}><Repeat size={18}/></button>}
    <button className="vs-btn" onClick={stopListening}>{replay?'Back to editing':'Done'}</button>
   </>:result.applied?<>
    <button className="vs-btn vs-btn--quiet" disabled={integrating} onClick={()=>void undoIntegratedSection(draft!.id,section.id,services).then(value=>{accept(value);setNotice('Undone. The earlier words are back in your reading.');}).catch(report)}><Undo2 size={16}/>Undo</button>
    <button className="vs-btn vs-btn--quiet" onClick={readUpdated}><BookOpen size={16}/>See in card</button>
    {nextReview?<button className={`vs-btn${nextRecording?' vs-btn--quiet':' vs-btn--primary'}`} onClick={()=>void choose(nextReview.id).catch(report)}>Next to review</button>:!nextRecording?<button className="vs-btn vs-btn--primary" onClick={()=>void close()}>Finish</button>:queued.length?<span className="vs-processing-count">{queued.length} processing</span>:null}
   </>:<>
    <button className="vs-btn vs-btn--quiet" disabled={integrating||!!active||!draft?.captureSessionId} onClick={()=>void listen()}><Play size={16}/>Listen</button>
    <button className="vs-btn vs-btn--quiet" disabled={opening||integrating||stopping} onClick={()=>void record(phrase&&phrase.sectionId===section.id?phrase:null,section.id)}><Mic size={16}/>{phrase&&phrase.sectionId===section.id?'Re-record selection':'Re-record'}</button>
    <button className="vs-btn vs-btn--primary" data-action="apply" disabled={!result.text.trim()||integrating||open>0||applyLabel.empty} onClick={()=>void applySection()}>{integrating?'Saving words…':open?`Check ${plural(open,generalCheck?'item':'word')} first`:!result.text.trim()?'No words to use':applyLabel.text}</button>
   </>}
  </footer>}

  {audioUrl&&<audio ref={player} hidden onLoadedMetadata={()=>{if(player.current){player.current.currentTime=seekAt.current;setPlayhead(seekAt.current*1000);loopCleanup.current?.();if(clipBounds.current)loopCleanup.current=loopVoicePhrase(player.current,clipBounds.current,loop);void player.current.play().catch(report);}}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onTimeUpdate={()=>{if(!player.current)return;setPlayhead(player.current.currentTime*1000);if(replay)setActiveWord(activeReplayWord(replay.words,replay.captureId,player.current.currentTime*1000));}} onEnded={()=>{setPlaying(false);setActiveWord(-1);}} src={audioUrl} aria-label="Original recording"/>}
 </section>;

 async function place(i:number,sectionId:string){try{await patch(s=>{const u=s.unassigned[i];if(!u)return s;const existing=s.results.find(r=>r.sectionId===sectionId),takeId=(u as {takeId?:string}).takeId;return {...s,results:existing?s.results.map(r=>r.sectionId===sectionId?{...r,evidenceQuotes:[...r.evidenceQuotes,u.text],takeIds:[...new Set([...(r.takeIds??[]),...(takeId?[takeId]:[])])],text:`${r.text}\n\n${u.text}`,comparison:undefined,checked:false,applied:false,warnings:[...r.warnings,'Check these words you placed by hand.']}:r):[...s.results,{sectionId,takeIds:takeId?[takeId]:undefined,text:u.text,evidenceQuotes:[u.text],changes:[],warnings:['Check these words you placed by hand.'],checked:false}],unassigned:s.unassigned.filter((_,index)=>index!==i)};});setPlacing(null);reviewAt(sectionId);}catch(e){report(e);}}
}

function TitleField({value,label,disabled,save}:{value:string;label:string;disabled?:boolean;save:(text:string)=>Promise<void>}){
 const [text,setText]=useState(value),[error,setError]=useState('');const latest=useRef(value),dirty=useRef(false),callback=useRef(save);callback.current=save;
 useEffect(()=>{if(!dirty.current){setText(value);latest.current=value;}},[value]);
 const commit=()=>{if(!dirty.current)return;const next=latest.current.trim();if(!next){setError('Enter a title.');return;}dirty.current=false;void callback.current(next).then(()=>setError('')).catch(()=>{dirty.current=true;setError('Title not saved. Retry.');});};
 useEffect(()=>()=>{if(dirty.current&&latest.current.trim())void callback.current(latest.current.trim()).catch(()=>undefined);},[]);
 return <><input className="vs-title-input" aria-label={label} title="Edit the section title" maxLength={240} value={text} disabled={disabled} onChange={e=>{dirty.current=true;latest.current=e.target.value;setText(e.target.value);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/>{error&&<button className="vs-btn vs-btn--quiet" onClick={commit}>{error}</button>}</>;
}
