import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  useUser,
} from '@clerk/clerk-react';

/**
 * Steward claim — rendered at /atlas/claim.
 *
 * Flow:
 *   1. Collector signs in to mandalacodes with Clerk using the email Adrian
 *      added them with.
 *   2. The page POSTs to /api/atlas/steward/claim (no body — identity comes
 *      from the bearer token).
 *   3. Server matches the steward record by clerkUserId or email, binds the
 *      userId on first match, and returns the claimed pieces.
 *   4. We redirect to /atlas/edit on success, or show a friendly "ask Adrian"
 *      message if no record is bound to this email.
 */
const StewardClaim: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'claiming' | 'no-record' | 'error'>(
    'idle',
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn || status !== 'idle') return;
    let cancelled = false;
    (async () => {
      setStatus('claiming');
      try {
        const token = await getToken();
        const res = await fetch('/api/atlas/steward/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (cancelled) return;
        if (res.ok) {
          navigate('/atlas/edit', { replace: true });
          return;
        }
        if (res.status === 404) {
          setStatus('no-record');
        } else {
          setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, navigate, status]);

  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1
          className="font-display text-3xl text-wood-900 font-medium text-center mb-6 tracking-wide"
          style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}
        >
          Claim your piece
        </h1>

        <SignedOut>
          <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700 text-center mb-10">
            If you hold one of Adrian Rasmussen's pieces, sign in with the email Adrian used when he added you. Only your city will appear publicly, never an address. You can switch to private at any time.
          </p>
          <SignIn
            path="/atlas/claim"
            routing="path"
            signUpUrl="/atlas/claim"
            afterSignInUrl="/atlas/claim"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-none border border-wood-200 bg-white',
              },
            }}
          />
        </SignedOut>

        <SignedIn>
          {status === 'claiming' && (
            <p className="font-serif italic text-base text-stone-700 text-center">
              Looking up your piece...
            </p>
          )}
          {status === 'no-record' && (
            <div className="text-center">
              <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700 mb-3">
                We don't have a piece bound to{' '}
                <span className="text-wood-900">
                  {user?.primaryEmailAddress?.emailAddress ?? 'your email'}
                </span>{' '}
                yet.
              </p>
              <p className="font-serif italic text-sm text-stone-600">
                If you hold one of Adrian's pieces, send him a note and he'll add you with this email address.
              </p>
            </div>
          )}
          {status === 'error' && (
            <p className="font-serif italic text-base text-stone-600 text-center">
              Something went wrong. Please try again.
            </p>
          )}
        </SignedIn>
      </div>
    </section>
  );
};

export default StewardClaim;
