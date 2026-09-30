"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cardImage, jsonFetch, type CatalogCard, type CollectionCard } from "@/lib/client";

type Profile = { id: string; name: string; iconCard: string | null };
type ProfileSummary = Profile & { cardCount: number; deckCount: number };

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

export type AltCollectionViewProps = {
  profile: Profile;
  catalog: CatalogCard[];
  cards: CollectionCard[];
  importText: string;
  message: string;
  status: "idle" | "saving" | "saved" | "error";
  onImportTextChange: (value: string) => void;
  onImport: () => void;
  onToggleStyle: () => void;
  onSaveCard: (name: string, patch: { qty?: number; owned?: boolean }) => void;
};

export function AltCollectionView({ profile, catalog, cards, importText, message, status, onImportTextChange, onImport, onToggleStyle, onSaveCard }: AltCollectionViewProps) {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);

  useEffect(() => {
    jsonFetch<{ profiles: ProfileSummary[] }>("/api/profiles")
      .then((data) => setProfiles(data.profiles))
      .catch(() => setProfiles([]));
  }, []);

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

  function toggle(card: CatalogCard) {
    const entry = collectionMap.get(card.name.toLowerCase());
    onSaveCard(card.name, entry ? { owned: !entry.owned } : { qty: 1, owned: true });
  }

  return <div className="alt-ui-root">
    <aside className="alt-sidebar">
      <Link className="alt-brand" href="/"><span>F</span><div><strong>FRA League</strong><small>Reality Fracture</small></div></Link>
      <nav className="alt-nav" aria-label="League navigation">
        <Link className="active" href={`/p/${profile.id}`}>◆ <span>Collection</span></Link>
        <Link href={`/p/${profile.id}/decks`}>▦ <span>Decks</span></Link>
        <Link href="/analytics">⌁ <span>Analytics</span></Link>
        <Link href={`/p/${profile.id}/matches`}>● <span>Matches</span></Link>
      </nav>
      <div className="alt-players-label">Players</div>
      <div className="alt-players">
        {(profiles.length ? profiles : [{ ...profile, cardCount: ownedCount, deckCount: 0 }]).map((player, index) => <Link className={player.id === profile.id ? "active" : ""} href={`/p/${player.id}`} key={player.id}>
          <span className="alt-avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>{player.name.charAt(0).toUpperCase()}</span>
          <span><strong>{player.name}</strong><small>{player.cardCount} owned</small></span>
        </Link>)}
      </div>
    </aside>

    <main className="alt-main">
      <header className="alt-topbar">
        <label className="alt-search"><span aria-hidden>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cards…" aria-label="Search cards" /></label>
        <div className="alt-owned-counter">Owned <b>{ownedCount} / {catalog.length}</b></div>
        <button className="alt-pill alt-outline" type="button" onClick={() => setImportOpen((open) => !open)} aria-expanded={importOpen}>Import &amp; merge</button>
        <button className="alt-pill alt-style-toggle" type="button" onClick={onToggleStyle} aria-label="Switch to Classic UI">Classic</button>
      </header>
      {importOpen && <section className="alt-import" aria-label="Import collection">
        <textarea value={importText} onChange={(event) => onImportTextChange(event.target.value)} placeholder={"Paste a card list\n1 Card Name (FRA)"} />
        <button className="alt-pill alt-primary" type="button" onClick={onImport}>Import &amp; merge</button>
      </section>}
      {(message || status === "saving") && <p className={`alt-notice ${status}`} role="status">{status === "saving" ? "Saving…" : message}</p>}

      <div className="alt-greeting"><h1>{profile.name}&apos;s collection</h1><p>Reality Fracture league · season 1</p></div>
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
      <div className="alt-footer-space" />
    </main>

    <footer className="alt-nowbar">
      <div className="alt-progress"><span style={{ width: `${completion}%` }} /></div>
      {selected ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cardImage(selected.name, selected)} alt="" />
        <div className="alt-now-title"><strong>{selected.name}</strong><small>{selected.rarity} · Reality Fracture</small></div>
        <div className="alt-now-actions"><span className={selectedEntry?.owned ? "on" : ""}>Owned</span><span>Qty ×{selectedEntry?.qty || 0}</span><span>In deck</span><button type="button" onClick={() => toggle(selected)} aria-label={`Toggle owned status for ${selected.name}`}>{selectedEntry?.owned ? "✓" : "+"}</button></div>
      </> : <div className="alt-now-empty"><strong>Select a card</strong><small>Choose a tile to inspect its collection state</small></div>}
    </footer>
  </div>;
}
