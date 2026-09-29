// Developer-run, authoring-time enrichment. NOT part of the request-time runtime.
// Fetches the FRA set from Scryfall, matches each catalog entry by name, and
// writes a canonical WUBRG `colorIdentity` string into data/catalog.json.
//
// Run: node scripts/enrich-catalog.mjs
//
// Aborts without writing if any catalog entry has no Scryfall match (Req 1.6),
// and cross-checks each written string against the source color_identity array.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/catalog.json");
const WUBRG_ORDER = ["W", "U", "B", "R", "G"];

function serializeIdentity(arr) {
  const set = new Set((arr || []).map((c) => String(c).toUpperCase()));
  return WUBRG_ORDER.filter((c) => set.has(c)).join("");
}

// The catalog spans the Reality Fracture block: the main set (fra) and its
// Commander companion (frc). We index color identity by card name across both.
const FRA_QUERY = "(set:fra or set:frc)";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "fra-collection-league-enrichment/1.0" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Scryfall request failed: ${res.status} ${res.statusText} (${url})`);
  return res.json();
}

function indexCard(byName, card) {
  const ci = card.color_identity || [];
  byName.set(card.name.toLowerCase(), ci);
  if (card.name.includes("//")) {
    for (const part of card.name.split("//")) byName.set(part.trim().toLowerCase(), ci);
  }
  if (Array.isArray(card.card_faces)) {
    for (const face of card.card_faces) if (face.name) byName.set(face.name.toLowerCase(), ci);
  }
}

async function fetchAllFraCards() {
  const byName = new Map(); // lowercased name -> color_identity array
  let url =
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(FRA_QUERY)}&unique=cards&format=json`;
  while (url) {
    const page = await fetchJson(url);
    if (!page) break;
    for (const card of page.data) indexCard(byName, card);
    url = page.has_more ? page.next_page : null;
    if (url) await new Promise((r) => setTimeout(r, 120)); // be polite to the API
  }
  return byName;
}

// Exact-name fallback for any catalog entry not present in the FRA-block search.
// Uses the card's authoritative color_identity from Scryfall (Req 1.4).
async function fetchExact(name) {
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=json`;
  const card = await fetchJson(url);
  await new Promise((r) => setTimeout(r, 120));
  return card && card.object === "card" ? card.color_identity || [] : undefined;
}

async function main() {
  const raw = await readFile(CATALOG_PATH, "utf8");
  const catalog = JSON.parse(raw);
  const byName = await fetchAllFraCards();
  console.log(`Fetched ${byName.size} FRA name keys from Scryfall.`);

  const unmatched = [];
  const enriched = [];
  for (const entry of catalog) {
    const key = entry.name.toLowerCase();
    let ci = byName.get(key);
    if (ci === undefined && key.includes("//")) {
      ci = byName.get(key.split("//")[0].trim());
    }
    if (ci === undefined) {
      // Fall back to an exact Scryfall lookup for cards outside the FRA-block search.
      ci = await fetchExact(entry.name);
      if (ci !== undefined) console.log(`  (exact fallback) ${entry.name} -> [${ci.join(",")}]`);
    }
    if (ci === undefined) {
      unmatched.push(entry.name);
      enriched.push(entry);
      continue;
    }
    const colorIdentity = serializeIdentity(ci);
    // Cross-check: re-parse the written string, confirm set-equality with source.
    const written = new Set(colorIdentity.split("").filter(Boolean));
    const source = new Set(ci.map((c) => String(c).toUpperCase()).filter((c) => WUBRG_ORDER.includes(c)));
    if (written.size !== source.size || [...source].some((c) => !written.has(c))) {
      throw new Error(`Cross-check failed for "${entry.name}": ${JSON.stringify([...source])} vs ${colorIdentity}`);
    }
    enriched.push({ ...entry, colorIdentity });
  }

  if (unmatched.length) {
    console.error(`ABORT: ${unmatched.length} catalog entries had no Scryfall match:`);
    for (const name of unmatched) console.error(`  - ${name}`);
    process.exit(1);
  }

  await writeFile(CATALOG_PATH, JSON.stringify(enriched, null, 2) + "\n", "utf8");
  console.log(`Enriched ${enriched.length} catalog entries with colorIdentity.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
