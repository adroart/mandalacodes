# Artwork readings

Per-artwork readings — the reading that belongs to a specific Universal Language
piece, framed around *that sculpture*, on top of the code it embodies.

A reading is **cached, authored prose** (not generated live). The website
renders these as stable, reviewable, SEO-indexable content on the piece/card
page; the oracle MCP returns them when present. They reuse the deck's own
CONCEPT §4 structure — the Glance (system-agnostic, no tradition named), then,
optionally, one voice opened beneath it — wrapped with the artwork's identity.

The per-*code* material already lives in `oracle/synthesis/` and the section
files. A reading here adds the piece-specific frame: its title, its materials,
where it lives in the Atlas, what this particular object asks of the seeker who
stands in front of it.

## File shape

One file per piece: `oracle/readings/<artworkId>.md` (e.g. `UL-122.md`).

```markdown
---
artwork: UL-122          # the FULL_ARCHIVE id
code: 1                  # 1–64, the oracle code it embodies
card_name: Earth's Breath
voices: [gene_keys]      # which voice(s) are opened beneath the Glance (or [])
length: short            # glance | short | full
status: final            # scaffold | in-progress | final (internal, never rendered)
---

The reading prose, in the deck's own voice.
```

## Method (do not break these)

- **Glance first.** Open with the system-agnostic reading — the code met as
  itself, no tradition named (CONCEPT §4).
- **Then a voice, if any.** Open only the voices listed in `voices`, each whole,
  never a compression of the Glance (CONCEPT §3).
- **Frame the piece.** A reading here is *about this object* — name it, let its
  material and its place in the world be part of the reading.
- **Quote no source prose.** Own voice throughout the poetic/transmission
  layers; honor lineages only where the deck is openly teaching (CONCEPT §11).

## Authoring

Start a new reading from the code's assembled material:

```bash
npx tsx mcp/oracle-server/src/scaffold-reading.ts UL-123
```

That writes a starter file with the front-matter filled and the code's material
quoted as commented guidance, for you (or Claude, on method) to render into
final prose. `UL-122.md` is the authored reference — match its register.
