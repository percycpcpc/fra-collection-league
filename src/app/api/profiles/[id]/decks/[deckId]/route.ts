import { NextResponse } from "next/server";
import { cleanName, error } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; deckId: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id, deckId } = await params;
  const deck = await prisma.deck.findFirst({ where: { id: deckId, profileId: id }, include: { cards: { orderBy: { name: "asc" } } } });
  if (!deck) return error("Deck not found.", 404);
  const { cards, ...details } = deck;
  return NextResponse.json({ deck: details, cards });
}

export async function PUT(request: Request, { params }: Context) {
  const { id, deckId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.name === undefined && body.commander === undefined) return error("Provide a name or commander to update.");
  const data: { name?: string; commander?: string | null } = {};
  if (body.name !== undefined) {
    data.name = cleanName(body.name);
    if (!data.name) return error("Deck name is required.");
  }
  if (body.commander !== undefined) {
    if (body.commander !== null && typeof body.commander !== "string") return error("Commander must be a card name or null.");
    data.commander = cleanName(body.commander) || null;
  }
  const result = await prisma.deck.updateMany({ where: { id: deckId, profileId: id }, data });
  if (!result.count) return error("Deck not found.", 404);
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  return NextResponse.json({ deck });
}

export async function DELETE(_: Request, { params }: Context) {
  const { id, deckId } = await params;
  const result = await prisma.deck.deleteMany({ where: { id: deckId, profileId: id } });
  if (!result.count) return error("Deck not found.", 404);
  return NextResponse.json({ deleted: true });
}
