import Link from "next/link";
import { AltShell, type AltPlayer } from "./AltShell";
import type { DeckSummary } from "@/lib/client";
import type { DeckBanner } from "@/lib/deck-banner";

export function AltDeckList({ profileId, profileName, players, decks, banners, createForm, actions, error, onToggleStyle }: { profileId: string; profileName: string; players: AltPlayer[]; decks: DeckSummary[]; banners?: ReadonlyMap<string, DeckBanner | null>; createForm: React.ReactNode; actions?: (deck: DeckSummary) => React.ReactNode; error?: string; onToggleStyle: () => void }) {
  return <AltShell title={`${profileName}'s decks`} subtitle={`${decks.length} decks ready for league play`} activeNav="decks" playerId={profileId} players={players} onToggleStyle={onToggleStyle} topRight={createForm}>
    {error && <p className="alt-notice error" role="alert">{error}</p>}
    <section className="alt-content-grid">{decks.map((deck) => { const banner = banners?.get(deck.id); return <article className={banner ? "alt-panel alt-deck-card has-identity" : "alt-panel alt-deck-card"} key={deck.id} style={banner ? { background: banner.background } : undefined} title={banner?.label}><div><small>Commander</small><h2>{deck.name}</h2><p>{deck.commander || "No commander selected"}</p>{banner && <span className="visually-hidden">{banner.label}</span>}</div><strong>{deck.cardCount} cards</strong><div><Link className="alt-pill alt-primary" href={`/p/${profileId}/decks/${deck.id}`}>Edit deck</Link>{actions?.(deck)}</div></article>; })}</section>
  </AltShell>;
}
