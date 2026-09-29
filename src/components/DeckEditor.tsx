"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardImage } from "./CardImage";
import { jsonFetch, type CatalogCard, type CollectionCard, type DeckCard } from "@/lib/client";

type ProfileData = { profile: { name: string }; cards: CollectionCard[] };
type DeckData = { deck: { id: string; name: string; commander: string | null }; cards: DeckCard[] };
const BASICS = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
const COLORS = ["White", "Blue", "Black", "Red", "Green", "Multi", "Colorless"];
const RARITY: Record<string, number> = { mythic: 0, rare: 1, uncommon: 2, common: 3 };

function colorGroup(card?: CatalogCard) {
  const value = card?.colors.toLowerCase() || "colorless";
  if (value.includes(",") || value.includes("multi") || value.split(/\s+/).length > 1) return "Multi";
  return ({ white: "White", blue: "Blue", black: "Black", red: "Red", green: "Green", colorless: "Colorless" } as Record<string, string>)[value] || "Colorless";
}

function GalleryCard({ name, catalog, qty, owned, cap, commander, onQty, onCommander, imageAdds = false }: { name: string; catalog?: CatalogCard; qty: number; owned?: number; cap: number; commander: boolean; onQty: (qty: number) => void; onCommander: () => void; imageAdds?: boolean }) {
  const capped = qty >= cap;
  return <article className={`deck-card-tile card-tile ${commander ? "is-commander" : ""} ${capped && imageAdds ? "at-cap" : ""}`} tabIndex={0}>
    <div className="deck-card-visual">
      <CardImage name={name} catalog={catalog} onClick={imageAdds && !capped ? () => onQty(qty + 1) : undefined} ariaLabel={imageAdds ? `Add ${name} to deck` : undefined} />
      {qty > 0 && <span className="deck-qty-badge" aria-label={`${qty} in deck`}>{qty}</span>}
      <div className="deck-card-overlay"><span>{qty} in deck{owned !== undefined ? ` · ${owned} owned` : ""}</span><div className="deck-card-actions">
        <div className="mini-stepper"><button type="button" onClick={() => onQty(Math.max(0, qty - 1))} disabled={qty === 0} aria-label={`Decrease ${name}`}>−</button><b>{qty}</b><button type="button" onClick={() => onQty(qty + 1)} disabled={capped} aria-label={`Increase ${name}`}>+</button></div>
        <button type="button" className={`commander-star ${commander ? "active" : ""}`} onClick={onCommander} aria-label={`Set commander ${name}`} aria-pressed={commander}>★</button>
      </div></div>
    </div>
    <div className="card-meta"><strong title={name}>{name}</strong>{catalog && <span className={`rarity-gem rarity-${catalog.rarity.toLowerCase()}`}>{catalog.rarity}</span>}</div>
  </article>;
}

export function DeckEditor({ profileId, deckId }: { profileId: string; deckId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null); const [deck, setDeck] = useState<DeckData | null>(null); const [catalog, setCatalog] = useState<CatalogCard[]>([]); const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [error, setError] = useState(""); const saves = useRef(0);
  const load = useCallback(async () => { try { const [p, d, c] = await Promise.all([jsonFetch<ProfileData>(`/api/profiles/${profileId}`), jsonFetch<DeckData>(`/api/profiles/${profileId}/decks/${deckId}`), jsonFetch<CatalogCard[]>("/api/catalog")]); setProfile(p); setDeck(d); setCatalog(c); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load deck."); } }, [profileId, deckId]);
  useEffect(() => { void load(); }, [load]);
  const catalogMap = useMemo(() => new Map(catalog.map((card) => [card.name.toLowerCase(), card])), [catalog]);
  const deckMap = useMemo(() => new Map((deck?.cards || []).map((card) => [card.name.toLowerCase(), card])), [deck]);

  async function saveDeck(patch: { name?: string; commander?: string | null }) {
    if (!deck) return; setDeck({ ...deck, deck: { ...deck.deck, ...patch } }); setStatus("Saving…"); setError("");
    try { await jsonFetch(`/api/profiles/${profileId}/decks/${deckId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); setStatus("Saved"); } catch (cause) { setStatus(""); setError(cause instanceof Error ? cause.message : "Save failed."); }
  }
  async function saveCard(name: string, qty: number) {
    if (!deck) return; const current = deckMap.get(name.toLowerCase());
    const nextCards = qty === 0 ? deck.cards.filter((card) => card.name.toLowerCase() !== name.toLowerCase()) : current ? deck.cards.map((card) => card.name.toLowerCase() === name.toLowerCase() ? { ...card, qty } : card) : [...deck.cards, { id: `temp-${name}`, deckId, name, qty, isBasic: BASICS.some((basic) => basic.toLowerCase() === name.toLowerCase()) }];
    setDeck({ ...deck, cards: nextCards }); saves.current += 1; setStatus("Saving…"); setError("");
    try { await jsonFetch(`/api/profiles/${profileId}/decks/${deckId}/cards`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, qty }) }); setStatus("Saved"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); await load(); } finally { saves.current -= 1; if (saves.current > 0) setStatus("Saving…"); }
  }
  function rename(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void saveDeck({ name: String(new FormData(event.currentTarget).get("name") || "") }); }

  if (!profile || !deck) return <main className="shell"><p className="muted">{error || "Loading deck…"}</p></main>;
  const owned = profile.cards.filter((card) => card.owned).sort((a, b) => a.name.localeCompare(b.name)); const ownedMap = new Map(owned.map((card) => [card.name.toLowerCase(), card]));
  const total = deck.cards.reduce((sum, card) => sum + card.qty, 0); const groups: Record<string, DeckCard[]> = { Creatures: [], Other: [], Lands: [] };
  deck.cards.forEach((card) => { const type = catalogMap.get(card.name.toLowerCase())?.type.toLowerCase() || ""; groups[type.includes("land") || card.isBasic ? "Lands" : type.includes("creature") ? "Creatures" : "Other"].push(card); });
  const poolGroups = new Map(COLORS.map((group) => [group, [] as CollectionCard[]]));
  owned.filter((card) => !BASICS.some((basic) => basic.toLowerCase() === card.name.toLowerCase()) && card.name.toLowerCase().includes(search.toLowerCase())).forEach((card) => poolGroups.get(colorGroup(catalogMap.get(card.name.toLowerCase())))?.push(card));
  poolGroups.forEach((items) => items.sort((a, b) => (RARITY[catalogMap.get(a.name.toLowerCase())?.rarity.toLowerCase() || ""] ?? 9) - (RARITY[catalogMap.get(b.name.toLowerCase())?.rarity.toLowerCase() || ""] ?? 9) || a.name.localeCompare(b.name)));
  const setCommander = (name: string) => void saveDeck({ commander: deck.deck.commander?.toLowerCase() === name.toLowerCase() ? null : name });
  const deckTile = (card: DeckCard) => <GalleryCard key={card.name} name={card.name} catalog={catalogMap.get(card.name.toLowerCase())} qty={card.qty} owned={card.isBasic ? undefined : ownedMap.get(card.name.toLowerCase())?.qty || 0} cap={card.isBasic ? 99 : ownedMap.get(card.name.toLowerCase())?.qty || 0} commander={deck.deck.commander?.toLowerCase() === card.name.toLowerCase()} onQty={(qty) => void saveCard(card.name, qty)} onCommander={() => setCommander(card.name)} />;

  return <main className="deck-editor"><header className="workspace-header"><div><Link className="back-link" href={`/p/${profileId}/decks`}>← Back to decks</Link><form className="inline-title" onSubmit={rename}><input name="name" aria-label="Deck name" defaultValue={deck.deck.name} key={deck.deck.name} /><button>Rename</button></form></div><div className="header-stats"><strong>{total} cards · commander excluded</strong><span className={`save-state ${status.toLowerCase()}`}>{status}</span></div></header>
    {error && <p className="error-banner deck-error" role="alert">{error}</p>}<div className="editor-columns">
      <section className="deck-contents"><div className="panel-title"><h2>Deck</h2><span>{total} cards · commander excluded</span></div>
        {deck.deck.commander && <section className="deck-group"><h3><span>★ Commander</span><small>1</small></h3><div className="deck-grid"><GalleryCard name={deck.deck.commander} catalog={catalogMap.get(deck.deck.commander.toLowerCase())} qty={deckMap.get(deck.deck.commander.toLowerCase())?.qty || 0} owned={ownedMap.get(deck.deck.commander.toLowerCase())?.qty} cap={ownedMap.get(deck.deck.commander.toLowerCase())?.qty || 0} commander onQty={(qty) => void saveCard(deck.deck.commander!, qty)} onCommander={() => setCommander(deck.deck.commander!)} /></div></section>}
        {Object.entries(groups).map(([group, items]) => items.length ? <section className="deck-group" key={group}><h3><span>{group}</span><small>{items.reduce((sum, card) => sum + card.qty, 0)}</small></h3><div className="deck-grid">{items.sort((a, b) => a.name.localeCompare(b.name)).map(deckTile)}</div></section> : null)}
      </section>
      <aside className="add-panel"><div className="panel-title pool-title"><h2>Your collection</h2><input className="search" type="search" placeholder="Search owned cards" aria-label="Search owned cards" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {COLORS.map((group) => { const items = poolGroups.get(group) || []; return items.length ? <section className="pool-section" key={group}><h3><span>{group}</span><small>{items.length} owned</small></h3><div className="pool-grid">{items.map((card) => { const qty = deckMap.get(card.name.toLowerCase())?.qty || 0; return <GalleryCard key={card.name} name={card.name} catalog={catalogMap.get(card.name.toLowerCase())} qty={qty} owned={card.qty} cap={card.qty} commander={deck.deck.commander?.toLowerCase() === card.name.toLowerCase()} imageAdds onQty={(next) => void saveCard(card.name, next)} onCommander={() => setCommander(card.name)} />; })}</div></section> : null; })}
        <section className="pool-section basic-block"><h3><span>Basic lands</span><small>Unlimited · max 99</small></h3><div className="pool-grid">{BASICS.filter((name) => name.toLowerCase().includes(search.toLowerCase())).map((name) => { const qty = deckMap.get(name.toLowerCase())?.qty || 0; return <GalleryCard key={name} name={name} catalog={catalogMap.get(name.toLowerCase())} qty={qty} cap={99} commander={deck.deck.commander?.toLowerCase() === name.toLowerCase()} imageAdds onQty={(next) => void saveCard(name, next)} onCommander={() => setCommander(name)} />; })}</div></section>
      </aside>
    </div></main>;
}
