# Phase 3: The big latent assets (execution brief)

_Written 2026-07-10 against the audit in `todo/DEVELOPMENT-STATUS.md` (Part II sections B,
C4, C5, C10, and Part I item 12). Every file path, line count, and import claim below was
verified against the actual code on this branch before writing. This brief is self-contained:
a fresh agent can execute any task without reading the audit first. Each task carries its own
goal, files, spec, acceptance, needs-Adrian flags, and size._

Default decision on the dead code (Adrian can override before execution): remount ONLY the
coin-cast divination ritual; delete everything else in the inventory below.

---

## Task 1: Dead-code resolution (delete the superseded reading system, remount the coin cast)

### Goal

The old oracle-reading design was replaced by the current Oracle Entry deck
(`components/oracle/entry/OracleEntryPage.tsx`) and the generated EB reading
(`components/oracle/eb/generated/`), but the old components were never removed. They compile,
they ship in review noise, and one of them (the coin-cast ritual) is genuinely worth keeping.
Resolve all of it in one pass: delete the dead set, remount the ritual on the card page.

### The verified inventory

Every file below was checked for importers across `App.tsx`, `components/`, `lib/`, `utils/`,
`hooks/`, and `src/`. "Zero importers" means no live file imports it; comment-only mentions
are noted.

| File | Lines | Verdict | Import status (verified) |
|---|---|---|---|
| `components/UniversalLanguageIndex.tsx` | 933 | delete | Zero importers. The name `UniversalLanguageIndex` in `App.tsx:4` is a lazy-import ALIAS pointing at the NEW `components/oracle/entry/OracleEntryPage.tsx`, not this file. |
| `components/oracle/CoinCast.tsx` | 629 | REMOUNT | Zero importers (only a comment mention in `HexagramGlyph.tsx:10`). See remount spec below. |
| `components/OracleCardEntrance.tsx` | 404 | delete | Zero importers. The entrance now lives inside `EBReadingHost` (`showEntrance` prop). |
| `components/oracle/ChapterWordmark.tsx` | 242 | delete | Only importer is `ReadingStage.tsx`, itself dead. |
| `components/SystemOverlay.tsx` | 171 | delete | Zero importers. |
| `components/oracle/ImageViewer.tsx` | 168 | delete | Zero importers. `CoinCast.tsx:163` mentions it in a comment only ("pattern matches ImageViewer"), so deleting it is safe even with the remount. |
| `components/oracle/ReadingStage.tsx` | 149 | delete | Zero importers. |
| `components/oracle/CorrespondenceSheet.tsx` | 144 | delete | Zero importers. |
| `components/oracle/ProfileSummary.tsx` | 141 | delete | Zero importers. |
| `components/oracle/Constellation.tsx` | 113 | delete | Only importer is the dead old index. `components/atlas/Globe.tsx:2` says "Constellation-style" in a comment only; the atlas fallback globe does NOT use this component. |
| `components/account/AuthButton.tsx` | 27 | delete | Zero importers. This is the duplicate account button; the live one is the `accountAware` Account entry in `NavigationCore.tsx` (NAV_ITEMS, line 46). |
| `components/shared/LongformElements.tsx` | 51 | delete | Zero importers. Longform-reading scaffolding. |
| `components/shared/SideNav.tsx` | 35 | delete | Zero importers. Longform scaffolding. |
| `components/shared/BackToTop.tsx` | 26 | delete | Zero importers. Longform scaffolding. |
| `components/shared/ProgressBar.tsx` | 15 | delete | Zero importers. Longform scaffolding. |
| `components/shared/Reveal.tsx` | 23 | delete | Zero importers (the string "reveal" elsewhere is unrelated: `revealCount` in CoinCast, `.reveal` CSS classes). |
| `hooks/useReveal.ts` | 18 | delete | Only importer is `Reveal.tsx`, deleted above. |

**Totals: 2,660 lines deleted, 629 lines remounted, 3,289 lines resolved.** The audit's
"~2,200" figure matches only the four largest files (933 + 629 + 404 + 242 = 2,208); the full
set is about 1,100 lines larger.

### What deletion does NOT strand (checked)

- `lib/oracle/search.ts` stays: the old index was its only in-app UI, but the HTTP surface
  (`functions/api/oracle/search.ts`, `functions/api/oracle/mcp.ts`) and
  `scripts/build-search-index.ts` still consume it. Note for the record: deleting the old
  index removes the only in-app full-text search UI. That was already true in effect (the
  page is unreachable); the loss is nominal, not real.
- `lib/oracle/journal.ts` and `lib/oracle/elements.ts` stay: both are used by the live
  `OracleEntryPage.tsx`.
- `utils/ichingCasting.ts` (186 lines) stays: it is CoinCast's engine and CoinCast survives.
- Optional tidy: the `.reveal` CSS classes in `src/index.css` become unused after deleting
  `Reveal.tsx` / `useReveal.ts`. Prune them or leave them; either is fine.

### Remount spec: the coin-cast ritual

**What it is.** `components/oracle/CoinCast.tsx` is a complete I Ching coin-casting flow
styled as a museum-plate row: the card's fixed hexagram on the left, the cast resolves which
lines are moving, moving lines flip in place, and the "becoming" hexagram slides into the
right slot. Its result already routes to the changed code: the "Read Code N" affordance
navigates to `/universal-language/${changedNumber}` (CoinCast.tsx around line 619), and that
route exists (`App.tsx:104`). No routing work is needed.

**Component contract (CoinCast.tsx line 316).** The parent owns the cast state:

```
{ primaryNumber: number; cast: CastResult | null; casting: boolean;
  onCast: () => void; onCastingDone: () => void }
```

`utils/ichingCasting.ts` provides `castForHexagram(primaryNumber): CastResult` (and a
`castFree()` variant that needs no primary card).

**Where it remounts.** In `components/UniversalLanguageCard.tsx`, as an appended section
between `<EBReadingHost>` and the sticky bottom prev/next nav (between lines 206 and 224 of
the current file). Follow the exact pattern the sticky nav already uses: wrap the section in
`<div className="eb-reading" data-palette={palette}>` so it inherits the museum-plate
variables in both light and dark. Do NOT edit anything under
`components/oracle/eb/generated/`: those files are an imported design artifact with no
regenerator script in `scripts/`; the host's only injection points are `chartSlot` and
`headerChartSlot`, neither of which fits a full-width section.

**Parent wiring in UniversalLanguageCard.tsx:**

```
const [cast, setCast] = useState<CastResult | null>(null);
const [casting, setCasting] = useState(false);
// reset when the reader navigates card to card:
useEffect(() => { setCast(null); setCasting(false); }, [card.number]);
onCast:        () => { setCast(castForHexagram(card.number)); setCasting(true); }
onCastingDone: () => setCasting(false)
```

**Entry point.** The card page itself is the entry point: the ritual appears at the bottom of
every reading as "cast the changing lines for this code." No nav item, no new route. The
component's own idle state is the invitation.

**Downstream effect.** Remounting revives the Part I "per-hexagram becoming" writing task
(the audit's dependency note said: decide B before scheduling that task). With this remount,
that writing task becomes real again; the current line texts come from
`data/ichingLines.ts` (placeholders) with `data/cardMarkdown.ts` scaffold fallback, which is
what CoinCast already reads.

### Needs Adrian

- The default decision itself: remount only CoinCast, delete the other 17 files. Override
  window is before execution, not after.
- Placement sign-off: bottom-of-reading is the proposed spot; if Adrian wants it inside the
  I Ching plate section instead, that means editing the generated EB files and should be
  re-scoped (deeper, riskier).
- Optional, do not build without his call: a card-free "cast the coins" entry on the deck
  index using `castFree()`.

### Acceptance

- All 17 delete-verdict files and `hooks/useReveal.ts` are gone; `grep -r` for each deleted
  component name across `App.tsx components lib hooks src utils` returns nothing but the
  known unrelated strings (`revealCount`, `.reveal` CSS if left).
- `npm run typecheck` passes and `npm run build` passes.
- On any card page: the cast section renders in both palettes, casting animates (and resolves
  as a quiet fade under reduced motion, which the component already handles), and "Read
  Code N" lands on `/universal-language/N` for the changed hexagram.
- Prev/next sticky nav and Acquire/Share are unaffected.

### Size

Half a day. The delete is mechanical; the remount is one state block and one section.

---

## Task 2: Chart-to-art lookbook in-site ("The Art of Your Chart")

### Goal

`lib/oracle/recommendation.ts` turns a person's 11-sphere chart into a personalized gallery
of the actual artworks (one piece per sphere, with the energy each code carries). It is fully
built and consumed only by the external endpoint (`functions/api/oracle/recommendation.ts`)
and the offline generator (`scripts/chart-lookbook/`). Zero in-app callers. This is the
richest built-but-unreachable experience in the codebase; give it an in-app surface.

### Verified facts

- Engine: `lib/oracle/recommendation.ts` exports `SPHERES` (11 spheres in reading order,
  each with label, role sentence, and sequence: Activation / Venus / Pearl) and
  `assembleLookbook(cards, profile, opts) -> LookbookData`. Each `LookbookPiece` carries
  sphere, role, sequence, gate, line, cardName, keywords, essence, gift/shadow/siddhi names,
  lineReading, pieceId, pieceTitle, and two Cloudinary URLs (`image` at w=1400, `thumb` at
  w=360).
- The client already holds the chart: `lib/profile/context.tsx` (`ProfileProvider`, mounted
  app-wide in `App.tsx`) exposes `profile.computed`, a `HologeneticProfile` with all 11
  spheres as `{gate, line}`. Local-first (localStorage), synced to D1 when signed in.
- The hosted endpoint `POST /api/oracle/recommendation` accepts
  `{ profile: <11-sphere chart> }` and returns the full `LookbookData`. It bundles
  `data/oracle-corpus.json` server-side. It is optionally gated by `ORACLE_API_TOKEN`
  (per `docs/secrets-sync.md` the token is optional; when unset the endpoint is per-IP
  rate-limited instead).

### Spec

**Data path: call the existing endpoint, do not assemble client-side.** `assembleLookbook`
needs `CanonicalCard[]` from `data/oracle-corpus.json`, which is large and not shipped in the
client bundle; the endpoint already has it. The new page POSTs same-origin to
`/api/oracle/recommendation` with `{ profile: profile.computed, clientName: <none> }` and
renders the returned `LookbookData.pieces`. Cache the response in `sessionStorage` keyed by a
hash of the chart so revisits within a session do not re-hit the astronomy-free (profile
provided) path; one POST per fresh visit is well inside the rate limit.

**Gate check before shipping:** verify whether `ORACLE_API_TOKEN` is set on the live Pages
project. If it is set, the in-app call will 401; the fix is Adrian's choice of (a) unset it
(the rate limiter is the floor) or (b) add a same-origin exemption in the function. Flagged
below.

**Where it lives:** new route `/profile/lookbook` (working name "The Art of Your Chart"),
new lazy component `components/oracle/ChartLookbook.tsx`, registered in `App.tsx` next to
the `/profile` route. When no profile is saved, the page renders an invitation to create one
(link to `/profile`), mirroring how the profile page itself falls back to the form.

**What it renders:** the 11 pieces in `SPHERES` order, grouped by sequence (Activation,
Venus, Pearl), each showing the artwork image, piece title, sphere label + role sentence,
card name and gate.line, and one line of energy text (essence or gift). Each piece links to
its card at `/universal-language/:gate`; once the Phase 2 card-to-piece bridge exists, also
to the physical piece. The curator `recommendation` block (intention / closing / picks) is
part of the API shape but is a concierge input; the self-serve page omits it unless Adrian
decides otherwise (flagged).

### Needs Adrian (design session, do not decide visual design in-agent)

- Layout and placement: one long scroll vs grouped-by-sequence chapters vs grid; hero
  treatment; how much reading text per piece.
- Naming: "The Art of Your Chart" is the working name only.
- Whether the curator recommendation block appears for self-serve visitors or stays a
  concierge-only feature of the external quote flow.
- Whether pieces link onward to acquire (the BuySheet exists on the card page).
- The `ORACLE_API_TOKEN` question above (ops check plus a policy call if set).

### Acceptance

- With a saved profile, `/profile/lookbook` renders 11 real artworks resolved from the
  visitor's own gates, grouped by sequence, each linking to its card.
- Without a profile, the page invites chart creation and links to `/profile`.
- The page makes exactly one POST per fresh session (cache verified).
- `npm run typecheck` passes.

### Size

One day of build after a design session with Adrian settles the layout questions.

---

## Task 3: Profile as hub (nav item + four doors)

### Goal

The profile page (`/profile`, `components/OracleProfile.tsx`) already links each chart
position to its card and the birth place to the Atlas, but the page itself is reachable only
via in-page links, and it opens no doors onward. Make it the hub: add Profile to the main
nav, and add doors to collections, the lookbook, today's real transit, and the owner's
pieces on the map.

### Verified facts

- The nav is `components/NavigationCore.tsx`, `NAV_ITEMS` at line 41: Deck, The Systems,
  Learn (external), Atlas, Account (accountAware). `components/Navigation.tsx` is the router
  shell; `NavigationStatic.tsx` renders the same bar for the static `/learn` library, so one
  edit to NAV_ITEMS updates both surfaces.
- The nav measures itself and collapses to the mobile sheet on real overflow (`menuFits`
  logic), so adding an item is safe but needs a narrow-width look.
- Profile page: form when no profile, `ProfileGraph` + share when one exists. It already
  links the birth place to `/atlas` (OracleProfile.tsx around line 113) and each sphere to
  `/universal-language/:gate` (ProfileGraph.tsx `goCard`).
- `components/oracle/TodayEnergyPanel.tsx` is built and mounted nowhere; it renders the gate
  the Sun is actually transiting via `todaysEnergy()` from `lib/astrology/today.ts` (the real
  sky, unlike the deck's date-hash tile).
- Destinations that exist today: `/account/collections` (`App.tsx:130`), `/atlas`
  (`App.tsx:107`). `AccountDashboard.tsx` already links to `/profile` and
  `/account/collections`; these doors complete the loop in the other direction.

### Spec

1. **Nav:** add `{ path: '/profile', label: 'Profile' }` to `NAV_ITEMS` in
   `NavigationCore.tsx`, proposed position between Atlas and Account. Verify the bar at
   narrow widths (the overflow sheet must pick it up) and verify the static `/learn` bar
   shows it too.
2. **Doors row on the profile page:** in `OracleProfile.tsx`, below the graph (profile-saved
   branch only), add a compact row of four doors:
   - **Your collections** -> `/account/collections`.
   - **The Art of Your Chart** -> `/profile/lookbook` (Task 2; if Task 2 has not shipped,
     hold this door out rather than linking to a 404).
   - **Today's transit** -> mount `TodayEnergyPanel` inline right here (it is a panel, not a
     page). This also closes the profile half of Part I item 2 for free.
   - **Your pieces on the map** -> `/atlas`. Honest label note: lighting the signed-in
     owner's own pieces on the globe is audit item C7 and is NOT built; until C7 ships this
     door is a plain atlas link, so word it as "See the Atlas" or ship it after C7 (flagged).
3. Keep the existing birth-place-to-Atlas link and sphere-to-card links untouched.

### Needs Adrian

- Nav label: "Profile" vs "Your Chart" (the page title is "Your Hologenetic Profile").
- Door wording and visual treatment (the page is hand-styled inline; match its Cormorant /
  Cinzel voice, but the arrangement is his call).
- Whether the pieces-on-the-map door waits for C7 or ships as a plain atlas link now.

### Acceptance

- Profile appears in the top bar on every app page and on the static `/learn` bar; the
  active underline works on `/profile`; the mobile sheet includes it.
- With a saved profile, the four doors render; TodayEnergyPanel shows the real transit gate
  and its card link works.
- Without a profile, the doors row does not render (the form branch is unchanged).
- `npm run typecheck` passes.

### Size

Half a day.

---

## Task 4: The procession (design questions only, for a brainstorm with Adrian)

**Verified:** grep for "procession" across `components/`, `lib/`, `functions/`, `utils/`,
`hooks/`, and `src/` finds nothing in code (the only hits are prose inside
`data/oracle-corpus.json`). Nothing exists. The ignition opening and claim-replay animations
exist but are not this. Per the audit, this is design-first: what follows is the one-page
question set for the brainstorm, not an implementation spec. Do not build anything from this
task until the brainstorm happens.

### What is it, in one line

A guided founding-story tour: the low-key engagement engine that narrates the founding
lights in order (Part I item 12).

### Questions to settle with Adrian

**What it narrates**
- The founding lights in claim order, or in Adrian's chosen story order?
- Per stop, what speaks: the piece, the place, the holder's shared intention, the code, or a
  written narration line in Adrian's voice? (If the last: that is new writing on the
  writing backlog, one line or paragraph per founding light.)
- Does the tour tell one continuous story (the founding of the field) or 64 small ones?

**Where it lives**
- On `/atlas` as a mode: the camera flies the globe from light to light while a caption rail
  narrates? (Most of the machinery, camera rig and markers, already exists in
  `components/atlas/three/`.)
- A standalone route with its own pacing and no globe chrome?
- A strip on the home entry or the gateway that plays inline?
- What does the non-3D visitor get (the atlas currently has no non-3D branch at all; that
  fix is another phase, but the procession must not deepen the gap)?

**How it starts**
- A quiet invitation on the atlas ("walk the founding lights")?
- Auto-offered on a first visit, or never auto-played?
- Deep-linked from a piece page ("this is founding light #N; see the procession")?
- Does the ignition (claim light #1) trigger or premiere it?

**Pacing and shape**
- Auto-advance or tap-to-advance? How long is a stop? Can it be left and resumed?
- All founding lights, or the first N with "continue"?
- Sound or silence?
- Where does it end: an invitation into the deck, to the seeking-ground pieces, to the
  claim path?

**Dependencies to note in the brainstorm**
- Founding-light ordinals and claim events already exist in the atlas data; the narration
  text (if Adrian-voiced) does not.
- The map is currently dark (no claims yet); the procession only has material after the
  ignition and outreach begin (Part 0 of the status doc). Sequence it accordingly.

### Size

The brainstorm itself. Implementation gets sized after it (audit guess: moderate to deep).

---

## Task 5: Confirm-only items

### 5a. The erase / break-glass endpoint stays curl-only (confirmed, nothing to build)

`functions/api/atlas/inscriptions/erase.ts`, `POST /api/atlas/inscriptions/erase`, body
`{ inscriptionId, reason }`, gated by `requireAdmin`. Its header comment states it is
admin-only "by design and by ratified decision": there is NO self-serve erasure; it exists
solely to honor an explicit legal data-erasure demand, deletes the body and content salt
(making the chain commitment unlinkable), logs the reason admin-side, and leaves a tombstone.
**Verdict: intentional. No admin button. This brief records the confirmation; the audit's
"likely intentional; confirm" is now closed.** If Adrian ever wants a button, that is a new
decision, not a repair.

### 5b. Traditional colors and color inspiration get a home

**Goal.** Every card carries `traditional_colors` and `color_inspiration` (both strings on
`OracleCard` in `data/oracleData.ts`, lines 38 and 43, already in the client bundle for all
64 cards). Rendered nowhere, despite the art being about color and light.

**Cheapest mount point (proposed default):** a small "Color" plate in
`components/UniversalLanguageCard.tsx`, appended between `<EBReadingHost>` and the sticky
bottom nav, exactly the pattern Task 1 uses for CoinCast (wrap in
`<div className="eb-reading" data-palette={palette}>` so it matches the museum plates in
both palettes). Two short labeled rows: "Traditional colors" and "Color inspiration". If
Task 1 ships first, place it adjacent to the cast section; the two appendix plates share the
wrapper.

**Alternatives considered (for Adrian to pick from, not for the agent to decide):**
- Inside the BuySheet (`components/oracle/BuySheet.tsx`): color in the acquire context,
  where a buyer is looking at the physical piece.
- In the Task 2 lookbook: each piece's traditional colors alongside its artwork.
- These are additive; the card-page plate is the default because it is one file, no new
  routes, and the data is already loaded there.

**Needs Adrian:** placement pick and the two row labels (his voice).

**Acceptance:** both strings render for any card in both palettes; no edits under
`components/oracle/eb/generated/`; `npm run typecheck` passes.

**Size:** quick (under an hour once placement is picked).

---

## Shared postscript (applies to every task above)

- Run `npm run typecheck` before every push. CI enforces it; the build alone passes code
  that CI then rejects.
- Restart the dev server after structural edits (new/deleted/moved files). HMR and
  hard-reload both lie about structural changes. Kill duplicate servers on ports 2222,
  2223, and 2224 before judging what you see.
- Task 1 is the gate for the "per-hexagram becoming" writing task; Tasks 2 and 3 share the
  `/profile/lookbook` route (ship 2 before wiring that door in 3, or hold the door);
  Task 4 produces no code; Task 5 is independent.
