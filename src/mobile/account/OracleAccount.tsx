import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../../../lib/account/useAccount';
import { useProfile } from '../../../lib/profile/context';
import type { ProfileInputs } from '../../../lib/profile/storage';
import { useNativeAccountActions } from './NativeAccountProvider';
import { createProfileBackup, readProfileBackup } from './profileBackup';
import ReminderSettings from '../reminders/ReminderSettings';
import SignInPanel, { type SignInActions } from '../../../components/account/SignInPanel';
import './account.css';

export default function OracleAccount() {
  const account = useAccount();
  const actions = useNativeAccountActions();
  const {profile, save, isLoading, syncError, retrySync} = useProfile();
  const [backup,setBackup]=useState('');
  const [candidate,setCandidate]=useState<ProfileInputs | null>(null);
  const [notice,setNotice]=useState('');
  const [restoring,setRestoring]=useState(false);
  const [showRestore,setShowRestore]=useState(false);
  const report = (error:unknown) => setNotice(error instanceof Error ? error.message : 'Please try again.');
  const exportText = profile ? createProfileBackup(profile.inputs) : '';
  const nativeResult = async (operation: () => Promise<void>) => {
    try { await operation(); return {}; } catch (error) { return { error }; }
  };
  const signInActions: SignInActions = {
    sendSignInCode: email => nativeResult(() => actions.sendCode(email)),
    verifySignInCode: (email, code) => nativeResult(() => actions.verifyCode(email, code)),
    signInWithPassword: (email, password) => nativeResult(() => actions.signInWithPassword(email, password)),
    signUpWithPassword: (email, password, name) => nativeResult(() => actions.signUpWithPassword(email, password, name)),
    signInWithGoogle: () => nativeResult(() => actions.signInWithGoogle()),
  };
  return <div className="oracle-account-page">
    <header><p className="oracle-account-eyebrow">Mandala Codes</p><h1>Your account</h1><p className="oracle-account-intro">One place that holds everything that is yours here.</p></header>
    <section className={account.isSignedIn || !actions.enabled ? 'oracle-account-section' : 'oracle-account-signin'} aria-label={account.isSignedIn ? 'Signed-in account' : 'Sign in'}>
      {!actions.enabled ? <><p>Phone sign-in is being connected. For now, you can save a Birthday backup below and continue using Oracle on this phone.</p><a href="https://mandalacodes.com/account" target="_blank" rel="noopener noreferrer">Open website account ↗</a><p className="oracle-account-detail">Signing in on the website does not sign in this app.</p></> : account.isSignedIn ? <>
        <p>{account.email}</p>
        <p>{isLoading ? 'Syncing your Birthday chart…' : syncError ? syncError : profile ? 'Your Birthday chart is saved to your account.' : 'Add a Birthday chart to save it across devices.'}</p>
        {syncError && <button onClick={retrySync} disabled={isLoading}>Retry chart sync</button>}
        <button disabled={actions.busy} onClick={() => {void actions.signOut().catch(() => undefined);}}>Sign out</button>
        <p className="oracle-account-detail">Journal and audio are not included in account sync yet.</p>
      </> : <SignInPanel bare horizontal authActions={signInActions} googleReturnsToApp />}
      {account.isSignedIn && actions.error && <p role="alert">{actions.error}</p>}
    </section>
    <ReminderSettings />
    <section className="oracle-account-section" aria-labelledby="oracle-backup-heading">
      <h2 id="oracle-backup-heading">Birthday backup</h2>
      <p>Save a copy of your birth details. Restoring it recreates your chart. This includes your birth date, time, and place.</p>
      {profile ? <div className="oracle-account-actions">
        <button onClick={async()=>{try {await navigator.share({title:'Oracle Birthday backup',text:exportText});setNotice('Birthday backup shared.');}catch(error){if (!(error instanceof Error && /abort|cancel/i.test(error.message))) report(error);}}}>Share backup</button>
        <button onClick={async()=>{try {await navigator.clipboard.writeText(exportText);setNotice('Birthday backup copied. Paste it somewhere safe.');}catch{setBackup(exportText);setShowRestore(true);setNotice('Copy the backup text shown below.');}}}>Copy backup</button>
      </div> : <Link to="/profile">Create your Birthday chart</Link>}
      <button className="oracle-account-text" onClick={()=>{setShowRestore(!showRestore);setCandidate(null);}}>Restore a backup</button>
      {showRestore && <div className="oracle-account-restore">
        <label htmlFor="oracle-backup-input">Paste an Oracle Birthday backup</label><textarea id="oracle-backup-input" value={backup} onChange={event=>{setBackup(event.target.value);setCandidate(null);}} rows={5} spellCheck={false}/>
        <label className="oracle-account-file">Or choose a backup file<input type="file" accept="application/json,.json,.txt" onChange={async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>100000){setNotice('Choose a Birthday backup smaller than 100 KB.');return;}try{setBackup(await file.text());setCandidate(null);}catch{setNotice('This file could not be read.');}}}/></label>
        <button onClick={()=>{try{setCandidate(readProfileBackup(backup));setNotice('Check these birth details before restoring.');}catch(error){setCandidate(null);report(error);}}}>Preview restore</button>
        {candidate && <div className="oracle-account-preview"><p><strong>{candidate.date} · {candidate.time}</strong><br/>{candidate.place.label}</p><p>{profile ? 'This replaces the Birthday chart currently open in Oracle.' : 'This creates your Birthday chart.'}{account.isSignedIn ? ' It also updates your account chart.' : ''}</p><div className="oracle-account-actions"><button className="oracle-account-primary" disabled={restoring} onClick={async()=>{setRestoring(true);try{await save(candidate);setCandidate(null);setBackup('');setShowRestore(false);setNotice('Birthday chart restored.');}catch(error){report(error);}finally{setRestoring(false);}}}>{restoring?'Restoring…':'Restore this chart'}</button><button disabled={restoring} onClick={()=>setCandidate(null)}>Cancel</button></div></div>}
      </div>}
      <p role="status" aria-live="polite">{notice}</p>
    </section>
  </div>;
}
