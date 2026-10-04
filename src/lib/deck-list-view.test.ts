import { describe, expect, it } from "vitest";
import { parseIdentity } from "./color-identity";
import { BANNER_COLORS, COLORLESS_BANNER } from "./deck-banner";
import { DECK_TARGET_SIZE, deckRowView, deckSummary, filterDecks, identityName } from "./deck-list-view";

const deck = (name: string, commander: string | null, cardCount = 0) => ({ name, commander, cardCount });

describe("filterDecks", () => {
  const decks = [deck("Boros Blitz", "Bruse Tarl"), deck("Control", "Ajani // Tymna"), deck("Pile", null)];
  it("returns every deck for a blank query", () => {
    expect(filterDecks(decks, "  ")).toEqual(decks);
  });
  it("matches deck names and either commander, case-insensitively", () => {
    expect(filterDecks(decks, "BOROS").map((d) => d.name)).toEqual(["Boros Blitz"]);
    expect(filterDecks(decks, "tymna").map((d) => d.name)).toEqual(["Control"]);
    expect(filterDecks(decks, "nope")).toEqual([]);
  });
  it("does not match on the stored commander separator", () => {
    expect(filterDecks(decks, "//")).toEqual([]);
  });
});

describe("identityName", () => {
  it("names mono, guild, shard, and wedge identities", () => {
    expect(identityName(parseIdentity(""))).toBe("Colorless");
    expect(identityName(parseIdentity("g"))).toBe("Green");
    expect(identityName(parseIdentity("uw"))).toBe("Azorius");
    expect(identityName(parseIdentity("rgw"))).toBe("Naya");
    expect(identityName(parseIdentity("wbg"))).toBe("Abzan");
    expect(identityName(parseIdentity("wubrg"))).toBe("Five-color");
  });
  it("falls back to joined color names for four colors", () => {
    expect(identityName(parseIdentity("wubr"))).toBe("White · Blue · Black · Red");
  });
});

describe("deckRowView", () => {
  it("shows identity pips, edge, and wash in WUBRG order", () => {
    const view = deckRowView(deck("Boros", "Bruse Tarl", 50), parseIdentity("rw"));
    expect(view.kicker).toBe("Boros");
    expect(view.pips.map((p) => p.key)).toEqual(["W", "R"]);
    expect(view.pips[0].color).toBe(BANNER_COLORS.W);
    expect(view.edge).toBe(`linear-gradient(90deg, transparent, ${BANNER_COLORS.W}, ${BANNER_COLORS.R}, transparent)`);
    expect(view.wash).toContain(BANNER_COLORS.W);
    expect(view.identityLabel).toBe("Color identity: White, Red");
    expect(view.status).toBe("Ready for league");
    expect(view.pct).toBe("50%");
  });
  it("tints colorless commanders brown without pips", () => {
    const view = deckRowView(deck("Artifacts", "Karn", 10), parseIdentity(""));
    expect(view.kicker).toBe("Colorless");
    expect(view.pips).toEqual([]);
    expect(view.edge).toContain(COLORLESS_BANNER);
    expect(view.identityLabel).toBe("Color identity: Colorless");
  });
  it("renders a deck without a commander as neutral", () => {
    const view = deckRowView(deck("Pile", null, 1), undefined);
    expect(view).toMatchObject({ kicker: "No commander", commanders: "Pick a legendary creature", hasCommander: false, identityLabel: null, pips: [], edge: null, wash: null, countLabel: "1 card", status: "No commander" });
  });
  it("keeps neutral chrome while the commander identity is still loading", () => {
    expect(deckRowView(deck("Pair", "Ajani // Tymna"), undefined)).toMatchObject({ kicker: "Partner commanders", commanders: "Ajani + Tymna", pips: [], edge: null });
    expect(deckRowView(deck("One", "Ajani"), undefined).kicker).toBe("Commander");
  });
  it("caps progress at the commander deck size", () => {
    expect(deckRowView(deck("Big", null, DECK_TARGET_SIZE + 20), undefined).pct).toBe("100%");
    expect(deckRowView(deck("Third", null, 33), undefined).pct).toBe("33%");
    expect(deckRowView(deck("Odd", null, 1), undefined).pct).toBe("1%");
  });
});

describe("deckSummary", () => {
  it("counts decks with a commander as ready", () => {
    expect(deckSummary([deck("A", "Ajani"), deck("B", null)])).toBe("2 decks · 1 ready for league play");
    expect(deckSummary([deck("A", null)])).toBe("1 deck · 0 ready for league play");
  });
});
