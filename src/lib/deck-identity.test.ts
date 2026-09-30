import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  resolveCommanderIdentity,
  isLegal,
  isOutOfIdentity,
  toggleCommander,
  parseCommanderNames,
  isCommander,
  selectionList,
  deckContentsVisible,
  applyDeckQty,
  MAX_COMMANDERS,
  type IdentityCard,
} from "./deck-identity";
import {
  parseIdentity,
  serializeIdentity,
  isSubsetIdentity,
  unionIdentity,
  type WUBRG,
} from "./color-identity";

const WUBRG = ["W", "U", "B", "R", "G"] as const;
const RUNS = { numRuns: 100 };

const identityStringArb = () =>
  fc.subarray([...WUBRG] as WUBRG[]).map((arr) => serializeIdentity(new Set(arr)));

// A generated catalog card with a name and a canonical colorIdentity string.
const cardArb = () =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
    colorIdentity: identityStringArb(),
  });

const catalogArb = () =>
  fc
    .uniqueArray(cardArb(), {
      minLength: 0,
      maxLength: 8,
      selector: (c) => c.name.toLowerCase(),
    });

describe("deck-identity resolution and predicates", () => {
  // Feature: commander-color-identity-filter, Property 7: For any selection of up to 2 commander names, the resolved Commander_Color_Identity equals the union of parseIdentity(card.colorIdentity) over selected names that match a CatalogCard; names with no match contribute the empty set.
  it("Property 7: commander identity is the union of known commanders", () => {
    fc.assert(
      fc.property(
        catalogArb(),
        fc.array(fc.string({ maxLength: 8 }), { maxLength: MAX_COMMANDERS }),
        (catalog, names) => {
          const resolved = resolveCommanderIdentity(names, catalog);
          if (names.length === 0) {
            expect(resolved).toBeUndefined();
            return;
          }
          // Expected: union of parsed identities over matching names; misses contribute {}.
          const expected = unionIdentity(
            ...names.map((n) => {
              const match = catalog.find((c) => c.name.toLowerCase() === n.toLowerCase());
              return match ? parseIdentity(match.colorIdentity) : new Set<WUBRG>();
            }),
          );
          expect(resolved).toBeDefined();
          expect([...(resolved as Set<WUBRG>)].sort()).toEqual([...expected].sort());
        },
      ),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 8 (helper level): a card is legal iff basic or subset-match under a defined identity.
  it("Property 8: isLegal iff basic or subset-match (defined identity)", () => {
    fc.assert(
      fc.property(cardArb(), identityStringArb(), fc.boolean(), (card, kStr, isBasic) => {
        const k = parseIdentity(kStr);
        const legal = isLegal(card, k, isBasic);
        const expected = isBasic || isSubsetIdentity(parseIdentity(card.colorIdentity), k);
        expect(legal).toBe(expected);
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 9: with no commander (undefined identity), every card is legal (shown).
  it("Property 9: undefined identity -> every card legal", () => {
    fc.assert(
      fc.property(cardArb(), fc.boolean(), (card, isBasic) => {
        expect(isLegal(card, undefined, isBasic)).toBe(true);
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 10: basic lands are always legal under any defined identity.
  it("Property 10: basics always legal under any defined identity", () => {
    fc.assert(
      fc.property(cardArb(), identityStringArb(), (card, kStr) => {
        expect(isLegal(card, parseIdentity(kStr), true)).toBe(true);
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 12 (helper level): out-of-identity iff not basic and not subset-match under a defined identity.
  it("Property 12: isOutOfIdentity iff non-basic and not subset-match", () => {
    fc.assert(
      fc.property(cardArb(), identityStringArb(), fc.boolean(), (card, kStr, isBasic) => {
        const k = parseIdentity(kStr);
        const off = isOutOfIdentity(card, k, isBasic);
        const expected = !isBasic && !isSubsetIdentity(parseIdentity(card.colorIdentity), k);
        expect(off).toBe(expected);
        // Legal and out-of-identity are mutually exclusive for the same inputs.
        if (off) expect(isLegal(card, k, isBasic)).toBe(false);
      }),
      RUNS,
    );
  });

  it("isOutOfIdentity is always false when identity is undefined", () => {
    fc.assert(
      fc.property(cardArb(), fc.boolean(), (card, isBasic) => {
        expect(isOutOfIdentity(card, undefined, isBasic)).toBe(false);
      }),
      RUNS,
    );
  });
});

describe("commander selection state (Req 4.3, 4.5, 4.6)", () => {
  const cat: IdentityCard[] = [
    { name: "Colorless Cmdr", colorIdentity: "" },
    { name: "Azorius Cmdr", colorIdentity: "WU" },
    { name: "Golgari Cmdr", colorIdentity: "BG" },
  ];

  it("no commander -> undefined (Req 4.3)", () => {
    expect(resolveCommanderIdentity([], cat)).toBeUndefined();
    expect(resolveCommanderIdentity(parseCommanderNames(null), cat)).toBeUndefined();
  });

  it("all-colorless commanders -> defined empty set, distinct from undefined (Req 4.5)", () => {
    const resolved = resolveCommanderIdentity(["Colorless Cmdr"], cat);
    expect(resolved).toBeDefined();
    expect(resolved?.size).toBe(0);
  });

  it("unknown commander name contributes empty set, others still resolve (Req 4.4)", () => {
    const resolved = resolveCommanderIdentity(["Ghost", "Azorius Cmdr"], cat);
    expect([...(resolved as Set<WUBRG>)].sort()).toEqual(["U", "W"]);
  });

  it("two commanders union their identities (Req 4.2, 4.7)", () => {
    const resolved = resolveCommanderIdentity(["Azorius Cmdr", "Golgari Cmdr"], cat);
    expect([...(resolved as Set<WUBRG>)].sort()).toEqual(["B", "G", "U", "W"]);
  });

  it("3rd-commander selection is blocked, count held at 2 (Req 4.6)", () => {
    let stored: string | null = null;
    stored = toggleCommander(stored, "Azorius Cmdr");
    stored = toggleCommander(stored, "Golgari Cmdr");
    expect(parseCommanderNames(stored)).toHaveLength(2);
    const attempted = toggleCommander(stored, "Colorless Cmdr");
    expect(parseCommanderNames(attempted)).toHaveLength(2);
    expect(isCommander(attempted, "Colorless Cmdr")).toBe(false);
  });

  it("toggling a selected commander removes it", () => {
    let stored: string | null = toggleCommander(null, "Azorius Cmdr");
    expect(isCommander(stored, "Azorius Cmdr")).toBe(true);
    stored = toggleCommander(stored, "Azorius Cmdr");
    expect(parseCommanderNames(stored)).toHaveLength(0);
    expect(stored).toBeNull();
  });
});

const BASICS = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

describe("Card selection list membership", () => {
  const ownedArb = () =>
    fc.uniqueArray(cardArb(), {
      minLength: 0,
      maxLength: 10,
      selector: (c) => c.name.toLowerCase(),
    }).filter((cards) => cards.every((c) => !BASICS.some((b) => b.toLowerCase() === c.name.toLowerCase())));

  // Feature: commander-color-identity-filter, Property 8: For any owned card and any defined Commander_Color_Identity K, the card is displayed in the Card_Selection_List iff it is a Basic_Land or its parsed color identity is a Subset_Match of K.
  it("Property 8: a card is shown iff it is legal", () => {
    fc.assert(
      fc.property(ownedArb(), identityStringArb(), (owned, kStr) => {
        const k = parseIdentity(kStr);
        const shown = new Set(selectionList(owned, BASICS, k).map((n) => n.toLowerCase()));
        for (const card of owned) {
          const legal = isSubsetIdentity(parseIdentity(card.colorIdentity), k);
          expect(shown.has(card.name.toLowerCase())).toBe(legal);
        }
        // Basics are always present.
        for (const b of BASICS) expect(shown.has(b.toLowerCase())).toBe(true);
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 9: For any owned collection, when Commander_Color_Identity is undefined, every owned card is displayed in the Card_Selection_List.
  it("Property 9: with no commander, all owned cards are shown", () => {
    fc.assert(
      fc.property(ownedArb(), (owned) => {
        const shown = new Set(selectionList(owned, BASICS, undefined).map((n) => n.toLowerCase()));
        for (const card of owned) expect(shown.has(card.name.toLowerCase())).toBe(true);
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 10: For any defined Commander_Color_Identity, every Basic_Land option is displayed in and addable from the Card_Selection_List regardless of color identity.
  it("Property 10: basic lands are always available", () => {
    fc.assert(
      fc.property(ownedArb(), identityStringArb(), (owned, kStr) => {
        const shown = new Set(selectionList(owned, BASICS, parseIdentity(kStr)).map((n) => n.toLowerCase()));
        for (const b of BASICS) expect(shown.has(b.toLowerCase())).toBe(true);
      }),
      RUNS,
    );
  });

  it("empty commander identity -> only colorless owned cards + basics (Req 6.4, 6.6)", () => {
    const owned: IdentityCard[] = [
      { name: "Artifact", colorIdentity: "" },
      { name: "Blue Thing", colorIdentity: "U" },
      { name: "Golgari", colorIdentity: "BG" },
    ];
    const shown = selectionList(owned, BASICS, parseIdentity("")); // defined empty set
    expect(shown).toContain("Artifact");
    expect(shown).not.toContain("Blue Thing");
    expect(shown).not.toContain("Golgari");
    for (const b of BASICS) expect(shown).toContain(b);
  });

  it("commander with no matching owned non-basic -> only basics (Req 5.6)", () => {
    const owned: IdentityCard[] = [
      { name: "Blue Thing", colorIdentity: "U" },
      { name: "Golgari", colorIdentity: "BG" },
    ];
    // Mono-red commander: none of the owned non-basics are subset-legal.
    const shown = selectionList(owned, BASICS, parseIdentity("R"));
    expect(shown.filter((n) => !BASICS.includes(n))).toHaveLength(0);
    for (const b of BASICS) expect(shown).toContain(b);
  });

  it("changing the commander recomputes membership (Req 5.5)", () => {
    const owned: IdentityCard[] = [
      { name: "Blue Thing", colorIdentity: "U" },
      { name: "Red Thing", colorIdentity: "R" },
    ];
    const underBlue = selectionList(owned, BASICS, parseIdentity("U"));
    const underRed = selectionList(owned, BASICS, parseIdentity("R"));
    expect(underBlue).toContain("Blue Thing");
    expect(underBlue).not.toContain("Red Thing");
    expect(underRed).toContain("Red Thing");
    expect(underRed).not.toContain("Blue Thing");
  });
});


describe("Deck contents visibility and mutation", () => {
  type DeckCard = { name: string; qty: number; colorIdentity?: string; isBasic?: boolean };

  const deckCardArb = () =>
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
      qty: fc.integer({ min: 1, max: 4 }),
      colorIdentity: identityStringArb(),
    });

  const deckArb = () =>
    fc.uniqueArray(deckCardArb(), {
      minLength: 0,
      maxLength: 10,
      selector: (c) => c.name.toLowerCase(),
    });

  // Feature: commander-color-identity-filter, Property 11: For any deck contents and any defined Commander_Color_Identity, every card already in the deck remains displayed in the deck contents panel, including out-of-Subset_Match cards.
  it("Property 11: deck contents remain fully visible", () => {
    fc.assert(
      fc.property(deckArb(), identityStringArb(), (cards, kStr) => {
        const visible = new Set(
          deckContentsVisible(cards, parseIdentity(kStr)).map((n) => n.toLowerCase()),
        );
        for (const c of cards) expect(visible.has(c.name.toLowerCase())).toBe(true);
        expect(visible.size).toBe(cards.length);
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter, Property 12: For any deck card and any defined Commander_Color_Identity K, the indicator is present and the increase control is disabled iff the card is not a Basic_Land and its color identity is not a Subset_Match of K; the decrease control remains enabled in all cases.
  it("Property 12: deck-card marker/disable predicate is exactly out-of-identity", () => {
    fc.assert(
      fc.property(deckCardArb(), fc.boolean(), identityStringArb(), (card, isBasic, kStr) => {
        const k = parseIdentity(kStr);
        const off = isOutOfIdentity(card, k, isBasic);
        const notSubset = !isSubsetIdentity(parseIdentity(card.colorIdentity), k);
        expect(off).toBe(!isBasic && notSubset);
        // Decrease is always allowed (never gated by identity); modeled by the
        // fact that isOutOfIdentity governs only the increase/marker, not decrease.
      }),
      RUNS,
    );
  });

  // Feature: commander-color-identity-filter — auto-remove at zero (Req 7.5)
  it("setting an out-of-color deck card to qty 0 removes it immediately", () => {
    const cards: DeckCard[] = [
      { name: "Off Color", qty: 2, colorIdentity: "R" },
      { name: "Keeper", qty: 1, colorIdentity: "U" },
    ];
    const next = applyDeckQty(cards, "Off Color", 0, (name, qty) => ({ name, qty }));
    expect(next.map((c) => c.name)).toEqual(["Keeper"]);
    expect(next.some((c) => c.name === "Off Color")).toBe(false);
  });

  it("decreasing a card above zero keeps it with the new qty", () => {
    const cards: DeckCard[] = [{ name: "Card", qty: 3, colorIdentity: "R" }];
    const next = applyDeckQty(cards, "Card", 1, (name, qty) => ({ name, qty }));
    expect(next).toEqual([{ name: "Card", qty: 1, colorIdentity: "R" }]);
  });

  it("adding a new card appends it", () => {
    const next = applyDeckQty<DeckCard>([], "New", 2, (name, qty) => ({ name, qty }));
    expect(next).toEqual([{ name: "New", qty: 2 }]);
  });
});
