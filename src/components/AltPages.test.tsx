import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AltPlayersDirectory } from "./AltPlayersDirectory";
import { AltAnalytics } from "./AltAnalytics";
import { AltMatches } from "./AltMatches";
import { AltCommanderField, AltDeckList } from "./AltDeckList";
import { AdminFrame } from "./AdminPanel";
import { AltDeckEditor } from "./AltDeckEditor";
import { AltShell } from "./AltShell";

const noop = () => {};
const player = { id: "p1", name: "Percy", iconCard: null, cardCount: 12, deckCount: 2 };

describe("alternate player pages SSR smoke", () => {
  it("announces the current page and mobile player context", () => {
    const html = renderToStaticMarkup(<AltShell title="Percy's collection" activeNav="collection" playerId="p1" players={[player]} onToggleStyle={noop}><p>Cards</p></AltShell>);
    expect(html).toContain('aria-label="Mobile league navigation. Player links target Percy"');
    expect(html).toContain("Player links: Percy");
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(html).toContain('href="/p/p1/decks"');
    expect(html).toContain('href="/matches"');
    expect(html).not.toContain('href="/p/p1/matches"');
  });
  it("does not silently choose the first player on league pages", () => {
    const html = renderToStaticMarkup(<AltShell title="League analytics" activeNav="analytics" players={[player]} onToggleStyle={noop}><p>Stats</p></AltShell>);
    expect(html).toContain('href="/matches"');
    expect(html).not.toContain('href="/p/p1/decks"');
    expect(html).not.toContain('href="/p/p1/matches"');
    expect(html).toContain("League navigation");
  });
  it("renders AltPlayersDirectory", () => {
    const html = renderToStaticMarkup(<AltPlayersDirectory players={[player]} sidebarPlayers={[{ id: "p2", name: "Alex" }]} createForm={<button>New</button>} onToggleStyle={noop} />);
    expect(html).toContain("Choose your player"); expect(html).toContain("Percy"); expect(html).toContain("Alex"); expect(html).toContain("Classic");
  });
  it("renders AltAnalytics", () => {
    const html = renderToStaticMarkup(<AltAnalytics players={[{ ...player, ownedCards: 12, ownedQty: 14, byRarity: { common: 4, uncommon: 4, rare: 3, mythic: 1 }, completionPct: 5 }]} cards={[{ name: "Ajani", rarity: "rare", colors: "white", img: "/a.jpg", owners: 1, totalQty: 2 }]} search="" onSearch={noop} onToggleStyle={noop} />);
    expect(html).toContain("League analytics"); expect(html).toContain("Completion"); expect(html).toContain("Ajani");
  });
  it("renders actionable empty and no-result Alt states", () => {
    const emptyPlayers = renderToStaticMarkup(<AltPlayersDirectory players={[]} createForm={<button>New player</button>} onToggleStyle={noop} />);
    expect(emptyPlayers).toContain("No players yet"); expect(emptyPlayers).toContain("New player");
    const emptyDecks = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" players={[player]} decks={[]} createForm={<button>Create</button>} onToggleStyle={noop} />);
    expect(emptyDecks).toContain("No decks yet"); expect(emptyDecks).toContain("Create a deck above");
    const emptyAnalytics = renderToStaticMarkup(<AltAnalytics players={[]} cards={[]} search="" onSearch={noop} onToggleStyle={noop} />);
    expect(emptyAnalytics).toContain("No analytics data yet"); expect(emptyAnalytics).toContain("Back to players");
  });
  it("renders AltMatches", () => {
    const html = renderToStaticMarkup(<AltMatches playerId="p1" playerName="Percy" players={[player]} wins={1} losses={0} matches={[{ id: "m1", winnerId: "p1", winnerName: "Percy", winnerIconCard: null, loserId: "p2", loserName: "Alex", loserIconCard: null, winnerDeckName: null, loserDeckName: null, note: null, createdAt: "2026-01-01T00:00:00Z" }]} onToggleStyle={noop} />);
    expect(html).toContain("Percy&#x27;s matches"); expect(html).toContain("Match history"); expect(html).toContain("Alex");
  });
  it("renders AltDeckList", () => {
    const html = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" players={[player]} decks={[{ id: "d1", name: "Azorius", commander: "Ajani", cardCount: 20 }]} createForm={<button>Create</button>} onToggleStyle={noop} />);
    expect(html).toContain("Percy&#x27;s decks"); expect(html).toContain("Azorius"); expect(html).toContain("Ajani");
  });
  it("renders AltDeckEditor", () => {
    const ajani = { id: "c1", profileId: "p1", name: "Ajani", qty: 2, owned: true };
    const html = renderToStaticMarkup(<AltDeckEditor profileId="p1" profileName="Percy" players={[player]} deckName="Azorius" renameDraft="Azorius" cards={[]} collection={[ajani]} poolGroups={[{ group: "White", entries: [{ card: ajani, offColor: false }] }]} basics={[]} hiddenPoolCount={0} search="" showOffColor={false} viewMode="images" status="Saved" error="" commanderNames={["Ajani"]} eligibleCommanderNames={["Ajani"]} hasCommanderIdentity catalog={[{ name: "Ajani", qty: 1, img: "/a.jpg", colors: "white", rarity: "rare", type: "Legendary Creature", colorIdentity: "w", manaCost: "" }]} onSearch={noop} onRenameDraft={noop} onShowOffColor={noop} onViewMode={noop} onQty={noop} onCommander={noop} onRename={noop} onToggleStyle={noop} isOffColor={() => false} />);
    expect(html).toContain("Azorius");
    expect(html).toContain("alt-deck-commander-card"); expect(html).toContain("/a.jpg"); expect(html).toContain("Ajani");
    expect(html).toContain("alt-deck-workspace"); expect(html).toContain("Deck contents"); expect(html).toContain("Your collection");
    expect(html).toContain("Your deck is empty"); expect(html).toContain("Color identity: no conflicts");
  });
});

const match = { id: "m1", winnerId: "p1", winnerName: "Percy", winnerIconCard: null, loserId: "p2", loserName: "Alex", loserIconCard: "Ajani", winnerDeckName: "Azorius", loserDeckName: "Gruul", note: "A close game", createdAt: "2026-01-01T18:30:00Z" };

describe("alt UI parity (#37)", () => {
  it("renders the Alt deck creation form in its own section with commander pickers", () => {
    const form = <form><AltCommanderField label="Commander (optional)" query="Aj" open options={["Ajani"]} clearLabel="— No commander" placeholder="Search legendary creatures…" onQuery={noop} onOpen={noop} onChoose={noop} /><AltCommanderField label="Second commander (optional)" query="" open={false} options={["Ajani"]} clearLabel="— No second commander" placeholder="Search second commander…" disabled onQuery={noop} onOpen={noop} onChoose={noop} /></form>;
    const html = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" players={[player]} decks={[]} createForm={form} onToggleStyle={noop} />);
    expect(html).toContain("New deck"); expect(html).toContain("Commander (optional)"); expect(html).toContain("— No commander"); expect(html).toContain("<li>Ajani</li>");
    expect(html).not.toContain("— No second commander"); expect(html).toMatch(/placeholder="Search second commander…"[^>]*disabled=""/);
  });
  it("renders the commander picker without a dropdown when closed", () => {
    const html = renderToStaticMarkup(<AltCommanderField label="Commander" query="" open={false} options={["Ajani"]} clearLabel="— No commander" placeholder="Search" onQuery={noop} onOpen={noop} onChoose={noop} />);
    expect(html).not.toContain("cmd-dropdown");
  });
  it("renders per-player actions in AltPlayersDirectory", () => {
    const html = renderToStaticMarkup(<AltPlayersDirectory players={[player]} createForm={null} actions={(p) => <span>Delete {p.name}? Confirm</span>} onToggleStyle={noop} />);
    expect(html).toContain("Delete Percy? Confirm"); expect(html).toContain("alt-player-actions"); expect(html).toContain('href="/p/p1"');
  });
  it("omits player actions when none are passed", () => {
    expect(renderToStaticMarkup(<AltPlayersDirectory players={[player]} createForm={null} onToggleStyle={noop} />)).not.toContain("alt-player-actions");
  });
  it("shows deck names, avatars, timestamp and note together in AltMatches", () => {
    const html = renderToStaticMarkup(<AltMatches playerId="p1" playerName="Percy" players={[player]} wins={1} losses={0} matches={[match]} onToggleStyle={noop} />);
    expect(html).toContain("Azorius"); expect(html).toContain("Gruul");
    expect(html).toContain("Percy icon"); expect(html).toContain("Alex icon");
    const stamp = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.createdAt));
    expect(html).toContain(`${stamp} — A close game`);
  });
  it("renders match actions, delete errors and head-to-head in AltMatches", () => {
    const html = renderToStaticMarkup(<AltMatches playerId="p1" playerName="Percy" players={[player]} wins={1} losses={0} matches={[match]} headToHead={[{ opponentId: "p2", opponentName: "Alex", opponentIconCard: null, wins: 1, losses: 0 }]} actions={(m) => <button>Delete {m.winnerName} vs {m.loserName}</button>} error="Could not delete match." onToggleStyle={noop} />);
    expect(html).toContain("Delete Percy vs Alex"); expect(html).toContain('role="alert"'); expect(html).toContain("Could not delete match.");
    expect(html).toContain("Head to head"); expect(html).toContain("1W · 0L");
  });
  it("renders an empty Alt match history", () => {
    expect(renderToStaticMarkup(<AltMatches playerId="p1" playerName="League" players={[]} wins={0} losses={0} matches={[]} onToggleStyle={noop} />)).toContain("No matches yet");
  });
  it("wraps admin content in AltShell only for the Alt style", () => {
    const alt = renderToStaticMarkup(<AdminFrame style="alt" players={[player]} onToggleStyle={noop}><p>Catalog</p></AdminFrame>);
    expect(alt).toContain("alt-ui-root"); expect(alt).toContain("alt-admin"); expect(alt).toContain("Admin panel"); expect(alt).toContain("Catalog"); expect(alt).toContain("Switch to Classic UI");
    const classic = renderToStaticMarkup(<AdminFrame style="classic" players={[player]} onToggleStyle={noop}><p>Catalog</p></AdminFrame>);
    expect(classic).toBe('<main class="admin"><p>Catalog</p></main>');
  });
});
