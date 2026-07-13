# Artwork Lineage QR, recovery, and custodial succession

**Status:** Approved design; immediate QR/Lineage Code implementation is next. Museum succession is designed here but explicitly deferred.

**Date:** 2026-07-13

## Purpose

Every physical artwork receives a permanent identity that travels with it. A visible QR opens the artwork's public history. A permanent Lineage Code engraved beneath a reversible metal plate allows a person who physically possesses the artwork to request stewardship of its digital record.

The system is trust-based. The Lineage Code is evidence of physical access, not automatic legal title. The registered keeper remains in control while reachable. If the keeper does not respond to a properly delivered claim sequence, stewardship can pass after 30 days. Disputed and stolen-piece claims remain frozen until resolved.

The longer-term archive must also survive Adrian. A separate Founder's Succession Key will eventually transfer operation of the complete registry to offspring, another named successor, or a museum/foundation through a custodial relay. That succession system is planned here but is not part of the immediate build.

## Product promise

Use this language:

> The identity and history travel with the artwork. Its keeper can recover and continue the registered lineage, and the complete record can be exported and preserved independently.

Do not promise that a domain, company, or hosted page will work literally forever. Permanence comes from a human-readable physical identity, exportability, public integrity checkpoints, independent backups, and a documented successor.

## Settled decisions

1. The physical assembly is a permanently attached, reversible metal plate.
2. The outer face carries the public QR and human-readable piece identity.
3. The underside carries one permanent Lineage Code. It does not rotate between owners.
4. The QR is public and copyable. It is never a credential.
5. The Lineage Code is possession evidence. It cannot instantly transfer stewardship or establish legal title.
6. A claimant must sign in with a verified email address, provide a real-name declaration, and consent to sharing their name and email with the registered keeper.
7. A claim records a private security audit including account ID, verified email, declared name, IP address, timestamp, and basic user-agent information.
8. The registered keeper may approve immediately, challenge the claim, communicate with the claimant, or report the artwork stolen.
9. Complete keeper silence can resolve to an automatic transfer on day 30, but only after the required notification sequence has been sent successfully.
10. Any keeper response stops the silent-transfer clock. A challenge or theft report opens a dispute and prevents automatic transfer.
11. Claimant and keeper personal information is private. It never enters the public ledger, public projection, QR, or public mirror.
12. Adrian is not a permanent dependency. Contested claims ultimately follow documented evidence and successor-governance rules.
13. The Founder's Succession Key and museum custodial relay are planned now and implemented later.

## Existing foundation

The repository already contains:

- A permanent redirect at `/qr/piece/:pieceId/:edition?`.
- Zero-signup public piece pages at `/piece/:pieceId/:edition?`.
- A per-piece append-only SHA-256 ledger.
- Verified-account steward binding.
- Self-service claim requests routed to the current keeper.
- Audited `transferred` events for sales, gifts, inheritance, and adjudication.
- Heir hints, private inscriptions, holder export, a public projection, and an optional GitHub mirror.
- Dormant pure logic for a 30-day claim window.

The old printed steward key was intentionally removed when accounts became the normal access method. The new Lineage Code restores physical continuity in a lower-authority form: it begins a governed claim but never acts as a bearer credential.

## Physical plate

### Outer face

The visible face contains:

- A QR encoding only `https://mandalacodes.com/qr/piece/<pieceId>/<edition>`.
- The same URL in human-readable form.
- Piece ID and edition.
- Optional title and artist mark when space permits.
- A short instruction: `Scan to open this artwork's living history.`

The permanent route remains an HTTP 302/307 indirection so the destination may change without replacing the plate.

### Underside

The underside contains:

- Heading: `LINEAGE CODE`.
- One permanent random code, grouped for accurate reading.
- `mandalacodes.com/claim` as the typed fallback.
- Instruction: `This code travels with the artwork. It begins a 30-day stewardship request; it does not by itself establish ownership.`

The code is not advertised as secret or tamper-proof. Flipping the plate demonstrates physical access. Previous owners or handlers may have copied it; the claim window and registered-keeper authority are the protection.

### Lineage Code format

The engraving format is 24 cryptographically random decimal digits followed by a two-digit checksum, grouped for legibility:

`1234 5678 9012 3456 7890 1234 56`

The 24 random digits provide approximately 80 bits of entropy. The checksum catches transcription mistakes but adds no authority. Codes are generated independently for each piece/edition and are never derived from titles, serials, editions, dates, or QR URLs.

The server stores only an HMAC-SHA-256 verifier using a separately managed pepper. Raw Lineage Codes must never appear in source control, ordinary logs, analytics, email, public exports, or the ledger. An encrypted fabrication vault may retain the raw batch so a damaged plate can be reproduced under controlled custody.

### QR production specification

- ISO/IEC 18004-compatible QR.
- Error correction level Q.
- Four-module quiet zone on every side.
- Matte dark modules on a matte light field.
- No logo, engraving texture, fastener, border, varnish, or decoration inside the quiet zone.
- Target printed QR square: 25–30 mm for the current short URL.
- Vector output for fabrication.
- Mechanically attach to the artwork's frame, backing, or a deliberate secondary mounting area. Do not use damaging adhesive on paint, paper, varnish, photographic surfaces, or other original media.
- Test the fabricated material for contrast, reflection, abrasion, humidity, fastener security, and legibility before the batch ships.

## Identity and privacy

### What email verification means

A verified email proves control of an inbox. It does not prove a legal identity. Claimants therefore provide a declared real name, but the registry must describe this honestly as account and email traceability rather than government identity verification.

### What each party sees

The registered keeper sees:

- Claimant's declared name.
- Claimant's verified email.
- Claim reason and optional evidence message.
- Claim timestamp and status.
- A reply channel.

The claimant sees:

- Registered keeper's name.
- A masked keeper email until the keeper replies or chooses to reveal it.
- Claim status, countdown, messages, and decisions.

Adrian or the active registry custodian sees the full private case, including IP and security audit records. IP addresses are never shown publicly and should not ordinarily be shown directly to either party. They are imperfect evidence and may be preserved for a legitimate investigation or lawful request.

Historical owners remain in the private stewardship history. They do not continue receiving every later claim after their transfer is complete. The currently registered keeper owns the active decision.

### Retention

- The immutable ledger stores only opaque actor references, event type, timestamp, transfer kind, and chain hashes.
- Names, emails, IPs, messages, reasons, delivery records, and supporting documents stay in mutable private storage.
- Raw Lineage Codes are never stored in the application database.
- Security audit retention must be documented and limited to what is necessary for provenance, disputes, abuse prevention, and legal obligations.

## Immediate claim flow

### 1. Open the artwork

Scanning the visible QR opens the public piece page without sign-in. The visitor can read the artwork's story and public lineage.

### 2. Begin a claim

The visitor chooses `Claim or recover stewardship`, signs in, and enters the underside Lineage Code.

The server:

1. Verifies the code without logging it.
2. Confirms that it maps to the same piece/edition.
3. Requires verified email and a declared real name.
4. Requires consent to share name and email with the registered keeper.
5. Captures the private security audit.
6. Creates exactly one active claim for that claimant and piece.
7. Reveals the registered keeper's name and masked email.

### 3. Notify and wait

The registered keeper receives notices on days 0, 7, 14, 21, and 27. Transfer is eligible on day 30.

Every notice includes:

- Artwork identity.
- Claimant name and verified email.
- Reason for the claim.
- Approve, challenge, stolen, and contact actions.
- Exact transfer date if no response is recorded.
- Instructions for securing the account if the request is unexpected.

Notification delivery is persisted through an outbox with provider IDs, attempts, accepted/failed state, and retries. Automatic transfer is not permitted unless at least the opening notice and final notice were accepted by the delivery provider. A broken or bouncing notification route sends the case to manual review instead of silently transferring it.

### 4. Resolve

**Approve:** Stewardship transfers immediately through an audited `transferred` event. The incoming keeper completes ordinary consent and keeper onboarding.

**No response:** If every safety gate is satisfied, the transfer commits automatically at day 30 with resolution reason `unanswered-lineage-claim`.

**Challenge:** The registered keeper must provide a reason and maintain a working reply email. The claim becomes disputed, automatic transfer stops, and both parties can communicate through the case.

**Stolen:** The record is frozen. The registered keeper supplies a reason and may attach a police report or other evidence. The claimant can respond with provenance, purchase, inheritance, or estate evidence. Nothing transfers merely because more time passes.

**Keeper deceased:** Registered heirs and estate contacts receive the same notices when available. A claimant may attach estate evidence. If nobody responds and the delivery gates are satisfied, the ordinary 30-day path may transfer. If anyone disputes the claim, it follows the contested path.

### 5. Preserve lineage

Every completed transfer appends an immutable event containing no personal data. Private records preserve the outgoing keeper, incoming keeper, claim case, decision path, and audit evidence.

## Dispute resolution without Adrian

Automatic rules resolve silence, not truth. A contested ownership claim cannot be safely adjudicated from a code, email, or IP alone.

The permanent rule is:

1. A keeper challenge freezes automatic transfer.
2. The claimant and keeper receive an auditable communication channel.
3. Evidence may include sale records, invoices, estate documents, registered heirs, photographs, prior correspondence, police reports, or authoritative legal decisions.
4. The active registry custodian applies the published stewardship charter.
5. If the evidence is insufficient, the digital record remains frozen rather than guessing.
6. Resolution is appended as an audited transfer or retained denial; it is never a silent database edit.

The software registry records stewardship of the digital lineage. It does not replace legal title, probate, police, courts, or the physical evidence of the artwork.

## Technical architecture for the immediate build

### Authoritative private tables

Add D1 tables for:

**`atlas_lineage_codes`**

- `id`
- `piece_id`
- `edition_number` normalized to `0`
- `code_hmac` unique
- `checksum_version`
- `batch_id`
- `status: issued | active | retired`
- `issued_at`, `activated_at`, `retired_at`
- `created_by`

One permanent active code exists per piece/edition. `retired` is reserved for an engraving error or physical plate replacement, not ordinary ownership transfer.

**`atlas_lineage_claims`**

- Claim ID and piece key.
- Claimant account reference, declared name, verified email.
- Private IP and user-agent audit.
- Reason/category and evidence message.
- Current registered keeper reference at opening.
- State: `pending | approved | challenged | stolen | auto-approved | denied | cancelled`.
- Opened, response, eligible-transfer, and resolved timestamps.
- Resolution actor and reason.

**`atlas_claim_messages`**

- Claim ID, sender/recipient references, body, and timestamp.
- Private and erasable according to policy; never part of the hash chain.

**`atlas_notification_outbox`**

- Claim ID, recipient, notice ordinal, scheduled time.
- Provider message ID, attempt count, accepted/delivered/bounced state, and errors.
- Idempotency key preventing duplicate notices.

**`atlas_transfer_commands`**

- Idempotent transfer command ID.
- Claim ID, piece key, from/to opaque references, transfer kind.
- Deterministic ledger event ID.
- Prepared/committed/error state and reconciliation data.

### Atomicity requirement

The current implementation writes the R2 ledger and steward registry in separate operations. A failure between them can split the history from access control. The Lineage Code flow must not auto-transfer until transfer resolution is transactional or recoverably idempotent.

Preferred design: make D1 the authoritative transaction boundary for ownership, claim resolution, outbox creation, and immutable ledger event insertion, with R2 files regenerated as compatibility/public projections.

Minimum acceptable bridge: a durable transfer-command journal, deterministic event IDs, compare-and-set writes, retries, and a reconciliation worker that proves every prepared command reaches one terminal result.

### Required endpoints

- Admin batch issuance/activation of Lineage Codes.
- Signed-in Lineage Code verification and claim creation.
- Keeper claim list and claim detail.
- Keeper approve/challenge/stolen response.
- Claimant status and message thread.
- Scheduled notification/outbox worker.
- Scheduled day-30 resolver.
- Registry-custodian dispute resolution.
- Private audit export for a specific dispute.

Every code-verification endpoint is authenticated, POST-only, CSRF-protected, fail-closed, rate-limited by account/IP/code verifier, constant-time where applicable, and returns generic errors that do not disclose whether a guessed code or piece exists.

## Plate-generation system

Add a dedicated piece-plate generator; do not reuse the existing 64-card oracle plaque generator.

Input is a reviewed batch manifest containing exact archive `pieceId`, edition, title, and optional fabrication notes. The generator:

1. Validates every piece against `FULL_ARCHIVE` and rejects duplicate piece/edition keys.
2. Confirms the public redirect and destination format.
3. Generates the permanent Lineage Code using a cryptographically secure source.
4. Produces a front-face vector with the public QR and human fallback.
5. Produces an underside vector with the grouped Lineage Code and recovery instruction.
6. Produces a public batch manifest containing piece key, URL, code HMAC, file hashes, and QA state—never plaintext codes.
7. Produces a gitignored private fabrication package containing plaintext engraving assets.
8. Imports/activates code verifiers in the production registry only after physical QA.

The private fabrication package is encrypted into the succession vault after production and removed from ordinary local storage.

## Preflight before any artwork leaves

Every individual plate must pass all checks:

1. Piece ID and edition exactly match the artwork and archive.
2. Piece has a valid genesis record and its chain verifies.
3. Public QR resolves to the correct piece page.
4. Page shows the correct title, artwork, edition, and public history.
5. Lineage Code checksum passes and maps to the same piece/edition.
6. Code is unique and active.
7. QR scans on at least one current iPhone and one current Android phone.
8. QR scans in dim light, at an angle, and after the intended surface finish.
9. Human-readable URL works when typed.
10. Front and underside remain legible after fabrication and mounting.
11. Applied plate is photographed front and underside for the private fabrication record.
12. Registered keeper email is correct, or the piece is deliberately marked unclaimed.
13. Baseline R2 and D1 backups exist.
14. Public mirror and domain renewal are operational.

No plate batch is marked `ready-to-ship` until every row passes.

## Phase split

### Build now: shipment-critical

- D1 Lineage Code registry.
- Secure batch issuance and activation.
- Piece-plate generator and fabrication assets.
- Public QR production standard.
- Lineage Code claim form.
- Verified-email and declared-name capture.
- Private claim audit including IP.
- Keeper claim visibility and response controls.
- Persistent notification outbox.
- 30-day warnings and automatic silent transfer.
- Challenge/stolen freeze and message channel.
- Atomic/idempotent transfer hardening.
- Complete preflight and batch manifest.
- Production verification of migration, backups, mirror, and first real claim.

### Plan now, implement later

- Founder's Succession Key.
- Encrypted succession vault.
- Offspring/named-successor first right.
- Museum/foundation custodial relay.
- Institutional verification and stewardship charter.
- Public institutional-custodian history.

The QR and Lineage Code format must not depend on the deferred succession implementation, so the physical plates remain valid when it is added.

## Founder's Succession Key — deferred design

This key is separate from every artwork Lineage Code.

- It is a high-entropy offline root key held with estate documents.
- It begins transfer of registry operations, infrastructure access, backups, and dispute authority.
- Activation requires a verified successor account and notifies Adrian and existing administrators.
- While Adrian is reachable, he may approve or stop activation.
- After Adrian's death or non-response, the estate/succession protocol completes activation.
- The key is single-use. After custody transfers, the incoming custodian receives a new Succession Key and the old one is revoked.
- The same key unlocks an encrypted succession vault containing current infrastructure recovery material and operating instructions.

The vault includes domain, Cloudflare, GitHub, email, signing keys, private backups, collector-contact handling, restore procedures, privacy rules, dispute policy, and instructions for issuing the next key. It is updated and recovery-tested regularly.

## Offspring-first museum custodial relay — deferred design

### Priority

1. Offspring or a named personal successor receives first right to accept custodianship.
2. If they decline or the role remains unclaimed, the museum/foundation relay begins.
3. Candidate institutions must be pre-enrolled with at least two maintained contacts and must agree in principle to the stewardship charter. The system cannot impose obligations on an institution that never consented.

### Relay

1. The relay sends the first institution the project's story, charter, obligations, and a scoped invitation—not the root key.
2. Every ten days, if no institution has expressed interest, the next invitation is sent.
3. The first verified institution to express interest pauses further invitations.
4. It receives a longer due-diligence window to verify authority and formally accept custodianship.
5. Failure, withdrawal, or expiry resumes the relay at the next institution.
6. Acceptance grants one institution sole, unambiguous custodianship and releases the succession vault through the controlled handover.
7. The institution's name and custodial dates become part of the public history of the overall art project.

### Release onward

The active institution may choose `Release the archive`.

- The relay resumes from the next eligible institution.
- The current institution remains responsible until another formally accepts.
- The incoming institution receives a new Succession Key.
- The outgoing key is revoked.
- The handover becomes a permanent public custodial event.
- If nobody accepts, the registry enters protected read-only mode: public histories and exports remain available, while ownership changes and disputes pause.

### Museum Stewardship Charter

An accepting institution agrees to:

- Keep the public archive and QR resolver reachable.
- Preserve collector privacy and never publish the private registry.
- Process legitimate transfers, recoveries, and inheritances under the published rules.
- Preserve the append-only lineage and never silently rewrite it.
- Maintain independent backups and test restoration.
- Avoid commercializing collector data or claiming ownership of collectors' physical artworks.
- Release stewardship onward when it can no longer perform the role.

Registry custody, copyright, Adrian's estate, and ownership of physical artworks are legally distinct and must be handled by corresponding estate and institutional agreements.

## Continuity requirements

- Multi-year domain renewal, registrar lock, redundant billing contacts, and estate documentation.
- Activated public mirror containing only non-personal public state and integrity checkpoints.
- Signed integrity checkpoints and verifiable holder exports.
- Encrypted quarterly full backup of R2, D1, configuration, and operating documents to at least two independent locations.
- Annual restore test.
- Successor review whenever authentication, hosting, domains, email, or storage changes.
- No personal data or plaintext Lineage/Succession Keys in public archives.

## Failure behavior

- Unknown or malformed code: generic failure; no piece or owner disclosure.
- Excess attempts: fail-closed cooldown and private audit.
- Email delivery failure: no automatic transfer; route to registry review.
- Broken chain or ownership mismatch: freeze writes and reconcile.
- Simultaneous claims: one active claim per piece; later requests are queued or rejected without leaking details.
- Keeper challenge or stolen report: freeze automatic transfer indefinitely until resolved.
- Missing active custodian: read-only public continuity; no silent transfers.
- Domain/service loss: human-readable piece identity, exports, mirror, and successor package allow reconstruction.

## Verification

Implementation is not complete until:

- Unit tests cover code generation/checksum/HMAC verification without exposing raw codes.
- Claim tests cover approval, five warning boundaries, day-30 transfer, challenge, stolen freeze, delivery failure, deceased keeper, and concurrent claims.
- Transfer fault-injection proves no split ownership/ledger result.
- Privacy tests prove names, emails, IPs, messages, and codes never enter public state, ledger payloads, mirrors, or ordinary logs.
- Rate-limit tests prove verification fails closed.
- Outbox tests prove idempotent notices and no auto-transfer without accepted opening/final notices.
- Physical QA is recorded for every produced plate.
- A complete first-piece rehearsal succeeds from QR scan through claim, warning preview, approval, ledger event, and export.
- A disaster rehearsal reconstructs the public piece record from backups and mirror data.

## Explicit non-goals

- The QR or Lineage Code is not legal title.
- The system does not guarantee police identification from an email or IP.
- No NFT, blockchain, wallet, or public owner directory is required.
- No automatic decision resolves an actively disputed theft claim.
- The museum relay is not part of the shipment-critical build.
- The project does not claim that any commercial host will operate forever.
