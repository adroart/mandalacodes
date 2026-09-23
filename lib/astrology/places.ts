export interface Place {
  /** Display label, e.g. "Denpasar, Bali, Indonesia". */
  label: string;
  lat: number;
  lng: number;
  /** IANA timezone id at the time of birth (e.g. "Asia/Denpasar"). */
  tzId: string;
}

type CitiesIndex = ReadonlyArray<{
  name: string;
  admin?: string;
  country: string;
  cc: string;        // ISO-3166 alpha-2
  lat: number;
  lng: number;
  tz: string;        // IANA id
}>;

let _index: CitiesIndex | null = null;
let _indexLoad: Promise<CitiesIndex> | null = null;

/**
 * Lazy-load the bundled cities dataset on first use. Served as a static
 * asset from /data/cities-index.json so it cache-busts independently of
 * the JS bundle.
 */
async function loadCitiesIndex(): Promise<CitiesIndex> {
  if (_index) return _index;
  if (!_indexLoad) {
    _indexLoad = fetch('/data/cities-index.json')
      .then((r) => {
        if (!r.ok) throw new Error('City search is unavailable. Check your connection and try again.');
        return r.json();
      })
      .then((data: CitiesIndex) => {
        if (!Array.isArray(data)) throw new Error('City search is unavailable. Try again.');
        _index = data;
        return data;
      })
      .catch(() => {
        _indexLoad = null;
        throw new Error('City search is unavailable. Check your connection and try again.');
      });
  }
  return _indexLoad;
}

/**
 * Fold a string to lowercase ASCII so an accent-free query still matches
 * accented city names — "reykjavik" finds "Reykjavík", "sao paulo" finds
 * "São Paulo". NFD splits accented chars into base + combining mark, then
 * we drop the combining marks (Unicode range U+0300–U+036F).
 */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Typeahead search across the bundled cities index. Returns up to `limit`
 * matches, ranked by relevance so the obvious intended city surfaces even
 * when a larger same-named city exists elsewhere ("Santa Cruz" should not
 * bury Santa Cruz, California behind eight foreign ones).
 *
 * The index is population-sorted, so equally-relevant matches keep that
 * order (bigger city first) as a natural tiebreaker. Accent-insensitive.
 */
export async function searchPlaces(query: string, limit = 8): Promise<Place[]> {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  // Split into words so "Santa Cruz, California" matches a row whose city is
  // "Santa Cruz" and whose admin is "California" — the old whole-string match
  // failed because the comma is never a substring of "santa cruz california".
  // Commas and extra spaces are just separators.
  const tokens = q.split(/[\s,]+/).filter(Boolean);
  const idx = await loadCitiesIndex();

  type Scored = { place: Place; score: number; order: number };
  const scored: Scored[] = [];

  for (let i = 0; i < idx.length; i++) {
    const c = idx[i];
    const name = fold(c.name);
    const full = fold(`${c.name} ${c.admin ?? ''} ${c.country}`);
    // Every word the visitor typed must appear somewhere in the row.
    if (!tokens.every((t) => full.includes(t))) continue;

    // Higher score = better match. City name beats incidental admin/country
    // hits; exact and prefix matches beat mid-word substring matches. Scored
    // on the FIRST token (the city the visitor leads with).
    const first = tokens[0];
    let score = 0;
    if (name === q) score = 100;                // exact full city name
    else if (name === first) score = 95;        // exact city, plus region typed
    else if (name.startsWith(first)) score = 80; // "santa cr" -> Santa Cruz
    else if (name.includes(first)) score = 60;   // query inside the city name
    else score = 20;                            // matched only via admin/country
    // A second token that lands in the admin/country (the region) is a strong
    // signal the visitor disambiguated — lift those above same-named rivals.
    if (tokens.length > 1) {
      const rest = fold(`${c.admin ?? ''} ${c.country}`);
      if (tokens.slice(1).every((t) => rest.includes(t))) score += 15;
    }

    scored.push({
      place: {
        label: [c.name, c.admin, c.country].filter(Boolean).join(', '),
        lat: c.lat,
        lng: c.lng,
        tzId: c.tz,
      },
      score,
      order: i, // dataset index = population rank; lower is bigger
    });
  }

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.place);
}

/**
 * Convert a local (date, time, IANA tz) tuple to a UTC moment.
 *
 * Uses `Intl.DateTimeFormat` to read the offset that the host's IANA db
 * believes was in effect at that local moment, then walks back the
 * difference. This handles historical DST changes because the host
 * timezone db is the modern IANA db.
 */
export function placeToUtc(dateStr: string, timeStr: string, tzId: string): Date {
  // Pretend the local date+time is already UTC so we can construct a Date.
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  // Find the UTC offset (in minutes) that `tzId` had at this naive moment.
  // We probe once, then refine — the offset itself can shift by an hour
  // on DST days, but two passes is enough to converge.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tzId,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const partsToUtc = (epochMs: number): number => {
    const parts = fmt.formatToParts(new Date(epochMs));
    const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    let yr = get('year');
    const mo = get('month');
    const da = get('day');
    let hr = get('hour');
    const mi = get('minute');
    const se = get('second');
    // Intl returns "24" for midnight on some platforms — normalise.
    if (hr === 24) hr = 0;
    return Date.UTC(yr, mo - 1, da, hr, mi, se);
  };

  // First pass: how does the IANA db interpret `naiveUtcMs`?
  let utcMs = naiveUtcMs;
  for (let i = 0; i < 2; i++) {
    const offsetMs = partsToUtc(utcMs) - utcMs;
    utcMs = naiveUtcMs - offsetMs;
  }
  return new Date(utcMs);
}

