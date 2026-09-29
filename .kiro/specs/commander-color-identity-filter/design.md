# Design Document

## Overview

This feature teaches the app about **MTG color identity** so the deck builder can enforce the Commander subset rule: every non-commander card must have a color identity that is a subset of the commander(s) color identity.

It has two halves:

1. **Data + type** — add a `colorIdentity` string (canonical WUBRG, `""` for colorless) to every entry in `data/catalog.json`, sourced from the [FRA set on Scryfall](https://scryfall.com/sets/fra), and declare it on the `CatalogCard` type in both `src/lib/catalog.ts` and `src/lib/client.ts`. A build-time validation gate rejects the build if any card lacks a valid identity.
2. **Behavior** — in `src/components/DeckEditor.tsx`, resolve the deck's commander color identity, filter the collection/add-card list to subset-legal cards (always keeping colorless cards and basic lands), and mark out-of-identity cards already in the deck while blocking quantity increases.

All new comparison logic lives in one pure module (`src/lib/color-identity.ts`) that is unit- and property-testable.

### Requirements coverage map

| Design section | Requirements |
|---|---|
| Data: catalog color identity | 1.1–1.6 |
| Type changes (`CatalogCard`) | 2.1–2.7 |
| Color identity utility module | 3.1–3.10 |
| Commander identity resolution | 4.1–4.7 |
| Card selection list filtering | 5.1–5.7, 6.1–6.6 |
| Deck contents panel | 7.1–7.5 |

## Architecture

The catalog is a **build-time JSON import** (`import catalogData from "../../data/catalog.json"`) surfaced synchronously by `getCatalog()`. It flows to the client over `/api/catalog` (`src/app/api/catalog/route.ts` → `NextResponse.json(getCatalog())`) and lands in `DeckEditor` as `CatalogCard[]`. Adding `colorIdentity` to each JSON entry propagates end-to-end with **no runtime file reads and no async** — honoring the Cloudflare Workers constraint (no `node:fs`, no `process.cwd()` at request time).

```mermaid
flowchart LR
  A["data/catalog.json<br/>(+ colorIdentity)"] -->|build-time import| B["getCatalog()<br/>src/lib/catalog.ts"]
  B -->|validate on load| B
  B --> C["/api/catalog route"]
  C -->|CatalogCard[]| D["DeckEditor.tsx"]
  E["src/lib/color-identity.ts<br/>(pure: parse / subset / union / serialize)"] --> D
  D --> F["Card selection list<br/>(subset filter)"]
  D --> G["Deck contents panel<br/>(out-of-identity marking)"]
```

Design decisions and rationale:

- **One pure utility module.** Parsing, subset, union, and serialization are extracted into `src/lib/color-identity.ts` so the comparison rules are defined once and are testable in isolation from React and D1. `DeckEditor` and the catalog validation both consume it.
- **`colorIdentity` as a canonical string, not `string[]`.** JSON stays compact, the DB stores nothing new (color identity is a catalog property, not per-collection), and the string form is trivially validated by regex. Sets are derived on demand.
- **No schema/DB change.** Color identity is intrinsic to a card, already available client-side via the catalog. The deck's collection and deck-card rows do not need it, so no migration and no touch to D1 write paths (the 100-param and no-transaction rules stay irrelevant here — see Data Models).
- **Commander stays a single string in the DB, second commander is derived, not stored.** See "Commander identity resolution" for the minimal extension.

## Components and Interfaces

### `src/lib/color-identity.ts` (new, pure)

```ts
export type WUBRG = "W" | "U" | "B" | "R" | "G";
export type ColorIdentity = Set<WUBRG>;

export const WUBRG_ORDER: readonly WUBRG[]; // ["W","U","B","R","G"]

/** Parse a stored colorIdentity value into a set of distinct WUBRG colors.
 *  Tolerant: null/undefined/non-string → empty set; lowercase accepted;
 *  duplicates collapsed; non-WUBRG characters ignored. (Req 3.1–3.8) */
export function parseIdentity(value: unknown): ColorIdentity;

/** Serialize a set to canonical WUBRG order, e.g. {G,W} → "WG". (Req 3.9, 2.3) */
export function serializeIdentity(id: ColorIdentity): string;

/** True when every color in `card` is also in `commander`.
 *  Empty `card` is a subset of any `commander`. (Req 5.1–5.3, 6.3) */
export function isSubsetIdentity(card: ColorIdentity, commander: ColorIdentity): boolean;

/** Union of any number of identities. (Req 4.2, 4.7) */
export function unionIdentity(...ids: ColorIdentity[]): ColorIdentity;
```

`parseIdentity` accepts `unknown` so the same function guards both the catalog validation path and the runtime `card.colorIdentity` field defensively.

### `src/lib/catalog.ts` (changed)

- Extend `CatalogCard` with `colorIdentity: string`.
- Add a build/load-time validation: on first `getCatalog()` call, assert every entry has a `colorIdentity` matching `/^(?!.*(.).*\1)[WUBRG]{0,5}$/` (0–5 chars, WUBRG only, no repeats) **and** already in canonical order. If any entry fails, throw an `Error` naming the offending card (Req 1.6, 2.6). Validation result is memoized so it runs once per module instance, keeping `getCatalog()` synchronous (Req 2.5, 2.7).

### `src/lib/client.ts` (changed)

- Add `colorIdentity: string` to the duplicated `CatalogCard` type so the client shape matches the server shape (Req 2.1).

### `src/components/DeckEditor.tsx` (changed)

New derived values (all `useMemo` over existing `catalog`/`deck` state, no new fetches):

- `commanderNames: string[]` — the selected commander(s), 0–2 entries (see resolution below).
- `commanderIdentity: ColorIdentity | undefined` — `undefined` when none selected; otherwise the union of each named commander's parsed identity (Req 4.1–4.7).
- `isLegal(card): boolean` — `commanderIdentity === undefined || card.isBasic || isSubsetIdentity(parseIdentity(catalog.colorIdentity), commanderIdentity)` (Req 5, 6).

The collection/add-card rendering (both `images` and `list` view modes) filters its owned-card list through `isLegal`. Basic lands render from `BASICS` unconditionally (Req 5.7, 6.5). Deck-contents rendering is unchanged in membership but adds an out-of-identity marker and blocks the `+` stepper for out-of-identity cards (Req 7).

## Data Models

### `colorIdentity` field

- **Shape**: string of 0–5 characters from `{W,U,B,R,G}`, no repeats, in canonical order W→U→B→R→G. Empty string = colorless (Req 2.2–2.4).
- **Source of truth**: the FRA set on Scryfall. Color identity ≠ the existing `colors` field: `colors` is casting cost color and uses labels like `"multi"`/`"colorless"`; color identity additionally includes colors from mana symbols in rules text and, for multi-faced cards, the union across faces (Req 1.5). The two must not be conflated — `colors: "colorless"` does **not** imply `colorIdentity: ""` (e.g. a colorless-cast card with a colored activated ability).

### Obtaining and verifying the values (Req 1.1–1.6, 1.4, 1.5)

A one-off, developer-run enrichment step (not part of the request-time runtime, not committed as a runtime dependency):

1. Fetch the FRA set from the Scryfall API (`https://api.scryfall.com/cards/search?q=set:fra`, paginated via `has_more`/`next_page`), which returns each card's `color_identity` array already normalized and, for multi-faced cards, aggregated across faces.
2. Match each of the 287 catalog entries to a Scryfall card by exact name (case-insensitive; for split/DFC entries match on the front-face or full `name`).
3. Map the Scryfall `color_identity` array (e.g. `["G","W"]`) to a canonical string via `serializeIdentity(new Set(arr))`.
4. Write `colorIdentity` back into each `data/catalog.json` entry.
5. **Verification gate**: if any catalog entry has no Scryfall match, the enrichment aborts and reports the offending card names rather than defaulting to `""` (Req 1.6). The values are cross-checked by re-parsing each written string and confirming set-equality with the source array (Req 1.4).

The enrichment output is the edited `data/catalog.json`; the network fetch is a build-time authoring action, never a request-time call.

### Build-time validation (defense in depth) (Req 1.6, 2.5, 2.6, 2.7)

Independently of how the data was produced, `getCatalog()` validates the bundled JSON on first access: every entry must carry a `colorIdentity` string that is well-formed and canonical. A missing or malformed value throws with the offending card name, so a bad catalog fails fast at load rather than silently filtering cards wrong. Because the catalog is a static import, this runs against bundled data — no filesystem access (Req 2.7).

### Database

No schema change. Color identity is a catalog-intrinsic property consumed client-side; it is not persisted per collection or deck card. **No D1 write path is modified**, so the 100-bound-parameter limit and the no-cross-statement-transaction constraint from the Workers/D1 steering are not engaged by this feature. The profile-seed insert in `src/app/api/profiles/route.ts` continues to seed only `{id, profileId, name, qty, owned}` and its existing 20-row chunking is untouched.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The parsing/set utility and the resolution/filtering logic are pure functions with input-varying behavior over a large input space, so property-based testing applies. The following properties were consolidated from the prework to remove redundancy (e.g. "show subset cards" and "hide non-subset cards" collapse into a single "shown iff subset-match" property; the several parse-range criteria collapse into one; single-commander resolution is the one-operand case of union resolution).

### Property 1: Parse yields only distinct WUBRG colors

*For any* input value, `parseIdentity` returns a set that contains only colors from {W,U,B,R,G}, contains a color at most once, has size at most 5, and includes a color exactly when that letter (any case) occurs in the input.

**Validates: Requirements 3.1, 3.2, 3.6, 3.7**

### Property 2: Parsing is case-insensitive

*For any* string, `parseIdentity(s)` equals `parseIdentity(s.toUpperCase())`.

**Validates: Requirements 3.8**

### Property 3: Serialization is canonical

*For any* color-identity set, `serializeIdentity` produces a string whose characters are a subset of {W,U,B,R,G}, with no repeats, ordered in Canonical_WUBRG_Order (W→U→B→R→G); the empty set serializes to `""`.

**Validates: Requirements 2.2, 2.3, 2.4, 3.9**

### Property 4: Parse/serialize round-trip

*For any* input value, `parseIdentity(serializeIdentity(parseIdentity(x)))` is set-equal to `parseIdentity(x)`; and every catalog `colorIdentity` string equals `serializeIdentity(parseIdentity(it))` (already canonical).

**Validates: Requirements 1.2, 2.5, 3.10**

### Property 5: The empty identity is a subset of every identity

*For any* commander color-identity set K, `isSubsetIdentity(emptySet, K)` is true.

**Validates: Requirements 5.3, 6.1, 6.3**

### Property 6: Union is commutative and monotonic

*For any* color-identity sets A and B, `unionIdentity(A,B)` equals `unionIdentity(B,A)`, and both A and B are subsets of `unionIdentity(A,B)`.

**Validates: Requirements 4.2, 4.7**

### Property 7: Commander identity resolves as the union of known commanders

*For any* selection of up to 2 commander names, the resolved Commander_Color_Identity equals the union of `parseIdentity(card.colorIdentity)` over the selected names that match a CatalogCard; names with no matching CatalogCard contribute the empty set. (The single-commander case is the one-operand instance.)

**Validates: Requirements 4.1, 4.4**

### Property 8: A card is shown in the selection list iff it is legal

*For any* owned card and any defined Commander_Color_Identity K, the card is displayed in the Card_Selection_List if and only if it is a Basic_Land or its parsed color identity is a Subset_Match of K.

**Validates: Requirements 5.1, 5.2, 5.6, 6.4**

### Property 9: With no commander, all owned cards are shown

*For any* owned collection, when Commander_Color_Identity is undefined, every owned card is displayed in the Card_Selection_List.

**Validates: Requirements 5.4**

### Property 10: Basic lands are always available

*For any* defined Commander_Color_Identity, every Basic_Land option is displayed in and addable from the Card_Selection_List regardless of color identity.

**Validates: Requirements 5.7, 6.5**

### Property 11: Deck contents remain fully visible

*For any* deck contents and any defined Commander_Color_Identity, every card already in the deck remains displayed in the deck contents panel, including cards whose color identity is not a Subset_Match.

**Validates: Requirements 7.1**

### Property 12: Out-of-identity deck cards are marked and cannot be increased

*For any* deck card and any defined Commander_Color_Identity K, the distinguishing indicator is present and the quantity-increase control is disabled if and only if the card is not a Basic_Land and its color identity is not a Subset_Match of K; the quantity-decrease control remains enabled in all cases.

**Validates: Requirements 7.2, 7.3, 7.4**

## Error Handling

- **Malformed / missing catalog identity (Req 1.6, 2.6):** `getCatalog()` validates on first access and throws an `Error` naming the offending card if any entry's `colorIdentity` is absent, non-string, or not a well-formed canonical string. This surfaces at load/build rather than degrading silently into wrong filtering. The enrichment step separately aborts (without writing) if a catalog card has no Scryfall match.
- **Defensive parsing (Req 3.3, 3.4, 3.5):** `parseIdentity` never throws — `null`, `undefined`, non-strings, and strings with no WUBRG letters all yield the empty set. This keeps `DeckEditor` robust even if a stray record slips past validation.
- **Unknown commander name (Req 4.4):** a selected commander name with no matching CatalogCard contributes the empty set and does not abort resolution; remaining known commanders still determine the identity.
- **Commander cap (Req 4.6):** the UI prevents selecting a 3rd commander; selection attempts beyond 2 are ignored, holding the count at 2.
- **Save failures:** unchanged from today — deck/card `PUT` errors already surface via the existing `error` banner and reload path in `DeckEditor`.

## Testing Strategy

### Framework

No test runner is currently configured. This feature introduces **Vitest** (the natural fit for a Vite project) plus **fast-check** for property-based testing. Neither is implemented from scratch. A `test` script is added to `package.json` and tests run with `vitest --run` (single execution, not watch mode).

### Property tests (pure logic)

Properties 1–12 are implemented as fast-check property tests against `src/lib/color-identity.ts` and the extracted resolution/filter helpers (the pure parts of `DeckEditor` — commander resolution, `isLegal`, and the marker/disable predicate are factored into pure functions so they can be tested without React).

- Each property test runs a minimum of **100 iterations**.
- Each is tagged with a comment: **Feature: commander-color-identity-filter, Property {number}: {property_text}**.
- Each correctness property maps to a **single** property-based test.
- Generators cover the edge cases identified in prework: lowercase letters, repeated letters, non-WUBRG characters, empty strings, `null`/`undefined`/non-string inputs (Req 3.3–3.8), pairs and singletons of commanders, and the empty (colorless) identity.

### Unit / example tests

For criteria classified as EXAMPLE / EDGE_CASE / SMOKE in prework:

- Catalog completeness: every `getCatalog()` entry has a `colorIdentity` (Req 1.1); colorless cards carry `""` (Req 1.3, 2.4).
- Validation gate: a fixture catalog with a missing/malformed `colorIdentity` makes `getCatalog()` throw naming the card (Req 1.6, 2.6).
- Resolution states: no commander → `undefined` (Req 4.3); all-colorless commanders → defined empty set distinct from `undefined` (Req 4.5); 3rd-commander selection blocked (Req 4.6).
- Filtering edge: commander with no matching owned non-basic → only basics shown (Req 5.6); empty commander identity → only colorless cards + basics (Req 6.4, 6.6).
- Reactivity: changing the commander recomputes the filtered list; recompute is a synchronous `useMemo` so the 500ms budget is trivially met (Req 5.5).
- Removal: setting an out-of-color deck card to qty 0 removes it immediately via the existing delete path (Req 7.5).

### Integration / authoring checks (Req 1.4, 1.5)

Correctness of the `colorIdentity` values against Scryfall is an authoring-time cross-check (re-parse written string vs the source `color_identity` array, with spot checks on multi-faced cards), not a request-time or property test — the external data is not our code to quantify over.

### Type / smoke (Req 2.1, 2.7)

`colorIdentity: string` on both `CatalogCard` declarations is enforced by `tsc --noEmit`. The synchronous static-import contract (no request-time fs) is preserved by keeping `getCatalog()`/`catalogNames()` non-async, per the Workers/D1 steering.
