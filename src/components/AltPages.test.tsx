import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AltPlayersDirectory } from "./AltPlayersDirectory";
import { AltAnalytics } from "./AltAnalytics";
import { AltMatches } from "./AltMatches";
import { AltCommanderField, AltDeckList, AltDeleteDeckDialog, AltNewDeckDialog } from "./AltDeckList";
import { AdminFrame } from "./AdminPanel";
import { AltDeckEditor } from "./AltDeckEditor";
import { AltShell } from "./AltShell";

const noop = () => {};
const player = { id: "p1", name: "Percy", iconCard: null, cardCount: 12, deckCount: 2 };
const catalog = [
  { name: "Ajani", qty: 1, img: "https://cards.example/ajani.jpg", colors: "white", rarity: "rare", type: "Legendary Creature", colorIdentity: "w", manaCost: "" },
  { name: "Bruse Tarl", qty: 1, img: "https://cards.example/bruse.jpg", colors: "red,white", rarity: "rare", type: "Legendary Creature", colorIdentity: "rw", manaCost: "" },
];

describe("alternate player pages SSR smoke", () => {
  it("announces the current page and the browsing player", () => {
    const html = renderToStaticMarkup(<AltShell title="Percy's collection" activeNav="collection" player={{ id: "p1", name: "Percy" }} onToggleStyle={noop}><p>Cards</p></AltShell>);
    expect(html).toContain("Browsing"); expect(html).toContain("Percy");
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(html).toContain('href="/p/p1/decks"');
    expect(html).toContain('href="/p/p1/matches"');
  });
  it("does not silently choose the first player on league pages", () => {
    const html = renderToStaticMarkup(<AltShell title="League analytics" activeNav="analytics" onToggleStyle={noop}><p>Stats</p></AltShell>);
    expect(html).not.toMatch(/href="\/p\//);
    expect(html).toMatch(/class="active" aria-current="page" href="\/analytics"/);
    expect(html).toContain("League navigation");
  });
  it("renders AltPlayersDirectory", () => {
    const html = renderToStaticMarkup(<AltPlayersDirectory players={[player, { ...player, id: "p2", name: "Alex" }]} createForm={<button>New</button>} onToggleStyle={noop} />);
    expect(html).toContain("Choose your player"); expect(html).toContain("Percy"); expect(html).toContain("Alex"); expect(html).toContain("Classic");
  });
  it("renders AltAnalytics", () => {
    const html = renderToStaticMarkup(<AltAnalytics players={[{ ...player, ownedCards: 12, ownedQty: 14, byRarity: { common: 4, uncommon: 4, rare: 3, mythic: 1 }, completionPct: 5 }]} cards={[{ name: "Ajani", rarity: "rare", colors: "white", img: "/a.jpg", owners: 1, totalQty: 2 }]} search="" onSearch={noop} onToggleStyle={noop} />);
    expect(html).toContain("League analytics"); expect(html).toContain("Completion"); expect(html).toContain("Ajani");
  });
  it("renders actionable empty and no-result Alt states", () => {
    const emptyPlayers = renderToStaticMarkup(<AltPlayersDirectory players={[]} createForm={<button>New player</button>} onToggleStyle={noop} />);
    expect(emptyPlayers).toContain("No players yet"); expect(emptyPlayers).toContain("New player");
    const emptyDecks = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={[]} onToggleStyle={noop} />);
    expect(emptyDecks).toContain("No decks yet"); expect(emptyDecks).toContain("Use New deck to create one"); expect(emptyDecks).toContain("Build your first deck");
    const emptyAnalytics = renderToStaticMarkup(<AltAnalytics players={[]} cards={[]} search="" onSearch={noop} onToggleStyle={noop} />);
    expect(emptyAnalytics).toContain("No analytics data yet"); expect(emptyAnalytics).toContain("Back to players");
  });
  it("renders AltMatches", () => {
    const html = renderToStaticMarkup(<AltMatches player={{ id: "p1", name: "Percy" }} wins={1} losses={0} matches={[{ id: "m1", winnerId: "p1", winnerName: "Percy", winnerIconCard: null, loserId: "p2", loserName: "Alex", loserIconCard: null, winnerDeckName: null, loserDeckName: null, note: null, createdAt: "2026-01-01T00:00:00Z" }]} onToggleStyle={noop} />);
    expect(html).toContain("Percy&#x27;s matches"); expect(html).toContain("Match history"); expect(html).toContain("Alex");
  });
  it("renders AltDeckList commander images for zero, one, or two commanders", () => {
    const html = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={[
      { id: "d0", name: "Unled", commander: null, cardCount: 0 },
      { id: "d1", name: "Azorius", commander: "Ajani", cardCount: 20 },
      { id: "d2", name: "Partners", commander: "Ajani // Bruse Tarl", cardCount: 30 },
    ]} catalog={catalog} onToggleStyle={noop} />);
    expect(html).toContain("Percy&#x27;s decks"); expect(html).toContain("Pick a legendary creature");
    expect(html.match(/class="alt-commander-images"/g)).toHaveLength(2);
    expect(html.match(/src="https:\/\/cards\.example\/ajani\.jpg" alt="Ajani" loading="lazy"/g)).toHaveLength(2);
    expect(html).toContain('src="https://cards.example/bruse.jpg" alt="Bruse Tarl" loading="lazy"');
  });
  it("renders AltDeckEditor", () => {
    const ajani = { id: "c1", profileId: "p1", name: "Ajani", qty: 2, owned: true };
    const html = renderToStaticMarkup(<AltDeckEditor profileId="p1" profileName="Percy" deckName="Azorius" renameDraft="Azorius" cards={[]} collection={[ajani]} poolGroups={[{ group: "White", entries: [{ card: ajani, offColor: false }] }]} basics={[]} hiddenPoolCount={0} search="" showOffColor={false} viewMode="images" status="Saved" error="" commanderNames={["Ajani"]} eligibleCommanderNames={["Ajani"]} hasCommanderIdentity catalog={[{ name: "Ajani", qty: 1, img: "/a.jpg", colors: "white", rarity: "rare", type: "Legendary Creature", colorIdentity: "w", manaCost: "" }]} onSearch={noop} onRenameDraft={noop} onShowOffColor={noop} onViewMode={noop} onQty={noop} onCommander={noop} onRename={noop} onToggleStyle={noop} isOffColor={() => false} />);
    expect(html).toContain("Azorius");
    expect(html).toContain("alt-deck-commander-card"); expect(html).toContain("/a.jpg"); expect(html).toContain("Ajani");
    expect(html).toContain("alt-deck-workspace"); expect(html).toContain("Deck contents"); expect(html).toContain("Your collection");
    expect(html).toContain("Your deck is empty"); expect(html).toContain("Color identity: no conflicts");
  });
});

const match = { id: "m1", winnerId: "p1", winnerName: "Percy", winnerIconCard: null, loserId: "p2", loserName: "Alex", loserIconCard: "Ajani", winnerDeckName: "Azorius", loserDeckName: "Gruul", note: "A close game", createdAt: "2026-01-01T18:30:00Z" };

describe("alt UI parity (#37)", () => {
  it("renders the Alt new deck dialog with the commander pickers", () => {
    const fields = <><AltCommanderField label="Commander (optional)" query="Aj" open options={["Ajani"]} clearLabel="— No commander" placeholder="Search legendary creatures…" onQuery={noop} onOpen={noop} onChoose={noop} /><AltCommanderField label="Second commander (optional)" query="" open={false} options={["Ajani"]} clearLabel="— No second commander" placeholder="Search second commander…" disabled onQuery={noop} onOpen={noop} onChoose={noop} /></>;
    const dialog = <AltNewDeckDialog hint="Choose up to 2 different legendary creatures from Percy's collection." creating={false} nameField={<input name="name" required />} commanderFields={fields} onClose={noop} onSubmit={noop} />;
    const html = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={[]} dialog={dialog} onToggleStyle={noop} />);
    expect(html).toMatch(/<form class="alt-decks-dialog" role="dialog" aria-modal="true" aria-labelledby="alt-new-deck-title" aria-describedby="alt-commander-hint"/);
    expect(html).toContain('id="alt-new-deck-title">New deck</h3>'); expect(html).toContain("Choose up to 2 different legendary creatures");
    expect(html).toContain("Commander (optional)"); expect(html).toContain("— No commander"); expect(html).toContain("<li>Ajani</li>");
    expect(html).not.toContain("— No second commander"); expect(html).toMatch(/placeholder="Search second commander…"[^>]*disabled=""/);
    expect(html).toMatch(/<button class="alt-decks-btn alt-decks-btn-primary" type="submit">Create deck<\/button>/);
  });
  it("shows creating state and errors inside the new deck dialog instead of behind it", () => {
    const dialog = <AltNewDeckDialog hint="hint" error="Name taken" creating nameField={null} commanderFields={null} onClose={noop} onSubmit={noop} />;
    const html = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={[]} dialog={dialog} error="Name taken" onToggleStyle={noop} />);
    expect(html.match(/Name taken/g)).toHaveLength(1); expect(html).toContain('role="alert">Name taken');
    expect(html).toMatch(/type="submit" disabled="">Creating…</);
  });
  it("renders the delete deck dialog with the contract copy", () => {
    const html = renderToStaticMarkup(<AltDeleteDeckDialog deckName="Azorius" onCancel={noop} onConfirm={noop} />);
    expect(html).toContain('role="dialog"'); expect(html).toContain("Delete Azorius?");
    expect(html).toContain("The deck is removed from league play. Cards stay in the collection.");
    expect(html).toContain(">Cancel</button>"); expect(html).toContain(">Delete deck</button>");
  });
  it("renders Nocturne deck rows with identity, pips, progress and actions", () => {
    const html = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={[
      { id: "d1", name: "Boros", commander: "Bruse Tarl", cardCount: 50 },
      { id: "d0", name: "Unled", commander: null, cardCount: 1 },
    ]} catalog={catalog} onDelete={noop} onToggleStyle={noop} />);
    expect(html).toContain("2 decks · 1 ready for league play");
    expect(html).toContain('class="alt-deck-row-kicker">Boros</span>'); expect(html).toContain('aria-label="Color identity: White, Red"');
    expect(html.match(/class="alt-deck-pip"/g)).toHaveLength(2); expect(html).toContain("50 cards"); expect(html).toContain("Ready for league"); expect(html).toContain("width:50%");
    expect(html).toContain('href="/p/p1/decks/d1"'); expect(html).toContain('aria-label="Delete Boros"'); expect(html).toContain("Build another deck");
  });
  it("renders a no-commander row cleanly with no pips or identity wash", () => {
    const html = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={[{ id: "d0", name: "Unled", commander: null, cardCount: 1 }]} catalog={catalog} onToggleStyle={noop} />);
    expect(html).toContain('class="alt-deck-row-kicker">No commander</span>'); expect(html).toContain("1 card<"); expect(html).toContain("alt-deck-row-placeholder");
    expect(html).not.toContain("alt-deck-pip"); expect(html).not.toContain("alt-deck-row-wash"); expect(html).not.toContain("alt-commander-images");
  });
  it("narrows deck rows with the filter query", () => {
    const decks = [{ id: "d1", name: "Boros", commander: "Bruse Tarl", cardCount: 50 }, { id: "d2", name: "Azorius", commander: "Ajani", cardCount: 20 }];
    const byCommander = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={decks} catalog={catalog} query="bruse" onToggleStyle={noop} />);
    expect(byCommander).toContain("<h2>Boros</h2>"); expect(byCommander).not.toContain("<h2>Azorius</h2>"); expect(byCommander).toContain('value="bruse"');
    const none = renderToStaticMarkup(<AltDeckList profileId="p1" profileName="Percy" decks={decks} catalog={catalog} query="zzz" onToggleStyle={noop} />);
    expect(none).not.toContain("alt-deck-row\""); expect(none).toContain("No decks match"); expect(none).toContain("2 decks · 2 ready");
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
    const html = renderToStaticMarkup(<AltMatches player={{ id: "p1", name: "Percy" }} wins={1} losses={0} matches={[match]} onToggleStyle={noop} />);
    expect(html).toContain("Azorius"); expect(html).toContain("Gruul");
    expect(html).toContain("Percy icon"); expect(html).toContain("Alex icon");
    const stamp = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.createdAt));
    expect(html).toContain(`${stamp} — A close game`);
  });
  it("renders match actions, delete errors and head-to-head in AltMatches", () => {
    const html = renderToStaticMarkup(<AltMatches player={{ id: "p1", name: "Percy" }} wins={1} losses={0} matches={[match]} headToHead={[{ opponentId: "p2", opponentName: "Alex", opponentIconCard: null, wins: 1, losses: 0 }]} actions={(m) => <button>Delete {m.winnerName} vs {m.loserName}</button>} error="Could not delete match." onToggleStyle={noop} />);
    expect(html).toContain("Delete Percy vs Alex"); expect(html).toContain('role="alert"'); expect(html).toContain("Could not delete match.");
    expect(html).toContain("Head to head"); expect(html).toContain("1W · 0L");
  });
  it("renders an empty Alt match history", () => {
    expect(renderToStaticMarkup(<AltMatches player={{ id: "p1", name: "Percy" }} wins={0} losses={0} matches={[]} onToggleStyle={noop} />)).toContain("No matches yet");
  });
  it("renders the league match total and history range", () => {
    const html = renderToStaticMarkup(<AltMatches player={{ id: "p1", name: "Percy" }} wins={0} losses={0} summary="42 matches recorded" matches={[match]} pagination={{ offset: 25, limit: 25, total: 42 }} onPage={noop} onToggleStyle={noop} />);
    expect(html).toContain("42 matches recorded"); expect(html).toContain("26–42 of 42");
    expect(html).toContain("Newer"); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Older/);
  });
  it("wraps admin content in AltShell only for the Alt style", () => {
    const alt = renderToStaticMarkup(<AdminFrame style="alt" onToggleStyle={noop}><p>Catalog</p></AdminFrame>);
    expect(alt).toContain("alt-ui-root"); expect(alt).toContain("alt-admin"); expect(alt).toContain("Admin panel"); expect(alt).toContain("Catalog"); expect(alt).toContain("Switch to Classic UI");
    const classic = renderToStaticMarkup(<AdminFrame style="classic" onToggleStyle={noop}><p>Catalog</p></AdminFrame>);
    expect(classic).toBe('<main class="admin"><p>Catalog</p></main>');
  });
});
