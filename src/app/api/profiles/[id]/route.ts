import { NextResponse } from "next/server";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { cleanName, error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { chunksOf } from "@/lib/chunks";
import { collectionCards, deckCards, decks, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const db = getDb();
  const profile = await db.select().from(profiles).where(eq(profiles.id, id))
    .limit(1).then((rows) => rows[0] ?? null);
  if (!profile) return error("Profile not found.", 404);
  const [cards, profileDecks] = await Promise.all([
    db.select().from(collectionCards).where(eq(collectionCards.profileId, id)).orderBy(collectionCards.name),
    db.select({
      id: decks.id, profileId: decks.profileId, name: decks.name,
      commander: decks.commander, createdAt: decks.createdAt,
    }).from(decks).where(eq(decks.profileId, id)).orderBy(desc(decks.createdAt)),
  ]);
  const deckIds = profileDecks.map((deck) => deck.id);
  const deckCardCounts = (await Promise.all(chunksOf(deckIds, 99).map((ids) =>
    db.select({ deckId: deckCards.deckId, total: sql<number>`sum(${deckCards.qty})` })
      .from(deckCards).where(inArray(deckCards.deckId, ids)).groupBy(deckCards.deckId),
  ))).flat();
  const cardCountMap = new Map(deckCardCounts.map((row) => [row.deckId, row.total ?? 0]));
  return NextResponse.json({
    profile,
    cards,
    decks: profileDecks.map((deck) => ({ ...deck, cardCount: cardCountMap.get(deck.id) ?? 0 })),
  });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const data: { name?: string; iconCard?: string | null } = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = cleanName(body.name);
    if (!name) return error("Profile name is required.");
    data.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "iconCard")) {
    if (body.iconCard === null) data.iconCard = null;
    else if (typeof body.iconCard === "string") {
      const canonicalName = catalogNames().get(body.iconCard.toLocaleLowerCase());
      if (!canonicalName) return error("Unknown card name.");
      data.iconCard = canonicalName;
    } else return error("iconCard must be a card name or null.");
  }
  if (!Object.keys(data).length) return error("No profile changes provided.");

  const db = getDb();
  const exists = await db.select({ id: profiles.id }).from(profiles)
    .where(eq(profiles.id, id)).limit(1);
  if (!exists.length) return error("Profile not found.", 404);
  if (data.name) {
    const duplicate = await db.select({ id: profiles.id }).from(profiles)
      .where(and(eq(profiles.name, data.name), ne(profiles.id, id))).limit(1);
    if (duplicate.length) return error("A profile with that name already exists.", 409);
  }
  try {
    await db.update(profiles).set(data).where(eq(profiles.id, id));
  } catch (cause) {
    if (String(cause).includes("UNIQUE constraint failed")) {
      return error("A profile with that name already exists.", 409);
    }
    throw cause;
  }
  const profile = await db.select().from(profiles).where(eq(profiles.id, id))
    .limit(1).then((rows) => rows[0]);
  return NextResponse.json({ profile });
}

export async function DELETE(_: Request, { params }: Context) {
  const { id } = await params;
  const db = getDb();
  const exists = await db.select({ id: profiles.id }).from(profiles)
    .where(eq(profiles.id, id)).limit(1);
  if (!exists.length) return error("Profile not found.", 404);
  await db.delete(profiles).where(eq(profiles.id, id));
  return NextResponse.json({ deleted: true });
}
