// Browser-side client for talking to a Lightweaver card on the local network.
//
// Critical context: this site is served over HTTPS (led.mandalacodes.com),
// but the card hosts a plain HTTP server at http://<host>.local. Browsers
// block mixed-content fetches by default, so calls from the deployed site
// will fail with a network/security error. The UI shows a different state
// in that case, telling the visitor to open the page directly on the card
// (http://<host>.local) for live control.
//
// When the dev server runs on http://localhost, mixed content is allowed
// against private IPs / .local hostnames, so this code works in dev.

export type CardStatus = {
  ok: boolean;
  mode: string;
  source: string;
  piece: { name: string; hostname?: string };
  led: { pixels: number; colorOrder: string };
  currentLookId: string;
  currentLookIndex: number;
  wifi: {
    transport: 'ap' | 'station';
    ssid: string;
    hostname: string;
    ip: string;
    configured: boolean;
  };
  blackout?: boolean;
};

export type CardPattern = {
  id: string;
  label: string;
  mode: 'procedural' | 'preset' | 'sequence';
};

export type CardPatterns = {
  currentIndex: number;
  currentId: string;
  patterns: CardPattern[];
};

export type ControlPayload = {
  brightness?: number;        // 0..1
  speed?: number;             // 0.25..4
  hueShift?: number;          // -128..128
  blackout?: boolean;
  next?: boolean;
  previous?: boolean;
  patternId?: string;
};

export type ControlEcho = {
  ok: boolean;
  brightness: number;
  speed: number;
  hueShift: number;
  blackout: boolean;
};

export class CardUnreachableError extends Error {
  reason: 'mixed-content' | 'offline' | 'timeout' | 'other';
  host: string;
  constructor(host: string, reason: CardUnreachableError['reason'], cause?: unknown) {
    super(`card ${host} unreachable: ${reason}`);
    this.host = host;
    this.reason = reason;
    if (cause instanceof Error) this.cause = cause;
  }
}

function cardBase(host: string): string {
  return `http://${host}.local`;
}

function isMixedContentBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
}

async function request<T>(host: string, path: string, init?: RequestInit): Promise<T> {
  const url = `${cardBase(host)}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    if (!r.ok) throw new CardUnreachableError(host, 'other');
    return (await r.json()) as T;
  } catch (err) {
    if (isMixedContentBlocked()) throw new CardUnreachableError(host, 'mixed-content', err);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new CardUnreachableError(host, 'timeout', err);
    }
    throw new CardUnreachableError(host, 'offline', err);
  } finally {
    clearTimeout(timeout);
  }
}

export function getCardStatus(host: string) {
  return request<CardStatus>(host, '/api/status');
}

export function getCardPatterns(host: string) {
  return request<CardPatterns>(host, '/api/patterns');
}

export function postCardControl(host: string, body: ControlPayload) {
  return request<ControlEcho>(host, '/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function postCardIdentify(host: string) {
  return request<{ ok: boolean }>(host, '/api/identify', { method: 'POST' });
}
