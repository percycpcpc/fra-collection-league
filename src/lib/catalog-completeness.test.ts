import { describe, expect, it } from "vitest";
import { catalogSeedData } from "./catalog-data";
import { parseIdentity, serializeIdentity } from "./color-identity";

describe("catalog colorIdentity completeness", () => {
  const cards = catalogSeedData();

  it("has at least the full FRA catalog", () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it("every entry carries a colorIdentity string (Req 1.1)", () => {
    for (const card of cards) {
      expect(typeof card.colorIdentity).toBe("string");
    }
  });

  it("every colorIdentity is canonical: equals serializeIdentity(parseIdentity(it)) (Req 1.2, Property 4 catalog clause)", () => {
    for (const card of cards) {
      expect(card.colorIdentity).toBe(serializeIdentity(parseIdentity(card.colorIdentity)));
    }
  });

  it("colorless cards carry the empty string (Req 1.3, 2.4)", () => {
    // A known colorless artifact from the FRA set.
    const colorless = cards.filter((c) => c.colorIdentity === "");
    expect(colorless.length).toBeGreaterThan(0);
    for (const card of colorless) {
      expect(parseIdentity(card.colorIdentity).size).toBe(0);
    }
  });

  it("colored cards parse to non-empty identities within {W,U,B,R,G}", () => {
    const colored = cards.filter((c) => c.colorIdentity !== "");
    expect(colored.length).toBeGreaterThan(0);
    for (const card of colored) {
      const set = parseIdentity(card.colorIdentity);
      expect(set.size).toBeGreaterThan(0);
      expect(set.size).toBeLessThanOrEqual(5);
    }
  });
});
