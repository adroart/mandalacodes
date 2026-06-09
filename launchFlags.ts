/**
 * LAUNCH FLAGS — Temporary disables for initial launch
 *
 * Single source of truth for things temporarily off. Flip a flag from
 * false to true when the feature behind it is ready to expose.
 */

export const LAUNCH_FLAGS = {
  /**
   * ACCOUNTS — Clerk sign-in + D1-backed profile + collections.
   * To enable:
   *   1. Set VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET on Cloudflare Pages
   *   2. Configure Clerk webhook → https://mandalacodes.com/api/clerk/webhook
   *   3. Flip this flag to true
   * Files affected:
   *   - lib/account/AccountProvider.tsx (mounts ClerkProvider when on)
   *   - components/account/AccountLayout.tsx (redirects to / when off)
   *
   * Enabled 2026-06-09: same Clerk app + shared D1 as adrianrasmussen.com,
   * so one sign-in spans both domains. Keys in Cloudflare Pages env (prod).
   */
  accounts: true,

  /**
   * HOLOGENETIC PROFILE — Birth chart at /profile and the
   * YourPositionCallout overlay on universal-language card pages.
   * Local-first (works in guest mode via localStorage); syncs to D1
   * only when accounts is on and the user is signed in.
   */
  hologeneticProfile: true,
};
