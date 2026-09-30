import { describe, expect, it } from "vitest";
import { validateCatalog, type CatalogCard } from "./catalog";

function card(overrides: Partial<CatalogCard>): CatalogCard {
  return {
    name: "Test Card",
    qty: 1,
    img: "",
    colors: "",
    rarity: "common",
    type: "Creature",
    colorIdentity: "",
    ...overrides,
  };
}

describe("validateCatalog", () => {
  it("passes a well-formed fixture", () => {
    const cards = [
      card({ name: "Colorless One", colorIdentity: "" }),
      card({ name: "Azorius Thing", colorIdentity: "WU" }),
      card({ name: "Five Color", colorIdentity: "WUBRG" }),
    ];
    expect(() => validateCatalog(cards)).not.toThrow();
  });

  it("throws naming a card with a missing colorIdentity", () => {
    const bad = { ...card({ name: "No Identity" }) } as Partial<CatalogCard>;
    delete bad.colorIdentity;
    expect(() => validateCatalog([bad as CatalogCard])).toThrow(/No Identity/);
  });

  it("throws naming a card with a non-string colorIdentity", () => {
    const bad = card({ name: "Numeric" });
    (bad as unknown as { colorIdentity: unknown }).colorIdentity = 5;
    expect(() => validateCatalog([bad])).toThrow(/Numeric/);
  });

  it("throws naming a card with an out-of-alphabet colorIdentity", () => {
    expect(() => validateCatalog([card({ name: "Bad Char", colorIdentity: "WX" })])).toThrow(
      /Bad Char/,
    );
  });

  it("throws naming a card with a repeated color letter", () => {
    expect(() => validateCatalog([card({ name: "Repeat", colorIdentity: "WW" })])).toThrow(
      /Repeat/,
    );
  });

  it("throws naming a card whose colorIdentity is not canonical order", () => {
    expect(() => validateCatalog([card({ name: "Unordered", colorIdentity: "UW" })])).toThrow(
      /Unordered/,
    );
  });
});
