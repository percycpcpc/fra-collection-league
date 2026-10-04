import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ALT_COLLAPSED_STORAGE_KEY,
  ALT_DECK_DEFAULT_VIEW_MODE,
  AltDeckEditor,
  readCollapsedGroups,
  writeCollapsedGroups,
} from "./AltDeckEditor";
import type { CatalogCard, CollectionCard, DeckCard } from "@/lib/client";
import {
  ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY,
  ALT_POOL_GROUPING_STORAGE_KEY,
  ALT_POOL_TYPE_COLLAPSED_STORAGE_KEY,
  readGroupingPreference,
  readIdSet,
  writeGroupingPreference,
  writeIdSet,
} from "@/lib/alt-group-preferences";

const noop = () => {};
const catalog: CatalogCard[] = [
  {
    name: "Ajani",
    qty: 1,
    img: "/a.jpg",
    colors: "white",
    rarity: "rare",
    type: "Legendary Creature",
    colorIdentity: "w",
    manaCost: "{2}{W}",
  },
  {
    name: "Dawn Charm",
    qty: 1,
    img: "/b.jpg",
    colors: "white",
    rarity: "common",
    type: "Instant",
    colorIdentity: "w",
    manaCost: "{1}{W} // {W/U}",
  },
  {
    name: "Sol Ring",
    qty: 1,
    img: "/s.jpg",
    colors: "colorless",
    rarity: "uncommon",
    type: "Artifact",
    colorIdentity: "",
    manaCost: "{1}",
  },
  {
    name: "Plains",
    qty: 1,
    img: "/p.jpg",
    colors: "colorless",
    rarity: "common",
    type: "Basic Land",
    colorIdentity: "",
    manaCost: "",
  },
];
const ajani: CollectionCard = {
  id: "c1",
  profileId: "p1",
  name: "Ajani",
  qty: 2,
  owned: true,
};
const charm: CollectionCard = {
  id: "c2",
  profileId: "p1",
  name: "Dawn Charm",
  qty: 1,
  owned: true,
};
const deck: DeckCard[] = [
  { id: "d1", deckId: "deck", name: "Dawn Charm", qty: 1, isBasic: false },
  { id: "d2", deckId: "deck", name: "Plains", qty: 7, isBasic: true },
];

function render(overrides: Partial<Parameters<typeof AltDeckEditor>[0]> = {}) {
  return renderToStaticMarkup(
    <AltDeckEditor
      profileId="p1"
      profileName="Percy"
      deckName="Azorius"
      renameDraft="Azorius"
      cards={deck}
      catalog={catalog}
      collection={[ajani, charm]}
      poolGroups={[
        {
          group: "White",
          entries: [
            { card: ajani, offColor: false },
            { card: charm, offColor: false },
          ],
        },
      ]}
      basics={["Plains"]}
      hiddenPoolCount={0}
      search=""
      showOffColor={false}
      viewMode="images"
      commanderNames={["Ajani"]}
      eligibleCommanderNames={["Ajani"]}
      hasCommanderIdentity
      onSearch={noop}
      onRenameDraft={noop}
      onShowOffColor={noop}
      onViewMode={noop}
      onQty={noop}
      onCommander={noop}
      onRename={noop}
      onToggleStyle={noop}
      isOffColor={() => false}
      {...overrides}
    />,
  );
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe("AltDeckEditor Classic builder layout", () => {
  it("defaults fresh editor preferences to List mode", () => {
    expect(ALT_DECK_DEFAULT_VIEW_MODE).toBe("list");
  });

  it("places the view switch in the shared pane controls", () => {
    const html = render();
    const topbar = html.match(/<header class="alt-topbar"[\s\S]*?<\/header>/)?.[0];
    const controls = html.match(
      /<section class="alt-deck-shared-controls"[\s\S]*?<\/section>/,
    )?.[0];

    expect(topbar).not.toContain('aria-label="Deck editor view mode"');
    expect(controls).toContain('aria-label="Deck editor view mode"');
  });

  it("keeps Color mode on the legacy collapsible pool path", () => {
    const html = render({ initialPoolGrouping: "color" });
    expect(html).toMatch(
      /aria-expanded="true" aria-controls="alt-pool-group-white"/,
    );
    expect(html).toMatch(
      /aria-expanded="true" aria-controls="alt-pool-group-basic-lands"/,
    );
    expect(html).toContain("Collapse all");
  });

  it("hides collapsed pool groups while the shared bulk control reflects both panes", () => {
    const html = render({
      initialPoolGrouping: "color",
      initialCollapsedGroups: ["White", "Basic lands"],
    });
    expect(html).toMatch(
      /aria-expanded="false" aria-controls="alt-pool-group-white"/,
    );
    expect(html).toMatch(/id="alt-pool-group-white" hidden=""/);
    expect(html).toContain('aria-label="Deck editor controls"');
    expect(html).toContain("Collapse all");
    const partial = render({
      initialPoolGrouping: "color",
      initialCollapsedGroups: ["White"],
    });
    expect(partial).toMatch(
      /aria-expanded="true" aria-controls="alt-pool-group-basic-lands"/,
    );
    expect(partial).toContain("Collapse all");
  });

  it("persists collapsed groups in the key shared with Classic", () => {
    const storage = memoryStorage();
    writeCollapsedGroups(storage, new Set(["White", "Basic lands"]));
    expect(storage.data.get(ALT_COLLAPSED_STORAGE_KEY)).toBe(
      '["White","Basic lands"]',
    );
    expect([...readCollapsedGroups(storage)]).toEqual(["White", "Basic lands"]);
    expect(
      readCollapsedGroups(
        memoryStorage({ [ALT_COLLAPSED_STORAGE_KEY]: "{bad" }),
      ).size,
    ).toBe(0);
    expect([
      ...readCollapsedGroups(
        memoryStorage({ [ALT_COLLAPSED_STORAGE_KEY]: '["Red", 4]' }),
      ),
    ]).toEqual(["Red"]);
    expect(readCollapsedGroups(undefined).size).toBe(0);
  });

  it("defaults the pool to Type grouping and offers Color as an alternative", () => {
    const html = render();
    expect(html).toMatch(
      /aria-label="Pool grouping"[\s\S]*?aria-pressed="true">Type/,
    );
    expect(html).toContain('id="alt-deck-pool-type-creature"');
    expect(html).toContain('id="alt-deck-pool-type-spell"');
    expect(html).not.toContain("alt-pool-group-white");
    const color = render({ initialPoolGrouping: "color" });
    expect(color).toMatch(
      /aria-label="Pool grouping"[\s\S]*?aria-pressed="true">Color/,
    );
    expect(color).toContain('aria-controls="alt-pool-group-white"');
  });

  it("narrows Type rendering with filter chips while retaining search-filtered counts", () => {
    const html = render({
      initialPoolFilter: "spell",
      search: "dawn",
      poolGroups: [
        { group: "White", entries: [{ card: charm, offColor: false }] },
      ],
    });
    expect(html).toContain('aria-label="Spells, 1 cards" aria-pressed="true"');
    expect(html).toContain(
      'aria-label="Creatures, 0 cards" aria-pressed="false"',
    );
    expect(html).toContain('id="alt-deck-pool-type-spell"');
    expect(html).not.toContain('id="alt-deck-pool-type-creature"');
    expect(html).not.toContain('id="alt-deck-pool-type-basics"');
    expect(html).toContain('id="alt-deck-contents-spell"');
    expect(html).not.toContain('id="alt-deck-contents-land"');
    expect(html).toContain('aria-label="Search deck and collection"');
    expect(html.match(/aria-label="Deck editor type filters"/g)).toHaveLength(1);
    expect(render({ initialPoolFilter: null })).toContain(
      'id="alt-deck-pool-type-creature"',
    );
    expect(render({ initialPoolFilter: null })).toContain(
      'aria-label="All, 3 cards" aria-pressed="true"',
    );
    expect(html).toContain('aria-label="All, 1 cards" aria-pressed="false"');
  });

  it("isolates Type disclosures and grouping from the legacy Color key", () => {
    const storage = memoryStorage({ [ALT_COLLAPSED_STORAGE_KEY]: '["White"]' });
    writeIdSet(
      storage,
      ALT_POOL_TYPE_COLLAPSED_STORAGE_KEY,
      new Set(["creature", "basics", "White"]),
    );
    writeGroupingPreference(storage, ALT_POOL_GROUPING_STORAGE_KEY, "color");
    expect([
      ...readIdSet(storage, ALT_POOL_TYPE_COLLAPSED_STORAGE_KEY, [
        "creature",
        "spell",
        "permanent",
        "land",
        "basics",
      ]),
    ]).toEqual(["creature", "basics"]);
    expect(readGroupingPreference(storage, ALT_POOL_GROUPING_STORAGE_KEY)).toBe(
      "color",
    );
    expect(storage.data.get(ALT_COLLAPSED_STORAGE_KEY)).toBe('["White"]');
    const typed = render({ initialPoolTypeCollapsed: ["creature", "basics"] });
    expect(typed).toMatch(
      /aria-expanded="false" aria-controls="alt-deck-pool-type-creature-body"/,
    );
    expect(typed).toMatch(
      /aria-expanded="false" aria-controls="alt-deck-pool-type-basics-body"/,
    );
  });

  it("keeps Basics separate in both pool modes", () => {
    expect(render()).toContain('id="alt-deck-pool-type-basics"');
    expect(render({ initialPoolGrouping: "color" })).toContain(
      'aria-controls="alt-pool-group-basic-lands"',
    );
  });

  it("makes pool artwork add a copy only below the cap", () => {
    const html = render();
    expect(html).toMatch(
      /<button class="card-image-button "[^>]*type="button" aria-label="Add Ajani to deck">/,
    );
    expect(html).toMatch(
      /<button class="card-image-button "[^>]*type="button" aria-label="Add Plains to deck">/,
    );
    // Dawn Charm: 1 owned, 1 in deck — at cap, so the image button is disabled.
    expect(html).toMatch(
      /<article class="alt-card   at-cap"><div class="alt-card-visual"><button class="card-image-button " type="button" disabled=""><img src="\/b.jpg"/,
    );
    expect(html).not.toContain("Add Dawn Charm to deck");
    // Off-color pool cards cannot be added from the image.
    const offColor = render({
      poolGroups: [
        { group: "White", entries: [{ card: ajani, offColor: true }] },
      ],
    });
    expect(offColor).not.toContain("Add Ajani to deck");
    expect(offColor).toContain("is-off-color  at-cap");
  });

  it("overlays the deck quantity badge on the card artwork", () => {
    const html = render();
    expect(html).toMatch(
      /<div class="alt-card-visual">.*?<span class="alt-deck-qty-badge" aria-label="7 in deck">7<\/span><\/div>/,
    );
    expect(html).toContain('aria-label="1 in deck"');
    expect(html).not.toContain('aria-label="0 in deck"');
  });

  it("mounts deck analysis whenever the deck has commanders or cards, including List mode", () => {
    const html = render();
    expect(html).toContain("alt-deck-overview");
    expect(html).toContain('aria-label="Deck analysis"');
    expect(html).toContain("deck-analysis");
    expect(render({ viewMode: "list" })).toContain("deck-analysis");
    expect(render({ cards: [], commanderNames: [] })).not.toContain(
      "deck-analysis",
    );
  });

  it("groups deck contents in four-group order with additive copy totals", () => {
    const cards = [
      ...deck,
      { id: "d3", deckId: "deck", name: "Ajani", qty: 2, isBasic: false },
      { id: "d4", deckId: "deck", name: "Sol Ring", qty: 3, isBasic: false },
    ];
    const html = render({ cards });
    const order = [
      "alt-deck-contents-creature",
      "alt-deck-contents-spell",
      "alt-deck-contents-permanent",
      "alt-deck-contents-land",
    ].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("2 copies · 1 names");
    expect(html).toContain("3 copies · 1 names");
    expect(html).toContain("1 copies · 1 names");
    expect(html).toContain("7 copies · 1 names");
    expect([2, 3, 1, 7].reduce((sum, qty) => sum + qty, 0)).toBe(
      cards.reduce((sum, card) => sum + card.qty, 0),
    );
    expect(html).toContain('aria-label="Deck editor type filters"');
  });

  it("uses persisted disclosure IDs with the shared bulk control", () => {
    const storage = memoryStorage();
    writeIdSet(
      storage,
      ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY,
      new Set(["creature", "spell", "bogus"]),
    );
    expect(storage.data.get(ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY)).toBe(
      '["creature","spell","bogus"]',
    );
    expect([
      ...readIdSet(storage, ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY, [
        "creature",
        "spell",
        "permanent",
        "land",
      ]),
    ]).toEqual(["creature", "spell"]);
    const html = render({ initialContentsCollapsed: ["spell", "land"] });
    expect(html).toContain("Collapse all");
    expect(html).toMatch(
      /id="alt-deck-contents-spell"[\s\S]*?aria-expanded="false"/,
    );
  });

  it("renders mana symbols (including split faces) and rarity in list rows", () => {
    const html = render({ viewMode: "list" });
    expect(html).toContain("alt-deck-list-name");
    expect(html).toContain('class="alt-deck-list-details"');
    expect(html).toContain('aria-label="1 copies in deck">1×');
    expect(html).toContain("Instant");
    expect(html).toMatch(
      /aria-pressed="false">Images<\/button><button type="button" aria-pressed="true">List/,
    );
    expect(html).toContain("ms ms-2 ms-cost");
    expect(html).toContain("ms ms-wu ms-cost");
    expect(html).toContain('class="mana-sep"');
    expect(html).toMatch(
      /<span class="alt-deck-rarity" title="rare"><i class="alt-gem alt-rarity-rare"><\/i>R<\/span>/,
    );
  });

  it("keeps the Alt off-color toggle, legality status and commander modal trigger", () => {
    const html = render({ hiddenPoolCount: 3 });
    expect(html).toContain("Show off-color (3)");
    expect(html).toContain("Color identity: no conflicts");
    expect(html).toContain("Change commanders");
  });

  it("uses commander art as the overview hero without repeating its name", () => {
    const html = render();
    expect(html).toMatch(
      /class="alt-deck-commander-card" aria-label="Commander: Ajani"><div>.*?<\/div><\/div>/,
    );
    expect(html).not.toMatch(
      /class="alt-deck-commander-card"[^>]*>.*?<strong>Ajani<\/strong>/,
    );
  });
});
