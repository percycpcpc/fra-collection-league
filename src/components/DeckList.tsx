"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isNotFound, jsonFetch, type CatalogCard, type CollectionCard, type DeckSummary } from "@/lib/client";
import { commanderCandidates } from "@/lib/commander-selection";
import { deckBanner } from "@/lib/deck-banner";
import { parseCommanderNames, resolveCommanderIdentity } from "@/lib/deck-identity";
import { AltCommanderField, AltDeckList, AltDeleteDeckDialog, AltNewDeckDialog } from "./AltDeckList";
import { AltPlayerPageState } from "./AltShell";
import { UiStyleToggle } from "./UiStyleToggle";
import { useUiStyle } from "./useUiStyle";
import { refreshLeaguePlayers } from "./useLeaguePlayers";
import { MutationLock } from "@/lib/mutation-lock";
import { DeckCommanderImages } from "./DeckCommanderImages";

type Data = { profile: { id: string; name: string; iconCard?: string | null }; cards: CollectionCard[]; decks: DeckSummary[] };

function commanderLabel(stored: string | null) {
  const names = parseCommanderNames(stored);
  if (!names.length) return "No commander selected";
  return `${names.length > 1 ? "Commanders" : "Commander"}: ${names.join(" & ")}`;
}

export function DeckList({ profileId }: { profileId: string }) {
  const { style, toggle } = useUiStyle();
  const [data, setData] = useState<Data | null>(null);
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState("");
  const [commander, setCommander] = useState("");
  const [partner, setPartner] = useState("");
  const [cmdQuery, setCmdQuery] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [deckQuery, setDeckQuery] = useState("");
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const newDeckOpener = useRef<HTMLElement | null>(null);
  const deleteTriggers = useRef(new Map<string, HTMLButtonElement>());
  const createLock = useRef(new MutationLock());
  const load = useCallback(() => { setLoading(true); setError(""); return jsonFetch<Data>(`/api/profiles/${profileId}`).then((result) => { setData(result); setNotFound(false); }).catch((cause) => { setError(cause.message); setNotFound(isNotFound(cause, `/api/profiles/${profileId}`)); }).finally(() => setLoading(false)); }, [profileId]);
  useEffect(() => { void load(); }, [load]);
  // The catalog carries card types, needed to find legendary creatures. Cached for an hour by the API.
  useEffect(() => { jsonFetch<CatalogCard[]>("/api/catalog").then(setCatalog).catch((cause) => setError(cause.message)); }, []);

  // Legendary creatures this player owns; the only cards offered as commanders.
  const candidates = useMemo(() => (data ? commanderCandidates(data.cards, catalog) : []), [data, catalog]);

  // Row background per deck from its commanders' color identity. Waits for the
  // catalog so decks don't flash the colorless background while identities are unknown.
  const banners = useMemo(() => {
    const out = new Map<string, ReturnType<typeof deckBanner>>();
    if (!data || catalog.length === 0) return out;
    for (const deck of data.decks) {
      out.set(deck.id, deckBanner(resolveCommanderIdentity(parseCommanderNames(deck.commander), catalog)));
    }
    return out;
  }, [data, catalog]);

  function chooseCommander(name: string) {
    setCommander(name); setCmdQuery(name); setCmdOpen(false);
    if (!name || name === partner) { setPartner(""); setPartnerQuery(""); }
  }

  function choosePartner(name: string) { setPartner(name); setPartnerQuery(name); setPartnerOpen(false); }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); const formEl = event.currentTarget;
    if (!createLock.current.tryAcquire()) return;
    setCreating(true);
    const commanders = [commander, partner].filter(Boolean);
    try {
      await jsonFetch(`/api/profiles/${profileId}/decks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: deckName, commanders }) });
      refreshLeaguePlayers().catch(() => undefined);
      setDeckName(""); setCommander(""); setPartner(""); setCmdQuery(""); setPartnerQuery(""); setCmdOpen(false); setPartnerOpen(false); setNewDeckOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create deck."); }
    finally { createLock.current.release(); setCreating(false); }
  }
  function openNewDeck() { newDeckOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setError(""); setNewDeckOpen(true); }
  function closeNewDeck() { setNewDeckOpen(false); setCmdOpen(false); setPartnerOpen(false); window.requestAnimationFrame(() => newDeckOpener.current?.focus()); }
  function closeConfirm(id: string) { setConfirmId(null); window.requestAnimationFrame(() => deleteTriggers.current.get(id)?.focus()); }
  async function remove(deckId: string) { closeConfirm(deckId); try { await jsonFetch(`/api/profiles/${profileId}/decks/${deckId}`, { method: "DELETE" }); refreshLeaguePlayers().catch(() => undefined); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete deck."); } }

  // Alt: the route id is authoritative, so another player's data still in state counts as loading.
  if (!data || (style === "alt" && data.profile.id !== profileId)) {
    if (style === "alt") return <AltPlayerPageState profileId={profileId} activeNav="decks" copy={{ loading: "Loading decks", loadingDetail: "Fetching this player's decks.", unavailable: "Decks unavailable", failed: "We couldn't load these decks" }} error={loading ? undefined : error} notFound={!loading && notFound} onRetry={() => void load()} onToggleStyle={toggle} />;
    return <main className="shell"><p className="muted">{error || "Loading decks…"}</p></main>;
  }
  const noCandidates = catalog.length > 0 && candidates.length === 0;
  const hint = catalog.length === 0
    ? "Loading commanders…"
    : noCandidates
      ? `No legendary creatures in ${data.profile.name}'s collection yet. You can still create a deck without a commander.`
      : `Choose up to 2 different legendary creatures from ${data.profile.name}'s collection.`;
  const cmdMatches = candidates.filter((name) => !cmdQuery || name.toLowerCase().includes(cmdQuery.toLowerCase()));
  const partnerMatches = candidates.filter((name) => name !== commander && (!partnerQuery || name.toLowerCase().includes(partnerQuery.toLowerCase())));
  if (style === "alt") {
    const confirmDeck = confirmId ? data.decks.find((deck) => deck.id === confirmId) : undefined;
    const dialog = newDeckOpen
      ? <AltNewDeckDialog hint={hint} error={error} creating={creating} onClose={closeNewDeck} onSubmit={create}
        nameField={<label className="alt-commander-field"><span>Deck name</span><input name="name" required value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder="New deck" data-autofocus /></label>}
        commanderFields={<>
          <AltCommanderField label={<>Commander <small>· optional</small></>} query={cmdQuery} open={cmdOpen && candidates.length > 0} options={cmdMatches} clearLabel="— No commander" placeholder={catalog.length === 0 ? "Loading…" : "Search legendary creatures…"} disabled={!candidates.length && catalog.length > 0} describedBy="alt-commander-hint" onQuery={(value) => { setCmdQuery(value); setCommander(""); setCmdOpen(true); }} onOpen={setCmdOpen} onChoose={chooseCommander} />
          <AltCommanderField label={<>Second commander <small>· optional</small></>} query={partnerQuery} open={partnerOpen} options={partnerMatches} clearLabel="— No second commander" placeholder="Search second commander…" disabled={!commander} describedBy="alt-commander-hint" onQuery={(value) => { setPartnerQuery(value); setPartner(""); setPartnerOpen(true); }} onOpen={setPartnerOpen} onChoose={choosePartner} />
        </>} />
      : confirmDeck ? <AltDeleteDeckDialog deckName={confirmDeck.name} onCancel={() => closeConfirm(confirmDeck.id)} onConfirm={() => void remove(confirmDeck.id)} /> : null;
    return <AltDeckList profileId={profileId} profileName={data.profile.name} profileIcon={data.profile.iconCard ?? null} decks={data.decks} catalog={catalog} error={error} onToggleStyle={toggle}
      query={deckQuery} onQuery={setDeckQuery} onNewDeck={openNewDeck} dialog={dialog}
      onDelete={(deck) => setConfirmId(deck.id)}
      deleteRef={(id, node) => { if (node) deleteTriggers.current.set(id, node); else deleteTriggers.current.delete(id); }} />;
  }
  return <main className="shell decks-page">
    <header className="page-heading"><div><Link className="back-link" href={`/p/${profileId}`}>← {data.profile.name}'s collection</Link><div className="eyebrow">Deck workshop</div><h1>{data.profile.name}'s decks</h1></div><span>{data.decks.length} total</span><UiStyleToggle onToggle={toggle} /></header>
    <form className="deck-create" onSubmit={create}>
      <label>Deck name<input name="name" required value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder="New deck" /></label>
      <label>Commander (optional)
        <div className="cmd-search">
          <input type="text" value={cmdQuery} onChange={(e) => { setCmdQuery(e.target.value); setCommander(""); setCmdOpen(true); }} onFocus={() => setCmdOpen(true)} onBlur={() => setTimeout(() => setCmdOpen(false), 150)} placeholder={catalog.length === 0 ? "Loading…" : "Search legendary creatures…"} autoComplete="off" disabled={!candidates.length && catalog.length > 0} aria-describedby="commander-hint" />
          {cmdOpen && candidates.length > 0 && <ul className="cmd-dropdown"><li onMouseDown={() => chooseCommander("")}>— No commander</li>{cmdMatches.map((name) => <li key={name} onMouseDown={() => chooseCommander(name)}>{name}</li>)}</ul>}
        </div>
      </label>
      <label>Second commander (optional)
        <div className="cmd-search">
          <input type="text" value={partnerQuery} onChange={(e) => { setPartnerQuery(e.target.value); setPartner(""); setPartnerOpen(true); }} onFocus={() => setPartnerOpen(true)} onBlur={() => setTimeout(() => setPartnerOpen(false), 150)} placeholder="Search second commander…" autoComplete="off" disabled={!commander} aria-describedby="commander-hint" />
          {partnerOpen && commander && <ul className="cmd-dropdown"><li onMouseDown={() => choosePartner("")}>— No second commander</li>{partnerMatches.map((name) => <li key={name} onMouseDown={() => choosePartner(name)}>{name}</li>)}</ul>}
        </div>
      </label>
      <button className="primary" type="submit" disabled={creating}>{creating ? "Creating…" : "Create deck"}</button>
      <p id="commander-hint" className="field-hint">{hint}</p>
    </form>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <section className="deck-list">{data.decks.length === 0 ? <div className="empty"><h2>No decks yet</h2><p>Create one above, then add cards from this collection.</p></div> : data.decks.map((deck) => { const banner = banners.get(deck.id); return <article className={banner ? "deck-row has-identity" : "deck-row"} key={deck.id} style={banner ? { background: banner.background } : undefined} title={banner?.label}><div className="deck-row-main"><DeckCommanderImages commander={deck.commander} catalog={catalog} variant="classic" /><div><h2>{deck.name}</h2><p>{commanderLabel(deck.commander)}</p>{banner && <span className="visually-hidden">{banner.label}</span>}</div></div><span>{deck.cardCount} card entries</span><Link className="button-link" href={`/p/${profileId}/decks/${deck.id}`}>Edit</Link>{confirmId === deck.id ? <div className="inline-confirm"><span>Delete {deck.name}?</span><button className="danger" type="button" onClick={() => void remove(deck.id)}>Confirm</button><button type="button" onClick={() => closeConfirm(deck.id)}>Cancel</button></div> : <button ref={(node) => { if (node) deleteTriggers.current.set(deck.id, node); else deleteTriggers.current.delete(deck.id); }} className="danger-ghost" type="button" onClick={() => setConfirmId(deck.id)}>Delete</button>}</article>; })}</section>
  </main>;
}
