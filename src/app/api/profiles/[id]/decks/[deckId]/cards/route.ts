import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { cleanName, error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { collectionCards, deckCards, decks } from "@/db/schema";

type Context = { params: Promise<{ id: string; deckId: string }> };
const BASICS = new Set(["plains", "island", "swamp", "mountain", "forest"]);

export async function PUT(request: Request, { params }: Context) {
  const { id, deckId } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const rawName = cleanName(body.name);
  const qty = body.qty;
  if (!rawName) return error("Card name is required.");
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 0)
    return error("Quantity must be a non-negative integer.");

  const db = getDb();

  const deck = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.profileId, id)))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!deck) return error("Deck not found.", 404);

  const names = catalogNames();
  const name = names.get(rawName.toLocaleLowerCase()) ?? rawName;
  const isBasic = BASICS.has(name.toLocaleLowerCase());

  if (isBasic && qty > 99) return error("Basic land quantity cannot exceed 99.");

  if (!isBasic && qty > 0) {
    const collection = await db
      .select({ qty: collectionCards.qty, owned: collectionCards.owned })
      .from(collectionCards)
      .where(
        and(eq(collectionCards.profileId, id), eq(collectionCards.name, name)),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    const available = collection?.owned ? collection.qty : 0;
    if (qty > available)
      return error(`Only ${available} owned ${name} available.`);
  }

  if (qty === 0) {
    await db
      .delete(deckCards)
      .where(and(eq(deckCards.deckId, deckId), eq(deckCards.name, name)));
    return NextResponse.json({ deleted: true });
  }

  // Upsert deck card
  const existing = await db
    .select({ id: deckCards.id })
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deckId), eq(deckCards.name, name)))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) {
    await db
      .update(deckCards)
      .set({ qty, isBasic })
      .where(and(eq(deckCards.deckId, deckId), eq(deckCards.name, name)));
    const card = await db
      .select()
      .from(deckCards)
      .where(eq(deckCards.id, existing.id))
      .limit(1)
      .then((r) => r[0]);
    return NextResponse.json({ card });
  }

  const cardId = crypto.randomUUID();
  await db
    .insert(deckCards)
    .values({ id: cardId, deckId, name, qty, isBasic });
  const card = await db
    .select()
    .from(deckCards)
    .where(eq(deckCards.id, cardId))
    .limit(1)
    .then((r) => r[0]);
  return NextResponse.json({ card });
}
