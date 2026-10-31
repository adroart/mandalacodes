import {resumeVoicePhraseRevisions} from './voicePhraseRevision';
import {startSectionTakeRecovery,resumeSectionTakes} from './sectionTakes';
import {resumeSectionWorkflows} from './sectionWorkflow';
import {resumeHumanJobs} from './humanCaptureJobs';
import {automaticTranscription,automaticProposals} from './processing';
import {bundledSource} from './bundledSource';
import {resumeSignInBlockedRecordings} from './accountRecovery';
const services={loadSource:bundledSource,transcribe:automaticTranscription,propose:automaticProposals};
/** Recovery loads processing modules without loading the recording interface over the reader. */
export const startPendingHumanRecovery=()=>startSectionTakeRecovery(services);
export const resumeSignedInAuthoring=()=>resumeSignInBlockedRecordings(services);
export function resumePendingHumanAuthoring(){resumeHumanJobs(services);void resumeSectionWorkflows(services);void resumeSectionTakes(services);void resumeVoicePhraseRevisions(services);}
