import {useState} from 'react';
import type {VoiceStudio} from './types';

type Props=Pick<VoiceStudio,'sectionHistory'|'restoreHistory'|'integrating'|'processing'|'active'|'queued'>;

/** Retained browser-local reading revisions and draft snapshots, in time order. */
export default function HistoryScreen({sectionHistory,restoreHistory,integrating,processing,active,queued}:Props){
 const [page,setPage]=useState(0),size=8,count=Math.max(1,Math.ceil(sectionHistory.length/size));
 const index=Math.min(page,count-1);
 return <div className="vs-stage vs-history" aria-label="Reading history">
  <p className="vs-history-note">Recent versions saved on this device.</p>
  {!sectionHistory.length&&<p>No retained versions for this section yet.</p>}
  <ol className="vs-history-list" start={index*size+1}>{sectionHistory.slice(index*size,(index+1)*size).map(entry=><li key={entry.id} className="vs-history-entry" data-history-kind={entry.kind}>
   <div className="vs-history-head"><strong>{entry.kind==='working'?'Reading version':entry.stateLabel==='Applied proposal'?'Applied draft':'Draft'}</strong><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></div>
   <p className="vs-history-preview">{entry.preview}</p>
   {entry.restoreDisabledReason?<p className="vs-history-reason">{entry.restoreDisabledReason}</p>:<button type="button" className="vs-btn" disabled={integrating||processing||!!active||queued.length>0} onClick={()=>void restoreHistory(entry)}>Restore as draft</button>}
  </li>)}</ol>
  {count>1&&<nav className="vs-history-pages" aria-label="History pages"><button type="button" className="vs-btn" disabled={index===0} onClick={()=>setPage(index-1)}>Newer</button><span>{index+1} of {count}</span><button type="button" className="vs-btn" disabled={index===count-1} onClick={()=>setPage(index+1)}>Older</button></nav>}
 </div>;
}
