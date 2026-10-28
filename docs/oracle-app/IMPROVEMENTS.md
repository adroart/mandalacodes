# Oracle app improvements, approved 28 October 2026

Adrian approved all ten improvements. This is a delivery record, not a claim
that every external service is ready. Existing manuscript prose and birth
calculations remain authoritative and unchanged.

1. Optional account with backup/sync: integrate existing Better Auth service;
   guest stays usable. Requires deployed native-origin support and a real OTP test.
2. Personal home: current transit, resume, draw and personal map.
3. Drawing: optional question, subtle haptics, artwork reveal, quick option.
4. Birthday: clear selected position, connected spheres, readable explanation.
5. Journal: question, result/cast, editable reflection and later follow-ups.
6. Index: artwork/hexagram modes, search, personal-code filtering.
7. Reading: adjustable typography/spacing, position persistence and focus mode.
8. Design: one warm-paper/bronze language, touch targets and bounded phone layouts.
9. Voice: separate chat 01a181b4-9baf-70d2-b760-48c471bb77c1 owns authoring.
   Preserve raw audio/transcript, source revision and section hints. Compare
   current prose, corrected transcript and proposed changes; flag uncertainty;
   require explicit editorial approval. Unmentioned sections remain unchanged.
   Delete editing audio only after approved application and durable receipt;
   public listening recordings are separately retained and explicitly published.
10. Widget: current shared Sun-transit code, deep link into native reading;
    reminders only by user opt-in, never silently scheduled.

No website publication, manuscript approval, bulk Apple Notes import/deletion,
or paid service purchase is implied by this implementation record.

## Delivery checkpoint: native build 6

Implemented and locally verified: personal home, search/index modes and Birthday
filter, question + reveal drawing, selected chart explanations/connections, local
journal and follow-ups, reading typography/focus/position, consistent native
layout, manual Birthday backup/restore, WidgetKit extension, opt-in reminders.

The listening player is implemented/tested but no public audio recordings exist
in the current publication API. It honestly shows that state; editing recordings
are never used as listening assets. The separate authoring chat delivered a
local capture/review preview, not a deployed AI authoring service.

Phone login code and exact server-origin support are implemented and tested.
Login remains disabled until the requested server publication is approved and
email-code login, cookie persistence, sync and sign-out pass on the real phone.
Enable with VITE_ORACLE_NATIVE_ACCOUNTS=true only at that point. Journal/audio
cloud sync and Sign in with Apple are not implemented by the Birthday sync API.

Verification: 48 focused unit tests (discovery, journal, account, audio, widget,
reminders), three native startup checks, TypeScript, fourteen app browser flows
with affected follow-up checks after fixes, and signed native build. Widget
Home Screen appearance, delivery of opted-in notifications, hardware haptics and
actual deep-link routing remain device checks; the simulator's external URL
open reached an OS confirmation rather than completing an unattended tap.

A real chart-touch bug was fixed: pointer capture now starts during an actual
pan/pinch rather than retargeting simple taps away from the selected circle.
