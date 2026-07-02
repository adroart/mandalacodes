# D1 migration hazard: shared `adrian-website` database, two repos

This doc exists because the setup below can silently corrupt a fresh
database with no error. Read it before running any `wrangler d1 migrations`
command against `adrian-website`.

## The hazard

- The `adrian-website` D1 database (binding `DB`, id
  `d0e93f04-203c-4dbd-945a-e14a9a364dd5`) is shared between this repo
  (mandalacodes) and the Adrian-Website repo.
- Both repos have their own `migrations/` directory pointed at the same
  database. D1 tracks which migrations have run in a `d1_migrations` journal
  table **keyed by filename**, not by content or by repo.
- Both repos independently define a file named `001_init.sql`, and the two
  files have **different content** (different tables). On a fresh database,
  whichever repo applies its migrations first "claims" the filename
  `001_init.sql` in the journal. The other repo's `001_init.sql` is then
  considered already-applied and is silently skipped, its tables are never
  created, and `wrangler` reports no error.
- The same collision risk exists for any future filename the two repos
  happen to reuse (e.g. `002_*.sql`), not just `001_init.sql`.

## Stated policy vs. reality

- `wrangler.toml` in this repo states the policy: Adrian-Website owns the
  schema, and migrations should be applied/evolved from that repo, not this
  one.
- Reality: this repo also has a `migrations/` directory
  (`migrations_dir = "migrations"`) targeting the same `adrian-website`
  database, and it does get used, most recently for
  `003_rate_limit.sql`. The policy is aspirational, not enforced by tooling.

## Safe operating rules

1. **Never apply migrations to a fresh `adrian-website` database** without
   first reconciling both repos' journals. Check what's already applied in
   each checkout before running anything.
2. **Never rename an already-applied migration file.** D1 matches by
   filename; a rename makes D1 think the migration hasn't run and reapplies
   it (which can fail on `CREATE TABLE` or duplicate data).
3. **Before applying any future migration, check both repos first:**
   ```bash
   wrangler d1 migrations list adrian-website --remote
   ```
   Run this from BOTH checkouts (mandalacodes and Adrian-Website) and
   confirm the filename you're about to add doesn't collide with one
   already used (or about to be used) in the other repo.

## Recommended long-term fix

Consolidate all migrations for the `adrian-website` database into one repo
(Adrian-Website, per the stated schema-ownership policy) and delete the
`migrations/` directory here once that's done.

Until that happens, give any new migration file in this repo a
repo-distinct name so a filename collision becomes impossible, e.g. prefix
mandalacodes-originated files clearly (`004_mandalacodes_*.sql`) rather than
reusing the plain sequential names both repos have used so far.
