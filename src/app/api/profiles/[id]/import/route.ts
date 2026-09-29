import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { error, parseBody } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { collectionCards, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

// D1 hard limit: 100 bound parameters per statement.
// CollectionCard INSERT: 5 columns → 20 rows per batch.
// inArray lookup:        1 column  → 100 names per batch.
const INSERT_BATCH = 20;
const IN_BATCH = 100;

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function parseLine(line: string) {
  let name = line.trim();
  if (!name) return null;

  const quantity = name.match(/^(\d+)(?:x)?\s+(.+)$/i);
  const qty = quantity ? Number(quantity[1]) : 1;
  if (quantity) name = quantity[2];

  const setCode = name.match(/\s+\([A-Za-z0-9]+\)/);
  if (setCode?.index !== undefined) {
    name = name.slice(0, setCode.index);
  } else {
    name = name
      .replace(/\s+\[[^\]]*\]\s*$/, "")
      .replace(/\s+\*[^*]+\*\s*$/, "")
      .replace(/\s+\d+\s*$/, "");
  }

  name = name.trim().replace(/[\s,;:.!?-]+$/, "");
  return qty > 0 && name ? { qty, name } : null;
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await parseBody(request);
  if (typeof body.text !== "string" || !body.text.trim())
    return error("Import text is required.");

  const db = getDb();

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const known = catalogNames();
  const merged = new Map<
    string,
    { name: string; qty: number; known: boolean }
  >();
  for (const line of body.text.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const canonical = known.get(parsed.name.toLocaleLowerCase());
    const name = canonical ?? parsed.name;
    const key = name.toLocaleLowerCase();
    const prior = merged.get(key);
    merged.set(key, {
      name,
      qty: (prior?.qty ?? 0) + parsed.qty,
      known: Boolean(canonical),
    });
  }
  if (!merged.size) return error("No valid card lines were found.");

  const entries = [...merged.values()];
  const names = entries.map((e) => e.name);

  // Fetch existing cards in batches to stay within the 100-param IN limit.
  const existingRows: { name: string }[] = [];
  for (const batch of chunks(names, IN_BATCH)) {
    const rows = await db
      .select({ name: collectionCards.name })
      .from(collectionCards)
      .where(
        and(
          eq(collectionCards.profileId, id),
          inArray(collectionCards.name, batch),
        ),
      );
    existingRows.push(...rows);
  }
  const existingNames = new Set(existingRows.map((c) => c.name));

  const updates = entries.filter((e) => existingNames.has(e.name));
  const inserts = entries.filter((e) => !existingNames.has(e.name));

  // Sequential updates (each touches one row — no batch limit issue).
  for (const entry of updates) {
    await db
      .update(collectionCards)
      .set({ qty: sql`${collectionCards.qty} + ${entry.qty}` })
      .where(
        and(
          eq(collectionCards.profileId, id),
          eq(collectionCards.name, entry.name),
        ),
      );
  }

  // Batched inserts — max INSERT_BATCH rows per statement.
  if (inserts.length) {
    const rows = inserts.map((e) => ({
      id: crypto.randomUUID(),
      profileId: id,
      name: e.name,
      qty: e.qty,
      owned: true,
    }));
    for (const batch of chunks(rows, INSERT_BATCH)) {
      await db.insert(collectionCards).values(batch);
    }
  }

  return NextResponse.json({
    added: inserts.length,
    updated: updates.length,
    unknown: entries.filter((e) => !e.known).map((e) => e.name),
  });
}
