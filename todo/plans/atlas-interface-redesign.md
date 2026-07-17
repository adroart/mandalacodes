# The Atlas interface: one unbroken motion

Status: authored 2026-07-17 by Fable from a three-way code map (UI surface, data
model, design system), live screenshots of every Atlas surface on desktop and
phone, and the ratified intention in `atlas-dim-world.md`. This document is the
interface layer of that plan: it does not re-open ratified direction, it gives
the direction a precise visual and experiential body, and it names what the
current build does that betrays it. It supersedes `docs/atlas-style-notes.md`,
which references a font the build no longer ships.

The bar, in Adrian's words: opening the Atlas, claiming your dream, and finding
your piece again must feel like opening a new Apple product. Unboxing has three
properties worth naming precisely, because they are buildable:

1. One thing at a time. Every moment has exactly one object of attention and at
   most one primary action. Nothing competes.
2. The object is never lost. At every step you can see the thing you came for.
   The packaging choreographs attention toward it, never away from it.
3. Nothing needs explaining twice, and nothing dead-ends. Every state, including
   failure, hands you the next step.

The current Atlas has the soul right and the body wrong. The diagnosis below is
organized by the distance between the two.

---

## Part I: What is wrong

Live screenshots backing each finding sit in
`todo/plans/evidence/atlas-redesign/`: the resting Atlas with its chrome faded
past legibility (`atlas-desktop.png`), the desktop selection card
(`atlas-selected.png`), the phone selection sheet covering the entire globe
(`atlas-selected-mobile.png`), and the bare ceremony arrival
(`claim-desktop.png`).

### 1. The first five seconds say nothing

The intention: a stranger sees the whole body of work within three seconds,
dim embers everywhere, lit dreams glowing among them, and understands without
a label. Dreams lead, pieces anchor.

The reality on screen: a beautiful sepia sphere with faint dots, and no dreams
anywhere. The dream text is plumbed all the way to the globe nodes
(`AtlasPage.tsx:440-442` attaches `intention` to every lit node) and then no
component in `components/atlas/three/` ever renders it. Phase 1.5 moves 1 and 2
(dreams flaring beside igniting lights in the opening, three to five resting
dreams tethered around the globe) are unbuilt. The single sentence that could
orient a stranger, the stat caption, renders at 11px letterspaced micro-type
and then fades.

Verdict: the project's thesis, every piece holds a dream, is invisible on the
project's front door.

### 2. The interface whispers itself into illegibility

Calm is the right instinct. But the build achieves calm by lowering opacity
instead of by composing, and after four seconds of stillness the idle fade
(`useIdleFade.ts`, applied at `AtlasPage.tsx:1004`) takes every affordance,
the title, the caption, the legend, and all six controls, down to a ghost. A
first-time visitor who does the most natural thing, stop and look, is left
staring at an unlabeled ball. On the live screenshots the resting chrome is
genuinely unreadable.

Apple products are quiet, but the words on them are always legible. Calm must
come from hierarchy and restraint in what is shown, never from making what is
shown illegible.

### 3. The moment of connection breaks on the phone

Selecting a light on a phone slides up a sheet that covers the entire globe.
At the exact moment a person finds a piece (or their own piece), the world it
belongs to disappears. The plan's own words for selection are "an inscription
written across the dark of the globe, not a popup card"; the phone build is
precisely a popup card, at full screen.

Two adjacent breaks: selecting uses history replace (`AtlasPage.tsx:283-294`),
so the phone's back gesture does not close the sheet, it throws you out of the
Atlas entirely. And the artwork band at the top of the card shows a broken
image glyph when a piece has no photo, which is most pieces today.

### 4. The ceremony is a form in a dark room, not an unboxing

The claim flow has the right beats and genuinely lovely copy, but:

- The arrival beat is a bare dark gradient with a sign-in form. The plan says
  the globe is present from the first screen, dimmed behind sign-in, never a
  bare page. With `?piece=` context we know which piece is being claimed and
  show nothing about it. Unboxing property 2 is violated at the door: the
  object is missing.
- The map-presence question is asked twice in one claim, once in the consent
  beat (`ConsentRings`) and again restated in the dream beat
  (`StewardClaim.tsx:673-761`), both writing the same field. Asking a question
  twice reads as either a bug or distrust.
- The error beat offers only "Back to the map" with no retry, and the bind
  effect is ref-guarded so it will not re-fire (`StewardClaim.tsx:428`); a
  transient network blip forces a full reload.
- The ignition, the one moment a person will want to show someone, cannot be
  seen again. No replay anywhere.

### 5. A person can get lost, and the lost paths are the important ones

- Homecoming, the door for exactly the people the launch letter will reach, is
  discoverable only via a small line at the bottom of `RequestStewardship`.
  The piece-page not-found state, where an unknown-piece holder is most likely
  to land, does not offer it.
- `/atlas/edit` with no atlas record says "Ask Adrian to seed it" with no link,
  no action (`StewardEdit.tsx:431-437`).
- A signed-in steward on the Atlas has no persistent way to answer the most
  personal question the page invites: where is mine? The `owned` flag reaches
  the nodes; no control surfaces it.
- Spec jargon leaks into the room: a section literally titled "Ring 3"
  (`StewardEdit.tsx:549`). Invented vocabulary (ember, drift, kin, mandala,
  seeking) appears without in-place explanation, while two terms get glossed
  in one caption. There is no system governing the words.

### 6. Three type systems, two bronzes, and forked components

The Atlas hardcodes the retired DESIGN.md bronze `#c4aa7c` in 18 places while
the site token is `#a37b38`; introduces a sage `#9caa87` that exists in no
palette; carries 248 color and font literals across `components/atlas`; styles
dark panels by re-coloring paper-surface components with `!important` blocks
(`.atlas-panel-dark` in `src/index.css`); ships two parallel filter components,
two globe stacks behind `?libglobe`, and three hand-rolled copies of the same
toggle. None of this is visible to a visitor as a list, but it is exactly why
the surfaces feel subtly unrelated, and it is why every future screen costs
more than it should.

### 7. The intelligence is present and unexpressed

The data layer already computes founding-light ordinals, kinship with distance
and trigram binding, steward generations, letters in the piece's voice,
anniversaries, a deterministic dream route, and a self-verifying export. The
surface shows dots and a card. The redesign's job is not to add intelligence;
it is to give the existing intelligence a stage.

---

## Part II: The design

### The organizing model: three rooms and one thread

Everything a visitor or keeper does happens in one of three rooms:

- The World (`/atlas`): every piece Adrian has made, and the dreams they carry.
- The Piece (`/piece/:id`): one work's plate, story, and public record.
- The Book (`/atlas/edit`): the keeper's private room for their piece.

One thread of light connects them: the claim ceremony carries a person from
the World into their Book, and their light is afterwards the persistent link
back to the World. Every screen must answer, in its first breath, which room
am I in, and where is the thread.

### The six interface laws

Every Atlas surface, present and future, obeys these. They are the review
checklist for any Atlas PR.

1. One primary action per moment. If a screen needs two, it is two moments.
2. The dream is the largest text on any surface it appears on.
3. Legibility floor. Chrome may rest, never vanish: orientation chrome (the
   one-line thesis, the primary controls) idles no lower than 0.6 opacity;
   secondary chrome (legend, breadcrumb) no lower than 0.35. Any pointer,
   touch, or focus restores everything instantly. Reduced motion never fades.
4. The globe is the constant. From arrival through ceremony to the book, the
   world stays visible: dimmed behind sign-in, alive behind the dream being
   written, present as a strip in the book. Never a bare page.
5. Words are lit once. Each surface introduces at most one invented term, and
   glosses it in place with one quiet line the first time it appears. "Ring"
   never appears in visitor-facing copy.
6. Nothing dead-ends. Every empty, error, and not-found state names what
   happened and carries a working door onward. Retry exists wherever a network
   call can fail.

### Room one: the World at rest

The first five seconds are the project. Sequence for a cold visit:

1. The globe settles out of black (about 1.5s).
2. The founding lights ignite in claim order, and as each ignites its dream
   flares briefly beside it as a short fragment in Cormorant, light on dark,
   tethered to the light by a hairline (Phase 1.5 move 1). Total under 5s,
   skippable with any input, played only when lights exist.
3. The thesis line fades in at the bottom left and stays at rest opacity:

   > Every piece Adrian has made, and the dreams they carry.
   > 64 pieces · 9 lights lit · touch a light to read its dream

   Two lines, Karla label case, and this is the only caption. The current
   two-line glossary caption is retired; glossing happens where terms appear.

4. At rest, up to five dreams from lights on the facing hemisphere sit as
   faint tethered inscriptions around the globe, rotating with it, swapping
   gently as the world turns (Phase 1.5 move 2). They are the ambient proof
   that the dots are dreams. Tapping one selects its light.

Returning visitors (localStorage flag) skip the ignition overture and land on
the resting sky directly.

Chrome layout at rest:

- Top left: room name (Atlas) and breadcrumb, secondary chrome.
- Bottom left: the thesis caption, orientation chrome.
- Bottom right: exactly three controls plus one contextual: `dreams` (the
  renamed drift), `threads`, `filter`. `return` appears only while something
  is selected. `your light` appears only for signed-in stewards (below).
  `mandala` moves into the filter sheet as a view option; it is a lens, not a
  daily control.
- The series legend moves into the filter sheet. Six controls at four corners
  was the old layout's tax on every visitor for the sake of power users.

Renames (UI copy only, no code identifiers): drift becomes `dreams`; release
becomes `return`. First-use gloss lines, one each, shown once per visitor:

- dreams: "one gesture carries you from dream to dream"
- threads: "threads join pieces that share a code"
- ember (in the piece card, where an ember is first met): "made, not yet
  claimed; it waits as an ember"

Your light: signed-in stewards get one quiet control, `your light`, bottom
right. Tapping it flies to their piece and opens its inscription. This is the
thread made visible; the `owned` flag already reaches the nodes
(`AtlasPage.tsx:438-439`), nothing new is computed.

### Selection: the inscription, not the card

Desktop: selecting a light writes its dream large across the dark on the side
of the globe away from the light (Phase 1.5 move 3), Cormorant at display
size, with one line beneath in Karla:

> UL № 1 · placed in Denpasar · the 1st light

and one action: `open the book`. That is the whole resting selection. The full
HUD card (artwork band, kin list, holder chart, also-resting-here) appears
only behind `open the book`, as today's `PieceHUD` content. The card keeps its
fits-first dream treatment for long dreams. Broken artwork images never show a
browser glyph: a piece with no photo renders the warm plate fallback that
`PiecePage` already has (`PiecePage.tsx:328-347`); extract and share it.

Phone: the inscription behaves as a bottom half-sheet capped at 45% of the
viewport. On select, the camera recenters the chosen light into the upper
visible half, so the light and its dream are on screen together. The sheet
drags up to become the full card, drags down to dismiss. The globe is never
fully covered.

History: selecting pushes exactly one history entry; selecting another light
while one is open replaces it. Back (button or gesture) closes the selection
and returns to the resting sky. Esc and `return` do the same.

### Room two: the Piece

The certificate page is the closest surface to right. Changes are hierarchy,
not structure:

1. Collapse the six stacked small-caps sections into three chapters with the
   existing hairline dividers: The work (plate, edition, materials, code),
   The dream it carries (the dream at display size, law 2), Its story (spine,
   kin, keeper's chart element, ledger seal).
2. If the piece is unawakened or seeking, one quiet invitation band sits
   directly under the title, above the fold on phones:

   > This piece is waiting for its keeper. Begin →

   The full claim block stays at the foot as today. QR arrivals must meet the
   door in the first screenful, not after 1,800 pixels of scholarship.
3. The not-found state gains the missing second door:

   > Holding a piece we do not know? Bring it home →

   routed to `/atlas/homecoming`. This is the single highest-leverage line in
   the whole redesign; the launch letter will send exactly these people here.

### The ceremony: one motion, the world present throughout

The ratified 2a sequence, given its staging. One continuous dark stage, the
globe alive behind every beat at low brightness, cross-fades between beats,
lowercase `skip` at every beat, and a progress feeling carried by the globe
slowly brightening as the person advances.

1. Arrival. The globe dims up from black; if `?piece=` is present, the piece's
   plate floats faintly above the horizon with its title:

   > You are claiming Earth's Breath.
   > A piece of the world is waiting for you.

   Sign-in options exactly as built (they are already spoken as claiming, not
   logging in). Without `?piece=`, today's copy stands alone.
2. Recognition. As built: the artwork forward, its code line, `begin`.
3. The dream. The single question, the textarea, and beneath it one choice
   presented once (fold `ConsentRings` Ring 2 into this beat; the consent beat
   disappears as a separate screen):

   > Where should this dream live?
   > ( ) As a light on the world map, city only, first name never shown
   > (•) Privately, in the piece's book

   Private is the default. The Ring 1 explanation becomes one quiet line under
   the textarea: "What you write stays with the piece, and you can always
   carry the whole book away." Chart presence (today's Ring 3) is not asked
   during the ceremony at all; it is offered later in the book, where it can
   be understood. One beat, one decision, law 1 restored.
4. Ignition. The dream just written inscribes itself across the sky as the
   light flares (the re-ignition seam from 2b), founding lights replay, the
   camera arrives, the ordinal is spoken: "You are the 12th light."
5. The creator's message, as ratified: one sealed line from Adrian opens.
6. Ready. "Enter your piece's book" plus one quiet line: `watch it again`,
   which replays beat 4 from the same data. The book's letters section also
   carries a permanent `replay the ignition` line. The claim is once; the
   goosebumps should not be.

Failure honesty: the error beat gains `try again` (re-fire the bind, drop the
ref guard into state), keeps `back to the map`. The no-record beat, as built,
routes to RequestStewardship with `?piece=` context, and now also shows the
homecoming door.

### Room three: the Book

The book is already the best-behaved surface (state-aware welcome, letters
auto-open). Three changes:

1. The thread, visible. The book opens with a slim globe band (about 120px)
   showing the keeper's light glowing at its city, captioned "your light ·
   placed in Lisbon · the 8th light", tapping through to `/atlas` focused on
   it. Reuse the existing scene at low framerate or a static render; this is
   an emblem, not an instrument.
2. Controls in the keeper's order, each a chapter with one verb: Place it
   (city picker) → Let it shine (map presence) → Write into the record →
   Letters → Pass it on (heirs, export). Chart presence lives under Let it
   shine as "join the constellation of keepers", with the kinship gloss. The
   words "Ring 2" and "Ring 3" leave the interface.
3. The no-record state becomes a door, not a wall:

   > Your account is signed in, but no piece is bound to it yet.
   > Claim with the email your piece was registered to → (sign-in switch)
   > Came to it another way? Request stewardship →
   > Holding a piece we do not know? Bring it home →

### One visual language

The Atlas is one place; it must be built from one set of materials.

Tokens (add to `src/theme.css` `@theme`, then delete every matching literal):

- `--color-atlas-night: rgb(15,13,11)` (stage), `--color-atlas-sphere`,
  `--color-atlas-land`, `--color-atlas-ember`, `--color-atlas-gold: #c4aa7c`,
  `--color-atlas-kept: #9caa87`.
- Ruling: `#c4aa7c` is hereby the Atlas gold, the color of lights, threads,
  and stage accents, distinct on purpose from the paper-surface bronze
  `#a37b38`. Both are tokens; neither is ever a literal again. The sage
  `#9caa87` is legitimized as the kept/yours accent token.
- The `.atlas-panel-dark` `!important` override block in `src/index.css` is
  retired; dark-stage components use the tokens directly.

Type roles on the dark stage: Cormorant Garamond for dreams and display lines
at 20px and above (site guardrail); Lora for prose under 20px; Karla for
labels; Cinzel only for the Atlas wordmark. This matches the site-wide rules
already documented atop `src/index.css`; the stale `docs/atlas-style-notes.md`
is superseded by this section.

Components, one of each: a single `Toggle` (three hand-rolled copies today:
`ConsentRings.tsx:142`, `StewardClaim.tsx:734`, `StewardEdit.tsx:500`); a
single `AtlasFilters` with a `stage` variant (delete `AtlasFiltersDark`); a
single artwork-plate-with-fallback; one globe stack (finish `Globe3D`, remove
`GlobeGL` and the `?libglobe` fork once parity is confirmed). The non-WebGL
fallback keeps the same page shell, caption, selection sheet, and below-fold
sections, differing only in the globe rendering, so no visitor gets a
different information architecture because of their GPU.

Motion grammar, three durations total: 120ms for micro state, 400ms
cubic-bezier(0.4, 0, 0.2, 1) for panels and sheets, 1700ms for camera travel
(already the thread-travel constant). Reduced motion: no idle fade, crossfades
for ignition, stilled autorotation, everything legible always.

### Honest states

- The Atlas loader silently falls back to seed data on fetch failure
  (`AtlasPage.tsx:301-312`), so the error branch is dead and a real outage
  shows a stale sky with no notice. Keep the graceful fallback, add one chip
  near the caption when serving fallback: "showing the last gathered sky",
  with a quiet retry.
- `LegacyBook` share-state is unknown until toggled (`LegacyBook.tsx:114-119`);
  fetch it on mount so the toggle never misrepresents what is public.
- Every artwork image everywhere falls back to the warm plate, never a broken
  glyph.

---

## Part III: Build order

Sequenced so each step is visible on the live URL, per the standing rules
(typecheck before push, live URL first, no em dashes, no italics, warm earth
tones only). Model allocation per the pinned rule: Fable authors copy and
reviews; Opus takes judgment work; Sonnet takes mechanical work.

1. Tokens and consolidation (Sonnet, mechanical, unblocks everything):
   atlas tokens into `theme.css`, literals swept, one Toggle, one filters
   component, plate fallback shared, `.atlas-panel-dark` retired.
2. Legibility and wayfinding (Opus): chrome tiers with opacity floors,
   caption rewrite, control cluster reduced to three plus contextual,
   renames and the once-per-visitor gloss system, selection history push,
   phone half-sheet with camera recenter, `your light`, honest-state chips.
3. Dreams write the sky (Opus, shader and scene work, Fable reviews live):
   ignition overture with dream flares, resting tethered dreams, selection
   as inscription with `open the book`. This is Phase 1.5 built as specced.
4. The ceremony as one motion (Opus implements, Fable owns every line):
   globe behind every beat, piece context on arrival, consent folded to one
   choice in the dream beat, retry, replay, homecoming door in no-record.
5. Piece page and book (Sonnet with Opus review): three chapters, the
   invitation band, not-found homecoming door, book globe band, chapter
   verbs, no-record doors.
6. Fable acceptance on the live URL, the unboxing test below.

Dependencies outward: none of this blocks or is blocked by the ops gate
(`atlas-dim-world-ops.md`); it can all ship dark-launched before the customer
letters go out, and must: the letters send people into exactly these flows.

## The unboxing test (acceptance)

Run on the live URL, desktop and phone, by someone who has never seen it:

1. Cold visitor, three seconds after the globe settles: can they say what this
   is without being told? (They should say something like: his artworks around
   the world, and the dreams of the people who have them.)
2. Stop moving the mouse for ten seconds: is every orientation word still
   readable?
3. On a phone, tap a light: are the light and its dream visible together? Does
   the back gesture return to the sky?
4. Walk the email link to an ignited light in one sitting with one network
   drop simulated mid-claim: no reload, no dead end, map question asked
   exactly once, ordinal spoken, message received, replay works.
5. As a signed-in steward anywhere in the Atlas: one tap to your own light;
   from your book, one tap to see it among the others.

When all five pass, the interface matches the function.
