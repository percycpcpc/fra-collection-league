import { NextResponse } from "next/server";
import { cleanName, error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; deckId: string }> };
const BASICS = new Set(["plains", "island", "swamp", "mountain", "forest"]);

export async function PUT(request: Request, { params }: Context) {
  const { id, deckId } = await params;
  const body = await request.json().catch(() => ({}));
  const rawName = cleanName(body.name);
  if (!rawName) return error("Card name is required.");
  if (!Number.isInteger(body.qty) || body.qty < 0) return error("Quantity must be a non-negative integer.");
  const deck = await prisma.deck.findFirst({ where: { id: deckId, profileId: id }, select: { id: true } });
  if (!deck) return error("Deck not found.", 404);
  const names = await catalogNames();
  const name = names.get(rawName.toLocaleLowerCase()) ?? rawName;
  const isBasic = BASICS.has(name.toLocaleLowerCase());
  if (isBasic && body.qty > 99) return error("Basic land quantity cannot exceed 99.");
  if (!isBasic && body.qty > 0) {
    const collection = await prisma.collectionCard.findUnique({
      where: { profileId_name: { profileId: id, name } },
      select: { qty: true, owned: true },
    });
    const available = collection?.owned ? collection.qty : 0;
    if (body.qty > available) return error(`Only ${available} owned ${name} available.`);
  }
  if (body.qty === 0) {
    await prisma.deckCard.deleteMany({ where: { deckId, name } });
    return NextResponse.json({ deleted: true });
  }
  const card = await prisma.deckCard.upsert({
    where: { deckId_name: { deckId, name } },
    create: { deckId, name, qty: body.qty, isBasic },
    update: { qty: body.qty, isBasic },
  });
  return NextResponse.json({ card });
}
