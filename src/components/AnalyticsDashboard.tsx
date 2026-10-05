"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { AltAnalytics } from "./AltAnalytics";
import { AltShell } from "./AltShell";
import { AltPageState } from "./AltPageState";

type Player = { id: string; name: string; iconCard: string | null; ownedCards: number; ownedQty: number; byRarity: Record<"common" | "uncommon" | "rare" | "mythic", number>; completionPct: number };
type Card = { name: string; rarity: string; colors: string; img: string; owners: number; totalQty: number };
type SortKey = "owners" | "totalQty" | "name";

export function AnalyticsDashboard() {
  const [data, setData] = useState<{ players: Player[]; cards: Card[] } | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "owners", direction: "desc" });
  const load = useCallback(() => { setError(""); return jsonFetch<{ players: Player[]; cards: Card[] }>("/api/analytics").then(setData).catch((cause) => setError(cause.message)); }, []);
  useEffect(() => { void load(); }, [load]);

  const cards = useMemo(() => (data?.cards ?? []).filter((card) => card.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    const result = sort.key === "name" ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key];
    return (sort.direction === "asc" ? result : -result) || a.name.localeCompare(b.name);
  }), [data, search, sort]);
  const players = useMemo(() => [...(data?.players ?? [])].sort((a, b) => b.ownedCards - a.ownedCards || a.name.localeCompare(b.name)), [data]);
  function toggleSort(key: SortKey) { setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" })); }
  function heading(key: SortKey, label: string) { return <button className="sort-button" type="button" onClick={() => toggleSort(key)}>{label} {sort.key === key ? (sort.direction === "desc" ? "↓" : "↑") : ""}</button>; }

  if (!data) {
    return <AltShell title={error ? "Analytics unavailable" : "Loading analytics…"} activeNav="analytics"><AltPageState title={error ? "We couldn't load analytics" : "Loading analytics"} busy={!error} onRetry={error ? () => void load() : undefined}>{error || "Calculating league collection coverage."}</AltPageState></AltShell>;
  }
  return <AltAnalytics players={players} cards={cards} search={search} onSearch={setSearch} />;
}
