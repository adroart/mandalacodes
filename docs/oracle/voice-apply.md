# Voice apply: from the phone's working card to `oracle/cards/NN.md`

Words Adrian records and applies in the Oracle app live in the phone's private
storage (the working card). This step carries them into the card's manuscript,
one card at a time, as one pull request he approves.

## The bundle

`lib/oracle/authoring/voiceExport.ts` turns one card's applied state into a JSON
bundle (`format: mandala-codes/oracle-voice-bundle`, `version: 1`). It records
the card number, export time, the manuscript the app read (path, revision,
SHA-256), and for each section whose applied words differ from the card: its id
and path, the original text with hash and length, the applied text with hash
and length, the blocks with their human or AI origin, when it was applied, and
whether it is fully in his words (`fullyHuman`) or only partly (`mixed`).
Sections the app cannot place for certain are listed under `omitted`, and title
edits travel under `titleEdits` but are not applied by version 1.

**There is no way yet to produce a bundle from the app's interface.** That needs
a "Send finished sections to the card" action in the workspace that calls
`buildVoiceBundle`, and a way to get the file from the phone to the repository.

## Running it on one card

```sh
npx tsx scripts/voice-apply.ts --file card-02.json --dry-run   # report and diff, writes nothing
npx tsx scripts/voice-apply.ts --file card-02.json --card 2     # writes oracle/cards/02.md
```

`--cards-dir <dir>` points at another copy of the cards (the tests use it).
The script refuses a bundle that fails validation or names another card.

## What the report means

- **Applied**: the card still had the words the app saw; they were replaced.
- **Already applied**: the card already has his words. Running twice is harmless.
- **Conflicted**: someone changed that section since the app read it. Nothing
  there was touched; the report shows the card's words, what the app expected,
  and his words. Exit code 1.
- **Skipped**: version 1 does not rewrite sections that hold lists, bold,
  labels or emphasis (the moving lines, Judgement, Image, Tarot, Deeper
  correlation, the Gene Keys label line). Make those by hand.
- **Failed**: the change would have broken the card's structure, or the card
  failed the build's corpus loader afterwards and was restored. Exit code 1.
- **For the owner's eye**: em dashes, italics or underscore emphasis in his
  words. They are reported, never rewritten.

Everything outside the replaced words stays byte for byte, including the
frontmatter, every status, and every heading. The entrance (`meta.centre`) is
written only when it stays one plain quoted line. The script never commits,
pushes or opens a pull request.

After a write it prints the next steps: `npm run lint:prose`,
`npm run card:gate -- NN`, `npm run build:oracle-corpus`,
`npm run build:search-index`, then a branch and commit for that one card. The
lint reports on his words and does not block them, but `npm run build` runs the
same lint, so a flagged word stops the build until he decides.

Card 2 first, read on the preview, before any second card.
