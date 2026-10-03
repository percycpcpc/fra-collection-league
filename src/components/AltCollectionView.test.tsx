// Throwaway SSR smoke test for the Alt UI feature. Delete after verification.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AltCollectionView, collectionQuantityPatch, focusSectionToggle } from "./AltCollectionView";
import { AltSectionNav } from "./AltSectionNav";
import { CardTypeIcon } from "./CardTypeIcon";
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

function render(overrides: { search?: string; selectedName?: string | null } = {}) {
  return renderToStaticMarkup(
    <AltCollectionView
      profile={{ id: "p1", name: "Percy", iconCard: null }}
      catalog={catalog}
      cards={cards}
      importText=""
      message=""
      status="idle"
      search={overrides.search ?? ""}
      selectedName={overrides.selectedName ?? null}
      importOpen={false}
      onImportTextChange={noop}
      onSearchChange={noop}
      onSelectedNameChange={noop}
      onImportOpenChange={noop}
      onImport={noop}
      onToggleStyle={noop}
      onRename={async () => {}}
      onSaveCard={noop}
    />
  );
}

describe("AltCollectionView SSR smoke", () => {
  it("defaults to ordered type groups with typed counts, chips, and classic toggle", () => {
    const html = render();
    expect(html).toContain("Percy");
    expect(html).toContain("Collection");
    expect(html).toContain("Analytics");
    expect(html).toContain('aria-pressed="true">Type');
    expect(html).toContain('aria-pressed="false">Color');
    expect(html.indexOf("Creatures")).toBeLessThan(html.indexOf("Instants"));
    expect(html).toContain("2 cards · 1 / 2 owned");
    expect(html).toContain("1 cards · 0 / 1 owned");
    expect(html).toContain('aria-label="Collection sections"');
    expect(html).toContain('href="#alt-collection-type-creature"');
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
        search=""
        selectedName={null}
        importOpen={false}
        unsyncedCount={1}
        onImportTextChange={noop}
        onSearchChange={noop}
        onSelectedNameChange={noop}
        onImportOpenChange={noop}
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

  it("exposes card inspection separately from ownership changes", () => {
    const html = render();
    expect(html).toContain('class="alt-card-inspect"');
    expect(html).toContain('aria-label="Inspect Ajani Resolute"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Mark unowned: Ajani Resolute"');
  });

  it("alphabetizes cards within a type group", () => {
    const html = render();
    expect(html.indexOf("Aerid Konstrari")).toBeLessThan(html.indexOf("Ajani Resolute"));
  });

  it("hides zero-result sections and chips while preserving a hidden selection in the bottom bar", () => {
    const html = render({ search: "Countersculpt", selectedName: "Ajani Resolute" });
    expect(html).not.toContain('id="alt-collection-type-creature"');
    expect(html).not.toContain('href="#alt-collection-type-creature"');
    expect(html).toContain('id="alt-collection-type-instant"');
    expect(html).toContain('<strong>Ajani Resolute</strong>');
    expect(html).toContain("Quantity for Ajani Resolute");
  });

  it("renders compact chips with labels visually hidden but accessible names intact", () => {
    const html = renderToStaticMarkup(<AltSectionNav label="Collection sections" compact mode="jump" topId="top" onSelect={noop} items={[{ id: "alt-collection-type-instant", label: "Instants", count: 3, icon: <CardTypeIcon type="instant" /> }]} />);
    expect(html).toContain("alt-section-nav is-compact");
    expect(html).toContain('aria-label="Instants, 3 cards"');
    expect(html).toContain('title="Instants, 3 cards"');
    expect(html).toContain("alt-section-nav-label");
  });

  it("keeps owned state consistent with quantity changes", () => {
    expect(collectionQuantityPatch(3)).toEqual({ qty: 3, owned: true });
    expect(collectionQuantityPatch(0)).toEqual({ qty: 0, owned: false });
  });

  it("focuses a jumped section without interrupting smooth scrolling", () => {
    const focus = vi.fn();
    const section = { querySelector: vi.fn(() => ({ focus })) } as unknown as Pick<HTMLElement, "querySelector">;

    focusSectionToggle(section);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
