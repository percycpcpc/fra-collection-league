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
let inFlight: Promise<LeaguePlayer[]> | null = null;
const listeners = new Set<() => void>();

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
  if (inFlight) return inFlight;
  if (!force && cachedPlayers) return Promise.resolve(cachedPlayers);

  inFlight = jsonFetch<{ profiles: LeaguePlayer[] }>("/api/profiles")
    .then(({ profiles }) => {
      cachedPlayers = profiles.map(({ id, name, cardCount, iconCard, createdAt, deckCount }) => ({
        id, name, cardCount, iconCard, createdAt, deckCount,
      }));
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
  inFlight = null;
  listeners.clear();
}
