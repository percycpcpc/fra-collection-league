import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { chunksOf } from "@/lib/chunks";
import { collectionCards, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

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
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.text !== "string" || !body.text.trim()) return error("Import text is required.");

  const db = getDb();

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const known = await catalogNames(db);
  const merged = new Map<string, { name: string; qty: number; known: boolean }>();
  for (const line of body.text.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const canonical = known.get(parsed.name.toLocaleLowerCase());
    const name = canonical ?? parsed.name;
    const key = name.toLocaleLowerCase();
    const prior = merged.get(key);
    merged.set(key, { name, qty: (prior?.qty ?? 0) + parsed.qty, known: Boolean(canonical) });
  }
  if (!merged.size) return error("No valid card lines were found.");

  const entries = [...merged.values()];
  const names = entries.map((e) => e.name);

  // Find which cards already exist
  const existing = (
    await Promise.all(
      chunksOf(names, 99).map((nameChunk) =>
        db.select({ name: collectionCards.name }).from(collectionCards).where(
          and(eq(collectionCards.profileId, id), inArray(collectionCards.name, nameChunk)),
        ),
      ),
    )
  ).flat();
  const existingNames = new Set(existing.map((c) => c.name));

  const updates = entries.filter((e) => existingNames.has(e.name));
  const inserts = entries.filter((e) => !existingNames.has(e.name));

  for (const updateChunk of chunksOf(updates, 99)) {
    const statements = updateChunk.map((entry) =>
      db.update(collectionCards)
        .set({ qty: sql`${collectionCards.qty} + ${entry.qty}` })
        .where(and(eq(collectionCards.profileId, id), eq(collectionCards.name, entry.name))),
    );
    await db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);
  }
  for (const insertChunk of chunksOf(inserts, 20)) {
    await db.insert(collectionCards).values(
      insertChunk.map((e) => ({
        id: crypto.randomUUID(),
        profileId: id,
        name: e.name,
        qty: e.qty,
        owned: true,
      })),
    );
  }

  return NextResponse.json({
    added: inserts.length,
    updated: updates.length,
    unknown: entries.filter((e) => !e.known).map((e) => e.name),
  });
}
