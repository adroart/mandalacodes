import type {AuthoringServices,SourceSnapshot} from '../../../../lib/oracle/authoring/types';
import type {PassageAnchor} from '../../../../lib/oracle/authoring/passageContext';
import type {VoiceStudio} from './useVoiceStudio';

/** The props of `SectionVoiceStudio`, unchanged by the split into `studio/`. */
export interface StudioProps{
 source:SourceSnapshot;
 services:AuthoringServices;
 sectionId:string;
 onClose:()=>void;
 onEarlier:()=>void;
 namedSectionId?:string;
 initialAnchors?:PassageAnchor[];
 onNavigateCard?:(card:number,sessionId?:string)=>void;
 initialSessionId?:string;
}

/** Which screen the studio shows. Every screen but settings unmounts when another one opens. */
export type View='work'|'review'|'settings'|'audio'|'sessions'|'sections'|'cleanup'|'unplaced';

/** The colour of a section's state chip. */
export type Tone='rec'|'busy'|'ready'|'check'|'human'|'alert';

/** A section's state chip, as `chip()` reports it. */
export type SectionChip={label:string;tone:Tone};

export type {VoiceStudio};
