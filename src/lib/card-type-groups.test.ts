import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "../../data/catalog.json";
import { CardTypeIcon, type CardTypeIconType } from "../components/CardTypeIcon";
import {
  CARD_TYPE_GROUPS,
  DECK_DISPLAY_GROUPS,
  classifyCardType,
  classifyDeckDisplayGroup,
  getDeckDisplayGroup,
  type CardTypeId,
  type DeckDisplayGroupId,
} from "./card-type-groups";

describe("card type taxonomy", () => {
  it("exposes stable IDs, labels, order, and exact deck membership", () => {
    expect(CARD_TYPE_GROUPS).toEqual([
      { id: "creature", label: "Creatures" },
      { id: "instant", label: "Instants" },
      { id: "sorcery", label: "Sorceries" },
      { id: "artifact", label: "Artifacts" },
      { id: "enchantment", label: "Enchantments" },
      { id: "planeswalker", label: "Planeswalkers" },
      { id: "land", label: "Nonbasic lands" },
      { id: "basic", label: "Basic lands" },
      { id: "other", label: "Other / unknown" },
    ]);
    expect(DECK_DISPLAY_GROUPS).toEqual([
      { id: "creature", label: "Creatures", members: ["creature"] },
      { id: "spell", label: "Spells", members: ["instant", "sorcery"] },
      { id: "permanent", label: "Permanents", members: ["artifact", "enchantment", "planeswalker", "other"] },
      { id: "land", label: "Lands", members: ["land", "basic"] },
    ]);
  });

  it.each([
    ["Artifact Creature — Construct", "creature"],
    ["Enchantment Creature — Spirit", "creature"],
    ["Artifact Land", "land"],
    ["Artifact Enchantment", "artifact"],
    ["Legendary Creature — Human Scout", "creature"],
    ["Snow Creature — Wolf", "creature"],
    ["World Enchantment", "enchantment"],
    ["Human Scout", "other"],
    ["Scout — Creature", "other"],
    ["Artifact — Creature token", "artifact"],
    ["Creature—Human", "creature"],
    ["Instant–Arcane", "instant"],
    ["Sorcery - Lesson", "sorcery"],
    ["Creature-Artifact", "other"],
    ["Battle — Siege", "other"],
    ["", "other"],
    ["   ", "other"],
  ] satisfies readonly [string, CardTypeId][])('classifies "%s" as %s', (type, expected) => {
    expect(classifyCardType(type)).toBe(expected);
  });

  it("uses only the first face and supports the explicit basic override", () => {
    expect(classifyCardType("Instant // Creature")).toBe("instant");
    expect(classifyCardType("Battle — Siege // Land")).toBe("other");
    expect(classifyCardType("Basic Land — Plains")).toBe("basic");
    expect(classifyCardType("Creature — Plains", true)).toBe("basic");
  });

  it("maps every taxonomy ID exactly once into a deck group", () => {
    const members = DECK_DISPLAY_GROUPS.flatMap((group) => group.members);
    expect(members).toHaveLength(CARD_TYPE_GROUPS.length);
    expect(new Set(members).size).toBe(CARD_TYPE_GROUPS.length);
    expect(members).toEqual(expect.arrayContaining(CARD_TYPE_GROUPS.map((group) => group.id)));
    for (const typeGroup of CARD_TYPE_GROUPS) {
      expect(getDeckDisplayGroup(typeGroup.id)).toBeTypeOf("string");
    }
  });

  it("matches the audited 287-card seed taxonomy totals", () => {
    const counts = Object.fromEntries(CARD_TYPE_GROUPS.map(({ id }) => [id, 0])) as Record<CardTypeId, number>;
    for (const card of catalog) counts[classifyCardType(card.type)] += 1;
    expect(catalog).toHaveLength(287);
    expect(counts).toEqual({
      creature: 161,
      instant: 37,
      sorcery: 27,
      artifact: 9,
      enchantment: 19,
      planeswalker: 8,
      land: 21,
      basic: 5,
      other: 0,
    });
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(287);
  });

  it("partitions the seed into the four additive deck display groups", () => {
    const counts: Record<DeckDisplayGroupId, number> = { creature: 0, spell: 0, permanent: 0, land: 0 };
    for (const card of catalog) counts[classifyDeckDisplayGroup(card.type)] += 1;
    expect(counts).toEqual({ creature: 161, spell: 64, permanent: 36, land: 26 });
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(287);
  });
});

describe("CardTypeIcon", () => {
  it("renders every taxonomy and deck icon with the shared SVG contract", () => {
    const iconTypes = new Set<CardTypeIconType>([
      ...CARD_TYPE_GROUPS.map(({ id }) => id),
      ...DECK_DISPLAY_GROUPS.map(({ id }) => id),
    ]);
    for (const type of iconTypes) {
      const markup = renderToStaticMarkup(createElement(CardTypeIcon, { type }));
      expect(markup).toContain('width="16"');
      expect(markup).toContain('height="16"');
      expect(markup).toContain('viewBox="0 0 24 24"');
      expect(markup).toContain('stroke="currentColor"');
      expect(markup).toContain('stroke-width="1.75"');
      expect(markup).toContain('stroke-linecap="round"');
      expect(markup).toContain('stroke-linejoin="round"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
    }
  });
});
