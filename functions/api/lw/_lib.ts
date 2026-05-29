// Shared helpers for the Lightweaver relay endpoints.
//
// State layout in the LIGHTWEAVER_RELAY KV namespace:
//   card:<id>:state    — last reported card state (heartbeat). JSON. TTL 1 day.
//   card:<id>:pending  — pending command bundle (the browser writes, card consumes). JSON. TTL 5 min.
//   card:<id>:meta     — { ownerToken, label, pairedAt }. JSON. Persistent.
//   pair:<code>        — { cardId, expiresAt }. JSON. TTL 10 min.

// Inline types to avoid depending on global Cloudflare Workers types being
// resolvable at deploy-time compilation. Pages Functions runtime exposes
// KVNamespace and the PagesFunction signature regardless of whether the
// types package is installed.
type KVNamespace = {
  get<T>(key: string, type: 'json'): Promise<T | null>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type PagesFunction<Env = unknown, Params extends string = string> = (
  context: {
    request: Request;
    env: Env;
    params: Record<Params, string | string[]>;
  }
) => Response | Promise<Response>;

export interface RelayEnv {
  LIGHTWEAVER_RELAY: KVNamespace;
}

export type CardState = {
  id: string;
  label?: string;
  online: boolean;
  lastSeenAt: number;
  pixels?: number;
  currentPatternId?: string;
  brightness?: number;
  hue?: number;
  saturation?: number;
  breathe?: boolean;
  drift?: boolean;
  blackout?: boolean;
  fw?: string;
};

export type PendingCommand = {
  commandId?: string;
  brightness?: number;
  hue?: number;
  saturation?: number;
  breathe?: boolean;
  drift?: boolean;
  blackout?: boolean;
  patternId?: string;
  speed?: number;
  hueShift?: number;
  syncToken?: string; // browser sets this; card echoes in next state so browser knows the command landed
};

export type AckRequest = {
  commandId?: string;
};

export type CardMeta = {
  ownerToken: string;
  label: string;
  pairedAt: number;
};

export const STATE_TTL = 86400;    // 24 h
export const PENDING_TTL = 300;    // 5 min
export const PAIR_TTL = 600;       // 10 min

export const ONLINE_THRESHOLD_MS = 60_000; // card is "online" if last seen <60s ago

export function cardStateKey(id: string) { return `card:${id}:state`; }
export function cardPendingKey(id: string) { return `card:${id}:pending`; }
export function cardMetaKey(id: string) { return `card:${id}:meta`; }
export function pairKey(code: string) { return `pair:${code}`; }

// Generate a random alphanumeric token. Used for card→owner binding so the
// customer's browser proves it owns this card without a real auth flow.
export function newToken(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Generate a 6-character pairing code (uppercase letters + digits, no
// ambiguous characters: no 0/O, 1/I/L). Easy to type from a phone.
export function newPairCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const out: string[] = [];
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) out.push(alphabet[buf[i] % alphabet.length]);
  return out.join('');
}

export function newCommandId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return newToken(16);
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-LW-Token');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function corsPreflight() {
  return jsonResponse({ ok: true }, { status: 204 });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T; } catch { return null; }
}
