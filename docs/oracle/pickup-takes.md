# Pickup of card recordings (takes)

The Mac (AR Create) can improve the transcript of a card recording made in the Oracle iPhone app,
the same way it already does for website reflections (`/api/oracle/pickup/segments`) and memos.
**Nothing calls these endpoints until AR Create on the Mac is updated to do so.** Nothing polls on a timer.

## When a take is listed
- The owner is signed in on the phone and the private copy is on (the default for the signed-in owner).
  Its audio then sits in R2 `ORACLE_PRIVATE` at `authoring/<user>/audio/<sha256>`.
- `AR_PICKUP_TOKEN` is set as a Pages secret (32 characters or more) and Pages has been deployed since.
  Without it every request below gets 503.
- It has no result yet at `authoring/<user>/better/<sha256>.json`.

## Every request
`Authorization: Bearer <AR_PICKUP_TOKEN>`. 503 `pickup is not set up on this site` while the key is unset or short,
401 with `WWW-Authenticate: Bearer` for a missing or wrong key. Errors are `{ ok: false, error }`.

## GET /api/oracle/pickup/takes?limit=N&cursor=C
Read only. `limit` 1 to 50 (default 20). Oldest first within a reply, by the recording time the phone sent (else upload time). Takes are chosen in audio listing order, so across calls a cursor visits each waiting take once.
```
{ ok: true, more: boolean, cursor: string | null,
  takes: [{ id, audioHash, hexagramNumber, sectionId, captureId, recordedAt, uploadedAt, durationMs,
            mimeType, byteSize, detailsKnown, status: "waiting", draft: null, audioPath }] }
```
- Fields the phone did not send are `null`; audio uploaded before details were kept has `detailsKnown: false`.
- Each call makes a bounded number of R2 list calls. When it stops early, `cursor` is set: call again with it
  until `cursor` is null to see the rest; it resumes right after the last take returned. `more` is true while there are more waiting than returned.
- 400 `invalid cursor`.

## GET /api/oracle/pickup/takes/{id}/audio
The audio bytes with their `Content-Type`. `Range: bytes=a-b` gives 206 with `Content-Range`; an unsatisfiable range
gives 416. 400 `invalid take id`, 404 `take not found`.

`id` is opaque: base64url (no padding) of `<user segment>/<sha256>`. Use it exactly as listed.
The server accepts only ids it would issue (canonical encoding, a 64 hex hash) and reads only that one key.

## POST /api/oracle/pickup/takes/{id}/transcript
Body at most 2,000,000 bytes (413 above). Same fields as the segments pickup, plus `audioHash`:
```
{ outcome: "improved", audioHash: "<sha256 of the audio>", resultHash: "<hex>", engine: "ar-create",
  engineVersion?: "2.1", text: "...", replace?: true,
  segments?: [{ startMs, endMs, text, speaker? }],
  words?: [{ text, startMs, endMs, probability? }], speakers?: [...] }
{ outcome: "skipped", audioHash, reason: "no speech" }
```
- `audioHash` must equal the hash in the id: else 400 `audioHash does not match this take`.
- Segments may also come as the segments pickup sends them (`start`/`end` in seconds, words nested in each segment);
  top-level `words` wins when present. `provider` is accepted for `engine`.
- Limits: text 100,000 UTF-8 bytes, 5,000 segments, 20,000 words, 32 speakers, word text 200 characters,
  times 0 to 6 hours with end not before start, probability 0 to 1. Anything else is 400.
- 201 `{ ok: true, result: "improved" | "replaced" | "skipped", take: { id, audioHash, outcome, resultHash, receivedAt } }`.
- Idempotent: the same `resultHash` again is 200 `result: "unchanged"`. A different result for audio that already
  has one is 409 unless the body says `replace: true`. A skip never replaces a kept result (200 unchanged);
  an improved result after a skip is taken.
- 404 `take not found` when the audio is gone. 409 `this take changed while the result was arriving` on a race:
  send it again.

## What the phone does with it
The result is stored beside the audio, nothing else changes on the server. The phone reads it through the owner-only
operation `better-get` of `/api/oracle/authoring/private` (its own prefix only) and merges it with
`mergeBetterTranscript` in `src/mobile/authoring/betterTake.ts`: the phone's draft is never overwritten, words the
owner has not edited become the Mac's (words under probability 0.6 are flagged to check), and edited words get a
comparison (accept, keep or decide later) instead of a replacement.

## Upload details (phone side)
`audio-put` takes an optional `details: { durationMs, cardNumber, sectionId, captureId, recordedAt }`, kept as R2
custom metadata. Each field is checked and bounded; invalid ones are dropped. Audio kept before details existed gets
them the next time the phone sends it.
