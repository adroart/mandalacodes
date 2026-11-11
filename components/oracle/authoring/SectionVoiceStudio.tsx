import {useRef} from 'react';
import {useVoiceStudio} from './studio/useVoiceStudio';
import StudioBar from './studio/StudioBar';
import {ProcessingStatus,Toast} from './studio/StatusBand';
import SectionIndex from './studio/SectionIndex';
import Manuscript from './studio/Manuscript';
import Dock from './studio/Dock';
import {ReviewStage,ReviewDock,PlaybackAudio} from './studio/ReviewScreen';
import {SectionsPicker,UnplacedScreen,CleanupScreen,SettingsScreen,AudioScreen,SessionsScreen} from './studio/SettingsScreens';
import {useVisualViewport} from './studio/useVisualViewport';
import {useManuscriptScroll,useRecordingAnnouncement,useScreenFocus} from './studio/useScreenFocus';
import type {StudioProps} from './studio/types';
import './SectionVoiceStudio.css';

/**
 * One manuscript to read and record over, one focused screen to compare, and plain screens for everything else.
 * The state lives in `studio/useVoiceStudio`; each screen is its own module under `studio/`.
 */
export default function SectionVoiceStudio(props:StudioProps){
 const studio=useVoiceStudio(props);
 const {view,active,recordingTarget,opening,integrating,step,statusShown,notice,toastError,section,result,draft,audioUrl,pickFromRail,manuscript,monitor,targetId}=studio;
 const root=useRef<HTMLElement>(null);
 useVisualViewport(root);
 useScreenFocus(root,view==='review'&&result?.applied?'applied':view);
 useManuscriptScroll(root,manuscript,view,targetId,draft?.id,!!active);
 const announcement=useRecordingAnnouncement(!!active,monitor.paused);
 return <section ref={root} className="section-voice-studio" aria-label="Voice recording" data-view={view} data-recording-section-id={active?recordingTarget.current:undefined} data-authoring-protected={!!active||opening||integrating||undefined} onKeyDown={e=>{if(view!=='review'||(e.target as HTMLElement).closest('textarea,input,[contenteditable=true],button'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}}}>
  <StudioBar {...studio}/>
  {statusShown&&<ProcessingStatus {...studio}/>}
  <div className="vs-main">
   {(view==='work'||view==='review')&&<SectionIndex {...studio} onPick={pickFromRail} mode="rail"/>}

   {view==='work'&&<Manuscript {...studio}/>}

   {view==='review'&&<ReviewStage {...studio}/>}

   {view==='sections'&&<SectionsPicker {...studio}/>}

   {view==='unplaced'&&draft&&<UnplacedScreen {...studio} draft={draft}/>}

   {view==='cleanup'&&result&&<CleanupScreen {...studio} result={result}/>}

   <SettingsScreen {...studio}/>

   {view==='audio'&&<AudioScreen {...studio}/>}

   {view==='sessions'&&<SessionsScreen {...studio}/>}
  </div>

  {(notice||toastError)&&<Toast {...studio}/>}

  {view==='work'&&<Dock {...studio}/>}

  {view==='review'&&section&&result&&<ReviewDock {...studio} section={section} result={result}/>}

  {audioUrl&&<PlaybackAudio {...studio}/>}
  <p className="vs-visually-hidden" role="status" aria-live="polite" data-recording-announcement>{announcement}</p>
 </section>;
}
