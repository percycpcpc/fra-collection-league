import Link from "next/link";
import { AltShell, type AltPlayer } from "./AltShell";
import { PlayerAvatar } from "./PlayerAvatar";
import { AltPageState } from "./AltPageState";
import { altSectionHref, type AltSection } from "./useAltPlayer";

export type DirectoryPlayer = AltPlayer & { iconCard: string | null; cardCount: number; deckCount: number };
export type DirectoryStatus = "loading" | "ready" | "error";

const SECTION_NAMES: Record<AltSection, string> = { collection: "collection", decks: "decks", matches: "matches" };

/**
 * The Alt chooser at "/". Opening it never changes the browsing player; activating a card
 * selects that player and opens the pending section (or their collection).
 */
export function AltPlayersDirectory<P extends DirectoryPlayer>({ players, status = "ready", currentId, next, createForm, actions, error, loadError, onRetry, onSelect, onToggleStyle }: {
  players: P[]; status?: DirectoryStatus; currentId?: string | null; next?: AltSection; createForm: React.ReactNode; actions?: (player: P) => React.ReactNode;
  error?: string; loadError?: string; onRetry?: () => void; onSelect?: (player: P) => void; onToggleStyle: () => void;
}) {
  const empty = status === "ready" && players.length === 0;
  const title = next ? "Choose a player to continue" : "Choose your player";
  const subtitle = next ? `Pick whose ${SECTION_NAMES[next]} to open.` : "Reality Fracture league · season 1";
  return <AltShell title={title} subtitle={subtitle} activeNav="home" onToggleStyle={onToggleStyle} topRight={empty ? undefined : createForm}>
    {status === "loading" && <AltPageState title="Loading players" busy>Fetching the league roster.</AltPageState>}
    {status === "error" && <AltPageState title="We couldn't load the players" onRetry={onRetry}>{loadError || "Could not load players."}</AltPageState>}
    {empty && <section className="alt-page-section alt-state-panel alt-empty-league"><h2>No players yet</h2><p>Create the first player to start tracking a collection. Analytics stays available while the league is empty.</p>{createForm}</section>}
    {status === "ready" && players.length > 0 && <section className="alt-content-grid" aria-label="Player profiles">{players.map((player) => {
      const current = player.id === currentId;
      return <article className={`alt-panel alt-player-card ${current ? "is-current" : ""}`} key={player.id}>
        <Link className="alt-player-link" href={altSectionHref(player.id, next ?? "collection")} onClick={() => onSelect?.(player)}>
          <PlayerAvatar name={player.name} iconCard={player.iconCard} size={64} />
          <div><h2>{player.name}</h2><p>{player.cardCount} cards · {player.deckCount} decks</p></div>
          {current ? <span className="alt-current-badge">Current</span> : <span aria-hidden>→</span>}
        </Link>
        {actions && <div className="alt-player-actions">{actions(player)}</div>}
      </article>;
    })}</section>}
    {error && <p className="alt-notice error" role="alert">{error}</p>}
  </AltShell>;
}
