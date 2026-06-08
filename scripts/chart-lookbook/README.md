# Chart-in-art lookbook

Generate a personalized PDF that highlights the Universal Language art pieces of
a person's chart — each piece with the energy behind it — so they can feel which
ones they connect to.

The whole thing turns on one fact: **gate N (in a chart) = code N (the oracle) =
piece N (the artwork)**. They share the 64 numbering, so each of the 11 spheres
in a hologenetic profile resolves directly to one art piece and its reading.

## The repeatable workflow (per client)

**1 · Get the chart as a profile JSON.** Eleven spheres, each `{ "gate": N,
"line": N }`. Two ways to produce it:

- **From a chart PDF** — open the client's chart with Claude (it reads the PDF),
  ask it to write out the gate+line for each sphere, and save as
  `clients/<name>.json`. (Claude has the oracle MCP, so it can confirm each code
  as it goes.) See `sample-profile.json` for the shape — include only the
  spheres you want featured.
- **From birth data** — compute it with `lib/astrology/buildHologeneticProfile`
  (the same engine the site uses) and dump the result to JSON. Fully automatic,
  no PDF needed.

**2 · Generate.**

```bash
npx tsx scripts/chart-lookbook/generate.ts clients/adrian.json --name "Adrian" --pdf
```

- Always writes `clients/adrian-lookbook.html` (self-contained, print-ready).
- With `--pdf`, also renders `clients/adrian-lookbook.pdf` if Playwright's
  chromium is installed (`npx playwright install chromium`, once).
- Without `--pdf` (or if chromium isn't installed), open the HTML and **Print →
  Save as PDF** — same result.

**3 · Send it.** One cover page (their name + a contact-sheet of all the pieces)
then one A4 spread per piece: the art, the sphere it answers in their chart, the
essence, the Gift, the Shadow→Gift→Siddhi spectrum, and their specific line —
ending with a quiet "does this one move you?".

## What each spread pulls (all from the shared oracle corpus)

| Element | Source |
|---|---|
| Art image | the piece's Cloudinary id (code-numbered), via `utils/cloudinary` |
| Card name + essence | the code's synthesis |
| The Gift (+ Shadow/Siddhi names) | `gene_keys` voice |
| Your line | the gate's specific moving line |
| Sphere + its role | `build-data.ts` `SPHERES` |

## Customizing

- **Which spheres** — pass a subset in `buildLookbookData(profile, { spheres })`,
  or just omit spheres from the JSON. Default is all 11, grouped Activation /
  Venus / Pearl.
- **Design** — everything visual is one `<style>` block in `template.ts` (paper
  /wood/bronze, A4 spreads). Edit there; re-run to preview.
- **Energy text** — swap which fields a spread shows in `template.ts` `spread()`
  (e.g. lead with the line instead of the Gift, or add the I-Ching reading).

## Note

The art images load from Cloudinary at render time, so render where the network
can reach it (your machine). Sphere names (Life's Work, Radiance, …) are Gene
Keys teaching terms — fine to use in a teaching/curation document; credit the
Gene Keys / Human Design lineage on the deliverable per `oracle/CONCEPT.md` §11.
