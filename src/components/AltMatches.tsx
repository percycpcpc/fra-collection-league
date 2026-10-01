import Link from "next/link";
import { AltShell, type AltPlayer } from "./AltShell";
import type { MatchRecord } from "./MatchList";

export function AltMatches({ playerId, playerName, players, matches, wins, losses, recordForm, onToggleStyle }: { playerId: string; playerName: string; players: AltPlayer[]; matches: MatchRecord[]; wins: number; losses: number; recordForm?: React.ReactNode; onToggleStyle: () => void }) {
  return <AltShell title={`${playerName}'s matches`} subtitle={`${wins} wins · ${losses} losses`} activeNav="matches" playerId={playerId} players={players} onToggleStyle={onToggleStyle}>
    {recordForm && <section className="alt-page-section"><h2>Record a match</h2>{recordForm}</section>}
    <section className="alt-page-section"><h2>Match history</h2><div className="alt-list">{matches.map((match) => <article key={match.id}><div><strong>{match.winnerName}</strong> defeated <strong>{match.loserName}</strong><small>{match.note || new Date(match.createdAt).toLocaleDateString()}</small></div><Link href={`/p/${match.winnerId}`}>View player</Link></article>)}</div></section>
  </AltShell>;
}
