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

let loaded = false;
let selected: string | null = null;
const listeners = new Set<() => void>();

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try { selected = window.localStorage.getItem(ALT_PLAYER_KEY) || null; } catch { selected = null; }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRememberedAltPlayer() {
  if (typeof window === "undefined") return null;
  ensureLoaded();
  return selected;
}

/** Records a player that has been validated to exist. */
export function rememberAltPlayer(id: string) {
  ensureLoaded();
  if (selected === id) return;
  selected = id;
  try { window.localStorage.setItem(ALT_PLAYER_KEY, id); } catch { /* Storage unavailable: keep the in-memory selection. */ }
  emit();
}

/** Clears the selection, but only when it is the player confirmed to be absent. */
export function forgetAltPlayer(id: string) {
  ensureLoaded();
  if (selected !== id) return;
  selected = null;
  try { window.localStorage.removeItem(ALT_PLAYER_KEY); } catch { /* Storage unavailable. */ }
  emit();
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

export function resolveAltBrowsing({ player, rememberedId, league }: { player?: AltShellPlayer; rememberedId: string | null; league: Pick<LeagueState, "players" | "status"> }): AltBrowsing {
  if (player) {
    if (player.missing) return { kind: "missing", id: player.id };
    if (player.name === undefined) return { kind: "pending", id: player.id, linkable: true };
    return { kind: "player", id: player.id, name: player.name, iconCard: player.iconCard ?? null };
  }
  if (league.status === "loading") return rememberedId ? { kind: "pending", id: rememberedId, linkable: false } : { kind: "none", reason: "loading" };
  if (league.status === "error" || !league.players) return { kind: "none", reason: "error" };
  const found = rememberedId ? league.players.find((entry) => entry.id === rememberedId) : undefined;
  if (found) return { kind: "player", id: found.id, name: found.name, iconCard: found.iconCard };
  return { kind: "none", reason: league.players.length === 0 ? "empty" : "unselected" };
}

/**
 * Resolves the browsing player for an Alt page. A page player (the route) always wins and
 * is remembered once validated; otherwise the remembered selection is checked against the
 * league list and cleared only on confirmed absence. Never falls back to another player.
 */
export function useAltBrowsing(player?: AltShellPlayer) {
  const rememberedId = useRememberedAltPlayer();
  const league = useLeagueState(!player);
  const browsing = resolveAltBrowsing({ player, rememberedId, league });
  const validatedId = player && !player.missing && player.name !== undefined ? player.id : null;
  const missingId = player?.missing ? player.id : null;
  const absentId = !player && rememberedId && league.status === "ready" && league.players && !league.players.some((entry) => entry.id === rememberedId) ? rememberedId : null;
  useEffect(() => { if (validatedId) rememberAltPlayer(validatedId); }, [validatedId]);
  useEffect(() => { if (missingId) forgetAltPlayer(missingId); }, [missingId]);
  useEffect(() => { if (absentId) forgetAltPlayer(absentId); }, [absentId]);
  return { browsing, league };
}
