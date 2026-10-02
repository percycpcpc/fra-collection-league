import { describe, expect, it } from "vitest";
import { deckOptionsForProfile } from "./MatchesDashboard";

describe("match recorder deck options", () => {
  it("hides a previous player's decks while the new request is pending", () => {
    const visible = deckOptionsForProfile("player-b", {
      profileId: "player-a",
      decks: [{ id: "deck-a", name: "A deck", commander: null, cardCount: 20 }],
      status: "ready",
      error: "",
    });

    expect(visible).toMatchObject({ profileId: "", decks: [], status: "loading", error: "" });
  });

  it("keeps options only when they belong to the selected player", () => {
    const state = {
      profileId: "player-b",
      decks: [{ id: "deck-b", name: "B deck", commander: null, cardCount: 20 }],
      status: "ready" as const,
      error: "",
    };

    expect(deckOptionsForProfile("player-b", state)).toBe(state);
  });
});
