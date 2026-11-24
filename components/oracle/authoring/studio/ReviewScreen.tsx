import React from 'react';
import {ChevronRight,Pause,Play,Repeat} from 'lucide-react';
import type {CardSection} from '../../../../lib/oracle/authoring/cardSections';
import {sectionComparisonOriginal,type SectionDraftResult} from '../../../../lib/oracle/authoring/sectionDrafts';
import type {TakeResult} from '../../../../src/mobile/authoring/sectionTakes';
import {activeReplayWord} from '../../../../lib/oracle/authoring/wordReplay';
import {loopVoicePhrase} from '../../../../src/mobile/authoring/voiceTargets';
import SectionPassageReview from '../SectionPassageReview';
import FullTakeReview from './FullTakeReview';
import TitleField from './TitleField';
import {AppliedPanel,appliedActions,type AppliedPanelProps,type AppliedActionsProps} from './AppliedScreen';
import {plural,time} from './format';
import type {VoiceStudio} from './types';

/** The other wording as it would sit in his text: edge punctuation goes, as it does from the quoted word. */
const spoken=(words:string)=>words.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');

export type ReviewStageProps=Omit<AppliedPanelProps,'section'|'result'>&Pick<VoiceStudio,
 'section'|'result'|'draft'|'titleFor'|'integrating'|'saveTitle'|'checks'|'checkAudio'|'listen'|'setResolved'|'choosePassage'|
 'replay'|'activeWord'|'caret'|'setView'|'active'|'setPhrase'|'playCapture'|'report'|'edit'|'queued'|'processing'|
 'savedCaptures'|'openView'|'linkedDrafts'|'onClose'|'onNavigateCard'|'pathFor'|'scopeFor'|'applyLabel'|'processingStage'|'pendingPassage'|'takes'|'switchReviewOperation'
 |'historyApplyReason'|'editFullTake'|'audioUrl'
>&{reviewKey:string;editing:boolean;onEditing:(editing:boolean)=>void};

/**
 * The review screen's stage: the section's path and title, then either the applied panel or the
 * comparison host (`SectionPassageReview`), then the unplaced-words and connected-card notes.
 */
export function ReviewStage(props:ReviewStageProps){
 const {section,result,draft,titleFor,integrating,saveTitle,checks,checkAudio,listen,setResolved,choosePassage,references,replay,activeWord,caret,setView,active,setPhrase,playCapture,report,edit,queued,processing,savedCaptures,openView,linkedDrafts,onClose,onNavigateCard,pathFor,scopeFor,applyLabel,historyApplyReason,processingStage,pendingPassage,takes,switchReviewOperation,editing,reviewKey,onEditing,editFullTake,audioUrl}=props;
 if(pendingPassage){const failed=takes.find(t=>t.captureId===pendingPassage.captureId&&t.state==='failed');return <div className="vs-stage vs-review vs-review-waiting" role="status">
  <p>{failed?'This recording could not be prepared yet. Its audio is saved. Retry it above.':processingStage||'Preparing review…'} Your existing reviews are still saved.</p>
 </div>;}
 const passage=result&&!result.applied?result.passageEdit:undefined;
 const wordChecks=checks.map(c=>({key:c.key,quote:c.quote,message:c.message,done:c.done,...checkAudio.stateFor(c),...(c.quote&&typeof c.issue?.heardAlso==='string'&&spoken(c.issue.heardAlso).toLowerCase()!==c.quote.toLowerCase()?{heardAlso:spoken(c.issue.heardAlso)}:{})}));
 const checkActions={
  onHearCheck:(key:string)=>{const c=checks.find(c=>c.key===key);if(c)void checkAudio.hearCheck(c);},
  onStopCheck:checkAudio.stopCheck,
  onConfirmCheck:(key:string)=>setResolved(r=>({...r,[key]:true})),
  onReopenCheck:(key:string)=>setResolved(r=>{const n={...r};delete n[key];return n;})
 };
 const operation=passage&&result&&section?<div className="vs-review-operation" role="group" aria-label="Choose what your saved words will do">
     <button type="button" className="btn btn-chip btn-sm" aria-pressed={result.passageEdit.operation==='add'} disabled={integrating||processing||draft?.state==='recording'||!!active||queued.some(t=>t.startSectionId===section.id)} onClick={()=>void switchReviewOperation(section.id,'add')}>Add after</button>
     <button type="button" className="btn btn-chip btn-sm" aria-pressed={result.passageEdit.operation==='replace'} disabled={integrating||processing||draft?.state==='recording'||!!active||queued.some(t=>t.startSectionId===section.id)} onClick={()=>void switchReviewOperation(section.id,'replace')}>Replace</button>
 </div>:null;
 const tools=<>
  <button type="button" className="btn btn-quiet btn-sm" disabled={integrating||!!active} onClick={()=>openView('history')}>History</button>
  {result&&!result.applied&&<button type="button" className="btn btn-quiet btn-sm" disabled={integrating||processing||!!active||queued.some(t=>t.startSectionId===section?.id)} onClick={()=>openView('range')}>Replace selected words</button>}
 </>;
 return <div className="vs-stage vs-review">
  {section&&result?<>
   {!result.passageEdit&&<div className="vs-review-head" data-section-id={section.id}>
    {(section.path.length>1||section.id.includes('/selection-'))&&<small>{section.path.slice(0,-1).join(' · ')}{section.id.includes('/selection-')?' · selected passage':''}</small>}
    <TitleField key={`${draft!.id}/${section.id}`} label="Section title" value={titleFor(section)} disabled={integrating} save={text=>saveTitle(section.id,text)}/>
   </div>}
   {!result.applied&&!result.passageEdit&&<div className="vs-review-plan" role="note">
    <strong>{applyLabel.text}</strong>
    <span>Card {section.cardNumber} · {pathFor(section)} · {result.comparison?'reviewed passages':'whole section'}. Not applied yet. Apply changes your private reading.</span>
   </div>}
   {!editing&&historyApplyReason&&<p className="vs-review-status" role="note">{historyApplyReason}</p>}
   {result.applied?<AppliedPanel {...props} section={section} result={result}/>:<>
    {!editing&&(result as TakeResult).doubtsAvailable===false&&<p className="vs-review-unchecked" role="note">{passage?"Listen to check this transcript.":"This recording was not double-checked. Listen once before you use it."}</p>}
    {(()=>{
     const select=(from:number,to:number,text:string,baseText:string)=>setPhrase(to>from&&text.trim()?{sectionId:section.id,from,to,text,baseText}:null);
     const comparison=<SectionPassageReview
     checks={passage?[]:wordChecks}
     {...checkActions}
     readOnlyWords={!!passage}
     original={result.passageEdit?.focus.text??sectionComparisonOriginal(result,references[section.id]??section.text)}
     explicitPassage={result.passageEdit?.operation}
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
     onSelection={select}
     onReplay={(from,to)=>void listen(from,to)}
     onSeek={word=>{if(word.captureId)void playCapture(word.captureId,word.startMs).catch(report);}}
     onEdit={(i,replacement)=>edit(section.id,result.passageEdit?.operation==='replace'&&result.comparison?result.passageEdit.focus.text:sectionComparisonOriginal(result,references[section.id]??section.text),i,replacement)}
     />;
     return passage?<FullTakeReview key={reviewKey} result={result} checks={wordChecks} comparison={comparison} operation={operation} tools={tools}
      occupied={!!audioUrl} replay={replay} activeWord={activeWord} disabled={integrating} {...checkActions}
      onSeek={word=>{if(word.captureId)void playCapture(word.captureId,word.startMs).catch(report);}}
      onEditing={onEditing} onSelection={select} save={(before,text,range)=>editFullTake(section.id,before,text,range)}/>:comparison;
    })()}
   </>}
  </>:<div className="vs-empty">
   <p>{queued.length||processing?`Your recording is saved. ${processingStage||'Preparing review…'}`:savedCaptures.length?'Your audio is saved. The transcript is not ready yet.':'Nothing to review yet. Choose a passage, then record.'}</p>
   <button className="vs-btn" onClick={()=>openView('work')}>Back to the card</button>
  </div>}
  {!passage&&<nav className="vs-take-tools vs-take-tools--secondary" aria-label="Review tools">{tools}</nav>}
  {!editing&&!!draft?.unassigned.length&&<button className="vs-note" onClick={()=>openView('unplaced')}>
   <span>{plural(draft.unassigned.length,'passage')} from your recording {draft.unassigned.length===1?'was':'were'} not placed.</span>
   <strong>Place {draft.unassigned.length===1?'it':'them'}<ChevronRight size={15}/></strong>
  </button>}
  {!editing&&!!linkedDrafts.length&&<nav aria-label="Connected card recordings">
   {linkedDrafts.map(value=><button key={value.id} className="vs-note" onClick={()=>{onClose();onNavigateCard?.(value.cardNumber,value.id);}}>
    <span>You also spoke about Code {value.cardNumber}.</span>
    <strong>Review {plural(value.results.length,'passage')}<ChevronRight size={15}/></strong>
   </button>)}
  </nav>}
 </div>;
}

export type ReviewDockProps=Omit<AppliedActionsProps,'section'>&Pick<VoiceStudio,
 'audioUrl'|'playing'|'player'|'clipBounds'|'playhead'|'loop'|'setLoop'|'loopCleanup'|'stopListening'|'replay'|
 'active'|'listen'|'opening'|'stopping'|'record'|'phrase'|'open'|'applyLabel'|'generalCheck'|'applySection'|'historyApplyReason'
>&{section:CardSection;result:SectionDraftResult};

/**
 * The review screen's dock: playback controls while a take plays, the applied actions once a section
 * is applied, otherwise Listen, Re-record and the apply button.
 */
export function ReviewDock(props:ReviewDockProps){
 const {section,result,audioUrl,playing,player,report,clipBounds,playhead,loop,setLoop,loopCleanup,stopListening,replay,integrating,active,draft,listen,opening,stopping,record,phrase,open,applyLabel,generalCheck,applySection,historyApplyReason}=props;
 return <footer className="vs-dock vs-dock--review vs-review-actions">
  {audioUrl?<>
   <button className="vs-icon vs-icon--ring" aria-label={playing?'Pause playback':'Play'} onClick={()=>{if(playing)player.current?.pause();else void player.current?.play().catch(report);}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
   <div className="vs-progress">
    <span style={{'--at':clipBounds.current?Math.min(1,Math.max(0,(playhead-clipBounds.current.startMs)/Math.max(1,clipBounds.current.endMs-clipBounds.current.startMs))):player.current?.duration?Math.min(1,playhead/1000/player.current.duration):0} as React.CSSProperties}/>
    <small>{time(clipBounds.current?Math.max(0,playhead-clipBounds.current.startMs):playhead)}</small>
   </div>
   {clipBounds.current&&<button className="vs-icon" aria-label="Loop this passage" aria-pressed={loop} onClick={()=>{const next=!loop;setLoop(next);loopCleanup.current?.();if(player.current&&clipBounds.current)loopCleanup.current=loopVoicePhrase(player.current,clipBounds.current,next);}}><Repeat size={18}/></button>}
   <button className="vs-btn" onClick={stopListening}>{replay?'Back to editing':'Done'}</button>
  </>:result.applied?appliedActions(props):<>
   <button className="btn btn-quiet btn-sm" disabled={integrating||!!active||!draft?.captureSessionId} onClick={()=>void listen()}>Listen</button>
   <button className="btn btn-quiet btn-sm" disabled={opening||integrating||stopping} onClick={()=>void record(phrase&&phrase.sectionId===section.id?phrase:null,section.id,result.passageEdit)}>{phrase&&phrase.sectionId===section.id?'Re-record selection':'Re-record'}</button>
   <button className="btn btn-primary btn-sm" data-action="apply" disabled={!result.text.trim()||integrating||open>0||applyLabel.empty||!!historyApplyReason} onClick={()=>void applySection()}>{integrating?'Saving words…':open?`Check ${plural(open,generalCheck?'item':'word')} first`:!result.text.trim()?'No words to use':applyLabel.text}</button>
  </>}
 </footer>;
}

export type PlaybackAudioProps=Pick<VoiceStudio,
 'audioUrl'|'player'|'seekAt'|'setPlayhead'|'loopCleanup'|'clipBounds'|'loop'|'report'|'setPlaying'|'replay'|'setActiveWord'
>&Partial<Pick<VoiceStudio,'checkAudio'|'playNextTake'>>;

/** The hidden audio element every Listen, Play and Hear goes through, on the review and recordings screens alike. */
export function PlaybackAudio({audioUrl,player,seekAt,setPlayhead,loopCleanup,clipBounds,loop,report,setPlaying,replay,setActiveWord,checkAudio,playNextTake}:PlaybackAudioProps){
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
  onEnded={()=>{setPlaying(false);setActiveWord(-1);playNextTake?.();}}
  src={audioUrl}
  aria-label="Original recording"
 />;
}
