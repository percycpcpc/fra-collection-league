import catalogData from "../../data/catalog.json";
import { parseIdentity, serializeIdentity } from "./color-identity";

export type CatalogCard = {
  name: string;
  qty: number;
  img: string;
  colors: string;
  rarity: string;
  type: string;
  colorIdentity: string;
};

// 0-5 chars, WUBRG only, no repeated character.
const IDENTITY_RE = /^(?!.*(.).*\1)[WUBRG]{0,5}$/;

/**
 * Assert every entry carries a well-formed, canonical `colorIdentity` string.
 * Throws an Error naming the first offending card. Pure over its argument.
 */
export function validateCatalog(cards: readonly CatalogCard[]): void {
  for (const card of cards) {
    const id = (card as { colorIdentity?: unknown }).colorIdentity;
    const rawName = (card as { name?: unknown }).name;
    const label = typeof rawName === "string" ? rawName : JSON.stringify(rawName);
    if (typeof id !== "string") {
      throw new Error(`Catalog card "${label}" has a missing or non-string colorIdentity.`);
    }
    if (!IDENTITY_RE.test(id)) {
      throw new Error(`Catalog card "${label}" has a malformed colorIdentity: ${JSON.stringify(id)}.`);
    }
    if (id !== serializeIdentity(parseIdentity(id))) {
      throw new Error(`Catalog card "${label}" colorIdentity is not canonical WUBRG order: ${JSON.stringify(id)}.`);
    }
  }
}

let validated = false;

export function getCatalog(): CatalogCard[] {
  const cards = catalogData as CatalogCard[];
  if (!validated) {
    validateCatalog(cards);
    validated = true;
  }
  return cards;
}

export function catalogNames(): Map<string, string> {
  return new Map(
    getCatalog().map((card) => [card.name.toLocaleLowerCase(), card.name]),
  );
}
