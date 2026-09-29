import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { cleanName, error } from "@/lib/api";
import { getDb } from "@/lib/db";
import { decks, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return error("Deck name is required.");
  if (
    body.commander !== undefined &&
    body.commander !== null &&
    typeof body.commander !== "string"
  )
    return error("Commander must be a card name or null.");

  const db = getDb();

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const commander = cleanName(body.commander) || null;
  const deckId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db
    .insert(decks)
    .values({ id: deckId, profileId: id, name, commander, createdAt });
  const deck = await db
    .select()
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1)
    .then((r) => r[0]);

  return NextResponse.json({ deck }, { status: 201 });
}
