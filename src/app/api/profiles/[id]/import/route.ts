import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { getDb } from "@/lib/db";
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
  const body = await request.json().catch(() => ({}));
  if (typeof body.text !== "string" || !body.text.trim()) return error("Import text is required.");

  const db = getDb();

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const known = catalogNames();
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
  const existing = await db
    .select({ name: collectionCards.name })
    .from(collectionCards)
    .where(
      and(
        eq(collectionCards.profileId, id),
        inArray(collectionCards.name, names),
      ),
    );
  const existingNames = new Set(existing.map((c) => c.name));

  const updates = entries.filter((e) => existingNames.has(e.name));
  const inserts = entries.filter((e) => !existingNames.has(e.name));

  // Execute updates sequentially (D1 batch semantics)
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
  if (inserts.length) {
    await db.insert(collectionCards).values(
      inserts.map((e) => ({
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
