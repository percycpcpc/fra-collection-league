import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALT_PLAYER_KEY, altSectionHref, forgetAltPlayer, getRememberedAltPlayer, parseAltSection,
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
    expect(resolveAltBrowsing({ rememberedId: null, league: ready([percy, alex]) })).toEqual({ kind: "none", reason: "unselected" });
  });

  it("restores a remembered player only once the league list confirms it", () => {
    expect(resolveAltBrowsing({ rememberedId: "p2", league: { players: null, status: "loading" } })).toEqual({ kind: "pending", id: "p2", linkable: false });
    expect(resolveAltBrowsing({ rememberedId: "p2", league: ready([percy, alex]) })).toEqual({ kind: "player", id: "p2", name: "Alex", iconCard: "Ajani" });
  });

  it("treats a remembered player missing from a loaded list as unselected, not as another player", () => {
    expect(resolveAltBrowsing({ rememberedId: "gone", league: ready([percy]) })).toEqual({ kind: "none", reason: "unselected" });
  });

  it("distinguishes loading, load failure and an empty league", () => {
    expect(resolveAltBrowsing({ rememberedId: null, league: { players: null, status: "loading" } })).toEqual({ kind: "none", reason: "loading" });
    expect(resolveAltBrowsing({ rememberedId: "p1", league: { players: null, status: "error" } })).toEqual({ kind: "none", reason: "error" });
    expect(resolveAltBrowsing({ rememberedId: null, league: ready([]) })).toEqual({ kind: "none", reason: "empty" });
  });

  it("lets the route player win over the remembered one", () => {
    const league = ready([percy, alex]);
    expect(resolveAltBrowsing({ player: { id: "p1" }, rememberedId: "p2", league })).toEqual({ kind: "pending", id: "p1", linkable: true });
    expect(resolveAltBrowsing({ player: { id: "p1", name: "Percy" }, rememberedId: "p2", league })).toEqual({ kind: "player", id: "p1", name: "Percy", iconCard: null });
    expect(resolveAltBrowsing({ player: { id: "zz", missing: true }, rememberedId: "p2", league })).toEqual({ kind: "missing", id: "zz" });
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
    storage = fakeStorage({ [ALT_PLAYER_KEY]: "p1" });
    vi.stubGlobal("window", { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads storage once per page load, so another tab's writes do not switch this tab", () => {
    expect(getRememberedAltPlayer()).toBe("p1");
    storage.data.set(ALT_PLAYER_KEY, "p2");
    expect(getRememberedAltPlayer()).toBe("p1");
  });

  it("persists this tab's selection and clears it only for the confirmed-absent player", () => {
    rememberAltPlayer("p2");
    expect(storage.data.get(ALT_PLAYER_KEY)).toBe("p2");
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
    rememberAltPlayer("p2");
    expect(getRememberedAltPlayer()).toBe("p2");
  });
});
