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

Google authorization requests only `openid email profile`, with
`include_granted_scopes=false`. The shared OAuth client's old application grants
must not be merged into a login request. Better Auth 1.6.18 hardcodes the opposite;
the supported provider initialization hook narrows the generated URL while
preserving its state, PKCE challenge, callback and validation.

The provider publishes the existing `AccountContext` contract. Birthday sync
reuses `lib/profile/context.tsx`, including guest claiming, account-scoped
storage, stale-request cancellation, and failed-delete protection. Identity
registration completes before the signed-in state is exposed.

Explicit CapacitorHttp requests use native URLSession cookie storage. Global
fetch patching and CapacitorCookies document.cookie patching remain disabled.
The transport pins HTTPS to mandalacodes.com, allowlists account paths, disables
redirects, rejects caller auth/cookie headers, and filters Set-Cookie from the
JavaScript response. On offline launch the session cannot yet be revalidated,
so account-owned charts remain unavailable; guest reading still works. Existing
sessions are revalidated on reconnect and foreground return, with one request
for simultaneous events. A temporary network failure retains an already
validated in-memory identity; a server-confirmed expiry clears it.

After confirmed sign-in, authoring retries saved takes that were blocked only
by sign-in. It reuses their audio and destinations and leaves every proposed
change for review. iOS processing requests have a 110-second URLRequest timeout;
Capacitor uses `connectTimeout` for that entire request on iOS.

Hosted authoring uses `GROQ_API_KEY` from Pages secrets for transcription and
review. The release configuration in `wrangler.toml` explicitly chooses Groq and
`openai/gpt-oss-120b` for review. The server keeps the speech-evidence checks and
fixed upstream URLs; it never accepts provider credentials, URLs or model choices
from the phone. Actual provider/account availability still requires a signed-in
live request; a capability flag only proves configuration presence.

## Verification and limits

`npm run test:oracle-account` runs 17 mocked WebKit account/reminder layout and
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
