"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { jsonFetch, type CollectionCard, type DeckSummary } from "@/lib/client";

type Data = { profile: { name: string }; cards: CollectionCard[]; decks: DeckSummary[] };

export function DeckList({ profileId }: { profileId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const deleteTriggers = useRef(new Map<string, HTMLButtonElement>());
  const load = useCallback(() => jsonFetch<Data>(`/api/profiles/${profileId}`).then(setData).catch((cause) => setError(cause.message)), [profileId]);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); const formEl = event.currentTarget;
    try { await jsonFetch(`/api/profiles/${profileId}/decks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), commander: form.get("commander") || null }) }); formEl.reset(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create deck."); }
  }
  function closeConfirm(id: string) { setConfirmId(null); window.requestAnimationFrame(() => deleteTriggers.current.get(id)?.focus()); }
  async function remove(deckId: string) { closeConfirm(deckId); try { await jsonFetch(`/api/profiles/${profileId}/decks/${deckId}`, { method: "DELETE" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete deck."); } }

  if (!data) return <main className="shell"><p className="muted">{error || "Loading decks…"}</p></main>;
  const owned = data.cards.filter((card) => card.owned);
  return <main className="shell decks-page">
    <header className="page-heading"><div><Link className="back-link" href={`/p/${profileId}`}>← {data.profile.name}’s collection</Link><div className="eyebrow">Deck workshop</div><h1>{data.profile.name}’s decks</h1></div><span>{data.decks.length} total</span></header>
    <form className="deck-create" onSubmit={create}><label>Deck name<input name="name" required placeholder="New deck" /></label><label>Commander (optional)<select name="commander" defaultValue=""><option value="">No commander</option>{owned.map((card) => <option key={card.name} value={card.name}>{card.name}</option>)}</select></label><button className="primary" type="submit">Create deck</button></form>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <section className="deck-list">{data.decks.length === 0 ? <div className="empty"><h2>No decks yet</h2><p>Create one above, then add cards from this collection.</p></div> : data.decks.map((deck) => <article className="deck-row" key={deck.id}><div><h2>{deck.name}</h2><p>{deck.commander ? `Commander: ${deck.commander}` : "No commander selected"}</p></div><span>{deck.cardCount} card entries</span><Link className="button-link" href={`/p/${profileId}/decks/${deck.id}`}>Edit</Link>{confirmId === deck.id ? <div className="inline-confirm"><span>Delete {deck.name}?</span><button className="danger" type="button" onClick={() => void remove(deck.id)}>Confirm</button><button type="button" onClick={() => closeConfirm(deck.id)}>Cancel</button></div> : <button ref={(node) => { if (node) deleteTriggers.current.set(deck.id, node); else deleteTriggers.current.delete(deck.id); }} className="danger-ghost" type="button" onClick={() => setConfirmId(deck.id)}>Delete</button>}</article>)}</section>
  </main>;
}
