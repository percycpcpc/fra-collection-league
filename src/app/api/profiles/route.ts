import { NextResponse } from "next/server";
import { cleanName, error, isUniqueError } from "@/lib/api";
import { getCatalog } from "@/lib/catalog";
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
  if (body.seedCommons !== undefined && typeof body.seedCommons !== "boolean") {
    return error("seedCommons must be a boolean.");
  }
  const seedCommons = body.seedCommons ?? true;
  try {
    const catalog = seedCommons ? await getCatalog() : [];
    const seededCards = catalog.filter(
      (card) => card.rarity === "common" || card.rarity === "uncommon",
    );
    const profile = await prisma.$transaction(async (tx) => {
      const createdProfile = await tx.profile.create({ data: { name } });
      if (seedCommons) {
        await tx.collectionCard.createMany({
          data: seededCards.map((card) => ({
            profileId: createdProfile.id,
            name: card.name,
            qty: 1,
            owned: true,
          })),
        });
      }
      return createdProfile;
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (cause) {
    if (isUniqueError(cause)) return error("A profile with that name already exists.", 409);
    throw cause;
  }
}
