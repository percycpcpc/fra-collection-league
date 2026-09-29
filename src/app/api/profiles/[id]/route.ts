import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { cleanName, error } from "@/lib/api";
import { getDb } from "@/lib/db";
import { collectionCards, deckCards, decks, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const db = getDb();

  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const [cards, profileDecks] = await Promise.all([
    db
      .select()
      .from(collectionCards)
      .where(eq(collectionCards.profileId, id))
      .orderBy(collectionCards.name),
    db
      .select({
        id: decks.id,
        profileId: decks.profileId,
        name: decks.name,
        commander: decks.commander,
        createdAt: decks.createdAt,
      })
      .from(decks)
      .where(eq(decks.profileId, id))
      .orderBy(sql`${decks.createdAt} desc`),
  ]);

  // Get card counts per deck
  const deckIds = profileDecks.map((d) => d.id);
  const deckCardCounts = deckIds.length
    ? await db
        .select({
          deckId: deckCards.deckId,
          total: sql<number>`sum(${deckCards.qty})`,
        })
        .from(deckCards)
        .where(
          sql`${deckCards.deckId} in (${sql.join(
            deckIds.map((did) => sql`${did}`),
            sql`, `,
          )})`,
        )
        .groupBy(deckCards.deckId)
    : [];

  const cardCountMap = new Map(
    deckCardCounts.map((r) => [r.deckId, r.total ?? 0]),
  );

  return NextResponse.json({
    profile,
    cards,
    decks: profileDecks.map((d) => ({
      ...d,
      cardCount: cardCountMap.get(d.id) ?? 0,
    })),
  });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return error("Profile name is required.");

  const db = getDb();

  const exists = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  if (!exists.length) return error("Profile not found.", 404);

  const duplicate = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.name, name), sql`${profiles.id} != ${id}`))
    .limit(1);
  if (duplicate.length)
    return error("A profile with that name already exists.", 409);

  await db.update(profiles).set({ name }).where(eq(profiles.id, id));
  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0]);
  return NextResponse.json({ profile });
}

export async function DELETE(_: Request, { params }: Context) {
  const { id } = await params;
  const db = getDb();

  const exists = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  if (!exists.length) return error("Profile not found.", 404);

  await db.delete(profiles).where(eq(profiles.id, id));
  return NextResponse.json({ deleted: true });
}
