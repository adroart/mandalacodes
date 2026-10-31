# Oracle voice screens: five focused improvements

Design handoff for Claude Code · 31 October 2026

Reference implementation inspected: `2c1e35d0`. The current checkout is at `f2d7fc45` and does not contain the referenced studio files in its working tree. This document targets the supplied reference revision. It changes presentation and action wording within the five requested improvements, plus Settings spacing. It does not change application, matching, recording, retention, or undo rules.

## Design decision

Review begins with the words Adrian will use. The previous wording follows immediately. Unchanged passages remain fully readable below. Word checks live at their actual occurrence. After applying, the next recording sits immediately below the confirmation. During recording, destination names get the full width and controls get a separate row. Card progress measures the current applied reading's authorship.

This is the approved layout specification. Local implementation and verification are recorded below; it has not been deployed. All quoted strings below are final interface copy. Braces indicate runtime values, not literal text.

## Shared layout and visual rules

- Phone reference: 390 × 844 CSS pixels. Content gutters: 20px, leaving 350px. Dimensions below exclude any operating-system status bar. Reserve the actual bottom safe-area inset; the examples allow 34px. Use the available visual viewport when the keyboard opens.
- Desktop reference: 1440 × 900. Keep the existing 260px section rail. Reading column: 700px, centered in the remaining 1180px. Review: at most 1120px, with at least 30px outer gutters in that remaining area.
- Background and control surfaces: `#0c0c0d`. Primary text: `#f3f3f4`; secondary text: `#a4a4ad`; rules: `#303034`. No tinted panels, shadows, gradients or inset editors.
- Plus Jakarta Sans throughout. Human and current-reading passages: 17px/27.2px on phone, 18px/28.8px on desktop. Comparison originals: 15px/24px on phone, 16px/25.6px on desktop. Labels: 13px/18px. Buttons: 14px/20px, semibold. Section title: 22px/28px phone, 26px/33px desktop.
- Gold `#d9b56c`: destination edge, proposed human-text edge and the single main action. Human text itself stays off-white. Green `#8fc79f`: applied human text indicators only. Amber `#f0a35e`: unresolved word underlines. Red `#ef5548`: microphone currently live only. Idle Record buttons have no red dot. Paused, saving, error and removed states are neutral with explicit words.
- Buttons have a minimum 44px hit height and 6px corners. Secondary actions are plain text or fine-outline buttons; no pills. Focus has a visible neutral outline. Icons may accompany words but do not replace important labels.
- Only the passage area scrolls in normal use. Headers and action docks stay outside it in the layout, never overlaying the last text line. Extra-long names and enlarged type grow those areas; they never shrink type or introduce horizontal scrolling.
- Existing raw audio, transcript, speech cleanup, unmatched speech, linked-card routing, title editing and concurrency protections remain. Secondary notices about unplaced words and linked cards follow the comparison content instead of preceding the first human passage. Their existing navigation remains available.

## 1. Put his words on the first review screen

### Phone, 390 × 844

Header: 56px minimum. One row: `Back to card` on the left; `Review · {position} of {count}` in the flexible center; `Previous` and `Next` on the right. Button text may use two lines within 44px, at 13px; the header grows if needed. The review title remains the action that opens the ordinary section-list screen, with accessible name `Choose a section to review`. Do not repeat the word-check count here.

Passage area starts 12px below the header. Render this order:

1. One secondary path line, such as `Universal Language`.
2. The editable section title, such as `Reading`, with no text-field box.
3. The first proposed changed passage, even when it is Passage 2 or 3 in the reading. Its source number stays unchanged.
4. Remaining changed passages, in source order.
5. Unchanged, removed and excluded passages, in source order, with their full text.

For example, if only Passage 2 of 3 was spoken, show:

```text
Universal Language
Reading

Passage 2 · Your words          Keep original
│ I don't have to force the direction.
│ I can feel when something is ready
│ to move, and follow that.
Original
The receptive principle offers a way...

Passage 1 · Stays                    Remove
The complete unchanged passage...

Passage 3 · Stays                    Remove
The complete unchanged passage...
```

The human block has a 3px gold edge and 12px between edge and text. A row heading has a 44px hit-height action, then a 4px gap before human text. `Original` follows human text with an 8px gap; its complete text follows with a 4px gap. Originals have no edge. Put 16px and a fine rule between passage groups. Unchanged passages use secondary color at the full passage size, with 12px between groups. Compactness comes from removing duplicate headings, metadata and padding, not truncating prose or making current reading text tiny.

Remove the introductory “You spoke about…” summary. Each row already states what happens. Preserve source IDs, comparison indices, selection offsets and apply order when displaying changed rows first. Visual reordering must never reorder the final reading. Keep a row's display position stable while toggling its choice; regroup only when reopening the review, so controls do not jump under the finger.

At the reference size, the first human passage begins approximately 160–185px from the top, allowing for a one-line title. The first human line must appear before any full original paragraph. With an 80px dock and 34px safe area, about 674px remains above the dock. Long titles grow naturally; no title or warning can pin a large original above human text.

### Whole-section fallback and additions

When matching is unavailable, keep the same human-first structure. The row label is `Your words`; beside it, a neutral short scope label says `Replaces all {N} paragraphs`, or `Replaces this paragraph` for a one-paragraph destination. Put the complete original below, labeled `Original`. Remove the long warning and its recording tutorial. Keep the explicit replacement consequence on both this row and the apply button. Do not pin the original, set a 30vh original pane, or synchronize nested scrolling.

For additions: `Your addition`, human words, then `Already in the reading` and the complete retained text. The primary action is `Add my words`. Retained text is never inside the human edge.

### Row states and exact actions

| Row | Visible state | Action | After pressing |
| --- | --- | --- | --- |
| Matched replacement selected | `Passage {N} · Your words` | `Keep original` | Original becomes the retained choice; proposed human words remain visible in secondary color without a gold edge. |
| Original retained for matched pair | `Passage {N} · Original kept` | `Use my words` | Restores the proposed replacement. |
| Unspoken original retained | `Passage {N} · Stays` | `Remove` | Original remains visible, struck through; no red color. |
| Unspoken original removed | `Passage {N} · Removed` | `Keep it` | Restores that original. |
| Unmatched new passage included | `New passage · Your words` | `Leave out` | Keeps the proposal visible in secondary color, labeled `Left out`. |
| Unmatched new passage excluded | `New passage · Left out` | `Add it back` | Restores the addition. |

When a matched original is kept, show that original first, followed by `Not being used` and the proposed speech. Nothing disappears behind a tap. Do not attach row-choice actions to whole-section fallback if the existing comparison does not support those choices.

### Review dock and state copy

Phone dock: 80px plus safe area. Left: `Listen` (56px minimum) and `Re-record` (72px minimum); right: the remaining width for the main apply action. Use two lines for the main label when needed. With a selected phrase, use `Re-record selection`; allow that secondary button to wrap and widen, never truncate. The keyboard keeps the current text and its word controls visible; the dock follows the visual viewport and may grow.

Derive the apply action from actual choices, retaining existing rules:

- `Replace {N} passage` / `Replace {N} passages`.
- Append ` · add {N}` and/or ` · remove {N}` when those choices coexist, in that order. If there is no replacement, start with `Add {N} passage(s)` or `Remove {N} passage(s)` as appropriate.
- Whole section: `Replace all {N} paragraphs`; one paragraph: `Replace with my words`.
- Addition intent: `Add my words`.
- Unresolved check: disabled `Check {N} word first` / `Check {N} words first`. If any unresolved item is a general note, use `Check {N} item first` / `Check {N} items first` instead.
- Empty proposed text: disabled `No words to use`. No selected changes: disabled `Nothing to change`.
- Applying: disabled `Saving words…`; keep the comparison visible and lock editing and choice actions.

`Listen` retains existing timed word highlighting. Playback dock labels are `Pause playback` or `Play recording`, elapsed time, `Loop passage` when a bounded clip exists, and `Back to editing`. Replay highlight is neutral off-white with an underline, so gold continues to identify the proposal and main action. Return to the same scroll and caret position.

If the selected result is still processing, show `Your recording is saved. Preparing your words…` with `Back to card`. This state contains no original-first placeholder comparison. Other recordings remain available immediately.

### Desktop, 1440 × 900

Same ordering and choices. Each changed group uses two equal columns with a 32px gutter: `Your words` left, `Original` right. Addition uses `Your addition` left and `Already in the reading` right. Human text is the first reading stop on both devices. Unchanged passages below span both columns at a maximum readable width of 700px. Use one scroll container, no pinned originals. Keep the dock aligned to the review area. At widths below 900px use the phone composition; do not squeeze two text columns into tablet portrait.

## 2. Put word checks inside his text

An unresolved word is amber with a 2px dotted underline, 4px offset. It remains directly editable in the same human passage. Immediately after that occurrence, render the plain text buttons `Hear it` and `It’s right`. They occupy the same text flow, with 8px between controls and 44px hit height. Controls have no surrounding panel and no duplicate quote.

```text
│ I can feel it in my chess   Hear it   It’s right
│ before I can put it into words.
```

Treat the marked token and actions as one inline annotation when they fit within 350px. For a long phrase, allow actions to wrap immediately below its final line, left-aligned with the marked phrase where space permits, otherwise with the human text edge. They never overflow or open a popover. Keep normal prose at 17px; the affected line can grow to fit touch targets. Multiple issues each get their own annotation, in reading order. No header panel, tooltip, footer quote or “All checked” strip repeats them.

| Check state | At the occurrence | Behavior |
| --- | --- | --- |
| Unresolved | Amber underline; `Hear it`, `It’s right` | Applying remains blocked by the existing check rules. |
| Hearing | Keep the underline; use `Stop clip` in place of `Hear it` | Plays existing contextual evidence, then returns to `Hear it`. Confirmation remains available. |
| Explicitly confirmed | Neutral dotted underline; one action `Check again` | No green success treatment, because the text is not yet applied. |
| Corrected by editing | Corrected text in normal human style; resolved annotation disappears | Preserve the existing quote-removal settlement rule. Do not leave an obsolete quote elsewhere. |
| Reopened | Amber underline and the original two actions | Blocks apply again under the existing rules. |
| Applied | No word-check controls | Applied human text receives its green edge. |

### Evidence and editing constraints

The reference issue offsets index `rawTranscript`, not the editable proposal. Match the actual displayed occurrence conservatively; never underline by copying those offsets onto edited text. Use the existing deterministic replay correspondence where available. Repeated or edited phrases must not cause another occurrence to be confirmed accidentally.

If the occurrence cannot be identified, place one plain note directly after the affected human passage: `Check “{quote}” against your recording.` Then `Hear it` when supported and `It’s right`. This replaces that issue's inline annotation; never show both. A warning without a quoted word appears here as its existing specific message with `I’ve checked this`. Do not invent a word or hide a blocking warning.

`Hear it` requires genuine saved audio bounds. If no precise clip exists, show `Listen to recording` at that location, playing the saved take with no invented timing. If there is no playable recording, show `Audio unavailable` as plain secondary text and retain editing/confirmation. Keep a specific failure beside the same annotation: `Audio could not play.` with `Try audio again`; no red error panel.

Preserve raw recording/transcript retention, issue identity, and the existing persistence/settlement behavior. An edit resets checked state according to current rules. Annotation buttons and labels must never become part of saved text, copied prose, selection offsets or re-recorded phrase content. During keyboard editing, keep the annotation beside its passage and let the browser scroll the active word above the keyboard. Desktop uses exactly the same treatment in the human column.

## 3. Applied leads straight to the next recording

### Phone

Header: `Back to card`, `Applied`, and section navigation as on review. Keep the applied section's path and title once. Directly beneath them:

1. One green status line: `Your words are in the reading.` For an addition: `Your words were added to the reading.` For a mixed result: `Your changes are in the reading.`
2. A 16px gap and a fine rule.
3. Secondary label `Record next`, then the full next section path and title, 17px semibold.
4. The next section's current opening text, full passage size, up to three lines. This is explicitly a preview, not a collapsed editable passage; end with an ellipsis when more text follows. No fade mask or “expand” action.
5. Gold, full-width `Record this section`, minimum 48px high.
6. A 24px gap, `Just applied`, then the complete applied result.

The continuation should normally begin before y=240 and its Record button before y=400. It precedes the potentially long applied text, so a long previous recording cannot bury the next action. Use the existing `nextAfter` section order, not a new algorithm for skipping or choosing sections.

After `Just applied`, show human-origin portions with a green 3px edge. Retained AI portions remain secondary with no green edge. For additions, put the retained text before the applied addition in this result area, preserving final reading order. Never put one green edge around a mixed result.

The bottom dock is now quiet navigation: `Undo`, `See in card`, and `Next to review` only when another result is ready. There is no duplicate Record action in the dock. `Next to review` is a secondary action even when present; the single gold action remains beside the next section preview. If remaining work is only processing, show `{N} processing` as neutral status, not a disabled review button.

`Record this section` selects the shown whole section and starts its microphone in one tap using existing recording behavior. It opens the card at that destination. It does not wait for processing elsewhere, apply another draft, or change the last Undo receipt. Undo remains one tap away on this Applied screen; existing recovery/history continues after navigation.

### States and boundaries

| State | Copy and action |
| --- | --- |
| Next section ready to record | Preview plus `Record this section`. |
| Opening microphone | Button `Opening microphone…`, disabled; no red indicator until live. |
| Microphone live | Navigate to the card's live recording layout for that section. |
| Microphone denied/unavailable | Keep preview and quiet dock; note `Microphone unavailable. Check this app’s microphone access.`; action `Try recording again`. No permission-setting feature is added. |
| Another section processing | Keep the next recording enabled; preserve any existing notice for the processing section. |
| Another review ready | Keep preview; quiet dock includes `Next to review`. |
| No next section, another review ready | Omit the preview; show applied text and gold `Next to review` in the dock. |
| No next section or ready review | Omit preview; show applied text and gold `Finish`. Processing may continue after finishing under existing retention rules. |
| Undo pressed | `Undoing…` while pending; on success return to that proposal's review and say `Undone. The earlier words are back in your reading.` Progress reverts to restored provenance. |

### Desktop

Inside the review area, use two columns: applied text on the left (flexible, roughly 640px), next-section preview on the right (360px), with a 40px gutter. The preview aligns with the applied confirmation instead of living beneath all applied text. Its Record button stays directly below its three opening lines. Below 900px the preview returns above `Just applied`. No boxed continuation card or nested scrolling.

Remove the existing empty success area and the dock's competing `Record next · {section}` button.

## 4. Give recording destinations their own width

### Phone

Keep card text above the dock. The dock contains three information bands followed by a control row; it is not one crowded horizontal strip.

```text
Recording · 1:24                         level
Universal Language · Reading
Paragraph 2 of 3

Next · I Ching · Combination

Pause       Stop & review         Send & next
```

All destination and Next text uses the full 350px width. A lens/path is included where needed to distinguish repeated titles such as `Reading`; a cross-card destination includes `Code {N}`. For whole-section recording, the scope line says `All {N} paragraphs`, or `Whole section` for one paragraph. For a phrase it says `Selected words`; retain the full section path above it. Do not repeat the current destination again beside the timer.

Reference dock dimensions: 12px top padding; 20px status; 4px gap; 44px destination/scope; 8px gap; 22px Next line; 10px gap; 44px actions; 12px bottom padding = 176px, plus safe area. This leaves 554px of manuscript below an 80px card header at 390 × 844 with a 34px inset. If Next wraps to two lines, the dock grows to 198px. Use natural height for longer titles, not a fixed line clamp or ellipsis. Normal vertical manuscript scrolling is acceptable; horizontal scrolling is not.

The 350px action row uses widths of 64px / 138px / 132px with two 8px gaps. Copy: `Pause`, `Stop & review`, `Send & next`. The first two are neutral; the last is gold. `Next · {full path}` above the row makes the consequence explicit. The accessible label of the main action is `Send this recording and go to {full next path}`; in continuous mode use `Send this recording and keep recording in {full next path}`.

With continuous recording enabled, replace the Next information line with `Next, recording continues · {full path}`. The main action keeps the same short label; its visible destination line describes whether the microphone continues. With continuous mode off, sending saves/queues the current take and selects the next destination immediately; its idle Record button is available without waiting for processing.

### States

| State | Status and buttons |
| --- | --- |
| Idle | `Record over` above full destination and scope; one gold `Record`. If relevant, secondary `Review {N}` and neutral `{N} processing`. No red dot. |
| Live | Red live dot; `Recording · {time}`; real level meter; `Pause`, `Stop & review`, `Send & next`. |
| Paused | Neutral dot; `Paused · {time}`; static level; `Resume`, `Stop & review`, `Send & next`. Pausing does not send or retarget. |
| Saving boundary | `Saving recording…`; preserve both full names. Briefly disable boundary actions while audio is durably retained. No processing spinner replaces the whole dock. Red remains only if the microphone is actually live. |
| Previous take processing, next live | Current section still says `Recording`; the prior section says `Processing` in its manuscript row. Do not replace the current destination with the prior job's status. |
| Sent, continuous off | Next destination in idle layout; `Record` enabled as soon as durable boundary saving completes. |
| Sent, continuous on | Next destination in live layout; timer follows the existing recording-session timer. No artificial timer reset. |
| End of card, no existing next target | Omit the Next line and Send action; `Stop & review` becomes gold. Do not invent a cross-card target. |
| Phrase re-recording | Full destination plus `Selected words`; omit Next; `Stop & review` is gold. Surrounding words retain existing protection. |

Scrolling the manuscript does not change either destination. Update both names only on an explicit existing navigation action or a supported recognized voice command. Visible buttons work on devices without voice navigation.

### Desktop

Within the 700px reading column, use a two-row dock: full-width status/destination/Next text above; the same three labeled actions below, right-aligned. Names wrap when needed. Do not reintroduce a narrow target cell to recover a single-row dock. Desktop has room to show destination and Next side by side only when both fit completely; natural wrapping remains the fallback.

Remove destination ellipsis, the Next button's embedded narrow title, the unlabeled Pause circle and the vague `Done` label.

## 5. Honest card progress

### Card header, phone

Replace the existing “Record over the reading” subtitle with progress; it does not need a second instruction line.

- First row: `Close`, `Code {N} · {card name}`, `Sections`, `Settings`, minimum 56px high. With 12px gutters and 4px gaps, reserve 44px for Close, 64px each for Sections and Settings; the card title uses the remaining 182px. Allow the title to wrap. Important navigation has visible text.
- Second row, 20px high with 20px gutters: `{H} of {T} sections in your words`, 13px secondary type.
- A 2px neutral progress track across the header bottom, with an off-white fill of `H / T`. No gold completion meter and no green track around mixed content. Total nominal header height: 80px including its separating space/rule.

Desktop: one 58px header row, with the same progress sentence beside the card title, and a 2px track under the main content portion. The desktop rail already provides section navigation; retain Settings and Close. There is only one card-progress sentence on screen.

The progress line is descriptive, not a button. Accessible progressbar name: `Sections entirely in your words`; value text repeats the visible sentence. Do not announce timer ticks or passive scrolling. Announce a progress change after a successful apply or undo only.

### Counting rules

`T` is the number of distinct named, recordable sections from this card's parsed manuscript, including Intro when present. It is not six lenses, paragraph count, pending result count, the current filtered review queue, or a hard-coded 23. Focused paragraph/phrase selections do not become additional sections. Another card's recording belongs to that card's count.

Count a section in `H` exactly once when its current applied, nonempty reading has human-origin prose and no retained AI-origin prose. Several separate applied replacements can cumulatively complete it. Keeping AI wording never changes its origin. Human confirmation of a word does not change the origin of an original passage.

| Current applied reading | Counts in H? |
| --- | --- |
| Original AI only | No |
| One of three AI paragraphs replaced | No |
| Human addition following AI | No |
| All surviving prose human after several replacements | Yes |
| Human prose remains after explicitly removing remaining AI passages | Yes |
| Empty section after removals | No |
| Fully human section with a pending, unchecked revision | Yes, until the applied reading changes |
| Pending full replacement, processing, or ready to apply | No new credit |
| Undo | Recompute from restored text and origin; never subtract blindly |

Derive coverage from current applied provenance at the named-section boundary. Existing `WorkingSection.blocks` has `human`/`ai` origins; broad-lens percentages cannot establish that each subsection is complete. Existing `applied`, `appliedAt`, `integrationId`, addition intent and `authored[id].human` are insufficient: the reference uses them for partial changes too, and Undo/pending revisions can retain receipts.

Intro has no equivalent block list in the inspected reference. Reconstruct its current origin from existing applied choices and the valid replacement/undo receipt chain. Do not add a storage migration, infer origin by text similarity, or silently omit Intro. If the available records cannot prove current coverage, conservatively leave that section uncounted. While initial provenance is still loading, show `Checking authorship…` and an unfilled neutral track, never a temporary false 0. If loading fails, use `Authorship unavailable` with no percentage until a normal reload succeeds.

At `0 of {T}` keep the track empty. At `{T} of {T}` fill it fully and keep the same sentence; no celebration banner or second completion label. `1 of 1 section in your words` is the singular form. If no recordable sections exist, show `No recordable sections` and no progressbar.

Section-state tags must agree: use `Your words` only for a fully human applied section, `Partly your words` for a mixed replacement, and `Your addition` for an addition that retains original prose. These are provenance labels, not completion credit. Ready/Processing/Check states remain text-labeled and neutral/amber as appropriate; none increments H.

## Settings spacing fix

Keep the existing plain list and choices. Between the bottom divider of the last “While recording” row and the top of `When a section already has my words`, add 24px. Leave 12px between that legend and the first choice. Each choice retains a 44px minimum hit height. Use the same spacing on phone and desktop; let the long heading wrap without colliding with a rule.

Because the recording action now visibly says `Send & next`, update its existing switch label to `Keep recording after Send & next` and helper to `Sends this section and keeps the microphone on for the next one.` This is the same setting and default. Other Settings copy and behavior remain as supplied.

## Builder acceptance checks

Verify at 390 × 844 and 1440 × 900, and once with enlarged phone text. Use the reference implementation's existing review and recording fixtures; synthetic sample words in this document are layout examples, not Oracle manuscript edits.

1. Only Passage 3 changed: its human words appear first, its full original directly below on phone, and Passages 1–2 remain fully readable lower down. Applying preserves original source order and untouched provenance.
2. Whole-section fallback with three long originals: human text appears in the first viewport. No original pane pins over it. Apply explicitly names all three paragraphs.
3. Inline repeated-word ambiguity: only a confidently mapped occurrence is marked. Otherwise one adjacent fallback note appears. Audio uses real bounds; annotation controls never leak into copied/saved prose.
4. Confirm, edit and reopen a check. Apply gating follows existing semantics. Listening and phrase re-recording preserve text, selection and neighboring words.
5. Apply a long result: next preview and Record are visible before the full applied result. Record starts the shown target in one tap. Undo restores the prior reading and progress.
6. Record a two-line current name with a three-line next name: both are complete, controls remain usable and manuscript remains scrollable. Pause is visibly labeled. No horizontal scrolling or destination ellipsis.
7. Send with continuous mode both on and off while prior processing lags. The next recording stays available. Test the visible actions with voice commands unavailable.
8. For a 23-section card, one partial replacement and one AI-retaining addition do not produce `2 of 23`. Complete a section across multiple takes, then Undo the final take: the count follows the actual restored origin coverage.
9. Processing, word confirmation, review reordering, new draft edits and linked-card results cannot increase this card's count before application.
10. Verify Settings spacing and every path with the keyboard open. No accordions, dropdowns, boxed prose editors, new storage rules or extra workflow steps have been introduced.

Implementation surfaces at the reference revision: `SectionVoiceStudio.tsx` and `.css` own header, dock, review/applied composition and Settings spacing; `SectionPassageReview.tsx` owns changed-first presentation and inline annotations. Reuse existing evidence, working-reading provenance and undo helpers. No deployment is part of this handoff.


## Local implementation, 31 October 2026

Implemented on `codex/oracle-voice-five`, based on `2c1e35d0`, in the isolated `oracle-voice-five` worktree. The canonical manuscripts and persisted data formats are unchanged.

Verified: 273 authoring unit tests; ten focused Chromium phone/desktop cases covering all five improvements and checked-editor copy/paste/selection; three iPhone WebKit review/editor cases (two fake-microphone cases intentionally run only in Chromium); all 28 existing workflow/journey compatibility scenarios; TypeScript and the Oracle Vite app build. Whole-section originals have no height cap or mask. Reviewed rendered phone and desktop screens, including enlarged phone text and long destination names.

The browser flows use synthetic speech-provider responses and fake microphone input where supported. This verifies the interface and saved-work behavior, not live provider readiness or a signed iPhone installation. Local preview is on port 4279. No publication or installation was requested.
