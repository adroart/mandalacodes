> Kept for history and reasoning. `docs/oracle/VOICE-STATUS.md` describes the current state.
> Stale here: it describes an isolated passage recorder and an older screen generation (the recorder file is now unused), and AI processing through AR Create on the Mac; today the phone uses the section workspace and sends to the site first.

# Passage-connected voice

Accepted design: the twenty passage-context improvements and printed-book / isolated re-record flow approved in conversation. Human speech remains literal. Explicit re-record replacements require editable transcript review; uncertain references never replace broad sections.

Implementation: pure anchors/matching/intent + tests; isolated teleprompter capture/review; reader selection and visible-context integration; targeted version-checked edits with provenance/undo; ordinary voice context and connection metadata. Keep exact source snapshots, preserve unrelated paragraphs, and retain audio. No manuscript publication or schema migration.

Verify targeted model/store tests, app typecheck/build, and actual phone/desktop selection→re-record→review→replace→undo. Repair the native-only spec exclusion discovered during the prior release. Semantic matching remains conservative and ambiguity visible; no unverified accuracy claims or automatic word-following scroll.
