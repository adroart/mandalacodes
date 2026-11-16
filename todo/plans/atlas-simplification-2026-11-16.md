# Atlas simplification — Adrian’s decisions, 2026-11-16

These decisions supersede the conflicting resting-dream and temporary-gloss proposals in the older Atlas plans. They authorize local implementation; production publication is separate.

## Decisions

1. On keeping only Series and All/Placed/Seeking ground in the globe filter panel while retaining the artwork wall’s search and filters, Adrian chose: **“Simplify globe filters; keep wall controls (Recommended)”**.
2. On where dream text belongs, Adrian chose: **“Only in the opened piece card (Recommended)”**.
3. On optional dream-hopping and once-per-visitor explanations lasting six seconds, Adrian chose: **“Retire dream-hopping and temporary hints (Recommended)”**. The question explicitly retained connection lines, ordinary globe movement and permanent explanatory labels.

## Implementation scope

- Simplify the globe’s filter controls to Series and placement status in both rendering modes. Keep the wall’s search, kind/status filters and size controls.
- Remove rotating featured dreams and dream prose from the large globe selection preview. Preserve a clear way to open the selected piece.
- Closed wall tiles show artwork and titles. Full dream text and the art/dream turn belong inside the opened piece card. Retire the global face switch when closed tiles no longer have a dream face; search can still match dream text.
- Retire dream-hopping and timed visitor hints, including the optional mode. Retain connection lines, ordinary globe movement, meaningful permanent definitions and the collector migration boundary.
- No editor, manuscript, collector-ledger, authentication or migration changes.

## Verification

Implemented locally and reviewed on 2026-11-16. Fourteen relevant Atlas browser checks and thirteen focused kinship/dream-route unit tests passed. The affected phone case passed again after the final mobile stage adjustment, at 393 and 320 pixels. TypeScript checking passed.

Checks cover dream prose appearing only in opened records, wall dream-text search and filters, opening/closing on desktop and phone, retired controls under `?lenses=1`, legacy globe-filter URLs, no-WebGL fallback, retained status explanations and narrow-screen fit. Stage filter text contrast was measured in both Daybook and Nightfall: minimum 10.19:1. The phone stage no longer reserves the removed featured-dream band.

Manager inspected rendered screenshots at desktop 1440, phone 393 and filter 320 pixels. Populated fixtures are synthetic; local media delivery uses blue test plates, so these prove layout and text rather than artwork fidelity. The live public Atlas reported zero pieces at the decision audit. This verification does not create or prove real collector records.

Local screenshot copies: `/Users/adrianrasmussen/.codex/artifacts/atlas-simplification-20261116/`. Production publication remains separate.
