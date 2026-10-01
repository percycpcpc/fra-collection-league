export type CatalogCard = { name: string; qty: number; img: string; colors: string; rarity: string; type: string; colorIdentity: string; manaCost: string };
export type CollectionCard = { id: string; profileId: string; name: string; qty: number; owned: boolean };
export type DeckSummary = { id: string; name: string; commander: string | null; cardCount: number };
export type DeckCard = { id: string; deckId: string; name: string; qty: number; isBasic: boolean };

/** A failed API response; keeps the HTTP status so callers can tell "not found" from other failures. */
export class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly url: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function isNotFound(cause: unknown, url?: string) {
  return cause instanceof HttpError && cause.status === 404 && (url === undefined || cause.url === url);
}

export async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new HttpError(data.error || "Request failed.", response.status, url);
  return data as T;
}

export function cardImage(name: string, catalog?: CatalogCard) {
  return catalog?.img || `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image`;
}
