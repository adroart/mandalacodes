# Oracle voice authoring

Current local implementation, 2026-10-28. No canonical manuscript edits, existing
Apple Notes changes, publication or editing-audio deletion are performed here.

## Human words are authoritative

The default in-card editor is now **Your words**. It writes no AI prose. The first
safe spoken passage replaces that lens's published scaffold in a private working
card; later distinct speech adds literally. Exact repeats are accounted for without
repeating text. Correcting a previously incorporated transcript updates its original
untouched contribution; human edits are protected. Ambiguous revisions present an
explicit add/replace choice. Confidence warnings, unresolved destinations, known
mishearing patterns and likely transcription artifacts pause the affected section.
Confirmed words are checked against the exact corrected transcript before applying.

Working drafts are keyed by card and lens, independently of recording sessions.
They autosave with version checks/history, display in the actual reader immediately,
and survive close/reopen. Published prose is available through a reversible view
switch. No canonical manuscript is changed by this private working-card save.
Speech and direct typing both retain their literal phrasing. Pure routing prefixes
are omitted from displayed prose while raw speech stays saved.

**100% human words** describes displayed section provenance, not transcription
accuracy or editorial completeness. A card is wholly human only after all six
lenses contain exclusively human words. AI can transcribe; it does not paraphrase
this flow. Provider probabilities and routing/revision heuristics are not a
calibrated 90–95% accuracy claim.

Processing is an independent resumable activity. You can close the sheet, keep
reading or record again while transcription runs. Only uncertain passages require
review; safe sections apply live. Pending activity survives app restart and reuses
retained transcripts and existing backend job identities, avoiding duplicate audio
uploads or prose. Failure retains original audio. Working-card versions and audio
remain private to this device; no cross-device draft sync is implied.

The separate detailed review workflow remains available with `?authoring=review`
for legacy draft review. Its AI-writing service is not used by the default editor.

The private phone transport is implemented and the Mac HTTPS endpoint has been
verified. See [private bridge setup](../../tools/oracle-private-bridge.md). The phone
needs current Tailscale sign-in, the new app build and explicit address/key pairing;
physical-phone end-to-end use is not yet verified for this new flow.

## Detailed review workflow (legacy)

Every card reader has a visible microphone **Record** action. It opens a focused
sheet over that card, without changing the reader URL, scroll position or content.
The sheet restores focus to Record when closed. Text, controls and editors use the
Oracle's serif family. Card context remains visible behind the sheet.

Record, speak across as many cards or sections as needed, then Finish. Received
recording chunks save to IndexedDB. Automatic transcription preserves the original
words; the organizer proposes passages and destinations. The Transcript view shows
editable words, Code and Section menus, move-up/down controls and Split at cursor.
Edits save automatically. Writing is also directly editable, grouped by card and
section. Changing words, destinations or order retains existing writing and marks affected
comparisons stale. Opening Writing prepares only missing sections, preserving human
edits. Each passage destination is confirmed explicitly before approval.

Keywords are local routing hints, not AI understanding. Explicit card/code/gate/
hexagram numbers, including spoken forms such as “twenty-three”, suggest card
changes. I Ching, Gene Keys, Human Design and related section terms suggest lens
changes. “A chain” is flagged as a possible I Ching recognition error. References
such as “relates to hexagram 2” retain their current destination. “Which hexagram?”
without a destination stays unresolved. Every suggestion can be changed manually.

A recording can feed several card drafts without copying or discarding its audio.
The full original transcript is retained as reference; organized passages point to
it. Splitting keeps original words and source lineage, including when corrected
words have changed. Passage order is explicit and survives transfer. Recording-
level transcripts retain recording-level replay labels; no exact word timestamps
are manufactured when the provider did not return them.

Approval is one explicit action covering the displayed writing, destinations and
order. It checks every involved source snapshot and writes an immutable editorial
receipt. It does not apply changes to the canonical manuscripts. Undiscussed
sections remain untouched. Published listening audio is a separate asset.

More options contains the detailed editor/import, portable export and saved drafts.
Native exports use the system share sheet. The toolbar Record action is unboxed, and native select controls/options explicitly match the current light/dark colour scheme so menus remain readable. Review files contain private audio and
text, are not encrypted, and should be transferred privately. Browser storage may
be evicted; keep a copy before changing devices.

## Integration boundaries

- `src/mobile/OracleNavigation.tsx`: visible Record action and reader context.
- `src/mobile/authoring/OracleAuthoringSheet.tsx`: accessible modal, focus and scroll.
- `src/mobile/authoring/OracleAuthoringPage.tsx`: bundled manuscript loading, services
  and standalone `/authoring/:number` compatibility route.
- `components/oracle/authoring/OracleVoiceFlow.tsx`: editable transcript and writing.
- `components/oracle/authoring/EditableText.tsx`: debounced/blur/unmount saves.
- `lib/oracle/authoring/organization.ts`: keyword suggestions, splitting and lineage.
- `lib/oracle/authoring/{types,workflow,storage,transfer}.ts`: durable review model.
- `components/oracle/authoring/OracleAuthoring.tsx`: optional detailed editor.

The session retains `source` as its primary snapshot for compatibility and adds
`relatedSources` for other cards. Transcript/proposal `cardNumber` defaults to the
primary card. `order` and `parentId` identify organization and original speech.
A proposal key is card plus section, preventing identical lens names from colliding.
Related sources append without modifying earlier snapshots; raw speech and parent
relationships are immutable through the store. Corrections, routing and order are
editable. `sessionSources`, `transcriptCard` and `proposalCard` normalize legacy and
multi-card sessions. All source snapshots are required for `approveReview` and
`approvedManuscripts`; a stale secondary source blocks the entire approval. A
single-source export cannot bypass a multi-card source check.

Each source has exact character ranges into canonical `oracle/cards/NN.md`, a
revision and SHA-256. App snapshots identify bundled bytes as `app-manuscript:HASH`.
Offline editorial approval is approval of that version, not proof that a remote
manuscript is unchanged. A future write must recheck authoritative current sources
and validate complete candidates before applying anything.

Receipts include every original card source, raw/corrected words, audio references,
passage order, destinations, parent relationships, proposed writing, feedback and
explicit approvals. Approval and its receipt commit atomically. Subsequent edits do
not overwrite an earlier receipt. Portable imports verify source/review/audio hashes,
retain historical receipts, create a new local session identity and require fresh
approval. Hashes verify integrity, not identity or trusted server authorization.

## AR Create services

The app's Mac preview now uses `/api/oracle/authoring/ar-create`, a narrowly scoped
same-origin loopback bridge mounted by `vite.oracle.config.ts` for both development
and preview. It does not use a separate Groq provider or new API-key setup.

`tools/oracle-ar-create-bridge.mjs` connects to the existing AR Create service at
127.0.0.1:8841. It imports the captured audio through AR's supported intake, links
only the exact imported source to its recording job, starts transcription and
resumes that job's status. Upstream writes carry `X-AR-Actor: import:oracle` and
`X-AR-Client: http`, as required by the installed app. Public capability and the
installed contract are verified without reading private AR configuration or files.

Capture/audio-hash mappings are persisted outside Git. Retries cannot silently
upload different bytes or duplicate a confirmed import; uncertain import responses
stop for recovery. Pending jobs are polled by the app without another audio upload.
The bridge returns AR's real segment/word timestamps, confidence values, speaker
labels, warnings and its transcript-review link. Those provider records remain
immutable while corrected words and organization are editable. Provider duration
can extend a browser recording clock slightly; the saved capture reflects that
returned range rather than dropping aligned speech.

`tools/oracle-ar-create-writing.mjs` imports AR Create's maintained
`artifact-execution.mjs` helper from the sibling trusted checkout and uses its
bounded, output-only Codex account runner. It does not target whichever AR project
or manuscript happens to be open. No provider key is introduced. Writing requests
and validated results are fingerprinted outside Git; repeated pending/completed
requests reuse their receipt. Feedback, evidence, structural subheadings and the
source hash are checked before a proposal is returned. Account login, configuration,
hooks and permission controls remain in effect. No manuscript application is exposed.

Actual local verification used clearly synthetic spoken audio, imported through the
installed AR service: Whisper returned three segments and twenty aligned words.
The existing AR Codex runner also returned a validated synthetic writing proposal.
These are genuine local execution checks, not recognition-accuracy claims or proof
of arbitrary recordings. The first attempted import encountered the installed
write-attribution requirement and its conservative failed receipt was retained;
the successful proof used a fresh synthetic capture after the contract was fixed.
No existing recording, manuscript or active AR project was modified.

The bridge binds only the local Oracle preview; no new public listener, tunnel or
installed AR runtime change was made. Physical iPhone access to this Mac's AR
service still requires a private connection. The phone retains recordings and
reports that limitation explicitly; it never treats its own localhost as the Mac
or silently sends audio to a different provider. Browser checks with provider
fixtures remain separate from the real synthetic service checks above.

Canonical application, durable server receipts and approved source-audio cleanup
remain unavailable. A future authenticated write needs an atomic source comparison,
canonical validation, immutable server receipt, resulting revision/hash and verified
read-back. Only after that proof may an explicit cleanup action target reviewed
editing sources. It must never remove unreviewed recordings or listening assets.

## Verification

```sh
npx vitest run tests/unit/oracle-authoring
node --test tests/node/oracle-ar-create*.test.mjs
npx tsc --noEmit
npx vite build --config vite.oracle.config.ts
npx playwright test --config playwright.oracle-authoring-app.config.ts
npm --prefix mobile run build:simulator
```

Focused tests cover all 64 manuscript boundaries, metadata/CRLF preservation,
source staleness across cards, approval invalidation, raw-parent lineage, splitting,
spoken-keyword hints, ordering/routing, identical lens names across cards, atomic
receipts, concurrent tabs, transfer hashes and provider failure boundaries. Browser
checks cover the visible Record button, card-context popup, serif typography, focus
return, multi-card editing/reassignment/reordering, editable writing, approval and
one retained audio source. Fake-microphone processing cases use Chromium; WebKit
covers card integration and modal behavior. No publication or installation on the
physical phone is implied by local tests or the simulator build.

## Reconciliation improvements, 2026-10-28

1. Individual changes can use the suggestion, keep current text, or wait for review.
2. Partial acceptance composes the exact final section without losing unchanged text.
3. Added and removed words have distinct visual marks; long changes expand on demand.
4. Current text, spoken evidence and the editable result stay within the card sheet.
5. Raw and corrected speech can be compared alongside their recording playback.
6. Editorial uncertainties, omissions, contradictions and unsupported additions require explicit checks.
7. Changed speech, routing or order marks the affected comparison stale, preserving its writing.
8. A fresh comparison uses the latest assigned passages and resets earlier decisions.
9. Direct writing edits retain up to twenty previous versions for undo.
10. Needs-review filters and section progress expose unfinished reconciliation.
11. Missing sections are prepared without overwriting existing human edits.
12. Confirm-destination actions replace automatic confirmation at approval time.
13. Repeated passages and low-confidence provider words get visible attention hints.
14. Passage coverage shows whether words are linked to writing; orphaned drafts can move to Earlier writing while keeping the current section.
15. Pending saves, failed edits and unresolved decisions block completion or approval; local retries retain the unsaved text.

These are local editorial decisions. They do not apply a manuscript, publish a
card, or establish a phone-to-Mac connection. Old approvals remain receipts of
their original exact versions. Reconciliation metadata travels in portable copies.

## Second editor pass, 2026-10-28

The next fifteen improvements stay in the existing card sheet:

1. Search corrected words, original transcription and passage notes together.
2. Filter passages by code, section or attention needed, with explicit reset and empty state.
3. Preview exact repeated-word corrections across only the filtered passages, then apply explicitly.
4. Set passages aside and restore them without exposing protected original-parent transcripts.
5. Undo the last transcript correction, with a bounded twenty-version history per passage.
6. Keep private editorial notes attached to passages, excluded from generated writing.
7. Name drafts and see those names in the saved-draft list.
8. Restore Earlier writing against current evidence; preserve the displaced draft and require reconciliation again.
9. Export proposed writing as a plain-text draft without audio or editorial notes.
10. Replay recording audio at 0.75, 1, 1.25 or 1.5 times speed.
11. Jump to the next unfinished change, including deferred choices, with keyboard focus.
12. Undo the last reconciliation decision while the panel remains open, without bypassing stale evidence.
13. Read the composed writing in a clean view separate from the editing field.
14. Copy composed writing, with a selected text fallback when clipboard access fails.
15. Expand a concise summary of decisions and words added or removed.

Notes, names, correction history and set-aside state survive local saves and portable
review transfer. Their optional structure is validated before storage/import. Search,
filters, playback speed and the current decision-undo stack are transient controls.
Automatic writing still receives only corrected, assigned active passages, not notes.

## Recording to reconciliation, 2026-10-28

This pass removes steps inside the card rather than adding another workspace:

1. Pause and resume the same recording without counting the pause in its audio timestamps.
2. See a live input meter when Web Audio is available.
3. See mute/disconnect warnings and actionable microphone permission errors.
4. Change Reading during recording to save a timed section marker. A marker applies at the next aligned transcript segment; no artificial split or word timing is invented.
5. Add audio directly in the sheet, with detected duration and a manual-duration fallback.
6. Find saved recordings, replay their audio and see their transcription state together.
7. Transcribe a specific pending recording without rerunning completed recordings.
8. Finish transcription and organization before starting writing, so writing failures never hide the editable transcript.
9. Retry writing separately and keep each completed card's proposal when another card fails.
10. See the actual saved, transcribed, organized and reconciliation stages without invented percentages.
11. Review one card section at a time, with direct selection and next-section navigation.
12. Review one change at a time; a successfully saved decision advances to the next unfinished change.
13. Confirm the visible suggested destination route together, leaving unassigned words unresolved.
14. Follow an actionable next step for pending audio, destinations, writing, reconciliation or final approval.
15. Replay a low-confidence provider word from its actual timestamp beside the passage.

The sheet also ignores Escape during recording/processing/saving, keeps the shared
player near the editor, stops playback before recording, and leaves the full-list
review modes available. Final approval always remains explicit.

Audio chunks now persist as identical ArrayBuffer bytes because WebKit can reject
Blob/File storage. Existing Blob chunks remain readable, mixed old/new chunks play
and transfer together, and no database-version migration or audio deletion is used.
The public recording/storage interfaces continue to return audio Blobs. Source/audio
hashes and the atomic session/chunk transactions remain in place.
