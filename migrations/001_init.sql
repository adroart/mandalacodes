-- Mandala Codes — D1 schema, v1
-- Apply via: wrangler d1 migrations apply mandalacodes-oracle --remote
--
-- Scope: accounts + hologenetic profile + collections. No orders or cart —
-- sales live on adrianrasmussen.com, not here.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_date TEXT NOT NULL,                   -- YYYY-MM-DD local
  birth_time TEXT NOT NULL,                   -- HH:MM local 24h
  birth_place_label TEXT NOT NULL,            -- "Denpasar, Bali, Indonesia"
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  tz_id TEXT NOT NULL,                        -- IANA zone, e.g. "Asia/Denpasar"
  computed_json TEXT NOT NULL,                -- HologeneticProfile JSON
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                         -- 'card' for v1; 'lightcode' / 'artwork' reserved for future decks
  ref TEXT NOT NULL,                          -- card number as string
  added_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (collection_id, kind, ref)
);
