# Import handwritten card corrections

This local command carries a **typed transcription** of Adrian's handwritten corrections into one `oracle/cards/NN.md` manuscript. It does not read handwriting or generate prose. The typist copies the intended spelling and punctuation verbatim. If a word is unclear, mark it `[[unclear: ...]]` in the working transcription and resolve it with Adrian before preparing; the importer rejects that marker.

## Batch file

Create a JSON file for one card. Each `quote` is the **entire exact span** to replace or delete, not a locator for a larger passage. To replace a paragraph, put the whole paragraph in `quote`. To add words, use `insert-before` or `insert-after`: `quote` is a unique anchor in that section, and `text` is inserted immediately beside it. Add spaces in `text` where needed. All fields are case sensitive. Quotes and replacement text are single line; use separate edits for separate lines. Do not include outer whitespace in a quote. The following is a synthetic format example, not an approved manuscript correction.

```json
{
  "format": "mandala-codes/handwritten-corrections",
  "version": 1,
  "cardNumber": 2,
  "edits": [
    {
      "section": "CODE",
      "quote": "Trust lets life reach you all the way",
      "action": "replace",
      "text": "Trust lets life reach you fully"
    },
    {
      "section": "ICHING",
      "subsection": "Combination",
      "quote": "bears its weight",
      "action": "insert-after",
      "text": " with patience"
    }
  ]
}
```

Sections are `CODE`, `ICHING`, `KEYS`, `DESIGN`, `BODY`, `RELATIONS`. `subsection` is an optional exact `###` heading, without the `###`. For `delete`, omit `text`. Every quote must occur exactly once in its section or subsection. A quote repeated elsewhere is safe because the named section selects its location; a quote repeated inside the selected scope stops preparation. Avoid overlapping or adjacent edits in a batch; combine them into one exact span or use another reviewed batch.

## Review and apply

```bash
npm run handwritten:corrections -- prepare --file /path/to/batch.json --out /path/to/prepared.json
```

The command prints each exact span and its full affected paragraph before and after, and writes the same review to `prepared.json`. For multiple edits in one paragraph, every preview shows the combined final paragraph. The output path must be new; preparation refuses to overwrite any existing file, including an input batch or manuscript. Review **every** change against the handwriting, including spaces, spelling, punctuation, and the named card/section. The prepared file records the current manuscript hash, expected result hash, and an approval digest. Keep the reviewed file unchanged. To approve that precise prepared content:

```bash
npm run handwritten:corrections -- apply --file /path/to/prepared.json --approve PASTE_PRINTED_DIGEST
```

The digest binds the CLI approval to the exact prepared review; it does not prove who typed the command. A wrong digest, edited prepared file, changed manuscript, missing or ambiguous quote, unclear transcription (`[unclear]` or `[[unclear: ...]]`), wrong card, overlapping edits, or structural/frontmatter change stops the batch. Headings and structural labels such as moving-line markers stay protected. Unknown, repeated, or valueless CLI flags also stop the command. Apply validates the complete 64-card corpus with the proposed card in a disposable directory, then atomically replaces only that one manuscript. Failed validation leaves it untouched. This local CLI uses an exclusive per-card lock for two simultaneous imports; external editors should wait until it completes. No editorial status is changed. This import approval does not mark prose final or complete any separate sentence pinning process.

After applying, review the diff, run the card gate, regenerate hosted artifacts, and follow the usual publication review. The importer itself does not commit, push, or deploy:

```bash
git diff -- oracle/cards/02.md
npm run card:gate -- 02
npm run build:oracle-corpus
npm run build:search-index
```
