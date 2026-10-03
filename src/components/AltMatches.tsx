"use client";

import { useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { AltShell } from "./AltShell";
import { type MatchPagination, type MatchRecord } from "./MatchList";
import { PlayerAvatar } from "./PlayerAvatar";

export type HeadToHeadRow = { opponentId: string; opponentName: string; opponentIconCard: string | null; wins: number; losses: number };

const matchTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function matchOffsetAfterDeletion(pagination: MatchPagination, visibleMatches: number) {
  return visibleMatches === 1 && pagination.offset > 0
    ? Math.max(0, pagination.offset - pagination.limit)
    : pagination.offset;
}

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

/** A player's match history. Names are plain text: browsing another player happens only via the chooser. */
export function AltMatches({ player, matches, wins, losses, summary, pagination, onPage, recordForm, headToHead, actions, error, onToggleStyle }: { player: { id: string; name: string; iconCard?: string | null }; matches: MatchRecord[]; wins: number; losses: number; summary?: string; pagination?: MatchPagination; onPage?: (offset: number) => void; recordForm?: React.ReactNode; headToHead?: HeadToHeadRow[]; actions?: (match: MatchRecord) => React.ReactNode; error?: string; onToggleStyle: () => void }) {
  return <AltShell title={`${player.name}'s matches`} subtitle={summary ?? `${wins} wins · ${losses} losses`} activeNav="matches" player={player} onToggleStyle={onToggleStyle}>
    {error && <p className="alt-notice error" role="alert">{error}</p>}
    {recordForm && <section className="alt-page-section"><h2>Record a match</h2>{recordForm}</section>}
    {headToHead && <section className="alt-page-section"><h2>Head to head</h2>{headToHead.length === 0 ? <p className="alt-field-hint">No opponents recorded yet.</p> : <div className="alt-list">{headToHead.map((row) => <article className="alt-h2h-row" key={row.opponentId}><span className="alt-match-side"><PlayerAvatar name={row.opponentName} iconCard={row.opponentIconCard} size={28} /><strong>{row.opponentName}</strong></span><span>{row.wins}W · {row.losses}L</span></article>)}</div>}</section>}
    <section className="alt-page-section"><h2>Match history</h2>{matches.length === 0 ? <p className="alt-field-hint">No matches yet. Recorded results will appear here.</p> : <div className="alt-list">{matches.map((match) => <article className="alt-match-row" key={match.id}><div><p className="alt-match-result"><MatchSide name={match.winnerName} iconCard={match.winnerIconCard} deckName={match.winnerDeckName} /> <span className="alt-match-verb">defeated</span> <MatchSide name={match.loserName} iconCard={match.loserIconCard} deckName={match.loserDeckName} /></p><small>{matchTime.format(new Date(match.createdAt))}{match.note && ` — ${match.note}`}</small></div><div className="alt-match-actions"><span className="alt-list-meta">{match.winnerId === player.id ? "Win" : match.loserId === player.id ? "Loss" : `Winner · ${match.winnerName}`}</span>{actions?.(match)}</div></article>)}</div>}{pagination && onPage && pagination.total > 0 && <nav className="alt-match-pager" aria-label="Match history pages"><button className="alt-pill" type="button" disabled={pagination.offset === 0} onClick={() => onPage(Math.max(0, pagination.offset - pagination.limit))}>Newer</button><span>{pagination.offset + 1}–{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}</span><button className="alt-pill" type="button" disabled={pagination.offset + pagination.limit >= pagination.total} onClick={() => onPage(pagination.offset + pagination.limit)}>Older</button></nav>}</section>
  </AltShell>;
}
