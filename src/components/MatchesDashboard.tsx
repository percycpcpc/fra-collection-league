"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { jsonFetch, type DeckSummary } from "@/lib/client";
import { MatchList, type MatchRecord } from "./MatchList";
import { AltMatches, useAltMatchDelete } from "./AltMatches";
import { UiStyleToggle } from "./UiStyleToggle";
import { useUiStyle } from "./useUiStyle";
import { useLeaguePlayers } from "./useLeaguePlayers";

type Profile = { id: string; name: string };
type DeckOptionsState = {
  profileId: string;
  decks: DeckSummary[];
  status: "idle" | "loading" | "ready" | "error";
  error: string;
};

const emptyDeckOptions: DeckOptionsState = { profileId: "", decks: [], status: "idle", error: "" };

export function deckOptionsForProfile(profileId: string, state: DeckOptionsState): DeckOptionsState {
  if (state.profileId === profileId) return state;
  return { ...emptyDeckOptions, status: profileId ? "loading" : "idle" };
}

function useDeckOptions(profileId: string) {
  const [state, setState] = useState<DeckOptionsState>(emptyDeckOptions);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!profileId) {
      setState(emptyDeckOptions);
      return;
    }

    const controller = new AbortController();
    let current = true;
    setState({ profileId, decks: [], status: "loading", error: "" });
    jsonFetch<{ decks: DeckSummary[] }>(`/api/profiles/${profileId}/decks`, { signal: controller.signal })
      .then((data) => {
        if (current) setState({ profileId, decks: data.decks, status: "ready", error: "" });
      })
      .catch((cause) => {
        if (current && !controller.signal.aborted) {
          setState({ profileId, decks: [], status: "error", error: cause instanceof Error ? cause.message : "Could not load decks." });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [profileId, attempt]);

  // Effects run after render, so bind visible data to the requested profile too.
  // This prevents even a single render of the previous player's deck options.
  const current = deckOptionsForProfile(profileId, state);
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}

function DeckSelect({ label, name, profileId, options }: { label: string; name: string; profileId: string; options: ReturnType<typeof useDeckOptions> }) {
  const loading = options.status === "loading";
  return <label>{label}<select name={name} defaultValue="" key={`${profileId}-${options.status}`} disabled={!profileId || loading || options.status === "error"}><option value="">{loading ? "Loading decks…" : "No deck"}</option>{options.decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</select>{options.status === "error" && <span className="field-error" role="alert">{options.error} <button type="button" onClick={options.retry}>Retry</button></span>}</label>;
}

export function MatchesDashboard() {
  const { style, toggle } = useUiStyle();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [error, setError] = useState("");
  const { players: sidebarPlayers } = useLeaguePlayers();
  const winnerDecks = useDeckOptions(winnerId);
  const loserDecks = useDeckOptions(loserId);
  const loadMatches = useCallback(async () => { const data = await jsonFetch<{ matches: MatchRecord[] }>("/api/matches"); setMatches(data.matches); }, []);
  const altDelete = useAltMatchDelete(loadMatches);
  useEffect(() => { Promise.all([jsonFetch<{ profiles: Profile[] }>("/api/profiles?counts=0"), loadMatches()]).then(([data]) => setProfiles(data.profiles)).catch((cause) => setError(cause.message)); }, [loadMatches]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget); const formElement = event.currentTarget;
    try { await jsonFetch("/api/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ winnerId, loserId, winnerDeckId: form.get("winnerDeckId") || null, loserDeckId: form.get("loserDeckId") || null, note: form.get("note") || null }) }); formElement.reset(); setWinnerId(""); setLoserId(""); await loadMatches(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record match."); }
  }

  const recordForm = profiles.length < 2 ? <p className="notice">Create at least two players before recording a match.</p> : <form className="match-form" onSubmit={submit}><label>Winner<select required value={winnerId} onChange={(event) => setWinnerId(event.target.value)}><option value="">Select winner</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label><DeckSelect label="Winner deck" name="winnerDeckId" profileId={winnerId} options={winnerDecks} /><span className="versus">VS</span><label>Loser<select required value={loserId} onChange={(event) => setLoserId(event.target.value)}><option value="">Select loser</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label><DeckSelect label="Loser deck" name="loserDeckId" profileId={loserId} options={loserDecks} /><label className="match-note">Note (optional)<input name="note" maxLength={200} placeholder="A close game…" /></label><button className="primary" type="submit" disabled={!winnerId || !loserId || winnerId === loserId || winnerDecks.status === "loading" || loserDecks.status === "loading"}>Record match</button></form>;
  if (style === "alt") return <AltMatches playerId={winnerId || profiles[0]?.id || ""} playerName="League" players={sidebarPlayers} matches={matches} wins={0} losses={0} recordForm={recordForm} actions={altDelete.actions} error={altDelete.error || error} onToggleStyle={toggle} />;
  return <main className="shell matches-page"><header className="page-heading"><div><Link className="back-link" href="/">← Players</Link><div className="eyebrow">League play</div><h1>Matches</h1></div><span>{matches.length} recent</span><UiStyleToggle onToggle={toggle} /></header>
    <section className="data-section"><h2>Record a match</h2>{recordForm}{error && <p className="error-banner">{error}</p>}</section>
    <section className="data-section"><h2>Recent matches</h2><MatchList matches={matches} onDeleted={loadMatches} /></section></main>;
}
