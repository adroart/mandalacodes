# The Dim World and the Ceremony, build plan

Status: ratified direction, ready to build. Written 2026-07-12 from the intention corpus
(pinned memory: atlas-experience-intention) and three code maps (rendering, claim flow,
data model). This plan supersedes nothing; it builds on the living-art-legacy plan and
the completed phase-0 collector-journey repair.

The intention, one breath: the globe is piece zero, an artwork containing all the others.
Every piece Adrian has ever made appears as a dim ember; claiming ignites it into a light
carrying a dream. One potent act, then silence, then one annual return. Witness, not
conversation. Sacred through flow, never through solemnity.

Model rule (pinned memory: model-allocation-quality-first): Fable authors design, copy,
and reviews everything; Opus agents take implementation with judgment in it; Sonnet
agents take mechanical work. Anything a visitor feels goes up a tier, never down.

---

## Ground truth (from the code maps)

What already works, do not rebuild:
- Markers are one instanced Points draw call with ignition, flash, breathe, selected,
  owned, and yours states (`components/atlas/three/Markers.tsx`). The founding-lights
  opening already ignites in claim order.
- Thread travel between kindred pieces exists (`Globe3D.tsx:199-217`, 1700ms tween).
- The collector claim path is repaired in code (phase-0): account is the key, QR is a
  pointer, no-record dead-end is gone. Remaining breaks are ops, not logic.
- The ledger is live: append-only, hash-chained, inscriptions, transfers (sale and gift
  kinds), heirs, sealed-until-date and seal-until-transfer capsules, export.
- `ClaimCeremony.tsx` already plays the ignite beat with the ordinal spoken.

The precise gaps this plan closes:
1. `unawakened` renders at full bronze; the dim ember is defined but not honored
   (`Markers.tsx:127-133`).
2. Size band, price, category, and series are computed in `AtlasPage.tsx` and dropped
   at the GlobeNode boundary (`AtlasPage.tsx:375-416`), so the shader cannot encode
   potency or art type.
3. Only 18 pieces have ledger genesis events; the other 46 UL pieces, and all non-UL
   work, are absent from the atlas entirely.
4. No re-ignition seam: a claim that happens while someone watches just fades in
   (`Markers.tsx:234-236`). The most magical moment of the system is currently silent.
5. The ceremony is three separate pages (claim, consent rings, ignite), not one motion.
   The ignite is not sequenced off the dream inscription.
6. No creator's message, no gift capsule field, no birthday return, no sealed-dream
   display, no replay. CAPACITY=256 silently truncates. No reduced-motion gate in the
   WebGL scene.

---

## Phase 1: The Dim World

Goal: a stranger sees the whole body of work within three seconds of the globe settling,
dim embers everywhere, lit dreams glowing among them, and understands without a label.

### 1a. Every piece enters the world (Sonnet, mechanical)
- Script: append `created` genesis events for all 64 UL pieces missing from the ledger
  (pattern exists in `scripts/seed-atlas.ts`; guard against double-genesis).
- New public status semantics: pieces created but never sold render as embers at the
  hearth, Adrian's studio city, gathered close. A piece sold but unclaimed stays
  `unawakened` at its known city. Seeking pieces keep current behavior.
  DESIGN RULING NEEDED FROM ADRIAN: hearth city (see Needs-you).
- Widen the GlobeNode boundary: attach `sizeBand`, `category`, `series`, and (when
  present) `price` to each node in `AtlasPage.tsx:375-416`. Data is already in scope
  there; this is plumbing only.

### 1b. The ember and the light (Opus, shader work; Fable reviews live)
- Honor the ember: `unawakened` and hearth pieces get low-alpha warm ember treatment
  (values exist in `Globe.tsx:91` from the cobe era), slow breathe, no flare.
- Potency: new `aBright` attribute multiplied into `gl_PointSize` and the energy term.
  Feed from size band now, price when the data arrives. It must read as a greater fire,
  never a price label: continuous scale, warm hue shift (deep ember toward bright
  gold-white), no legend that mentions cost.
- Art-type symbols: new `aType` attribute branching the point sprite SDF in `FRAG`
  (`Markers.tsx:82-95`). Start with two glyphs (mandala, other), extend as the non-UL
  catalog lands. Series hue can ride `seriesColor.ts`, subtle, never louder than status.
- Raise CAPACITY to 1024 with an explicit console warning on truncation instead of the
  current silent slice.
- Add a reduced-motion gate to the scene: autorotate stills, pulses settle, ignition
  becomes a crossfade.

### 1c. Acceptance (Fable, live URL per the link-first rule)
- Cold visit: whole catalog visible dim, placed lights clearly alive, nothing labeled.
- Filters still work; mandala view unharmed; 60fps with 200+ nodes on a mid laptop.

## Phase 1.5: Dreams write the sky (ratified 2026-07-12, in build)

Adrian's correction: dreams lead, pieces anchor. Nobody waits thirty seconds for a
murmur queue. Three moves, all zero-effort for the visitor:
1. The ignition opening pairs each igniting light with its dream flaring briefly
   beside it; the first five seconds ARE the project.
2. At rest, up to five dreams from facing lights sit as faint tethered inscriptions
   around the globe, present the moment you arrive, shifting as the world turns.
3. Selection writes the dream large across the dark of the globe, an inscription,
   not a popup card. Beneath it only `UL № 1 · placed in Lisbon · 12th light`, and
   one quiet `open the book` action revealing the full HUD.
Piece identity is a series-prefixed number (`UL № 1`); long titles retreat into the
book. Non-UL series get their own prefixes when the catalog lands.

## Phase 2: The Ceremony and the open door (before the customer emails go out)

Goal: the email a past customer receives leads into one continuous motion: arrive, be
recognized, consent, write the dream, watch your light ignite with its ordinal, receive
the creator's message. Apple-unboxing flow, zero forms-feeling.

### 2a. One motion (Fable designs the sequence and every line of copy; Opus implements)
- Fold `StewardClaim` phases and `ConsentRings` into the ceremony's visual shell: the
  globe is present from the first screen, dimmed behind sign-in, never a bare page.
- Re-sequence: dream inscription BEFORE ignition. The light ignites because the dream
  was written. `ClaimCeremony` gains a preceding `inscribing` phase; the existing
  igniting/reveal/ready phases follow unchanged.
- The creator's message: after the ordinal is spoken, one sealed line from Adrian opens.
  Fortune-cookie: the claimant never knows which they will receive. Data: a
  `creatorMessage` map (5 or 6 messages Adrian resonates with, plus per-piece custom
  overrides), stored server-side so it stays a surprise, delivered into the piece's book
  as a permanent first letter.
- Skip stays available at every beat (respect for limited focus).

### 2b. Live ignition (Opus)
- Re-ignition seam in `Markers.tsx`: a node whose status changes to placed/claimed while
  mounted gets `bornAt = now` and the full flash/shockwave, not a fade. Anyone watching
  the globe sees the world change.

### 2c. Open the door (Sonnet, ops and one-liners)
- `SeekingGround.tsx:68`: carry `?piece=` context on the claim link.
- Provision per `todo/handoff/MORNING-AFTER.md`: D1 `atlas_sale_events` tables,
  `SALE_WEBHOOK_SECRET`, verify `RESEND_API_KEY` sends in prod (one real test email).
- The art-site sale webhook sender lives in the other repo; flagged, not in scope here.

### 2d. Acceptance (Fable)
- A test account walks email link to ignited light with a dream, in one sitting, no
  dead end, on desktop and phone. The ignition is visible on a second browser watching
  the globe.

## Phase 2.5: The Homecoming (launch-critical, parallel with Phase 2)

Adrian has sold pieces for years with no record of many buyers (Santa Cruz, Bali,
Sacramento, and more). The current claim path assumes a steward record already exists
(bound email or admin-created). For unknown past collectors there is no piece in the
ledger and no record to match, so the whole first wave cannot arrive through the
existing door. This must be built.

### 2.5a. Bring your piece home (Fable designs flow and copy; Opus implements)
- A public page, reachable from the invitation and from the atlas: for people who hold
  a piece that the system does not know. They offer: photos of the piece, roughly when
  and where it came to them, the city where it rests, their email.
- This creates a homecoming request in a queue. Adrian recognizes his own work and
  confirms with one tap. Confirmation mints the piece's genesis event (`created`),
  binds the steward, and sends them straight into the ceremony. Reuse the
  RequestStewardship and resolve-claim-request machinery
  (`components/atlas/RequestStewardship.tsx`, `functions/api/atlas/steward/`).
- Unrecognized or suspicious requests simply wait; no auto-approval, sacredness is
  protected by Adrian's eye, and volume stays human-scale.
- Admin side: extend the existing requests queue UI (`StewardRequests.tsx`,
  `AdminAtlas.tsx`) with photo display and a mint-and-bind confirm action.

### 2.5b. The invitation (Fable, every word)
- One short letter in Adrian's restrained voice sent to every reachable past buyer,
  plus a shareable version for the ones he can only reach by word of mouth. Draft to
  ratify, subject "your piece has a place in something new":

  > Years ago one of my works came to rest with you.
  >
  > I am connecting every piece I have ever made into one living artwork: a world map
  > where each piece holds the dream of the person who keeps it.
  >
  > Your piece already belongs to it. This is an invitation to take your place. Claim
  > your piece, write the dream you want it to carry, and watch it become a light
  > among the others. It takes a few minutes, and what you write stays with the piece
  > through every hand it ever passes to.
  >
  > Adrian

- Known buyers get a direct claim link; unknown ones get the homecoming page.
- Adrian ratified the scaffold 2026-07-12 and will expand it himself: the letter is
  also his artist update, what he has been working on, and the launch of this project.
  The draft above is the spine, not the final letter.

### Capacity note
The 256-marker cap is already addressed in Phase 1b: raised to 1024 with a loud
warning instead of silent truncation. Hundreds of claims render as one draw call; the
ceiling is a constant, not an architecture limit, and can rise again if the field
outgrows it.

## Phase 3: The capsules and the return (after launch wave)

- Gift capsule: a dedicated gift message at purchase or transfer, written by the giver,
  sealed, revealed when the receiver claims. Extend the existing seal-until-transfer
  inscription machinery (`LegacyBook.tsx:653-665`) into a first-class beat in the
  receiver's ceremony. The transfer ceremony gets the same care as first claiming.
  (Fable copy and sequence, Opus implementation.)
- Birthday return: a month window around the steward's birthday. Inside it, the book
  opens on the dream with three quiet choices: keep it burning, tend it (add what was
  learned, what became important), or set a new dream (the old one archives into the
  ledger, energy kept, nothing lost). One letter-from-the-piece invites them in (the
  letters machinery exists, `utils/letters.ts`). Some dreams are only ever aligned with,
  never fulfilled; the copy must honor that.
- Sealed dreams visible: a sealed light shows a quiet mark, "a dream rests here, held
  privately", revealable later by its steward. Taught in one line as holding energy
  until it is ready.
- Oracle bridge: logged-in stewards see their dream on Oracle pages by default, mini X
  to hide in the moment, toggle in options. (Sonnet wiring, Fable copy.)

## Phase 4: The living field (ratified, build when lights exist)

- Replay: the constellation re-ignites in claim order on demand; the ignition ranker
  already sorts by ordinal. Journey trails when pieces move cities.
- Witness gesture, pending Adrian ratifying the structure: strangers hold a dream, one
  wordless act, no text, no counts, rate-limited; steward feels soft warmth only.

---

## Needs Adrian (each blocks only its own phase)

1. Hearth ruling (blocks 1a): unplaced, unsold pieces gather dim at the studio city.
   Which city is the hearth?
2. Non-UL catalog (enriches 1a, does not block a UL-only launch): list of all other
   works: title, type, size, price, year, resting city if sold. Without it the Dim
   World launches as the 64 and grows.
3. The creator's messages (blocks 2a's final beat): the 5 or 6 lines, plus any custom
   ones. First-wave claims are one-time; whoever claims before these exist misses the
   fortune cookie forever (retro-delivery as a letter is possible but lesser).
4. Ops confirmation (blocks 2c): access to run the MORNING-AFTER provisioning steps and
   confirm the Resend key is live in prod.

## Order of work

1a and 1b in parallel (independent seams), then 1c review.
2a, 2b, 2c, and 2.5 in parallel after Phase 1 review, then 2d end-to-end proof
including one homecoming request walked from photo to ignited light.
Customer emails go out only after 2d passes.
Phase 3 immediately after; the gift capsule first (transfers can happen any time),
birthday return second (first birthdays are months away), Oracle bridge third.
Phase 4 when the sky has lights.

Every phase ships behind the standing rules: typecheck before push, live URL first,
no em dashes, no italics, warm earth tones only.
