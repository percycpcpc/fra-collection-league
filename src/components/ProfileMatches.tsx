"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isNotFound, jsonFetch } from "@/lib/client";
import { type MatchPagination, type MatchRecord } from "./MatchList";
import { AltMatches, matchOffsetAfterDeletion, useAltMatchDelete } from "./AltMatches";
import { AltPlayerPageState } from "./AltShell";

type MatchData = { profile: { id: string; name: string; iconCard?: string | null }; matches: MatchRecord[]; record: { wins: number; losses: number }; pagination: MatchPagination; headToHead: { opponentId: string; opponentName: string; opponentIconCard: string | null; wins: number; losses: number }[] };

export function ProfileMatches({ profileId }: { profileId: string }) {
  const [data, setData] = useState<MatchData | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  // The matches endpoint also returns the profile name, so one request suffices.
  const load = useCallback(async (offset = 0) => { const result = await jsonFetch<MatchData>(`/api/profiles/${profileId}/matches?offset=${offset}`); setData(result); setNotFound(false); }, [profileId]);
  // One request per load, so any 404 means the player itself is missing.
  const fail = useCallback((cause: Error) => { setError(cause.message); setNotFound(isNotFound(cause)); }, []);
  useEffect(() => { load().catch(fail); }, [load, fail]);
  const altDelete = useAltMatchDelete(useCallback(async () => {
    if (!data) return;
    await load(matchOffsetAfterDeletion(data.pagination, data.matches.length));
  }, [data, load]));
  // Alt: the route id is authoritative, so another player's data still in state counts as loading.
  if (!data || data.profile.id !== profileId) {
    return <AltPlayerPageState profileId={profileId} activeNav="matches" copy={{ loading: "Loading match record", loadingDetail: "Fetching this player's results and head-to-head record.", unavailable: "Matches unavailable", failed: "We couldn't load this match record" }} error={error} notFound={notFound} onRetry={() => { setError(""); setNotFound(false); load().catch(fail); }} />;
  }
  const name = data.profile.name;
  return <AltMatches player={{ id: profileId, name, iconCard: data.profile.iconCard ?? null }} matches={data.matches} wins={data.record.wins} losses={data.record.losses} pagination={data.pagination} onPage={load} recordForm={<Link className="alt-pill alt-primary" href="/matches">Open match recorder</Link>} headToHead={data.headToHead} actions={altDelete.actions} error={altDelete.error || error} />;
}
