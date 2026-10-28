import React, {useCallback,useEffect,useMemo,useState} from 'react';
import {createReminderBridge,type ReminderStatus} from './reminderBridge';
import './reminders.css';
export default function ReminderSettings() {
  const bridge=useMemo(()=>createReminderBridge(),[]);
  const [status,setStatus]=useState<ReminderStatus|null>(null);
  const [time,setTime]=useState('09:00');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const update=useCallback((value:ReminderStatus)=>{
    setStatus(value);
    if(value.scheduled && value.hour!==null && value.minute!==null)setTime(`${String(value.hour).padStart(2,'0')}:${String(value.minute).padStart(2,'0')}`);
  },[]);
  const refresh=useCallback(async()=>{
    if(!bridge.available)return;
    setBusy(true);
    try{update(await bridge.status());setMessage('');}
    catch(error){setMessage(error instanceof Error?error.message:'Reminder status could not be checked.');}
    finally{setBusy(false);}
  },[bridge,update]);
  useEffect(()=>{
    void refresh();
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    document.addEventListener('visibilitychange',visible);
    return()=>document.removeEventListener('visibilitychange',visible);
  },[refresh]);
  const change=async(enable:boolean)=>{
    setBusy(true);setMessage('');
    try{
      const [hour,minute]=time.split(':').map(Number);
      const next=enable?await bridge.enable(hour,minute):await bridge.disable();
      update(next);
      setMessage(enable?(next.enabled?'Daily reminder saved.':next.authorization==='denied'?'Notifications are off in iPhone Settings.':'No reminder was enabled.'):next.scheduled?'The reminder is still scheduled. Check status and try again.':'Daily reminder turned off.');
    }catch(error){setMessage(error instanceof Error?error.message:'The reminder could not be changed.');}
    finally{setBusy(false);}
  };
  return <section className="oracle-reminder-settings" aria-labelledby="oracle-reminder-title">
    <h2 id="oracle-reminder-title">A daily moment</h2>
    <p>An optional reminder to pause and open Oracle, at a time you choose.</p>
    {!bridge.available?<p className="oracle-reminder-note">Daily reminders are available in the installed iPhone app.</p>:<>
      <p className="oracle-reminder-note">{!status?(busy?'Checking reminders…':'Reminder status is unavailable.'):status.enabled?'Daily reminder is on.':status.authorization==='denied'?'Notifications are off in iPhone Settings.':'Daily reminder is off.'}</p>
      <div className="oracle-reminder-controls"><label htmlFor="oracle-reminder-time">Local time<input id="oracle-reminder-time" type="time" value={time} disabled={busy} onChange={event=>setTime(event.target.value)}/></label>
      {status?.authorization==='denied'?<button disabled={busy} onClick={()=>{void bridge.openSettings().catch(error=>setMessage(error instanceof Error?error.message:'Settings could not be opened.'));}}>Open iPhone Settings</button>:<button disabled={busy||!time||!status} onClick={()=>{void change(true);}}>{status?.scheduled?'Save time':'Enable reminder'}</button>}
      {status?.scheduled&&<button disabled={busy} onClick={()=>{void change(false);}}>Turn off</button>}</div>
      <button className="oracle-reminder-refresh" disabled={busy} onClick={()=>{void refresh();}}>Check status</button>
      <p className="oracle-reminder-note">Delivery follows your iPhone’s notification and Focus settings.</p>
    </>}
    {message&&<p role="status" aria-live="polite">{message}</p>}
  </section>;
}
