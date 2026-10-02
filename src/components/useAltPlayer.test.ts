import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALT_PLAYER_KEY, altSectionHref, forgetAltPlayer, getRememberedAltPlayer, getRememberedAltPlayerSnapshot, parseAltSection,
  rememberAltPlayer, resetAltPlayerForTests, resolveAltBrowsing,
} from "./useAltPlayer";
import type { LeaguePlayer } from "./useLeaguePlayers";

const percy: LeaguePlayer = { id: "p1", name: "Percy", iconCard: null, cardCount: 1, createdAt: "2026-01-01", deckCount: 0 };
const alex: LeaguePlayer = { id: "p2", name: "Alex", iconCard: "Ajani", cardCount: 1, createdAt: "2026-01-02", deckCount: 0 };
const ready = (players: LeaguePlayer[]) => ({ players, status: "ready" as const });

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("resolveAltBrowsing", () => {
  it("never falls back to the first player when nothing is remembered", () => {
    expect(resolveAltBrowsing({ remembered: null, league: ready([percy, alex]) })).toEqual({ kind: "none", reason: "unselected" });
  });

  it("restores a remembered player only once the league list confirms it", () => {
    expect(resolveAltBrowsing({ remembered: { id: "p2", iconCard: null }, league: { players: null, status: "loading" } })).toEqual({ kind: "pending", id: "p2", linkable: false });
    expect(resolveAltBrowsing({ remembered: { id: "p2", iconCard: null }, league: ready([percy, alex]) })).toEqual({ kind: "player", id: "p2", name: "Alex", iconCard: "Ajani" });
  });

  it("treats a remembered player missing from a loaded list as unselected, not as another player", () => {
    expect(resolveAltBrowsing({ remembered: { id: "gone", iconCard: null }, league: ready([percy]) })).toEqual({ kind: "none", reason: "unselected" });
  });

  it("distinguishes loading, load failure and an empty league", () => {
    expect(resolveAltBrowsing({ remembered: null, league: { players: null, status: "loading" } })).toEqual({ kind: "none", reason: "loading" });
    expect(resolveAltBrowsing({ remembered: { id: "p1", iconCard: null }, league: { players: null, status: "error" } })).toEqual({ kind: "none", reason: "error" });
    expect(resolveAltBrowsing({ remembered: null, league: ready([]) })).toEqual({ kind: "none", reason: "empty" });
  });

  it("lets the route player win over the remembered one", () => {
    const league = ready([percy, alex]);
    expect(resolveAltBrowsing({ player: { id: "p1" }, remembered: { id: "p2", iconCard: null }, league: { players: null, status: "loading" } })).toEqual({ kind: "pending", id: "p1", linkable: true });
    expect(resolveAltBrowsing({ player: { id: "p1" }, remembered: { id: "p2", name: "Alex", iconCard: "Ajani" }, league })).toEqual({ kind: "player", id: "p1", name: "Percy", iconCard: null });
    expect(resolveAltBrowsing({ player: { id: "p1", name: "Percy" }, remembered: { id: "p2", iconCard: null }, league })).toEqual({ kind: "player", id: "p1", name: "Percy", iconCard: null });
    expect(resolveAltBrowsing({ player: { id: "zz", missing: true }, remembered: { id: "p2", iconCard: null }, league })).toEqual({ kind: "missing", id: "zz" });
  });

  it("names a loading route player from a matching remembered snapshot, with no pending flash", () => {
    const loading = { players: null, status: "loading" as const };
    expect(resolveAltBrowsing({ player: { id: "p2" }, remembered: { id: "p2", name: "Alex", iconCard: "Ajani" }, league: loading }))
      .toEqual({ kind: "player", id: "p2", name: "Alex", iconCard: "Ajani" });
  });

  it("does not name a route player from a legacy bare-id snapshot", () => {
    expect(resolveAltBrowsing({ player: { id: "p2" }, remembered: { id: "p2", iconCard: null }, league: { players: null, status: "loading" } }))
      .toEqual({ kind: "pending", id: "p2", linkable: true });
  });

  it("prefers the ready league list, so a rename shows over a stale snapshot", () => {
    const renamed = { ...alex, name: "Alexandra", iconCard: "Sol Ring" };
    expect(resolveAltBrowsing({ player: { id: "p2" }, remembered: { id: "p2", name: "Alex", iconCard: "Ajani" }, league: ready([percy, renamed]) }))
      .toEqual({ kind: "player", id: "p2", name: "Alexandra", iconCard: "Sol Ring" });
    expect(resolveAltBrowsing({ player: { id: "p2" }, remembered: null, league: ready([percy, renamed]) }))
      .toEqual({ kind: "player", id: "p2", name: "Alexandra", iconCard: "Sol Ring" });
  });

  it("keeps an unrelated route id pending, and a missing route player missing", () => {
    const remembered = { id: "p1", name: "Percy", iconCard: null };
    expect(resolveAltBrowsing({ player: { id: "p9" }, remembered, league: ready([percy, alex]) })).toEqual({ kind: "pending", id: "p9", linkable: true });
    expect(resolveAltBrowsing({ player: { id: "p1", missing: true }, remembered, league: ready([percy]) })).toEqual({ kind: "missing", id: "p1" });
  });
});

describe("alt sections", () => {
  it("parses only player sections and builds their routes", () => {
    expect(parseAltSection("decks")).toBe("decks");
    expect(parseAltSection("analytics")).toBeUndefined();
    expect(parseAltSection(["decks"])).toBeUndefined();
    expect(altSectionHref("p1", "collection")).toBe("/p/p1");
    expect(altSectionHref("p1", "matches")).toBe("/p/p1/matches");
  });
});

describe("remembered alt player", () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    resetAltPlayerForTests();
    storage = fakeStorage({ [ALT_PLAYER_KEY]: JSON.stringify({ id: "p1", name: "Percy", iconCard: null }) });
    vi.stubGlobal("window", { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads storage once per page load, so another tab's writes do not switch this tab", () => {
    expect(getRememberedAltPlayerSnapshot()).toEqual({ id: "p1", name: "Percy", iconCard: null });
    storage.data.set(ALT_PLAYER_KEY, JSON.stringify({ id: "p2", name: "Alex", iconCard: "Ajani" }));
    expect(getRememberedAltPlayer()).toBe("p1");
  });

  it("persists this tab's selection and clears it only for the confirmed-absent player", () => {
    rememberAltPlayer({ id: "p2", name: "Alex", iconCard: "Ajani" });
    expect(JSON.parse(storage.data.get(ALT_PLAYER_KEY)!)).toEqual({ id: "p2", name: "Alex", iconCard: "Ajani" });
    forgetAltPlayer("p1");
    expect(getRememberedAltPlayer()).toBe("p2");
    forgetAltPlayer("p2");
    expect(getRememberedAltPlayer()).toBeNull();
    expect(storage.data.has(ALT_PLAYER_KEY)).toBe(false);
  });

  it("keeps working in memory when storage is unavailable", () => {
    resetAltPlayerForTests();
    const throwing = () => { throw new Error("denied"); };
    vi.stubGlobal("window", { localStorage: { getItem: throwing, setItem: throwing, removeItem: throwing } });
    expect(getRememberedAltPlayer()).toBeNull();
    rememberAltPlayer({ id: "p2", name: "Alex", iconCard: null });
    expect(getRememberedAltPlayerSnapshot()).toEqual({ id: "p2", name: "Alex", iconCard: null });
  });

  it("reads a legacy bare-id value as an unnamed selection", () => {
    resetAltPlayerForTests();
    vi.stubGlobal("window", { localStorage: fakeStorage({ [ALT_PLAYER_KEY]: "p1" }) });
    expect(getRememberedAltPlayerSnapshot()).toEqual({ id: "p1", iconCard: null });
    expect(getRememberedAltPlayer()).toBe("p1");
  });

  it("ignores malformed snapshots", () => {
    resetAltPlayerForTests();
    vi.stubGlobal("window", { localStorage: fakeStorage({ [ALT_PLAYER_KEY]: JSON.stringify({ name: "No id" }) }) });
    expect(getRememberedAltPlayer()).toBeNull();
  });
});
