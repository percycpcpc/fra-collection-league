import Link from "next/link";
import { AltShell, type AltPlayer } from "./AltShell";
import { PlayerAvatar } from "./PlayerAvatar";

export type DirectoryPlayer = AltPlayer & { iconCard: string | null; cardCount: number; deckCount: number };

export function AltPlayersDirectory({ players, createForm, error, onToggleStyle }: { players: DirectoryPlayer[]; createForm: React.ReactNode; error?: string; onToggleStyle: () => void }) {
  return <AltShell title="Choose your player" subtitle="Reality Fracture league · season 1" activeNav="home" players={players} onToggleStyle={onToggleStyle} topRight={createForm}>
    {error && <p className="alt-notice error" role="alert">{error}</p>}
    <section className="alt-content-grid" aria-label="Player profiles">{players.map((player) => <Link className="alt-panel alt-player-card" href={`/p/${player.id}`} key={player.id}><PlayerAvatar name={player.name} iconCard={player.iconCard} size={64} /><div><h2>{player.name}</h2><p>{player.cardCount} cards · {player.deckCount} decks</p></div><span aria-hidden>→</span></Link>)}</section>
  </AltShell>;
}
