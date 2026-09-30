# Implementation Plan: Commander Color Identity Filter

## Overview

Implement MTG color identity end-to-end: add a `colorIdentity` string to the catalog data and type, a pure comparison module, a build/load-time validation gate, and Deck_Builder filtering that enforces the Commander subset rule. All logic respects the Workers/D1 steering — no request-time filesystem access, `getCatalog()` stays synchronous, and no D1 write path is touched. Tests use Vitest + fast-check; the 12 correctness properties from the design become property-based tests.

Language: TypeScript (per the design document).

## Tasks

- [x] 1. Add `colorIdentity` to the CatalogCard type
  - [x] 1.1 Declare `colorIdentity: string` on `CatalogCard` in `src/lib/catalog.ts`
    - Add the property to the exported `CatalogCard` type; keep `getCatalog()`/`catalogNames()` synchronous and the static `import catalogData from "../../data/catalog.json"` unchanged (no request-time fs)
    - _Requirements: 2.1, 2.7_

  - [x] 1.2 Declare `colorIdentity: string` on the duplicated `CatalogCard` in `src/lib/client.ts`
    - Match the server shape so the client type carries `colorIdentity`
    - _Requirements: 2.1_

- [x] 2. Create the pure color-identity module
  - [x] 2.1 Implement `src/lib/color-identity.ts`
    - Export `WUBRG` / `ColorIdentity` types and `WUBRG_ORDER = ["W","U","B","R","G"]`
    - `parseIdentity(value: unknown): ColorIdentity` — tolerant: null/undefined/non-string → empty set; lowercase accepted; duplicates collapsed; non-WUBRG chars ignored; max 5 distinct colors
    - `serializeIdentity(id: ColorIdentity): string` — canonical WUBRG order, no repeats, empty set → `""`
    - `isSubsetIdentity(card, commander): boolean` — every color in `card` also in `commander`; empty `card` is a subset of any `commander`
    - `unionIdentity(...ids: ColorIdentity[]): ColorIdentity` — union of any number of identities
    - Pure, no React, no D1
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.1, 5.2, 5.3, 4.2, 4.7, 2.2, 2.3, 2.4_

  - [x] 2.2 Write property test — Property 1: parse yields only distinct WUBRG colors
    - **Feature: commander-color-identity-filter, Property 1: For any input value, parseIdentity returns a set that contains only colors from {W,U,B,R,G}, contains a color at most once, has size at most 5, and includes a color exactly when that letter (any case) occurs in the input.**
    - **Validates: Requirements 3.1, 3.2, 3.6, 3.7**
    - fast-check, min 100 iterations

  - [x] 2.3 Write property test — Property 2: parsing is case-insensitive
    - **Feature: commander-color-identity-filter, Property 2: For any string, parseIdentity(s) equals parseIdentity(s.toUpperCase()).**
    - **Validates: Requirements 3.8**
    - fast-check, min 100 iterations

  - [x] 2.4 Write property test — Property 3: serialization is canonical
    - **Feature: commander-color-identity-filter, Property 3: For any color-identity set, serializeIdentity produces a string whose characters are a subset of {W,U,B,R,G}, no repeats, ordered W→U→B→R→G; the empty set serializes to "".**
    - **Validates: Requirements 2.2, 2.3, 2.4, 3.9**
    - fast-check, min 100 iterations

  - [x] 2.5 Write property test — Property 4: parse/serialize round-trip
    - **Feature: commander-color-identity-filter, Property 4: For any input value, parseIdentity(serializeIdentity(parseIdentity(x))) is set-equal to parseIdentity(x).**
    - **Validates: Requirements 1.2, 2.5, 3.10**
    - fast-check, min 100 iterations

  - [x] 2.6 Write property test — Property 5: empty identity is a subset of every identity
    - **Feature: commander-color-identity-filter, Property 5: For any commander color-identity set K, isSubsetIdentity(emptySet, K) is true.**
    - **Validates: Requirements 5.3, 6.1, 6.3**
    - fast-check, min 100 iterations

  - [x] 2.7 Write property test — Property 6: union is commutative and monotonic
    - **Feature: commander-color-identity-filter, Property 6: For any sets A and B, unionIdentity(A,B) equals unionIdentity(B,A), and both A and B are subsets of unionIdentity(A,B).**
    - **Validates: Requirements 4.2, 4.7**
    - fast-check, min 100 iterations

- [x] 3. Add the build/load-time validation gate
  - [x] 3.1 Validate the bundled catalog on first `getCatalog()` access
    - Assert every entry has a `colorIdentity` matching `/^(?!.*(.).*\1)[WUBRG]{0,5}$/` and already in canonical WUBRG order (equal to `serializeIdentity(parseIdentity(it))`)
    - Throw an `Error` naming the offending card on any missing/non-string/malformed value
    - Memoize so validation runs once per module instance; `getCatalog()` stays synchronous (no async, no fs)
    - _Requirements: 1.6, 2.5, 2.6, 2.7_

  - [x] 3.2 Write unit test for the validation gate
    - Fixture catalog with a missing/malformed `colorIdentity` makes the validated read throw an error naming the card; a well-formed fixture passes
    - _Requirements: 1.6, 2.6_

- [x] 4. Enrich `data/catalog.json` with color identity
  - [x] 4.1 Author `colorIdentity` for every catalog entry from the FRA Scryfall data
    - Developer-run enrichment: fetch `https://api.scryfall.com/cards/search?q=set:fra` (paginate via `has_more`/`next_page`), match each entry by exact name (case-insensitive; front-face/full `name` for split/DFC), map each `color_identity` array to canonical string via `serializeIdentity(new Set(arr))`, and write it back into each `data/catalog.json` entry (empty string for colorless; combined faces for DFC/split)
    - The network fetch is an authoring-time action only — never a request-time call; nothing async or fs-based is added to the runtime path
    - Verification cross-check: re-parse each written string and confirm set-equality with the source `color_identity` array; if any catalog entry has no Scryfall match, abort without writing and report the offending card names (do not default to `""`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.2 Write unit test for catalog completeness
    - Every `getCatalog()` entry has a `colorIdentity`; colorless cards carry `""`; each string equals `serializeIdentity(parseIdentity(it))` (canonical, Property 4 catalog clause)
    - _Requirements: 1.1, 1.3, 2.4_

- [x] 5. Checkpoint — data + pure logic solid
  - Ensure all tests pass and `tsc --noEmit` is clean; ask the user if questions arise.

- [x] 6. Set up the test toolchain
  - [x] 6.1 Add Vitest + fast-check and a test script
    - Add `vitest` and `fast-check` as devDependencies; add `"test": "vitest --run"` to `package.json` scripts; add minimal Vitest config if needed for the Vite project
    - _Requirements: (test infrastructure for Requirements 3.x, 4.x, 5.x, 6.x, 7.x property/unit tests)_

- [x] 7. Factor and implement commander identity resolution in DeckEditor
  - [x] 7.1 Extract pure resolution/predicate helpers
    - In a testable module (e.g. `src/lib/deck-identity.ts` or exported pure helpers), implement `resolveCommanderIdentity(names, catalog): ColorIdentity | undefined` (undefined when none selected; union of parsed identities of matching commanders; unknown names contribute empty set; empty-set result distinct from undefined), `isLegal(card, commanderIdentity, isBasic)`, and the deck-card `isOutOfIdentity` marker/disable predicate
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 5.1, 5.2, 5.3, 6.3_

  - [x] 7.2 Wire commander resolution into `DeckEditor.tsx`
    - Add `useMemo`-derived `commanderNames` (0–2), `commanderIdentity`, and `isLegal` over existing `catalog`/`deck` state (no new fetches); prevent selecting a 3rd commander, holding the count at 2
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 7.3 Write property test — Property 7: commander identity is the union of known commanders
    - **Feature: commander-color-identity-filter, Property 7: For any selection of up to 2 commander names, the resolved Commander_Color_Identity equals the union of parseIdentity(card.colorIdentity) over selected names that match a CatalogCard; names with no match contribute the empty set.**
    - **Validates: Requirements 4.1, 4.4**
    - fast-check, min 100 iterations

  - [x] 7.4 Write unit tests for resolution states
    - No commander → `undefined` (4.3); all-colorless commanders → defined empty set distinct from `undefined` (4.5); 3rd-commander selection blocked (4.6)
    - _Requirements: 4.3, 4.5, 4.6_

- [x] 8. Implement card selection list subset filtering
  - [x] 8.1 Filter the collection/add-card list through `isLegal`
    - In both `images` and `list` view modes, filter the owned-card list by `isLegal`; render Basic_Land options from `BASICS` unconditionally; when no owned non-basic is legal, show an empty list apart from basics; colorless (empty identity) cards always shown/addable; re-evaluate synchronously via `useMemo` when the commander changes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 8.2 Write property test — Property 8: a card is shown iff it is legal
    - **Feature: commander-color-identity-filter, Property 8: For any owned card and any defined Commander_Color_Identity K, the card is displayed in the Card_Selection_List iff it is a Basic_Land or its parsed color identity is a Subset_Match of K.**
    - **Validates: Requirements 5.1, 5.2, 5.6, 6.4**
    - fast-check, min 100 iterations

  - [x] 8.3 Write property test — Property 9: with no commander, all owned cards are shown
    - **Feature: commander-color-identity-filter, Property 9: For any owned collection, when Commander_Color_Identity is undefined, every owned card is displayed in the Card_Selection_List.**
    - **Validates: Requirements 5.4**
    - fast-check, min 100 iterations

  - [x] 8.4 Write property test — Property 10: basic lands are always available
    - **Feature: commander-color-identity-filter, Property 10: For any defined Commander_Color_Identity, every Basic_Land option is displayed in and addable from the Card_Selection_List regardless of color identity.**
    - **Validates: Requirements 5.7, 6.5**
    - fast-check, min 100 iterations

  - [x] 8.5 Write unit tests for filtering edges
    - Commander with no matching owned non-basic → only basics shown (5.6); empty commander identity → only colorless cards + basics (6.4, 6.6); changing commander recomputes the filtered list (5.5)
    - _Requirements: 5.5, 5.6, 6.4, 6.6_

- [x] 9. Implement deck contents out-of-identity handling
  - [x] 9.1 Mark out-of-identity deck cards and gate the stepper
    - Keep every deck card visible in the deck contents panel; add a distinguishing indicator on cards whose identity is not a Subset_Match; disable the quantity-increase control for out-of-identity non-basic cards; keep decrease enabled; decreasing to zero removes the card immediately via the existing delete path
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.2 Write property test — Property 11: deck contents remain fully visible
    - **Feature: commander-color-identity-filter, Property 11: For any deck contents and any defined Commander_Color_Identity, every card already in the deck remains displayed in the deck contents panel, including out-of-Subset_Match cards.**
    - **Validates: Requirements 7.1**
    - fast-check, min 100 iterations

  - [x] 9.3 Write property test — Property 12: out-of-identity deck cards are marked and cannot be increased
    - **Feature: commander-color-identity-filter, Property 12: For any deck card and any defined Commander_Color_Identity K, the indicator is present and the increase control is disabled iff the card is not a Basic_Land and its color identity is not a Subset_Match of K; the decrease control remains enabled in all cases.**
    - **Validates: Requirements 7.2, 7.3, 7.4**
    - fast-check, min 100 iterations

  - [x] 9.4 Write unit test for auto-remove at zero
    - Setting an out-of-color deck card to qty 0 removes it immediately via the existing delete path, no confirmation
    - _Requirements: 7.5_

- [x] 10. Final checkpoint — ensure all tests pass
  - Ensure all tests pass and `tsc --noEmit` is clean; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific granular requirements for traceability.
- Property tests use fast-check with a minimum of 100 iterations, one test per correctness property, each tagged `Feature: commander-color-identity-filter, Property N: ...`.
- Workers/D1 steering respected: no request-time filesystem access, `getCatalog()` stays synchronous, and no D1 write path is modified (color identity is a catalog-intrinsic property, not persisted per collection/deck).
- The Scryfall fetch in task 4.1 is an authoring-time enrichment step only; it never runs at request time.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "6.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1", "7.1"] },
    { "id": 3, "tasks": ["4.2", "7.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4"] }
  ]
}
```
