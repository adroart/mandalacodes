# Private phone processing and continuity candidate

This change is local code, not a deployment. Production and installed apps need a new release before the hosted routes exist.

## Deployment dependencies

The Pages project already declares the private `ORACLE_PRIVATE` R2 bucket and shared account `DB`. Keep that bucket without any public domain or public development URL. The current account session/Better Auth configuration must work on the phone. No new SQL table or migration is required: owner-prefixed R2 documents use atomic ETag conditional writes.

Set Pages secret `GROQ_API_KEY` for hosted Whisper transcription. Set Pages secret `OPENAI_API_KEY` and environment variable `ORACLE_WRITING_MODEL` to an available OpenAI chat model supporting JSON response format and max_completion_tokens for writing and section assimilation. Full-card assimilation requests a bounded maximum of 24,000 output tokens to allow spoken evidence and exact passage links; select a model with that output capacity. Provider keys never enter the app bundle. Provider requests have a 90-second timeout; native HTTP permits 110 seconds. Missing providers return 503 with local work retained. No hosted provider or production secret has been verified by this local implementation.

Deploy Pages Functions plus the app together using the repository release procedure after a ship request. Verify signed-out rejection, native authenticated session, independent phone transcription and section review, private restore on a second device, and a concurrent-save 409 against that exact deployed candidate. These routes have not been live-verified.

## Transport and privacy

`POST /api/oracle/authoring/process`: account session required, production/native origin allowlist; operations capabilities, transcribe, propose, assimilate-sections. Hosted assimilation reuses the same evidence and cleanup validation as local AR Create. Transcription uploads are limited to 10 MiB and 20 minutes; bounded streaming body parsing rejects chunked oversized requests. A configured Mac bridge remains a compatibility fallback only for hosted 404/405/503 responses, never authentication rejection or provider failure. Localhost continues using local AR Create.

`POST /api/oracle/authoring/private`: account session required; operations list, read, save, audio-put, audio-get. Keys include the authenticated account id; no caller-controlled owner or public object URL. Audio is owner-scoped SHA-256 content-addressed and immutable, at most 10 MiB per capture. Documents are at most 2 MiB, with at most 100 audio references; list pages are bounded to 100 objects. Audio uploads precede the document commit. A failed document commit can leave private unreferenced audio but never a falsely acknowledged saved revision.

`save` always requires expectedRevision, null for a new remote document. R2 conditional puts reject stale revisions with 409. No last-write-wins retry or automatic conflict overwrite. Local IndexedDB remains the offline source. Account-scoped links record acknowledged remote ids and revisions only after successful save/restore. Restore validates source/audio hashes through the existing importer and creates a new local copy. Workspace drafts and resume position travel with the document; the UI decides when to restore them and must not silently overwrite current local drafts.

## Scope

Private continuity is opt-in and debounced while the voice workspace is open; it pauses during recording and does not retry unchanged conflicts. There is no OS background synchronization, deletion, garbage collection, or provider billing quota in this candidate. Initial sync and conflict choices are explicit; account isolation and conflict detection are enforced by the server. Existing local records remain usable if account/provider/storage access fails.

## Installed-app account release gate

The native account interface is currently gated by `VITE_ORACLE_NATIVE_ACCOUNTS=true` at build time and defaults off. A release must enable that flag only after the hosted account/session flow has been proven ready and trusted on the actual phone. Without this build flag, hosted private phone processing cannot obtain its required signed-in session through the app UI. This candidate does not flip the default or claim live authentication readiness.

Voice workspaces include linked cross-card section drafts and each card's private WorkingCardStore snapshot. Every peer retains and independently validates its own source card/hash. Linked ids and the shared audio-session id are remapped to fresh local ids; capture ids and original evidence receipts stay intact. Comparing a remote copy imports audio only. Peer drafts/titles are committed only after Open review copy or explicit Use synced writing; writing changes still require the compared local revision and preserve history.
