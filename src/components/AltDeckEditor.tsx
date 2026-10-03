"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CardImage } from "./CardImage";
import { ManaCost } from "./ManaCost";
import { DeckAnalysis } from "./DeckAnalysis";
import { AltShell } from "./AltShell";
import { AltCardSection } from "./AltCardSection";
import { AltSectionNav } from "./AltSectionNav";
import { CardTypeIcon } from "./CardTypeIcon";
import type { CatalogCard, CollectionCard, DeckCard } from "@/lib/client";
import { BASIC_LANDS_GROUP, type PoolGroup } from "@/lib/deck-pool";
import {
  DECK_DISPLAY_GROUPS,
  classifyDeckDisplayGroup,
  type DeckDisplayGroupId,
} from "@/lib/card-type-groups";
import {
  ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY,
  ALT_POOL_GROUPING_STORAGE_KEY,
  ALT_POOL_TYPE_COLLAPSED_STORAGE_KEY,
  readGroupingPreference,
  readIdSet,
  readSectionNavCompaction,
  writeGroupingPreference,
  writeIdSet,
  writeSectionNavCompaction,
  type AltGrouping,
} from "@/lib/alt-group-preferences";

export type AltDeckViewMode = "images" | "list";
export const ALT_DECK_DEFAULT_VIEW_MODE: AltDeckViewMode = "list";
type Props = {
  initialCollapsedGroups?: string[];
  initialContentsCollapsed?: DeckDisplayGroupId[];
  initialPoolGrouping?: AltGrouping;
  initialPoolTypeCollapsed?: string[];
  initialPoolFilter?: string | null;
  profileId: string;
  profileName: string;
  profileIcon?: string | null;
  deckName: string;
  renameDraft: string;
  cards: DeckCard[];
  catalog: CatalogCard[];
  collection: CollectionCard[];
  poolGroups: PoolGroup<CollectionCard>[];
  basics: string[];
  hiddenPoolCount: number;
  search: string;
  showOffColor: boolean;
  viewMode: AltDeckViewMode;
  status?: string;
  error?: string;
  commanderNames: string[];
  eligibleCommanderNames: string[];
  hasCommanderIdentity: boolean;
  onSearch: (value: string) => void;
  onRenameDraft: (value: string) => void;
  onShowOffColor: (value: boolean) => void;
  onViewMode: (mode: AltDeckViewMode) => void;
  onQty: (name: string, qty: number) => void;
  onCommander: (name: string) => void;
  onRename: (name: string) => void;
  onToggleStyle: () => void;
  isOffColor: (name: string, isBasic: boolean) => boolean;
};
const COLOR_CLASS: Record<string, string> = {
  White: "white",
  Blue: "blue",
  Black: "black",
  Red: "red",
  Green: "green",
  Colorless: "colorless",
  Multicolor: "multicolor",
};
/** Shared with the Classic editor so collapsed pool groups survive a style switch. */
export const ALT_COLLAPSED_STORAGE_KEY = "fra-deck-collapsed";
type GroupStorage = Pick<Storage, "getItem" | "setItem">;

/** Reads persisted collapsed pool groups; bad JSON or unavailable storage yields none. */
export function readCollapsedGroups(
  storage: GroupStorage | undefined,
): Set<string> {
  try {
    const groups = JSON.parse(
      storage?.getItem(ALT_COLLAPSED_STORAGE_KEY) || "[]",
    );
    return new Set(
      Array.isArray(groups)
        ? groups.filter((group): group is string => typeof group === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}
export function writeCollapsedGroups(
  storage: GroupStorage | undefined,
  groups: Set<string>,
) {
  try {
    storage?.setItem(ALT_COLLAPSED_STORAGE_KEY, JSON.stringify([...groups]));
  } catch {
    /* Keep the in-memory state. */
  }
}
const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** A collapsible pool group; the whole header is a button exposing aria-expanded. */
function AltPoolGroup({
  title,
  dot,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  dot: string;
  count: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = `alt-pool-group-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section
      className={`alt-section alt-deck-pool-group ${collapsed ? "collapsed" : ""}`}
    >
      <h3>
        <button
          type="button"
          className="alt-deck-group-toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="alt-deck-chevron" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
          <i className={`alt-color-dot ${dot}`} />
          <span className="alt-deck-group-name">{title}</span>
          <small>{count}</small>
        </button>
      </h3>
      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

export function AltDeckEditor(props: Props) {
  const {
    profileId,
    profileName,
    profileIcon = null,
    deckName,
    renameDraft,
    cards,
    catalog,
    collection,
    poolGroups,
    basics,
    hiddenPoolCount,
    search,
    showOffColor,
    viewMode,
    status,
    error,
    commanderNames,
    eligibleCommanderNames,
    hasCommanderIdentity,
    onSearch,
    onRenameDraft,
    onShowOffColor,
    onViewMode,
    onQty,
    onCommander,
    onRename,
    onToggleStyle,
    isOffColor,
    initialCollapsedGroups,
    initialContentsCollapsed,
    initialPoolGrouping,
    initialPoolTypeCollapsed,
    initialPoolFilter,
  } = props;
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(initialCollapsedGroups),
  );
  const [contentsCollapsed, setContentsCollapsed] = useState<Set<string>>(
    () => new Set(initialContentsCollapsed),
  );
  const [contentsCompact, setContentsCompact] = useState(false);
  const [poolGrouping, setPoolGrouping] = useState<AltGrouping>(
    initialPoolGrouping || "type",
  );
  const [poolTypeCollapsed, setPoolTypeCollapsed] = useState<Set<string>>(
    () => new Set(initialPoolTypeCollapsed),
  );
  const [poolSearchCollapsed, setPoolSearchCollapsed] = useState<Set<string>>(new Set());
  const [poolFilter, setPoolFilter] = useState<string | null>(
    initialPoolFilter || null,
  );
  const [poolCompact, setPoolCompact] = useState(false);
  const [activeContentsSection, setActiveContentsSection] = useState<
    string | null
  >(null);
  const contentsHydrated = useRef(false);
  const poolHydrated = useRef(false);
  const [commanderOpen, setCommanderOpen] = useState(false);
  const [commanderSearch, setCommanderSearch] = useState("");
  const [renaming, setRenaming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const commanderButtonRef = useRef<HTMLButtonElement>(null);
  const catalogMap = useMemo(
    () => new Map(catalog.map((card) => [card.name.toLowerCase(), card])),
    [catalog],
  );
  const deckMap = new Map(cards.map((card) => [card.name.toLowerCase(), card]));
  const ownedMap = new Map(
    collection
      .filter((card) => card.owned)
      .map((card) => [card.name.toLowerCase(), card]),
  );
  const total = cards.reduce((sum, card) => sum + card.qty, 0);
  const offColorCards = cards.filter((card) =>
    isOffColor(card.name, card.isBasic),
  );
  const basicNames = useMemo(
    () => new Set(basics.map((name) => name.toLowerCase())),
    [basics],
  );
  const typePoolGroups = useMemo(() => {
    const rarityOrder: Record<string, number> = {
      mythic: 0,
      rare: 1,
      uncommon: 2,
      common: 3,
    };
    const next = new Map<
      DeckDisplayGroupId,
      PoolGroup<CollectionCard>["entries"]
    >(DECK_DISPLAY_GROUPS.map(({ id }) => [id, []]));
    poolGroups
      .flatMap(({ entries }) => entries)
      .forEach((entry) => {
        if (basicNames.has(entry.card.name.toLowerCase())) return;
        const info = catalogMap.get(entry.card.name.toLowerCase());
        next.get(classifyDeckDisplayGroup(info?.type || ""))!.push(entry);
      });
    next.forEach((entries) =>
      entries.sort(
        (a, b) =>
          (rarityOrder[
            catalogMap.get(a.card.name.toLowerCase())?.rarity.toLowerCase() ||
              ""
          ] ?? 9) -
            (rarityOrder[
              catalogMap.get(b.card.name.toLowerCase())?.rarity.toLowerCase() ||
                ""
            ] ?? 9) || a.card.name.localeCompare(b.card.name),
      ),
    );
    return next;
  }, [poolGroups, basicNames, catalogMap]);
  const matchingCount =
    poolGrouping === "type" && poolFilter
      ? poolFilter === "basics"
        ? basics.length
        : typePoolGroups.get(poolFilter as DeckDisplayGroupId)?.length || 0
      : poolGroups.reduce((sum, group) => sum + group.entries.length, 0) +
        basics.length;
  const groups = useMemo(() => {
    const next = new Map<DeckDisplayGroupId, DeckCard[]>(
      DECK_DISPLAY_GROUPS.map(({ id }) => [id, []]),
    );
    cards.forEach((card) =>
      next
        .get(
          classifyDeckDisplayGroup(
            catalogMap.get(card.name.toLowerCase())?.type || "",
            card.isBasic,
          ),
        )!
        .push(card),
    );
    next.forEach((entries) =>
      entries.sort((a, b) => a.name.localeCompare(b.name)),
    );
    return next;
  }, [cards, catalogMap]);
  const visibleContentsGroups = DECK_DISPLAY_GROUPS.filter(
    ({ id }) => (groups.get(id)?.length || 0) > 0,
  );
  const allContentsCollapsed =
    visibleContentsGroups.length > 0 &&
    visibleContentsGroups.every(({ id }) => contentsCollapsed.has(id));

  useEffect(() => {
    const root = rootRef.current;
    const topbar = root?.querySelector<HTMLElement>(".alt-topbar");
    if (!root || !topbar || typeof ResizeObserver === "undefined") return;
    const update = () =>
      root.style.setProperty("--alt-deck-topbar-h", `${topbar.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!initialCollapsedGroups)
      setCollapsed(readCollapsedGroups(browserStorage()));
  }, [initialCollapsedGroups]);

  useEffect(() => {
    const store = browserStorage();
    if (!initialContentsCollapsed)
      setContentsCollapsed(
        readIdSet(
          store,
          ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY,
          DECK_DISPLAY_GROUPS.map(({ id }) => id),
        ),
      );
    setContentsCompact(readSectionNavCompaction(store).contents);
    contentsHydrated.current = true;
  }, [initialContentsCollapsed]);

  useEffect(() => {
    const store = browserStorage();
    if (!initialPoolGrouping)
      setPoolGrouping(
        readGroupingPreference(store, ALT_POOL_GROUPING_STORAGE_KEY),
      );
    if (!initialPoolTypeCollapsed)
      setPoolTypeCollapsed(
        readIdSet(store, ALT_POOL_TYPE_COLLAPSED_STORAGE_KEY, [
          ...DECK_DISPLAY_GROUPS.map(({ id }) => id),
          "basics",
        ]),
      );
    setPoolCompact(readSectionNavCompaction(store).pool);
    poolHydrated.current = true;
  }, [initialPoolGrouping, initialPoolTypeCollapsed]);

  useEffect(() => { setPoolSearchCollapsed(new Set()); }, [search]);

  useEffect(() => {
    const pane =
      rootRef.current?.querySelector<HTMLElement>(".alt-deck-contents");
    const ids = visibleContentsGroups.map(
      ({ id }) => `alt-deck-contents-${id}`,
    );
    if (!pane || !ids.length) {
      setActiveContentsSection(null);
      return;
    }
    const update = () => {
      const boundary =
        pane.getBoundingClientRect().top +
        (pane.querySelector<HTMLElement>(".alt-deck-contents-sticky")
          ?.offsetHeight || 0);
      let current = ids[0];
      ids.forEach((id) => {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= boundary + 1)
          current = id;
      });
      setActiveContentsSection(current);
    };
    update();
    pane.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      pane.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [visibleContentsGroups.map(({ id }) => id).join("|")]);

  useEffect(() => {
    if (!commanderOpen) return;
    const focusable = () => [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), [href]",
      ) || []),
    ];
    focusable()[0]?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCommanderOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      commanderButtonRef.current?.focus();
    };
  }, [commanderOpen]);

  const capFor = (name: string, basic = false) =>
    basic ? 99 : ownedMap.get(name.toLowerCase())?.qty || 0;
  const quantity = (name: string) => deckMap.get(name.toLowerCase())?.qty || 0;
  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = renameDraft.trim();
    if (name) onRename(name);
    setRenaming(false);
  };
  const renameKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setRenaming(false);
    }
  };
  const viewSwitch = (
    <div
      className="alt-deck-view-switch"
      role="group"
      aria-label="Deck editor view mode"
    >
      <button
        type="button"
        aria-pressed={viewMode === "images"}
        onClick={() => onViewMode("images")}
      >
        Images
      </button>
      <button
        type="button"
        aria-pressed={viewMode === "list"}
        onClick={() => onViewMode("list")}
      >
        List
      </button>
    </div>
  );
  const title = (
    <div className="alt-deck-title-row">
      <h1>{deckName}</h1>
      {renaming ? (
        <form className="alt-create-inline" onSubmit={submitRename}>
          <input
            autoFocus
            name="name"
            aria-label="Deck name"
            value={renameDraft}
            onChange={(event) => onRenameDraft(event.target.value)}
            onKeyDown={renameKeys}
          />
          <button className="alt-pill alt-primary">Save</button>
          <button
            className="alt-pill alt-outline"
            type="button"
            onClick={() => setRenaming(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          className="alt-rename"
          type="button"
          onClick={() => setRenaming(true)}
        >
          Rename
        </button>
      )}
    </div>
  );
  const topRight = (
    <>
      <Link
        className="alt-pill alt-outline alt-back"
        href={`/p/${profileId}/decks`}
      >
        Back to decks
      </Link>
      {viewSwitch}
    </>
  );
  const stepper = (
    name: string,
    qty: number,
    cap: number,
    offColor: boolean,
    afterDecrease?: () => void,
  ) => (
    <div className="alt-stepper alt-deck-quantity">
      <button
        type="button"
        disabled={qty === 0}
        aria-label={`Decrease ${name}`}
        onClick={() => {
          onQty(name, Math.max(0, qty - 1));
          afterDecrease?.();
        }}
      >
        −
      </button>
      <b>{qty}</b>
      <button
        type="button"
        disabled={qty >= cap || offColor}
        aria-label={`Increase ${name}`}
        onClick={() => onQty(name, qty + 1)}
      >
        +
      </button>
    </div>
  );
  const badge = (name: string) => (
    <span
      className="alt-deck-off-color"
      aria-label={`${name} is outside the commander color identity`}
    >
      Off-color
    </span>
  );
  const storeCollapsed = (next: Set<string>) => {
    setCollapsed(next);
    writeCollapsedGroups(browserStorage(), next);
  };
  const toggleGroup = (group: string) => {
    const next = new Set(collapsed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    storeCollapsed(next);
  };
  const colorGroupNames = [
    ...poolGroups.map(({ group }) => group),
    ...(basics.length ? [BASIC_LANDS_GROUP] : []),
  ];
  const visibleTypeGroups = DECK_DISPLAY_GROUPS.filter(
    ({ id }) =>
      (typePoolGroups.get(id)?.length || 0) > 0 &&
      (!poolFilter || poolFilter === id),
  );
  const visibleTypeIds = [
    ...visibleTypeGroups.map(({ id }) => id),
    ...(basics.length && (!poolFilter || poolFilter === "basics")
      ? ["basics"]
      : []),
  ];
  const visiblePoolIds =
    poolGrouping === "type" ? visibleTypeIds : colorGroupNames;
  const activeCollapsed = poolGrouping === "type"
    ? search.trim() ? poolSearchCollapsed : poolTypeCollapsed
    : collapsed;
  const allPoolCollapsed =
    visiblePoolIds.length > 0 &&
    visiblePoolIds.every((id) => activeCollapsed.has(id));
  const savePoolTypeCollapsed = (next: Set<string>) => {
    setPoolTypeCollapsed(next);
    if (poolHydrated.current)
      writeIdSet(browserStorage(), ALT_POOL_TYPE_COLLAPSED_STORAGE_KEY, next);
  };
  const togglePoolTypeGroup = (id: string) => {
    const next = new Set(search.trim() ? poolSearchCollapsed : poolTypeCollapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    search.trim() ? setPoolSearchCollapsed(next) : savePoolTypeCollapsed(next);
  };
  const bulkTogglePool = () => {
    const next = new Set(activeCollapsed);
    visiblePoolIds.forEach((id) =>
      allPoolCollapsed ? next.delete(id) : next.add(id),
    );
    poolGrouping === "type"
      ? search.trim() ? setPoolSearchCollapsed(next) : savePoolTypeCollapsed(next)
      : storeCollapsed(next);
  };
  const choosePoolGrouping = (grouping: AltGrouping) => {
    setPoolGrouping(grouping);
    setPoolFilter(null);
    if (poolHydrated.current)
      writeGroupingPreference(
        browserStorage(),
        ALT_POOL_GROUPING_STORAGE_KEY,
        grouping,
      );
  };
  const togglePoolCompact = () => {
    const next = !poolCompact;
    setPoolCompact(next);
    if (poolHydrated.current)
      writeSectionNavCompaction(browserStorage(), {
        ...readSectionNavCompaction(browserStorage()),
        pool: next,
      });
  };
  const qtyBadge = (qty: number) =>
    qty > 0 && (
      <span className="alt-deck-qty-badge" aria-label={`${qty} in deck`}>
        {qty}
      </span>
    );
  const rarityGem = (info?: CatalogCard) => {
    const rarity = info?.rarity?.toLowerCase();
    return rarity ? (
      <span className="alt-deck-rarity" title={rarity}>
        <i className={`alt-gem alt-rarity-${rarity}`} />
        {rarity[0].toUpperCase()}
      </span>
    ) : null;
  };
  // Pool images add one copy (Classic parity) until the owned cap; off-color cards cannot be added.
  const imageCard = (
    name: string,
    qty: number,
    cap: number,
    owned: string,
    offColor: boolean,
    adds: boolean,
    afterDecrease?: () => void,
  ) => {
    const info = catalogMap.get(name.toLowerCase());
    const canAdd = adds && qty < cap && !offColor;
    return (
      <article
        className={`alt-card ${offColor ? "is-off-color" : ""} ${canAdd ? "can-add" : ""} ${adds && !canAdd ? "at-cap" : ""}`}
        key={name}
      >
        <div className="alt-card-visual">
          <CardImage
            name={name}
            catalog={info}
            onClick={canAdd ? () => onQty(name, qty + 1) : undefined}
            ariaLabel={adds ? `Add ${name} to deck` : undefined}
          />
          {info && (
            <span
              className={`alt-rarity alt-rarity-${info.rarity.toLowerCase()}`}
            >
              <i />
              {info.rarity}
            </span>
          )}
          {qtyBadge(qty)}
        </div>
        <strong title={name}>{name}</strong>
        <small>
          <i
            className={`alt-gem alt-rarity-${info?.rarity.toLowerCase() || "common"}`}
          />
          {qty} in deck · {owned}
        </small>
        {offColor && badge(name)}
        {stepper(name, qty, cap, offColor, afterDecrease)}
      </article>
    );
  };
  const listCard = (
    name: string,
    qty: number,
    cap: number,
    owned: string,
    offColor: boolean,
    afterDecrease?: () => void,
  ) => {
    const info = catalogMap.get(name.toLowerCase());
    return (
      <article
        className={`alt-deck-list-row ${offColor ? "is-off-color" : ""}`}
        key={name}
      >
        <span
          className="alt-deck-list-qty"
          aria-label={`${qty} copies in deck`}
        >
          {qty}×
        </span>
        <div>
          <span className="alt-deck-list-name">
            <strong>{name}</strong>
            <ManaCost cost={info?.manaCost || ""} />
            {rarityGem(info)}
          </span>
          <small>
            {owned}
            {info?.type ? ` · ${info.type}` : ""}
          </small>
          {offColor && badge(name)}
        </div>
        {stepper(name, qty, cap, offColor, afterDecrease)}
      </article>
    );
  };
  const renderCard = (
    name: string,
    qty: number,
    cap: number,
    owned: string,
    offColor: boolean,
    adds = false,
    afterDecrease?: () => void,
  ) =>
    viewMode === "images"
      ? imageCard(name, qty, cap, owned, offColor, adds, afterDecrease)
      : listCard(name, qty, cap, owned, offColor, afterDecrease);
  const cardsClass =
    viewMode === "images" ? "alt-deck-card-grid" : "alt-card-list";
  const eligible = eligibleCommanderNames.filter((name) =>
    name.toLowerCase().includes(commanderSearch.trim().toLowerCase()),
  );
  const commanderOptions = [
    ...commanderNames,
    ...eligible.filter(
      (name) =>
        !commanderNames.some(
          (selected) => selected.toLowerCase() === name.toLowerCase(),
        ),
    ),
  ];
  const commanderSection = (
    <section
      className="alt-deck-commander"
      aria-label="Commander and color identity"
    >
      <div className="alt-deck-commanders">
        {commanderNames.length ? (
          commanderNames.map((name) => (
            <div
              className="alt-deck-commander-card"
              key={name}
              aria-label={`Commander: ${name}`}
            >
              <div>
                <CardImage
                  name={name}
                  catalog={catalogMap.get(name.toLowerCase())}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="alt-deck-commander-empty">
            <strong>Choose commanders</strong>
            <small>Select up to two owned legendary creatures.</small>
          </div>
        )}
      </div>
      <div
        className={`alt-deck-legality ${!hasCommanderIdentity ? "unchecked" : offColorCards.length ? "warning" : "passed"}`}
      >
        <span aria-hidden="true">●</span>
        {!hasCommanderIdentity ? (
          "Choose a commander to check color identity"
        ) : offColorCards.length ? (
          <button
            type="button"
            onClick={() =>
              document
                .querySelector(".alt-deck-off-color")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          >
            {offColorCards.length}{" "}
            {offColorCards.length === 1 ? "card" : "cards"} outside commander
            colors
          </button>
        ) : (
          "Color identity: no conflicts"
        )}
      </div>
      <button
        ref={commanderButtonRef}
        className="alt-pill alt-outline"
        type="button"
        onClick={() => setCommanderOpen(true)}
      >
        {commanderNames.length ? "Change commanders" : "Choose commanders"}
      </button>
    </section>
  );
  const showAnalysis = commanderNames.length > 0 || cards.length > 0;
  const saveContentsCollapsed = (next: Set<string>) => {
    setContentsCollapsed(next);
    if (contentsHydrated.current)
      writeIdSet(
        browserStorage(),
        ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY,
        next,
      );
  };
  const toggleContentsGroup = (id: DeckDisplayGroupId) => {
    const next = new Set(contentsCollapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    saveContentsCollapsed(next);
  };
  const bulkToggleContents = () => {
    const next = new Set(contentsCollapsed);
    visibleContentsGroups.forEach(({ id }) =>
      allContentsCollapsed ? next.delete(id) : next.add(id),
    );
    saveContentsCollapsed(next);
  };
  const toggleContentsCompact = () => {
    const next = !contentsCompact;
    setContentsCompact(next);
    if (contentsHydrated.current)
      writeSectionNavCompaction(browserStorage(), {
        ...readSectionNavCompaction(browserStorage()),
        contents: next,
      });
  };
  const jumpContents = (sectionId: string) => {
    const id = sectionId.replace(
      "alt-deck-contents-",
      "",
    ) as DeckDisplayGroupId;
    if (contentsCollapsed.has(id)) {
      const next = new Set(contentsCollapsed);
      next.delete(id);
      saveContentsCollapsed(next);
    }
    requestAnimationFrame(() => {
      const pane =
        rootRef.current?.querySelector<HTMLElement>(".alt-deck-contents");
      const target = document.getElementById(sectionId);
      const sticky = pane?.querySelector<HTMLElement>(
        ".alt-deck-contents-sticky",
      );
      if (!pane || !target) return;
      pane.scrollTo({
        top:
          pane.scrollTop +
          target.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          (sticky?.offsetHeight || 0),
        behavior: "smooth",
      });
      target
        .querySelector<HTMLButtonElement>(".alt-card-section-toggle")
        ?.focus({ preventScroll: true });
    });
  };
  const focusAfterLastRemoval = (groupId: DeckDisplayGroupId) => {
    const index = visibleContentsGroups.findIndex(({ id }) => id === groupId);
    const target =
      visibleContentsGroups[index + 1]?.id ||
      visibleContentsGroups[index - 1]?.id;
    requestAnimationFrame(() =>
      (target
        ? document.querySelector<HTMLButtonElement>(
            `#alt-deck-contents-${target} .alt-card-section-toggle`,
          )
        : document.getElementById("deck-contents-heading")
      )?.focus(),
    );
  };

  return (
    <div className="alt-deck-editor" ref={rootRef}>
      <AltShell
        title={title}
        subtitle={`${profileName} · ${total} cards · commander excluded`}
        activeNav="decks"
        player={{ id: profileId, name: profileName, iconCard: profileIcon }}
        onToggleStyle={onToggleStyle}
        topRight={topRight}
      >
        {showAnalysis ? (
          <div className="alt-deck-overview">
            {commanderSection}
            <section className="alt-deck-analysis" aria-label="Deck analysis">
              <div className="alt-section-head">
                <h2>Deck analysis</h2>
                <span>Mana · types · curve</span>
              </div>
              <DeckAnalysis
                cards={cards}
                commanderNames={commanderNames}
                catalogMap={catalogMap}
              />
            </section>
          </div>
        ) : (
          commanderSection
        )}
        {status && (
          <p className="alt-deck-save-state" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="alt-notice error" role="alert">
            {error}
          </p>
        )}
        <nav className="alt-deck-jumps" aria-label="Deck editor sections">
          <a href="#deck-contents">Deck contents</a>
          <a href="#your-collection">Your collection</a>
        </nav>
        <div className="alt-deck-workspace">
          <section
            id="deck-contents"
            className="alt-deck-pane alt-deck-contents"
          >
            <div className="alt-deck-contents-sticky">
              <div className="alt-section-head alt-deck-pane-head">
                <h2 id="deck-contents-heading" tabIndex={-1}>
                  Deck contents
                </h2>
                <span>{total} cards · commander excluded</span>
              </div>
              {visibleContentsGroups.length > 0 && (
                <div className="alt-deck-contents-controls">
                  <button
                    type="button"
                    className="alt-pill alt-outline"
                    onClick={bulkToggleContents}
                  >
                    {allContentsCollapsed ? "Expand all" : "Collapse all"}
                  </button>
                  <button
                    type="button"
                    className="alt-pill alt-outline"
                    aria-pressed={contentsCompact}
                    onClick={toggleContentsCompact}
                  >
                    {contentsCompact
                      ? "Show chip labels"
                      : "Compact section navigation"}
                  </button>
                </div>
              )}
              <AltSectionNav
                label="Deck contents sections"
                items={visibleContentsGroups.map(({ id, label }) => ({
                  id: `alt-deck-contents-${id}`,
                  label,
                  count: groups
                    .get(id)!
                    .reduce((sum, card) => sum + card.qty, 0),
                  icon: <CardTypeIcon type={id} />,
                }))}
                compact={contentsCompact}
                mode="jump"
                topId="deck-contents"
                activeId={activeContentsSection}
                onSelect={jumpContents}
              />
            </div>
            {cards.length === 0 ? (
              <div className="alt-deck-empty">
                <strong>Your deck is empty.</strong>
                <span>Add cards from your collection.</span>
              </div>
            ) : (
              <div className="alt-deck-content-groups">
                {visibleContentsGroups.map(({ id, label }) => {
                  const entries = groups.get(id)!;
                  const copies = entries.reduce(
                    (sum, card) => sum + card.qty,
                    0,
                  );
                  return (
                    <AltCardSection
                      key={id}
                      id={`alt-deck-contents-${id}`}
                      title={label}
                      icon={<CardTypeIcon type={id} />}
                      count={`${copies} copies · ${entries.length} names`}
                      collapsed={contentsCollapsed.has(id)}
                      onToggle={() => toggleContentsGroup(id)}
                      headingLevel={3}
                    >
                      <div className={cardsClass}>
                        {entries.map((card) =>
                          renderCard(
                            card.name,
                            card.qty,
                            capFor(card.name, card.isBasic),
                            card.isBasic
                              ? "unlimited owned"
                              : `${capFor(card.name)} owned`,
                            isOffColor(card.name, card.isBasic),
                            false,
                            card.qty === 1 && entries.length === 1
                              ? () => focusAfterLastRemoval(id)
                              : undefined,
                          ),
                        )}
                      </div>
                    </AltCardSection>
                  );
                })}
              </div>
            )}
          </section>
          <section id="your-collection" className="alt-deck-pane alt-deck-pool">
            <div className="alt-deck-pool-toolbar">
              <div className="alt-section-head alt-deck-pane-head">
                <h2>Your collection</h2>
                <span>{matchingCount} cards available</span>
              </div>
              <label className="alt-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                  placeholder="Search owned cards"
                  aria-label="Search owned cards"
                />
              </label>
              <div className="alt-deck-pool-controls">
                <div
                  className="alt-grouping-switch"
                  role="group"
                  aria-label="Pool grouping"
                >
                  <span>Group by:</span>
                  <button
                    type="button"
                    aria-pressed={poolGrouping === "type"}
                    onClick={() => choosePoolGrouping("type")}
                  >
                    Type
                  </button>
                  <button
                    type="button"
                    aria-pressed={poolGrouping === "color"}
                    onClick={() => choosePoolGrouping("color")}
                  >
                    Color
                  </button>
                </div>
                {hasCommanderIdentity && (
                  <button
                    type="button"
                    className="alt-pill alt-outline"
                    aria-pressed={showOffColor}
                    onClick={() => onShowOffColor(!showOffColor)}
                  >
                    {showOffColor
                      ? "Hide off-color"
                      : `Show off-color (${hiddenPoolCount})`}
                  </button>
                )}
                {visiblePoolIds.length > 0 && (
                  <button
                    type="button"
                    className="alt-pill alt-outline alt-deck-collapse-all"
                    onClick={bulkTogglePool}
                  >
                    {allPoolCollapsed ? "Expand all" : "Collapse all"}
                  </button>
                )}
                {poolGrouping === "type" && (
                  <button
                    type="button"
                    className="alt-pill alt-outline"
                    aria-pressed={poolCompact}
                    onClick={togglePoolCompact}
                  >
                    {poolCompact
                      ? "Show chip labels"
                      : "Compact section navigation"}
                  </button>
                )}
              </div>
              {poolGrouping === "type" && (
                <AltSectionNav
                  label="Add pool sections"
                  items={[
                    ...DECK_DISPLAY_GROUPS.map(({ id, label }) => ({
                      id,
                      label,
                      count: typePoolGroups.get(id)?.length || 0,
                      icon: <CardTypeIcon type={id} />,
                    })),
                    ...(basics.length
                      ? [
                          {
                            id: "basics",
                            label: "Basics",
                            count: basics.length,
                            icon: <CardTypeIcon type="basic" />,
                          },
                        ]
                      : []),
                  ]}
                  compact={poolCompact}
                  mode="filter"
                  activeId={poolFilter}
                  onSelect={(id) =>
                    setPoolFilter(poolFilter === id ? null : id)
                  }
                />
              )}
            </div>
            {!search.trim() && !collection.some((card) => card.owned) ? (
              <div className="alt-deck-empty">
                <strong>No owned cards yet.</strong>
                <Link href={`/p/${profileId}`}>Go to your collection</Link>
                <span>Basic lands remain available below.</span>
              </div>
            ) : (
              matchingCount === 0 && (
                <div className="alt-deck-empty">
                  {search.trim() ? (
                    <>
                      <strong>No search matches.</strong>
                      <button type="button" onClick={() => onSearch("")}>
                        Clear search
                      </button>
                    </>
                  ) : hiddenPoolCount ? (
                    <>
                      <strong>All cards are filtered by color identity.</strong>
                      <button
                        type="button"
                        onClick={() => onShowOffColor(true)}
                      >
                        Show off-color cards
                      </button>
                    </>
                  ) : (
                    <>
                      <strong>No cards match the current filters.</strong>
                      <span>Adjust the collection filters.</span>
                    </>
                  )}
                </div>
              )
            )}
            {poolGrouping === "type" ? (
              <div className="alt-deck-pool-type-groups">
                {visibleTypeGroups.map(({ id, label }) => {
                  const entries = typePoolGroups.get(id)!;
                  return (
                    <AltCardSection
                      key={id}
                      id={`alt-deck-pool-type-${id}`}
                      title={label}
                      icon={<CardTypeIcon type={id} />}
                      count={`${entries.length} cards available`}
                      collapsed={activeCollapsed.has(id)}
                      onToggle={() => togglePoolTypeGroup(id)}
                      headingLevel={3}
                    >
                      <div className={cardsClass}>
                        {entries.map(({ card, offColor }) =>
                          renderCard(
                            card.name,
                            quantity(card.name),
                            card.qty,
                            `${card.qty} owned`,
                            offColor,
                            true,
                          ),
                        )}
                      </div>
                    </AltCardSection>
                  );
                })}
                {basics.length > 0 &&
                  (!poolFilter || poolFilter === "basics") && (
                    <AltCardSection
                      id="alt-deck-pool-type-basics"
                      title="Basics"
                      icon={<CardTypeIcon type="basic" />}
                      count={`${basics.length} types · unlimited supply · max 99 each`}
                      collapsed={activeCollapsed.has("basics")}
                      onToggle={() => togglePoolTypeGroup("basics")}
                      headingLevel={3}
                    >
                      <div className={cardsClass}>
                        {basics.map((name) =>
                          renderCard(
                            name,
                            quantity(name),
                            99,
                            "unlimited owned",
                            false,
                            true,
                          ),
                        )}
                      </div>
                    </AltCardSection>
                  )}
              </div>
            ) : (
              <>
                {poolGroups.map(({ group, entries }) => (
                  <AltPoolGroup
                    key={group}
                    title={group}
                    dot={COLOR_CLASS[group]}
                    count={`${entries.length} cards available`}
                    collapsed={collapsed.has(group)}
                    onToggle={() => toggleGroup(group)}
                  >
                    <div className={cardsClass}>
                      {entries.map(({ card, offColor }) =>
                        renderCard(
                          card.name,
                          quantity(card.name),
                          card.qty,
                          `${card.qty} owned`,
                          offColor,
                          true,
                        ),
                      )}
                    </div>
                  </AltPoolGroup>
                ))}
                {basics.length > 0 && (
                  <AltPoolGroup
                    title={BASIC_LANDS_GROUP}
                    dot="lands"
                    count={`${basics.length} types · unlimited supply · max 99 each`}
                    collapsed={collapsed.has(BASIC_LANDS_GROUP)}
                    onToggle={() => toggleGroup(BASIC_LANDS_GROUP)}
                  >
                    <div className={cardsClass}>
                      {basics.map((name) =>
                        renderCard(
                          name,
                          quantity(name),
                          99,
                          "unlimited owned",
                          false,
                          true,
                        ),
                      )}
                    </div>
                  </AltPoolGroup>
                )}
              </>
            )}
          </section>
        </div>
        {commanderOpen && (
          <div
            className="alt-commander-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setCommanderOpen(false);
            }}
          >
            <div
              ref={dialogRef}
              className="alt-commander-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="alt-commander-title"
            >
              <header>
                <div>
                  <h2 id="alt-commander-title">Choose commanders</h2>
                  <small>{commanderNames.length} of 2 selected</small>
                </div>
                <button
                  className="alt-pill alt-outline"
                  type="button"
                  onClick={() => setCommanderOpen(false)}
                >
                  Close
                </button>
              </header>
              <label className="alt-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={commanderSearch}
                  onChange={(event) => setCommanderSearch(event.target.value)}
                  placeholder="Search commanders"
                  aria-label="Search commanders"
                />
              </label>
              <div className="alt-commander-options">
                {commanderOptions.map((name) => {
                  const selected = commanderNames.some(
                    (entry) => entry.toLowerCase() === name.toLowerCase(),
                  );
                  return (
                    <article
                      className={`alt-commander-option ${selected ? "selected" : ""}`}
                      key={name}
                    >
                      <div>
                        <CardImage
                          name={name}
                          catalog={catalogMap.get(name.toLowerCase())}
                        />
                      </div>
                      <span>
                        <strong>{name}</strong>
                        <small>
                          {selected
                            ? "Selected commander"
                            : catalogMap.get(name.toLowerCase())
                                ?.colorIdentity || "Colorless"}
                        </small>
                      </span>
                      <button
                        className={`alt-pill ${selected ? "alt-danger alt-outline" : "alt-primary"}`}
                        type="button"
                        disabled={!selected && commanderNames.length >= 2}
                        onClick={() => onCommander(name)}
                      >
                        {selected ? "Remove" : "Select"}
                      </button>
                    </article>
                  );
                })}
                {commanderOptions.length === 0 && (
                  <p className="alt-deck-empty">
                    No eligible commanders match your search.
                  </p>
                )}
              </div>
              <footer>
                <button
                  className="alt-pill alt-primary"
                  type="button"
                  onClick={() => setCommanderOpen(false)}
                >
                  Done
                </button>
              </footer>
            </div>
          </div>
        )}
      </AltShell>
    </div>
  );
}
