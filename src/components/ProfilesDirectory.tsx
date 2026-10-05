"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { AltPlayersDirectory } from "./AltPlayersDirectory";
import { loadLeaguePlayers, refreshLeaguePlayers, type LeaguePlayer } from "./useLeaguePlayers";
import { rememberAltPlayer, useRememberedAltPlayer, type AltSection } from "./useAltPlayer";
import { MutationLock } from "@/lib/mutation-lock";

/** next: the Alt section a player tab was heading to before a player was chosen. */
export function ProfilesDirectory({ next }: { next?: AltSection } = {}) {
  const [profiles, setProfiles] = useState<LeaguePlayer[]>([]);
  const [name, setName] = useState("");
  const [seedCommons, setSeedCommons] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const deleteTriggers = useRef(new Map<string, HTMLButtonElement>());
  const createLock = useRef(new MutationLock());
  const [loadFailed, setLoadFailed] = useState(false);
  const currentId = useRememberedAltPlayer();

  const load = () => loadLeaguePlayers().then((list) => { setProfiles(list); setLoadFailed(false); }).catch((cause) => { setError(cause.message); setLoadFailed(true); }).finally(() => setLoading(false));
  const reload = () => refreshLeaguePlayers().then((list) => { setProfiles(list); setLoadFailed(false); }).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  function retry() { setError(""); setLoading(true); refreshLeaguePlayers().then((list) => { setProfiles(list); setLoadFailed(false); }).catch((cause) => { setError(cause.message); setLoadFailed(true); }).finally(() => setLoading(false)); }

  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!createLock.current.tryAcquire()) return;
    setCreating(true);
    try {
      await jsonFetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, seedCommons }) });
      setName(""); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create profile."); }
    finally { createLock.current.release(); setCreating(false); }
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

  const createForm = <form className="alt-create-inline" onSubmit={create}><input aria-label="New player name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={80} disabled={creating} /><button className="alt-pill alt-primary" type="submit" disabled={creating}>{creating ? "Creating…" : "+ New player"}</button></form>;
  const deleteTriggerRef = (id: string) => (node: HTMLButtonElement | null) => { if (node) deleteTriggers.current.set(id, node); else deleteTriggers.current.delete(id); };
  const status = loading ? "loading" : loadFailed ? "error" : "ready";
  // A failed list load is shown by the error state itself; other errors (create, delete) as a notice.
  return <AltPlayersDirectory players={profiles} status={status} currentId={currentId} next={next} createForm={createForm} error={loadFailed ? "" : error} loadError={error} onRetry={retry} onSelect={({ id, name, iconCard }) => rememberAltPlayer({ id, name, iconCard })} actions={(profile) => confirmDelete === profile.id ? <span className="alt-inline-confirm">Delete {profile.name}? <button className="alt-pill alt-danger" type="button" onClick={() => void remove(profile)}>Confirm</button><button className="alt-pill" type="button" onClick={() => closeConfirm(profile.id)}>Cancel</button></span> : <button ref={deleteTriggerRef(profile.id)} className="alt-pill alt-danger" type="button" aria-label={`Delete ${profile.name}`} onClick={() => setConfirmDelete(profile.id)}>Delete</button>} />;
}
