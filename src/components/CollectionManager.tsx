"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AltCollectionView } from "./AltCollectionView";
import { AltPlayerPageState } from "./AltShell";
import { refreshLeaguePlayers } from "./useLeaguePlayers";
import { isNotFound, jsonFetch, type CatalogCard, type CollectionCard } from "@/lib/client";
import { LatestWriteQueue } from "@/lib/latest-write-queue";
import { MutationLock } from "@/lib/mutation-lock";

type ProfileData = { profile: { id: string; name: string; iconCard: string | null }; cards: CollectionCard[] };
type PendingEdits = Record<string, Partial<Pick<CollectionCard, "qty" | "owned">>>;
const GROUPS = ["White", "Blue", "Black", "Red", "Green", "Multi", "Colorless"];
const RARITY: Record<string, number> = { mythic: 0, rare: 1, uncommon: 2, common: 3 };

function colorGroup(card?: CatalogCard) {
  if (!card) return "Unknown";
  const value = card.colors.toLowerCase();
  if (value.includes(",") || value.includes("multi") || value.split(/\s+/).length > 1) return "Multi";
  return ({ white: "White", blue: "Blue", black: "Black", red: "Red", green: "Green", colorless: "Colorless" } as Record<string, string>)[value] || "Colorless";
}

export function CollectionManager({ profileId }: { profileId: string }) {
  const [profile, setProfile] = useState<ProfileData["profile"] | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<PendingEdits>({});
  const [loadError, setLoadError] = useState<{ message: string; notFound: boolean } | null>(null);
  const saveQueue = useRef<LatestWriteQueue<{ name: string; qty: number; owned: boolean }> | null>(null);
  const importLock = useRef(new MutationLock());
  const storageKey = `fra-pending-${profileId}`;

  const readPending = useCallback((): PendingEdits => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); }
    catch { return {}; }
  }, [storageKey]);

  const writePending = useCallback((edits: PendingEdits) => {
    if (Object.keys(edits).length) localStorage.setItem(storageKey, JSON.stringify(edits));
    else localStorage.removeItem(storageKey);
    setPendingEdits(edits);
  }, [storageKey]);

  const load = useCallback(async (throwOnError = false) => {
    setLoading(true); setMessage("");
    try {
      const [data, cat] = await Promise.all([jsonFetch<ProfileData>(`/api/profiles/${profileId}`), jsonFetch<CatalogCard[]>("/api/catalog")]);
      let loaded = data.cards;
      const edits = readPending();
      if (Object.keys(edits).length) {
        const recovered = new Map(loaded.map((card) => [card.name.toLowerCase(), card]));
        Object.entries(edits).forEach(([name, edit]) => {
          const key = name.toLowerCase();
          const current = recovered.get(key);
          const next = { id: "", profileId, name, qty: 1, owned: true, ...current, ...edit };
          if (next.qty === 0) recovered.delete(key); else recovered.set(key, next);
        });
        loaded = [...recovered.values()];
      }
      setPendingEdits(edits);
      setProfile(data.profile); setCards(loaded); setCatalog(cat); setLoadError(null);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Could not load collection.";
      setMessage(text); setLoadError({ message: text, notFound: isNotFound(cause, `/api/profiles/${profileId}`) });
      if (throwOnError) throw cause;
    } finally { setLoading(false); }
  }, [profileId, readPending]);
  useEffect(() => { void load(); }, [load]);

  if (!saveQueue.current) {
    saveQueue.current = new LatestWriteQueue(
      async (value) => {
        await jsonFetch(`/api/profiles/${profileId}/cards`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
        const latest = readPending();
        if (latest[value.name]?.qty === value.qty && latest[value.name]?.owned === value.owned) delete latest[value.name];
        writePending(latest);
      },
      {
        onError: (cause) => { setStatus("error"); setMessage(cause instanceof Error ? cause.message : "Save failed."); },
        onChange: () => queueMicrotask(() => {
          if (saveQueue.current?.isPending()) setStatus("saving");
          else setStatus((current) => current === "error" ? current : "saved");
        }),
      },
    );
  }

  const catalogMap = useMemo(() => new Map(catalog.map((card) => [card.name.toLocaleLowerCase(), card])), [catalog]);
  const collectionMap = useMemo(() => new Map(cards.map((card) => [card.name.toLocaleLowerCase(), card])), [cards]);
  const grouped = useMemo(() => {
    const result = new Map(GROUPS.map((group) => [group, [] as CatalogCard[]]));
    catalog.filter((card) => card.name.toLowerCase().includes(search.toLowerCase())).forEach((card) => result.get(colorGroup(card))?.push(card));
    result.forEach((items) => items.sort((a, b) => (RARITY[a.rarity.toLowerCase()] ?? 9) - (RARITY[b.rarity.toLowerCase()] ?? 9) || a.name.localeCompare(b.name)));
    return result;
  }, [catalog, search]);
  const groupTotals = useMemo(() => {
    const totals = new Map(GROUPS.map((group) => [group, 0]));
    catalog.forEach((card) => totals.set(colorGroup(card), (totals.get(colorGroup(card)) || 0) + 1));
    return totals;
  }, [catalog]);
  const ownedCount = catalog.reduce((sum, card) => sum + (collectionMap.get(card.name.toLowerCase())?.owned ? 1 : 0), 0);
  const ownedIconCards = useMemo(() => catalog.filter((card) => collectionMap.get(card.name.toLowerCase())?.owned && card.name.toLowerCase().includes(iconSearch.toLowerCase())), [catalog, collectionMap, iconSearch]);

  async function saveCard(name: string, patch: { qty?: number; owned?: boolean }) {
    const card = collectionMap.get(name.toLowerCase()) || { id: "", profileId, name, qty: 1, owned: true };
    const next = { ...card, ...patch };
    setCards((current) => {
      const exists = current.some((item) => item.name.toLowerCase() === name.toLowerCase());
      if (patch.qty === 0) return current.filter((item) => item.name.toLowerCase() !== name.toLowerCase());
      if (!exists) return [...current, next];
      return current.map((item) => item.name.toLowerCase() === name.toLowerCase() ? next : item);
    });
    const pending = readPending();
    pending[card.name] = { ...pending[card.name], qty: next.qty, owned: next.owned };
    writePending(pending);
    setStatus("saving"); setMessage("");
    saveQueue.current?.enqueue(name.toLowerCase(), { name, qty: next.qty, owned: next.owned });
  }

  async function retryUnsynced() {
    const remaining = readPending();
    setStatus("saving"); setMessage("");
    let failed = 0;
    for (const [name, patch] of Object.entries({ ...remaining })) {
      try {
        await jsonFetch(`/api/profiles/${profileId}/cards`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...patch }) });
        delete remaining[name];
        writePending({ ...remaining });
      } catch { failed += 1; }
    }
    if (failed) { setStatus("error"); setMessage(`${failed} ${failed === 1 ? "change" : "changes"} still could not be saved.`); }
    else { setStatus("saved"); setMessage("All recovered changes are saved."); }
  }

  async function discardUnsynced() {
    writePending({}); setStatus("idle"); setMessage("");
    await load();
  }

  async function renameProfile(name: string) {
    if (!profile) return;
    try { const data = await jsonFetch<{ profile: ProfileData["profile"] }>(`/api/profiles/${profileId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); setProfile(data.profile); refreshLeaguePlayers().catch(() => undefined); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Rename failed."); throw cause; }
  }

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "");
    void renameProfile(name).catch(() => undefined);
  }

  async function setIcon(iconCard: string | null) {
    setStatus("saving"); setMessage("");
    try {
      const data = await jsonFetch<{ profile: ProfileData["profile"] }>(`/api/profiles/${profileId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ iconCard }) });
      setProfile(data.profile); setIconPickerOpen(false); setIconSearch(""); setStatus("saved");
      refreshLeaguePlayers().catch(() => undefined);
    } catch (cause) { setStatus("error"); setMessage(cause instanceof Error ? cause.message : "Icon save failed."); }
  }

  async function runImport() {
    setMessage("");
    if (!importLock.current.tryAcquire()) return;
    setImporting(true);
    try { const result = await jsonFetch<{ added: number; updated: number; unknown: string[] }>(`/api/profiles/${profileId}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: importText }) }); setImportText(""); setMessage(`Imported ${result.added} new and updated ${result.updated}.${result.unknown.length ? ` Unknown: ${result.unknown.join(", ")}` : ""}`); refreshLeaguePlayers().catch(() => undefined); try { await load(true); } catch { setMessage("Import saved, but the collection could not be refreshed. Reload to try again."); } }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Import failed."); }
    finally { importLock.current.release(); setImporting(false); }
  }

  function exportText() {
    return cards.filter((card) => card.owned).sort((a, b) => a.name.localeCompare(b.name)).map((card) => `${card.qty} ${card.name}${catalogMap.has(card.name.toLowerCase()) ? " (FRA)" : ""}`).join("\n");
  }
  async function copyOwned() { await navigator.clipboard.writeText(exportText()); setMessage("Owned list copied."); }
  function download() { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([exportText()], { type: "text/plain" })); link.download = `${profile?.name || "collection"}-FRA.txt`; link.click(); URL.revokeObjectURL(link.href); }

  // The route id is authoritative, so another player's data still in state counts as loading.
  if (!profile || profile.id !== profileId) {
    return <AltPlayerPageState profileId={profileId} activeNav="collection" copy={{ loading: "Loading collection", loadingDetail: "Fetching the player and card catalog.", unavailable: "Collection unavailable", failed: "We couldn't load this collection" }} error={loading ? undefined : loadError?.message} notFound={!loading && loadError?.notFound} onRetry={() => void load()} />;
  }
  return <AltCollectionView
    profile={profile} catalog={catalog} cards={cards} importText={importText} message={message} status={status}
    search={search} selectedName={selectedName} importOpen={importOpen} unsyncedCount={Object.keys(pendingEdits).length}
    onImportTextChange={setImportText} onSearchChange={setSearch} onSelectedNameChange={setSelectedName} onImportOpenChange={setImportOpen}
    onImport={() => void runImport()} importing={importing} onRename={renameProfile}
    onSaveCard={(name, patch) => void saveCard(name, patch)} onRetryUnsynced={() => void retryUnsynced()} onDiscardUnsynced={() => void discardUnsynced()}
  />;
}
