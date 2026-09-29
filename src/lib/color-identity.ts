// Pure color-identity module. No React, no D1, no fs.
// Models MTG color identity as a set of WUBRG colors.

export type WUBRG = "W" | "U" | "B" | "R" | "G";
export type ColorIdentity = Set<WUBRG>;

export const WUBRG_ORDER: readonly WUBRG[] = ["W", "U", "B", "R", "G"] as const;

const WUBRG_SET: ReadonlySet<string> = new Set(WUBRG_ORDER);

/**
 * Parse a stored colorIdentity value into a set of distinct WUBRG colors.
 * Tolerant: null/undefined/non-string -> empty set; lowercase accepted;
 * duplicates collapsed; non-WUBRG characters ignored; at most 5 colors.
 */
export function parseIdentity(value: unknown): ColorIdentity {
  const out: ColorIdentity = new Set();
  if (typeof value !== "string") return out;
  for (const ch of value.toUpperCase()) {
    if (WUBRG_SET.has(ch)) out.add(ch as WUBRG);
  }
  return out;
}

/**
 * Serialize a set to canonical WUBRG order, e.g. {G,W} -> "WG".
 * Empty set -> "".
 */
export function serializeIdentity(id: ColorIdentity): string {
  let s = "";
  for (const c of WUBRG_ORDER) {
    if (id.has(c)) s += c;
  }
  return s;
}

/**
 * True when every color in `card` is also in `commander`.
 * Empty `card` is a subset of any `commander`.
 */
export function isSubsetIdentity(card: ColorIdentity, commander: ColorIdentity): boolean {
  for (const c of card) {
    if (!commander.has(c)) return false;
  }
  return true;
}

/** Union of any number of identities. */
export function unionIdentity(...ids: ColorIdentity[]): ColorIdentity {
  const out: ColorIdentity = new Set();
  for (const id of ids) {
    for (const c of id) out.add(c);
  }
  return out;
}
