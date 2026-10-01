"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isNotFound, jsonFetch } from "@/lib/client";
import { MatchList, type MatchPagination, type MatchRecord } from "./MatchList";
import { PlayerAvatar } from "./PlayerAvatar";
import { AltMatches, useAltMatchDelete } from "./AltMatches";
import { AltPlayerPageState } from "./AltShell";
import { UiStyleToggle } from "./UiStyleToggle";
import { useUiStyle } from "./useUiStyle";

type MatchData = { profile: { id: string; name: string; iconCard?: string | null }; matches: MatchRecord[]; record: { wins: number; losses: number }; pagination: MatchPagination; headToHead: { opponentId: string; opponentName: string; opponentIconCard: string | null; wins: number; losses: number }[] };

export function ProfileMatches({ profileId }: { profileId: string }) {
  const { style, toggle } = useUiStyle();
  const [data, setData] = useState<MatchData | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  // The matches endpoint also returns the profile name, so one request suffices.
  const load = useCallback(async (offset = 0) => { const result = await jsonFetch<MatchData>(`/api/profiles/${profileId}/matches?offset=${offset}`); setData(result); setNotFound(false); }, [profileId]);
  // One request per load, so any 404 means the player itself is missing.
  const fail = useCallback((cause: Error) => { setError(cause.message); setNotFound(isNotFound(cause)); }, []);
  useEffect(() => { load().catch(fail); }, [load, fail]);
  const altDelete = useAltMatchDelete(load);
  // Alt: the route id is authoritative, so another player's data still in state counts as loading.
  if (!data || (style === "alt" && data.profile.id !== profileId)) {
    if (style === "alt") return <AltPlayerPageState profileId={profileId} activeNav="matches" copy={{ loading: "Loading match record", loadingDetail: "Fetching this player's results and head-to-head record.", unavailable: "Matches unavailable", failed: "We couldn't load this match record" }} error={error} notFound={notFound} onRetry={() => { setError(""); setNotFound(false); load().catch(fail); }} onToggleStyle={toggle} />;
    return <main className="shell"><p className={error ? "error-banner" : "muted"}>{error || "Loading match record…"}</p></main>;
  }
  const name = data.profile.name;
  if (style === "alt") return <AltMatches player={{ id: profileId, name, iconCard: data.profile.iconCard ?? null }} matches={data.matches} wins={data.record.wins} losses={data.record.losses} pagination={data.pagination} onPage={load} recordForm={<Link className="alt-pill alt-primary" href="/matches">Open match recorder</Link>} headToHead={data.headToHead} actions={altDelete.actions} error={altDelete.error || error} onToggleStyle={toggle} />;
  return <main className="shell profile-matches"><header className="page-heading"><div><Link className="back-link" href={`/p/${profileId}`}>← {name}&apos;s collection</Link><div className="eyebrow">Player record</div><h1>{name}&apos;s matches</h1></div><div className="record-score"><strong>{data.record.wins}–{data.record.losses}</strong><span>W–L</span></div><UiStyleToggle onToggle={toggle} /></header>
    <section className="data-section"><h2>Head to head</h2>{data.headToHead.length === 0 ? <p className="muted">No opponents recorded yet.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Opponent</th><th>W</th><th>L</th></tr></thead><tbody>{data.headToHead.map((row) => <tr key={row.opponentId}><td><Link className="player-name" href={`/p/${row.opponentId}`}><PlayerAvatar name={row.opponentName} iconCard={row.opponentIconCard} />{row.opponentName}</Link></td><td>{row.wins}</td><td>{row.losses}</td></tr>)}</tbody></table></div>}</section>
    <section className="data-section"><h2>Match history</h2><MatchList matches={data.matches} onDeleted={() => load(data.pagination.offset)} pagination={data.pagination} onPage={load} /></section></main>;
}
