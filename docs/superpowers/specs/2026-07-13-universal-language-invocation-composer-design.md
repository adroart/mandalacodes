# Universal Language Invocation Composer and Publishing Design

## Transformation model

After arranging journal segments, the administrator selects **Shift to Invocation**. The segment stack transforms into a full-screen Markdown editor. This is another view of the same material, not a disconnected copy.

Each imported paragraph retains a hidden segment identity:

- Editing the linked Markdown paragraph updates its source segment transcript.
- Editing the source segment later updates its linked paragraph.
- Newly authored invocation prose may remain invocation-only without creating artificial recording segments.
- Reordering linked paragraphs updates composition order while preserving original timestamps.

## Markdown artifact

Saving produces a real, versioned Markdown artifact associated with the hexagram. Use a stable human-readable filename such as `invocation-22-grace.md`; versions are records, not filename proliferation. The document contains front matter for hexagram number, title, version, status, author, created time, and updated time, followed by the invocation body.

The database is the authoritative editing/version index. The saved Markdown body is also persisted as a file/object so it can be used outside the application. Previous versions remain recoverable.

## Public display

The newest saved invocation becomes live immediately on the corresponding Universal Language card page:

1. The reading renders first.
2. At the end of the reading, the invocation enters with the approved Teajia-aligned reveal language.
3. If no invocation exists, the page ends after the reading with no empty state.
4. A later Save atomically replaces the live version while retaining version history.

The public renderer accepts a constrained Markdown subset—headings, paragraphs, emphasis, line breaks, and safe links—and sanitizes output. Administrative metadata and segment identifiers never render publicly.

## Save semantics

Because Adrian explicitly wants organic auto-display, **Save Invocation** both creates a new private historical version and promotes that version to live in one atomic operation. The UI must state `Saved and live` after success. Network or validation failure leaves the previous live version untouched and preserves the current editor draft for retry.

## Verification

Verify bidirectional segment synchronization, reordering, invocation-only prose, version rollback, Markdown download/use, sanitized public rendering, immediate cache refresh, empty-invocation behavior, and continuity from reading into invocation on mobile and desktop.
