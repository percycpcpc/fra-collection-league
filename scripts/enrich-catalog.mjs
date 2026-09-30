// Developer-run, authoring-time enrichment. NOT part of the request-time runtime.
// Fetches the FRA set from Scryfall, matches each catalog entry by name, and
// writes colorIdentity, colors, type, and manaCost into data/catalog.json.
//
// Run: node scripts/enrich-catalog.mjs
//
// Aborts without writing if any catalog entry has no Scryfall match.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../data/catalog.json");
const WUBRG_ORDER = ["W", "U", "B", "R", "G"];
const COLOR_NAMES = { W: "white", U: "blue", B: "black", R: "red", G: "green" };

function serializeIdentity(arr) {
  const set = new Set((arr || []).map((c) => String(c).toUpperCase()));
  return WUBRG_ORDER.filter((c) => set.has(c)).join("");
}

// Derive the single "colors" bucket used by the mana curve chart.
function serializeColors(arr) {
  if (!arr || arr.length === 0) return "colorless";
  if (arr.length > 1) return "multi";
  return COLOR_NAMES[arr[0].toUpperCase()] ?? "colorless";
}

// Build a normalised record from a Scryfall card object.
function buildRecord(card) {
  // For DFCs, mana_cost lives on card_faces; join with " // " matching parseCMC/tallySymbols convention.
  const faces = Array.isArray(card.card_faces) ? card.card_faces : [];
  const manaCost = faces.length
    ? faces.map((f) => f.mana_cost || "").filter(Boolean).join(" // ")
    : (card.mana_cost || "");

  return {
    colorIdentity: card.color_identity || [],
    colors: card.colors || [],
    // type_line already includes both faces separated by " // " for DFCs.
    type: card.type_line || "",
    manaCost,
  };
}

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
  const record = buildRecord(card);
  byName.set(card.name.toLowerCase(), record);
  if (card.name.includes("//")) {
    for (const part of card.name.split("//")) byName.set(part.trim().toLowerCase(), record);
  }
  if (Array.isArray(card.card_faces)) {
    for (const face of card.card_faces) if (face.name) byName.set(face.name.toLowerCase(), record);
  }
}

async function fetchAllFraCards() {
  const byName = new Map(); // lowercased name -> record
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(FRA_QUERY)}&unique=cards&format=json`;
  while (url) {
    const page = await fetchJson(url);
    if (!page) break;
    for (const card of page.data) indexCard(byName, card);
    url = page.has_more ? page.next_page : null;
    if (url) await new Promise((r) => setTimeout(r, 120));
  }
  return byName;
}

async function fetchExact(name) {
  const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=json`;
  const card = await fetchJson(url);
  await new Promise((r) => setTimeout(r, 120));
  return card && card.object === "card" ? buildRecord(card) : undefined;
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
    let record = byName.get(key);
    if (record === undefined && key.includes("//")) {
      record = byName.get(key.split("//")[0].trim());
    }
    if (record === undefined) {
      record = await fetchExact(entry.name);
      if (record !== undefined) console.log(`  (exact fallback) ${entry.name}`);
    }
    if (record === undefined) {
      unmatched.push(entry.name);
      enriched.push(entry);
      continue;
    }

    const colorIdentity = serializeIdentity(record.colorIdentity);
    // Cross-check colorIdentity round-trip.
    const written = new Set(colorIdentity.split("").filter(Boolean));
    const source = new Set(
      record.colorIdentity.map((c) => String(c).toUpperCase()).filter((c) => WUBRG_ORDER.includes(c))
    );
    if (written.size !== source.size || [...source].some((c) => !written.has(c))) {
      throw new Error(`Cross-check failed for "${entry.name}": ${JSON.stringify([...source])} vs ${colorIdentity}`);
    }

    enriched.push({
      ...entry,
      colorIdentity,
      colors: serializeColors(record.colors),
      type: record.type,
      manaCost: record.manaCost,
    });
  }

  if (unmatched.length) {
    console.error(`ABORT: ${unmatched.length} catalog entries had no Scryfall match:`);
    for (const name of unmatched) console.error(`  - ${name}`);
    process.exit(1);
  }

  await writeFile(CATALOG_PATH, JSON.stringify(enriched, null, 2) + "\n", "utf8");
  console.log(`Enriched ${enriched.length} catalog entries (colorIdentity, colors, type, manaCost).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
