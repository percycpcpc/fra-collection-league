"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { PlayerAvatar } from "./PlayerAvatar";
import { AltAnalytics } from "./AltAnalytics";
import { UiStyleToggle } from "./UiStyleToggle";
import { useUiStyle } from "./useUiStyle";
import { useLeaguePlayers } from "./useLeaguePlayers";

type Player = { id: string; name: string; iconCard: string | null; ownedCards: number; ownedQty: number; byRarity: Record<"common" | "uncommon" | "rare" | "mythic", number>; completionPct: number };
type Card = { name: string; rarity: string; colors: string; img: string; owners: number; totalQty: number };
type SortKey = "owners" | "totalQty" | "name";

export function AnalyticsDashboard() {
  const { style, toggle } = useUiStyle();
  const [data, setData] = useState<{ players: Player[]; cards: Card[] } | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "owners", direction: "desc" });
  const { players: sidebarPlayers } = useLeaguePlayers();
  useEffect(() => { jsonFetch<{ players: Player[]; cards: Card[] }>("/api/analytics").then(setData).catch((cause) => setError(cause.message)); }, []);

  const cards = useMemo(() => (data?.cards ?? []).filter((card) => card.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    const result = sort.key === "name" ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key];
    return (sort.direction === "asc" ? result : -result) || a.name.localeCompare(b.name);
  }), [data, search, sort]);
  const players = useMemo(() => [...(data?.players ?? [])].sort((a, b) => b.ownedCards - a.ownedCards || a.name.localeCompare(b.name)), [data]);
  function toggleSort(key: SortKey) { setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" })); }
  function heading(key: SortKey, label: string) { return <button className="sort-button" type="button" onClick={() => toggleSort(key)}>{label} {sort.key === key ? (sort.direction === "desc" ? "↓" : "↑") : ""}</button>; }

  if (!data) return <main className="shell"><p className={error ? "error-banner" : "muted"}>{error || "Loading analytics…"}</p></main>;
  if (style === "alt") return <AltAnalytics players={players} sidebarPlayers={sidebarPlayers} cards={cards} search={search} onSearch={setSearch} onToggleStyle={toggle} />;
  return <main className="shell analytics-page">
    <header className="page-heading"><div><Link className="back-link" href="/">← Players</Link><div className="eyebrow">League overview</div><h1>Analytics</h1></div><span>{data.players.length} players</span><UiStyleToggle onToggle={toggle} /></header>
    {data.players.length === 0 ? <div className="empty"><h2>No player data yet</h2><p>Create a profile to begin tracking collection coverage.</p></div> : <>
      <section className="data-section"><h2>Players</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>Player</th><th>Owned</th><th>Rarity split</th><th>Quantity</th></tr></thead><tbody>{players.map((player) => <tr key={player.id}><td><Link className="player-name" href={`/p/${player.id}`}><PlayerAvatar name={player.name} iconCard={player.iconCard} />{player.name}</Link></td><td><strong>{player.ownedCards}/251</strong><small>{player.completionPct}%</small></td><td><div className="rarity-bar" aria-label={`${player.byRarity.common} common, ${player.byRarity.uncommon} uncommon, ${player.byRarity.rare} rare, ${player.byRarity.mythic} mythic`}>{(["common", "uncommon", "rare", "mythic"] as const).map((rarity) => player.byRarity[rarity] > 0 && <span className={`rarity-${rarity}`} style={{ flex: player.byRarity[rarity] }} title={`${rarity}: ${player.byRarity[rarity]}`} key={rarity} />)}</div></td><td>{player.ownedQty}</td></tr>)}</tbody></table></div></section>
      <section className="data-section"><div className="section-title"><h2>Card coverage</h2><input type="search" placeholder="Search cards" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="table-scroll"><table className="data-table card-coverage"><thead><tr><th>{heading("name", "Card")}</th><th>Rarity</th><th>Colors</th><th>{heading("owners", "Owners")}</th><th>{heading("totalQty", "Total qty")}</th></tr></thead><tbody>{cards.map((card, index) => <tr key={card.name}><td><div className="coverage-card">{sort.key === "owners" && sort.direction === "desc" && <span className="rank-badge">#{index + 1}</span>}<img src={card.img} alt="" loading="lazy" /><strong>{card.name}</strong></div></td><td><span className={`rarity-gem rarity-${card.rarity}`}>{card.rarity}</span></td><td className="capitalize">{card.colors}</td><td><strong>{card.owners}</strong> <small>of {data.players.length} players</small></td><td>{card.totalQty}</td></tr>)}</tbody></table></div></section>
    </>}
  </main>;
}
