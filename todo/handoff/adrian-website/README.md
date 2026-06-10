# Handoff → Adrian-Website

Files in this folder belong to the **Adrian-Website** repo, which owns the
shared `adrian-website` D1 schema (see `wrangler.toml` — both sites bind the
same database as `DB`, and the schema is only ever applied/evolved from that
checkout so the two repos never diverge).

## 003_atlas_legacy.sql

Copy into Adrian-Website's `migrations/` directory and apply from that repo:

```sh
wrangler d1 migrations apply adrian-website --remote
```

Additive only (two new tables + indexes; nothing altered or dropped — D1 has
no down-migrations). Until it is applied, the mandalacodes legacy endpoints
(`/api/atlas/steward/inscribe`, `/inscriptions`, `/export`,
`/api/atlas/inscriptions/erase`) degrade gracefully with a clear
`503 migration not applied`; everything else is unaffected. After it is
applied, the mandalacodes code assumes both tables exist behind the existing
`DB` binding.
