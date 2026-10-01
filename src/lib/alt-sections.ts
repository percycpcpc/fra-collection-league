/** Alt UI sections that belong to the browsing player (Analytics is league-wide). Server-safe. */
export type AltSection = "collection" | "decks" | "matches";
export const ALT_SECTIONS: readonly AltSection[] = ["collection", "decks", "matches"];

export function parseAltSection(value: unknown): AltSection | undefined {
  return typeof value === "string" && (ALT_SECTIONS as readonly string[]).includes(value) ? value as AltSection : undefined;
}

export function altSectionHref(playerId: string, section: AltSection) {
  return section === "collection" ? `/p/${playerId}` : `/p/${playerId}/${section}`;
}
