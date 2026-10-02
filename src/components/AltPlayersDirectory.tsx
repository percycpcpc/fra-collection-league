import Link from "next/link";
import { AltShell, type AltPlayer } from "./AltShell";
import { PlayerAvatar } from "./PlayerAvatar";

export type DirectoryPlayer = AltPlayer & { iconCard: string | null; cardCount: number; deckCount: number };

export function AltPlayersDirectory<P extends DirectoryPlayer>({ players, sidebarPlayers = players, createForm, actions, error, onToggleStyle }: { players: P[]; sidebarPlayers?: AltPlayer[]; createForm: React.ReactNode; actions?: (player: P) => React.ReactNode; error?: string; onToggleStyle: () => void }) {
  return <AltShell title="Choose your player" subtitle="Reality Fracture league · season 1" activeNav="home" players={sidebarPlayers} onToggleStyle={onToggleStyle} topRight={createForm}>
    {error && <p className="alt-notice error" role="alert">{error}</p>}
    <section className="alt-content-grid" aria-label="Player profiles">{players.map((player) => <article className="alt-panel alt-player-card" key={player.id}><Link className="alt-player-link" href={`/p/${player.id}`}><PlayerAvatar name={player.name} iconCard={player.iconCard} size={64} /><div><h2>{player.name}</h2><p>{player.cardCount} cards · {player.deckCount} decks</p></div><span aria-hidden>→</span></Link>{actions && <div className="alt-player-actions">{actions(player)}</div>}</article>)}</section>
  </AltShell>;
}
