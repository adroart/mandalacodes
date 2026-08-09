# Atlas Ledger API

> **Historical API, frozen 2026-08-09. Do not implement writes from this
> document.** Adrian-Website is the canonical collector system. Mandala Codes
> retains read-only Atlas and Universal Language kinship presentation. Its
> `GET /api/atlas` proxies the compatible public JSON at
> `https://adrianrasmussen.com/api/atlas` (overridable with the Pages variable
> `ATLAS_CANONICAL_URL`). `GET` and `HEAD` may continue through the Atlas route
> tree, `OPTIONS` receives a safe preflight response, and every other method
> under `/api/atlas` returns a machine-readable `410 atlas_moved` response.
>
> The old `mandalacodes-atlas` R2 objects are historical evidence only. They
> are not canonical and must never receive new ownership or ceremony writes.
> The configured live ledger key was absent at the freeze and the live public
> endpoint returned an empty state, so there was no data payload to invent or
> silently seed. The contract below is retained only as a record of the retired
> implementation.

This is the contract for the downstream agents who will implement the
Cloudflare Functions backing the `/atlas` page. The data layer (types,
projection, hashing) is already built. The endpoints below are not yet
implemented — this doc is the spec.

## Storage

**Retired storage model.** The keys in this section describe the system before
the 2026-08-09 move. Do not restore them as Mandala's source of truth.

All Atlas state lives in the existing R2 bucket bound as `MUSIC_BUCKET`
(same bucket as poems, just different keys):

| Key                  | Visibility | Purpose                                            |
|----------------------|------------|----------------------------------------------------|
| `atlas/ledger.json`  | server     | Append-only `LedgerEvent[]` (global, flat list).   |
| `atlas/stewards.json`| server     | `StewardRecord[]`, never served raw to clients.    |
| `atlas/public.json`  | server     | Cached `PublicAtlasState`, regenerated on writes.  |

The `atlas/ledger.json` is the source of truth. `atlas/public.json` is a
projection cache that the write endpoints regenerate after every append.
The mirror agent will additionally copy `atlas/public.json` to a public
GitHub repo for redundancy.

## Auth

Two cookie-based session types:

- `admin_session` — already implemented (`functions/api/admin/login.js`).
  Required for any admin endpoint. Value must equal `env.UPLOAD_SECRET`,
  same convention as the existing `poems.js` handler.
- `steward_session` — new. Set by `POST /api/atlas/steward/claim` after a
  successful key check. Scope is a single `(pieceId, editionNumber)` pair,
  encoded as a signed token. Expires after 30 days; refreshed on use.

Both cookies are `HttpOnly`, `Secure`, `SameSite=Lax`.

---

## Endpoints

### `GET /api/atlas`

Public, no auth. Cached for 60 seconds via `Cache-Control` header.

**Response 200**
```json
{
  "ok": true,
  "state": { /* PublicAtlasState */ }
}
```

Current implementation: proxy the canonical Adrian-Website endpoint and pass
through its status, headers, and JSON. Never fall back to Mandala R2. The old
R2 projection behavior described here was retired at the freeze.

---

### `POST /api/atlas/event`

Admin-only.

**Request body**
```json
{
  "event": {
    "id": "01HXXXX...",
    "pieceId": "ul-32",
    "editionNumber": 1,
    "type": "placed",
    "date": "2026-05-21T12:00:00.000Z",
    "cityId": "lisbon-pt",
    "note": "From Adrian's notebook, p.42",
    "actor": "admin"
  }
}
```

The body is `Omit<LedgerEvent, 'hash' | 'prevHash'>`. The handler:

1. Validates `cityId` against `data/cities.ts`.
2. Loads the existing chain for this `(pieceId, editionNumber)`.
3. Calls `utils/ledger.appendEvent(chain, event)` to compute the hashes.
4. Appends to the global `atlas/ledger.json`.
5. Re-projects and writes `atlas/public.json`.
6. Fires the GitHub-mirror queue (downstream agent).

**Response 200**
```json
{ "ok": true, "event": { /* fully-formed LedgerEvent with hash + prevHash */ } }
```

**Errors**
| Status | Reason                                              |
|--------|-----------------------------------------------------|
| 400    | Invalid JSON, unknown `cityId`, or invalid `type`.  |
| 401    | Missing or wrong `admin_session` cookie.            |
| 409    | Genesis event for a piece that already has a chain. |

---

### `GET /api/atlas/stewards`

Admin-only. Returns the steward roster for outreach management.

**Response 200**
```json
{
  "ok": true,
  "stewards": [
    {
      "pieceId": "ul-32",
      "editionNumber": 1,
      "name": "Maya",
      "email": "redacted@example.com",
      "notes": "Met at the Lisbon opening, Apr 2026",
      "keyHash": "[REDACTED]",
      "keyIssuedAt": "2026-04-15T18:00:00.000Z",
      "outreachStatus": "invited",
      "lastClaimAt": null
    }
  ]
}
```

`keyHash` is always replaced with the literal string `[REDACTED]` before
serialization, so this endpoint never exposes the hash even to admins
inspecting the response in DevTools. Hashes only ever appear server-side.

---

### `POST /api/atlas/stewards/issue`

Admin-only. Generates a new steward key for a piece.

**Request body**
```json
{
  "pieceId": "ul-32",
  "editionNumber": 1,
  "name": "Maya",
  "email": "maya@example.com"
}
```

The handler:

1. Calls `utils/stewardKey.generateStewardKey()`.
2. Calls `utils/stewardKey.hashStewardKey(rawKey)` and stores
   `StewardRecord` in `atlas/stewards.json`.
3. Returns the raw key ONCE in the response.

**Response 200**
```json
{
  "ok": true,
  "rawKey": "A3kf-9zPq-WxLm-7nQr",
  "warning": "This key will only be shown once. Print or copy it now."
}
```

**Errors**
| Status | Reason                                                 |
|--------|--------------------------------------------------------|
| 400    | Missing `pieceId`, or a steward already exists for it. |
| 401    | Missing or wrong admin cookie.                         |

---

### `POST /api/atlas/steward/claim`

Public. A collector submits their raw key to bind a session to their piece.

**Request body**
```json
{ "rawKey": "A3kf-9zPq-WxLm-7nQr" }
```

The handler:

1. Hashes the submitted key with `hashStewardKey`.
2. Looks up the matching `StewardRecord` by `keyHash`.
3. Sets `steward_session` cookie scoped to that `(pieceId, editionNumber)`.
4. Updates `lastClaimAt` and, if first claim, sets `outreachStatus = 'claimed'`.

**Response 200**
```json
{
  "ok": true,
  "piece": { /* PieceRecord */ }
}
```

**Errors**
| Status | Reason                          |
|--------|---------------------------------|
| 400    | Missing or malformed `rawKey`.  |
| 401    | No matching record (wrong key). |

---

### `POST /api/atlas/steward/update`

Requires `steward_session` cookie. The session's piece scope is the
authority — the body never re-asserts piece identity.

**Request body**
```json
{
  "cityId": "lisbon-pt",
  "isPublic": true
}
```

Either field is optional. Behavior:

- If `cityId` differs from the current state, the handler appends a
  `moved` event (or `placed` if the piece had no prior city).
- If `isPublic` is `false` and the piece is currently public, append a
  `withdrawn` event.
- If `isPublic` is `true` and the piece is currently withdrawn, append a
  `revealed` event.
- If neither field would produce a state change, return 200 with the
  unchanged record (no-op, no event appended).

`cityId` must be valid (`getCityById` returns a value). The `note` field
is never accepted from stewards — only admin events carry notes.

**Response 200**
```json
{ "ok": true, "piece": { /* updated PieceRecord */ }, "appended": [ /* events */ ] }
```

**Errors**
| Status | Reason                                              |
|--------|-----------------------------------------------------|
| 400    | Unknown `cityId`.                                   |
| 401    | Missing or expired `steward_session` cookie.        |
| 403    | Session piece scope does not match any chain.       |

---

## Implementation notes for the downstream agent

These notes are historical and are not instructions for current work. The
read-only middleware is the governing boundary.

- Mirror the structure of `functions/api/poems.js`: tiny helpers
  (`getCookie`, `isAuthed`, `readJson`, `writeJson`), then one exported
  `onRequest{Method}` per verb.
- All writes to `atlas/ledger.json` must be atomic-ish: read, mutate,
  write back in a single handler invocation. R2 has no transactions, but
  this is a low-write store and a single Worker request is the only writer.
- Always regenerate `atlas/public.json` AFTER updating `atlas/ledger.json`,
  not before, so a failed write doesn't leave a stale cache.
- Use `utils/ledger.verifyChain` after every append in dev/staging as a
  sanity check; gate it behind an env flag in production for performance.
