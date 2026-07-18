# The Atlas interface: one unbroken motion

Status: authored 2026-07-17 by Fable from a three-way code map (UI surface, data
model, design system), live screenshots of every Atlas surface on desktop and
phone, and the ratified intention in `atlas-dim-world.md`. Revised the same day
from Adrian's corrections in conversation: the resting story is the connected
field, not floating dream text; the vision speaks as an overture, never as a
page in the way; the piece surface is a treasure, not a document; the certificate
is fine legacy print crowned by the art itself, no wood skeuomorphism anywhere;
the planet must read as a classy engraved earth receiving light, not a techno
globe of dots. Where this file and its first version disagree, this version
rules. This document is the
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
2. The dream is the largest text on any surface it appears on. And it is
   always legible: dream text never overlaps the globe's limb, the rim
   rings, or a light's bloom, and wherever a dream renders on the stage a
   quiet scrim guarantees its contrast. Legibility is never traded for
   composition. Adrian's ruling, verbatim: if you can't read the dream it
   does not exist.
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

Ruling (Adrian, 2026-07-17): the resting story is the field, not the words.
What a person must feel at the resting globe is the interconnectedness, a fire
of love that people are pouring into their pieces, the surprise of how many
and how connected. Dream text is what you discover when you lean in. So the
crowd is shown as light, the individual as text, and never many texts at once.

The first five seconds are the project. Sequence for a cold visit:

1. The vision speaks as the overture, never as a page in the way. Over black,
   two or three short lines in Adrian's voice ("Every piece I have ever made,
   connected into one living artwork. Each one carries the dream of the person
   who keeps it."), then the earth emerges through them as they dissolve. One
   continuous motion, no click, skippable with any input.
2. The founding lights ignite in claim order. Each ignition is a flare of
   warmth that pours into the land around it, not a text fragment. Total under
   5s, played only when lights exist.
3. The thesis caption fades in at the bottom left and stays at rest opacity:

   > Every piece Adrian has made, and the dreams they carry.
   > 64 pieces · 9 lights lit · touch a light to read its dream

   Two lines, Karla label case, and this is the only caption. The current
   two-line glossary caption is retired; glossing happens where terms appear.

4. At rest, the field is the image: kinship threads are on by default as faint
   breathing arcs, so the world reads as one connected web, and every light
   casts a standing pool of warmth onto the earth beneath it (see the planet
   section below). Where lights cluster, the land is visibly warmer; density
   of love reads as illuminated earth.
5. One dream speaks at a time. A single featured dream sits in one composed
   position (lower third, opposite the caption), complete text, generous
   Cormorant, a hairline tether to its light, cross-fading to the next roughly
   every 20 seconds. Full dreams get the full stage, one voice at a time,
   never soup. Tapping it travels to its light.

Returning visitors (localStorage flag) skip the overture and land on the
resting sky directly.

Honesty at small numbers: the field must read at 15 lights as an origin story,
never as emptiness. The embers (the whole body of work, dim) carry the scale;
the founding ignition carries the promise; nothing in the design may depend on
density to make sense.

Chrome layout at rest:

- Top left: room name (Atlas) and breadcrumb, secondary chrome.
- Bottom left: the thesis caption, orientation chrome.
- Bottom right: exactly three controls plus one contextual: `dreams` (the
  renamed drift), `threads` (on by default; the control quiets the web rather
  than summoning it), `filter`. `return` appears only while something is
  selected. `your light` appears only for signed-in stewards (below).
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

### The planet itself: an engraved earth receiving light

Ruling (Adrian, 2026-07-17): the current rendering, a dark sphere with
halftone dot continents, is a techno genre borrowed from dashboards and does
not fit. No wood skeuomorphism either; the pieces are wood, the site is the
frame. The earth may rest slightly dark, but it must be clearly and classily
the earth, and the image must say: we are bringing light to the earth, we are
strengthening it together.

Direction: the engraved earth. Continents drawn in the fine-atlas tradition
that matches the certificate's fine legacy grammar: hairline gold coastlines,
land textured with fine copperplate hatching, a whisper of graticule, warm
umber ocean, soft gold rim. The dot-matrix `LandDots` layer retires. And the
load-bearing move, which encodes the vision into the rendering logic itself:
every light casts a standing pool of warmth onto the land around it, so the
earth is progressively revealed and warmed by the love poured into it. At 15
lights, pools of dawn on a quiet engraving; at 300, whole continents aglow.
The lights do not sit on the world, they illuminate it.

Rendered mockups sit in `todo/plans/evidence/atlas-redesign/`. Adrian ruled
on the first sheet (`earth-contact-sheet.png`): the hairline family, variant
I. The elevation pass (`hairline-contact-sheet.png`, with `earth-hairline-a`
and `earth-hairline-b` large) makes the line itself do the work:

- Waterlined coasts: a soft luminous halo along the coastline with one
  discrete echo ring on the ocean side, the signature of antique engraved
  charts. Land stays nearly empty; the drawing lives in the line.
- The engraving catches the light: within a light's pool the coastline
  brightens toward warm white, so a dream visibly lights up the drawing of
  the earth around it, strongest where dreams cluster (Lisbon).
- Land lifted one shade above the ocean (the I-b value), so the earth is
  clearly present without approaching the hatched variants.
- A second hairline ring outside the rim, the fine-instrument border.
- Light pools slightly tightened from the first sheet so they read as
  radiance, not haze.

RULED 2026-07-17, refined the same day after seeing the first build: with
the earth, subtlety, less is more. Light pools compress toward warm gold and
never blow out to white; the land stays visible inside a pool; the rim rings
stay hairline-quiet; where lights cluster the fire reads as a greater warmth,
never as overexposure. The earth is the ground of the composition, not its
loudest voice; the dream text is always the clearest thing on the stage.

RULED 2026-07-17: Adrian chose the hairline family and delegated the final
call to Fable. The built earth is the elevated hairline with I-b's lifted
land value and NO graticule: waterlined luminous coasts with the discrete
echo ring, the coast catch-light near dreams, the fine-instrument double rim,
land one shade above the ocean, tightened pools. Implementation note: the engraved map renders to an
equirectangular texture at build time (the `world-atlas` data and `d3-geo`
are already dependencies; `scripts/generate-land-dots.ts` is the precedent);
the waterline and coast-brightening render into the texture's channels; the
light pools and the catch-light term accumulate in the sphere's fragment
shader from marker positions, capped and additive-warm.

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

### Room two: the Piece, a treasure and not a document

Ruling (Adrian, 2026-07-17): the piece surface currently reads like a data
website. It must read as a prize: a digital certificate and an entry into the
network, something a keeper is proud of and cannot wait to show someone. The
grammar to build from is fine legacy print, a fine-press edition page or a
great watchmaker's papers: warm paper stock, engraved-quality typography,
hairline rules, a real seal, generous margins, and the actual artwork as the
crown of the document. No wood rendering, no skeuomorphism; the art itself
carries the material.

1. The first screenful is the treasure. The artwork reproduced beautifully at
   the top, and beneath it the certificate flows as one composed object: the
   sigil (UL № 1), the founding-light ordinal rendered monumentally (the
   prize: a permanent, tamper-evident number nobody can ever take), the dream
   as the centerpiece at display size (law 2), the anchoring city, the
   lineage of keepers, the ledger seal. The scholarship (materials, edition,
   hexagram, full history spine, kin) reads on below the object in the three
   chapters: The work, The dream it carries, Its story.
2. Pride through craft, never gamification. No badges, no confetti, no share
   prompts. The prize feeling comes from specificity and permanence: your
   number, your dream in your words, your city, sealed in a chain that
   provably cannot be rewritten. The anti-spectacle rule stays load bearing.
3. If the piece is unawakened or seeking, one quiet invitation band sits
   directly under the title, above the fold on phones:

   > This piece is waiting for its keeper. Begin →

   The full claim block stays at the foot as today. QR arrivals must meet the
   door in the first screenful, not after 1,800 pixels of scholarship.
4. The not-found state gains the missing second door:

   > Holding a piece we do not know? Bring it home →

   routed to `/atlas/homecoming`. This is the single highest-leverage line in
   the whole redesign; the launch letter will send exactly these people here.

### The share card: the treasure that travels

"Cannot wait to show it to someone" needs an artifact that survives the trip.
Every piece gets a generated share card: the artwork, the dream, one line
("the 12th light · anchored in Lisbon"), the seal, composed in the certificate
grammar. It serves twice:

1. As social metadata, so a piece link dropped in a chat or story unfurls as
   the certificate, not as a website preview. The per-number card pages
   already server-render social tags (`functions/universal-language/
   [number].js`); extend that pattern with a per-piece card image endpoint.
2. As a possession: the steward can download their card from the book, theirs
   to post, print, keep, like the export.

Two binding rules: a private dream never appears on a share card (Ring 2
respected; the card falls back to piece, ordinal, city), and the card carries
no call to action, no logo shouting, nothing that smells like marketing. It
is the certificate, small.

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
4. The anchoring, then ignition. As the dream commits, its text visibly
   settles into the ledger typography, a quiet half-second ink-settling,
   form being anchored, no spectacle. Then the light flares (the re-ignition
   seam from 2b), the dream inscribes itself across the sky, founding lights
   replay, the camera arrives, the ordinal is spoken: "You are the 12th
   light." The feeling this beat owes the person: joyful completion, my dream
   has a form, a place, and will be seen for generations.
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
auto-open), but it reads as settings plus a timeline. It must open as a
treasure chest: your plate, your dream framed as the first page, your ordinal,
your light on the world, and then the tending controls. The export stops being
a utility row and becomes the possession it actually is: "this book is yours
to carry, independent of us," the continuity promise stated as ownership.
Four changes:

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
3. Resonant dreams (after launch, when the sky has enough voices). A quiet
   shelf in the book: "dreams that resonate with yours," public dreams only,
   starting honestly with kinship (pieces sharing the code's trigram, already
   computed in `utils/kinship.ts`) rather than machine similarity. It answers
   Adrian's intent that a keeper cannot wait to discover other people's
   dreams and where they are anchored, from inside their own treasure.
4. The no-record state becomes a door, not a wall:

   > Your account is signed in, but no piece is bound to it yet.
   > Claim with the email your piece was registered to → (sign-in switch)
   > Came to it another way? Request stewardship →
   > Holding a piece we do not know? Bring it home →

### One visual language

The Atlas is one place; it must be built from one set of materials.

The registers, corrected per Adrian 2026-07-17: the world is a dusk stage, an
engraved earth glowing with the light people have poured into it; the ceremony
is a quiet dark room between the world and the book; the certificate and the
book live on warm paper in fine legacy print, native to the rest of the site.
Not everything is dark, and nothing anywhere imitates wood. One sentence for
the whole system: an earth glowing with the light people have poured into it;
every certificate a fine legacy document crowned by the art itself; the
ceremony a quiet room between the two.

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
3. The engraved earth and the field (Opus, shader and scene work, Fable
   reviews live; GATED on Adrian ratifying the earth variant): engraved-earth
   texture replaces LandDots, standing light pools, threads on by default as
   breathing ambience, the vision overture, the featured dream (one voice at
   a time), selection as inscription with `open the book`.
4. The ceremony as one motion (Opus implements, Fable owns every line):
   globe behind every beat, piece context on arrival, consent folded to one
   choice in the dream beat, the anchoring settle, retry, replay, homecoming
   door in no-record.
5. The treasure (Opus, upgraded from Sonnet on 2026-07-17; this is design
   judgment, not mechanical hierarchy): the certificate as fine legacy print
   crowned by the art, the invitation band, not-found homecoming door, the
   book opening as a treasure chest with the globe band and chapter verbs,
   no-record doors, export as possession.
6. The share card (Opus): the per-piece card image endpoint extending the
   `functions/universal-language/[number].js` pattern, social tags, book
   download. Private dreams never on cards.
7. Fable acceptance on the live URL, the unboxing test below.

First-deploy verifications (the two things this environment could not prove;
check on the first preview deploy): the share-card endpoint's workers-og wasm
init on the real Pages runtime (fetch `/api/atlas/card/UL-122`, expect a PNG),
and a card carrying real Cloudinary artwork (this session's egress blocked
res.cloudinary.com, so the embed path was proven with a placeholder). Also
walk the book once as a signed-in steward; every auth-gated screen in phases
4 and 5 was verified by code reading only.

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
