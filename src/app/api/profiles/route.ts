import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { cleanName, error, isUniqueError, parseBody } from "@/lib/api";
import { getCatalog } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { collectionCards, decks, profiles } from "@/db/schema";

// D1 hard limit: 100 bound parameters per statement.
// CollectionCard has 5 columns → max 20 rows per INSERT.
const D1_BATCH_SIZE = 20;

/** Split an array into chunks of at most `size`. */
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export async function GET() {
  const db = getDb();

  const rows = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .orderBy(profiles.name);

  const profileIds = rows.map((p) => p.id);
  if (!profileIds.length) return NextResponse.json({ profiles: [] });

  const [cardSums, deckCounts] = await Promise.all([
    db
      .select({
        profileId: collectionCards.profileId,
        total: sql<number>`sum(${collectionCards.qty})`,
      })
      .from(collectionCards)
      .groupBy(collectionCards.profileId),
    db
      .select({ profileId: decks.profileId, count: sql<number>`count(*)` })
      .from(decks)
      .groupBy(decks.profileId),
  ]);

  const cardSumMap = new Map(cardSums.map((r) => [r.profileId, r.total ?? 0]));
  const deckCountMap = new Map(
    deckCounts.map((r) => [r.profileId, r.count ?? 0]),
  );

  return NextResponse.json({
    profiles: rows.map((p) => ({
      ...p,
      cardCount: cardSumMap.get(p.id) ?? 0,
      deckCount: deckCountMap.get(p.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  const name = cleanName(body.name);
  if (!name) return error("Profile name is required.");
  if (body.seedCommons !== undefined && typeof body.seedCommons !== "boolean") {
    return error("seedCommons must be a boolean.");
  }
  const seedCommons = body.seedCommons ?? true;

  const db = getDb();

  // Fast-path duplicate check for a friendly message on the common case.
  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.name, name))
    .limit(1);
  if (existing.length)
    return error("A profile with that name already exists.", 409);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Insert profile first so we have the ID for the seed inserts.
  // Catch the UNIQUE violation too, in case two same-name creates race
  // past the pre-check above.
  try {
    await db.insert(profiles).values({ id, name, createdAt });
  } catch (cause) {
    if (isUniqueError(cause))
      return error("A profile with that name already exists.", 409);
    throw cause;
  }

  if (seedCommons) {
    const catalog = getCatalog();
    const seededCards = catalog.filter(
      (c) => c.rarity === "common" || c.rarity === "uncommon",
    );

    if (seededCards.length) {
      const rows = seededCards.map((card) => ({
        id: crypto.randomUUID(),
        profileId: id,
        name: card.name,
        qty: 1,
        owned: true,
      }));

      // Insert in batches of D1_BATCH_SIZE to stay within the 100-param limit.
      // If any batch fails, roll back by deleting the profile (cascade removes cards).
      try {
        for (const batch of chunks(rows, D1_BATCH_SIZE)) {
          await db.insert(collectionCards).values(batch);
        }
      } catch (err) {
        // Best-effort rollback — delete the profile (cascades to cards)
        await db
          .delete(profiles)
          .where(eq(profiles.id, id))
          .catch(() => {});
        throw err;
      }
    }
  }

  return NextResponse.json(
    { profile: { id, name, createdAt } },
    { status: 201 },
  );
}
