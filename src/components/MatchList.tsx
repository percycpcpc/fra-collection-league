"use client";

import { useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { PlayerAvatar } from "./PlayerAvatar";

export type MatchRecord = { id: string; winnerId: string; winnerName: string; winnerIconCard: string | null; loserId: string; loserName: string; loserIconCard: string | null; winnerDeckName: string | null; loserDeckName: string | null; note: string | null; createdAt: string };
export type MatchPagination = { offset: number; limit: number; total: number };

export function MatchPager({ pagination, onPage }: { pagination: MatchPagination; onPage: (offset: number) => void }) {
  if (pagination.total === 0) return null;
  const first = pagination.offset + 1;
  const last = Math.min(pagination.offset + pagination.limit, pagination.total);
  return <nav className="match-pager" aria-label="Match history pages"><button type="button" disabled={pagination.offset === 0} onClick={() => onPage(Math.max(0, pagination.offset - pagination.limit))}>Newer</button><span>{first}–{last} of {pagination.total}</span><button type="button" disabled={last >= pagination.total} onClick={() => onPage(pagination.offset + pagination.limit)}>Older</button></nav>;
}

export function MatchList({ matches, onDeleted, pagination, onPage }: { matches: MatchRecord[]; onDeleted: () => Promise<void>; pagination?: MatchPagination; onPage?: (offset: number) => void }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const deleteTriggers = useRef(new Map<string, HTMLButtonElement>());
  function closeConfirm(id: string) {
    setConfirmId(null);
    window.requestAnimationFrame(() => deleteTriggers.current.get(id)?.focus());
  }
  async function remove(id: string) {
    closeConfirm(id);
    try { await jsonFetch(`/api/matches/${id}`, { method: "DELETE" }); await onDeleted(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete match."); }
  }
  if (!matches.length) return <><div className="empty"><h2>{pagination?.total ? "No matches on this page" : "No matches yet"}</h2><p>{pagination?.total ? "Choose a newer page to continue browsing." : "Recorded results will appear here."}</p></div>{pagination && onPage && <MatchPager pagination={pagination} onPage={onPage} />}</>;
  return <><div className="match-list">{error && <p className="error-banner">{error}</p>}{matches.map((match) => <article className="match-row" key={match.id}><div><p><span className="player-name"><PlayerAvatar name={match.winnerName} iconCard={match.winnerIconCard} /><strong>{match.winnerName}</strong></span>{match.winnerDeckName && <span> ({match.winnerDeckName})</span>} defeated <span className="player-name"><PlayerAvatar name={match.loserName} iconCard={match.loserIconCard} /><strong>{match.loserName}</strong></span>{match.loserDeckName && <span> ({match.loserDeckName})</span>}</p><small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.createdAt))}{match.note && ` — ${match.note}`}</small></div>{confirmId === match.id ? <div className="inline-confirm"><span>Delete {match.winnerName} vs {match.loserName}?</span><button className="danger" type="button" onClick={() => void remove(match.id)}>Confirm</button><button type="button" onClick={() => closeConfirm(match.id)}>Cancel</button></div> : <button ref={(node) => { if (node) deleteTriggers.current.set(match.id, node); else deleteTriggers.current.delete(match.id); }} className="danger-ghost" type="button" onClick={() => setConfirmId(match.id)}>Delete</button>}</article>)}</div>{pagination && onPage && <MatchPager pagination={pagination} onPage={onPage} />}</>;
}
