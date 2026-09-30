import Link from "next/link";
import { AltShell, type AltPlayer } from "./AltShell";
import type { DeckSummary } from "@/lib/client";

export function AltDeckList({ profileId, profileName, players, decks, createForm, actions, onToggleStyle }: { profileId: string; profileName: string; players: AltPlayer[]; decks: DeckSummary[]; createForm: React.ReactNode; actions?: (deck: DeckSummary) => React.ReactNode; onToggleStyle: () => void }) {
  return <AltShell title={`${profileName}'s decks`} subtitle={`${decks.length} decks ready for league play`} activeNav="decks" playerId={profileId} players={players} onToggleStyle={onToggleStyle} topRight={createForm}>
    <section className="alt-content-grid">{decks.map((deck) => <article className="alt-panel alt-deck-card" key={deck.id}><div><small>Commander</small><h2>{deck.name}</h2><p>{deck.commander || "No commander selected"}</p></div><strong>{deck.cardCount} cards</strong><div><Link className="alt-pill alt-primary" href={`/p/${profileId}/decks/${deck.id}`}>Edit deck</Link>{actions?.(deck)}</div></article>)}</section>
  </AltShell>;
}
