import { NextResponse } from "next/server";
import { cleanName, error } from "@/lib/api";
import { matchDeckIds, matchResponse } from "@/lib/matches";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const matches = await prisma.match.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { winner: { select: { name: true, iconCard: true } }, loser: { select: { name: true, iconCard: true } } },
  });
  const decks = await prisma.deck.findMany({
    where: { id: { in: matchDeckIds(matches) } },
    select: { id: true, name: true },
  });
  const deckNames = new Map(decks.map((deck) => [deck.id, deck.name]));
  return NextResponse.json({ matches: matches.map((match) => matchResponse(match, deckNames)) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const winnerId = cleanName(body.winnerId);
  const loserId = cleanName(body.loserId);
  if (!winnerId || !loserId) return error("Winner and loser are required.");
  if (winnerId === loserId) return error("Winner and loser must be different players.");

  const winnerDeckId = body.winnerDeckId == null ? null : cleanName(body.winnerDeckId);
  const loserDeckId = body.loserDeckId == null ? null : cleanName(body.loserDeckId);
  if ((body.winnerDeckId != null && !winnerDeckId) || (body.loserDeckId != null && !loserDeckId)) {
    return error("Deck ids must be non-empty strings or null.");
  }
  if (body.note != null && typeof body.note !== "string") return error("Note must be a string.");
  if (typeof body.note === "string" && body.note.length > 200) return error("Note must be 200 characters or fewer.");
  const note = cleanName(body.note) || null;

  const [profiles, decks] = await Promise.all([
    prisma.profile.findMany({ where: { id: { in: [winnerId, loserId] } }, select: { id: true } }),
    prisma.deck.findMany({
      where: { id: { in: [winnerDeckId, loserDeckId].filter((id): id is string => Boolean(id)) } },
      select: { id: true, profileId: true },
    }),
  ]);
  const profileIds = new Set(profiles.map((profile) => profile.id));
  if (!profileIds.has(winnerId) || !profileIds.has(loserId)) return error("Winner and loser must be existing profiles.");
  const deckOwners = new Map(decks.map((deck) => [deck.id, deck.profileId]));
  if (winnerDeckId && deckOwners.get(winnerDeckId) !== winnerId) return error("Winner deck must belong to the winner.");
  if (loserDeckId && deckOwners.get(loserDeckId) !== loserId) return error("Loser deck must belong to the loser.");

  const match = await prisma.match.create({
    data: { winnerId, loserId, winnerDeckId, loserDeckId, note },
    include: { winner: { select: { name: true, iconCard: true } }, loser: { select: { name: true, iconCard: true } } },
  });
  const deckNames = new Map(
    (await prisma.deck.findMany({ where: { id: { in: matchDeckIds([match]) } }, select: { id: true, name: true } }))
      .map((deck) => [deck.id, deck.name]),
  );
  return NextResponse.json({ match: matchResponse(match, deckNames) }, { status: 201 });
}
