import { createContext, useContext } from 'react';
import {
  sendSignInCode,
  verifySignInCode,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
} from '../../lib/account/authClient';

/**
 * The five ways in, as one swappable set. The website uses the browser Better
 * Auth client. The Oracle iPhone app provides its own set (native transport and
 * the system-browser Google flow) through `SignInActionsProvider`, so every
 * sign-in screen in the app, the modal included, signs the app in rather than
 * the web view. Before this, the modal always used the browser client, which
 * cannot run from the app and showed "Google sign-in is not available".
 */
export interface SignInActions {
  sendSignInCode(email: string): Promise<{ error?: unknown }>;
  verifySignInCode(email: string, code: string): Promise<{ error?: unknown }>;
  signInWithPassword(email: string, password: string): Promise<{ error?: unknown }>;
  signUpWithPassword(email: string, password: string, name?: string): Promise<{ error?: unknown }>;
  signInWithGoogle(callbackURL?: string): Promise<{ error?: unknown }>;
  /** True when Google finishes in place (native app) instead of navigating away. */
  googleReturnsToApp?: boolean;
}

export const websiteActions: SignInActions = {
  sendSignInCode,
  verifySignInCode,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
};

const SignInActionsContext = createContext<SignInActions>(websiteActions);
export const SignInActionsProvider = SignInActionsContext.Provider;
export const useSignInActions = () => useContext(SignInActionsContext);
