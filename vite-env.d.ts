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

// The generated Oracle Entry markup (components/oracle/entry/generated/*) emits a
// real custom element <dc-import name="Hexagram" …> verbatim from the design
// file; it is registered at runtime by dc-hexagram-element.ts. Declare it here so
// the generated TSX type-checks without being hand-edited.
import type * as React from 'react';
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'dc-import': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        name?: string;
        lines?: boolean[];
        color?: string;
        hintSize?: string;
      };
    }
  }
}
