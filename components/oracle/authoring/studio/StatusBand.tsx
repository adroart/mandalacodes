import {X} from 'lucide-react';
import {plural} from './format';
import type {VoiceStudio} from './types';

export type ProcessingStatusProps=Pick<VoiceStudio,
 'savedCaptures'|'needsSignIn'|'cannotSignIn'|'processingMessage'|'processingDetail'|'view'|'openView'|
 'account'|'accountActions'|'retrying'|'signInAndResume'|'retrySaved'|'processing'|'queued'
>;

/** The sign-in and saved-recordings band under the bar: Listen, Sign in or Reconnect, Retry. */
export function ProcessingStatus({savedCaptures,needsSignIn,cannotSignIn,processingMessage,processingDetail,view,openView,account,accountActions,retrying,signInAndResume,retrySaved,processing,queued}:ProcessingStatusProps){
 return <section className="vs-processing-status" aria-label="Recording and transcription status">
  <div>
   <strong>{savedCaptures.length?`${plural(savedCaptures.length,'recording')} saved on this device`:'Sign in once for automatic transcription'}</strong>
   <span>{needsSignIn?'Your sign-in will be remembered. Saved recordings will resume.':cannotSignIn?'This version of the app cannot sign in, so your recordings cannot be prepared yet. They stay saved on this device.':processingMessage}</span>
   {!needsSignIn&&processingDetail&&<small className="vs-error-detail">Details: {processingDetail}</small>}
  </div>
  <div className="vs-processing-actions">
   {savedCaptures.length>0&&view!=='audio'&&<button className="vs-btn" onClick={()=>openView('audio')}>Listen</button>}
   {needsSignIn
    ?<button className="vs-btn vs-btn--primary" disabled={accountActions.busy||retrying} onClick={()=>void signInAndResume()}>{accountActions.busy?'Signing in…':account.isSignedIn?'Reconnect':'Sign in'}</button>
    :cannotSignIn
     ?null
     :<button className="vs-btn vs-btn--primary" disabled={retrying||processing||!!queued.length} onClick={()=>void retrySaved()}>{retrying?'Retrying…':'Retry'}</button>}
  </div>
 </section>;
}

export type ToastProps=Pick<VoiceStudio,'notice'|'toastError'|'toastDetail'|'dismissToast'>;

/** The error or notice toast. A failure about saved recordings shows in the band above instead. */
export function Toast({notice,toastError,toastDetail,dismissToast}:ToastProps){
 return <div className="vs-toast" role={toastError?'alert':'status'} data-tone={toastError?'alert':undefined}>
  <span>{toastError||notice}{toastDetail&&<small className="vs-error-detail">Details: {toastDetail}</small>}</span>
  <button className="vs-icon" aria-label="Dismiss" onClick={dismissToast}><X size={16}/></button>
 </div>;
}
