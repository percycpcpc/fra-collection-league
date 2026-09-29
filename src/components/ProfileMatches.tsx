"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { MatchList, type MatchRecord } from "./MatchList";
import { PlayerAvatar } from "./PlayerAvatar";

type MatchData = { matches: MatchRecord[]; record: { wins: number; losses: number }; headToHead: { opponentId: string; opponentName: string; opponentIconCard: string | null; wins: number; losses: number }[] };

export function ProfileMatches({ profileId }: { profileId: string }) {
  const [name, setName] = useState("");
  const [data, setData] = useState<MatchData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const result = await jsonFetch<MatchData>(`/api/profiles/${profileId}/matches`); setData(result); }, [profileId]);
  useEffect(() => { Promise.all([jsonFetch<{ profile: { name: string } }>(`/api/profiles/${profileId}`), load()]).then(([profile]) => setName(profile.profile.name)).catch((cause) => setError(cause.message)); }, [load, profileId]);
  if (!data) return <main className="shell"><p className={error ? "error-banner" : "muted"}>{error || "Loading match record…"}</p></main>;
  return <main className="shell profile-matches"><header className="page-heading"><div><Link className="back-link" href={`/p/${profileId}`}>← {name}&apos;s collection</Link><div className="eyebrow">Player record</div><h1>{name}&apos;s matches</h1></div><div className="record-score"><strong>{data.record.wins}–{data.record.losses}</strong><span>W–L</span></div></header>
    <section className="data-section"><h2>Head to head</h2>{data.headToHead.length === 0 ? <p className="muted">No opponents recorded yet.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Opponent</th><th>W</th><th>L</th></tr></thead><tbody>{data.headToHead.map((row) => <tr key={row.opponentId}><td><Link className="player-name" href={`/p/${row.opponentId}`}><PlayerAvatar name={row.opponentName} iconCard={row.opponentIconCard} />{row.opponentName}</Link></td><td>{row.wins}</td><td>{row.losses}</td></tr>)}</tbody></table></div>}</section>
    <section className="data-section"><h2>Recent matches</h2><MatchList matches={data.matches} onDeleted={load} /></section></main>;
}
