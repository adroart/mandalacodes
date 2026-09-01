# The honest boundary

## What is true today, measured

The collector record moved to adrianrasmussen.com on 2026-08-09. This repo retired
its collector write path deliberately: `functions/api/atlas/_middleware.ts` answers
HTTP 410 for every `/api/atlas/*` route except three public reads, and its response
body carries an `error` code (`atlas_moved` or `atlas_reader_moved`), a plain-English
`message`, and a `destination` URL. The middleware is correct and stays.

What was never done is the other half. Fifteen frontend files still call thirty nine
retired endpoints, and not one of them reads the error code or the destination. So a
collector who signs in correctly and reaches the claim ceremony gets a generic failure
with a retry button that re-fires the identical request forever, and in places the raw
string `atlas_moved` is shown to a human mid-ceremony.

The files, by call count:
AdminAtlas 23, LegacyBook 8, StewardEdit 6, AdminPieceContent 4, PiecePage 3,
lib/atlas/catalog 2, StewardRequests 2, StewardClaim 2, AdminLayout 2,
lib/atlas/make 1, lib/atlas/homecoming 1, RequestStewardship 1, PieceSidePanel 1,
Homecoming 1, MakePage 1.

## The decision, already made

Do not revive the retired endpoints. The 410 is intentional and its survivor list is
correct. This work makes the boundary honest, it does not move it.

## The shape

One shared piece of plumbing, not fifteen ad hoc patches.

1. A single helper that recognises a moved-boundary response: HTTP 410 carrying
   `atlas_moved` or `atlas_reader_moved`. It returns the server's own `message` and
   `destination` rather than inventing copy per screen.
2. A single calm boundary surface that every affected screen renders in place of its
   error state. One sentence saying the collector record now lives on the artist site,
   and one working link to the destination the server named.
3. No retry control on a moved boundary. Retrying a 410 cannot succeed, and offering
   it is the defect. Keep retry for genuine transient failures only.
4. No raw error code ever reaches a human.

## Voice

The visitor is often mid-ceremony, holding a physical piece they may have just bought.
The tone is calm and matter of fact, not apologetic and not technical. It says where
the thing lives now and gives them the door. It never blames, never says "oops", and
never uses the word error.

House rules: no em dash character, no italics, text-only labels, every control
actionable.

## Done means

A collector reaching any retired surface sees one sentence and one working door,
never a raw code and never a retry that cannot work. Typecheck clean, unit tests no
worse than the 696 that passed before.
