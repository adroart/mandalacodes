# Oracle listening player

`OracleAudioPlayer` is a native-reader component. Import its default export and
pass `cardNumber`. With no approved publication it shows a collapsed Listen row
and an honest no-recording explanation.

To play real published audio, the host must supply `recording` with the exported
`PublishedOracleRecording` shape: `id`, `cardNumber`, `title`, absolute HTTPS
`sourceUrl`, ISO `publishedAt`, and `publication: 'approved-public-listening'`.
This contract prevents accidental wiring, but does not authenticate approval.
A future publishing service must verify the author's approval and provide this
metadata from the public listening catalogue. Do not accept private authoring
capture metadata as a publication.

Current boundary: `LiveInvocation` and `/api/oracle/invocations/:number/live`
contain published text blocks only. Reflection segment audio is admin-only,
owner-scoped, and stored in `ORACLE_PRIVATE`. It is deliberately not consumed by
this player. There is no existing public audio endpoint or seeded recording.

Opening the player does not fetch media. Pressing Play first attaches the URL;
preload is disabled. Changing card/publication, closing the player, or unmounting
pauses playback. Controls include play/pause, seek, elapsed/duration, and a
5/15/30-minute wall-clock sleep timer. Visibility changes recheck an expired timer.
Lock-screen/background audio is not configured or claimed by this component;
a native background audio implementation would need its own verification.

Verification: six unit tests cover publication guardrails, no automatic media
request, empty state, sleep replacement/cancellation/resume, and seek bounds.
A generated silent WAV intercepted only inside a WebKit test verified actual
play, seek, pause, resume and source cleanup on card change. No sample audio ships.
