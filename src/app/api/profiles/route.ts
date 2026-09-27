import { NextResponse } from "next/server";
import { cleanName, error, isUniqueError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const profiles = await prisma.profile.findMany({
    orderBy: { name: "asc" },
    include: { cards: { select: { qty: true } }, _count: { select: { decks: true } } },
  });
  return NextResponse.json({
    profiles: profiles.map(({ _count, cards, ...profile }) => ({
      ...profile,
      cardCount: cards.reduce((sum, card) => sum + card.qty, 0),
      deckCount: _count.decks,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return error("Profile name is required.");
  try {
    const profile = await prisma.profile.create({ data: { name } });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (cause) {
    if (isUniqueError(cause)) return error("A profile with that name already exists.", 409);
    throw cause;
  }
}
