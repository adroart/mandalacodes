# Launch sign-in on the live Mandala Codes site

PR #5 (merged 2026-05-28) wired sign-in into the site, but it needs a Clerk account set up and connected before it works on production. Until the environment variables below are saved, the admin atlas page and the atlas claim page show broken sign-in widgets. The public atlas page keeps working.

## Steps

1. Create the Clerk app at clerk.com. Name it `mandalacodes`. Enable Google and email sign-in.
2. Copy the publishable key and the secret key.
3. In Cloudflare Pages, go to mandalacodes, then Settings, then Environment variables, Production, and add three values:
   - `VITE_CLERK_PUBLISHABLE_KEY` (plaintext)
   - `CLERK_SECRET_KEY` (encrypted)
   - `ADMIN_EMAILS=sccsclothing@gmail.com` (plaintext)
4. Trigger a redeploy.
5. Sign in at `/admin/login` and confirm it works.

PR: [#5](https://github.com/technicianofthesacred/mandalacodes/pull/5)

## After sign-in is confirmed working

Remove the now-obsolete environment variables from Cloudflare Pages (mandalacodes, Settings, Environment variables): `ATLAS_ADMIN_PASSWORD_HASH` and `ATLAS_STEWARD_SECRET`. They are no longer referenced anywhere in the code. Leave `ATLAS_PUBLIC_ONLY_IN_DEV=false` in place; it is reserved for future use.
