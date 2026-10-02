"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type AltPlayer = { id: string; name: string; cardCount?: number };
export type AltNav = "collection" | "decks" | "analytics" | "matches" | "home" | "admin";

export function AltShell({ children, title, subtitle, topRight, activeNav, players, playerId, nowPlaying, onToggleStyle }: {
  children: ReactNode; title: ReactNode; subtitle?: string; topRight?: ReactNode; activeNav: AltNav;
  players: AltPlayer[]; playerId?: string; nowPlaying?: ReactNode; onToggleStyle: () => void;
}) {
  const currentId = playerId ?? players[0]?.id;
  const nav = [
    { id: "home", label: "Players", href: "/" },
    { id: "collection", label: "Collection", href: currentId ? `/p/${currentId}` : "/" },
    { id: "decks", label: "Decks", href: currentId ? `/p/${currentId}/decks` : "/" },
    { id: "analytics", label: "Analytics", href: "/analytics" },
    { id: "matches", label: "Matches", href: currentId ? `/p/${currentId}/matches` : "/matches" },
  ] as const;
  return <div className={`alt-ui-root ${nowPlaying ? "alt-has-nowbar" : ""}`}>
    <aside className="alt-sidebar">
      <Link className="alt-brand" href="/"><span>F</span><div><strong>FRA League</strong><small>Reality Fracture</small></div></Link>
      <nav className="alt-nav" aria-label="League navigation">{nav.map((item) => <Link className={activeNav === item.id ? "active" : ""} href={item.href} key={item.id}><span>{item.label}</span></Link>)}</nav>
      <div className="alt-players-label">Players</div>
      <div className="alt-players">{players.map((player, index) => <Link className={player.id === playerId ? "active" : ""} href={`/p/${player.id}`} key={player.id}><span className="alt-avatar" style={{ background: ["#1ed760", "#e8c468", "#539df5", "#f3727f", "#b48cf2"][index % 5] }}>{player.name.charAt(0).toUpperCase()}</span><span><strong>{player.name}</strong>{player.cardCount !== undefined && <small>{player.cardCount} owned</small>}</span></Link>)}</div>
    </aside>
    <main className="alt-main">
      <header className="alt-topbar"><div className="alt-topbar-spacer" />{topRight}<button className="alt-pill alt-style-toggle" type="button" onClick={onToggleStyle} aria-label="Switch to Classic UI">Classic</button></header>
      <div className="alt-greeting">{typeof title === "string" ? <h1>{title}</h1> : title}{subtitle && <p>{subtitle}</p>}</div>
      {children}
      <div className="alt-footer-space" />
    </main>
    {nowPlaying && <footer className="alt-nowbar">{nowPlaying}</footer>}
    <nav className="alt-tabbar" aria-label="League navigation (mobile)">{nav.map((item) => {
      const isActive = activeNav === item.id;
      return <Link className={isActive ? "active" : ""} href={item.href} key={item.id} aria-current={isActive ? "page" : undefined}>{item.label}</Link>;
    })}</nav>
  </div>;
}
