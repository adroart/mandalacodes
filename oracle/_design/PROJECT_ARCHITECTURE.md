# Mandala Codes — Project Architecture

> The strategic foundation for how readers participate in the deck.
> This is not UI design. This is the *what* and *why* that the UI then
> surfaces. Read this before designing any commerce, account, map, or
> anchoring interface.

**Status:** in active design. Captures Adrian's strategic intent as of
2026-05-24.

---

## The core reframe

The deck is not "an oracle that also has a shop attached." It is a
**living project** that readers participate in at different depths.
Acquisition of original artwork is the **deepest tier** of participation,
not a separate commercial layer.

This means the design's job is to **invite participation at every level**,
not to "convert readers into buyers." Every level of participation is
meaningful. The reader who anchors at the lightest tier is participating;
they are not failing to convert.

---

## The audiences (three concentric)

1. **The curious / explorer.** Reads the codes. Feels something. May come
   back, may not. Lightest engagement. Free.
2. **The participant.** Wants to anchor into the project — find their
   chart, see which codes are theirs, place themselves on the map. Some
   commitment (free at minimum; print at low cost). Becomes part of the
   network.
3. **The collector / patron.** Wants the physical original sculpture in
   their home. Highest engagement. The deepest anchor.

These three audiences are not separate marketing segments. They are
**the same person at different stages of relationship.** A reader who
starts as curious may become a participant, then a collector. The
design's job is to make each stage feel complete on its own AND make
the next stage visible without pressure.

---

## The anchor tiers (concrete)

What actually exists, what's coming, what each tier offers:

### Tier 1 — The Chart Anchor (free)

The reader inputs their birthdate / birth time (astrology-style). The
system calculates which codes are in their chart. They see themselves
inside the deck — *"these codes are mine."*

- **What the reader gets:** their personal chart against the 64 codes.
  A visualization of which codes hold them.
- **What it costs:** free.
- **Status:** *the calculation code exists but is not yet integrated /
  applied. Should be built but is not.*
- **The deeper play:** chart placement may also place the reader on the
  map (a point on the grid). The grid is the visible network of all
  participants.

### Tier 2 — The Map Anchor (likely free, possibly small fee)

The reader places themselves on the visual map. Their point of light on
the grid. They become part of the network of anchored people.

- **What the reader gets:** a point on the map, possibly connected to
  others. Some sense of being part of a living project.
- **What it costs:** undecided. Probably free if it requires only chart
  data; possibly small fee for richer participation.
- **Status:** *map UI does not exist yet. Planned future feature.*
- **Note on honesty:** Until the map exists, design must not promise it.

### Tier 3 — Prints (mid-tier)

Physical print of the artwork. Smaller-scale, archival, takeable home.

- **What the reader gets:** a physical reproduction of the code's
  artwork. Their visual anchor.
- **What it costs:** print pricing (TBD; lower than original).
- **Status:** producible. Pricing and shipping logistics TBD.

### Tier 4 — The Original Sculpture (deepest)

The actual wooden sculpture for that code. Limited series by size.

- **What the reader gets:** the original physical piece. Carved/painted.
  Limited edition by size variant.
- **What it costs:** high. Variable by size and edition.
- **Status:** sculptures exist. Multiple size variants exist as limited
  series.
- **Note:** the sculptures often look digital in photos. Part of the
  acquisition narrative should help readers understand they are real
  physical objects.

---

## What this means for the UI

### Acquire is not one button. It is a ladder.

The bottom-nav "Acquire" element (if one exists) should open into a
**participation surface** showing all available tiers, not just the
original sculpture. The reader chooses their depth.

### The lightest tier needs genuine value.

Free chart + map placement only works as an entry point if (a) the
chart is genuinely useful for self-knowledge and (b) the map is
genuinely interesting (evolving, networked, real participants).
Otherwise the free tier is a vanity badge that satisfies without
compelling further engagement.

### The original sculpture is celebrated, not hidden.

The acquisition of an original is the project's deepest anchor act.
The UI for it should feel ceremonial and beautiful, not transactional.
Image of the piece, the story of bringing it home, materials,
dimensions, edition info, the anchoring framing. Then a dignified
buy path.

### The map and chart need to exist (or be honestly framed).

If the participation ladder promises chart + map but neither is built,
the reader who taps in finds a broken promise. Either build them first
or design the ladder honestly to say "coming soon" on the unfinished
tiers without making the whole ladder feel half-built.

---

## Risks and how to handle them

### Risk 1 — Decision paralysis

Three tiers can feel like *too many choices* and produce no action.
Classic ecommerce: the more tiers, the slower the decision.

**Mitigation:** the ladder shouldn't read as a price comparison
spreadsheet. Each tier should be its own clean invitation, framed as
"this is one way to anchor into the work." The reader is not choosing
between products; they are choosing their depth.

### Risk 2 — Tier dilution

If the free tier feels like "the answer," the reader may stop there.
They got their chart, they're done.

**Mitigation:** the free tier should be the *opening of a relationship*,
not a closing of one. The chart should reveal codes the reader is in;
those revelations should pull them deeper into the deck (read the codes
that are in your chart; the deeper teaching is in the cards). The map
should be an ongoing presence in their life (it evolves, others join,
events happen).

### Risk 3 — Complexity that hides simplicity

A three-tier participation ladder may be more architecture than the
project needs at launch. The reader who arrives early may not need to
see "Chart" + "Map" + "Print" + "Original" as four distinct paths.

**Mitigation:** consider launching with the ladder *implicit* —
present only the deepest tier (the original) visibly, and reveal the
lighter tiers as the deck evolves. Or launch with only two tiers
(chart + original) and add prints / map later.

---

## What Adrian has confirmed exists (2026-05-24)

The three strategic questions previously listed here turn out to already
have answers in the form of in-progress builds. Before designing the
anchor ladder UI, the next session needs to familiarize itself with
what's there.

### 1. The map — exists, in progress

Adrian: *"I already have the map going. It's on here. I just haven't
fully set it up or checked it. I have the initial build happening."*

**Known location:** branch `claude/atlas-port` (remote). Also visible
on main: `components/AtlasPage.tsx`, `docs/atlas-style-notes.md`,
`utils/kinship.ts`.

**Important reframe Adrian named:** the map is NOT
self-placement-by-readers. It is a curated grid where Adrian places
people. *"It's me asking something for them. This is a way that they
can connect to this grid to interconnect to different people."* When
people purchase, depending on what they purchase, they get different
icons on the map — like a beacon's strength:

- **Lightest tier** (registration + sharing of chart only): a dim dot.
- **Stronger tiers** (prints, smaller pieces): brighter beacons.
- **Deepest tier** (original sculpture): the brightest beacon.

The map's brightness/visibility for any individual scales with how
deeply they have anchored into the project. This is meaningful — it
means the map is alive as a visualization of the project's growing
network, with the depth of engagement made visible.

### 2. The chart calculator — exists, early version, in a branch

Adrian: *"As far as the chart calculator it should already be built
the early version as well. And it should be inside of here. If it's
mounted, it's inside of a branch."*

**Action for next session:** find which branch holds the chart
calculator. Probably `claude/atlas-port` or a sibling branch. Look in
the oracle pages for any birthdate / chart UI; check git branches for
"chart" or "calculator" or "natal" or "hologenetic" naming.

The Adrian-Website project history (a previous repo) had this work on
branch `claude/oracle-energy-birthdate-4HS3f` (from project memory).
That may have been ported.

### 3. The pricing ladder — set up in `MARKETING_POSITIONING.md`

Adrian: *"The pricing ladder should also already be set up inside of
the information."*

**Known location:** `oracle/MARKETING_POSITIONING.md` (33KB strategic
doc). Also relevant: `launchFlags.ts` at repo root, `utils/cloudinary.ts`,
and the existing BuySheet component (`components/oracle/BuySheet.tsx`).

**Action for next session:** read MARKETING_POSITIONING.md §IV (the
product ladder section) to surface what the pricing actually is. The
participation ladder UI design should derive from what's already
documented there, not invent new pricing.

---

## What the next session must do BEFORE designing the anchor UI

1. **Check out `claude/atlas-port` branch.** Look at the current map
   build. Understand the brightness-by-engagement-tier concept Adrian
   named.
2. **Find the chart calculator.** Look across branches and inside
   `oracle/` pages. Surface what's been built.
3. **Read `MARKETING_POSITIONING.md` §IV.** Internalize the pricing
   ladder as it exists.
4. **Reconcile what's built with what this doc claims.** Update this
   section once the truth is known.

Only after that should anchor-ladder UI design proceed. Designing
without knowing what's built risks duplicating effort or contradicting
existing infrastructure.

---

## The key insight to carry forward

The map is not a feature being added to the deck. **The map IS the
deck's living network.** Each card the reader engages with anchors
them deeper. The deepest anchor is owning the original sculpture; the
lightest is registering their chart. Both register on the map; only the
brightness differs.

This means the design's job for the bottom-nav "Anchor" entry point is
to present the participation as **a single thing with depth**, not as
a choice between separate products. The reader chooses their depth, and
the map reflects it visually.
