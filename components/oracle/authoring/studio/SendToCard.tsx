import {displaySectionTitle} from '../../../../lib/oracle/authoring/cardSections';
import {plural} from './format';
import type {SendToCardState} from './useSendToCard';

const shortDate=(iso:string)=>new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

/** What "Send finished sections to the card" will send, in the card's own order, and the one button that sends it. */
export default function SendToCard({state}:{state:SendToCardState}){
 const {bundle,failed,count,blocked,sending,message,send,setOpen,fresh,sent}=state;
 const reason=blocked||(failed?'Your sections could not be gathered.':!bundle?'Checking your sections.':!count?'Nothing to send yet. Apply a section first.':'');
 return <section className="vs-stage vs-screen" aria-label="Send to the card">
  <h3>Send finished sections to the card</h3>
  <p className="vs-lead">The app saves one file with these words. Opening that file on your Mac puts them into the card, and nothing changes on the site until you approve it there.</p>
  {bundle?.sections.map(s=><div className="vs-row" key={s.id} data-send-section={s.id}>
   <div>
    <p>{displaySectionTitle(s.path.join(' · '))}</p>
    <small>{s.fullyHuman?'All your words':'Partly your words'}{sent&&fresh?.has(s.id)?` · new since ${shortDate(sent.at)}`:''}</small>
   </div>
  </div>)}
  {!!bundle?.omitted.length&&<>
   <h3>Not included</h3>
   {bundle.omitted.map((o,i)=><div className="vs-row" key={`${i}/${o.sectionId}`}>
    <div><p>{displaySectionTitle(o.path.join(' · '))}</p><small>{o.reason}</small></div>
   </div>)}
  </>}
  <button className="vs-btn vs-btn--primary" disabled={!!reason||sending} onClick={()=>void send()}>{sending?'Sending':`Send ${plural(count,'section')}`}</button>
  {reason&&<p className="vs-lead">{reason}</p>}
  {message&&<p className="vs-lead" role={message.alert?'alert':'status'}>{message.text}</p>}
  <button className="vs-btn vs-btn--quiet" onClick={()=>setOpen(false)}>Back to settings</button>
 </section>;
}
