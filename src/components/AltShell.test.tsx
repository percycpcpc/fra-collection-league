import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AltPlayerPageState, AltShell, altNavItems, filterPlayers, playerSwitchHref } from "./AltShell";
import { AltPlayersDirectory } from "./AltPlayersDirectory";
import { AltAnalytics } from "./AltAnalytics";
import { AltMatches } from "./AltMatches";

const noop = () => {};
const percy = { id: "p1", name: "Percy", iconCard: null, cardCount: 12, deckCount: 2 };
const alex = { id: "p2", name: "Alex", iconCard: null, cardCount: 3, deckCount: 1 };
const copy = { loading: "Loading decks", loadingDetail: "Fetching decks.", unavailable: "Decks unavailable", failed: "We couldn't load these decks" };

function navLabels(html: string, navLabel: string) {
  const start = html.indexOf(`aria-label="${navLabel}"`);
  const nav = html.slice(start, html.indexOf("</nav>", start));
  return [...nav.matchAll(/>(Collection|Decks|Matches|Analytics|Players)</g)].map((match) => match[1]);
}

describe("altNavItems", () => {
  it("orders Collection, Decks, Matches, Analytics and links player tabs to the browsing player", () => {
    const items = altNavItems({ kind: "player", id: "p1", name: "Percy", iconCard: null });
    expect(items.map((item) => item.label)).toEqual(["Collection", "Decks", "Matches", "Analytics"]);
    expect(items.map((item) => item.href)).toEqual(["/p/p1", "/p/p1/decks", "/p/p1/matches", "/analytics"]);
    expect(items[3].hint).toBe("All players");
  });

  it("sends player tabs to the chooser with a pending destination when no player is chosen", () => {
    expect(altNavItems({ kind: "none", reason: "unselected" }).map((item) => item.href)).toEqual(["/?next=collection", "/?next=decks", "/?next=matches", "/analytics"]);
    expect(altNavItems({ kind: "missing", id: "zz" })[0].href).toBe("/?next=collection");
  });

  it("explains unavailable player tabs while loading or when the league is empty", () => {
    const loading = altNavItems({ kind: "pending", id: "p2", linkable: false });
    expect(loading.slice(0, 3).every((item) => !item.href && item.unavailable === "Loading players…")).toBe(true);
    const empty = altNavItems({ kind: "none", reason: "empty" });
    expect(empty.slice(0, 3).every((item) => !item.href && item.unavailable === "No players yet")).toBe(true);
    expect(empty[3].href).toBe("/analytics");
  });

  it("links route players immediately, before their profile has loaded", () => {
    expect(altNavItems({ kind: "pending", id: "p9", linkable: true })[1].href).toBe("/p/p9/decks");
  });
});

describe("AltShell", () => {
  it("has no Players tab or sidebar player list, in both sidebar and tabbar", () => {
    const html = renderToStaticMarkup(<AltShell title="T" activeNav="decks" player={{ id: "p1", name: "Percy" }} onToggleStyle={noop}>x</AltShell>);
    expect(navLabels(html, "League navigation")).toEqual(["Collection", "Decks", "Matches", "Analytics"]);
    expect(navLabels(html, "League navigation (mobile)")).toEqual(["Collection", "Decks", "Matches", "Analytics"]);
    expect(html).not.toContain("alt-players");
  });

  it("renders an interactive player switcher trigger inside the topbar", () => {
    const html = renderToStaticMarkup(<AltShell title="T" activeNav="collection" player={{ id: "p1", name: "Percy Long Name" }} onToggleStyle={noop}>x</AltShell>);
    const topbar = html.slice(html.indexOf('class="alt-topbar"'), html.indexOf("</header>"));
    expect(topbar).not.toContain("<a ");
    expect(topbar).not.toContain("← Players");
    expect(topbar).toContain("Browsing");
    expect(topbar).toContain("Percy Long Name");
    const chip = topbar.slice(topbar.indexOf("alt-player-chip"));
    expect(chip).toContain('aria-haspopup="dialog"');
    expect(chip).toContain('aria-expanded="false"');
  });

  it("shows an indeterminate chip while the route player is unvalidated", () => {
    const html = renderToStaticMarkup(<AltShell title="T" activeNav="collection" player={{ id: "p1" }} onToggleStyle={noop}>x</AltShell>);
    expect(html).toContain("Loading…");
    expect(html).toContain('href="/p/p1/decks"');
  });

  it("marks only the real active item with aria-current, and none on the chooser", () => {
    const decks = renderToStaticMarkup(<AltShell title="T" activeNav="decks" player={{ id: "p1", name: "Percy" }} onToggleStyle={noop}>x</AltShell>);
    expect(decks.match(/aria-current="page"/g)).toHaveLength(2);
    expect(decks).toMatch(/class="active" aria-current="page" href="\/p\/p1\/decks"/);
    const home = renderToStaticMarkup(<AltShell title="T" activeNav="home" onToggleStyle={noop}>x</AltShell>);
    expect(home).not.toContain("aria-current");
    expect(home).not.toContain("← Players");
  });
});

describe("player switcher", () => {
  it("keeps player-scoped sections and defaults league-wide pages to collection", () => {
    expect(playerSwitchHref("p2", "decks")).toBe("/p/p2/decks");
    expect(playerSwitchHref("p2", "matches")).toBe("/p/p2/matches");
    expect(playerSwitchHref("p2", "analytics")).toBe("/p/p2");
  });

  it("filters players case-insensitively and ignores surrounding whitespace", () => {
    const players = [percy, alex].map((player) => ({ ...player, createdAt: "2026-01-01" }));
    expect(filterPlayers(players, "  ERc ").map((player) => player.name)).toEqual(["Percy"]);
    expect(filterPlayers(players, "")).toEqual(players);
  });
});

describe("AltPlayersDirectory (chooser)", () => {
  it("routes cards to the pending destination and says why the chooser is shown", () => {
    const html = renderToStaticMarkup(<AltPlayersDirectory players={[percy, alex]} next="decks" createForm={<button>New</button>} onToggleStyle={noop} />);
    expect(html).toContain("Choose a player to continue");
    expect(html).toContain('href="/p/p1/decks"');
    expect(html).toContain('href="/p/p2/decks"');
  });

  it("opens the collection by default and marks the current player", () => {
    const html = renderToStaticMarkup(<AltPlayersDirectory players={[percy, alex]} currentId="p2" createForm={<button>New</button>} onToggleStyle={noop} />);
    expect(html).toContain("Choose your player");
    expect(html).toContain('href="/p/p1"');
    expect(html.match(/alt-current-badge/g)).toHaveLength(1);
    expect(html.slice(html.indexOf('href="/p/p2"'))).toContain("Current");
  });

  it("shows an empty league with guidance and the create form", () => {
    const html = renderToStaticMarkup(<AltPlayersDirectory players={[]} createForm={<button>Create player form</button>} onToggleStyle={noop} />);
    expect(html).toContain("No players yet");
    expect(html).toContain("Create player form");
    expect(html).toContain('href="/analytics"');
  });

  it("shows loading and load-failure states instead of guessing", () => {
    expect(renderToStaticMarkup(<AltPlayersDirectory players={[]} status="loading" createForm={null} onToggleStyle={noop} />)).toContain("Loading players");
    const failed = renderToStaticMarkup(<AltPlayersDirectory players={[]} status="error" loadError="Network down" onRetry={noop} createForm={null} onToggleStyle={noop} />);
    expect(failed).toContain("Network down");
    expect(failed).toContain("Try again");
    expect(failed).not.toContain("No players yet");
  });
});

describe("AltPlayerPageState", () => {
  it("offers recovery to the chooser for a nonexistent player without substituting another", () => {
    const html = renderToStaticMarkup(<AltPlayerPageState profileId="zz" activeNav="collection" copy={copy} notFound onToggleStyle={noop} />);
    expect(html).toContain("Player not found");
    expect(html).toContain("Choose a player");
    expect(html).toContain('href="/?next=collection"');
    expect(html).not.toContain('href="/p/');
  });

  it("shows load failures with a retry", () => {
    const html = renderToStaticMarkup(<AltPlayerPageState profileId="p1" activeNav="decks" copy={copy} error="Server error" onRetry={noop} onToggleStyle={noop} />);
    expect(html).toContain("Server error");
    expect(html).toContain("We couldn&#x27;t load these decks");
    expect(html).toContain("Try again");
  });

  it("shows the page's loading copy while the player loads", () => {
    const html = renderToStaticMarkup(<AltPlayerPageState profileId="p1" activeNav="decks" copy={copy} onToggleStyle={noop} />);
    expect(html).toContain("Loading decks…");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('href="/p/p1/decks"');
  });
});

describe("cross-player links", () => {
  it("AltAnalytics player rows do not link to players", () => {
    const html = renderToStaticMarkup(<AltAnalytics players={[{ id: "p2", name: "Alex", ownedCards: 3, ownedQty: 3, byRarity: { common: 3, uncommon: 0, rare: 0, mythic: 0 }, completionPct: 1 }]} cards={[]} search="" onSearch={noop} onToggleStyle={noop} />);
    expect(html).toContain("Alex");
    expect(html).not.toContain('href="/p/p2"');
  });

  it("AltMatches shows winners as plain text", () => {
    const html = renderToStaticMarkup(<AltMatches player={{ id: "p1", name: "Percy" }} wins={0} losses={1} matches={[{ id: "m1", winnerId: "p2", winnerName: "Alex", winnerIconCard: null, loserId: "p1", loserName: "Percy", loserIconCard: null, winnerDeckName: null, loserDeckName: null, note: null, createdAt: "2026-01-01T00:00:00Z" }]} onToggleStyle={noop} />);
    expect(html).not.toContain("View player");
    expect(html).not.toContain('href="/p/p2"');
    expect(html).toContain("Loss");
  });
});
