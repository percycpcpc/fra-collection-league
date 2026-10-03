import Link from "next/link";
import { AltShell, type AltPlayer } from "./AltShell";
import { AltPageState } from "./AltPageState";

export type AltAnalyticsPlayer = { id: string; name: string; ownedCards: number; ownedQty: number; byRarity: Record<"common" | "uncommon" | "rare" | "mythic", number>; completionPct: number };
export type AltAnalyticsCard = { name: string; rarity: string; colors: string; img: string; owners: number; totalQty: number };

export function AltAnalytics({ players, sidebarPlayers = players, cards, search, onSearch, onToggleStyle }: { players: AltAnalyticsPlayer[]; sidebarPlayers?: AltPlayer[]; cards: AltAnalyticsCard[]; search: string; onSearch: (value: string) => void; onToggleStyle: () => void }) {
  const mythics = players.reduce((sum, player) => sum + player.byRarity.mythic, 0);
  const avg = players.length ? Math.round(players.reduce((sum, player) => sum + player.completionPct, 0) / players.length) : 0;
  return <AltShell title="League analytics" subtitle="Collection coverage across every player" activeNav="analytics" players={sidebarPlayers} onToggleStyle={onToggleStyle} topRight={<label className="alt-search"><input aria-label="Search cards" type="search" placeholder="Search cards" value={search} onChange={(event) => onSearch(event.target.value)} /></label>}>
    <section className="alt-stat-grid"><article><small>Completion</small><strong>{avg}%</strong></article><article><small>Mythics</small><strong>{mythics}</strong></article><article><small>Players</small><strong>{players.length}</strong></article><article><small>Card entries</small><strong>{cards.length}</strong></article></section>
    {players.length === 0 ? <AltPageState title="No analytics data yet">Create a player and add cards to begin tracking league coverage.</AltPageState> : <section className="alt-page-section"><h2>Players</h2><div className="alt-list">{players.map((player) => <Link href={`/p/${player.id}`} key={player.id}><strong>{player.name}</strong><span>{player.ownedCards}/251 · {player.completionPct}%</span></Link>)}</div></section>}
    {players.length > 0 && <section className="alt-page-section"><h2>Card coverage</h2>{cards.length === 0 ? <p className="alt-field-hint">No cards match “{search}”. Clear or change the search to see coverage.</p> : <div className="alt-card-list">{cards.map((card) => <article key={card.name}><img src={card.img} alt="" /><div><strong>{card.name}</strong><small>{card.rarity} · {card.colors}</small></div><span>{card.owners} owners · ×{card.totalQty}</span></article>)}</div>}</section>}
  </AltShell>;
}
