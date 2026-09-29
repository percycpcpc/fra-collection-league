"use client";

import { useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";

export type MatchRecord = { id: string; winnerId: string; winnerName: string; loserId: string; loserName: string; winnerDeckName: string | null; loserDeckName: string | null; note: string | null; createdAt: string };

export function MatchList({ matches, onDeleted }: { matches: MatchRecord[]; onDeleted: () => Promise<void> }) {
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
  if (!matches.length) return <div className="empty"><h2>No matches yet</h2><p>Recorded results will appear here.</p></div>;
  return <div className="match-list">{error && <p className="error-banner">{error}</p>}{matches.map((match) => <article className="match-row" key={match.id}><div><p><strong>{match.winnerName}</strong>{match.winnerDeckName && <span> ({match.winnerDeckName})</span>} defeated <strong>{match.loserName}</strong>{match.loserDeckName && <span> ({match.loserDeckName})</span>}</p><small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.createdAt))}{match.note && ` — ${match.note}`}</small></div>{confirmId === match.id ? <div className="inline-confirm"><span>Delete {match.winnerName} vs {match.loserName}?</span><button className="danger" type="button" onClick={() => void remove(match.id)}>Confirm</button><button type="button" onClick={() => closeConfirm(match.id)}>Cancel</button></div> : <button ref={(node) => { if (node) deleteTriggers.current.set(match.id, node); else deleteTriggers.current.delete(match.id); }} className="danger-ghost" type="button" onClick={() => setConfirmId(match.id)}>Delete</button>}</article>)}</div>;
}
