"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { cardImage, type CatalogCard, type CollectionCard } from "@/lib/client";
import { AltShell } from "./AltShell";
import { useLeaguePlayers } from "./useLeaguePlayers";

type Profile = { id: string; name: string; iconCard: string | null };
const GROUPS = ["White", "Blue", "Black", "Red", "Green", "Multi", "Colorless"] as const;
const GROUP_COLORS: Record<(typeof GROUPS)[number], string> = {
  White: "#f8f6e8", Blue: "#539df5", Black: "#8a8a9a", Red: "#f3727f",
  Green: "#1ed760", Multi: "#e8c468", Colorless: "#b8bcc4",
};
const AVATAR_COLORS = ["#1ed760", "#e8c468", "#539df5", "#f3727f", "#b48cf2"];

function colorGroup(card: CatalogCard): (typeof GROUPS)[number] {
  const value = card.colors.toLowerCase();
  if (value.includes(",") || value.includes("multi") || value.split(/\s+/).length > 1) return "Multi";
  const group = GROUPS.find((candidate) => candidate.toLowerCase() === value);
  return group || "Colorless";
}

export function collectionQuantityPatch(qty: number) {
  return { qty, owned: qty > 0 };
}

export type AltCollectionViewProps = {
  profile: Profile;
  catalog: CatalogCard[];
  cards: CollectionCard[];
  importText: string;
  message: string;
  status: "idle" | "saving" | "saved" | "error";
  unsyncedCount?: number;
  onImportTextChange: (value: string) => void;
  onImport: () => void;
  onToggleStyle: () => void;
  onRename: (name: string) => Promise<void>;
  onSaveCard: (name: string, patch: { qty?: number; owned?: boolean }) => void;
  onRetryUnsynced?: () => void;
  onDiscardUnsynced?: () => void;
};

export function AltCollectionView({ profile, catalog, cards, importText, message, status, unsyncedCount = 0, onImportTextChange, onImport, onToggleStyle, onRename, onSaveCard, onRetryUnsynced, onDiscardUnsynced }: AltCollectionViewProps) {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { players } = useLeaguePlayers(profile);

  const collectionMap = useMemo(() => new Map(cards.map((card) => [card.name.toLowerCase(), card])), [cards]);
  const groups = useMemo(() => {
    const result = new Map<(typeof GROUPS)[number], CatalogCard[]>(GROUPS.map((group) => [group, []]));
    const query = search.trim().toLowerCase();
    catalog.forEach((card) => {
      if (!query || card.name.toLowerCase().includes(query)) result.get(colorGroup(card))?.push(card);
    });
    return result;
  }, [catalog, search]);
  const ownedCount = catalog.reduce((count, card) => count + (collectionMap.get(card.name.toLowerCase())?.owned ? 1 : 0), 0);
  const completion = catalog.length ? Math.round((ownedCount / catalog.length) * 100) : 0;
  const selected = catalog.find((card) => card.name === selectedName) || null;
  const selectedEntry = selected ? collectionMap.get(selected.name.toLowerCase()) : undefined;
  const shellPlayers = players;

  function toggle(card: CatalogCard) {
    const entry = collectionMap.get(card.name.toLowerCase());
    onSaveCard(card.name, entry ? { owned: !entry.owned } : { qty: 1, owned: true });
  }

  function setQuantity(card: CatalogCard, qty: number) {
    onSaveCard(card.name, collectionQuantityPatch(qty));
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "");
    try { await onRename(name); setRenaming(false); }
    catch { /* The parent surfaces the API error and leaves the form open. */ }
  }

  function renameKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); setRenaming(false); }
  }

  const title = <div className="alt-profile-title-row"><h1>{profile.name}&apos;s collection</h1>{renaming ? <form className="alt-create-inline" onSubmit={(event) => void submitRename(event)}><input autoFocus name="name" aria-label="Profile name" defaultValue={profile.name} onKeyDown={renameKeys} /><button className="alt-pill alt-primary">Save</button><button className="alt-pill alt-outline" type="button" onClick={() => setRenaming(false)}>Cancel</button></form> : <button className="alt-rename" type="button" onClick={() => setRenaming(true)}>Rename profile</button>}</div>;

  const nowPlaying = <><div className="alt-progress"><span style={{ width: `${completion}%` }} /></div>{selected ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={cardImage(selected.name, selected)} alt="" /><div className="alt-now-title"><strong>{selected.name}</strong><small>{selected.rarity} · Reality Fracture</small></div><div className="alt-now-actions"><span className={selectedEntry?.owned ? "on" : ""}>Owned</span><div className="alt-stepper alt-collection-quantity" role="group" aria-label={`Quantity for ${selected.name}`}><button type="button" disabled={!selectedEntry?.qty} onClick={() => setQuantity(selected, Math.max(0, (selectedEntry?.qty || 0) - 1))} aria-label={`Decrease ${selected.name} quantity`}>−</button><b>{selectedEntry?.qty || 0}</b><button type="button" onClick={() => setQuantity(selected, (selectedEntry?.qty || 0) + 1)} aria-label={`Increase ${selected.name} quantity`}>+</button></div><button className="alt-remove-quantity" type="button" disabled={!selectedEntry?.qty} onClick={() => setQuantity(selected, 0)} aria-label={`Remove ${selected.name} from collection`}>Remove</button></div></> : <div className="alt-now-empty"><strong>Select a card</strong><small>Choose a tile to inspect its collection state</small></div>}</>;

  return <AltShell title={title} subtitle="Reality Fracture league · season 1" activeNav="collection" playerId={profile.id} players={shellPlayers} onToggleStyle={onToggleStyle} nowPlaying={nowPlaying} topRight={<>
        <label className="alt-search"><span aria-hidden>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cards…" aria-label="Search cards" /></label>
        <div className="alt-owned-counter">Owned <b>{ownedCount} / {catalog.length}</b></div>
        <button className="alt-pill alt-outline" type="button" onClick={() => setImportOpen((open) => !open)} aria-expanded={importOpen}>Import &amp; merge</button>
      </>}>
      {importOpen && <section className="alt-import" aria-label="Import collection">
        <textarea value={importText} onChange={(event) => onImportTextChange(event.target.value)} placeholder={"Paste a card list\n1 Card Name (FRA)"} />
        <button className="alt-pill alt-primary" type="button" onClick={onImport}>Import &amp; merge</button>
      </section>}
      {unsyncedCount > 0 && <div className="alt-unsynced" role="alert">
        <span><strong>{unsyncedCount} unsynced {unsyncedCount === 1 ? "change" : "changes"}</strong> recovered from this browser. These values are pending until the server confirms them.</span>
        <div><button className="alt-pill alt-primary" type="button" onClick={onRetryUnsynced} disabled={status === "saving"}>Retry</button><button className="alt-pill alt-outline" type="button" onClick={onDiscardUnsynced} disabled={status === "saving"}>Discard</button></div>
      </div>}
      {(message || status === "saving") && <p className={`alt-notice ${status}`} role="status">{status === "saving" ? "Saving…" : message}</p>}

      <div className="alt-groups">
        {GROUPS.map((group) => {
          const items = groups.get(group) || [];
          if (!items.length) return null;
          const total = catalog.filter((card) => colorGroup(card) === group).length;
          const owned = catalog.filter((card) => colorGroup(card) === group && collectionMap.get(card.name.toLowerCase())?.owned).length;
          return <section className="alt-section" key={group}>
            <div className="alt-section-head"><h2><i style={{ background: GROUP_COLORS[group] }} />{group}</h2><span>{owned} / {total} owned</span></div>
            <div className="alt-card-row">
              {items.map((card) => {
                const entry = collectionMap.get(card.name.toLowerCase());
                const isOwned = entry?.owned === true;
                return <article className={`alt-card ${isOwned ? "owned" : "unowned"} ${selectedName === card.name ? "selected" : ""}`} key={card.name} onClick={() => setSelectedName(card.name)}>
                  <div className="alt-card-visual">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cardImage(card.name, card)} alt={card.name} loading="lazy" />
                    <span className={`alt-rarity alt-rarity-${card.rarity.toLowerCase()}`}><i />{card.rarity}</span>
                    <button className="alt-card-toggle" type="button" aria-label={`${isOwned ? "Mark unowned" : "Mark owned"}: ${card.name}`} onClick={(event) => { event.stopPropagation(); toggle(card); }}>{isOwned ? "✓" : "+"}</button>
                  </div>
                  <strong title={card.name}>{card.name}</strong>
                  <small><i className={`alt-gem alt-rarity-${card.rarity.toLowerCase()}`} />{card.rarity} · ×{entry?.qty || 0}</small>
                </article>;
              })}
            </div>
          </section>;
        })}
      </div>
  </AltShell>;
}
