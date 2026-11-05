# Universal Language cross-project identity check

From an installed Mandala Codes checkout, run:

```sh
npm run verify:card-links -- /absolute/path/to/Adrian-Website
```

Use clean checkouts at the exact revisions being reviewed. The Artist checkout
is explicit so an old sibling checkout cannot silently become the reference.
The command imports code from that trusted local checkout. It does not fetch,
write either project, use credentials, query a database, or contact either site.

The check joins all 64 manuscript-derived and hosted cards to Mandala artwork
metadata, then to Artist catalogue IDs and image identities. It exercises the
actual artwork-link helper, Artist companion and return-context helpers, and
both numeric QR handlers for every card. Artist plaques retain the existing
legacy Oracle URL; Mandala's compatibility rule must point that URL to the
canonical reader. Archive order and catalogue ID suffixes are not card numbers.
Titles, prose, pricing, availability and editorial status are outside this check.

The ordinary unit suite runs synthetic mutation tests: missing or duplicate
identities, swapped artwork bindings, bad card destinations, broken return
context and the missing legacy redirect must fail. The cross-project command
requires both repositories and is deliberately separate from the unit suite.
Run it whenever either project's UL identity metadata or linking code changes.

This is source-level proof, not deployment proof. It does not decode exported
QR artwork, inspect image pixels, resolve CDN assets, exercise browser routing,
or test issued physical registry codes. Existing per-project corpus and browser
tests still apply. It covers the 64 canonical numeric plaque values, not malformed
inputs; Mandala's current QR handler also accepts numeric prefixes such as
`1junk` via `parseInt`. No public route is changed by this check.
