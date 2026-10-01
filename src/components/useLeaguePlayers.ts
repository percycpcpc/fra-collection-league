"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { jsonFetch } from "@/lib/client";
import type { AltPlayer } from "./AltShell";

export type LeaguePlayer = AltPlayer & {
  iconCard: string | null;
  createdAt: string;
  deckCount: number;
};

let cachedPlayers: LeaguePlayer[] | null = null;
let cachedAt = 0;
let inFlight: Promise<LeaguePlayer[]> | null = null;
const listeners = new Set<() => void>();
const CACHE_TTL_MS = 60_000;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cachedPlayers;
}

function requestPlayers(force: boolean) {
  if (inFlight) {
    if (!force) return inFlight;
    return inFlight.then(
      () => requestPlayers(true),
      () => requestPlayers(true),
    );
  }
  if (!force && cachedPlayers && Date.now() - cachedAt < CACHE_TTL_MS) return Promise.resolve(cachedPlayers);

  inFlight = jsonFetch<{ profiles: LeaguePlayer[] }>("/api/profiles")
    .then(({ profiles }) => {
      cachedPlayers = profiles.map(({ id, name, cardCount, iconCard, createdAt, deckCount }) => ({
        id, name, cardCount, iconCard, createdAt, deckCount,
      }));
      cachedAt = Date.now();
      emitChange();
      return cachedPlayers;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function refreshLeaguePlayers() {
  return requestPlayers(true);
}

export function loadLeaguePlayers() {
  return requestPlayers(false);
}

export function useLeaguePlayers(currentProfile?: AltPlayer) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const fallback = useMemo(() => currentProfile ? [currentProfile] : [], [currentProfile]);

  useEffect(() => {
    void loadLeaguePlayers().catch(() => undefined);
  }, []);

  const refresh = useCallback(() => refreshLeaguePlayers(), []);
  return { players: snapshot ?? fallback, refresh };
}

export function resetLeaguePlayersCacheForTests() {
  cachedPlayers = null;
  cachedAt = 0;
  inFlight = null;
  listeners.clear();
}
