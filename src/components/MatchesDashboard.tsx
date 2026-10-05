"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { isNotFound, jsonFetch, type DeckSummary } from "@/lib/client";
import { type MatchPagination, type MatchRecord } from "./MatchList";
import { MutationLock } from "@/lib/mutation-lock";
import { AltMatches, matchOffsetAfterDeletion, useAltMatchDelete, type HeadToHeadRow } from "./AltMatches";
import { AltPlayerPageState, AltShell } from "./AltShell";
import { AltPageState } from "./AltPageState";
import { ProfilesDirectory } from "./ProfilesDirectory";
import { useAltBrowsing } from "./useAltPlayer";

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

type PlayerMatches = { id: string; matches: MatchRecord[]; record: { wins: number; losses: number }; pagination: MatchPagination; headToHead: HeadToHeadRow[] };

export function MatchesDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [pagination, setPagination] = useState<MatchPagination>({ offset: 0, limit: 25, total: 0 });
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [winnerDeckId, setWinnerDeckId] = useState("");
  const [loserDeckId, setLoserDeckId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(new MutationLock());
  const winnerDecks = useDeckOptions(winnerId);
  const loserDecks = useDeckOptions(loserId);
  // Alt: /matches resolves through the browsing player, never through the recorder's fields.
  const { browsing } = useAltBrowsing();
  const selectedId = browsing.kind === "player" ? browsing.id : null;
  const [playerMatches, setPlayerMatches] = useState<PlayerMatches | null>(null);
  const [playerError, setPlayerError] = useState<{ id: string; message: string; notFound: boolean } | null>(null);
  const loadPlayerMatches = useCallback(async (id: string, offset = 0) => {
    try { const data = await jsonFetch<Omit<PlayerMatches, "id">>(`/api/profiles/${id}/matches?offset=${offset}`); setPlayerMatches({ id, ...data }); setPlayerError(null); }
    catch (cause) { setPlayerError({ id, message: cause instanceof Error ? cause.message : "Could not load matches.", notFound: isNotFound(cause) }); }
  }, []);
  useEffect(() => { if (selectedId) void loadPlayerMatches(selectedId); }, [selectedId, loadPlayerMatches]);
  const loadMatches = useCallback(async (offset = 0) => { const data = await jsonFetch<{ matches: MatchRecord[]; pagination: MatchPagination }>(`/api/matches?offset=${offset}`); setMatches(data.matches); setPagination(data.pagination); }, []);
  const altDelete = useAltMatchDelete(useCallback(async () => {
    if (!selectedId || !playerMatches) return;
    const playerOffset = matchOffsetAfterDeletion(playerMatches.pagination, playerMatches.matches.length);
    const leagueOffset = matchOffsetAfterDeletion(pagination, matches.length);
    await Promise.all([loadPlayerMatches(selectedId, playerOffset), loadMatches(leagueOffset)]);
  }, [selectedId, playerMatches, pagination, matches.length, loadPlayerMatches, loadMatches]));
  useEffect(() => { Promise.all([jsonFetch<{ profiles: Profile[] }>("/api/profiles?counts=0"), loadMatches()]).then(([data]) => setProfiles(data.profiles)).catch((cause) => setError(cause.message)); }, [loadMatches]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!submitLock.current.tryAcquire()) return;
    setSubmitting(true);
    try { await jsonFetch("/api/matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ winnerId, loserId, winnerDeckId: winnerDeckId || null, loserDeckId: loserDeckId || null, note: note || null }) }); setWinnerId(""); setLoserId(""); setWinnerDeckId(""); setLoserDeckId(""); setNote(""); try { await loadMatches(0); } catch { setError("Match saved, but recent matches could not be refreshed. Reload to try again."); } if (selectedId) await loadPlayerMatches(selectedId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record match."); }
    finally { submitLock.current.release(); setSubmitting(false); }
  }

  const recordForm = profiles.length < 2 ? <p className="notice">Create at least two players before recording a match.</p> : <form className="match-form" onSubmit={submit}><label>Winner<select required value={winnerId} onChange={(event) => { setWinnerId(event.target.value); setWinnerDeckId(""); }} disabled={submitting}><option value="">Select winner</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label><label>Winner deck<select name="winnerDeckId" value={winnerDeckId} onChange={(event) => setWinnerDeckId(event.target.value)} key={winnerId} disabled={submitting || !winnerId || winnerDecks.status !== "ready"}><option value="">{winnerDecks.status === "loading" ? "Loading decks..." : "No deck"}</option>{winnerDecks.decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</select></label><span className="versus">VS</span><label>Loser<select required value={loserId} onChange={(event) => { setLoserId(event.target.value); setLoserDeckId(""); }} disabled={submitting}><option value="">Select loser</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></label><label>Loser deck<select name="loserDeckId" value={loserDeckId} onChange={(event) => setLoserDeckId(event.target.value)} key={loserId} disabled={submitting || !loserId || loserDecks.status !== "ready"}><option value="">{loserDecks.status === "loading" ? "Loading decks..." : "No deck"}</option>{loserDecks.decks.map((deck) => <option value={deck.id} key={deck.id}>{deck.name}</option>)}</select></label><label className="match-note">Note (optional)<input name="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="A close game…" disabled={submitting} /></label><button className="primary" type="submit" disabled={submitting || !winnerId || !loserId || winnerId === loserId || winnerDecks.status === "loading" || loserDecks.status === "loading"}>{submitting ? "Recording..." : "Record match"}</button></form>;
    // No validated player: the chooser, continuing to Matches once one is picked.
    if (browsing.kind === "none" || browsing.kind === "missing") return <ProfilesDirectory next="matches" />;
    if (browsing.kind === "pending") return <AltShell title="Loading…" activeNav="matches"><AltPageState title="Loading players" busy>Finding the player you&apos;re browsing.</AltPageState></AltShell>;
    if (playerMatches?.id !== browsing.id) {
      const failure = playerError?.id === browsing.id ? playerError : null;
      return <AltPlayerPageState profileId={browsing.id} activeNav="matches" copy={{ loading: "Loading match record", loadingDetail: "Fetching this player's results and head-to-head record.", unavailable: "Matches unavailable", failed: "We couldn't load this match record" }} error={failure?.message} notFound={failure?.notFound} onRetry={() => { setPlayerError(null); void loadPlayerMatches(browsing.id); }} />;
    }
    return <AltMatches player={{ id: browsing.id, name: browsing.name, iconCard: browsing.iconCard }} matches={playerMatches.matches} wins={playerMatches.record.wins} losses={playerMatches.record.losses} pagination={playerMatches.pagination} onPage={(offset) => void loadPlayerMatches(browsing.id, offset)} headToHead={playerMatches.headToHead} recordForm={recordForm} actions={altDelete.actions} error={altDelete.error || error || (playerError?.id === browsing.id ? playerError.message : "")} />;
}
