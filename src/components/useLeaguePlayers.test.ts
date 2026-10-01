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

  it("starts a fresh request when forced refresh is requested during an in-flight load", async () => {
    let resolveFirst!: (value: unknown) => void;
    jsonFetch.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    jsonFetch.mockResolvedValueOnce({ profiles: [{ id: "p2", name: "Newer", iconCard: null, createdAt: "2026-01-02", cardCount: 4, deckCount: 1 }] });

    const initialLoad = loadLeaguePlayers();
    const refresh = refreshLeaguePlayers();
    expect(jsonFetch).toHaveBeenCalledTimes(1);

    resolveFirst({ profiles: [{ id: "p1", name: "Older", iconCard: null, createdAt: "2026-01-01", cardCount: 12, deckCount: 2 }] });
    await initialLoad;

    await expect(refresh).resolves.toEqual([expect.objectContaining({ id: "p2", name: "Newer" })]);
    expect(jsonFetch).toHaveBeenCalledTimes(2);
    await expect(loadLeaguePlayers()).resolves.toEqual([expect.objectContaining({ id: "p2", name: "Newer" })]);
  });

  it("refetches on a non-forced load after the cache TTL expires", async () => {
    vi.useFakeTimers();
    try {
      jsonFetch
        .mockResolvedValueOnce({ profiles: [{ id: "p1", name: "Older", iconCard: null, createdAt: "2026-01-01", cardCount: 12, deckCount: 2 }] })
        .mockResolvedValueOnce({ profiles: [{ id: "p1", name: "Newer", iconCard: null, createdAt: "2026-01-01", cardCount: 13, deckCount: 2 }] });

      await loadLeaguePlayers();
      await loadLeaguePlayers();
      expect(jsonFetch).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60_001);
      await expect(loadLeaguePlayers()).resolves.toEqual([expect.objectContaining({ name: "Newer", cardCount: 13 })]);
      expect(jsonFetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
