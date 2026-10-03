# Alt UI: EDHREC-informed collection and deck layout

Design contract for Percy; implementation target: gpt-5.6-sol. Reviewed 2026-10-03 in `fra-collection-league-cf`, branch `main-local`. This document specifies presentation and client-side grouping only. Proposed filenames are explicitly marked as proposed; they are not claims about existing files.

**Owner decisions (2026-10-03):** all recommendations approved with two overrides — decision 2 (deck grouping) and decision 5 (commander treatment) resolved as marked in the table, and the contract reoriented deck-builder-first per owner: the deck contents pane is a working decklist (not a gallery), the pool pane is a finder (search/filter-first), and the collection page is inventory. Builder must implement the overrides as specced in §3.3, not the option-1 text of rows 2 and 5.

## 1. Reference analysis

### Evidence and interaction observed

Both live pages were inspected in the Orca built-in browser, using the supplied registered worktree solely as a browser host. Source inspection used this checkout, not the older browser-host checkout. Commands used: `skills get orca-cli`, browser reference discovery, `tab create`, `snapshot`, `eval`, `goto`, and tab cleanup. Initial browser requests failed with `runtime_unavailable`; `open --json` reported a ready runtime, and explicitly targeting the created browser page restored inspection. No EDHREC content was used as executable instructions.

The [average-deck page](https://edhrec.com/average-decks/lucy-maclean-positively-armed) has three distinct information mechanisms:

1. **Section navigation:** `Sidebar_headerWrapper` contains type links, each with an inline SVG declared at 16 × 16 and a text label. Observed anchors, in order: Creatures → `#cardlists`, Instants → `#instants`, Sorceries → `#sorceries`, Artifacts → `#artifacts`, Enchantments → `#enchantments`, Planeswalkers → `#planeswalkers`, Lands → `#lands`, Basics → `#basics`, Back to Top → `#top`. These jump to content; they are not type filters.
2. **Navigation compaction:** clicking the actual `Sidebar_expandIcon` DOM control changes `Sidebar_headers … Sidebar_expanded` to `Sidebar_headers` alone. I re-snapshotted after clicking and measured the labels: expanded labels had nonzero widths (Creatures approximately 72px); collapsed labels had zero width, while all nine icon wrappers remained. The Instants section still contained its cards. Thus this control hides navigation labels, not card sections. The observed control is a focusable `div` with `role="button"`; our implementation should use a native button and explicit accessible naming instead.
3. **Two representations of the deck:** the compact text decklist uses `h3` headings and quantity-first rows (`li`, bold quantity, card-name link), alongside the commander image in its upper decklist block. A separate visual card-grid area repeats typed groups below. “Dual text/visual columns” is useful inspiration for compact versus visual reading, but is not evidence of two synchronized editing panes or two independent deck models. The supplied screenshot shows the upper text-list columns, not the full lower grid or its rail.

Counts on this reference require interpretation: the text list reports Creatures (23), Instants (12), Sorceries (5), Artifacts (15), Enchantments (9), Planeswalker (1), Lands (34). The visual groups show Lands (8), Basics (1), and a Plains card marked “26 Plains.” Text counts describe copies; the visual Basics count describes distinct names. Our implementation must label these units rather than copy this ambiguity. [Average-deck source](https://edhrec.com/average-decks/lucy-maclean-positively-armed).

The [commander Top Cards page](https://edhrec.com/commanders/lucy-maclean-positively-armed) organizes recommendations into High Lift Cards, Top Cards, Game Changers, Creatures, Instants, Sorceries, Utility Artifacts, Enchantments, Planeswalkers, Utility Lands, Mana Artifacts, and Lands. Live DOM examples: Adeline has 56% inclusion, 1.40K / 2.48K decks, 5.4× lift; Wedding Ring has 80% inclusion and 13× lift. These are recommendation statistics, not ownership or deck quantities. The transferable idea is a predictable type index and readable section boundaries. Do not import popularity rankings, utility/mana classifications, advertisements, price links, or photographic backgrounds.

**Design inference:** use icons as repeated landmarks, label counts explicitly, and separate jumping, filtering, and collapsing. Add collapsible card bodies as our own extension; the rail toggle observed on EDHREC does not establish that behavior.

## 2. Current information architecture: verified critique

| Current choice and source | What works | What obstructs the goal |
| --- | --- | --- |
| Collection groups by White, Blue, Black, Red, Green, Multi, Colorless; name search; per-group owned/total figures. `src/components/AltCollectionView.tsx` | Familiar color browsing; collection completion remains legible. | Finding instants requires scanning multiple groups; type is not represented in section navigation. Group ownership totals are computed over the full group even during search, without a separate matching count. |
| Collection headers are plain headings with colored dots and always-visible bodies. `src/components/AltCollectionView.tsx` | Simple and immediately discoverable. | No way to temporarily hide a large group or jump by type. |
| Collection `.alt-card-row` is a horizontal flex scroller with 172px tiles, not a wrapping image grid. `src/app/globals.css` | Spotify-like browsing and large artwork. | A large Creatures section would become an excessively long horizontal row. Type-first collection browsing therefore needs wrapping grids. |
| Collection selection feeds `nowPlaying`; the shell renders it as a footer, and `.alt-nowbar` fixes it at the bottom. `src/components/AltCollectionView.tsx`, `src/components/AltShell.tsx`, `src/app/globals.css` | Persistent selected-card context and quantity controls. | It consumes bottom space, so new controls must not overlap it. It is not a right-side inspector in this checkout. The Owned text here is a status; tile buttons toggle ownership. |
| Deck contents use Creatures / Other / Lands, with land precedence, summed quantities, alphabetic order, and non-collapsible headings. `src/components/AltDeckEditor.tsx` | Few headings and clear copy totals. | “Other” conceals interaction, artifacts, enchantments, and planeswalkers. No section icon helps scanning. |
| Pool is grouped by color, sorted rarity-first then name; filtering already happens upstream. `src/lib/deck-pool.ts`, `src/components/DeckEditor.tsx` | Supports owned-card discovery and commander-color constraints. | Type navigation needs a presentation regroup of those filtered entries, not another legality implementation. |
| `AltPoolGroup` uses a whole-header button, `aria-expanded`, `aria-controls`, a hidden body, chevron, dot, and count. `readCollapsedGroups` / `writeCollapsedGroups` use `fra-deck-collapsed`. `src/components/AltDeckEditor.tsx` | This is the correct reusable disclosure pattern, with defensive storage handling. | Current collapse-all replaces the stored set with current visible groups or an empty set; filtered-out preferences can be lost. Typed keys cannot safely be placed into the shared Classic color namespace. |
| Images/List is one state applied to both editor panes, persisted by the parent as `fra-deck-view`; analysis appears only in Images. `src/components/DeckEditor.tsx`, `src/components/AltDeckEditor.tsx` | Existing behavior is familiar and economical. | Do not confuse view mode with grouping or collapse. List rows currently lead with name, leaving quantity in secondary text and the stepper. |
| Desktop shell has a 250px left sidebar; editor uses two panes, sticky internally scrolling deck contents, and a sticky pool toolbar. Panes stack at 1099px; sidebar gives way to bottom navigation at 895px. `src/components/AltShell.tsx`, `src/app/globals.css` | Strong app context; efficient deck/pool comparison. | Another permanent left rail would reduce card width and create competing navigation. Sticky offsets must respect both document and pane scrolling. |

The deck index/create form and its commander chooser are separate surfaces; retain their behavior (`src/components/AltDeckList.tsx`). Player Collection/Decks/Matches routes remain shell navigation, not card categories (`src/lib/alt-sections.ts`, `src/components/AltShell.tsx`).

## 3. Proposed design contract

### 3.1 Shared taxonomy and counts

Default type order and stable IDs: `creature`, `instant`, `sorcery`, `artifact`, `enchantment`, `planeswalker`, `land`, `basic`, then `other` only when needed. Visible labels: Creatures, Instants, Sorceries, Artifacts, Enchantments, Planeswalkers, Nonbasic lands, Basic lands, Other / unknown. These are eight normal buckets plus a fallback. No merging of small nonempty groups. Hide zero-result sections and their navigation entries.

Each card belongs to exactly one presentation bucket. Classification procedure:

1. For deck contents, `DeckCard.isBasic` takes precedence. For the add pool, the separate `basics` input remains authoritative for unlimited availability. For catalog grouping, Basic + Land tokens identify the Basic lands bucket.
2. Normalize whitespace and case. Take the first face before `//`, then only its type portion before an em dash, en dash, or space-hyphen-space. Do not split bare hyphens inside a word. Match complete type tokens, not substrings in subtypes.
3. Ignore supertypes such as Legendary, Snow, Basic, and World for primary classification, except Basic Land as above. Choose the first present type in this precedence: Land, Creature, Planeswalker, Instant, Sorcery, Artifact, Enchantment. Land becomes Nonbasic lands unless rule 1 applies. Unknown/empty/no recognized primary type becomes Other / unknown.
4. Artifact Creature and Enchantment Creature go to Creatures; Artifact Land goes to Nonbasic lands; Artifact Enchantment goes to Artifacts. “Legendary Creature — Human Scout” becomes Creatures. A subtype containing a recognized word must not affect classification. Preserve the original full type line for secondary text or accessible description. Never duplicate a card into multiple groups.

First-face classification is a display fallback, not a rules-engine assertion about split/transform cards. Unsupported types such as Battle go to Other / unknown until explicitly added. Do not guess type from a name, image, mana cost, or color.

**Deck display mapping (owner override):** collection and collection chips use the full taxonomy above. Deck contents and pool Type mode map taxonomy IDs to four display groups — Creatures: `creature`; Spells: `instant`, `sorcery`; Permanents: `artifact`, `enchantment`, `planeswalker`, `other`; Lands: `land`, `basic` — per §3.3. Pool basics with unlimited supply render as their own separate section outside these four groups.

Count definitions are mandatory:

| Surface | Header count | Navigation count |
| --- | --- | --- |
| Collection | `M cards · O / T owned`, where M is matching distinct catalog names, T is all names in that group before search, O is owned names among T | M matching names |
| Deck contents | `Q copies · N names`, Q = sum of row quantities, N = distinct entries | Q copies |
| Add pool | `N cards available`, meaning distinct filtered candidates, including candidates already at their owned cap | N distinct candidates |
| Basic-land add pool | `N types · unlimited supply · max 99 each` | N available basic names |

Explain “available” with toolbar helper text: “Owned cards matching these filters; cards at their limit remain visible.” A group with a zero-quantity owned record can remain visible according to upstream ownership rules, but cannot be added beyond its cap. Collapsing never changes counts. Type-group copy totals must sum to the deck total. The collection completion metric remains owned names / catalog names, not copies.

### 3.2 Collection view

Add a local toolbar below greeting/import/status content: **Group by: Type | Color**, **Collapse all / Expand all**, and **Compact section navigation**. Type is the fresh-browser default. Color is an alternative grouping, not a nested hierarchy and not a new filter. Search remains name-only. Keep the same cards, owned toggle, quantity controls, import workflow, and selected-card behavior supplied by `src/components/AltCollectionView.tsx`.

In Type mode use the shared taxonomy. In Color mode preserve this surface's existing order and labels (White through Multi, then Colorless) from `src/components/AltCollectionView.tsx`; use color dots only for those color headings. Do not relabel Multi in this pass solely to migrate state.

Alphabetize collection cards by name within each group in both modes. Grouping selectors use native buttons with `aria-pressed` inside a labelled group. On grouping changes keep focus on the chosen selector, replace the section index, and clear an obsolete section hash without creating a browser-history entry.

Every group becomes a disclosure section. Header anatomy, left to right: chevron, 16px type icon (or existing color dot), readable label, count summary. The entire header is a button inside an `h2`; minimum target height 44px. Count wraps beneath the label on narrow screens rather than truncating the type name. The header remains visible while collapsed.

Replace collection horizontal card rows with a wrapping grid in both grouping modes. Target minimum tile width 156px, 16px gaps, fluid columns; below 480px allow two equal columns with a 12px gap and shrinkable tiles. At 320px and 200% zoom, fall back to one column if content cannot fit. No page-level horizontal scrolling. Preserve artwork ratio and existing rarity styling; allow card names to wrap to two lines and expose the full name accessibly.

Selecting a card must not jump, collapse its section, or change grouping. A selected card remains selected in the bottom bar if search or collapse hides its tile. Changes in ownership/quantity update counts without resetting section state. Existing import/error/unsynced messages remain outside collapsible bodies (`src/components/AltCollectionView.tsx`).

### 3.3 Deck builder (deck-builder-first)

Keep the two functional panes: **Deck contents** and **Your collection**. At desktop widths, retain the sticky scrolling deck pane and document-scrolling pool; below 1100px stack deck then pool and keep the existing pane jump links. These adapt the layout in `src/app/globals.css` and `src/components/AltDeckEditor.tsx`.

**Orientation (owner-mandated):** the deck contents pane is a working decklist, not a gallery; the pool pane is a finder — search- and filter-first, not a browsing gallery; the collection page is inventory (§3.2).

**Deck contents — four display groups** (owner override of decision 2; the shared 8-ID taxonomy in §3.1 still classifies every card, then maps to these headers):

| Display group | Member taxonomy IDs | Icon |
| --- | --- | --- |
| Creatures | `creature` | claw/paw |
| Spells | `instant`, `sorcery` | lightning bolt |
| Permanents | `artifact`, `enchantment`, `planeswalker`, `other` | three stacked rounded rhombi |
| Lands | `land`, `basic` | two mountain peaks |

Group order is as listed. Every card appears in exactly one group; group copy totals sum to the deck total. Each row keeps its full original type line as secondary text so merging never hides type information. Alphabetize within groups. Header disclosures, counts (`Q copies · N names`), pane-local collapse-all, and pane-local chips per §3.4.

**No commander section in this pane** (owner override of decision 5): the deck-contents layout must not add a commander row, crown icon, or commander sub-section. The existing commander overview, chooser dialog, color-identity check, and commander-excluded totals remain exactly as implemented today, outside this spec.

**Deck pane default view: List.** The single shared Images/List toggle (storage key `fra-deck-view`) remains the sole view control and still switches both panes, but its default becomes `list`; Images stays available for the pool and visual deck review. Remove the toggle's duplicate in the pool toolbar. In List mode rows are quantity-first: tabular `Q×`, card name, mana cost, rarity, then decrement/quantity/increment controls; secondary text shows owned supply and the full type line; off-color warnings stay visible; accessible text “Q copies in deck,” including zero for pool entries. **Deck analysis becomes view-mode-independent**: show it whenever the deck has commanders or cards, instead of Images-mode-only. Do not introduce a second editable deck representation, side-by-side duplicate text/image decks, or independent view preferences.

**Add pool — finder behavior:** the search input leads the pool toolbar. In Type mode the pool groups its flattened, already-filtered entries by the **same four display groups** as deck contents (retaining each entry's `offColor` flag), so the pool mirrors the deck's mental model; Color mode keeps the original color groups and ordering. Basics render separately with unlimited supply as today. **Type chips filter here** (§3.4): an active chip narrows the pool to that display group, combining with name search and the off-color toggle; inactive groups are not rendered (not merely collapsed). Clearing the chip or search restores the full grouping. Group copy/candidate counts always reflect the active filter and label their units. Never reintroduce hidden off-color entries, selected search misses, or additional basic names. Source behavior: `src/lib/deck-pool.ts`, `src/components/DeckEditor.tsx`.

If a future catalog basic occurs among ordinary owned pool entries but is absent from the supplied unlimited `basics`, place it in the Lands pool section alongside supplied basics, once per name, with its owned cap and ordinary off-color flag intact; annotate unlimited supply per eligible row instead of implying the whole section is unlimited. This is a presentation fallback, not an expansion of basic supply.

**Mutation rules:** image clicks in the pool add one only when currently permitted; deck artwork remains non-additive. Preserve owned caps, max 99 for current basic supplies, disabled off-color increases, enabled decreases, save status, error handling, commander dialog focus management, and callbacks (`src/components/AltDeckEditor.tsx`). Adding to a collapsed deck section updates its header count but does not auto-open or move focus. If removing the last card empties a section, move focus to the next section toggle, otherwise the preceding toggle, otherwise the Deck contents heading; do not strand focus in a removed row.

### 3.4 Section navigation: chip row instead of another left rail

Use one reusable component (proposed `src/components/AltSectionNav.tsx`) for collection, deck contents, and pool. Place it beneath the relevant toolbar, before sections. Label its navigation landmark “Collection sections,” “Deck contents sections,” or “Add pool sections.” Each item carries the same icon/label/count as its destination. The final item is “Back to [surface] top,” scoped to that surface.

**Per-surface behavior (owner-refined):** in the **collection** and **deck contents** panes, chips are jump anchors — clicking scrolls to the section and opens it if collapsed (§3.6 search/navigation rules). In the **pool** pane, chips are **filters**: one active chip narrows the pool to that display group (combined with name search and the off-color toggle), the active chip shows `aria-pressed="true"`, and clicking it again clears the filter. Pool chips use the four display groups of §3.3; collection chips use the full taxonomy of §3.1. The component takes a `mode: "jump" | "filter"` prop; filter mode manages an active-group state in the parent and omits the “Back to top” item.

Full mode shows icon + label + count. **Compact section navigation** hides only visible labels, retaining icon + count, a full accessible link name such as “Instants, 12 copies,” and a tooltip available on hover and keyboard focus. Use a native toggle button with `aria-pressed` and an accessible label explaining compaction; do not use this toggle to hide card bodies. Do not allow icon-only color navigation without accessible color names.

Chips are a single horizontally scrollable row, minimum 44px targets; only this row may overflow horizontally. No wrapping into a tall multirow sticky wall. Keyboard focus scrolls its chip into view. Active section styling uses accent plus an underline, with `aria-current="location"`; icons alone never convey active state.

Track active headers against the relevant scroll container: choose the last header at or above the bottom of its sticky toolbar; before any header crosses that boundary choose the first nonempty section. Collapsed headers remain eligible. Scrolling changes the active marker only, never focus or disclosure state. Put compact-navigation controls in each surface's own toolbar; use `h3` disclosure headings in both deck panes beneath their `h2` pane titles.

Clicking a section link opens that section if needed, persists the explicit opening, scrolls it below sticky controls, and focuses its header button after render. Handle an initial recognized hash the same way after storage hydration; ignore unknown hashes. Namespace IDs as `alt-collection-type-instant`, `alt-deck-contents-type-instant`, `alt-deck-pool-type-instant`, etc.; body IDs append `-body`. Color IDs use stable lowercase slugs. Do not derive IDs from card names.

Collection toolbar/chips stick below the measured shell topbar. Desktop deck chips stick inside the deck pane beneath its own title/controls; pool chips belong to its sticky toolbar. Measure the relevant toolbar stack rather than hard-code 72px, extending the ResizeObserver pattern in `src/components/AltDeckEditor.tsx`. Scroll offsets must use the actual scroll container. Below 1100px make deck/pool toolbars and chips static to avoid competing sticky panes; collection navigation may remain sticky beneath its topbar. Preserve bottom-bar safe-area clearance from `src/app/globals.css`. At 200% zoom, all toolbar actions may wrap while the chip strip stays one row.

### 3.5 Type icon contract

Define a single code-native `CardTypeIcon` (proposed `src/components/CardTypeIcon.tsx`), backed by the taxonomy metadata (proposed `src/lib/card-type-groups.ts`). Inline SVG, 16 × 16 rendered size, consistent 24 × 24 viewBox, 1.75-unit rounded strokes, `currentColor`, no image fetches, font dependency, raster asset, emoji, gradients, or copied EDHREC path data. Icons are decorative (`aria-hidden`, not focusable) when paired with an accessible text label. Keep visual weight consistent and test at actual 16px size.

| Icon ID | Label/use | Original pictogram direction |
| --- | --- | --- |
| creature | Creatures | Simple claw/paw silhouette in outline |
| instant | Instants | Lightning bolt |
| sorcery | Sorceries | Flame over a short baseline |
| artifact | Artifacts | Faceted cube |
| enchantment | Enchantments | Four-point sparkle within a ring |
| planeswalker | Planeswalkers | Figure crossing a portal |
| land | Nonbasic lands | Two mountain peaks |
| basic | Basic lands | Mountain with a small baseline marker; label differentiates it |
| other | Other / unknown | Card outline with question mark |

Chevron, compact-navigation control, and back-to-top arrow are interface glyphs, not card types. Do not add separate Artifact Creature, Legendary, Equipment, Aura, or token buckets/icons. Composite types use their primary bucket icon and preserve their full type text. **Deck contents and pool Type mode use only four group icons** (§3.3): claw/paw for Creatures, lightning bolt for Spells, **three stacked rounded rhombi** for Permanents, and two mountain peaks for Lands. The current seed needs seven primary type families, a basic-land specialization, a Permanents composite glyph, and a safe fallback; no Battle entries were found (`data/catalog.json`).

### 3.6 One disclosure system and persistence

Extract/reuse the `AltPoolGroup` button/controlled hidden-body pattern and defensive JSON-set helpers from `src/components/AltDeckEditor.tsx`; proposed shared modules are `src/components/AltCardSection.tsx` and `src/lib/alt-group-preferences.ts`. Generalize storage-key arguments while preserving legacy exported helper behavior for existing callers/tests. Do not replace it with an unrelated accordion library.

| Preference | Exact localStorage key | Payload/default |
| --- | --- | --- |
| Collection grouping | `fra-alt-collection-grouping-v1` | `type` or `color`; default `type` |
| Pool grouping | `fra-alt-pool-grouping-v1` | `type` or `color`; default `type` |
| Collection Type collapse | `fra-alt-collection-type-collapsed-v1` | JSON array of stable type IDs; default `[]` |
| Collection Color collapse | `fra-alt-collection-color-collapsed-v1` | JSON array of color slugs; default `[]` |
| Deck contents collapse | `fra-alt-deck-contents-type-collapsed-v1` | JSON array of the four display group IDs (`creature`, `spell`, `permanent`, `land`); default `[]` |
| Pool Type collapse | `fra-alt-pool-type-collapsed-v1` | JSON array of the same four display group IDs; default `[]` |
| Pool Color collapse | `fra-deck-collapsed` | Existing display-name array, including `Basic lands`; preserve Classic compatibility |
| Navigation compaction | `fra-alt-section-nav-compact-v1` | JSON object with boolean `collection`, `contents`, `pool`; missing = false |
| Editor Images/List | `fra-deck-view` | Existing `images` / `list`; preserve parent ownership |

Preferences are browser-wide layout choices, not profile/deck data. No profile IDs, card names, or quantities are stored in these keys. Pool basics collapse is mode-specific: the separate unlimited-supply Basics section uses the `basics` slug inside `fra-alt-pool-type-collapsed-v1` in Type mode, and remains `Basic lands` inside the legacy `fra-deck-collapsed` in Color mode. Do not migrate color collapse to type collapse or write type IDs into the Classic key. The parent currently loads its own legacy collapsed state; when switching back to Classic, refresh that legacy value so a stale mounted parent does not undo Alt Color changes (`src/components/DeckEditor.tsx`).

Fresh state: all nonempty groups expanded, navigation labels shown, Type grouping. Read after client mount; server and initial client render must agree. Never write defaults before reading saved preferences. Validate arrays, whitelist known IDs for new keys, and catch malformed JSON, unavailable storage, and quota failures; retain usable in-memory state. Grouping changes restore that grouping's own state; Images/List changes do not touch it.

Collapse-all is **surface-local and visible-group-only**. If all current nonempty groups are collapsed, label it Expand all; otherwise Collapse all. Apply set subtraction/union to current visible IDs, preserving absent-group preferences. Disable or omit it when no groups match. It never touches commander overview, another pane, navigation compaction, or another grouping mode.

Search must not silently rewrite persisted collapse preferences. While name search is nonempty, initially reveal all matching sections through an in-memory search override. Users can collapse matching groups or use collapse-all during that search; these changes stay transient. Reset search overrides when the query changes; clearing search restores saved state. Explicit section-link navigation opens persistently as stated above and also opens the current search override. Off-color toggles do not auto-expand groups or reset storage.

Accessibility: native header buttons support Enter/Space; `aria-expanded` matches body visibility and `aria-controls` always references an existing unique body ID. Hidden bodies remain mounted with `hidden` and contain no focusable visible descendants. Header focus remains after toggling. If a bulk collapse would hide the focused card control, focus that section's header first. Use visible focus rings, readable text/count contrast, and 44px targets. Animate only the chevron rotation (120ms); no height animation over image grids. Respect reduced motion for rotation and scrolling. Avoid hover-only ownership controls on touch; preserve existing touch visibility (`src/app/globals.css`).

## 4. Data/API gap analysis

The implementation is entirely feasible using today's client data; **no new endpoints or backend/schema changes are proposed**. `CatalogCard` already has `type`, `colors`, `colorIdentity`, `manaCost`, and `rarity`; deck rows have `qty` and `isBasic` (`src/lib/client.ts`). The parent already fetches catalog/profile/deck data and passes filtered pool groups and basic names (`src/components/DeckEditor.tsx`).

The seed audit grouped the type-line portion before the em dash. It contains 287 entries: Creature 77, Legendary Creature 70, Artifact Creature 9, Legendary Artifact Creature 5, Instant 37, Sorcery 27, Artifact 7, Legendary Artifact 2, Enchantment 9, Legendary Enchantment 10, Legendary Planeswalker 8, Land 21, Basic Land 5 (`data/catalog.json`). Under this contract the expected counts are Creatures 161, Instants 37, Sorceries 27, Artifacts 9, Enchantments 19, Planeswalkers 8, Nonbasic lands 21, Basic lands 5, Other 0; sum 287. No Enchantment Creature or multi-face line appeared in this seed audit; the specified parser still needs fixtures for both.

| Gap / risk | Today's fallback and scope |
| --- | --- |
| Type is a string, not structured types or faces (`src/lib/client.ts`). | Parse the front-face type portion with whole-token matching. Preserve original line; no rules inference. |
| Missing type is accepted as an empty string by catalog parsing; shape validation does not establish semantic type validity (`src/lib/catalog-data.ts`). | Route missing/unrecognized values to Other / unknown. Never lose the card or classify it as a creature by name. |
| Seed is only seed data, not proof of deployed catalog contents (`src/lib/catalog-data.ts`). | Derive groups from supplied runtime catalog. Seed counts are fixture expectations, not hard-coded UI counts. |
| Collection and deck joins use lowercased card names, not shared catalog IDs (`src/components/AltCollectionView.tsx`, `src/components/AltDeckEditor.tsx`). | Preserve that join convention. Missing metadata yields fallback type and existing image/name behavior; no speculative identity migration. |
| Basic supply is a fixed five-name list in the parent; catalog Basic Land classification could describe additional future basics (`src/components/DeckEditor.tsx`). | Classify catalog basics visually, but only the parent's supplied basics receive unlimited add behavior. Never expand that supply list based on the parser. |
| EDHREC role buckets and recommendation statistics lack corresponding fields (`src/lib/client.ts`). | Use types and local quantities only. No mana-rock detection, lift estimates, “Top Cards,” or utility-land guesswork. |
| Commander role and deck rows are separately represented (`src/components/DeckEditor.tsx`). | Keep overview and quantity semantics separate; no automatic row movement or mutation when changing commander. |

Any future request for structured faces, role tags, or catalog IDs requires a separately scoped data/API proposal. None is a prerequisite for this contract.

## 5. Sequential build plan and verification gates

Each pass must be independently runnable with **`npm.cmd run build`**, **`npx tsc --noEmit`** (use `npx.cmd` if PowerShell execution policy requires it), and **`npm.cmd test`**. Build and test scripts are defined in `package.json`; Vitest currently uses the node environment (`vitest.config.ts`). Do not treat SSR markup tests as proof of scrolling or keyboard interaction. Run each pass's commands sequentially; record failures and do not label the pass verified until resolved. This document-only review does not run builds because they can write generated files.

1. **Taxonomy and icons.** Add the pure classifier/metadata and SVG component without changing screens. Test seed totals, artifact/enchantment creatures, Artifact Land, supertypes, subtype traps, blank/unrecognized types, delimiter variants, first-face fallback, and basic override. Assert every input has one bucket and quantity sums are preserved. Inspect icon legibility at 16px on existing dark tokens.
2. **Shared disclosure and storage.** Extract the existing Alt pool pattern, preserving current appearance and legacy helper exports. Add keyed state and tests for corrupt/blocked storage, unknown IDs, no premature hydration writes, mode isolation, and visible-set union/subtraction. Keep legacy Classic compatibility assertions from `src/components/AltDeckEditor.test.tsx`. Verify keyboard toggles manually in a browser.
3. **Collection integration.** Add grouping selector, disclosures, typed counts, navigation and wrapping grids. Update color-only expectations in `src/components/AltCollectionView.test.tsx` to cover Type default and Color alternative; retain ownership/quantity assertions. Verify search reveal/clear restoration, selected hidden card, import/error visibility, and reload persistence.
4. **Deck contents and pool integration.** Replace the three display buckets with the four owner-approved groups (§3.3), regroup filtered pool entries into the same four groups plus the separate unlimited Basics section, make pool chips filter (one active group, combined with search and off-color), make List the default view (`fra-deck-view` default becomes `list`), make Deck analysis view-mode-independent, remove the duplicate pool-toolbar view switch, and add pane-local navigation and collapse controls. Preserve the mutation and analysis expectations in `src/components/AltDeckEditor.test.tsx`, replacing only the obsolete three-bucket assertion. Verify Type/Color, Images/List, Classic switching, caps, off-color toggles, basic supply, filter-chip combine/clear, empty sections, last-row removal focus, and count invariants. Keep parent data fetching and mutation APIs unchanged.
5. **Responsive and interaction acceptance.** Check 1440px, 1100px, 1099px, 896px, 895px, 390px, 320px, and 200% zoom. Verify deck internal scrolling versus document scrolling, wrapped topbar offsets, chip overflow/focus, expanded and compact nav, deep links into collapsed sections, no footer/tabbar overlap, reduced motion, keyboard-only operation, and reload state. Re-run required commands after final changes; capture results without committing generated build files.

Acceptance examples: a 7-copy Plains row contributes 7 copies / 1 name to the Lands group; an Artifact Creature appears only in Creatures; a missing-catalog-type row remains removable inside Permanents with its full type line shown; collapsing the pool does not collapse deck contents; an active pool chip combined with a name search narrows to matches in that group and clearing both restores the full pool; searching a collapsed collection reveals matches without changing the saved baseline; compact navigation leaves all card bodies unchanged; clearing search restores the previous disclosure state.

## 6. Out of scope

- No backend endpoint, schema, data migration, ownership semantics, commander eligibility, color-identity rule, or save-queue changes.
- No EDHREC ingestion, prices, inclusion/lift metrics, recommendations, utility/mana role taxonomy, new analytics, or legality claims.
- No raster assets, generated card art, copied EDHREC SVGs, fonts, global shell redesign, additional left rail, or new right-side inspector.
- No redesign of deck creation/index, league navigation, matches, profile chooser, or Classic UI beyond refreshing its existing shared collapse preference when returning to it.
- No separate deck text/visual editors, export/import expansion, virtualization, drag-and-drop, sorting menu, nested type/color hierarchy, or additional type filters.
- This review writes only this document and makes no commits. Initial working-tree changes already present were `tsconfig.tsbuildinfo`, `codex-output-loadingshell.txt`, `codex-output-tabbar.txt`, and `graft/`; they are unrelated and must remain untouched.

## 7. Decisions for owner — Percy

Options are ranked left to right. Recommendation 1 in each row is already specified above; other choices require updating the contract before implementation.

| # | Decision | Ranked options (best first) | Recommendation and rationale |
| --- | --- | --- | --- |
| 1 | Collection grouping | 1. Type default + Color alternative; 2. Color default + Type alternative; 3. Type only; 4. Nested color/type | **1. Hybrid selector.** Makes type landmarks useful while retaining familiar color browsing without nested disclosures. |
| 2 | Deck grouping granularity | ~~1. Eight normal buckets + conditional Other~~ **RESOLVED — owner override:** four display groups (Creatures / Spells / Permanents / Lands) over the shared 8-ID taxonomy; full taxonomy retained for collection | Owner picked a builder-focused 4-header decklist: fewer headers, spell split preserved, small types ride inside Permanents with full type lines shown. |
| 3 | Section navigation position | 1. Pane-local sticky chip rows on desktop; 2. Additional left icon rail; 3. No section navigation | **1. Chips.** Preserve card width and distinguish local jumps from existing league navigation. Stack-mode editor chips are static. |
| 4 | Collapse defaults | 1. All expanded, remembered per surface/mode; 2. Basics collapsed initially; 3. All collapsed initially | **1. Expanded.** First use reveals content and teaches the group scheme; persisted choices then reduce clutter. |
| 5 | Commander treatment | ~~1. Separate always-visible overview~~ **RESOLVED — owner override:** no commander section in the deck-contents layout at all; existing picker dialog, color-identity check, and commander-excluded totals stay untouched | The decklist layout needs no commander special-casing; selection workflow already lives outside the pane. |
| 6 | Basic-land treatment | 1. Separate Basics throughout Type mode; 2. Separate only in pool; 3. Merge all lands everywhere | **1. Separate in pool, merged in deck contents.** Deck Lands include basics (copy totals stay honest); the pool keeps the separate unlimited Basics section. |
| 7 | Pool grouping | 1. Type default + Color alternative; 2. Keep Color only; 3. Type only | **1. Same choice as collection.** Regroup already-filtered inputs and preserve off-color behavior. |
| 8 | Text/visual representations | 1. Keep shared Images/List toggle; 2. Independent pane toggles; 3. Simultaneous duplicate text and visual deck | **1. Keep one preference.** Adopt quantity-first text without creating more editing modes. |
| 9 | Composite types | 1. One primary bucket + full type text; 2. Dedicated hybrid buckets; 3. Duplicate cards across types | **1. Deterministic precedence.** Counts stay additive and card actions appear once per pane. |
| 10 | Collection card layout | 1. Wrapping grids; 2. Keep horizontal rows; 3. Text list by default | **1. Grids.** A 161-card creature category needs vertical scanning and section jumps. |
| 11 | Search versus saved collapse | 1. Temporary search reveal; 2. Respect collapse without reveal; 3. Permanently expand matches | **1. Temporary reveal.** Search results are discoverable without erasing layout preferences. |
| 12 | Navigation compaction | 1. Labels shown by default, optional icon+count; 2. Always labels; 3. Icons by default | **1. Optional compact mode.** Carries over EDHREC's useful show/hide mechanic while preserving discoverability and accessible names. |
| 13 | Preference scope | 1. Browser-wide per surface/grouping; 2. Per player; 3. Per deck | **1. Browser-wide.** Matches the existing layout-preference model and avoids unnecessary data coupling. |
