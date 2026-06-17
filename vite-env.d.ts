/// <reference types="vite/client" />

// Customer login is same-origin Better Auth — there is no build-time
// publishable key. All auth secrets are runtime-only (Cloudflare Pages env),
// so there are intentionally no VITE_* auth vars here.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
