# Native Oracle accounts

## Build and integration

`NativeAccountProvider` wraps the app's ProfileProvider and CollectionsProvider.
The `/account` screen uses the shared sign-in panel for Google, email/password,
account creation, and email codes. Production phone builds must set
`VITE_ORACLE_NATIVE_ACCOUNTS=true`; omitting the flag deliberately leaves login
disabled while local Birthday backup and restore remain available.

The exact `capacitor://localhost` trusted origin and the native Google handoff
are published. Origin checks remain enabled. Google authentication opens in
`ASWebAuthenticationSession`, then exchanges a short-lived, verifier-bound code
through `/api/auth/native/exchange`. Credentials stay in the system browser;
the JavaScript verifier stays in memory for that attempt.

The provider publishes the existing `AccountContext` contract. Birthday sync
reuses `lib/profile/context.tsx`, including guest claiming, account-scoped
storage, stale-request cancellation, and failed-delete protection. Identity
registration completes before the signed-in state is exposed.

Explicit CapacitorHttp requests use native URLSession cookie storage. Global
fetch patching and CapacitorCookies document.cookie patching remain disabled.
The transport pins HTTPS to mandalacodes.com, allowlists account paths, disables
redirects, rejects caller auth/cookie headers, and filters Set-Cookie from the
JavaScript response. On offline launch the session cannot yet be revalidated,
so account-owned charts remain unavailable; guest reading still works.

## Verification and limits

`npm run test:oracle-account` runs 13 mocked WebKit account/reminder layout and
interaction checks. The existing mobile CI job runs them with local fonts and
no production artwork downloads. Unit tests cover proof binding, cancellation,
timeouts, origin/path restrictions, and real in-memory server session exchange.

As of 2026-10-28, build 12 is installed and the reminder gap/time picker was
confirmed on the phone. The server's Google start route was verified to return
a Google redirect with a secure flow cookie. **Actual Google account sign-in,
app reopen with the same session, and sign-out have not yet been tested by the
owner.** Mocked browser tests and anonymous server probes do not establish that
complete device flow. Email-code delivery and Birthday sync also require their
own real-account verification; tests do not send emails automatically.

Sign in with Apple is not configured. This provider does not sync journals or
audio; the Birthday endpoint is not a full-app backup.
