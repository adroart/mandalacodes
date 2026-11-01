import {SectionDraftStore} from '../../../lib/oracle/authoring/sectionDrafts';
import type {AuthoringServices} from '../../../lib/oracle/authoring/types';
import {queueSectionTake,type TakeSession} from './sectionTakes';
import {processSectionSession} from './sectionWorkflow';

export const isSignInBlocked=(message?:string)=>message==='Sign in to process on this phone. Your recording is saved.';
let recovery:Promise<void>|undefined;
/** Run after a real account is restored. Retry saved speech, never apply its proposed edits. */
export function resumeSignInBlockedRecordings(services:AuthoringServices):Promise<void>{
 if(recovery)return recovery;
 recovery=(async()=>{
  for(const session of await new SectionDraftStore().list() as TakeSession[]){
   if(!session.captureSessionId)continue;
   if(session.takes?.length){
    for(const take of session.takes)if(take.state==='failed'&&isSignInBlocked(take.error))
     await queueSectionTake(session.id,take.captureId,take.startSectionId,services,take.markers);
   }else if(isSignInBlocked(session.error)&&!session.results.some(result=>result.applied)){
    // Older sessions have no individual job records. Their audio/transcripts remain reusable.
    await processSectionSession(session.id,services).catch(()=>undefined);
   }
  }
 })().finally(()=>{recovery=undefined;});
 return recovery;
}
