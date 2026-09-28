# Article experience: design and interaction

27 September 2026. Scope clarified by Adrian: all article prose is placeholder
material. The work concerns design, layout, interaction, and connections.
Content assessment and research readiness are outside this scope. Earlier
editorial-status changes to existing articles have been removed.

## Design direction

Keep the site's warm palette, serif typography, authentic artwork, and shared
navigation. Build a connected experience from browsing to reading to exploring
a mandala, with useful routes back. Existing article URLs remain unchanged.

### Library

After comparing both designs on screen, restore the original editorial composition:
a large artwork opening, article rows with circular medallions on narrower
screens, and a framed spotlight between the rows. Adrian preferred that visual
variety to the uniform grid introduced in the first pass. Keep category links
as real page links and retain search across titles, descriptions, and tags,
with a result count, clear control, and resettable empty state. The featured
article appears once in browsing and remains discoverable in search.

### Reader

The opener pairs title and reading actions with artwork on desktop, then
stacks clearly on phones. Artwork can be inspected in a full-view dialog.
Section navigation indicates the current section; an unobtrusive progress
indicator tracks the body. Copy-link feedback is visible and accessible.
Paragraph measure, image treatment, and controls must work for both short and
long fixture articles.

The connected mandala has a deliberate visual panel, using the actual linked
card rather than assuming the article cover is that card. Related articles
continue the reading path.

### Connection to the deck

Cards with explicitly connected articles show a restrained From the library
section. Navigation works in both directions through ordinary links, sharing
the same theme and origin in the integrated local preview. Cards without a
connection do not show an empty panel.

### Writing and preview

Keep the existing file-based editor. Draft save and Preview work locally;
uploaded covers and body images carry their layout metadata. The writer runs
at http://127.0.0.1:4322/keystatic; the article preview at
http://127.0.0.1:4321/learn/. The integrated app preview uses
http://127.0.0.1:2222/learn/ for testing deck connections.

## Acceptance checks

- Browse, search, clear, no-results recovery, and category navigation.
- Whole artwork visible, dialog open/close/Escape, keyboard focus return.
- Section links, active-section state, progress, and share feedback.
- Article-to-card and card-to-article navigation.
- Desktop and narrow-phone layouts, both themes, visible focus, reduced motion.
- Production content build and crawlable static links/metadata stay intact.

No article prose was rewritten as part of this design pass. Existing article
fixtures are displayed without automatic readiness classification. Production
deployment is a separate step.
