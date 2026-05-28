// Browser-side client for the Lightweaver relay API.
//
// The card and the customer browser talk through endpoints under /api/lw/*
// on this same site. The browser stores its pair binding in localStorage:
//   lw_relay_card_id    — the card UUID this browser is paired to
//   lw_relay_owner_token — auth token returned by the pair endpoint
// Multiple cards in one household: future work. v1 = one card per browser.

const CARD_ID_KEY = 'lw_relay_card_id';
const TOKEN_KEY = 'lw_relay_owner_token';
const LABEL_KEY = 'lw_relay_card_label';

export type RelayState = {
  id: string;
  label: string;
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

export type RelayCommand = {
  brightness?: number;
  hue?: number;
  saturation?: number;
  breathe?: boolean;
  drift?: boolean;
  blackout?: boolean;
  patternId?: string;
  speed?: number;
  hueShift?: number;
};

export function getBinding(): { cardId: string; ownerToken: string; label: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cardId = window.localStorage.getItem(CARD_ID_KEY) || '';
    const ownerToken = window.localStorage.getItem(TOKEN_KEY) || '';
    const label = window.localStorage.getItem(LABEL_KEY) || 'Lightweaver';
    if (!cardId || !ownerToken) return null;
    return { cardId, ownerToken, label };
  } catch {
    return null;
  }
}

export function setBinding(cardId: string, ownerToken: string, label: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CARD_ID_KEY, cardId);
    window.localStorage.setItem(TOKEN_KEY, ownerToken);
    window.localStorage.setItem(LABEL_KEY, label);
  } catch {
    /* quota — ignore */
  }
}

export function clearBinding() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CARD_ID_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(LABEL_KEY);
  } catch {}
}

export async function pair(code: string): Promise<{ cardId: string; ownerToken: string; label: string }> {
  const r = await fetch('/api/lw/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
  const j = await r.json();
  if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return { cardId: j.cardId, ownerToken: j.ownerToken, label: j.label || 'Lightweaver' };
}

export async function fetchState(): Promise<RelayState> {
  const b = getBinding();
  if (!b) throw new Error('not paired');
  const r = await fetch(`/api/lw/state/${b.cardId}`, {
    headers: { 'X-LW-Token': b.ownerToken },
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j.state as RelayState;
}

export async function postCommand(cmd: RelayCommand): Promise<void> {
  const b = getBinding();
  if (!b) throw new Error('not paired');
  const r = await fetch(`/api/lw/control/${b.cardId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-LW-Token': b.ownerToken },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
}
