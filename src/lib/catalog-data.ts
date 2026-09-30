import catalogSeed from "../../data/catalog.json";
import { parseIdentity, serializeIdentity } from "./color-identity";

// Pure, DB-free catalog primitives: the card type, the bundled seed dataset,
// and the validation gate. Kept free of any `cloudflare:workers` import so it
// can be exercised in plain Vitest without the Workers runtime.

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

const STRING_FIELDS = ["name", "img", "colors", "rarity", "type", "colorIdentity"] as const;

/**
 * Coerce and validate an untrusted object into a CatalogCard. Missing optional
 * string fields default to "" and qty defaults to 1. `label` is used in error
 * messages (e.g. "Row 3" or a card name). Throws on invalid input.
 *
 * Note: this validates shape and types only; colorIdentity canonicality is
 * enforced separately by validateCatalog.
 */
export function parseCatalogCard(raw: unknown, label: string): CatalogCard {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${label} is not an object.`);
  }
  const obj = raw as Record<string, unknown>;
  const card: Record<string, unknown> = {};
  for (const field of STRING_FIELDS) {
    const value = obj[field] ?? (field === "name" ? undefined : "");
    if (field === "name" && (typeof value !== "string" || !value.trim())) {
      throw new Error(`${label} is missing a card name.`);
    }
    if (typeof value !== "string") {
      throw new Error(`${label} field "${field}" must be a string.`);
    }
    card[field] = field === "name" ? value.trim() : value;
  }
  const qty = obj.qty ?? 1;
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 0) {
    throw new Error(`${label} field "qty" must be a non-negative integer.`);
  }
  card.qty = qty;
  return card as CatalogCard;
}

/**
 * The bundled seed dataset (from data/catalog.json). Imported at build time —
 * never read from the filesystem at request time. Used only to populate the DB.
 */
export function catalogSeedData(): CatalogCard[] {
  return catalogSeed as CatalogCard[];
}

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
