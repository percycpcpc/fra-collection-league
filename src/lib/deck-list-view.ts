// Pure view model for the Alt decks list rows (Nocturne list view).
// No React, no D1, no fs.

import { WUBRG_ORDER, type ColorIdentity, type WUBRG } from "./color-identity";
import { BANNER_COLORS, COLORLESS_BANNER } from "./deck-banner";
import { parseCommanderNames } from "./deck-identity";

/** Commander decks are 100 cards; the row's progress bar fills toward this. */
export const DECK_TARGET_SIZE = 100;

const COLOR_NAMES: Readonly<Record<WUBRG, string>> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };

/** Community names for two- and three-color identities, keyed in WUBRG order. */
const IDENTITY_NAMES: Readonly<Record<string, string>> = {
  WU: "Azorius", UB: "Dimir", BR: "Rakdos", RG: "Gruul", WG: "Selesnya",
  WB: "Orzhov", UR: "Izzet", BG: "Golgari", WR: "Boros", UG: "Simic",
  WUG: "Bant", WUB: "Esper", UBR: "Grixis", BRG: "Jund", WRG: "Naya",
  WBG: "Abzan", WUR: "Jeskai", UBG: "Sultai", WBR: "Mardu", URG: "Temur",
};

export type DeckPip = { key: WUBRG; label: string; color: string };

export type DeckRowView = {
  /** Uppercase kicker: the identity name, "Colorless", "No commander", or a commander count while identities load. */
  kicker: string;
  commanders: string;
  hasCommander: boolean;
  /** Accessible identity description; null when there is nothing to describe. */
  identityLabel: string | null;
  pips: DeckPip[];
  /** CSS backgrounds for the 2px top edge and 72px top wash; null keeps the neutral default. */
  edge: string | null;
  wash: string | null;
  countLabel: string;
  status: string;
  pct: string;
};

type DeckLike = { name: string; commander: string | null; cardCount: number };

/** Case-insensitive client-side filter on deck name and commander names. */
export function filterDecks<T extends DeckLike>(decks: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...decks];
  return decks.filter((deck) => [deck.name, ...parseCommanderNames(deck.commander)].some((text) => text.toLocaleLowerCase().includes(needle)));
}

/** "Azorius", "Colorless", "Four-color (W · U · B · R)" style label for a resolved identity. */
export function identityName(identity: ColorIdentity): string {
  const colors = WUBRG_ORDER.filter((c) => identity.has(c));
  if (colors.length === 0) return "Colorless";
  if (colors.length === 1) return COLOR_NAMES[colors[0]];
  if (colors.length === 5) return "Five-color";
  return IDENTITY_NAMES[colors.join("")] ?? colors.map((c) => COLOR_NAMES[c]).join(" · ");
}

/** Header summary, e.g. "3 decks · 2 ready for league play". A deck is ready once it has a commander. */
export function deckSummary(decks: readonly DeckLike[]): string {
  const ready = decks.filter((deck) => parseCommanderNames(deck.commander).length > 0).length;
  return `${decks.length} ${decks.length === 1 ? "deck" : "decks"} · ${ready} ready for league play`;
}

/**
 * Row view for one deck. `identity` is the resolved commander identity:
 * undefined when the deck has no commander or the catalog hasn't loaded yet
 * (the row then shows neutral chrome rather than flashing colorless).
 */
export function deckRowView(deck: DeckLike, identity: ColorIdentity | undefined): DeckRowView {
  const names = parseCommanderNames(deck.commander);
  const hasCommander = names.length > 0;
  const colors = identity ? WUBRG_ORDER.filter((c) => identity.has(c)) : [];
  const tones = identity ? (colors.length ? colors.map((c) => BANNER_COLORS[c]) : [COLORLESS_BANNER]) : [];
  const kicker = !hasCommander ? "No commander" : identity ? identityName(identity) : names.length > 1 ? "Partner commanders" : "Commander";
  return {
    kicker,
    commanders: hasCommander ? names.join(" + ") : "Pick a legendary creature",
    hasCommander,
    identityLabel: hasCommander && identity ? `Color identity: ${colors.length ? colors.map((c) => COLOR_NAMES[c]).join(", ") : "Colorless"}` : null,
    pips: hasCommander ? colors.map((key) => ({ key, label: COLOR_NAMES[key], color: BANNER_COLORS[key] })) : [],
    edge: hasCommander && tones.length ? `linear-gradient(90deg, transparent, ${tones.join(", ")}, transparent)` : null,
    wash: hasCommander && tones.length ? `linear-gradient(180deg, color-mix(in srgb, ${tones[0]} 10%, transparent), transparent)` : null,
    countLabel: `${deck.cardCount} ${deck.cardCount === 1 ? "card" : "cards"}`,
    status: hasCommander ? "Ready for league" : "No commander",
    pct: `${+Math.min(100, (deck.cardCount / DECK_TARGET_SIZE) * 100).toFixed(2)}%`,
  };
}
