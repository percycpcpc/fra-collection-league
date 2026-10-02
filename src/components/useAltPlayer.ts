"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLeagueState, type LeagueState } from "./useLeaguePlayers";
import { altSectionHref, parseAltSection, type AltSection } from "@/lib/alt-sections";

export { altSectionHref, parseAltSection, type AltSection };

/**
 * The Alt UI's browsing player: one per tab. localStorage only seeds it once per page
 * load (a resume preference); later writes come from this tab alone, so another tab
 * picking a different player never switches this one.
 */
export const ALT_PLAYER_KEY = "fra-alt-player";

/** A validated player as last seen: enough to paint the topbar chip before the page's own fetch resolves. */
export type AltPlayerSnapshot = { id: string; name: string; iconCard: string | null };
/** A legacy bare-id storage value carries no name, so it can resume a selection but not seed the chip. */
export type RememberedAltPlayer = { id: string; name?: string; iconCard: string | null };

let loaded = false;
let selected: RememberedAltPlayer | null = null;
const listeners = new Set<() => void>();

function parseStored(raw: string | null): RememberedAltPlayer | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object") {
      const { id, name, iconCard } = value as Record<string, unknown>;
      if (typeof id !== "string" || !id) return null;
      return { id, name: typeof name === "string" ? name : undefined, iconCard: typeof iconCard === "string" ? iconCard : null };
    }
  } catch { /* Not JSON: a legacy bare id. */ }
  return { id: raw, iconCard: null };
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try { selected = parseStored(window.localStorage.getItem(ALT_PLAYER_KEY)); } catch { selected = null; }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRememberedAltPlayerSnapshot() {
  if (typeof window === "undefined") return null;
  ensureLoaded();
  return selected;
}

export function getRememberedAltPlayer() {
  return getRememberedAltPlayerSnapshot()?.id ?? null;
}

/** Records a player that has been validated to exist. */
export function rememberAltPlayer({ id, name, iconCard }: AltPlayerSnapshot) {
  ensureLoaded();
  if (selected && selected.id === id && selected.name === name && selected.iconCard === iconCard) return;
  selected = { id, name, iconCard };
  try { window.localStorage.setItem(ALT_PLAYER_KEY, JSON.stringify(selected)); } catch { /* Storage unavailable: keep the in-memory selection. */ }
  emit();
}

/** Clears the selection, but only when it is the player confirmed to be absent. */
export function forgetAltPlayer(id: string) {
  ensureLoaded();
  if (selected?.id !== id) return;
  selected = null;
  try { window.localStorage.removeItem(ALT_PLAYER_KEY); } catch { /* Storage unavailable. */ }
  emit();
}

export function useRememberedAltPlayerSnapshot() {
  return useSyncExternalStore(subscribe, getRememberedAltPlayerSnapshot, () => null);
}

export function useRememberedAltPlayer() {
  return useSyncExternalStore(subscribe, getRememberedAltPlayer, () => null);
}

export function resetAltPlayerForTests() {
  loaded = false;
  selected = null;
  listeners.clear();
}

/** A player supplied by the page: the route player on /p/:id/*, named once its profile loaded. */
export type AltShellPlayer = { id: string; name?: string; iconCard?: string | null; missing?: boolean };

export type AltBrowsing =
  | { kind: "player"; id: string; name: string; iconCard: string | null }
  /** linkable: a route id (authoritative) awaiting its profile; otherwise a remembered id awaiting the league list. */
  | { kind: "pending"; id: string; linkable: boolean }
  | { kind: "missing"; id: string }
  | { kind: "none"; reason: "loading" | "error" | "empty" | "unselected" };

type BrowsingInput = { player?: AltShellPlayer; remembered: RememberedAltPlayer | null; league: Pick<LeagueState, "players" | "status"> };

/**
 * Names a route player whose profile has not loaded yet, so a shell remounted by client
 * navigation paints the chip on its first render: the league list (current, rename-aware)
 * first, then this tab's remembered snapshot of the same id.
 */
function knownRoutePlayer({ player, remembered, league }: BrowsingInput): (AltPlayerSnapshot & { fromLeague: boolean }) | null {
  if (!player || player.missing || player.name !== undefined) return null;
  const listed = league.status === "ready" ? league.players?.find((entry) => entry.id === player.id) : undefined;
  if (listed) return { id: listed.id, name: listed.name, iconCard: listed.iconCard, fromLeague: true };
  if (remembered?.id === player.id && remembered.name !== undefined) return { id: remembered.id, name: remembered.name, iconCard: remembered.iconCard, fromLeague: false };
  return null;
}

export function resolveAltBrowsing(input: BrowsingInput): AltBrowsing {
  const { player, remembered, league } = input;
  if (player) {
    if (player.missing) return { kind: "missing", id: player.id };
    if (player.name === undefined) {
      const known = knownRoutePlayer(input);
      return known ? { kind: "player", id: known.id, name: known.name, iconCard: known.iconCard } : { kind: "pending", id: player.id, linkable: true };
    }
    return { kind: "player", id: player.id, name: player.name, iconCard: player.iconCard ?? null };
  }
  const rememberedId = remembered?.id ?? null;
  if (league.status === "loading") return rememberedId ? { kind: "pending", id: rememberedId, linkable: false } : { kind: "none", reason: "loading" };
  if (league.status === "error" || !league.players) return { kind: "none", reason: "error" };
  const found = rememberedId ? league.players.find((entry) => entry.id === rememberedId) : undefined;
  if (found) return { kind: "player", id: found.id, name: found.name, iconCard: found.iconCard };
  return { kind: "none", reason: league.players.length === 0 ? "empty" : "unselected" };
}

/**
 * Resolves the browsing player for an Alt page. A page player (the route) always wins and
 * is remembered once validated (its profile loaded, or the league list contains it); a
 * matching remembered snapshot only names it meanwhile. Otherwise the remembered selection
 * is checked against the league list and cleared only on confirmed absence. Never falls
 * back to another player.
 */
export function useAltBrowsing(player?: AltShellPlayer) {
  const remembered = useRememberedAltPlayerSnapshot();
  const league = useLeagueState(!player);
  const input = { player, remembered, league };
  const browsing = resolveAltBrowsing(input);
  const known = knownRoutePlayer(input);
  const validated: AltPlayerSnapshot | null = player && !player.missing && player.name !== undefined
    ? { id: player.id, name: player.name, iconCard: player.iconCard ?? null }
    : known?.fromLeague ? known : null;
  const missingId = player?.missing ? player.id : null;
  const rememberedId = remembered?.id ?? null;
  const absentId = !player && rememberedId && league.status === "ready" && league.players && !league.players.some((entry) => entry.id === rememberedId) ? rememberedId : null;
  const validatedId = validated?.id ?? null, validatedName = validated?.name, validatedIcon = validated?.iconCard ?? null;
  useEffect(() => {
    if (validatedId && validatedName !== undefined) rememberAltPlayer({ id: validatedId, name: validatedName, iconCard: validatedIcon });
  }, [validatedId, validatedName, validatedIcon]);
  useEffect(() => { if (missingId) forgetAltPlayer(missingId); }, [missingId]);
  useEffect(() => { if (absentId) forgetAltPlayer(absentId); }, [absentId]);
  return { browsing, league };
}
