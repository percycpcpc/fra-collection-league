import { beforeEach, describe, expect, it, vi } from "vitest";

const { jsonFetch } = vi.hoisted(() => ({ jsonFetch: vi.fn() }));
vi.mock("@/lib/client", () => ({ jsonFetch }));

import { loadLeaguePlayers, refreshLeaguePlayers, resetLeaguePlayersCacheForTests } from "./useLeaguePlayers";

describe("league players cache", () => {
  beforeEach(() => {
    resetLeaguePlayersCacheForTests();
    jsonFetch.mockReset();
  });

  it("shares concurrent requests and only fetches again for an explicit refresh", async () => {
    let resolveFirst!: (value: unknown) => void;
    jsonFetch.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));

    const first = loadLeaguePlayers();
    const concurrent = loadLeaguePlayers();
    expect(jsonFetch).toHaveBeenCalledTimes(1);

    resolveFirst({ profiles: [{ id: "p1", name: "Percy", iconCard: null, createdAt: "2026-01-01", cardCount: 12, deckCount: 2 }] });
    await expect(first).resolves.toEqual(await concurrent);
    await loadLeaguePlayers();
    expect(jsonFetch).toHaveBeenCalledTimes(1);

    jsonFetch.mockResolvedValueOnce({ profiles: [{ id: "p2", name: "Alex", iconCard: null, createdAt: "2026-01-02", cardCount: 4, deckCount: 1 }] });
    await expect(refreshLeaguePlayers()).resolves.toEqual([expect.objectContaining({ id: "p2", name: "Alex" })]);
    expect(jsonFetch).toHaveBeenCalledTimes(2);
  });
});
