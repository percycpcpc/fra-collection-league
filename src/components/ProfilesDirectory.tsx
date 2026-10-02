"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { PlayerAvatar } from "./PlayerAvatar";
import { AltPlayersDirectory } from "./AltPlayersDirectory";
import { UiStyleToggle } from "./UiStyleToggle";
import { useUiStyle } from "./useUiStyle";
import { loadLeaguePlayers, useLeaguePlayers, type LeaguePlayer } from "./useLeaguePlayers";

export function ProfilesDirectory() {
  const { style, toggle } = useUiStyle();
  const [profiles, setProfiles] = useState<LeaguePlayer[]>([]);
  const [name, setName] = useState("");
  const [seedCommons, setSeedCommons] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const deleteTriggers = useRef(new Map<string, HTMLButtonElement>());
  const { players: sidebarPlayers, refresh } = useLeaguePlayers();

  const load = () => loadLeaguePlayers().then(setProfiles).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  const reload = () => refresh().then(setProfiles).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      await jsonFetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, seedCommons }) });
      setName(""); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create profile."); }
  }

  function closeConfirm(id: string) {
    setConfirmDelete(null);
    window.requestAnimationFrame(() => deleteTriggers.current.get(id)?.focus());
  }

  async function remove(profile: LeaguePlayer) {
    closeConfirm(profile.id); setError("");
    try {
      await jsonFetch(`/api/profiles/${profile.id}`, { method: "DELETE" });
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete profile."); }
  }

  const createForm = <form className="alt-create-inline" onSubmit={create}><input aria-label="New player name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={80} /><button className="alt-pill alt-primary" type="submit">+ New player</button></form>;
  const deleteTriggerRef = (id: string) => (node: HTMLButtonElement | null) => { if (node) deleteTriggers.current.set(id, node); else deleteTriggers.current.delete(id); };
  if (style === "alt") return <AltPlayersDirectory players={profiles} sidebarPlayers={sidebarPlayers} createForm={createForm} error={error} onToggleStyle={toggle} actions={(profile) => confirmDelete === profile.id ? <span className="alt-inline-confirm">Delete {profile.name}? <button className="alt-pill alt-danger" type="button" onClick={() => void remove(profile)}>Confirm</button><button className="alt-pill" type="button" onClick={() => closeConfirm(profile.id)}>Cancel</button></span> : <button ref={deleteTriggerRef(profile.id)} className="alt-pill alt-danger" type="button" aria-label={`Delete ${profile.name}`} onClick={() => setConfirmDelete(profile.id)}>Delete</button>} />;
  return <main className="shell directory">
    <header className="masthead"><div className="masthead-links"><div><div className="eyebrow">Reality Fracture</div><h1>Collection League</h1><p>Choose a player to manage their cards and decks.</p></div><nav><Link href="/analytics">Analytics</Link><Link href="/matches">Matches</Link><UiStyleToggle onToggle={toggle} /></nav></div></header>
    <form className="create-bar" onSubmit={create}><label htmlFor="profile-name">New player</label><input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={80} /><label className="seed-option"><input type="checkbox" checked={seedCommons} onChange={(e) => setSeedCommons(e.target.checked)} /> Start with all commons &amp; uncommons ×1</label><button className="primary" type="submit">Create profile</button></form>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <section className="profile-list" aria-label="Player profiles">
      {loading ? <p className="muted">Loading profiles…</p> : profiles.length === 0 ? <div className="empty"><h2>No players yet</h2><p>Create the first profile to start registering a collection.</p></div> : profiles.map((profile) => <div className="profile-row-wrap" key={profile.id}><Link className="profile-row" href={`/p/${profile.id}`}><PlayerAvatar name={profile.name} iconCard={profile.iconCard} size={44} /><strong>{profile.name}</strong><span>{profile.cardCount} collection entries</span><span>{profile.deckCount} decks</span><b aria-hidden>→</b></Link>{confirmDelete === profile.id ? <div className="inline-confirm"><span>Delete {profile.name}?</span><button className="danger" type="button" onClick={() => void remove(profile)}>Confirm</button><button type="button" onClick={() => closeConfirm(profile.id)}>Cancel</button></div> : <button ref={deleteTriggerRef(profile.id)} className="profile-delete danger-ghost" type="button" onClick={() => setConfirmDelete(profile.id)}>Delete</button>}</div>)}
    </section>
  </main>;
}
