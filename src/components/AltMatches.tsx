"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { AltShell, type AltPlayer } from "./AltShell";
import { MatchPager, type MatchPagination, type MatchRecord } from "./MatchList";
import { PlayerAvatar } from "./PlayerAvatar";

export type HeadToHeadRow = { opponentId: string; opponentName: string; opponentIconCard: string | null; wins: number; losses: number };

const matchTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Inline Delete → named Confirm/Cancel for Alt match rows; refetches via onDeleted and surfaces failures as `error`. */
export function useAltMatchDelete(onDeleted: () => Promise<void>) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const deleteTriggers = useRef(new Map<string, HTMLButtonElement>());
  function closeConfirm(id: string) {
    setConfirmId(null);
    window.requestAnimationFrame(() => deleteTriggers.current.get(id)?.focus());
  }
  async function remove(id: string) {
    closeConfirm(id); setError("");
    try { await jsonFetch(`/api/matches/${id}`, { method: "DELETE" }); await onDeleted(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete match."); }
  }
  const actions = (match: MatchRecord) => confirmId === match.id
    ? <span className="alt-inline-confirm">Delete {match.winnerName} vs {match.loserName}? <button className="alt-pill alt-danger" type="button" onClick={() => void remove(match.id)}>Confirm</button><button className="alt-pill" type="button" onClick={() => closeConfirm(match.id)}>Cancel</button></span>
    : <button ref={(node) => { if (node) deleteTriggers.current.set(match.id, node); else deleteTriggers.current.delete(match.id); }} className="alt-pill alt-danger" type="button" aria-label={`Delete ${match.winnerName} vs ${match.loserName}`} onClick={() => setConfirmId(match.id)}>Delete</button>;
  return { error, actions };
}

function MatchSide({ name, iconCard, deckName }: { name: string; iconCard: string | null; deckName: string | null }) {
  return <span className="alt-match-side"><PlayerAvatar name={name} iconCard={iconCard} size={28} /><span><strong>{name}</strong>{deckName && <small>{deckName}</small>}</span></span>;
}

export function AltMatches({ playerId, playerName, players, matches, wins, losses, summary, pagination, onPage, recordForm, headToHead, actions, error, onToggleStyle }: { playerId: string; playerName: string; players: AltPlayer[]; matches: MatchRecord[]; wins: number; losses: number; summary?: string; pagination?: MatchPagination; onPage?: (offset: number) => void; recordForm?: React.ReactNode; headToHead?: HeadToHeadRow[]; actions?: (match: MatchRecord) => React.ReactNode; error?: string; onToggleStyle: () => void }) {
  return <AltShell title={`${playerName}'s matches`} subtitle={summary ?? `${wins} wins · ${losses} losses`} activeNav="matches" playerId={playerId} players={players} onToggleStyle={onToggleStyle}>
    {error && <p className="alt-notice error" role="alert">{error}</p>}
    {recordForm && <section className="alt-page-section"><h2>Record a match</h2>{recordForm}</section>}
    {headToHead && <section className="alt-page-section"><h2>Head to head</h2>{headToHead.length === 0 ? <p className="alt-field-hint">No opponents recorded yet.</p> : <div className="alt-list">{headToHead.map((row) => <Link className="alt-h2h-row" href={`/p/${row.opponentId}`} key={row.opponentId}><span className="alt-match-side"><PlayerAvatar name={row.opponentName} iconCard={row.opponentIconCard} size={28} /><strong>{row.opponentName}</strong></span><span>{row.wins}W · {row.losses}L</span></Link>)}</div>}</section>}
    <section className="alt-page-section"><h2>Match history</h2>{matches.length === 0 ? <p className="alt-field-hint">No matches yet. Recorded results will appear here.</p> : <div className="alt-list">{matches.map((match) => <article className="alt-match-row" key={match.id}><div><p className="alt-match-result"><MatchSide name={match.winnerName} iconCard={match.winnerIconCard} deckName={match.winnerDeckName} /> <span className="alt-match-verb">defeated</span> <MatchSide name={match.loserName} iconCard={match.loserIconCard} deckName={match.loserDeckName} /></p><small>{matchTime.format(new Date(match.createdAt))}{match.note && ` — ${match.note}`}</small></div><div className="alt-match-actions"><Link className="alt-pill" href={`/p/${match.winnerId}`}>View player</Link>{actions?.(match)}</div></article>)}</div>}{pagination && onPage && <MatchPager pagination={pagination} onPage={onPage} />}</section>
  </AltShell>;
}
