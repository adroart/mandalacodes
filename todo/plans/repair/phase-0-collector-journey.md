# Phase 0: Close the collector journey (execution brief)

_Written 2026-07-10 against the audit in `todo/DEVELOPMENT-STATUS.md` (Part II section A
items 1 and 2, plus the ops gate in section 0). Every claim below was verified against the
actual code on this branch before writing. This brief is self-contained: a fresh agent can
execute it without reading the audit first._

## Goal

A real buyer can currently never arrive. When Adrian confirms a sale, or a holder or admin
approves a stewardship request, the piece's book is bound to the buyer's email but **no
message is ever sent to them**. And if a not-pre-registered person (gift recipient, auction
winner, secondary buyer) does find `/atlas/claim` on their own, they hit a dead-end that says
"send Adrian a note" with no link. This phase fixes both: (1) send a "your piece is ready to
claim" email from every hand-off endpoint, and (2) route the no-record visitor into the
self-serve stewardship request that already exists.

**Ops gate, read this before verifying anything live:** build, test, and merge proceed now.
Full live verification waits until Adrian runs `todo/handoff/GO-LIVE-RUNBOOK.md` (D1 tables
`atlas_sale_events` etc., plus the sale-webhook and claim-bridge secrets). Until then the
sale-confirm endpoint returns a graceful "migration not applied" error live, so its email can
only be exercised locally or in tests. One nuance in our favor: the `RESEND_*` email secrets
are **already live in production** (runbook decision record, 2026-07-02), and claim requests
live in R2 JSON, not D1, so the Task 1b/1c emails can be live-verified as soon as this
merges. Task 1a (sale confirm) cannot until the ops gate opens.

## Verified facts this brief stands on

- `functions/api/atlas/sales/confirm.ts`: admin confirms a pending sale. In all three
  branches (first sale via `issueStewardRecord`, unbound-record replace via
  `rebindStewardRecord`, secondary sale via `executeTransfer` + rebind) the buyer's email
  (`sale.buyer_email`) is written into the mutable steward record. Confirmed: **no notify
  call anywhere in the file.** The function ends by flipping the sale row to `confirmed`
  and returning JSON.
- `functions/api/atlas/steward/resolve-claim-request.ts`: the current holder approves or
  declines a routed request. On approval, `executeTransfer` rebinds the record to
  `claimRequest.requesterEmail` + `requesterRef` (their clerkUserId). Confirmed: **no
  notify call.**
- `functions/api/atlas/claim-requests/resolve.ts`: the admin's twin of the above (the audit's
  "or a holder/admin approves" parenthetical). Same shape, same silence. Include it; the
  fix is the same three lines.
- Email machinery exists and is proven: `functions/api/atlas/_email.ts` exports
  `sendLetterEmail(env, { to, subject, body })`, a fire-and-forget Resend sender
  (POST `https://api.resend.com/emails`, bearer `RESEND_API_KEY`, from
  `RESEND_FROM_EMAIL` or `noreply@mandalacodes.com`, plain text only). It swallows every
  failure (console.warn at most), no-ops silently when `RESEND_API_KEY` is unset, and is
  already called from `_letters.ts` and `steward/letters.ts` with the exact pattern
  `void sendLetterEmail(env as unknown as LetterEmailEnv, {...}).catch(() => undefined);`
  (the cast is required: `AtlasEnv` deliberately does not name the `RESEND_*` fields).
- The claim route is **`/atlas/claim`** (`App.tsx` line 108, component
  `components/atlas/StewardClaim.tsx`). Its Phase A endpoint
  (`functions/api/atlas/steward/claim.ts`) matches the signed-in user by bound
  `clerkUserId` OR by verified email against an unbound record
  (`findStewardsForUser(stewards, userId, email, emailVerified)`). So one link serves both
  sender cases: the sale buyer (email-only unbound record) and the approved requester
  (already bound by clerkUserId).
- `components/atlas/StewardClaim.tsx` lines 210 to 223: the `no-record` branch (rendered on
  a 404 from Phase A) says "If you hold one of Adrian's pieces, send him a note and he'll
  add you with this email address." Confirmed: **no link, no contact, no path onward.**
- The self-serve path already exists end to end: UI component `RequestStewardship` defined
  inline in `components/PiecePage.tsx` (lines 121 to 235), posting to
  `POST /api/atlas/steward/request-claim` (`functions/api/atlas/steward/request-claim.ts`,
  authenticated, body `{ pieceId, editionNumber?, note? }`, routes to holder or admin,
  deduped and rate-limited).
- The piece page's loudest button (`components/PiecePage.tsx` line 608, the CTA panel at
  lines 602 to 618) is "Open this piece's book" linking bare to `/atlas/claim`. The correct
  quiet path for non-pre-registered holders (`RequestStewardship`) sits directly below it as
  small text. A buyer who was never pre-registered clicks the loud button and lands exactly
  in the dead-end above. The audit is right on all counts.

---

## Task 1: send the "your piece is ready to claim" email

### 1.0 New copy helpers in `functions/api/atlas/_email.ts`

Add two exported functions beside `letterEmailSubject` / `letterEmailBody`, same
conventions (plain text, no HTML, no unsubscribe, middle-dot subject separator, and NEVER
an em-dash anywhere in copy or code, per project rule):

```ts
export type ClaimInviteKind = 'sale' | 'request-approved';

export function claimInviteEmailSubject(kind: ClaimInviteKind): string;
// 'sale'            -> 'Your piece has a living book · come claim it'
// 'request-approved' -> 'Your stewardship request was approved · the book opens to you'

export function claimInviteEmailBody(kind: ClaimInviteKind, pieceTitle?: string): string;
```

Body copy, **DRAFT, requires Adrian's voice sign-off before merge** (see the Needs Adrian
section; do not merge with this copy unapproved):

For `'sale'`:

```
The piece you now hold, {pieceTitle or "your piece"}, keeps a living book: its story,
its place on the map, the words it will carry forward.

That book is yours to open. Sign in with this email address, the one your piece was
registered to, and it will know you:

https://mandalacodes.com/atlas/claim

Only your city ever appears publicly, never an address, and you can keep the piece
entirely private. The book waits either way.

Adrian Rasmussen
```

For `'request-approved'`:

```
Your request to steward {pieceTitle or "this piece"} was approved. The book is open
to you now.

Sign in with this email address to complete the claim:

https://mandalacodes.com/atlas/claim

You will be asked one question about whether the piece appears on the public map.
Only your city ever shows, never an address, and private is always an answer.

Adrian Rasmussen
```

The claim URL is a constant; add `const CLAIM_PAGE_URL = 'https://mandalacodes.com/atlas/claim';`
next to the existing `STEWARD_PAGE_URL`.

Resolving `pieceTitle`: in the calling endpoints, look the piece up in `FULL_ARCHIVE`
(`data/mockData.ts`, already imported by `_letters.ts` in the same directory, so the import
path is proven safe for Pages Functions) and strip the trailing edition suffix the same way
PiecePage does (`art.title.replace(/\s*-\s*\d+$/, '')`), falling back to `undefined`.

### 1a. `functions/api/atlas/sales/confirm.ts`

After the sale row flips to `'confirmed'` (the final try/catch, before the closing
`return json({...})`), add the fire-and-forget send, exactly mirroring the `_letters.ts`
pattern:

```ts
void sendLetterEmail(env as unknown as LetterEmailEnv, {
  to: buyerEmail,
  subject: claimInviteEmailSubject('sale'),
  body: claimInviteEmailBody('sale', pieceTitle),
}).catch(() => undefined);
```

Notes:
- Import `sendLetterEmail`, the new helpers, and `type LetterEmailEnv` from `../_email`.
- Send in **all three** steward branches (the send sits after them, so it does naturally).
- Known acceptable duplicate: case 2a is a confirm retry, so a retried confirm re-sends.
  These are rare admin actions; do not build dedupe state for it. Document it in a comment.
- The send must never affect the response: no await on the result, no throw path (the
  helper already swallows everything; the `void ... .catch()` is belt and braces, same as
  `_letters.ts` line 121).

### 1b. `functions/api/atlas/steward/resolve-claim-request.ts`

Only on the **approve** path, and only after `executeTransfer` succeeds (i.e. after the
`if (outcome instanceof Response)` revert block, still inside `if (approve && transferKind)`):

```ts
void sendLetterEmail(env as unknown as LetterEmailEnv, {
  to: claimRequest.requesterEmail,
  subject: claimInviteEmailSubject('request-approved'),
  body: claimInviteEmailBody('request-approved', pieceTitle),
}).catch(() => undefined);
```

Declines send nothing (out of scope; the audit asks only for the ready-to-claim notice).

### 1c. `functions/api/atlas/claim-requests/resolve.ts`

Same as 1b: on approval only, after whichever branch succeeded (bound transfer or unbound
bind, i.e. just before the final `return json({ ok: true, request: stamped.result, steward })`),
send to `claimRequest.requesterEmail` with kind `'request-approved'`.

### Task 1 acceptance checks

- `npm run typecheck` passes (CI enforces it; the build alone is not enough).
- `npm run test:unit` passes; extend `tests/unit/letterEmail.test.ts` with coverage for
  `claimInviteEmailSubject` and `claimInviteEmailBody` (both kinds, with and without a
  title) mirroring the existing letter-email tests.
- Grep proof: each of the three endpoints contains exactly one `sendLetterEmail` call, and
  none of them `await` it on the response path.
- No em-dash character exists in any added copy or code.

---

## Task 2: un-dead-end the no-record visitor and fix the piece page funnel

### 2.0 Extract `RequestStewardship` to a shared component

Move the inline `RequestStewardship` component out of `components/PiecePage.tsx` (lines
121 to 235) into a new file `components/atlas/RequestStewardship.tsx`, unchanged in
behavior (props `{ pieceId: string; editionNumber?: number }`, posts to
`/api/atlas/steward/request-claim`, sign-in trigger for anonymous visitors, note textarea,
sent confirmation). Update PiecePage to import it. This is a structural edit: **restart the
Vite dev server afterwards**, HMR and hard reload both serve stale code (project rule).

### 2a. `components/atlas/StewardClaim.tsx`: give the no-record branch a real path

Add piece context to the route: support `?piece=<pieceId[:edition]>` on `/atlas/claim`.
Parse it from the existing `useSearchParams()` (already imported): split on `:`, edition is
optional and numeric. Then rework the `no-record` branch (currently lines 210 to 223):

- **With piece context:** keep the first line ("We don't have a piece bound to {email}
  yet.") then, instead of the "send Adrian a note" paragraph, render the shared
  `<RequestStewardship pieceId={...} editionNumber={...} />` form with a one-line lead-in,
  copy DRAFT: "If this piece came to you another way, an auction, a gift, an inheritance,
  request stewardship here and the current keeper, or Adrian, will approve it."
- **Without piece context:** no form to render (a request needs a pieceId), so give real
  directions instead of a dead-end, copy DRAFT: "If you hold one of Adrian's pieces,
  scan the code on its back, or find it on the map, and request stewardship from the
  piece's own page." with a link to `/atlas` (label: "Find it on the map →"). Keep the
  existing first line about the unbound email so the visitor understands why the lookup
  came up empty.

Do not change the Phase A / consent / ceremony logic; the query param must be ignored by
every branch except `no-record` (and must not break the existing dev-only
`?ceremony=` rehearsal param).

### 2b. `components/PiecePage.tsx`: stop funneling buyers into the wall

Two changes in the CTA panel (lines 602 to 618):

1. **The loud button carries the piece.** Change the primary "Open this piece's book" link
   from bare `/atlas/claim` to
   `` `/atlas/claim?piece=${encodeURIComponent(piece.pieceId)}${typeof piece.editionNumber === 'number' ? `:${piece.editionNumber}` : ''}` ``
   so that even the visitor who clicks the loud button and turns out to be unregistered
   lands on the recovery form from 2a, not a wall. Add a small caption line under the
   button, copy DRAFT: "Sign in with the email your piece was registered to."
2. **Promote the quiet path from footnote to visible alternative.** Keep
   `RequestStewardship` below the primary button but give its collapsed state equal
   footing as a labeled second path rather than an aside: render its lead-in as a full
   sentence row separated by a subtle divider, copy DRAFT: "Came to it another way?
   An auction, a gift, an inheritance:" followed by the existing
   "Request stewardship →" trigger. No new visual system, reuse the existing font-label
   and bronze link classes already in the component. Visual judgement calls here are
   flexible; the non-negotiable is that both paths are visible without scrolling past
   the panel and the reader can tell which one is theirs.

Also update the not-found branch link at PiecePage line 318 only if trivial (it links bare
to `/atlas/claim`; there is no piece context there, so leaving it is correct, the 2a
no-context copy now handles it).

Leave `components/atlas/SeekingGround.tsx` (also links bare to `/atlas/claim`) alone; the
2a no-context fallback covers it, and per-piece deep links there are a separate audit item
(Part II C11), out of scope.

### Task 2 acceptance checks

- `npm run typecheck` passes.
- Restart the dev server (`npm run dev`, port 2222; kill duplicate servers on 2222/2223/2224
  first), then walk these flows in the browser. Note: `npm run dev` (Vite only) does not run
  the Pages Functions API; use `npm run dev:full` (wrangler pages dev) when a flow needs the
  real endpoints.
  1. Signed in with an email that has no steward record, visit
     `/atlas/claim?piece=<any archive pieceId>`: the request-stewardship form renders, and
     submitting creates a pending request (verify via the AdminAtlas requests queue or the
     API response).
  2. Same account, visit bare `/atlas/claim`: directions plus the "Find it on the map"
     link render; the words "send him a note" no longer appear anywhere in the component.
  3. Visit `/piece/<pieceId>`: the primary CTA href includes `?piece=`, both paths are
     visible in the panel.
  4. Regression: a pre-registered unbound email still claims normally through Phase A and
     the consent step (this must be untouched).
- Per project rule, the report for this work links the live clickable dev-server URL for
  each changed surface, with the server left running; a screenshot is backup only.

---

## Verification (whole phase)

1. `npm run typecheck` (mandatory before push; CI rejects otherwise, and the build passing
   is not sufficient).
2. `npm run test:unit` (vitest; must stay green, with the new letterEmail coverage).
3. Restart the Vite dev server after the structural edits (component extraction, new file);
   HMR serves stale code in this repo.
4. Browser walkthroughs from Task 2 acceptance checks, on the freshly restarted server.
5. Email sends cannot be observed locally without a `RESEND_API_KEY` in the dev env; the
   helper silently no-ops. Local proof is the unit tests plus a temporary console.log or a
   dev key; do not ship a real key or any logging of addresses.
6. Merge to main auto-deploys to mandalacodes.com in about 2 minutes. **Live verification
   split:** Task 2 and the Task 1b/1c approval emails are fully live-verifiable right after
   merge (claim requests live in R2, `RESEND_*` is already set in production). Task 1a's
   sale-confirm email stays dormant behind the ops gate: `atlas_sale_events` does not exist
   live until Adrian runs `todo/handoff/GO-LIVE-RUNBOOK.md` steps 1 and 2 (D1 migrations,
   `SALE_WEBHOOK_SECRET` + `CLAIM_BRIDGE_SECRET` on both Pages projects). Do not report
   the sale hand-off as live-verified until after that runbook has run; report it as
   "built, merged, awaiting ops gate".

## Needs Adrian

1. **Voice sign-off on all DRAFT copy before merge:** the two email subjects and bodies
   (Task 1.0), the no-record lead-in and no-context directions (2a), the CTA caption and
   the promoted second-path lead-in (2b). Everything above marked DRAFT is placeholder
   scaffolding in his register, not final prose.
2. **Ops gate (unchanged, tracked elsewhere):** run `todo/handoff/GO-LIVE-RUNBOOK.md`
   steps 1 and 2 (D1 tables, both secrets), plus the Adrian-Website sale sender (step 5),
   so the sale hand-off end of this phase goes live. Build and merge do not wait on this.
3. **One live smoke test after the ops gate:** confirm a real (or test) sale in the admin
   queue and verify the buyer email arrives and its link completes a claim.
