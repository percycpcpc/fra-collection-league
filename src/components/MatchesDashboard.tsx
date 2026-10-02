"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { jsonFetch, type DeckSummary } from "@/lib/client";
import { MutationLock } from "@/lib/mutation-lock";
import { MatchList, type MatchRecord } from "./MatchList";
import { AltMatches, useAltMatchDelete } from "./AltMatches";
import { UiStyleToggle } from "./UiStyleToggle";
import { useUiStyle } from "./useUiStyle";
import { useLeaguePlayers } from "./useLeaguePlayers";

type Profile = { id: string; name: string };

export function MatchesDashboard() {
  const { style, toggle } = useUiStyle();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [winnerDecks, setWinnerDecks] = useState<DeckSummary[]>([]);
  const [loserDecks, setLoserDecks] = useState<DeckSummary[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(new MutationLock());
  const { players: sidebarPlayers } = useLeaguePlayers();
  const loadMatches = useCallback(async () => { const data = await jsonFetch<{ matches: MatchRecord[] }>("/api/matches"); setMatches(data.matches); }, []);
  const altDelete = useAltMatchDelete(loadMatches);
  useEffect(() => { Promise.all([jsonFetch<{ profiles: Profile[] }>("/api/profiles?counts=0"), loadMatches()]).then(([data]) => setProfiles(data.profiles)).catch((cause) => setError(cause.message)); }, [loadMatches]);
  useEffect(() => { if (!winnerId) { setWinnerDecks([]); return; } jsonFetch<{ decks: DeckSummary[] }>(`/api/profiles/${winnerId}/decks`).then((data) => setWinnerDecks(data.decks)).catch((cause) => setError(cause.message)); }, [winnerId]);
  useEffect(() => { if (!loserId) { setLoserDecks([]); return; } jsonFetch<{ decks: DeckSummary[] }>(`/api/profiles/${loserId}/decks`).then((data) => setLoserDecks(data.decks)).catch((cause) => setError(cause.message)); }, [loserId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); const formElement = event.currentTarget;
    if (!submitLock.current.tryAcquire()) return;
    setSubmitting(true);
    try { await jsonFetch("/api/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ winnerId, loserId, winnerDeckId: form.get("winnerDeckId") || null, loserDeckId: form.get("loserDeckId") || null, note: form.get("note") || null }) }); formElement.reset(); setWinnerId(""); setLoserId(""); try { await loadMatches(); } catch { setError("Match saved, but recent matches could not be refreshed. Reload to try again."); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record match."); }
    finally { submitLock.current.release(); setSubmitting(false); }
  }

  const recordForm = profiles.length < 2 ? <p className="notice">Create at least two players before recording a match.</p> : <form className="match-form" onSubmit={submit}><label>Winner<select required value={winnerId} onChange={(event) => setWinnerId(event.target.value)} disabled={submitting}><option value="">Select winner</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label><label>Winner deck<select name="winnerDeckId" defaultValue="" key={winnerId} disabled={submitting}><option value="">No deck</option>{winnerDecks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</select></label><span className="versus">VS</span><label>Loser<select required value={loserId} onChange={(event) => setLoserId(event.target.value)} disabled={submitting}><option value="">Select loser</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label><label>Loser deck<select name="loserDeckId" defaultValue="" key={loserId} disabled={submitting}><option value="">No deck</option>{loserDecks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</select></label><label className="match-note">Note (optional)<input name="note" maxLength={200} placeholder="A close game…" disabled={submitting} /></label><button className="primary" type="submit" disabled={submitting || !winnerId || !loserId || winnerId === loserId}>{submitting ? "Recording…" : "Record match"}</button></form>;
  if (style === "alt") return <AltMatches playerId={winnerId || profiles[0]?.id || ""} playerName="League" players={sidebarPlayers} matches={matches} wins={0} losses={0} recordForm={recordForm} actions={altDelete.actions} error={altDelete.error || error} onToggleStyle={toggle} />;
  return <main className="shell matches-page"><header className="page-heading"><div><Link className="back-link" href="/">← Players</Link><div className="eyebrow">League play</div><h1>Matches</h1></div><span>{matches.length} recent</span><UiStyleToggle onToggle={toggle} /></header>
    <section className="data-section"><h2>Record a match</h2>{recordForm}{error && <p className="error-banner">{error}</p>}</section>
    <section className="data-section"><h2>Recent matches</h2><MatchList matches={matches} onDeleted={loadMatches} /></section></main>;
}
