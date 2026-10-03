import type { CatalogCard } from "./client";

export const CARD_TYPE_GROUPS = [
  { id: "creature", label: "Creatures" },
  { id: "instant", label: "Instants" },
  { id: "sorcery", label: "Sorceries" },
  { id: "artifact", label: "Artifacts" },
  { id: "enchantment", label: "Enchantments" },
  { id: "planeswalker", label: "Planeswalkers" },
  { id: "land", label: "Nonbasic lands" },
  { id: "basic", label: "Basic lands" },
  { id: "other", label: "Other / unknown" },
] as const;

export type CardTypeId = (typeof CARD_TYPE_GROUPS)[number]["id"];

export const DECK_DISPLAY_GROUPS = [
  { id: "creature", label: "Creatures", members: ["creature"] },
  { id: "spell", label: "Spells", members: ["instant", "sorcery"] },
  {
    id: "permanent",
    label: "Permanents",
    members: ["artifact", "enchantment", "planeswalker", "other"],
  },
  { id: "land", label: "Lands", members: ["land", "basic"] },
] as const satisfies readonly {
  id: string;
  label: string;
  members: readonly CardTypeId[];
}[];

export type DeckDisplayGroupId = (typeof DECK_DISPLAY_GROUPS)[number]["id"];

const PRIMARY_TYPE_PRECEDENCE = [
  "land",
  "creature",
  "planeswalker",
  "instant",
  "sorcery",
  "artifact",
  "enchantment",
] as const satisfies readonly CardTypeId[];

/**
 * Classify a catalog type line into exactly one presentation bucket.
 * `isBasic` is the authoritative deck-row override when catalog metadata is
 * absent or disagrees; catalog Basic Land lines are also recognized directly.
 */
export function classifyCardType(
  type: CatalogCard["type"],
  isBasic = false,
): CardTypeId {
  if (isBasic) return "basic";

  const firstFace = type.split("//", 1)[0]?.trim() ?? "";
  if (!firstFace) return "other";

  const delimiterIndexes = [firstFace.indexOf("—"), firstFace.indexOf("–"), firstFace.indexOf(" - ")]
    .filter((index) => index >= 0);
  const delimiterIndex = delimiterIndexes.length > 0 ? Math.min(...delimiterIndexes) : firstFace.length;
  const typePortion = firstFace.slice(0, delimiterIndex).trim().toLowerCase();
  const tokens = new Set(typePortion ? typePortion.split(/\s+/u) : []);

  if (tokens.has("basic") && tokens.has("land")) return "basic";

  for (const primaryType of PRIMARY_TYPE_PRECEDENCE) {
    if (tokens.has(primaryType)) return primaryType;
  }
  return "other";
}

/** Map a full taxonomy bucket to the deck builder's four display groups. */
export function getDeckDisplayGroup(typeId: CardTypeId): DeckDisplayGroupId {
  for (const group of DECK_DISPLAY_GROUPS) {
    if ((group.members as readonly CardTypeId[]).includes(typeId)) return group.id;
  }

  // Exhaustive fallback retained for runtime callers crossing an untyped boundary.
  return "permanent";
}

/** Classify a type line directly into one of the four deck display groups. */
export function classifyDeckDisplayGroup(
  type: CatalogCard["type"],
  isBasic = false,
): DeckDisplayGroupId {
  return getDeckDisplayGroup(classifyCardType(type, isBasic));
}
