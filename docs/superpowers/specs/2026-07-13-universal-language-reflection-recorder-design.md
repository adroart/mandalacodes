# Universal Language Reflection Recorder Design

## Access and entry

The feature is administrator-only. Client email is not trusted as authorization; the server validates the existing Better Auth session against `ADMIN_EMAILS`. Non-administrators receive ordinary navigation with no recorder affordance.

Holding the centered current hexagram starts a private recording immediately after microphone permission is available. The gesture must be long enough to avoid conflicting with the normal tap that opens All 64. Visual hold progress communicates intent.

## Compact recording bar

Recording replaces only the bottom sticky bar. The reading remains scrollable and interactive.

- Left control: Pause while recording; Resume while paused.
- Center: hexagram number, elapsed state, and restrained waveform/status.
- Right control: Journal.
- Pause closes the current audio segment, uploads it, and starts transcription.
- Resume starts a new segment in the same session.
- Upload/transcription continues without blocking reading.
- Permission denial, unsupported MIME type, offline upload, and transcription failure produce recoverable compact states.

## Journal

The journal opens the current session first. Older sessions are behind History. Within a session:

- Newest segments initially appear at the top.
- A drag handle reorders segments without changing their timestamps.
- `SEGMENT N · TIME` and Edit share one compact header row.
- The interface does not show a separate original-audio row; retained audio remains available to recovery and audit behavior.
- Transcript edits persist against the segment identity.
- Closing the journal returns to the correct recorder state.

## Data and storage

Store audio objects in R2-compatible object storage, never D1. D1 stores administrator ownership, hexagram number, session, segment order, timestamps, duration, object key, transcript, transcription status, and errors. Keep audio private and serve it only through authenticated administrator endpoints or short-lived URLs.

## Transcription provider

Use Cloudflare Workers AI through a server-side `AI` binding with `@cf/openai/whisper-large-v3-turbo`. Audio never goes directly from the browser to a third-party transcription API, and no transcription credential is exposed to the client. The Worker reads the committed private R2 segment, invokes Workers AI, and stores the returned text and timing metadata in D1. The provider call remains behind a small internal adapter so the storage and journal model do not depend on a vendor-specific response shape.

Workers AI is the only transcription provider in the first implementation. If the daily free allocation is exhausted or the model is temporarily unavailable, retain the audio and mark the segment `transcription_pending` for administrator retry; do not silently send private audio to another vendor.

## Reliability and privacy

- Stop media tracks on finish, cancellation, route change, logout, or component teardown.
- Select Safari-compatible MIME types through capability detection.
- Commit uploads idempotently so retry cannot duplicate a segment.
- Preserve unsynced segments locally until upload succeeds.
- Apply duration and size limits with visible warnings.
- Never assimilate or publish recordings automatically.
