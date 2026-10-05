import { AltShell } from "./AltShell";
import { AltPageState } from "./AltPageState";
import { PlayerAvatar } from "./PlayerAvatar";

export type AltAnalyticsPlayer = { id: string; name: string; iconCard?: string | null; ownedCards: number; ownedQty: number; byRarity: Record<"common" | "uncommon" | "rare" | "mythic", number>; completionPct: number };
export type AltAnalyticsCard = { name: string; rarity: string; colors: string; img: string; owners: number; totalQty: number };

export function AltAnalytics({ players, cards, search, onSearch }: { players: AltAnalyticsPlayer[]; cards: AltAnalyticsCard[]; search: string; onSearch: (value: string) => void }) {
  const mythics = players.reduce((sum, player) => sum + player.byRarity.mythic, 0);
  const avg = players.length ? Math.round(players.reduce((sum, player) => sum + player.completionPct, 0) / players.length) : 0;
  return <AltShell title="League analytics" subtitle="All players · collection coverage across the league" activeNav="analytics" topRight={<label className="alt-search"><input aria-label="Search cards" type="search" placeholder="Search cards" value={search} onChange={(event) => onSearch(event.target.value)} /></label>}>
    <section className="alt-stat-grid"><article><small>Completion</small><strong>{avg}%</strong></article><article><small>Mythics</small><strong>{mythics}</strong></article><article><small>Players</small><strong>{players.length}</strong></article><article><small>Card entries</small><strong>{cards.length}</strong></article></section>
    {players.length === 0 ? <AltPageState title="No analytics data yet">Create a player and add cards to begin tracking league coverage.</AltPageState> : <section className="alt-page-section"><h2>Players</h2>{/* League-wide rows; not links, so Analytics never switches the browsing player. */}<div className="alt-list">{players.map((player) => <article key={player.id}><span className="alt-list-player"><PlayerAvatar name={player.name} iconCard={player.iconCard ?? null} size={32} /><strong>{player.name}</strong></span><span>{player.ownedCards}/251 · {player.completionPct}%</span></article>)}</div></section>}
    {players.length > 0 && <section className="alt-page-section"><h2>Card coverage</h2>{cards.length === 0 ? <p className="alt-field-hint">No cards match “{search}”. Clear or change the search to see coverage.</p> : <div className="alt-card-list">{cards.map((card) => <article key={card.name}><img src={card.img} alt="" /><div><strong>{card.name}</strong><small>{card.rarity} · {card.colors}</small></div><span>{card.owners} owners · ×{card.totalQty}</span></article>)}</div>}</section>}
  </AltShell>;
}
