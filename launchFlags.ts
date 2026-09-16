/**
 * LAUNCH FLAGS — Temporary disables for initial launch
 *
 * Single source of truth for things temporarily off. Flip a flag from
 * false to true when the feature behind it is ready to expose.
 */

export const LAUNCH_FLAGS = {
  /**
   * ACCOUNTS — self-owned Better Auth sign-in + D1-backed profile + collections.
   * Same-origin (email code + password + Google); no public build-time key.
   * Runtime secrets live in Cloudflare Pages env: BETTER_AUTH_SECRET,
   * BETTER_AUTH_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, GOOGLE_CLIENT_ID,
   * GOOGLE_CLIENT_SECRET, ADMIN_EMAILS.
   * Files affected:
   *   - lib/account/AccountProvider.tsx (mounts the auth context when on)
   *   - components/account/AccountLayout.tsx (redirects to / when off)
   *
   * Enabled 2026-06-09; auth moved in-house from Clerk to Better Auth.
   */
  accounts: true,

  /**
   * HOLOGENETIC PROFILE — Birth chart at /profile and the
   * YourPositionCallout overlay on universal-language card pages.
   * Local-first (works in guest mode via localStorage); syncs to D1
   * only when accounts is on and the user is signed in.
   */
  hologeneticProfile: true,

  /**
   * RELATIONS STACK — the card page's Relations panel as a stack of kin in
   * two families (components/oracle/RelationsStack.tsx), replacing the orbit
   * diagram. Off: the template's orbit renders as before. On: the stack.
   * Built 2026-09-12; Adrian holds it off main until he has worked it up.
   */
  relationsStack: false,
};
