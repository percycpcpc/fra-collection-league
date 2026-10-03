export const ALT_COLLECTION_GROUPING_STORAGE_KEY = "fra-alt-collection-grouping-v1";
export const ALT_POOL_GROUPING_STORAGE_KEY = "fra-alt-pool-grouping-v1";
export const ALT_COLLECTION_TYPE_COLLAPSED_STORAGE_KEY = "fra-alt-collection-type-collapsed-v1";
export const ALT_COLLECTION_COLOR_COLLAPSED_STORAGE_KEY = "fra-alt-collection-color-collapsed-v1";
export const ALT_DECK_CONTENTS_TYPE_COLLAPSED_STORAGE_KEY = "fra-alt-deck-contents-type-collapsed-v1";
export const ALT_POOL_TYPE_COLLAPSED_STORAGE_KEY = "fra-alt-pool-type-collapsed-v1";
export const LEGACY_POOL_COLOR_COLLAPSED_STORAGE_KEY = "fra-deck-collapsed";
export const ALT_SECTION_NAV_COMPACT_STORAGE_KEY = "fra-alt-section-nav-compact-v1";
export const DECK_VIEW_STORAGE_KEY = "fra-deck-view";

export type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
export type AltGrouping = "type" | "color";
export type AltSectionNavCompaction = {
  collection: boolean;
  contents: boolean;
  pool: boolean;
};

const DEFAULT_COMPACTION: AltSectionNavCompaction = {
  collection: false,
  contents: false,
  pool: false,
};

export function readIdSet(
  storage: PreferenceStorage | undefined,
  key: string,
  whitelist?: Iterable<string>,
): Set<string> {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) || "[]");
    if (!Array.isArray(value)) return new Set();
    const allowed = whitelist ? new Set(whitelist) : undefined;
    return new Set(
      value.filter(
        (id): id is string => typeof id === "string" && (!allowed || allowed.has(id)),
      ),
    );
  } catch {
    return new Set();
  }
}

export function writeIdSet(
  storage: PreferenceStorage | undefined,
  key: string,
  value: ReadonlySet<string>,
): void {
  try {
    storage?.setItem(key, JSON.stringify([...value]));
  } catch {
    // The caller's state remains the usable in-memory preference.
  }
}

export function readGroupingPreference(
  storage: PreferenceStorage | undefined,
  key: typeof ALT_COLLECTION_GROUPING_STORAGE_KEY | typeof ALT_POOL_GROUPING_STORAGE_KEY,
): AltGrouping {
  try {
    const value = storage?.getItem(key);
    return value === "color" || value === "type" ? value : "type";
  } catch {
    return "type";
  }
}

export function writeGroupingPreference(
  storage: PreferenceStorage | undefined,
  key: typeof ALT_COLLECTION_GROUPING_STORAGE_KEY | typeof ALT_POOL_GROUPING_STORAGE_KEY,
  value: AltGrouping,
): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // The caller's state remains the usable in-memory preference.
  }
}

export function readSectionNavCompaction(
  storage: PreferenceStorage | undefined,
): AltSectionNavCompaction {
  try {
    const value: unknown = JSON.parse(
      storage?.getItem(ALT_SECTION_NAV_COMPACT_STORAGE_KEY) || "{}",
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ...DEFAULT_COMPACTION };
    }
    const record = value as Record<string, unknown>;
    return {
      collection: typeof record.collection === "boolean" ? record.collection : false,
      contents: typeof record.contents === "boolean" ? record.contents : false,
      pool: typeof record.pool === "boolean" ? record.pool : false,
    };
  } catch {
    return { ...DEFAULT_COMPACTION };
  }
}

export function writeSectionNavCompaction(
  storage: PreferenceStorage | undefined,
  value: AltSectionNavCompaction,
): void {
  try {
    storage?.setItem(ALT_SECTION_NAV_COMPACT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The caller's state remains the usable in-memory preference.
  }
}
