"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";

type Profile = { id: string; name: string; cardCount: number; deckCount: number };

export function ProfilesDirectory() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => jsonFetch<{ profiles: Profile[] }>("/api/profiles").then((data) => setProfiles(data.profiles)).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      await jsonFetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      setName(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create profile."); }
  }

  return <main className="shell directory">
    <header className="masthead"><div className="eyebrow">Reality Fracture</div><h1>Collection League</h1><p>Choose a player to manage their cards and decks.</p></header>
    <form className="create-bar" onSubmit={create}><label htmlFor="profile-name">New player</label><input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={80} /><button className="primary" type="submit">Create profile</button></form>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <section className="profile-list" aria-label="Player profiles">
      {loading ? <p className="muted">Loading profiles…</p> : profiles.length === 0 ? <div className="empty"><h2>No players yet</h2><p>Create the first profile to start registering a collection.</p></div> : profiles.map((profile) => <Link className="profile-row" href={`/p/${profile.id}`} key={profile.id}><span className="profile-monogram">{profile.name.slice(0, 1).toUpperCase()}</span><strong>{profile.name}</strong><span>{profile.cardCount} collection entries</span><span>{profile.deckCount} decks</span><b aria-hidden>→</b></Link>)}
    </section>
  </main>;
}
