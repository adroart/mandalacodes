# A letter to the person who comes next

> **Read this first, system moved 2026-08-09.** The canonical collector record
> now lives with Adrian-Website. Mandala Codes still presents the Atlas and the
> Universal Language kinship, but it is read-only: its public Atlas endpoint
> reads `https://adrianrasmussen.com/api/atlas`, and middleware rejects every
> ownership or ceremony mutation under `/api/atlas` with `410 atlas_moved`.
> The `mandalacodes-atlas` R2 objects described below are historical evidence
> only. Never resume writes to them or treat them as canonical.
>
> At the freeze, the configured production ledger key was absent and the live
> public Atlas response was empty. No collector history was guessed, generated,
> or seeded during the move. If old objects are discovered later, preserve them
> unchanged and reconcile them manually against Adrian-Website.

If you are reading this, Adrian has either passed the stewardship of this work
to you, or circumstances have done it for him. Either way: welcome. The system
you are inheriting is intentionally small, heavily documented, and built to
survive neglect. Read this once slowly. None of it is urgent today, but all of
it matters when something breaks or when a collector calls.

---

## What this is

The Atlas is the living history system for every piece of physical art that has
left Adrian Rasmussen's studio. Each piece carries an append-only,
cryptographically chained record — a book that only ever grows longer. A
collector who buys a mandala can claim stewardship of their piece's book, write
into it, and download the whole thing at any time. The QR code printed on the
certificate is the door into that book.

The short version of the "forever" promise: *a record that travels with the
piece and that the holder can always export and keep themselves, independent of
any server or vendor.* The printed certificate is page one. The living record is
everything after it.

---

## Where everything lives

**Canonical collector system: Adrian-Website** — registration, ownership,
ceremony, and all future collector record changes belong there. Its public
`/api/atlas` JSON is the source Mandala reads. Start in that repository for any
collector-system repair or evolution.

**Mandala Codes Cloudflare project** — this project hosts the read-only Atlas
and Universal Language kinship presentation. Keep it running for those public
surfaces, but do not use it to mutate collector state. The optional Pages
variable `ATLAS_CANONICAL_URL` may point reads at an Adrian-Website preview;
it defaults to `https://adrianrasmussen.com/api/atlas`.

**Historical R2 bucket: `mandalacodes-atlas`** — frozen 2026-08-09. These
objects are evidence from the retired system, not live mutable state:

| Key | What it holds |
|---|---|
| `atlas/ledger.json` | Historical append-only hash chain, if present. Not the current source of truth. |
| `atlas/stewards.json` | The private collector roster. Names, emails, consent records, heir hints. Never make this public. |
| `atlas/public.json` | A regenerated projection of what may be shown on the website. Built automatically; never edit by hand. |
| `atlas/claimRequests.json` | Pending self-serve stewardship requests (secondary sales, gifts, inheritance). |
| `atlas/letters.json` | Letters the pieces write back to their stewards — kin-claim notifications, anniversaries, transfer welcomes. |

Do not write, regenerate, or restore these objects into service. `public.json`
(and only `public.json`) was eligible for the historical public GitHub mirror.
Ledger events contain opaque IDs, never names or emails — but `stewards.json`
contains real contact information. Never let it leave the bucket.

**Shared D1 database: `adrian-website`** — historically, Mandala used this
database for two legacy Atlas tables. The read-only boundary now prevents
Mandala Atlas handlers from mutating them:

- `atlas_inscriptions` — the mutable, erasable bodies of Ring 1 legacy entries.
  The chain holds only a salted commitment; the body itself lives here and can
  be deleted to honour a legal erasure request without touching a single hash.
- `atlas_sale_events` — the incoming-sale queue from adrianrasmussen.com. Raw
  sale payloads (including buyer email and price) land here pending admin
  confirmation. Buyer identity and price are D1-only; they never reach the hash
  chain or public state.

The D1 schema is owned by the Adrian-Website repo. If you ever need to evolve
it, add a migration file in that repo's `migrations/` directory and apply it
from that checkout with `wrangler d1 migrations apply adrian-website --remote`.

**Cloudflare Pages + Functions** — the site itself is a Vite/React app. The
`/functions/api/` tree is Cloudflare Pages Functions (edge workers). You do not
need to understand the code to keep the system running; you only need to know
where things are.

**Authentication (Better Auth)** — Mandala authentication still supports its
remaining non-Atlas surfaces. Atlas collector and admin write access on this
site is retired regardless of credentials because the middleware blocks every
mutation before a route handler runs.

---

## The hash chain and how to verify it

Every event in `atlas/ledger.json` has three fields that form the chain:

- `hash` — SHA-256 of the canonical (sorted-keys) JSON of the event itself,
  minus the `hash` field.
- `prevHash` — the `hash` of the immediately preceding event in the same piece's
  chain, or `null` for the first event.

Because `prevHash` is included in the hashed payload, you cannot change any
historical event without breaking every subsequent hash in that chain. A broken
chain is detectable instantly.

To verify a chain programmatically, call `verifyChain` from `utils/ledger.ts`.
It recomputes every hash and returns `{ ok: true }` or `{ ok: false, brokenAt,
reason }`. The unit tests in `tests/unit/ledger.test.ts` exercise this function
exhaustively — run them with `npm run test:unit` to confirm the implementation
is sound before touching any data.

Events are grouped per `(pieceId, editionNumber)` pair by `groupChains`; each
group is an independent chain. The genesis event of each chain has `prevHash:
null`.

**The verification guarantee is only as strong as the mirror.** The R2 bucket
is mutable storage — someone with admin access could rewrite `ledger.json` and
recompute all hashes. The GitHub mirror (when active) turns every `public.json`
write into a commit, and the commit history is the actual tamper evidence:
`public.json` carries a `chainTips` map (`pieceId:edition` → the last event's
hash for every publicly visible chain), so a rewritten chain shows up as an
unexplained tip change in the commit log. If the mirror is disabled,
verification still catches accidental corruption or software bugs; it does not
catch a deliberate rewrite by an admin.

---

## THE CHAIN CONTENT INVARIANT — read this carefully

**No personal data ever enters a hashed payload. Ever.**

Names, email addresses, free text, birth dates, photos — none of these may
appear in any field that is included in a `LedgerEvent`'s hash. The chain
carries only:

- opaque IDs (`pieceId`, `actorRef` = an auth userId, `inscriptionId`)
- event types and dates
- city IDs (from a curated ~99-city centroid catalog — never GPS coordinates)
- salted content commitments (`SHA-256(salt + body)`, where the salt is stored
  beside the body in D1 and deleted with it on erasure)

The reason this matters: the chain is immutable and the GitHub mirror archives
it indefinitely via the Software Heritage Foundation. Anything personal that
enters the chain is, for practical purposes, unerasable globally. The GDPR
erasure mechanism (deleting a body + its salt from D1, leaving a tombstone in
the chain) works *precisely because* the chain never held the body — only an
unlinkable commitment to it.

**The old version of this document said "mirror the full ledger." That must
never happen.** Only `public.json` may be mirrored. The current code already
enforces this; the old guidance was wrong.

If you ever add a new event type or extend the data model, ask yourself: does
this new field hold information about a person? If yes, it goes in mutable
storage (steward record, D1 table), not in the chain.

---

## Stewards, consent, heirs, and transfers

**Stewards** are collectors who have claimed a piece. Each steward record in
`stewards.json` holds their email (from the pre-issued admin record), their
bound auth userId (set at first claim), consent history, heir hints, and
outreach status. The outreach status follows a path:
`no-contact → invited → claimed → declined`.

**Consent** is captured once at claim and is mutable and revocable. The claim
screen asks one active question (Ring 2: "Place your piece as a light on the
world map?"). Rings 3 and 4 are recorded as `deferred` at claim and opened
later from the piece's book. Consent is versioned (`CONSENT_VERSION` in
`types.ts`) and every change is appended to a `consentHistory` audit list on
the steward record. Consent never enters the hash chain — Ring 2 maps onto the
existing `withdrawn`/`revealed` event semantics.

**Heirs** are hints stored on the steward record. A collector can register an
heir's email and name so the executor knows where to hand the piece on. These
are hints for the human who handles the estate — they are never auto-binding
credentials. Activating an heir is always a mediated `transferred` event, never
an automatic step.

**Transfers** are the only legitimate way to move a bound piece from one
steward to another. Every transfer is recorded as a `transferred` event in the
chain, carrying opaque `fromRef` and `toRef` auth userIds (or a deterministic
`sale:{saleId}` ref when the buyer hasn't signed in yet). The chain carries no
name, no email, no price. Price and buyer identity live in `atlas_sale_events`
in D1 only.

**Rebinding a claimed piece outside a `transferred` event is not allowed.** If
a dispute arises, the Adrian-Website sale record is the evidence; the artist (or
successor) adjudicates; resolution is always a `transferred` event, never a
silent edit to the steward record.

---

## The holder export as the continuity mechanism

Every steward can download their piece's full book: signed JSON plus a
print-styled PDF. This export is the ground-level continuity guarantee. Even
if the domain lapses, the Cloudflare account closes, and GitHub is decommissioned
fifty years from now, a steward who exported their book on the day of purchase
still holds a complete, cryptographically verifiable record of their piece's
history.

The printed certificate reinforces this: it carries piece identity, edition,
first provenance, and a human-readable code as a QR-wear fallback, plus a
printed line telling a future heir that the living record exists and how to
reach it.

This is what "forever" actually means in this system: exportability, the
printed artifact, and the public mirror, combined. Not a promise that any given
server will run forever.

---

## How to back up

This is now an evidence-preservation procedure, not a live-state backup or a
restore path.

The backup script is at `scripts/backup-atlas.ts`. Run it with:

```bash
npm run backup:atlas
```

This fetches all five atlas objects (`ledger.json`, `stewards.json`,
`public.json`, `claimRequests.json`, `letters.json`) from the production
`mandalacodes-atlas` bucket into a gitignored `backups/atlas-<timestamp>/`
directory via `wrangler r2 object get --remote`; `ledger.json` and
`stewards.json` are required (a missing one errors out the script),
the other three are optional and skipped with a note if not yet created.
You need a wrangler login with access to the bucket first (`npx wrangler
login`).

Do not seed missing objects in order to make this script succeed. If historical
objects are present, move long-term copies to
artist-controlled offline storage — the `backups/` folder is gitignored and
must never be committed, as `stewards.json` and `claimRequests.json` contain
collector contact information.

---

## The secrets that matter

| Secret | Where | What it does |
|---|---|---|
| `BETTER_AUTH_SECRET` | Cloudflare Pages env, encrypted | Signs and verifies the self-owned session in every authenticated Function |
| `BETTER_AUTH_URL` | Cloudflare Pages env, plaintext | Deployed origin used for session cookies and OAuth callbacks |
| `ADMIN_EMAILS` | Cloudflare Pages env, plaintext | Comma-separated list of admin email addresses |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Cloudflare Pages env, encrypted | Google OAuth sign-in |
| `RESEND_API_KEY` | Cloudflare Pages env, encrypted | Sends the email sign-in code |
| `SALE_WEBHOOK_SECRET` | Cloudflare Pages env, encrypted, **both projects** | HMAC-SHA256 verification for the adrianrasmussen.com sale webhook |
| `GITHUB_MIRROR_TOKEN` | Cloudflare Pages env, encrypted | Fine-grained PAT with Contents: Read/Write on the mirror repo |
| `GITHUB_MIRROR_REPO` | Cloudflare Pages env, plaintext | `owner/repo` of the public mirror repository |
| `GITHUB_MIRROR_PATH` | Cloudflare Pages env, plaintext | Path inside the mirror repo (e.g. `atlas/public.json`) |

The sync script is `scripts/sync-secrets-to-cloudflare.sh` via Infisical. See
`docs/secrets-sync.md` for the full procedure.

`SALE_WEBHOOK_SECRET` must be set on **both** Pages projects (adrianrasmussen.com
signs, mandalacodes verifies). Until it is set, `/api/atlas/sale` returns 503.

The GitHub mirror vars are the activation switch for the durability mirror.
Until all three are set, the mirror silently no-ops. Making the mirror active
turns every `public.json` write into a permanent, dated commit on GitHub — this
is what provides external tamper evidence.

---

## What to do if you are inheriting this system

Here are the steps, in order:

1. **Start with Adrian-Website.** Verify its canonical collector system and
   public `/api/atlas` response before investigating Mandala's presentation.

2. **Get access.** Adrian's password manager holds the Cloudflare account
   credentials and the Infisical master key. His estate or literary executor
   is the fallback.

3. **Preserve historical evidence.** After getting access, run
   `npm run test:unit` to
   confirm the local utilities are sound. Then download the current
   `atlas/ledger.json`, if one exists, with `npm run backup:atlas`. Keep the
   original unchanged. Verification can establish internal chain integrity,
   but it does not make the old object canonical.

4. **Update the auth config only for remaining Mandala surfaces.** Sign-in is
   self-owned Better Auth, configured by
   the `BETTER_AUTH_*`, `GOOGLE_*`, and `RESEND_*` environment variables on the
   Cloudflare Pages project (no third-party auth dashboard). To manage Google
   sign-in you need access to the Google Cloud OAuth client; everything else is
   controlled by those Pages env vars.

5. **Check the GitHub mirror.** If `GITHUB_MIRROR_*` is set, confirm the mirror
   repository is still public. Do not delete it. As long as it is public, the
   Software Heritage Foundation archives it.

6. **Treat old Atlas integration secrets as historical.** Do not restore a
   Mandala sale queue or rotate credentials as a way to re-enable Atlas writes.
   Manage current collector integrations from Adrian-Website.

7. **Back up the R2 objects.** Run `npm run backup:atlas` and move the output
   to offline storage before making any structural change.

8. **Document your own handover.** Update this file. It is part of the
   definition of done for every auth or infrastructure change.

---

## What not to do

- Never remove or bypass `functions/api/atlas/_middleware.ts` to revive old
  write endpoints. Ownership and ceremony writes belong on Adrian-Website.

- Never rewrite history. Every event references the one before it by hash.
  Changing a past event invalidates every hash after it. Rewriting R2 and
  recomputing hashes is technically possible — the GitHub mirror commit history
  is the external evidence that this has not happened.

- Never edit `atlas/ledger.json` by hand or restore it into the live read path.
  Preserve any recovered object byte-for-byte as historical evidence.

- Never mirror anything except `public.json`. The ledger and steward files
  contain or reference personal data. The current code in `_mirror.ts` mirrors
  only the public state JSON; do not change this.

- Never put personal data into a chain event. See the Chain Content Invariant
  section above. This is the most important rule in the whole system.

- Never auto-bind an heir or auto-confirm a sale to the ledger. Transfers are
  always an explicit admin action. A forged webhook can at worst enqueue a
  pending row; it cannot grant stewardship.

---

That is the whole document. Thank you for keeping it alive.
