// Throwaway SSR smoke test for the Alt UI feature. Delete after verification.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AltCollectionView, collectionQuantityPatch } from "./AltCollectionView";
import type { CatalogCard, CollectionCard } from "@/lib/client";

const catalog: CatalogCard[] = [
  { name: "Ajani Resolute", qty: 1, img: "https://example.com/a.jpg", rarity: "rare", colors: "white", type: "Creature", colorIdentity: "w", manaCost: "" },
  { name: "Countersculpt", qty: 1, img: "https://example.com/b.jpg", rarity: "uncommon", colors: "blue", type: "Instant", colorIdentity: "u", manaCost: "" },
  { name: "Aerid Konstrari", qty: 1, img: "https://example.com/c.jpg", rarity: "mythic", colors: "green, blue", type: "Creature", colorIdentity: "gu", manaCost: "" },
];
const cards: CollectionCard[] = [
  { id: "c1", profileId: "p1", name: "Ajani Resolute", qty: 2, owned: true },
  { id: "c2", profileId: "p1", name: "Countersculpt", qty: 0, owned: false },
];

const noop = () => {};

function render() {
  return renderToStaticMarkup(
    <AltCollectionView
      profile={{ id: "p1", name: "Percy", iconCard: null }}
      catalog={catalog}
      cards={cards}
      importText=""
      message=""
      status="idle"
      onImportTextChange={noop}
      onImport={noop}
      onToggleStyle={noop}
      onRename={async () => {}}
      onSaveCard={noop}
    />
  );
}

describe("AltCollectionView SSR smoke", () => {
  it("renders shell, WUBRG groups, card tiles, and classic toggle", () => {
    const html = render();
    expect(html).toContain("Percy");
    expect(html).toContain("Collection");
    expect(html).toContain("Analytics");
    expect(html).toContain("White");
    expect(html).toContain("Blue");
    expect(html).toContain("Ajani Resolute");
    expect(html).toContain("Countersculpt");
    expect(html).toContain("Aerid Konstrari");
    expect(html).toContain("Classic");
    expect(html).toContain("Rename profile");
    expect(html).toContain("alt-ui-root");
  });

  it("makes recovered collection edits visibly unsynced and recoverable", () => {
    const html = renderToStaticMarkup(
      <AltCollectionView
        profile={{ id: "p1", name: "Percy", iconCard: null }}
        catalog={catalog}
        cards={cards}
        importText=""
        message=""
        status="idle"
        unsyncedCount={1}
        onImportTextChange={noop}
        onImport={noop}
        onToggleStyle={noop}
        onRename={async () => {}}
        onSaveCard={noop}
        onRetryUnsynced={noop}
        onDiscardUnsynced={noop}
      />
    );

    expect(html).toContain("1 unsynced change");
    expect(html).toContain("Retry");
    expect(html).toContain("Discard");
  });

  it("marks unowned cards dim and owned cards full", () => {
    const html = render();
    const counterIdx = html.indexOf("Countersculpt");
    const slice = html.slice(Math.max(0, counterIdx - 800), counterIdx);
    expect(slice).toContain("unowned");
  });

  it("groups multicolor cards under Multi", () => {
    const html = render();
    expect(html).toContain("Multi");
  });

  it("keeps owned state consistent with quantity changes", () => {
    expect(collectionQuantityPatch(3)).toEqual({ qty: 3, owned: true });
    expect(collectionQuantityPatch(0)).toEqual({ qty: 0, owned: false });
  });
});
