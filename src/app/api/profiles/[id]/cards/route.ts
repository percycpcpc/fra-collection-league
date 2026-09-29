import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { cleanName, error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { collectionCards, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const rawName = cleanName(body.name);
  if (!rawName) return error("Card name is required.");
  if (body.qty !== undefined && (!Number.isInteger(body.qty) || body.qty < 0))
    return error("Quantity must be a non-negative integer.");
  if (body.owned !== undefined && typeof body.owned !== "boolean")
    return error("Owned must be true or false.");

  const db = getDb();

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const names = catalogNames();
  const name = names.get(rawName.toLocaleLowerCase()) ?? rawName;

  if (body.qty === 0) {
    await db
      .delete(collectionCards)
      .where(
        and(eq(collectionCards.profileId, id), eq(collectionCards.name, name)),
      );
    return NextResponse.json({ deleted: true });
  }

  // Upsert via insert + onConflictDoUpdate
  const cardId = crypto.randomUUID();
  const qty: number = body.qty ?? 1;
  const owned: boolean = body.owned ?? true;

  const existing = await db
    .select()
    .from(collectionCards)
    .where(
      and(eq(collectionCards.profileId, id), eq(collectionCards.name, name)),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) {
    await db
      .update(collectionCards)
      .set({
        ...(body.qty !== undefined ? { qty } : {}),
        ...(body.owned !== undefined ? { owned } : {}),
      })
      .where(
        and(eq(collectionCards.profileId, id), eq(collectionCards.name, name)),
      );
    const card = await db
      .select()
      .from(collectionCards)
      .where(
        and(eq(collectionCards.profileId, id), eq(collectionCards.name, name)),
      )
      .limit(1)
      .then((r) => r[0]);
    return NextResponse.json({ card });
  }

  await db
    .insert(collectionCards)
    .values({ id: cardId, profileId: id, name, qty, owned });
  const card = await db
    .select()
    .from(collectionCards)
    .where(eq(collectionCards.id, cardId))
    .limit(1)
    .then((r) => r[0]);
  return NextResponse.json({ card });
}
