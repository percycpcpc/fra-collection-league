import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AltPlayersDirectory } from "./AltPlayersDirectory";
import { AltAnalytics } from "./AltAnalytics";
import { AltMatches } from "./AltMatches";
import { AltDeckList } from "./AltDeckList";
import { AltDeckEditor } from "./AltDeckEditor";

const noop = () => {};
const player = { id: "p1", name: "Percy", iconCard: null, cardCount: 12, deckCount: 2 };

describe("alternate player pages SSR smoke", () => {
  it("renders AltPlayersDirectory", () => {
    const html = renderToStaticMarkup(<AltPlayersDirectory players={[player]} createForm={<button>New</button>} onToggleStyle={noop} />);
    expect(html).toContain("Choose your player"); expect(html).toContain("Percy"); expect(html).toContain("Classic");
  });
  it("renders AltAnalytics", () => {
    const html = renderToStaticMarkup(<AltAnalytics players={[{ ...player, ownedCards: 12, ownedQty: 14, byRarity: { common: 4, uncommon: 4, rare: 3, mythic: 1 }, completionPct: 5 }]} cards={[{ name: "Ajani", rarity: "rare", colors: "white", img: "/a.jpg", owners: 1, totalQty: 2 }]} search="" onSearch={noop} onToggleStyle={noop} />);
    expect(html).toContain("League analytics"); expect(html).toContain("Completion"); expect(html).toContain("Ajani");
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
    const html = renderToStaticMarkup(<AltDeckEditor profileId="p1" profileName="Percy" players={[player]} deckName="Azorius" cards={[]} collection={[ajani]} poolGroups={[{ group: "White", entries: [{ card: ajani, offColor: false }] }]} basics={[]} hiddenPoolCount={0} search="" showOffColor={false} viewMode="images" status="Saved" error="" commanderNames={["Ajani"]} eligibleCommanderNames={["Ajani"]} hasCommanderIdentity catalog={[{ name: "Ajani", qty: 1, img: "/a.jpg", colors: "white", rarity: "rare", type: "Legendary Creature", colorIdentity: "w" }]} onSearch={noop} onShowOffColor={noop} onViewMode={noop} onQty={noop} onCommander={noop} onRename={noop} onToggleStyle={noop} isOffColor={() => false} />);
    expect(html).toContain("Azorius");
    expect(html).toContain("alt-deck-commander-card"); expect(html).toContain("/a.jpg"); expect(html).toContain("Ajani");
    expect(html).toContain("alt-deck-workspace"); expect(html).toContain("Deck contents"); expect(html).toContain("Your collection");
    expect(html).toContain("Your deck is empty"); expect(html).toContain("Color identity: no conflicts");
  });
});
