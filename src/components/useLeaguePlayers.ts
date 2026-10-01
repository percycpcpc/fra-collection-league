"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { jsonFetch } from "@/lib/client";
import type { AltPlayer } from "./AltShell";

export type LeaguePlayer = { id: string; name: string; cardCount: number; iconCard: string | null; createdAt: string; deckCount: number; };
/** loading: no list yet; ready: a list has loaded (it may be empty); error: the load failed and no list is cached. */
export type LeagueStatus = "loading" | "ready" | "error";
export type LeagueState = { players: LeaguePlayer[] | null; status: LeagueStatus; error: string };

let cachedPlayers: LeaguePlayer[] | null = null;
let cachedAt = 0;
let inFlight: Promise<LeaguePlayer[]> | null = null;
let state: LeagueState = { players: null, status: "loading", error: "" };
const SERVER_STATE: LeagueState = { players: null, status: "loading", error: "" };
const listeners = new Set<() => void>();
const CACHE_TTL_MS = 60_000;

function setState(next: LeagueState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return SERVER_STATE;
}

function requestPlayers(force: boolean): Promise<LeaguePlayer[]> {
  if (inFlight) {
    if (!force) return inFlight;
    return inFlight.then(
      () => requestPlayers(true),
      () => requestPlayers(true),
    );
  }
  if (!force && cachedPlayers && Date.now() - cachedAt < CACHE_TTL_MS) return Promise.resolve(cachedPlayers);

  if (!cachedPlayers && state.status === "error") setState({ players: null, status: "loading", error: "" });
  inFlight = jsonFetch<{ profiles: LeaguePlayer[] }>("/api/profiles")
    .then(({ profiles }) => {
      cachedPlayers = profiles.map(({ id, name, cardCount, iconCard, createdAt, deckCount }) => ({
        id, name, cardCount, iconCard, createdAt, deckCount,
      }));
      cachedAt = Date.now();
      setState({ players: cachedPlayers, status: "ready", error: "" });
      return cachedPlayers;
    }, (cause: unknown) => {
      // A failed refresh keeps the last good list; only a first load reports an error state.
      if (!cachedPlayers) setState({ players: null, status: "error", error: cause instanceof Error ? cause.message : "Could not load players." });
      throw cause;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function getLeagueState() {
  return state;
}

export function refreshLeaguePlayers() {
  return requestPlayers(true);
}

export function loadLeaguePlayers() {
  return requestPlayers(false);
}

/** League list plus its load status. Pass enabled=false to read without triggering a fetch. */
export function useLeagueState(enabled = true) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (enabled) void loadLeaguePlayers().catch(() => undefined);
  }, [enabled]);
  const retry = useCallback(() => refreshLeaguePlayers().catch(() => undefined), []);
  return { ...snapshot, retry };
}

export function useLeaguePlayers(currentProfile?: AltPlayer) {
  const { players: snapshot, status, error } = useLeagueState();
  const fallback = useMemo(() => currentProfile ? [currentProfile] : [], [currentProfile]);
  const refresh = useCallback(() => refreshLeaguePlayers(), []);
  return { players: snapshot ?? fallback, status, error, refresh };
}

export function resetLeaguePlayersCacheForTests() {
  cachedPlayers = null;
  cachedAt = 0;
  inFlight = null;
  state = { players: null, status: "loading", error: "" };
  listeners.clear();
}
