# The printed book's cover

Two ways to change the front and back cover, then rebuild with `npm run workbook -- --book`:

1. **Change the words.** Edit `cover.json`: the title, the line under it, the author, and
   the line on the back page.
2. **Use your own design.** Save it as `front.pdf` and/or `back.pdf` in this folder, one A4
   page each (210 × 297 mm, portrait). Anything you place here replaces the text cover.
   Keep important things 10 mm inside the edge in case the printer trims.

The build writes the print pack to `workbook/print/`: the inside pages, the front cover, the
back cover, a complete file for proofing, and one page of printing instructions for the
printer. Send the whole folder.
