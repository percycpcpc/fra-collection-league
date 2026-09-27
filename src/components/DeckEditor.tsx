"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsonFetch, type CatalogCard, type CollectionCard, type DeckCard } from "@/lib/client";

type ProfileData = { profile: { name: string }; cards: CollectionCard[] };
type DeckData = { deck: { id: string; name: string; commander: string | null }; cards: DeckCard[] };
const BASICS = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

export function DeckEditor({ profileId, deckId }: { profileId: string; deckId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [deck, setDeck] = useState<DeckData | null>(null);
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const saves = useRef(0);
  const load = useCallback(async () => {
    try { const [p, d, c] = await Promise.all([jsonFetch<ProfileData>(`/api/profiles/${profileId}`), jsonFetch<DeckData>(`/api/profiles/${profileId}/decks/${deckId}`), jsonFetch<CatalogCard[]>("/api/catalog")]); setProfile(p); setDeck(d); setCatalog(c); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load deck."); }
  }, [profileId, deckId]);
  useEffect(() => { void load(); }, [load]);
  const catalogMap = useMemo(() => new Map(catalog.map((card) => [card.name.toLowerCase(), card])), [catalog]);
  const deckMap = useMemo(() => new Map((deck?.cards || []).map((card) => [card.name.toLowerCase(), card])), [deck]);

  async function saveDeck(patch: { name?: string; commander?: string | null }) {
    if (!deck) return; setDeck({ ...deck, deck: { ...deck.deck, ...patch } }); setStatus("Saving…"); setError("");
    try { await jsonFetch(`/api/profiles/${profileId}/decks/${deckId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); setStatus("Saved"); }
    catch (cause) { setStatus(""); setError(cause instanceof Error ? cause.message : "Save failed."); }
  }
  async function saveCard(name: string, qty: number) {
    if (!deck) return; const current = deckMap.get(name.toLowerCase());
    const nextCards = qty === 0 ? deck.cards.filter((card) => card.name.toLowerCase() !== name.toLowerCase()) : current ? deck.cards.map((card) => card.name.toLowerCase() === name.toLowerCase() ? { ...card, qty } : card) : [...deck.cards, { id: `temp-${name}`, deckId, name, qty, isBasic: BASICS.some((basic) => basic.toLowerCase() === name.toLowerCase()) }];
    setDeck({ ...deck, cards: nextCards }); saves.current += 1; setStatus("Saving…"); setError("");
    try { await jsonFetch(`/api/profiles/${profileId}/decks/${deckId}/cards`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, qty }) }); setStatus("Saved"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); await load(); }
    finally { saves.current -= 1; if (saves.current > 0) setStatus("Saving…"); }
  }
  function rename(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("name") || ""); void saveDeck({ name: value }); }

  if (!profile || !deck) return <main className="shell"><p className="muted">{error || "Loading deck…"}</p></main>;
  const owned = profile.cards.filter((card) => card.owned).sort((a, b) => a.name.localeCompare(b.name));
  const filtered = owned.filter((card) => card.name.toLowerCase().includes(search.toLowerCase()));
  const total = deck.cards.reduce((sum, card) => sum + card.qty, 0);
  const groups: Record<string, DeckCard[]> = { Creatures: [], Other: [], Lands: [] };
  deck.cards.forEach((card) => { const type = catalogMap.get(card.name.toLowerCase())?.type.toLowerCase() || ""; groups[type.includes("land") || card.isBasic ? "Lands" : type.includes("creature") ? "Creatures" : "Other"].push(card); });
  return <main className="deck-editor">
    <header className="workspace-header"><div><Link className="back-link" href={`/p/${profileId}/decks`}>← Back to decks</Link><form className="inline-title" onSubmit={rename}><input name="name" aria-label="Deck name" defaultValue={deck.deck.name} key={deck.deck.name} /><button>Rename</button></form></div><div className="header-stats"><strong>{total} cards</strong><span className="save-state">{status}</span></div></header>
    {error && <p className="error-banner deck-error" role="alert">{error}</p>}
    <section className="commander-bar"><label>Commander<select value={deck.deck.commander || ""} onChange={(e) => void saveDeck({ commander: e.target.value || null })}><option value="">No commander</option>{owned.map((card) => <option key={card.name}>{card.name}</option>)}</select></label>{deck.deck.commander && <span className="commander-chip">★ {deck.deck.commander}</span>}</section>
    <div className="editor-columns"><section className="deck-contents"><div className="panel-title"><h2>Deck contents</h2><span>{total} cards · commander excluded</span></div>{deck.deck.commander && <div className="deck-group"><h3>Commander</h3><div className="card-line"><b>1</b><span>{deck.deck.commander}</span></div></div>}{Object.entries(groups).map(([group, items]) => items.length ? <div className="deck-group" key={group}><h3>{group} <small>{items.reduce((sum, card) => sum + card.qty, 0)}</small></h3>{items.sort((a, b) => a.name.localeCompare(b.name)).map((card) => <div className="card-line" key={card.name}><span>{card.name}</span><div className="mini-stepper"><button onClick={() => void saveCard(card.name, Math.max(0, card.qty - 1))}>−</button><b>{card.qty}</b><button onClick={() => void saveCard(card.name, card.qty + 1)} disabled={!card.isBasic && card.qty >= (owned.find((item) => item.name === card.name)?.qty || 0)}>+</button></div></div>)}</div> : null)}</section>
      <aside className="add-panel"><div className="panel-title"><h2>Add cards</h2><input type="search" placeholder="Search owned cards" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="add-list">{filtered.map((card) => { const inDeck = deckMap.get(card.name.toLowerCase())?.qty || 0; return <div className="add-row" key={card.name}><span><b>{card.name}</b><small>{inDeck} in deck · {card.qty} owned</small></span><div className="mini-stepper"><button onClick={() => void saveCard(card.name, Math.max(0, inDeck - 1))} disabled={inDeck === 0}>−</button><b>{inDeck}</b><button onClick={() => void saveCard(card.name, inDeck + 1)} disabled={inDeck >= card.qty}>+</button></div></div>; })}</div><div className="basic-block"><h3>Basic lands <small>Unlimited · max 99</small></h3>{BASICS.map((name) => { const qty = deckMap.get(name.toLowerCase())?.qty || 0; return <div className="add-row" key={name}><b>{name}</b><div className="mini-stepper"><button onClick={() => void saveCard(name, Math.max(0, qty - 1))} disabled={qty === 0}>−</button><b>{qty}</b><button onClick={() => void saveCard(name, qty + 1)} disabled={qty >= 99}>+</button></div></div>; })}</div></aside>
    </div>
  </main>;
}
