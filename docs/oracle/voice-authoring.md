# Oracle voice authoring

Local implementation, 2026-10-28. No manuscript edits, commits, deployment,
Apple Notes changes, or source-audio deletions are performed by this module.

## App integration

The bundled Oracle app now exposes a microphone action labelled “Rewrite this card
by voice” in each card's reading toolbar. It passes the visible reader lens into
`/authoring/:number?section=…`. The page opens or resumes the latest draft for that
card automatically. The reading journal provides “Voice drafts”, and the optional Home page provides “Your voice drafts”; the authoring Sessions
control lists existing drafts. Close returns to the card reader.

`src/mobile/authoring/OracleAuthoringPage.tsx` loads the same bundled manuscript
bytes and identifies them by SHA-256. Offline approval is an editorial approval of
that app-bundled revision, not proof that a remote canonical file has not changed.
A future canonical write still needs authoritative server-side source checks.
Transcription and AI services remain disconnected in this native integration.

The iOS app declares its microphone usage description. Review exports use a
main-frame, bundled-origin-only native handler and the system share sheet. Export
files are temporary copies; their cleanup never removes editing audio. The
existing account transport is unchanged. Microphone permission and share-sheet
presentation still need real-device verification; the simulator build compiles.

Integration tests run with `playwright.oracle-authoring-app.config.ts` against the
actual bundled app in iPhone WebKit and desktop Chromium, covering entry from a
card, auto-resume without duplicate sessions, return to reading, and home access.

## Delivered journey

The isolated `OracleAuthoring` component takes a versioned canonical manuscript
and an authenticated host service boundary. It offers microphone capture or audio
import, local saved sessions, original transcript entry, independent corrections,
manual timed excerpts, section assignment, full-section comparison, feedback,
explicit approval, and Markdown/editorial export. A JSON review file carries audio,
source, transcript, proposals and approval receipts to a computer. It is private
material; the file is not encrypted and should be transferred privately.

Each session is for one card, with multiple recordings and sections. The six lens
boundaries use exact character offsets into `oracle/cards/NN.md`. The entire original
Markdown, including metadata, is preserved with its revision and SHA-256. Only a
section with a proposal is replaced. Empty replacements are rejected. The caller
must validate the full candidate with the existing canonical parser/corpus checks
before any future application; structural headings inside a lens are part of its
proposed replacement and must survive editorial review.

Microphone recording saves each delivered MediaRecorder timeslice in a separate
IndexedDB chunk. Session metadata is saved before capture starts. Switching the
selected section, or changing `visibleSectionId` from the reader, adds a timestamped
section hint. These are evidence of what was visible, not proof of spoken intent.
Received chunks survive reload. Recovery retains only timestamps covered by saved
audio, and marks the result interrupted. An attempt with no delivered audio is retained
as an empty record, so recovery does not block later recordings. A browser crash may lose the last
undelivered slice; partial media containers may not decode on every phone. Keep the
recording screen open. Recording is capped at 20 minutes and 10 MiB; imports require
user-supplied duration and an audio MIME type. Import time is recorded for imported
files, not an inferred original recording date.

Raw transcript excerpts, their source/time range, provider and receipt time cannot
be overwritten through the store. Corrections and manual assignments are separate.
A hint or unresolved assignment blocks approval unless explicitly kept as reference
only. For a full recording spanning sections, preserve it as reference and add timed
excerpts for the specific sections. Reference-only material cannot support a
proposal. This supports manual transition correction now without claiming automatic
speech understanding. Each cited excerpt has a replay action on the speech and
comparison screens. Timing is explicitly labelled recording/manual/provider.

Proposals name transcript evidence and their manual or AI origin. Feedback records
changes, uncertain words, omissions, contradictions and unsupported additions.
Empty concern fields mean no concern was recorded, not an automatic claim that an
AI checked them. The reviewer explicitly confirms the comparison and feedback.
Approval re-fetches the current canonical source, checks both revision and bytes,
and binds the entire review to a digest. Corrections, evidence/assignment changes,
prose changes or feedback changes require fresh approval. Approved export checks the
current source again. No code path writes the canonical manuscript.

The approval and its Markdown receipt are saved in one IndexedDB transaction.
Receipts are append-only through the store and remain intact after later editing.
Portable imports verify review and audio hashes, create a new session identity,
retain historical receipts as reference, and clear actionable approvals. Hashes
check integrity, not identity or trust. Browser approval is an editorial record,
not an authorization token a server should trust.

## Integration contract

Import from `components/oracle/authoring/index.ts`:

```tsx
import { OracleAuthoring, manuscriptSource, reflectionTranscription }
  from './components/oracle/authoring';

const source = await manuscriptSource(cardNumber, immutableRevision, rawMarkdown);

<OracleAuthoring
  source={source}
  visibleSectionId={visibleLensId}
  services={{
    loadSource: async number => {
      const latest = await authenticatedCanonicalLoader(number);
      return manuscriptSource(number, latest.revision, latest.markdown);
    },
    // Optional, only when the host's private reflection API is actually available:
    transcribe: reflectionTranscription,
    // Optional authenticated AI adapter; absent by default:
    // propose: proposeWithConfiguredProvider,
  }}
/>
```

`loadSource` must fetch authoritative, current Markdown and revision. Never return
the session snapshot as a convenience fallback. The local preview dynamically loads
card 1 again. The host controls access, account boundaries, and whether authoring
should be mounted. App routes and native capture/export setup are now integrated as described above; account code is unchanged.
The host should remount the component when changing accounts or cards; local
storage currently belongs to this browser profile, not a signed-in account.

`AuthoringServices.propose(session)` returns `Proposal[]`. Each section proposal
must identify the provider/model, exact transcript evidence IDs and all five
feedback strings. It may suggest only sections actually discussed in its assigned
evidence. It must preserve the Oracle writing rules in `oracle/GUIDELINE.md`,
identify uncertainty rather than invent intent, and make omissions/contradictions
and unsupported additions explicit. Responses are validated, saved as proposals,
and never approved automatically. Stale responses are rejected if review context
changed. No local keyword matching is presented as AI. Provider/model configuration,
authentication and a real AI test are still required. Automated spoken section
transition detection is not implemented; a future timestamped transcription
adapter can return section-labelled excerpts, which still enter as unconfirmed
hints. Never invent word-level times from the current recording-level transcript.

## Existing service reuse and honest blockers

The opt-in `reflectionTranscription` adapter reuses the existing private reflection
capability check, idempotent session creation/audio upload and transcription retry.
Portable reviews retain the original private upload session ID for safe retries
on another device under the same account. It does not change the existing transcript via PATCH, publish invocations, or touch
published listening audio. Existing backend transcription is Groq Whisper with
Cloudflare AI fallback. Existing endpoints require admin authentication, DB,
ORACLE_PRIVATE, and a transcription provider binding/key. The current client rejects
that capability in the native Oracle build. Its response supplies whole-recording
text, without segment or word timestamps. If markers cross sections, its assignment
is unresolved. Provider failures preserve local audio for retry. Uploads currently
also appear in the existing private reflection journal; a separate editing namespace
needs backend coordination before broad rollout.

No live provider credentials or authenticated phone session was exercised in this
chat. Neither transcription nor AI rewriting is claimed production-ready. The local
preview deliberately has neither service connected and supports manual transcript
review. Published assets and login/account surfaces remain unchanged. Account sync is not implemented: portable export/import is the bounded
computer-review path. Browser storage can be evicted; the UI consistently asks for
export backup. No OS background microphone guarantee or native bridge is claimed.

Canonical application, verified durable server receipts, and source deletion remain
deliberately unavailable. To implement them later, the host needs authenticated
reviewer authorization, an authoritative source compare-and-swap in the actual write
transaction, canonical validation, an immutable server receipt containing approved
bytes and resulting revision/hash, read-back verification, and durable receipt
confirmation. Only then may a separate explicit deletion action target the listed
editing source asset IDs. It must never target unreviewed audio or opted-in listening
assets. No generic deletion hook is exported prematurely.

## Preview and verification

With the ordinary Vite development server, visit
`/components/oracle/authoring/preview.html`. This is a local development harness. The app uses `/authoring/:number` instead. `source` is real card-1 Markdown; all edits stay in
separate authoring storage and exported files.

Focused checks:

```sh
npx vitest run tests/unit/oracle-authoring
npx tsc --noEmit
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4239 npx playwright test tests/oracle-authoring.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --workers=1
```

Tests cover exact boundaries across all 64 manuscripts, CRLF/metadata preservation,
source staleness, approval invalidation, manual assignment/evidence requirements,
raw transcript protection, received-chunk recovery, optimistic multi-tab concurrency,
atomic approved receipts/imports, audio hashes, and fresh approval after transfer.
Browser checks cover audio import/playback, corrections, comparison, approval,
export/import and fake-microphone capture with section markers. Synthetic speech
and silence fixtures exercise behavior only; they are not manuscript edits or
real-provider transcription tests.

Latest integration verification: 16 focused unit tests, iPhone WebKit and desktop
Chromium integration tests, TypeScript, the app bundle build, native bridge tests,
and the iOS simulator build pass. The broader app suite passes 14/15; its remaining
failure is the deck-grid artwork visibility assertion at tests/oracle-app.spec.ts:261.
No production release or phone installation was performed here.
