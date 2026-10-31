import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { AccountContext, type AccountState } from '../../../lib/account/useAccount';
import { accountResult, createNativeAccountFetch } from './nativeAccountTransport';
import { startNativeGoogleSignIn } from './nativeGoogleSignIn';

interface Session { user: { id: string; email: string } }
interface Actions {
  enabled: boolean; busy: boolean; error: string | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
const unavailable = async () => { throw new Error('Phone sign-in is not enabled yet.'); };
const ActionsContext = createContext<Actions>({enabled:false, busy:false, error:null, sendCode:unavailable, verifyCode:unavailable, signInWithPassword:unavailable, signUpWithPassword:unavailable, signInWithGoogle:unavailable, signOut:unavailable, refresh:unavailable});
export const useNativeAccountActions = () => useContext(ActionsContext);
const fetchNative = createNativeAccountFetch();

/** Enable only after the server's native trusted origin has been published.
 * This replaces the browser AccountProvider in the native entry only. */
export function NativeAccountProvider({ children, enabled = false }: {children:React.ReactNode; enabled?:boolean}) {
  const active = enabled && Capacitor.isNativePlatform();
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!active);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const authPending = useRef(false);
  const restoring = useRef<Promise<void> | null>(null);
  const run = useCallback(async (operation: () => Promise<void>) => {
    if (!active) throw new Error('Phone sign-in is not enabled yet.');
    if (authPending.current) throw new Error('An account action is already in progress.');
    authPending.current = true;
    // A startup/resume response cannot undo a later sign-in or sign-out.
    ++generation.current;
    setBusy(true); setError(null);
    try { await operation(); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Account sync is unavailable right now.';
      setError(message); throw cause;
    } finally { authPending.current = false; setBusy(false); setLoaded(true); }
  }, [active]);
  const loadSession = useCallback(async (requireSession = false, current = ++generation.current) => {
    const next = await accountResult(await fetchNative('/api/auth/get-session'));
    if (current !== generation.current) return;
    if (next?.user?.id && typeof next.user.email === 'string') {
      // Finish identity registration before ProfileProvider starts uploading.
      await accountResult(await fetchNative('/api/auth/sync-user', {method:'POST'}));
      if (current === generation.current) setSession(next);
    } else {
      setSession(null);
      if (requireSession) throw new Error('Sign-in could not be confirmed. Please try again.');
    }
  }, []);
  const refresh = useCallback(() => {
    if (!active) return Promise.reject(new Error('Phone sign-in is not enabled yet.'));
    // Foreground/online events often arrive together. Reuse the same validation
    // and never compete with a credential exchange or a confirmed sign-out.
    if (authPending.current) return Promise.resolve();
    if (restoring.current) return restoring.current;
    const current = ++generation.current;
    setError(null);
    let task: Promise<void>;
    task = loadSession(false, current).catch(cause => {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Account sync is unavailable right now.');
      throw cause;
    }).finally(() => {
      if (restoring.current === task) restoring.current = null;
      if (current === generation.current) setLoaded(true);
    });
    restoring.current = task;
    return task;
  }, [active, loadSession]);
  useEffect(() => {
    if (!active) { setLoaded(true); return; }
    const restore = () => { void refresh().catch(() => undefined); };
    const visible = () => { if (!document.hidden) restore(); };
    restore();
    window.addEventListener('online', restore);
    document.addEventListener('visibilitychange', visible);
    return () => {
      generation.current++;
      // React StrictMode may restart this effect before the old request settles.
      restoring.current = null;
      window.removeEventListener('online', restore);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [active, refresh]);
  const sendCode = useCallback((email: string) => run(async () => {
    await accountResult(await fetchNative('/api/auth/email-otp/send-verification-otp', {method:'POST', body:JSON.stringify({email:email.trim(),type:'sign-in'})}));
  }), [run]);
  const verifyCode = useCallback((email:string, code:string) => run(async () => {
    await accountResult(await fetchNative('/api/auth/sign-in/email-otp', {method:'POST', body:JSON.stringify({email:email.trim(),otp:code.trim()})}));
    await loadSession(true);
  }), [run, loadSession]);
  const signInWithPassword = useCallback((email:string, password:string) => run(async () => {
    await accountResult(await fetchNative('/api/auth/sign-in/email', {method:'POST', body:JSON.stringify({email:email.trim(),password})}));
    await loadSession(true);
  }), [run, loadSession]);
  const signUpWithPassword = useCallback((email:string, password:string, name = '') => run(async () => {
    await accountResult(await fetchNative('/api/auth/sign-up/email', {method:'POST', body:JSON.stringify({email:email.trim(),password,name:name.trim()})}));
    await loadSession(true);
  }), [run, loadSession]);
  const signInWithGoogle = useCallback(() => run(async () => {
    const handoff = await startNativeGoogleSignIn();
    await accountResult(await fetchNative('/api/auth/native/exchange', {method:'POST', body:JSON.stringify(handoff)}));
    await loadSession(true);
  }), [run, loadSession]);
  const signOut = useCallback(() => run(async () => {
    await accountResult(await fetchNative('/api/auth/sign-out', {method:'POST',body:'{}'}));
    // Confirm the native cookie jar no longer grants a session before the UI
    // claims sign-out. If it fails, keep the old account visible and retryable.
    const remaining = await accountResult(await fetchNative('/api/auth/get-session'));
    if (remaining?.user?.id) throw new Error('Sign-out could not be confirmed. Please try again.');
    setSession(null);
  }), [run]);
  const value = useMemo<AccountState>(() => ({available:active,isLoaded:loaded,isSignedIn:!!session,userId:session?.user.id ?? null,email:session?.user.email ?? null,fetchAuthed:fetchNative}), [active, loaded, session]);
  const actions = useMemo(() => ({enabled:active,busy,error,sendCode,verifyCode,signInWithPassword,signUpWithPassword,signInWithGoogle,signOut,refresh}), [active,busy,error,sendCode,verifyCode,signInWithPassword,signUpWithPassword,signInWithGoogle,signOut,refresh]);
  return <ActionsContext.Provider value={actions}><AccountContext.Provider value={value}>{children}</AccountContext.Provider></ActionsContext.Provider>;
}
