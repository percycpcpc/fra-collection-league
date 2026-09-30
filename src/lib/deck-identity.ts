// Pure commander color-identity resolution and predicates for the deck builder.
// No React, no D1, no fs. Consumed by DeckEditor and its tests.

import {
  parseIdentity,
  isSubsetIdentity,
  unionIdentity,
  type ColorIdentity,
} from "./color-identity";

/** Minimal card shape these helpers need. */
export type IdentityCard = { name: string; colorIdentity?: string };

/** Maximum number of commanders a deck may have (partner rule). */
export const MAX_COMMANDERS = 2;

/**
 * Separator used to encode up to two commander names inside the single stored
 * `deck.commander` string. No schema change: the DB column stays one string.
 */
const COMMANDER_SEP = " // ";

/**
 * Decode the stored commander string into an ordered list of 0–2 names.
 * Tolerant: null/undefined/empty -> []; trims and drops blanks; caps at 2.
 */
export function parseCommanderNames(stored: string | null | undefined): string[] {
  if (typeof stored !== "string") return [];
  return stored
    .split(COMMANDER_SEP)
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, MAX_COMMANDERS);
}

/**
 * Encode a list of commander names back into the single stored string.
 * Empty list -> null (no commander). Caps at 2 names.
 */
export function serializeCommanderNames(names: readonly string[]): string | null {
  const clean = names.map((n) => n.trim()).filter((n) => n.length > 0).slice(0, MAX_COMMANDERS);
  return clean.length === 0 ? null : clean.join(COMMANDER_SEP);
}

/**
 * Toggle a commander name within the current selection.
 * - If already selected, remove it.
 * - Otherwise add it, unless the cap of 2 is already reached (then no change).
 * Returns the next encoded stored string (or null when empty).
 */
export function toggleCommander(
  stored: string | null | undefined,
  name: string,
): string | null {
  const trimmed = name.trim();
  const current = parseCommanderNames(stored);
  const idx = current.findIndex((n) => n.toLowerCase() === trimmed.toLowerCase());
  let next: string[];
  if (idx >= 0) {
    next = current.filter((_, i) => i !== idx);
  } else if (current.length >= MAX_COMMANDERS) {
    next = current; // cap reached: selection unchanged (Req 4.6)
  } else {
    next = [...current, trimmed];
  }
  return serializeCommanderNames(next);
}

/** True when the given card name is one of the deck's selected commanders. */
export function isCommander(stored: string | null | undefined, name: string): boolean {
  const lower = name.trim().toLowerCase();
  return parseCommanderNames(stored).some((n) => n.toLowerCase() === lower);
}

/** Case-insensitive lookup of a card by name. */
function findCard(
  name: string,
  catalog: readonly IdentityCard[],
): IdentityCard | undefined {
  const lower = name.toLowerCase();
  return catalog.find((c) => c.name.toLowerCase() === lower);
}

/**
 * Resolve the Commander_Color_Identity for a set of selected commander names.
 *
 * - No names selected -> undefined (no filter applied). This is distinct from
 *   a defined-but-empty (colorless) identity.
 * - Otherwise the union of parseIdentity(card.colorIdentity) over the names
 *   that match a catalog card. Names with no match contribute the empty set.
 */
export function resolveCommanderIdentity(
  names: readonly string[],
  catalog: readonly IdentityCard[],
): ColorIdentity | undefined {
  if (names.length === 0) return undefined;
  const parts: ColorIdentity[] = names.map((name) => {
    const card = findCard(name, catalog);
    return card ? parseIdentity(card.colorIdentity) : new Set();
  });
  return unionIdentity(...parts);
}

/**
 * A card is legal to show/add when there is no commander filter, the card is a
 * basic land, or its color identity is a subset of the commander identity.
 */
export function isLegal(
  card: IdentityCard,
  commanderIdentity: ColorIdentity | undefined,
  isBasic: boolean,
): boolean {
  if (commanderIdentity === undefined) return true;
  if (isBasic) return true;
  return isSubsetIdentity(parseIdentity(card.colorIdentity), commanderIdentity);
}

/**
 * Compute the Card_Selection_List membership for owned non-basic cards plus the
 * always-present basic lands, given a resolved commander identity.
 *
 * - owned non-basics are included iff legal (subset-match or no filter);
 * - every basic land option is always included (Req 5.7, 6.5);
 * - with an undefined identity every owned card is shown (Req 5.4).
 *
 * Returns the ordered list of names that would appear in the selection list.
 */
export function selectionList(
  owned: readonly IdentityCard[],
  basics: readonly string[],
  commanderIdentity: ColorIdentity | undefined,
): string[] {
  const isBasicName = (n: string) => basics.some((b) => b.toLowerCase() === n.toLowerCase());
  const shownOwned = owned
    .filter((c) => !isBasicName(c.name))
    .filter((c) => isLegal(c, commanderIdentity, false))
    .map((c) => c.name);
  return [...shownOwned, ...basics];
}

/**
 * The set of deck-card names visible in the deck contents panel. Every card in
 * the deck stays visible regardless of the commander identity (Req 7.1); the
 * commander identity only affects the marker/stepper, not membership.
 */
export function deckContentsVisible(
  deckCards: readonly { name: string }[],
  _commanderIdentity: ColorIdentity | undefined,
): string[] {
  return deckCards.map((c) => c.name);
}

/**
 * Apply a quantity change to a deck's cards, mirroring the deck editor's save
 * path: setting a card to qty 0 removes it entirely (Req 7.5); otherwise the
 * card's qty is updated (or the card is added when not already present).
 */
export function applyDeckQty<T extends { name: string; qty: number }>(
  cards: readonly T[],
  name: string,
  qty: number,
  make: (name: string, qty: number) => T,
): T[] {
  const lower = name.toLowerCase();
  if (qty <= 0) return cards.filter((c) => c.name.toLowerCase() !== lower);
  if (cards.some((c) => c.name.toLowerCase() === lower)) {
    return cards.map((c) => (c.name.toLowerCase() === lower ? { ...c, qty } : c));
  }
  return [...cards, make(name, qty)];
}

/**
 * A deck card is out-of-identity (marked, increase disabled) when a commander
 * identity is defined, the card is not a basic land, and its color identity is
 * not a subset of the commander identity.
 */
export function isOutOfIdentity(
  card: IdentityCard,
  commanderIdentity: ColorIdentity | undefined,
  isBasic: boolean,
): boolean {
  if (commanderIdentity === undefined) return false;
  if (isBasic) return false;
  return !isSubsetIdentity(parseIdentity(card.colorIdentity), commanderIdentity);
}
