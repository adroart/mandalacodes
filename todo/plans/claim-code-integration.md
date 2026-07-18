# The claim code and the QR surface: full integration plan

Status: authored 2026-07-18 by Fable from a complete infrastructure map of the
claiming and QR systems (file-cited, summarized in Part I) and Adrian's
rulings (the code lives on the piece's pull-out back insert; the visible QR
is the public pointer; no Google branding anywhere; possession is the
credential, made physical). Two build agents are implementing Parts III.1
and III.2 as this is written; the remaining parts are sequenced after them.

The one-breath intention: every piece carries two truths on its back. The
visible QR tells the world where the piece lives and shows its certificate.
The hidden code, on the insert the keeper pulls out, is the key that lets
whoever truly holds the piece bring their dream into it.

---

## Part I: The system as it exists (ground truth)

What is physically minted today:
- Oracle deck cards: QR encoding `/qr/:number` (1 to 64), redirecting to
  `/universal-language/:n?ref=qr`. Generator: `scripts/generate-ul-qr.ts`
  via `npm run generate:qr`, emitting SVG plaques and card layers from
  public data only.
- Artwork pieces: QR encoding `/qr/piece/:pieceId[/:edition]`, redirecting
  to `/piece/...?ref=qr` (the certificate). The QR carries ONLY the public
  pieceId. In-code rationale: "The QR is a pointer, never a credential."
  The indirection exists so destinations can change without reprinting.

How a claim authorizes today (all paths bind a Better Auth userId onto a
steward record in R2 `atlas/stewards.json`, keyed per piece and edition):
- Phase A bind (`steward/claim.ts`): signed in AND verified session email
  matches a pre-issued unbound record, or the record is already bound to
  this user. No code, no token.
- Issue (`stewards/issue.ts`): admin creates the record from piece + email.
  Also seeded by sale confirmation. "The issued email is the real
  credential" is the documented current model.
- Claim bridge: HMAC machine channel from the art site; opens a pending
  request only, binds nothing.
- Request-claim and homecoming: verified session opens a request; a human
  (the bound holder or Adrian) resolves; binding only via the audited
  resolve/transfer machinery.

The security envelope the codebase itself sanctions for a physical code
(living-art-legacy.md slop tests): any claim secret is at least 128 bits,
per piece, out of band from the public QR, single use; recovery is an
account operation, never a chain edit; a claimed piece can never be
silently rebound; the printed QR is never treated as a bearer credential
(a gallery visitor can photograph it).

What does not exist yet: any per-piece claim code or token, any printed
secret, any code field on steward records, any back-insert print artifact.

## Part II: The ruled target

- The back of each piece carries: (a) the visible public QR plaque
  (unchanged, points at the certificate), and (b) the claim code printed on
  the pull-out insert, as a human-typable code AND a private QR deep link
  carrying the same code, so the keeper can scan instead of type.
- Claiming: certificate, Begin, "the code from the back of your piece",
  then the account anchor spoken as "Where should your book reach you?"
  (email code first; google as a quiet lowercase text line, no icon, on
  every sign-in surface site wide).
- Codes: 128 bit crockford base32, stored as hash only, single use,
  reissuable while unclaimed (reissue invalidates), inert after claim.
- Legacy pieces in the field keep the existing paths (email match, request,
  homecoming). Codes enter the field only on pieces that pass through
  Adrian's hands: new sales, reissues, and any piece he retrofits.

## Part III: The integration, in order

### III.1 The keeper's layer (building now, agent A)
The certificate opens further for the authenticated bound keeper: "For the
keeper" beneath the seal with the acquisition line from the confirmed sale
record, the full sanitized history, and the door to the book. Private
endpoint, no-store, price never public. Independent of the code work.

### III.2 The code machinery and the claim flow (building now, agent B)
- `utils/claimCode.ts`: generate, normalize (case and ambiguity forgiving),
  hash; unit tested.
- StewardRecord gains claimCodeHash, claimCodeIssuedAt, claimCodeUsedAt,
  claimCodeVersion. Plaintext exists only in the mint response and on
  paper.
- Mint on issue (`mintClaimCode: true`, email optional for code-carrying
  records), admin reissue endpoint for unclaimed records.
- Phase A accepts pieceId + claimCode: rate limited, constant time compare,
  single use, chain-claimed guard; binds the session user; the code
  authorizes, the account anchors.
- The claim UI leads with the code when piece context exists; `?code=`
  deep link prefills; the legacy email-match arrival remains as the quiet
  fallback line. All sign-in surfaces de-branded.
- Admin: mint on issue with the plaintext shown once, copyable; reissue
  with confirmation.

### III.3 The QR-creating surface (next, after III.2 lands)
Extend the printing pipeline so one action produces the piece's complete
back-of-piece artifact set:
- Extend `scripts/generate-ul-qr.ts` (or a sibling `generate-piece-pack.ts`)
  to emit, per piece: the public QR plaque SVG (as today) AND the private
  insert SVG: the piece sigil, the claim code in its grouped form, the
  private QR encoding `/atlas/claim?piece=<id>&code=<code>`, and one quiet
  line of instruction in the ratified voice ("pull this card when the piece
  is yours; the code brings your dream into it" style, Fable to finalize).
- Because plaintext codes exist only at mint time, the script cannot derive
  them; the flow is: mint in AdminAtlas (or a batch admin endpoint) which
  returns plaintext once, feed the script a local JSON it consumes and
  deletes, or generate the insert directly from the admin mint screen
  (print stylesheet). Decide with Adrian which fits his print workshop;
  default: the admin mint screen gains a print-ready insert view (no local
  script juggling, plaintext never written to disk).
- The insert layout is a design artifact in the certificate grammar; Fable
  authors it, Adrian ratifies before the first print run.

### III.4 Retrofit and rollout (Adrian's hands)
- New sales: mint at sale confirmation, print insert, ship inside the back.
- Retrofit: any piece passing through the studio gets a minted code and an
  insert; the admin roster shows which pieces carry codes.
- The field: untouched; their paths remain email match, request,
  homecoming. The invitation letter needs no code language for them.

### III.5 Merge and verification discipline
- III.1 and III.2 land as one PR after Fable review (screenshots, privacy
  checks, the wrong-code state). CI green, then merge; production deploys.
- First-live-deploy checks (R2-dependent behavior that dev cannot run):
  mint a test code on a scratch piece, walk certificate to code entry to
  dream to ignition on production with a test account, reissue and confirm
  the old code dies, verify a wrong code answers calmly and rate limits.
  These join the standing deploy checklist in the interface plan.
- III.3 ships behind admin only; its first output is proofed against a
  physical print before any piece ships with it.

## The forever contract (Adrian, 2026-07-18)

Ruled after the minting workflow landed, before the first invitations and
shipments. In Adrian's words: once it is sent out it cannot be changed; the
QRs stay forever on those art pieces. Every surface that gets printed onto
or shipped with a physical piece is a permanent contract:

- `/qr/piece/:pieceId[/:edition]` URLs are immutable forever. The redirect
  indirection exists precisely so the DESTINATION can evolve while the
  printed URL never breaks. No route rename, host change, or scheme change
  may ever orphan a printed QR; any future migration must preserve these
  paths with redirects for the life of the project.
- `pieceId` values are permanent identifiers. Never renamed, never reused.
- The claim code format (26 crockford symbols, forgiving normalization) is
  frozen for printed codes. Verification must accept every code ever
  printed; `claimCodeVersion` exists for reissue, never for breaking old
  formats. Codes never expire.
- The private insert deep link (`/atlas/claim?piece=...&code=...`) is
  likewise immutable once printed.
- Nothing is "broken" in the pre-launch state; the discipline is: dial
  everything before game time, because game time is permanent.

## The whole body of work (Adrian, 2026-07-18)

The Atlas is for the ENTIRETY of the artwork, linked to dreams and creation.
The sixty-four are one series. Mandalas, signature pieces, jewelry, every
series present and future enter the same world, the same ledger, the same
claim flow, the same certificates, the same codes. The visitor can filter
the world by kind: a mandala, a signature piece, one of the sixty-four, and
whatever categories the catalog carries. The bigger picture stays the
center: people being part of one resonant family, sharing their dreams,
expressing them, collecting this creation. Build-out implications (verify
against the code before building): the catalog must hold every work; the
genesis backfill covers all of it, not only UL; the plaque/QR generator must
mint for ANY piece, not only card-numbered ones; piece sigils, filters, and
marker types must speak the full taxonomy.

## The catalog room (Adrian, 2026-07-18)

Adrian does not deliver an inventory file; the structure comes to him. A
Catalog Room in the admin: one form per work, and every downstream door
(claim, pay, present) flows from what he enters.

- Fields, in his language: title; kind (mandala, signature piece, jewelry,
  other with a series name; the sixty-four stay code-defined); year;
  dimensions; materials; photos (Cloudinary reference); where it is (with a
  keeper at a city, available, or resting with the artist); if available, a
  price and the acquire link. On save the piece receives its permanent id
  and sigil, minted once and frozen forever per the contract, shown
  immediately.
- Four actions per entry: enter the world (genesis to the ledger), mint
  claim code (shown once), print the plaque and the insert, view its
  certificate.
- Storage: R2 (atlas/catalog.json) beside the steward records, the
  mutateJsonArray discipline, zero ops. The runtime catalog is the merge of
  the code-defined 64 and the R2 entries; PiecePage, atlas meta, admin
  pickers, filters, and the plaque generator all read the merged catalog.
- The customer's three doors from the one form: claim (the code from the
  back), pay (an acquire door on available pieces routing to the sale flow,
  whose webhook opens the claim), present (the certificate and share card
  are the presentation, forever at the printed QR).
- Sigil issuance: kind prefix plus the next free number in that prefix,
  reserved at creation, never reused even if an entry is deleted before
  print (deletion allowed only while unprinted and unclaimed; after that,
  entries are permanent).

## Acceptance

1. A keeper pulls the insert from the back of a new piece, scans or types
   the code, writes their dream, and watches it ignite, without ever seeing
   a Google logo or the word log in.
2. A gallery visitor who photographs the public QR reaches only the
   certificate; nothing they can see or scan can claim the piece.
3. A wrong or spent code fails calmly and slowly; a claimed piece's code is
   inert; reissue kills the old code; transfers still run only through the
   audited path.
4. Adrian can mint, print, and affix a complete back-of-piece set for any
   piece in one sitting, from the admin room alone.
5. The bound keeper, signed in, sees their full record and price on the
   certificate; nobody else ever does.
