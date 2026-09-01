# D1 migrations for `adrian-website`: one repo owns them

**This repo no longer has a `migrations/` directory, and its `wrangler.toml` no
longer names one.** Every migration for the shared `adrian-website` database
lives in the Adrian-Website repo. Add new ones there and apply them from there.

## Why it works this way

The `adrian-website` D1 database (binding `DB`, id
`d0e93f04-203c-4dbd-945a-e14a9a364dd5`) is used by both this site and
Adrian-Website. D1 records which migrations have run in a `d1_migrations`
journal **keyed by filename** — not by content, and not by repo. One database,
one journal, shared by whoever points at it.

So two repos with their own migrations against it is not a tidiness problem, it
is a correctness one: the first repo to use a filename claims it, and the other
repo's file of that name is then considered already applied and silently
skipped. Its tables are never created and `wrangler` reports no error.

That is not hypothetical. Both repos defined `001_init.sql` with different
content. Adrian-Website's ran; this repo's never did, and never could.

## What was done, 2026-09-01

- `002_better_auth.sql`, `003_rate_limit.sql`,
  `004_mandalacodes_oracle_reflections.sql` and
  `005_mandalacodes_oracle_invocations.sql` moved to
  `Adrian-Website/migrations/` **under their exact filenames**. The journal
  matches on the name, so keeping it is what makes them still count as applied.
  Renaming any of them would make D1 run them again.
- `001_init.sql` was deleted rather than moved. Adrian-Website's `001_init.sql`
  is a superset of it — the same users, profiles, collections and
  collection_items plus the cart and order tables — and it is the one that
  actually ran. Every column this repo's version declared was confirmed present
  in the live database before deleting it. It stays in this repo's git history.
- Both checkouts were checked afterwards: no migrations pending from either.

## Adding a migration now

Add the file in `Adrian-Website/migrations/`, apply it from that checkout, and
give it a name no existing file uses. If it is for a Mandala Codes feature, say
so in the name (`NNN_mandalacodes_*.sql`) so its origin stays readable.

The two rules that outlive this note: **never rename an applied migration**, and
**never give this database a second migrations directory.**
