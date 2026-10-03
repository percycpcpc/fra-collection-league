"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { cardImage, type CatalogCard, type CollectionCard } from "@/lib/client";
import { CARD_TYPE_GROUPS, classifyCardType } from "@/lib/card-type-groups";
import {
  ALT_COLLECTION_COLOR_COLLAPSED_STORAGE_KEY, ALT_COLLECTION_GROUPING_STORAGE_KEY,
  ALT_COLLECTION_TYPE_COLLAPSED_STORAGE_KEY, readGroupingPreference, readIdSet,
  readSectionNavCompaction, writeGroupingPreference, writeIdSet, writeSectionNavCompaction,
  type AltGrouping,
} from "@/lib/alt-group-preferences";
import { AltCardSection } from "./AltCardSection";
import { CardTypeIcon } from "./CardTypeIcon";
import { AltSectionNav } from "./AltSectionNav";
import { AltShell } from "./AltShell";

type Profile = { id: string; name: string; iconCard: string | null };
const COLOR_GROUPS = ["White", "Blue", "Black", "Red", "Green", "Multi", "Colorless"] as const;
type ColorGroup = (typeof COLOR_GROUPS)[number];
const COLOR_IDS: Record<ColorGroup, string> = { White: "white", Blue: "blue", Black: "black", Red: "red", Green: "green", Multi: "multi", Colorless: "colorless" };
const GROUP_COLORS: Record<ColorGroup, string> = { White: "#f8f6e8", Blue: "#539df5", Black: "#8a8a9a", Red: "#f3727f", Green: "#1ed760", Multi: "#e8c468", Colorless: "#b8bcc4" };

function colorGroup(card: CatalogCard): ColorGroup {
  const value = card.colors.toLowerCase();
  if (value.includes(",") || value.includes("multi") || value.split(/\s+/).length > 1) return "Multi";
  return COLOR_GROUPS.find((candidate) => candidate.toLowerCase() === value) || "Colorless";
}
function storage() { return typeof window === "undefined" ? undefined : window.localStorage; }
export function collectionQuantityPatch(qty: number) { return { qty, owned: qty > 0 }; }
export function focusSectionToggle(section: Pick<HTMLElement, "querySelector">) {
  section.querySelector<HTMLButtonElement>(".alt-card-section-toggle")?.focus({ preventScroll: true });
}

export type AltCollectionViewProps = {
  profile: Profile; catalog: CatalogCard[]; cards: CollectionCard[]; importText: string; message: string;
  status: "idle" | "saving" | "saved" | "error"; search: string; selectedName: string | null; importOpen: boolean;
  unsyncedCount?: number; importing?: boolean; onImportTextChange: (value: string) => void; onSearchChange: (value: string) => void;
  onSelectedNameChange: (value: string | null) => void; onImportOpenChange: (value: boolean) => void; onImport: () => void;
  onToggleStyle: () => void; onRename: (name: string) => Promise<void>; onSaveCard: (name: string, patch: { qty?: number; owned?: boolean }) => void;
  onRetryUnsynced?: () => void; onDiscardUnsynced?: () => void;
};

export function AltCollectionView(props: AltCollectionViewProps) {
  const { profile, catalog, cards, importText, message, status, search, selectedName, importOpen, unsyncedCount = 0, importing = false, onImportTextChange, onSearchChange, onSelectedNameChange, onImportOpenChange, onImport, onToggleStyle, onRename, onSaveCard, onRetryUnsynced, onDiscardUnsynced } = props;
  const [renaming, setRenaming] = useState(false);
  const [grouping, setGrouping] = useState<AltGrouping>("type");
  const [typeCollapsed, setTypeCollapsed] = useState<Set<string>>(new Set());
  const [colorCollapsed, setColorCollapsed] = useState<Set<string>>(new Set());
  const [searchCollapsed, setSearchCollapsed] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);
  const query = search.trim().toLowerCase();

  useEffect(() => {
    const store = storage();
    setGrouping(readGroupingPreference(store, ALT_COLLECTION_GROUPING_STORAGE_KEY));
    setTypeCollapsed(readIdSet(store, ALT_COLLECTION_TYPE_COLLAPSED_STORAGE_KEY, CARD_TYPE_GROUPS.map(({ id }) => id)));
    setColorCollapsed(readIdSet(store, ALT_COLLECTION_COLOR_COLLAPSED_STORAGE_KEY, Object.values(COLOR_IDS)));
    setCompact(readSectionNavCompaction(store).collection);
    hydrated.current = true;
  }, []);
  useEffect(() => { setSearchCollapsed(new Set()); }, [query, grouping]);
  useEffect(() => {
    const root = rootRef.current; const topbar = root?.querySelector<HTMLElement>(".alt-topbar");
    if (!root || !topbar || typeof ResizeObserver === "undefined") return;
    const update = () => root.style.setProperty("--alt-collection-topbar-h", `${topbar.offsetHeight}px`);
    update(); const observer = new ResizeObserver(update); observer.observe(topbar); return () => observer.disconnect();
  }, []);

  const collectionMap = useMemo(() => new Map(cards.map((card) => [card.name.toLowerCase(), card])), [cards]);
  const definitions = grouping === "type"
    ? CARD_TYPE_GROUPS.map((group) => ({ ...group, icon: <CardTypeIcon type={group.id} /> }))
    : COLOR_GROUPS.map((label) => ({ id: COLOR_IDS[label], label, icon: <i className="alt-collection-color-dot" style={{ background: GROUP_COLORS[label] }} /> }));
  const grouped = useMemo(() => {
    const map = new Map<string, { all: CatalogCard[]; matching: CatalogCard[] }>();
    const ids = grouping === "type" ? CARD_TYPE_GROUPS.map(({ id }) => id) : Object.values(COLOR_IDS);
    ids.forEach((id) => map.set(id, { all: [], matching: [] }));
    catalog.forEach((card) => {
      const id = grouping === "type" ? classifyCardType(card.type) : COLOR_IDS[colorGroup(card)];
      const bucket = map.get(id); if (!bucket) return;
      bucket.all.push(card); if (!query || card.name.toLowerCase().includes(query)) bucket.matching.push(card);
    });
    map.forEach((bucket) => bucket.matching.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [catalog, grouping, query]);
  const visible = definitions.filter(({ id }) => (grouped.get(id)?.matching.length || 0) > 0);
  const savedCollapsed = grouping === "type" ? typeCollapsed : colorCollapsed;
  const effectiveCollapsed = query ? searchCollapsed : savedCollapsed;
  const allCollapsed = visible.length > 0 && visible.every(({ id }) => effectiveCollapsed.has(id));
  const ownedCount = catalog.reduce((count, card) => count + (collectionMap.get(card.name.toLowerCase())?.owned ? 1 : 0), 0);
  const completion = catalog.length ? Math.round((ownedCount / catalog.length) * 100) : 0;
  const selected = catalog.find((card) => card.name === selectedName) || null;
  const selectedEntry = selected ? collectionMap.get(selected.name.toLowerCase()) : undefined;

  useEffect(() => {
    const ids = visible.map(({ id }) => `alt-collection-${grouping}-${id}`);
    if (!ids.length) { setActiveSection(null); return; }
    const update = () => {
      const boundary = rootRef.current?.querySelector<HTMLElement>(".alt-collection-sticky")?.getBoundingClientRect().bottom || 0;
      let current = ids[0];
      ids.forEach((id) => { const element = document.getElementById(id); if (element && element.getBoundingClientRect().top <= boundary + 1) current = id; });
      setActiveSection(current);
    };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [grouping, visible.map(({ id }) => id).join("|")]);

  const saveCollapsed = (next: Set<string>) => {
    if (query) { setSearchCollapsed(next); return; }
    const key = grouping === "type" ? ALT_COLLECTION_TYPE_COLLAPSED_STORAGE_KEY : ALT_COLLECTION_COLOR_COLLAPSED_STORAGE_KEY;
    if (grouping === "type") setTypeCollapsed(next); else setColorCollapsed(next);
    if (hydrated.current) writeIdSet(storage(), key, next);
  };
  const toggleSection = (id: string) => { const next = new Set(effectiveCollapsed); next.has(id) ? next.delete(id) : next.add(id); saveCollapsed(next); };
  const changeGrouping = (value: AltGrouping) => {
    setGrouping(value); if (hydrated.current) writeGroupingPreference(storage(), ALT_COLLECTION_GROUPING_STORAGE_KEY, value);
    if (typeof location !== "undefined" && location.hash.startsWith("#alt-collection-")) history.replaceState(null, "", `${location.pathname}${location.search}`);
  };
  const bulkToggle = () => { const next = new Set(effectiveCollapsed); visible.forEach(({ id }) => allCollapsed ? next.delete(id) : next.add(id)); saveCollapsed(next); };
  const jump = (sectionId: string) => {
    const id = sectionId.replace(/^alt-collection-(?:type|color)-/, "");
    if (effectiveCollapsed.has(id)) { const next = new Set(effectiveCollapsed); next.delete(id); if (query) setSearchCollapsed(next); else saveCollapsed(next); }
    history.replaceState(null, "", `#${sectionId}`);
    requestAnimationFrame(() => { const section = document.getElementById(sectionId); section?.scrollIntoView({ behavior: "smooth", block: "start" }); if (section) focusSectionToggle(section); });
  };
  useEffect(() => {
    if (!hydrated.current || !location.hash) return;
    const id = location.hash.slice(1); if (visible.some((group) => `alt-collection-${grouping}-${group.id}` === id)) jump(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouping]);

  function toggle(card: CatalogCard) { const entry = collectionMap.get(card.name.toLowerCase()); onSaveCard(card.name, entry ? { owned: !entry.owned } : { qty: 1, owned: true }); }
  function setQuantity(card: CatalogCard, qty: number) { onSaveCard(card.name, collectionQuantityPatch(qty)); }
  async function submitRename(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("name") || ""); try { await onRename(name); setRenaming(false); } catch { /* parent displays error */ } }
  function renameKeys(event: KeyboardEvent<HTMLInputElement>) { if (event.key === "Escape") { event.preventDefault(); setRenaming(false); } }

  const title = <div className="alt-profile-title-row"><h1>{profile.name}&apos;s collection</h1>{renaming ? <form className="alt-create-inline" onSubmit={(event) => void submitRename(event)}><input autoFocus name="name" aria-label="Profile name" defaultValue={profile.name} onKeyDown={renameKeys} /><button className="alt-pill alt-primary">Save</button><button className="alt-pill alt-outline" type="button" onClick={() => setRenaming(false)}>Cancel</button></form> : <button className="alt-rename" type="button" onClick={() => setRenaming(true)}>Rename profile</button>}</div>;
  const nowPlaying = <><div className="alt-progress"><span style={{ width: `${completion}%` }} /></div>{selected ? <><img src={cardImage(selected.name, selected)} alt="" /><div className="alt-now-title"><strong>{selected.name}</strong><small>{selected.rarity} · Reality Fracture</small></div><div className="alt-now-actions"><span className={selectedEntry?.owned ? "on" : ""}>Owned</span><div className="alt-stepper alt-collection-quantity" role="group" aria-label={`Quantity for ${selected.name}`}><button type="button" disabled={!selectedEntry?.qty} onClick={() => setQuantity(selected, Math.max(0, (selectedEntry?.qty || 0) - 1))} aria-label={`Decrease ${selected.name} quantity`}>−</button><b>{selectedEntry?.qty || 0}</b><button type="button" onClick={() => setQuantity(selected, (selectedEntry?.qty || 0) + 1)} aria-label={`Increase ${selected.name} quantity`}>+</button></div><button className="alt-remove-quantity" type="button" disabled={!selectedEntry?.qty} onClick={() => setQuantity(selected, 0)} aria-label={`Remove ${selected.name} from collection`}>Remove</button></div></> : <div className="alt-now-empty"><strong>Select a card</strong><small>Choose a tile to inspect its collection state</small></div>}</>;

  return <div className="alt-collection-view" ref={rootRef}><AltShell title={title} subtitle="Reality Fracture league · season 1" activeNav="collection" player={{ id: profile.id, name: profile.name, iconCard: profile.iconCard }} onToggleStyle={onToggleStyle} nowPlaying={nowPlaying} topRight={<><label className="alt-search"><span aria-hidden>⌕</span><input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search cards…" aria-label="Search cards" /></label><div className="alt-owned-counter">Owned <b>{ownedCount} / {catalog.length}</b></div><button className="alt-pill alt-outline" type="button" onClick={() => onImportOpenChange(!importOpen)} aria-expanded={importOpen}>Import &amp; merge</button></>}>
    <div id="alt-collection-top" />
    {importOpen && <section className="alt-import" aria-label="Import collection"><textarea value={importText} onChange={(event) => onImportTextChange(event.target.value)} placeholder={"Paste a card list\n1 Card Name (FRA)"} disabled={importing} /><button className="alt-pill alt-primary" type="button" onClick={onImport} disabled={importing}>{importing ? "Importing…" : "Import & merge"}</button></section>}
    {unsyncedCount > 0 && <div className="alt-unsynced" role="alert"><span><strong>{unsyncedCount} unsynced {unsyncedCount === 1 ? "change" : "changes"}</strong> recovered from this browser. These values are pending until the server confirms them.</span><div><button className="alt-pill alt-primary" type="button" onClick={onRetryUnsynced} disabled={status === "saving"}>Retry</button><button className="alt-pill alt-outline" type="button" onClick={onDiscardUnsynced} disabled={status === "saving"}>Discard</button></div></div>}
    {(message || status === "saving") && <p className={`alt-notice ${status}`} role="status">{status === "saving" ? "Saving…" : message}</p>}
    <div className="alt-collection-sticky"><div className="alt-collection-toolbar"><div className="alt-collection-grouping" role="group" aria-label="Group collection by"><span>Group by:</span><button type="button" aria-pressed={grouping === "type"} onClick={() => changeGrouping("type")}>Type</button><button type="button" aria-pressed={grouping === "color"} onClick={() => changeGrouping("color")}>Color</button></div><button className="alt-pill alt-outline" type="button" disabled={!visible.length} onClick={bulkToggle}>{allCollapsed ? "Expand all" : "Collapse all"}</button><button className="alt-pill alt-outline" type="button" aria-pressed={compact} aria-label="Compact section navigation (hides labels)" title="Hides section labels; icons and counts remain" onClick={() => { const next = !compact; setCompact(next); if (hydrated.current) { const preference = readSectionNavCompaction(storage()); writeSectionNavCompaction(storage(), { ...preference, collection: next }); } }}>Compact section navigation</button></div>
      <AltSectionNav label="Collection sections" compact={compact} mode="jump" topId="alt-collection-top" activeId={activeSection} onSelect={jump} items={visible.map((group) => ({ ...group, count: grouped.get(group.id)?.matching.length || 0, id: `alt-collection-${grouping}-${group.id}` }))} />
    </div>
    <div className="alt-groups alt-collection-groups">
      {catalog.length > 0 && visible.length === 0 && <section className="alt-page-section"><h2>No cards found</h2><p className="alt-field-hint">No cards match “{search}”. Clear or change the search to browse the collection.</p></section>}
      {visible.map((group) => { const bucket = grouped.get(group.id)!; const owned = bucket.all.filter((card) => collectionMap.get(card.name.toLowerCase())?.owned).length; return <AltCardSection key={group.id} id={`alt-collection-${grouping}-${group.id}`} title={group.label} icon={group.icon} count={`${bucket.matching.length} cards · ${owned} / ${bucket.all.length} owned`} collapsed={effectiveCollapsed.has(group.id)} onToggle={() => toggleSection(group.id)} headingLevel={2}><div className="alt-collection-card-grid">{bucket.matching.map((card) => { const entry = collectionMap.get(card.name.toLowerCase()); const isOwned = entry?.owned === true; const isSelected = selectedName === card.name; return <article className={`alt-card ${isOwned ? "owned" : "unowned"} ${isSelected ? "selected" : ""}`} key={card.name} onClick={() => onSelectedNameChange(card.name)}><div className="alt-card-visual"><button className="alt-card-inspect" type="button" aria-label={`Inspect ${card.name}`} aria-pressed={isSelected} onClick={() => onSelectedNameChange(card.name)}><img src={cardImage(card.name, card)} alt="" loading="lazy" /></button><span className={`alt-rarity alt-rarity-${card.rarity.toLowerCase()}`}><i />{card.rarity}</span><button className="alt-card-toggle" type="button" aria-label={`${isOwned ? "Mark unowned" : "Mark owned"}: ${card.name}`} onClick={(event) => { event.stopPropagation(); toggle(card); }}>{isOwned ? "✓" : "+"}</button></div><strong title={card.name} aria-label={card.name}>{card.name}</strong><small><i className={`alt-gem alt-rarity-${card.rarity.toLowerCase()}`} />{card.rarity} · ×{entry?.qty || 0}</small></article>; })}</div></AltCardSection>; })}
    </div>
  </AltShell></div>;
}
