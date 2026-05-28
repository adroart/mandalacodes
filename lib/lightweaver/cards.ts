// Tiny localStorage helper for tracking which Lightweaver cards the visitor
// has talked to. Stored as a JSON array under "lw_cards".

export type SavedCard = {
  host: string;            // bare hostname, no ".local" suffix
  label: string;           // free-form display name; defaults to host
  lastSeenAt: number;      // unix ms; we touch this on every successful fetch
};

const STORAGE_KEY = 'lw_cards';

function read(): SavedCard[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedCard =>
        entry &&
        typeof entry.host === 'string' &&
        typeof entry.label === 'string' &&
        typeof entry.lastSeenAt === 'number',
    );
  } catch {
    return [];
  }
}

function write(cards: SavedCard[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch {
    /* quota exceeded — fall through silently */
  }
}

export function sanitizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\.local\/?$/, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9-]/g, '');
}

export function getSavedCards(): SavedCard[] {
  return read().sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function rememberCard(host: string, label?: string): SavedCard {
  const clean = sanitizeHost(host);
  if (!clean) throw new Error('invalid host');
  const cards = read();
  const existing = cards.find((c) => c.host === clean);
  const now = Date.now();
  if (existing) {
    existing.lastSeenAt = now;
    if (label && label !== existing.label) existing.label = label;
    write(cards);
    return existing;
  }
  const next: SavedCard = {
    host: clean,
    label: label || clean,
    lastSeenAt: now,
  };
  write([...cards, next]);
  return next;
}

export function forgetCard(host: string) {
  const clean = sanitizeHost(host);
  write(read().filter((c) => c.host !== clean));
}
