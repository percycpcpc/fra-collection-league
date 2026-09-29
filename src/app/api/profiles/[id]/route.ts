import { NextResponse } from "next/server";
import { cleanName, error, isUniqueError } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: {
      cards: { orderBy: { name: "asc" } },
      decks: { orderBy: { createdAt: "desc" }, include: { cards: { select: { qty: true } } } },
    },
  });
  if (!profile) return error("Profile not found.", 404);
  const { cards, decks, ...details } = profile;
  return NextResponse.json({
    profile: details,
    cards,
    decks: decks.map(({ cards: deckCards, ...deck }) => ({ ...deck, cardCount: deckCards.reduce((sum, card) => sum + card.qty, 0) })),
  });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const data: { name?: string; iconCard?: string | null } = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = cleanName(body.name);
    if (!name) return error("Profile name is required.");
    data.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "iconCard")) {
    if (body.iconCard === null) {
      data.iconCard = null;
    } else if (typeof body.iconCard === "string") {
      const names = await catalogNames();
      const canonicalName = names.get(body.iconCard.toLocaleLowerCase());
      if (!canonicalName) return error("Unknown card name.");
      data.iconCard = canonicalName;
    } else {
      return error("iconCard must be a card name or null.");
    }
  }

  if (Object.keys(data).length === 0) return error("No profile changes provided.");
  try {
    const profile = await prisma.profile.update({ where: { id }, data });
    return NextResponse.json({ profile });
  } catch (cause) {
    if (isUniqueError(cause)) return error("A profile with that name already exists.", 409);
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "P2025") return error("Profile not found.", 404);
    throw cause;
  }
}

export async function DELETE(_: Request, { params }: Context) {
  const { id } = await params;
  try {
    await prisma.profile.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "P2025") return error("Profile not found.", 404);
    throw cause;
  }
}
