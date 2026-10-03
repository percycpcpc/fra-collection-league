import { describe, expect, it } from "vitest";
import {
  ALT_COLLECTION_GROUPING_STORAGE_KEY,
  ALT_POOL_GROUPING_STORAGE_KEY,
  ALT_SECTION_NAV_COMPACT_STORAGE_KEY,
  readGroupingPreference,
  readIdSet,
  readSectionNavCompaction,
  writeGroupingPreference,
  writeIdSet,
  writeSectionNavCompaction,
} from "./alt-group-preferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { writes += 1; data.set(key, value); },
    data,
    writes: () => writes,
  };
}

describe("alt group preferences", () => {
  it("reads ID sets defensively and filters unknown IDs", () => {
    expect(readIdSet(memoryStorage({ key: "{bad" }), "key").size).toBe(0);
    expect(readIdSet(memoryStorage({ key: '{"id":"creature"}' }), "key").size).toBe(0);
    expect([...readIdSet(memoryStorage({ key: '["creature",4,"land","future"]' }), "key", ["creature", "land"])]).toEqual(["creature", "land"]);
  });

  it("tolerates blocked storage for reads and writes", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readIdSet(blocked, "key").size).toBe(0);
    expect(() => writeIdSet(blocked, "key", new Set(["creature"]))).not.toThrow();
    expect(readGroupingPreference(blocked, ALT_COLLECTION_GROUPING_STORAGE_KEY)).toBe("type");
    expect(readSectionNavCompaction(blocked)).toEqual({ collection: false, contents: false, pool: false });
  });

  it("never writes defaults while reading", () => {
    const storage = memoryStorage();
    readIdSet(storage, "key");
    readGroupingPreference(storage, ALT_COLLECTION_GROUPING_STORAGE_KEY);
    readSectionNavCompaction(storage);
    expect(storage.writes()).toBe(0);
  });

  it("keeps collection and pool grouping modes isolated and validates values", () => {
    const storage = memoryStorage();
    writeGroupingPreference(storage, ALT_COLLECTION_GROUPING_STORAGE_KEY, "color");
    writeGroupingPreference(storage, ALT_POOL_GROUPING_STORAGE_KEY, "type");
    expect(readGroupingPreference(storage, ALT_COLLECTION_GROUPING_STORAGE_KEY)).toBe("color");
    expect(readGroupingPreference(storage, ALT_POOL_GROUPING_STORAGE_KEY)).toBe("type");
    storage.data.set(ALT_POOL_GROUPING_STORAGE_KEY, "unknown");
    expect(readGroupingPreference(storage, ALT_POOL_GROUPING_STORAGE_KEY)).toBe("type");
  });

  it("validates each compaction boolean and rejects malformed payloads", () => {
    const storage = memoryStorage({
      [ALT_SECTION_NAV_COMPACT_STORAGE_KEY]: JSON.stringify({ collection: true, contents: "yes", pool: false }),
    });
    expect(readSectionNavCompaction(storage)).toEqual({ collection: true, contents: false, pool: false });
    storage.data.set(ALT_SECTION_NAV_COMPACT_STORAGE_KEY, "[]");
    expect(readSectionNavCompaction(storage)).toEqual({ collection: false, contents: false, pool: false });
    storage.data.set(ALT_SECTION_NAV_COMPACT_STORAGE_KEY, "{bad");
    expect(readSectionNavCompaction(storage)).toEqual({ collection: false, contents: false, pool: false });
    writeSectionNavCompaction(storage, { collection: false, contents: true, pool: true });
    expect(storage.data.get(ALT_SECTION_NAV_COMPACT_STORAGE_KEY)).toBe('{"collection":false,"contents":true,"pool":true}');
  });
});
