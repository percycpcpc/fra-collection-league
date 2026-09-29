import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { cleanName, error } from "@/lib/api";
import { getCatalog } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { collectionCards, decks, profiles } from "@/db/schema";

export async function GET() {
  const db = getDb();

  // Get profiles with card qty sum and deck count
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
  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return error("Profile name is required.");
  if (body.seedCommons !== undefined && typeof body.seedCommons !== "boolean") {
    return error("seedCommons must be a boolean.");
  }
  const seedCommons = body.seedCommons ?? true;

  const db = getDb();

  // Check for duplicate name
  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.name, name))
    .limit(1);
  if (existing.length)
    return error("A profile with that name already exists.", 409);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.insert(profiles).values({ id, name, createdAt });

  if (seedCommons) {
    const catalog = getCatalog();
    const seededCards = catalog.filter(
      (c) => c.rarity === "common" || c.rarity === "uncommon",
    );
    if (seededCards.length) {
      await db.insert(collectionCards).values(
        seededCards.map((card) => ({
          id: crypto.randomUUID(),
          profileId: id,
          name: card.name,
          qty: 1,
          owned: true,
        })),
      );
    }
  }

  const profile = { id, name, createdAt };
  return NextResponse.json({ profile }, { status: 201 });
}
