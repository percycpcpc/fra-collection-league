"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardImage } from "./CardImage";
import { jsonFetch, type CatalogCard, type CollectionCard } from "@/lib/client";

type ProfileData = { profile: { id: string; name: string }; cards: CollectionCard[] };
const GROUPS = ["White", "Blue", "Black", "Red", "Green", "Multi", "Colorless", "Unknown"];
const RARITY: Record<string, number> = { mythic: 0, rare: 1, uncommon: 2, common: 3 };

function colorGroup(card?: CatalogCard) {
  if (!card) return "Unknown";
  const value = card.colors.toLowerCase();
  if (value.includes(",") || value.includes("multi") || value.split(/\s+/).length > 1) return "Multi";
  return ({ white: "White", blue: "Blue", black: "Black", red: "Red", green: "Green", colorless: "Colorless" } as Record<string, string>)[value] || "Colorless";
}

export function CollectionManager({ profileId }: { profileId: string }) {
  const [profile, setProfile] = useState<ProfileData["profile"] | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [search, setSearch] = useState("");
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const saveCount = useRef(0);
  const storageKey = `fra-pending-${profileId}`;

  const load = useCallback(async () => {
    try {
      const [data, cat] = await Promise.all([jsonFetch<ProfileData>(`/api/profiles/${profileId}`), jsonFetch<CatalogCard[]>("/api/catalog")]);
      let loaded = data.cards;
      const pending = localStorage.getItem(storageKey);
      if (pending) {
        const edits = JSON.parse(pending) as Record<string, Partial<CollectionCard>>;
        loaded = loaded.map((card) => ({ ...card, ...edits[card.name] })).filter((card) => card.qty !== 0);
      }
      setProfile(data.profile); setCards(loaded); setCatalog(cat);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not load collection."); }
  }, [profileId, storageKey]);
  useEffect(() => { void load(); }, [load]);

  const catalogMap = useMemo(() => new Map(catalog.map((card) => [card.name.toLocaleLowerCase(), card])), [catalog]);
  const grouped = useMemo(() => {
    const result = new Map(GROUPS.map((group) => [group, [] as CollectionCard[]]));
    cards.filter((card) => card.name.toLowerCase().includes(search.toLowerCase())).forEach((card) => result.get(colorGroup(catalogMap.get(card.name.toLocaleLowerCase())))?.push(card));
    result.forEach((items) => items.sort((a, b) => (RARITY[catalogMap.get(a.name.toLowerCase())?.rarity.toLowerCase() || ""] ?? 9) - (RARITY[catalogMap.get(b.name.toLowerCase())?.rarity.toLowerCase() || ""] ?? 9) || a.name.localeCompare(b.name)));
    return result;
  }, [cards, catalogMap, search]);
  const ownedQty = cards.reduce((sum, card) => sum + (card.owned ? card.qty : 0), 0);
  const totalQty = cards.reduce((sum, card) => sum + card.qty, 0);

  async function saveCard(card: CollectionCard, patch: { qty?: number; owned?: boolean }) {
    const next = { ...card, ...patch };
    setCards((current) => patch.qty === 0 ? current.filter((item) => item.name !== card.name) : current.map((item) => item.name === card.name ? next : item));
    const pending = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, Partial<CollectionCard>>;
    pending[card.name] = { ...pending[card.name], qty: next.qty, owned: next.owned };
    localStorage.setItem(storageKey, JSON.stringify(pending));
    saveCount.current += 1; setStatus("saving"); setMessage("");
    try {
      await jsonFetch(`/api/profiles/${profileId}/cards`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: card.name, ...patch }) });
      const latest = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, Partial<CollectionCard>>;
      if (latest[card.name]?.qty === next.qty && latest[card.name]?.owned === next.owned) delete latest[card.name];
      if (Object.keys(latest).length) localStorage.setItem(storageKey, JSON.stringify(latest)); else localStorage.removeItem(storageKey);
      setStatus("saved");
    } catch (cause) { setStatus("error"); setMessage(cause instanceof Error ? cause.message : "Save failed."); }
    finally { saveCount.current -= 1; if (saveCount.current > 0) setStatus("saving"); }
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile) return;
    const form = new FormData(event.currentTarget); const name = String(form.get("name") || "");
    try { const data = await jsonFetch<{ profile: ProfileData["profile"] }>(`/api/profiles/${profileId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); setProfile(data.profile); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Rename failed."); }
  }

  async function runImport() {
    setMessage("");
    try { const result = await jsonFetch<{ added: number; updated: number; unknown: string[] }>(`/api/profiles/${profileId}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: importText }) }); setImportText(""); setMessage(`Imported ${result.added} new and updated ${result.updated}.${result.unknown.length ? ` Unknown: ${result.unknown.join(", ")}` : ""}`); await load(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Import failed."); }
  }

  function exportText() {
    return cards.filter((card) => card.owned).sort((a, b) => a.name.localeCompare(b.name)).map((card) => `${card.qty} ${card.name}${catalogMap.has(card.name.toLowerCase()) ? " (FRA)" : ""}`).join("\n");
  }
  async function copyOwned() { await navigator.clipboard.writeText(exportText()); setMessage("Owned list copied."); }
  function download() { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([exportText()], { type: "text/plain" })); link.download = `${profile?.name || "collection"}-FRA.txt`; link.click(); URL.revokeObjectURL(link.href); }

  if (!profile) return <main className="shell"><p className="muted">{message || "Loading collection…"}</p></main>;
  return <main className="collection-page">
    <header className="workspace-header">
      <div><Link className="back-link" href="/">← Players</Link><form className="inline-title" onSubmit={rename}><input aria-label="Profile name" name="name" defaultValue={profile.name} key={profile.name} /><button type="submit">Rename</button></form></div>
      <div className="header-stats"><strong>Owned: {ownedQty} / {totalQty}</strong><span className={`save-state ${status}`}>{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : ""}</span><Link className="primary" href={`/p/${profileId}/decks`}>Decks →</Link></div>
    </header>
    <section className="collection-tools">
      <div className="tool-row"><input className="search" type="search" placeholder="Search collection" value={search} onChange={(e) => setSearch(e.target.value)} /><button onClick={() => void copyOwned()}>Copy owned list</button><button onClick={download}>Download .txt</button></div>
      <div className="import-box"><textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={"4 Card Name (FRA)\n1 Split Card // Other Half\nUnknown Card"} /><button className="primary" onClick={() => void runImport()}>Import & merge</button></div>
      {message && <p className="notice" role="status">{message}</p>}
    </section>
    {cards.length === 0 ? <div className="empty wide"><h2>Your collection is empty</h2><p>Paste an Arena-style list above to add cards.</p></div> : GROUPS.map((group) => {
      const items = grouped.get(group) || []; if (!items.length) return null;
      const sectionOwned = items.reduce((sum, card) => sum + (card.owned ? card.qty : 0), 0); const sectionTotal = items.reduce((sum, card) => sum + card.qty, 0);
      return <section className="card-section" key={group}><h2><span>{group}</span><small>{sectionOwned} / {sectionTotal} owned</small></h2><div className="card-grid">{items.map((card) => { const info = catalogMap.get(card.name.toLowerCase()); return <article className="card-tile" key={card.name}><CardImage name={card.name} catalog={info} dimmed={!card.owned} onClick={() => void saveCard(card, { owned: !card.owned })} /><div className="card-meta"><strong title={card.name}>{card.name}</strong><span>{info?.rarity || "unknown"}</span></div><div className="stepper"><button onClick={() => void saveCard(card, { qty: Math.max(0, card.qty - 1) })} aria-label={`Decrease ${card.name}`}>−</button><b>{card.qty}</b><button onClick={() => void saveCard(card, { qty: card.qty + 1 })} aria-label={`Increase ${card.name}`}>+</button><button className="remove" onClick={() => void saveCard(card, { qty: 0 })} aria-label={`Remove ${card.name}`}>×</button></div></article>; })}</div></section>;
    })}
  </main>;
}
