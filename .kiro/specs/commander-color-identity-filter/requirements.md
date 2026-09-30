# Requirements Document

## Introduction

The card catalog (`data/catalog.json`) records each card's casting `colors` but not its MTG **color identity**. Color identity is the authoritative property used by Commander deck-building rules: every non-commander card in a deck must have a color identity that is a subset of the deck's commander(s) color identity.

This feature has two parts:

1. **Data**: add a `colorIdentity` field to every card in the catalog, sourced from the [FRA set on Scryfall](https://scryfall.com/sets/fra). Color identity is a set of WUBRG colors (White=W, Blue=U, Black=B, Red=R, Green=G) and may be empty (colorless).
2. **Behavior**: in the deck builder (`src/components/DeckEditor.tsx`), hide from the collection/add card selection any card whose color identity is not a subset of the selected commander(s) color identity, mirroring Commander rules.

The catalog is bundled at build time and read synchronously via `getCatalog()` in `src/lib/catalog.ts`; the Cloudflare Workers runtime forbids Node built-ins at request time. All logic added by this feature must respect those constraints.

## Glossary

- **WUBRG**: The five Magic: The Gathering colors — White (W), Blue (U), Black (B), Red (R), Green (G).
- **Color_Identity**: The set of WUBRG colors that a card is considered to belong to for Commander rules. Represented as a set of the letters `W`, `U`, `B`, `R`, `G`. An empty set denotes a colorless identity.
- **Catalog**: The bundled card dataset in `data/catalog.json`, exposed through `getCatalog()` and `catalogNames()` in `src/lib/catalog.ts`.
- **CatalogCard**: A single entry in the Catalog, typed by `CatalogCard` in `src/lib/catalog.ts` and `src/lib/client.ts`.
- **Commander**: A card designated as a deck's commander. A deck currently stores a single commander name (`deck.commander: string | null`).
- **Commander_Color_Identity**: The union of the Color_Identity of every Commander selected for a deck. When no Commander is selected, it is undefined (no filter applied).
- **Deck_Builder**: The deck editing view implemented by `DeckEditor` in `src/components/DeckEditor.tsx`.
- **Card_Selection_List**: The "Your collection" / "Add cards" panel in the Deck_Builder from which cards are added to the deck.
- **Subset_Match**: The relation where card color identity set C is a subset of Commander_Color_Identity set K, i.e. every color in C is also in K. The empty set is a Subset_Match of every set, including the empty set.
- **Basic_Land**: One of Plains, Island, Swamp, Mountain, Forest, listed in `BASICS` in the Deck_Builder.
- **Canonical_WUBRG_Order**: The fixed character sequence W, U, B, R, G used to order color letters in any serialized Color_Identity.

## Requirements

### Requirement 1: Catalog color identity data

**User Story:** As a deck builder, I want every catalog card to carry its color identity, so that the application can enforce Commander color rules.

#### Acceptance Criteria

1. THE Catalog SHALL provide a `colorIdentity` value for every CatalogCard entry.
2. THE `colorIdentity` value SHALL be expressed in canonical set form, containing each color letter drawn from {`W`, `U`, `B`, `R`, `G`} at most once and ordered in Canonical_WUBRG_Order.
3. WHERE a card has no colored identity on the FRA set on Scryfall, THE Catalog SHALL represent that card's `colorIdentity` as an empty set.
4. THE `colorIdentity` value for each CatalogCard SHALL be set-equal to the color identity of the corresponding card in the FRA set on Scryfall.
5. WHERE a CatalogCard represents a double-faced or split card, THE Catalog SHALL set its `colorIdentity` to the combined color identity of all faces as reported by the FRA set on Scryfall.
6. IF a CatalogCard has no matching entry in the FRA set on Scryfall, THEN THE Catalog build SHALL flag the offending card and reject the build rather than assign an empty `colorIdentity`.

### Requirement 2: Color identity data model

**User Story:** As a developer, I want a typed representation of color identity, so that catalog data and filtering logic share one consistent shape.

#### Acceptance Criteria

1. THE CatalogCard type SHALL declare a `colorIdentity` property of string type.
2. THE CatalogCard type SHALL represent `colorIdentity` as a string of 0 to 5 characters, each character drawn from the uppercase letters `W`, `U`, `B`, `R`, `G`, with no character repeated.
3. THE CatalogCard type SHALL order the characters of `colorIdentity` in the canonical sequence W, U, B, R, G.
4. WHERE a CatalogCard has no colored identity, THE CatalogCard type SHALL represent `colorIdentity` as the empty string.
5. WHEN `getCatalog()` is called, THE Catalog SHALL return each CatalogCard with its `colorIdentity` property populated as a string conforming to criteria 2 through 4.
6. IF a CatalogCard source entry cannot be mapped to a valid `colorIdentity` conforming to criteria 2 through 4, THEN THE Catalog SHALL reject the catalog load with an error indicating the offending card, and SHALL NOT return a CatalogCard with an unpopulated or malformed `colorIdentity`.
7. WHEN the Catalog is accessed at request time, THE Catalog SHALL load `colorIdentity` from the build-time bundled import without reading the filesystem.

### Requirement 3: Color identity parsing

**User Story:** As a developer, I want a single function that converts stored color identity into a comparable set, so that subset checks are consistent across the Deck_Builder.

#### Acceptance Criteria

1. WHEN a `colorIdentity` string value is provided, THE Deck_Builder SHALL derive a set containing each distinct color drawn from the five letters {`W`, `U`, `B`, `R`, `G`} present in that value.
2. THE derived set SHALL contain at most 5 colors.
3. IF a `colorIdentity` value contains no WUBRG colors, THEN THE Deck_Builder SHALL derive an empty set.
4. IF the provided `colorIdentity` value is null or undefined, THEN THE Deck_Builder SHALL derive an empty set.
5. IF the provided `colorIdentity` value is not a string, THEN THE Deck_Builder SHALL derive an empty set.
6. WHEN a `colorIdentity` value contains a repeated color letter, THE Deck_Builder SHALL include that color once in the derived set.
7. WHEN a `colorIdentity` value contains characters outside the five WUBRG letters, THE Deck_Builder SHALL exclude those characters from the derived set.
8. WHEN a `colorIdentity` value contains lowercase color letters, THE Deck_Builder SHALL derive the same set as for the uppercase equivalent.
9. WHEN a set is serialized, THE Deck_Builder SHALL order the color letters in Canonical_WUBRG_Order.
10. FOR ALL `colorIdentity` values, deriving the set then serializing SHALL produce a value that derives to an equal set (round-trip property).

### Requirement 4: Commander color identity resolution

**User Story:** As a deck builder, I want the deck's allowed colors derived from its commander, so that the card filter reflects my commander choice.

#### Acceptance Criteria

1. WHEN exactly one Commander is selected and that Commander name has a matching CatalogCard, THE Deck_Builder SHALL set Commander_Color_Identity to the set of colors in the Color_Identity of the selected Commander, where each color is one of the five values {White, Blue, Black, Red, Green}.
2. WHERE more than one Commander is selected, up to a maximum of 2 Commanders, THE Deck_Builder SHALL set Commander_Color_Identity to the union of the Color_Identity sets of every selected Commander that has a matching CatalogCard.
3. WHILE no Commander is selected, THE Deck_Builder SHALL leave Commander_Color_Identity undefined.
4. IF a selected Commander name has no matching CatalogCard, THEN THE Deck_Builder SHALL treat that Commander's contribution to Commander_Color_Identity as an empty set and SHALL still resolve Commander_Color_Identity from any remaining matching Commanders.
5. WHEN every selected Commander resolves to an empty Color_Identity set, THE Deck_Builder SHALL set Commander_Color_Identity to an empty set, distinct from the undefined state, indicating a colorless identity.
6. WHILE 2 Commanders are selected, THE Deck_Builder SHALL prevent selection of an additional Commander, holding the count of selected Commanders at a maximum of 2.
7. THE Deck_Builder SHALL compute Commander_Color_Identity as the union of the Color_Identity sets of at most 2 selected Commanders.

### Requirement 5: Subset filtering of the card selection list

**User Story:** As a deck builder, I want cards outside my commander's colors hidden from the add list, so that I only add legal cards.

#### Acceptance Criteria

1. WHILE Commander_Color_Identity is defined, THE Deck_Builder SHALL display in the Card_Selection_List only cards whose Color_Identity is a Subset_Match of Commander_Color_Identity.
2. WHILE Commander_Color_Identity is defined, THE Deck_Builder SHALL hide from the Card_Selection_List every card whose Color_Identity is not a Subset_Match of Commander_Color_Identity.
3. WHILE Commander_Color_Identity is defined, THE Deck_Builder SHALL display in the Card_Selection_List every card whose Color_Identity is the empty set, since the empty set is a Subset_Match of any Commander_Color_Identity.
4. WHILE no Commander is selected, THE Deck_Builder SHALL display all owned cards in the Card_Selection_List regardless of Color_Identity.
5. WHEN the selected Commander changes, THE Deck_Builder SHALL re-evaluate which cards are displayed in the Card_Selection_List within 500ms of the change.
6. WHILE Commander_Color_Identity is defined and no owned non-Basic_Land card is a Subset_Match of Commander_Color_Identity, THE Deck_Builder SHALL display an empty Card_Selection_List apart from Basic_Land options.
7. WHILE a Commander is selected, THE Deck_Builder SHALL continue to display Basic_Land options in the Card_Selection_List regardless of Color_Identity.

### Requirement 6: Colorless card handling

**User Story:** As a deck builder, I want colorless cards to remain addable under any commander, so that artifacts and colorless cards follow Commander rules.

#### Acceptance Criteria

1. WHILE any Commander is selected, THE Deck_Builder SHALL display in the Card_Selection_List every owned card whose Color_Identity is the empty set.
2. WHILE any Commander is selected, THE Deck_Builder SHALL allow the deck builder to add to the deck any card whose Color_Identity is the empty set.
3. FOR ALL Commander_Color_Identity values, THE Deck_Builder SHALL treat a card whose Color_Identity is the empty set as a Subset_Match and SHALL NOT filter that card out of the Card_Selection_List.
4. WHERE Commander_Color_Identity is the empty set, THE Deck_Builder SHALL display in the Card_Selection_List only cards whose Color_Identity is the empty set, together with Basic_Land options.
5. WHILE any Commander is selected, THE Deck_Builder SHALL make Basic_Land options available for adding to the deck regardless of Commander_Color_Identity.
6. WHERE Commander_Color_Identity is the empty set, THE Deck_Builder SHALL include in the Card_Selection_List every owned card whose Color_Identity is the empty set and every Basic_Land option.

### Requirement 7: Existing deck contents preserved

**User Story:** As a deck builder, I want cards already in my deck to stay visible even if they fall outside the commander's colors, so that I can review and adjust them.

#### Acceptance Criteria

1. WHILE a Commander is selected, THE Deck_Builder SHALL continue to display the deck contents panel including cards whose Color_Identity is not a Subset_Match of Commander_Color_Identity.
2. WHILE a Commander is selected, THE Deck_Builder SHALL display a distinguishing visual indication on each deck card whose Color_Identity is not a Subset_Match of Commander_Color_Identity.
3. WHEN a card already in the deck falls outside Commander_Color_Identity, THE Deck_Builder SHALL allow the deck builder to decrease that card's quantity.
4. IF a card already in the deck falls outside Commander_Color_Identity, THEN THE Deck_Builder SHALL block any increase of that card's quantity.
5. WHEN the deck builder decreases an out-of-color card's quantity to zero, THE Deck_Builder SHALL remove that card from the deck contents panel automatically and immediately, without a separate confirmation step.
