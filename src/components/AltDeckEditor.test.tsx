import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ALT_COLLAPSED_STORAGE_KEY, AltDeckEditor, readCollapsedGroups, writeCollapsedGroups } from "./AltDeckEditor";
import type { CatalogCard, CollectionCard, DeckCard } from "@/lib/client";

const noop = () => {};
const catalog: CatalogCard[] = [
  { name: "Ajani", qty: 1, img: "/a.jpg", colors: "white", rarity: "rare", type: "Legendary Creature", colorIdentity: "w", manaCost: "{2}{W}" },
  { name: "Dawn Charm", qty: 1, img: "/b.jpg", colors: "white", rarity: "common", type: "Instant", colorIdentity: "w", manaCost: "{1}{W} // {W/U}" },
  { name: "Plains", qty: 1, img: "/p.jpg", colors: "colorless", rarity: "common", type: "Basic Land", colorIdentity: "", manaCost: "" },
];
const ajani: CollectionCard = { id: "c1", profileId: "p1", name: "Ajani", qty: 2, owned: true };
const charm: CollectionCard = { id: "c2", profileId: "p1", name: "Dawn Charm", qty: 1, owned: true };
const deck: DeckCard[] = [{ id: "d1", deckId: "deck", name: "Dawn Charm", qty: 1, isBasic: false }, { id: "d2", deckId: "deck", name: "Plains", qty: 7, isBasic: true }];

function render(overrides: Partial<Parameters<typeof AltDeckEditor>[0]> = {}) {
  return renderToStaticMarkup(<AltDeckEditor profileId="p1" profileName="Percy" deckName="Azorius" renameDraft="Azorius" cards={deck} catalog={catalog} collection={[ajani, charm]}
    poolGroups={[{ group: "White", entries: [{ card: ajani, offColor: false }, { card: charm, offColor: false }] }]} basics={["Plains"]} hiddenPoolCount={0} search="" showOffColor={false}
    viewMode="images" commanderNames={["Ajani"]} eligibleCommanderNames={["Ajani"]} hasCommanderIdentity onSearch={noop} onRenameDraft={noop} onShowOffColor={noop} onViewMode={noop} onQty={noop}
    onCommander={noop} onRename={noop} onToggleStyle={noop} isOffColor={() => false} {...overrides} />);
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
}

describe("AltDeckEditor Classic builder layout", () => {
  it("renders collapsible pool groups with aria-expanded and collapse-all", () => {
    const html = render();
    expect(html).toMatch(/aria-expanded="true" aria-controls="alt-pool-group-white"/);
    expect(html).toMatch(/aria-expanded="true" aria-controls="alt-pool-group-basic-lands"/);
    expect(html).toContain("Collapse all");
  });

  it("hides collapsed groups and offers expand-all when every group is collapsed", () => {
    const html = render({ initialCollapsedGroups: ["White", "Basic lands"] });
    expect(html).toMatch(/aria-expanded="false" aria-controls="alt-pool-group-white"/);
    expect(html).toMatch(/id="alt-pool-group-white" hidden=""/);
    expect(html).toContain("Expand all");
    const partial = render({ initialCollapsedGroups: ["White"] });
    expect(partial).toMatch(/aria-expanded="true" aria-controls="alt-pool-group-basic-lands"/);
    expect(partial).toContain("Collapse all");
  });

  it("persists collapsed groups in the key shared with Classic", () => {
    const storage = memoryStorage();
    writeCollapsedGroups(storage, new Set(["White", "Basic lands"]));
    expect(storage.data.get(ALT_COLLAPSED_STORAGE_KEY)).toBe('["White","Basic lands"]');
    expect([...readCollapsedGroups(storage)]).toEqual(["White", "Basic lands"]);
    expect(readCollapsedGroups(memoryStorage({ [ALT_COLLAPSED_STORAGE_KEY]: "{bad" })).size).toBe(0);
    expect([...readCollapsedGroups(memoryStorage({ [ALT_COLLAPSED_STORAGE_KEY]: '["Red", 4]' }))]).toEqual(["Red"]);
    expect(readCollapsedGroups(undefined).size).toBe(0);
  });

  it("makes pool artwork add a copy only below the cap", () => {
    const html = render();
    expect(html).toMatch(/<button class="card-image-button "[^>]*type="button" aria-label="Add Ajani to deck">/);
    expect(html).toMatch(/<button class="card-image-button "[^>]*type="button" aria-label="Add Plains to deck">/);
    // Dawn Charm: 1 owned, 1 in deck — at cap, so the image button is disabled.
    expect(html).toMatch(/<article class="alt-card   at-cap"><div class="alt-card-visual"><button class="card-image-button " type="button" disabled=""><img src="\/b.jpg"/);
    expect(html).not.toContain("Add Dawn Charm to deck");
    // Off-color pool cards cannot be added from the image.
    const offColor = render({ poolGroups: [{ group: "White", entries: [{ card: ajani, offColor: true }] }] });
    expect(offColor).not.toContain("Add Ajani to deck"); expect(offColor).toContain("is-off-color  at-cap");
  });

  it("overlays the deck quantity badge on the card artwork", () => {
    const html = render();
    expect(html).toMatch(/<div class="alt-card-visual">.*?<span class="alt-deck-qty-badge" aria-label="7 in deck">7<\/span><\/div>/);
    expect(html).toContain('aria-label="1 in deck"');
    expect(html).not.toContain('aria-label="0 in deck"');
  });

  it("mounts the deck analysis beside the commanders in image mode only", () => {
    const html = render();
    expect(html).toContain("alt-deck-overview"); expect(html).toContain('aria-label="Deck analysis"'); expect(html).toContain("deck-analysis");
    expect(render({ viewMode: "list" })).not.toContain("deck-analysis");
    expect(render({ cards: [], commanderNames: [] })).not.toContain("deck-analysis");
  });

  it("groups deck contents into Creatures, Other and Lands", () => {
    const html = render({ cards: [...deck, { id: "d3", deckId: "deck", name: "Ajani", qty: 1, isBasic: false }] });
    const order = ["<h3>Creatures</h3>", "<h3>Other</h3>", "<h3>Lands</h3>"].map((heading) => html.indexOf(heading));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("renders mana symbols (including split faces) and rarity in list rows", () => {
    const html = render({ viewMode: "list" });
    expect(html).toContain("alt-deck-list-name");
    expect(html).toContain("ms ms-2 ms-cost"); expect(html).toContain("ms ms-wu ms-cost"); expect(html).toContain('class="mana-sep"');
    expect(html).toMatch(/<span class="alt-deck-rarity" title="rare"><i class="alt-gem alt-rarity-rare"><\/i>R<\/span>/);
  });

  it("keeps the Alt off-color toggle, legality status and commander modal trigger", () => {
    const html = render({ hiddenPoolCount: 3 });
    expect(html).toContain("Show off-color (3)"); expect(html).toContain("Color identity: no conflicts"); expect(html).toContain("Change commanders");
  });
});
