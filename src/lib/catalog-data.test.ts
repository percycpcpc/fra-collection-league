import { describe, expect, it } from "vitest";
import { parseCatalogCard } from "./catalog-data";

describe("parseCatalogCard", () => {
  it("parses a full, well-formed object", () => {
    const card = parseCatalogCard(
      {
        name: "  Test Card  ",
        qty: 3,
        img: "https://x/y.jpg",
        colors: "white",
        rarity: "rare",
        type: "Creature",
        colorIdentity: "W",
        manaCost: "{1}{W}",
      },
      "Card",
    );
    expect(card).toEqual({
      name: "Test Card",
      qty: 3,
      img: "https://x/y.jpg",
      colors: "white",
      rarity: "rare",
      type: "Creature",
      colorIdentity: "W",
      manaCost: "{1}{W}",
    });
  });

  it("defaults optional string fields to empty and qty to 1", () => {
    const card = parseCatalogCard({ name: "Sparse" }, "Card");
    expect(card).toEqual({
      name: "Sparse",
      qty: 1,
      img: "",
      colors: "",
      rarity: "",
      type: "",
      colorIdentity: "",
      manaCost: "",
    });
  });

  it("throws when the input is not an object", () => {
    expect(() => parseCatalogCard("nope", "Row 2")).toThrow(/Row 2 is not an object/);
  });

  it("throws when the name is missing or blank", () => {
    expect(() => parseCatalogCard({ name: "   " }, "Card")).toThrow(/missing a card name/);
    expect(() => parseCatalogCard({}, "Card")).toThrow(/missing a card name/);
  });

  it("throws when a string field is the wrong type", () => {
    expect(() => parseCatalogCard({ name: "X", colors: 5 }, "Card")).toThrow(
      /field "colors" must be a string/,
    );
  });

  it("throws when qty is negative or non-integer", () => {
    expect(() => parseCatalogCard({ name: "X", qty: -1 }, "Card")).toThrow(/non-negative integer/);
    expect(() => parseCatalogCard({ name: "X", qty: 1.5 }, "Card")).toThrow(/non-negative integer/);
  });
});
