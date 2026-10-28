# Native Oracle accounts

## Integration

Wrap the native app's existing ProfileProvider and CollectionsProvider with
`NativeAccountProvider`. Register `OracleAccount` at `/account` and link it from
the native menu. The provider defaults to `enabled={false}` until the required
server change has been deployed. Backup/preview/restore works while disabled.

The provider publishes the existing `AccountContext` contract, so Birthday
sync reuses `lib/profile/context.tsx`, including guest claiming, account-scoped
storage, stale-request cancellation and failed-delete protection. It waits for
successful sync-user registration before exposing the signed-in identity.

Explicit CapacitorHttp requests use native URLSession's cookie storage. Neither
global fetch patching nor CapacitorCookies document.cookie patching is enabled.
The bridge pins HTTPS to mandalacodes.com, allowlists paths, disables redirects,
does not accept caller auth/cookie headers, and filters Set-Cookie from responses.
Cookie durability across restart and real sign-out MUST be verified on iPhone.
On offline app launch, the session cannot yet be revalidated, so account-owned
charts are not exposed through the account provider; guest reading still works.

## Required before enabling

- Deploy the exact `capacitor://localhost` entry added to Better Auth
  `trustedOrigins` in `lib/account/auth.server.js`. Do not disable origin checks
  or broaden to wildcards. Native transport does not need browser CORS changes.
- Real-device email OTP, session on relaunch, profile sync and sign-out test.
  This work does not send sign-in emails automatically.
- Sign in with Apple is not configured; this is the existing email-code account.
- Journal and audio sync are NOT implemented by this provider. Do not describe
  the existing Birthday endpoint as full-app backup.

Read-only production check 2026-10-28: unauthenticated GET
https://mandalacodes.com/api/auth/get-session returned HTTP 200 and JSON null.
This proves reachability only, not native sign-in or email delivery.

Sources: https://capacitorjs.com/docs/apis/http and installed Capacitor 8.5.3
HttpRequestHandler.swift / CapacitorUrlRequest.swift; Better Auth 1.6.18 installed
origin-check.mjs; https://better-auth.com/docs/reference/security.
