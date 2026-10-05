"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AltPageState } from "./AltPageState";
import { PlayerAvatar } from "./PlayerAvatar";
import { altSectionHref, useAltBrowsing, type AltBrowsing, type AltSection, type AltShellPlayer } from "./useAltPlayer";
import { useLeagueState, type LeaguePlayer } from "./useLeaguePlayers";

export type AltPlayer = { id: string; name: string; cardCount?: number };
export type AltNav = AltSection | "analytics" | "home" | "admin";
export type { AltShellPlayer };

export type AltNavItem = { id: AltSection | "analytics"; label: string; hint?: string; href?: string; unavailable?: string };

const SECTION_LABELS: Record<AltSection, string> = { collection: "Collection", decks: "Decks", matches: "Matches" };

/** Collection, Decks, Matches follow the browsing player; Analytics is league-wide. */
export function altNavItems(browsing: AltBrowsing): AltNavItem[] {
  const sections = (["collection", "decks", "matches"] as const).map((id): AltNavItem => {
    const label = SECTION_LABELS[id];
    if (browsing.kind === "player" || (browsing.kind === "pending" && browsing.linkable)) return { id, label, href: altSectionHref(browsing.id, id) };
    if (browsing.kind === "pending" || (browsing.kind === "none" && browsing.reason === "loading")) return { id, label, unavailable: "Loading players…" };
    if (browsing.kind === "none" && browsing.reason === "empty") return { id, label, unavailable: "No players yet" };
    return { id, label, href: `/?next=${id}` };
  });
  return [...sections, { id: "analytics", label: "Analytics", hint: "All players", href: "/analytics" }];
}

export function playerSwitchHref(playerId: string, activeNav: AltNav) {
  return altSectionHref(playerId, activeNav === "decks" || activeNav === "matches" ? activeNav : "collection");
}

export function filterPlayers(players: LeaguePlayer[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return needle ? players.filter((player) => player.name.toLocaleLowerCase().includes(needle)) : players;
}

function PlayerSwitcher({ browsing, activeNav }: { browsing: AltBrowsing; activeNav: AltNav }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const { players, status, error, retry } = useLeagueState(open);
  const name = browsing.kind === "player" ? browsing.name
    : browsing.kind === "pending" ? "Loading…"
      : browsing.kind === "missing" ? "Player not found"
        : browsing.reason === "loading" ? "Loading…"
          : browsing.reason === "error" ? "Players unavailable"
            : browsing.reason === "empty" ? "No players yet" : "No player selected";
  const matches = useMemo(() => filterPlayers(players ?? [], query), [players, query]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="alt-player-switcher" ref={rootRef}>
    <button className={`alt-player-chip ${browsing.kind === "player" ? "" : "is-empty"}`} type="button" onClick={() => { setOpen((value) => !value); setQuery(""); }} aria-haspopup="dialog" aria-expanded={open}>
      <span className="alt-player-chip-avatar" aria-hidden="true">{browsing.kind === "player" ? <PlayerAvatar name={browsing.name} iconCard={browsing.iconCard} size={32} /> : <span className="alt-avatar">?</span>}</span>
      <span className="alt-player-chip-text"><small>{browsing.kind === "player" || browsing.kind === "pending" ? "Browsing" : "Current player"}</small><strong>{name}</strong></span>
      <span className="alt-player-chip-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="alt-player-menu" role="dialog" aria-label="Switch player">
      <label className="alt-player-search"><input aria-label="Search players" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players…" autoFocus /></label>
      <div className="alt-player-options">
        {status === "loading" && <p className="alt-player-menu-state">Loading players…</p>}
        {status === "error" && <div className="alt-player-menu-state"><p>{error || "Could not load players."}</p><button type="button" onClick={retry}>Try again</button></div>}
        {status === "ready" && matches.length === 0 && <p className="alt-player-menu-state">{query.trim() ? "No matching players" : "No players yet"}</p>}
        {matches.map((entry) => <Link className={browsing.kind === "player" && browsing.id === entry.id ? "is-current" : ""} href={playerSwitchHref(entry.id, activeNav)} key={entry.id} onClick={() => setOpen(false)}>
          <PlayerAvatar name={entry.name} iconCard={entry.iconCard} size={36} />
          <span><strong>{entry.name}</strong><small>{entry.cardCount} cards · {entry.deckCount} decks</small></span>
          {browsing.kind === "player" && browsing.id === entry.id && <span className="alt-player-current">Current</span>}
        </Link>)}
      </div>
    </div>}
  </div>;
}

function NavEntry({ item, active, mobile }: { item: AltNavItem; active: boolean; mobile?: boolean }) {
  const content = mobile ? <>{item.label}{item.unavailable && <small>{item.unavailable}</small>}</> : <><span>{item.label}</span>{(item.unavailable || item.hint) && <small>{item.unavailable || item.hint}</small>}</>;
  if (!item.href) return <span className="alt-nav-unavailable" aria-disabled="true" title={item.unavailable}>{content}</span>;
  return <Link className={active ? "active" : ""} href={item.href} aria-current={active ? "page" : undefined}>{content}</Link>;
}

export function AltShell({ children, title, subtitle, topRight, activeNav, player, nowPlaying }: {
  children: ReactNode; title: ReactNode; subtitle?: string; topRight?: ReactNode; activeNav: AltNav;
  /** The page's player: the route player on /p/:id/* (name once validated, missing if confirmed absent). */
  player?: AltShellPlayer; nowPlaying?: ReactNode;
}) {
  const { browsing } = useAltBrowsing(player);
  const nav = altNavItems(browsing);
  const onChooser = activeNav === "home";
  const showChip = !onChooser || browsing.kind === "player" || browsing.kind === "pending";
  return <div className={`alt-ui-root ${nowPlaying ? "alt-has-nowbar" : ""}`}>
    <aside className="alt-sidebar">
      <Link className="alt-brand" href="/"><span>F</span><div><strong>FRA League</strong><small>Reality Fracture</small></div></Link>
      <nav className="alt-nav" aria-label="League navigation">{nav.map((item) => <NavEntry item={item} active={activeNav === item.id} key={item.id} />)}</nav>
    </aside>
    <main className="alt-main">
      <header className="alt-topbar">
        <div className="alt-topbar-context">{showChip && <PlayerSwitcher browsing={browsing} activeNav={activeNav} />}</div>
        <div className="alt-topbar-spacer" />{topRight}
      </header>
      <div className="alt-greeting">{typeof title === "string" ? <h1>{title}</h1> : title}{subtitle && <p>{subtitle}</p>}</div>
      {children}
      <div className="alt-footer-space" />
    </main>
    {nowPlaying && <footer className="alt-nowbar">{nowPlaying}</footer>}
    <nav className="alt-tabbar" aria-label="League navigation (mobile)">{nav.map((item) => <NavEntry item={item} active={activeNav === item.id} mobile key={item.id} />)}</nav>
  </div>;
}

/** Page-specific wording for AltPlayerPageState's loading and load-failure states. */
export type AltPlayerPageCopy = { loading: string; loadingDetail: string; unavailable: string; failed: string };

/**
 * Shell for a player page that has not loaded: loading, load failure (with retry), or a
 * confirmed-missing player. A missing player gets a way back to the chooser, never a substitute.
 */
export function AltPlayerPageState({ profileId, activeNav, copy, error, notFound, onRetry }: {
  profileId: string; activeNav: AltSection; copy: AltPlayerPageCopy; error?: string; notFound?: boolean; onRetry?: () => void;
}) {
  if (notFound) return <AltShell title="Player not found" activeNav={activeNav} player={{ id: profileId, missing: true }}>
    <section className="alt-page-section alt-state-panel" role="alert"><h2>This player doesn&apos;t exist</h2><p>The link may be out of date, or the player was removed.</p><Link className="alt-pill alt-primary" href="/">Choose a player</Link></section>
  </AltShell>;
  if (error) return <AltShell title={copy.unavailable} activeNav={activeNav} player={{ id: profileId }}>
    <AltPageState title={copy.failed} onRetry={onRetry}>{error}</AltPageState>
  </AltShell>;
  return <AltShell title={`${copy.loading}…`} activeNav={activeNav} player={{ id: profileId }}><AltPageState title={copy.loading} busy>{copy.loadingDetail}</AltPageState></AltShell>;
}
