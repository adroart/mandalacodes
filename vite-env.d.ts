/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key. Set in Cloudflare Pages → mandalacodes → Settings → Environment variables → Production. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
