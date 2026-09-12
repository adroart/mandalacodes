# Source files on disk for the Mandala Codes oracle research corpus

This is a read-only inventory. Nothing was moved, copied, opened, or edited. The goal was to find the original books and documents that the vault's extracted markdown cites, so they can be run through Firecrawl to refill empty extracts.

The single most useful discovery: almost the entire original corpus sits in one folder,

`/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/`

This appears to be the working folder where the whole books were split into per-chapter PDFs before being fed into the vault. Its `extracted/` subfolder holds the whole original books, and `extracted/Gene Keys Chapters/` holds the exact same per-chapter PDF filenames the vault frontmatter cites (for example `01-gene-key-1.pdf`). A second, larger book collection sits on the Desktop in an `I Ching/` folder and a `keys/` folder (Gene Keys and Human Design books), which is the source library the Source Material folder was drawn from.

The vault's own citations to `file:///home/vaultsync/rwttx-egoxy/...` are paths on the VPS Syncthing replica of this same vault, not a separate machine. They do not exist as literal paths on this Mac, but the same files exist locally at the vault paths `Mandala Codes/_processed/Practical Guide/`, `Mandala Codes/_processed/Oracle 2018/`, and `Mandala Codes/_processed/Wilhelm/` (see the "cited but missing" note below for the distinction).

Spotlight is disabled on this Mac (`mdutil` reports "Spotlight server is disabled"), so `mdfind` returned nothing for every query. All searching below was done with `find` over Documents, Downloads, Desktop, and the vault. iCloud Mobile Documents, Apple Books, Calibre, and `/Volumes` were checked and had nothing relevant beyond what is listed.

No credential-shaped content was found or read. One automated content-scan alert fired on `i64os-content-hash: sha256:...` fields in the vault frontmatter; those are change-detection hashes of file content, not secrets, and nothing sensitive was exposed.

---

## I Ching translations

| Title / family | Path on disk | Type / size | How matched | Confidence |
|---|---|---|---|---|
| James Legge, The I Ching (Sacred Books of the East / Sacred Books of China), full 1882 HTML edition, all 64 hexagrams plus intro/preface/appendices | `/Users/adrianrasmussen/Desktop/I Ching/16 - The Sacred Books of China, The I Ching, Part II Texts of Confucianism, part 2 of 6 - J. Legge 1882/ich/` (81 .htm files: ic01.htm through ic64.htm, icintr01-03.htm, icpref.htm, ictoc.htm, ictp.htm) | HTML, folder | cited path `file://Legge-1882/ic01.htm` through `ic64.htm` | certain |
| Legge, same edition, whole-book PDF copies (three variants) | `/Users/adrianrasmussen/Desktop/I Ching/The Sacred Books of China, Vol. 16, The I Ching, Part II Texts of Confucianism, part 2 of 6 - J. Legge 1882 A.O.pdf` (26M); `/Users/adrianrasmussen/Desktop/I Ching/The I Ching, The Sacred Book Of China - James Legge 1963 A.O.pdf`; `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/James Legge/*.pdf` (four more Legge PDFs, one .djvu) | PDF / DJVU | filename, author | certain |
| Richard Wilhelm and Cary Baynes, The I Ching or Book of Changes (Bollingen), abridged single-volume edition | `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/I Ching Wilhelm Abridged.pdf` (543K) | PDF | content: table of contents reads "1. Ch'ien / The Creative", matching the vault's Wilhelm hexagram titles exactly; this is the book the vault's own `_processed/Wilhelm/*.pdf` per-chapter splits were cut from | certain |
| Same Wilhelm-Baynes translation, duplicate copy | `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/Richard Wilhelm - Cary F Baynes/I Ching - Wilhelm-Baynes translation (133p).pdf` (543K, identical size) | PDF | filename, author | certain |
| Carl Jung's introduction to the Wilhelm I Ching, separately | `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/Richard Wilhelm - Cary F Baynes/Carl Gustav Jung's Introduction to the Wilhelm I Ching (27p).pdf`; also `/Users/adrianrasmussen/Desktop/I Ching/I CHING - Carl Gustav Jung.pdf` and `.../Carl Gustav Jung - Foreward to the I Ching (27p).pdf` | PDF | filename, cross-referenced with `systems/deck/wilhelm-intro.md` in the vault | likely (the vault's wilhelm-intro file has no source field, but this is almost certainly what it draws from) |
| Thomas Cleary, The Taoist I Ching | `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/Thomas Cleary - The Taoist I Ching. - OCR ok (173pp).pdf` (1.3M) and a second near-duplicate `Thomas Cleary - The Taoist I Ching (173p).pdf` | PDF | filename, author, matches vault's `source: file://Cleary-Taoist-I-Ching` | certain |
| Thomas Cleary, The Buddhist I Ching | `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/Thomas Cleary - The Buddhist I Ching (129pp).pdf` (37M) | PDF | filename, author, matches vault's `source: file://Cleary-Buddhist-I-Ching` | certain |
| Alfred Huang, The Complete I Ching | `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/The Complete I Ching - The Definitive Translation From the Taoist Master Alfred Huang (248p).pdf` (47M) and a smaller duplicate `The Complete I Ching - Alfred Huang (much smaller PDF) (247p).pdf` | PDF | filename, author, matches vault's `source: file://Huang-Complete-I-Ching` | certain |
| Deng Ming-Dao, The Living I Ching | `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/Living I Ching - Using Ancient Chinese Wisdom to Shape Your Life - Deng Ming-Dao(430p).pdf` (6.5M) | PDF | filename, author, matches vault's `source: file://Deng-Living-I-Ching` | certain |

## The "Practical Guide" and "Oracle 2018" (Eranos) books

The vault's per-hexagram folders cite `practical-NN-*.md` and `oracle-NN-*.md` files with no readable book title, only internal codenames "Practical Guide" and "Oracle 2018". Both whole books were found, and both are confirmed by content, not just filename.

| Title / family | Path on disk | Type / size | How matched | Confidence |
|---|---|---|---|---|
| Benebell Wen, "I Ching, the Oracle" (2023) — this is the actual title and author of the book the vault calls "Practical Guide". Its back matter has chapter 9, "Ancestral Veneration and the I Ching," which matches the vault's own back-matter extract word for word. | `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/I Ching Practical Guide.pdf` (50M) | PDF | content: PDF metadata reads `Author(Benebell Wen)` and `Title(I Ching, the Oracle)`; chapter list matches the vault's back-matter extract | certain |
| The Eranos I Ching, translated by Rudolf Ritsema and Shantena Augusto Sabbadini — the book the vault calls "Oracle 2018". Its own table of contents includes a section titled "Basic Features Of The Eranos Translation," confirming the identity even though the author names do not appear in the extracted text near the front. | `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/I Ching Oracle 2018.pdf` (15M) | PDF | content: table of contents section "Basic Features Of The Eranos Translation," chapter titles ("Interrogating the Oracle," "Reading Your Answer") match the vault's oracle-NN extracts | certain |
| The vault's own per-chapter splits of both books (already ingested, useful for diffing against the whole book if a chapter looks short) | `/Users/adrianrasmussen/Documents/Obsidian Vault/Mandala Codes/_processed/Practical Guide/*.pdf` (73 files) and `/Users/adrianrasmussen/Documents/Obsidian Vault/Mandala Codes/_processed/Oracle 2018/*.pdf` (67 files) | PDF, per-hexagram | these are the same files the VPS-path citations point to; the VPS path is just this same vault folder as seen from the Syncthing replica | certain |

## Gene Keys family

| Title / family | Path on disk | Type / size | How matched | Confidence |
|---|---|---|---|---|
| `gene_keys_master.xlsx` (the exact file the vault cites for every `gene-key-NN-cardname` and card-name entry) | `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/gene_keys_master.xlsx` (22K); a PDF export sits alongside it, `gene_keys_master.pdf` (78K) | XLSX / PDF | cited path `file://gene_keys_master.xlsx`, exact filename match | certain |
| Richard Rudd, Gene Keys (the main book) | `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/Gene Keys.pdf` (8.6M); also `/Users/adrianrasmussen/Documents/Files/3 Resources/Books/Gene Keys/Gene Keys.pdf`; also `/Users/adrianrasmussen/Documents/Files/0 Inbox/Gene Keys.pdf` and `Gene Keys 1-20.pdf` (partial) | PDF | filename, author, table of contents ("A Codebook of Consciousness," "Treading the Golden Path") | certain |
| Per-chapter splits of the Gene Keys book, exactly matching the vault's `_pending/Gene Keys Chapters/NN-gene-key-NN.pdf` citations, including the still-missing ones (40, 52, 53, 57, 63, 64 are absent from this folder too) | `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/Gene Keys Chapters/` (61 files: 00-intro through most of 01-64, plus 65-back-matter) | PDF, per-chapter | filename matches vault citation exactly | certain |
| Richard Rudd, The 64 Ways: Wisdom of the Gene Keys (2022) | `/Users/adrianrasmussen/Desktop/keys/The 64 Ways Gene Keys 2022.epub` (1.7M) | EPUB | filename, author, matches vault's `source: file://The-64-Ways-Gene-Keys-2022` | certain |
| Richard Rudd, Activation Sequence guide (2020) | `/Users/adrianrasmussen/Desktop/keys/Activation Sequence Guide Gene Keys.epub` (720K) | EPUB | matches vault's `source: file://Activation-Sequence-Gene-Keys-2020` | certain |
| Richard Rudd, Pearl Sequence guide (2018 and 2020 editions both present) | `/Users/adrianrasmussen/Desktop/keys/Pearl Sequence Guide 2018.pdf` (1.8M) and `Pearl Sequence Guide 2020.epub` (661K) | PDF / EPUB | matches vault's `source: file://Pearl-Sequence-Gene-Keys-2020` | certain |
| Richard Rudd, Venus Sequence guide (2020) | `/Users/adrianrasmussen/Desktop/keys/Venus Sequence Guide Richard Rudd 2020.epub` (2.6M); a related standalone chapter PDF also sits at `/Users/adrianrasmussen/Desktop/keys/The Venus Sequence_ Opening your Heart...pdf` | EPUB / PDF | matches vault's `source: file://Venus-Sequence-Gene-Keys-2020` | certain |
| Codon rings and amino acid correlation material (not a book; a reference grid and image, likely feeding `gene-keys/codon-rings/` and `systems/tarot/tarot-codon-rings-mapping.md`, neither of which carries a source field) | `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/GKs_MA and CD grid.pdf` (112K) and `Codon Rings.jpg` (482K) | PDF / JPG | filename and folder context only, not cited by name in the vault | guess |

## Human Design family

| Title / family | Path on disk | Type / size | How matched | Confidence |
|---|---|---|---|---|
| Dr. Karen Parker, Quantum Wellness: Healing Your Mind, Body, and Spirit with Human Design (2025) | `/Users/adrianrasmussen/Desktop/keys/Quantum Wellness_ Healing Your Mind, Body, and Spirit with -- Dr_ Karen Parker -- 1st Edition, 2025 -- Human Design Press -- ...epub` (19M) | EPUB | filename, author, matches vault's `source: file://Quantum-Wellness-Karen-Parker-2025` | certain |
| Robin Winn, Understanding Centers in Human Design | `/Users/adrianrasmussen/Desktop/keys/Understanding Centers in Human Design.pdf` (6.1M) | PDF | filename, matches vault's `source: file://Understanding-Centers-Robin-Winn` | certain |
| Robin Winn, Understanding Clients (2020) | `/Users/adrianrasmussen/Desktop/keys/Understanding Clients Human Design 2020.pdf` (1.8M) | PDF | matches vault's `source: file://Understanding-Clients-Robin-Winn-2020` | certain |
| Robin Winn, Understanding the Profiles (2022, 3rd edition) | `/Users/adrianrasmussen/Desktop/keys/Understanding the profiles in human design 3 3 -- Robin Winn MFT -- 3, 2022 -- ...pdf` (1.8M) | PDF | matches vault's `source: file://Understanding-the-Profiles-Robin-Winn-2022` | certain |
| Ra Uru Hu, You and Your Shadow (2020) | `/Users/adrianrasmussen/Desktop/keys/Human Design You and the Shadow Ra Uru Hu 2020.pdf` (4.5M) | PDF | matches vault's `source: file://You-and-the-Shadow-Ra-Uru-Hu-2020` | certain |
| Human Design Guide (2021) — the book the vault's `hd-guide-2021` folder slug refers to | `/Users/adrianrasmussen/Desktop/keys/Human Design Guide 2021.pdf` (10M) | PDF | matches vault's `source: file://Human-Design-Guide-2021` and the `_sources/hd-guide-2021/` folder name | certain |
| A Modern Guide to Human Design | `/Users/adrianrasmussen/Desktop/keys/Modern Guide to Human Design.epub` (8.5M) | EPUB | matches vault's `source: file://Modern-Guide-to-Human-Design` | certain |

## Tarot and correspondence material

| Title / family | Path on disk | Type / size | How matched | Confidence |
|---|---|---|---|---|
| The I Ching and Tarot correspondences table (used for every `tarot-*.md` file in every hexagram folder) | `/Users/adrianrasmussen/Downloads/i-ching-and-tarot-correspondences-table.docx` (104K) | DOCX | cited path `file://i-ching-and-tarot-correspondences-table.docx`, exact filename match | certain |
| Golden Dawn tarot material (the task asked about Golden Dawn correspondences; the vault's own tarot system files carry no source citation and read as authored/synthesized rather than extracted, so this is background material only, not a confirmed input) | `/Users/adrianrasmussen/Desktop/Tarot/1 - More Books on Tarot/Tarot Book Collection/The New Golden Dawn Ritual Tarot - Cicero.pdf`; also two Golden Dawn deck image sets under `/Users/adrianrasmussen/Desktop/Tarot/` | PDF / images | filename only, no vault citation found | guess |
| The Xuan tarot system, Eight Immortals, and trigram master-reference files in the vault (`systems/tarot/tarot-xuan-system-introduction.md`, `systems/eight-immortals/*.md`, `systems/trigrams/*.md`) carry no `source:` field at all and have empty bodies apart from frontmatter. These read as content Adrian intends to author directly rather than extract from an external book. No original document was found for them because none appears to be cited. | n/a | n/a | no citation exists to search against | n/a |

## Other I Ching, Gene Keys, Human Design, or Tarot material found but not on the requested list

These were not asked for by name but turned up in the same folders and may be useful:

- AcuPresence 64 Hexagrams Extended, a full acupuncture-correspondence I Ching resource, plus its own per-hexagram chapter split (`AcuPresence Chapters/01-hexagram-1.pdf` through `64-hexagram-64.pdf`), at `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/AcuPresence 64 Hexagrams Extended.pdf` (36M) and its Chapters subfolder. Not currently cited by any vault file.
- Martin Schonberger, The I Ching and the Genetic Code, a full page-image scan at `/Users/adrianrasmussen/Desktop/I Ching/The I Ching & the Genetic Code - Schonberger, Martin/` (65 JPG pages plus an HTML index). Directly relevant to the codon-ring / DNA correlation material.
- Bradford Hatcher's two-volume Yijing translation, `/Users/adrianrasmussen/Desktop/I Ching/1 - More Books on I Ching/Bradford Hatcher - Yijing-One (588p).pdf` and `Yijing-Two (518p).pdf`.
- Edward Shaughnessy, I Ching: The Classic of Changes, two copies (one poor-OCR).
- John Blofeld's I Ching (scan only, no OCR, .djvu).
- Aleister Crowley, Liber CCXVI / The I Ching, two files.
- S.J. Marshall, The Mandate of Heaven: Hidden History in the I Ching (.djvu).
- Jou Tsung Hwa, The Tao of I Ching / The Tao of Ching (multiple editions).
- Sherrill and Chu, An Anthology of I Ching.
- Gregory Richter's I Ching translation.
- Li Yan, The Illustrated Book of Changes.
- A full untranslated Chinese-text I Ching (two page-count variants).
- Jozef Drasny, The Yi Globe: The Image of the Cosmos in the I Ching.
- The whole Desktop `Tarot/` folder, over a hundred tarot deck image sets and a "Tarot Book Collection" subfolder, not inventoried line by line here since nothing in the vault currently cites a specific tarot book.
- `Complete Rave IChing Ra Uru Hu.pdf` at `/Users/adrianrasmussen/Documents/Files/3 Resources/Books/`, a Human Design-flavored I Ching document, not currently cited.

---

## Not found

No title on the requested list is fully missing. Every named book, guide, or table was located somewhere on disk. The only true gaps are the two systems-layer files with no citation to chase (Xuan tarot system, Eight Immortals master reference, and the trigram master reference all read as authored content, not extracted from a source).

## Cited but missing (paths the vault names that do not exist as literal paths on this Mac)

- `/home/vaultsync/rwttx-egoxy/_pending/Oracle 2018/*.pdf` and `_pending/Practical Guide/*.pdf` and `_processed/Wilhelm/*.pdf` — these are VPS-side paths from the Syncthing replica of this same Obsidian vault (the `rwttx-egoxy` segment is that VPS container's own internal name for the vault mount). They do not exist at that literal path on this Mac, but the identical files exist locally at `/Users/adrianrasmussen/Documents/Obsidian Vault/Mandala Codes/_processed/Practical Guide/`, `_processed/Oracle 2018/`, and `_processed/Wilhelm/`. This is not a real gap, just a path that only resolves on the VPS.
- `file://_pending/Gene Keys Chapters/*.pdf` — no `_pending` folder exists inside the vault itself; the same filenames exist at `Universal Langauge/Source Material/extracted/Gene Keys Chapters/`, which is almost certainly what this relative path originally pointed at before the files were moved or the vault was reorganized.

---

## Ten-line summary

Found nearly everything: all six I Ching translations (Legge, Wilhelm-Baynes, Cleary Taoist, Cleary Buddhist, Huang, Deng), the Eranos oracle book, the "Practical Guide" book, the full Gene Keys family (main book, 64 Ways, Activation/Pearl/Venus Sequence guides, gene_keys_master.xlsx), the full Human Design family (Quantum Wellness, three Robin Winn guides, You and Your Shadow, HD Guide 2021, Modern Guide), and the tarot correspondences docx. Nothing on the requested list is truly missing. The three most important paths for refilling the empty extracts for hexagrams 50 to 64:
Gene Keys chapters: `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/Gene Keys Chapters/` (or the whole book, `extracted/Gene Keys.pdf`, for the chapters missing from that folder: 40, 52, 53, 57, 63, 64).
Eranos: `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/I Ching Oracle 2018.pdf`.
Wilhelm: `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/I Ching Wilhelm Abridged.pdf`.
Practical Guide (Benebell Wen, "I Ching, the Oracle"): `/Users/adrianrasmussen/Documents/Files/2 Areas/Laser/Oracle Cards/Adrian deck/Universal Langauge/Source Material/extracted/I Ching Practical Guide.pdf`.
The VPS-path citations in the vault are not missing files, only paths that resolve on the VPS side of the same Syncthing-replicated vault; the identical local copies live under `Mandala Codes/_processed/`.
