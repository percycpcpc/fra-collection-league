import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { cleanName, error, parseBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { deckCards, decks } from "@/db/schema";

type Context = { params: Promise<{ id: string; deckId: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id, deckId } = await params;
  const db = getDb();

  const deck = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.profileId, id)))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!deck) return error("Deck not found.", 404);

  const cards = await db
    .select()
    .from(deckCards)
    .where(eq(deckCards.deckId, deckId))
    .orderBy(deckCards.name);

  return NextResponse.json({ deck, cards });
}

export async function PUT(request: Request, { params }: Context) {
  const { id, deckId } = await params;
  const body = await parseBody(request);
  if (body.name === undefined && body.commander === undefined)
    return error("Provide a name or commander to update.");

  const updateData: { name?: string; commander?: string | null } = {};
  if (body.name !== undefined) {
    updateData.name = cleanName(body.name);
    if (!updateData.name) return error("Deck name is required.");
  }
  if (body.commander !== undefined) {
    if (body.commander !== null && typeof body.commander !== "string")
      return error("Commander must be a card name or null.");
    updateData.commander = cleanName(body.commander) || null;
  }

  const db = getDb();

  const exists = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.profileId, id)))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!exists) return error("Deck not found.", 404);

  await db
    .update(decks)
    .set(updateData)
    .where(and(eq(decks.id, deckId), eq(decks.profileId, id)));

  const deck = await db
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1)
    .then((r) => r[0]);
  return NextResponse.json({ deck });
}

export async function DELETE(_: Request, { params }: Context) {
  const { id, deckId } = await params;
  const db = getDb();

  const exists = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.profileId, id)))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!exists) return error("Deck not found.", 404);

  await db
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.profileId, id)));
  return NextResponse.json({ deleted: true });
}
