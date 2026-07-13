# Relations Diagram Alignment Design

## Outcome

The Relations diagram uses one mathematical anchor for each connector endpoint, medallion, selection halo, and caption. Code 22 displays the Hierophant as V, the Hebrew Vav as the vector letter ו, the paired code as a drawn hexagram, and codon kin with a distinct ring icon.

## Geometry

Each outer node is an absolutely positioned square whose center is the node coordinate. The medallion fills that square. Its caption is absolutely positioned below the square, so caption height cannot shift the medallion away from the SVG connector and selection halo. The center node follows the same rule. The existing radial coordinates and visual scale remain unchanged.

## Symbols and data

- Pair: render the paired card's true six-line hexagram from its upper and lower trigram data.
- Codon ring: render a small three-orbit vector mark, visually distinct from a hexagram.
- Tarot: derive the Roman numeral from the authored Tarot card value instead of hardcoding XIV.
- Hebrew: normalize Vav/Vau to ו and render it as a dedicated SVG path, independent of font coverage.
- Sky and Immortal: retain their current symbols.

## Verification

Pure-data tests cover Tarot numeral extraction and Hebrew-letter normalization. Browser verification at the screenshot's narrow mobile width checks that medallion centers coincide with connector endpoints and selection halos, that captions do not overlap medallions, and that Code 22 shows V rather than XIV.
