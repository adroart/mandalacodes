import React from 'react';
import {ChevronRight,Pause,Play,Mic,Repeat} from 'lucide-react';
import type {CardSection} from '../../../../lib/oracle/authoring/cardSections';
import {sectionComparisonOriginal,type SectionDraftResult} from '../../../../lib/oracle/authoring/sectionDrafts';
import type {TakeResult} from '../../../../src/mobile/authoring/sectionTakes';
import {activeReplayWord} from '../../../../lib/oracle/authoring/wordReplay';
import {loopVoicePhrase} from '../../../../src/mobile/authoring/voiceTargets';
import SectionPassageReview from '../SectionPassageReview';
import TitleField from './TitleField';
import {AppliedPanel,appliedActions,type AppliedPanelProps,type AppliedActionsProps} from './AppliedScreen';
import {plural,time} from './format';
import type {VoiceStudio} from './types';

/** The other wording as it would sit in his text: edge punctuation goes, as it does from the quoted word. */
const spoken=(words:string)=>words.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');

export type ReviewStageProps=Omit<AppliedPanelProps,'section'|'result'>&Pick<VoiceStudio,
 'section'|'result'|'draft'|'titleFor'|'integrating'|'saveTitle'|'checks'|'checkAudio'|'listen'|'setResolved'|'choosePassage'|
 'replay'|'activeWord'|'caret'|'setView'|'active'|'setPhrase'|'playCapture'|'report'|'edit'|'queued'|'processing'|
 'savedCaptures'|'openView'|'linkedDrafts'|'onClose'|'onNavigateCard'
>;

/**
 * The review screen's stage: the section's path and title, then either the applied panel or the
 * comparison host (`SectionPassageReview`), then the unplaced-words and connected-card notes.
 */
export function ReviewStage(props:ReviewStageProps){
 const {section,result,draft,titleFor,integrating,saveTitle,checks,checkAudio,listen,setResolved,choosePassage,references,replay,activeWord,caret,setView,active,setPhrase,playCapture,report,edit,queued,processing,savedCaptures,openView,linkedDrafts,onClose,onNavigateCard}=props;
 return <div className="vs-stage vs-review">
  {section&&result?<>
   <div className="vs-review-head" data-section-id={section.id}>
    <small>{section.path.slice(0,-1).join(' · ')||'Card'}{section.id.includes('/selection-')?' · selected passage':''}</small>
    <TitleField key={`${draft!.id}/${section.id}`} label="Section title" value={titleFor(section)} disabled={integrating} save={text=>saveTitle(section.id,text)}/>
   </div>
   {result.applied?<AppliedPanel {...props} section={section} result={result}/>:<>
    {(result as TakeResult).doubtsAvailable===false&&<p className="vs-review-unchecked" role="note">This recording was not double-checked. Listen once before you use it.</p>}
    <SectionPassageReview
     checks={checks.map(c=>({key:c.key,quote:c.quote,message:c.message,done:c.done,...checkAudio.stateFor(c),...(c.quote&&typeof c.issue?.heardAlso==='string'&&spoken(c.issue.heardAlso).toLowerCase()!==c.quote.toLowerCase()?{heardAlso:spoken(c.issue.heardAlso)}:{})}))}
     onHearCheck={key=>{const c=checks.find(c=>c.key===key);if(c)void checkAudio.hearCheck(c);}}
     onStopCheck={checkAudio.stopCheck}
     onConfirmCheck={key=>setResolved(r=>({...r,[key]:true}))}
     onReopenCheck={key=>setResolved(r=>{const n={...r};delete n[key];return n;})}
     original={sectionComparisonOriginal(result,references[section.id]??section.text)}
     text={result.text}
     comparison={result.comparison}
     choices={result.rowChoices}
     onChoose={(key,choice)=>choosePassage(section.id,key,choice)}
     intent={result.editIntent}
     sessionKey={`${draft!.id}/${section.id}`}
     disabled={integrating}
     replay={replay}
     activeWord={activeWord}
     caret={caret}
     cleanupCount={result.changes.length}
     onCleanup={()=>setView('cleanup')}
     replayDisabled={integrating||!!active}
     onSelection={(from,to,text,baseText)=>{if(to>from&&text.trim())setPhrase({sectionId:section.id,from,to,text,baseText});else setPhrase(null);}}
     onReplay={(from,to)=>void listen(from,to)}
     onSeek={word=>{if(word.captureId)void playCapture(word.captureId,word.startMs).catch(report);}}
     onEdit={(i,replacement)=>edit(section.id,sectionComparisonOriginal(result,references[section.id]??section.text),i,replacement)}
    />
   </>}
  </>:<div className="vs-empty">
   <p>{queued.length||processing?'Your recording is saved. Preparing your words…':savedCaptures.length?'Your audio is saved. The transcript is not ready yet.':'Nothing to review yet. Record a section, then come back here.'}</p>
   <button className="vs-btn" onClick={()=>openView('work')}>Back to the card</button>
  </div>}
  {!!draft?.unassigned.length&&<button className="vs-note" onClick={()=>openView('unplaced')}>
   <span>{plural(draft.unassigned.length,'passage')} from your recording {draft.unassigned.length===1?'was':'were'} not placed.</span>
   <strong>Place {draft.unassigned.length===1?'it':'them'}<ChevronRight size={15}/></strong>
  </button>}
  {!!linkedDrafts.length&&<nav aria-label="Connected card recordings">
   {linkedDrafts.map(value=><button key={value.id} className="vs-note" onClick={()=>{onClose();onNavigateCard?.(value.cardNumber,value.id);}}>
    <span>You also spoke about Code {value.cardNumber}.</span>
    <strong>Review {plural(value.results.length,'passage')}<ChevronRight size={15}/></strong>
   </button>)}
  </nav>}
 </div>;
}

export type ReviewDockProps=Omit<AppliedActionsProps,'section'>&Pick<VoiceStudio,
 'audioUrl'|'playing'|'player'|'clipBounds'|'playhead'|'loop'|'setLoop'|'loopCleanup'|'stopListening'|'replay'|
 'active'|'listen'|'opening'|'stopping'|'record'|'phrase'|'open'|'applyLabel'|'generalCheck'|'applySection'
>&{section:CardSection;result:SectionDraftResult};

/**
 * The review screen's dock: playback controls while a take plays, the applied actions once a section
 * is applied, otherwise Listen, Re-record and the apply button.
 */
export function ReviewDock(props:ReviewDockProps){
 const {section,result,audioUrl,playing,player,report,clipBounds,playhead,loop,setLoop,loopCleanup,stopListening,replay,integrating,active,draft,listen,opening,stopping,record,phrase,open,applyLabel,generalCheck,applySection}=props;
 return <footer className="vs-dock vs-dock--review">
  {audioUrl?<>
   <button className="vs-icon vs-icon--ring" aria-label={playing?'Pause playback':'Play'} onClick={()=>{if(playing)player.current?.pause();else void player.current?.play().catch(report);}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
   <div className="vs-progress">
    <span style={{'--at':clipBounds.current?Math.min(1,Math.max(0,(playhead-clipBounds.current.startMs)/Math.max(1,clipBounds.current.endMs-clipBounds.current.startMs))):player.current?.duration?Math.min(1,playhead/1000/player.current.duration):0} as React.CSSProperties}/>
    <small>{time(clipBounds.current?Math.max(0,playhead-clipBounds.current.startMs):playhead)}</small>
   </div>
   {clipBounds.current&&<button className="vs-icon" aria-label="Loop this passage" aria-pressed={loop} onClick={()=>{const next=!loop;setLoop(next);loopCleanup.current?.();if(player.current&&clipBounds.current)loopCleanup.current=loopVoicePhrase(player.current,clipBounds.current,next);}}><Repeat size={18}/></button>}
   <button className="vs-btn" onClick={stopListening}>{replay?'Back to editing':'Done'}</button>
  </>:result.applied?appliedActions(props):<>
   <button className="vs-btn vs-btn--quiet" disabled={integrating||!!active||!draft?.captureSessionId} onClick={()=>void listen()}><Play size={16}/>Listen</button>
   <button className="vs-btn vs-btn--quiet" disabled={opening||integrating||stopping} onClick={()=>void record(phrase&&phrase.sectionId===section.id?phrase:null,section.id)}><Mic size={16}/>{phrase&&phrase.sectionId===section.id?'Re-record selection':'Re-record'}</button>
   <button className="vs-btn vs-btn--primary" data-action="apply" disabled={!result.text.trim()||integrating||open>0||applyLabel.empty} onClick={()=>void applySection()}>{integrating?'Saving words…':open?`Check ${plural(open,generalCheck?'item':'word')} first`:!result.text.trim()?'No words to use':applyLabel.text}</button>
  </>}
 </footer>;
}

export type PlaybackAudioProps=Pick<VoiceStudio,
 'audioUrl'|'player'|'seekAt'|'setPlayhead'|'loopCleanup'|'clipBounds'|'loop'|'report'|'setPlaying'|'replay'|'setActiveWord'
>&Partial<Pick<VoiceStudio,'checkAudio'>>;

/** The hidden audio element every Listen, Play and Hear goes through, on the review and recordings screens alike. */
export function PlaybackAudio({audioUrl,player,seekAt,setPlayhead,loopCleanup,clipBounds,loop,report,setPlaying,replay,setActiveWord,checkAudio}:PlaybackAudioProps){
 // A word check's clip that cannot play says so on its own row; any other playback keeps the usual notice.
 const failed=(e:unknown)=>{if(!(e instanceof Error&&e.name==='AbortError')&&checkAudio?.playbackFailed(audioUrl))return;report(e);};
 return <audio
  ref={player}
  hidden
  onError={()=>{checkAudio?.playbackFailed(audioUrl);}}
  onLoadedMetadata={()=>{if(player.current){player.current.currentTime=seekAt.current;setPlayhead(seekAt.current*1000);loopCleanup.current?.();if(clipBounds.current)loopCleanup.current=loopVoicePhrase(player.current,clipBounds.current,loop);void player.current.play().catch(failed);}}}
  onPlay={()=>setPlaying(true)}
  onPause={()=>setPlaying(false)}
  onTimeUpdate={()=>{if(!player.current)return;setPlayhead(player.current.currentTime*1000);if(replay)setActiveWord(activeReplayWord(replay.words,replay.captureId,player.current.currentTime*1000));}}
  onEnded={()=>{setPlaying(false);setActiveWord(-1);}}
  src={audioUrl}
  aria-label="Original recording"
 />;
}
