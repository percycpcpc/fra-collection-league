import { NextResponse } from "next/server";
import { error } from "@/lib/api";
import { matchDeckIds, matchResponse } from "@/lib/matches";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const profile = await prisma.profile.findUnique({ where: { id }, select: { id: true } });
  if (!profile) return error("Profile not found.", 404);
  const matches = await prisma.match.findMany({
    where: { OR: [{ winnerId: id }, { loserId: id }] },
    orderBy: { createdAt: "desc" },
    include: { winner: { select: { name: true } }, loser: { select: { name: true } } },
  });
  const decks = await prisma.deck.findMany({
    where: { id: { in: matchDeckIds(matches) } },
    select: { id: true, name: true },
  });
  const deckNames = new Map(decks.map((deck) => [deck.id, deck.name]));
  const opponents = new Map<string, { opponentId: string; opponentName: string; wins: number; losses: number }>();
  for (const match of matches) {
    const won = match.winnerId === id;
    const opponentId = won ? match.loserId : match.winnerId;
    const opponentName = won ? match.loser.name : match.winner.name;
    const row = opponents.get(opponentId) ?? { opponentId, opponentName, wins: 0, losses: 0 };
    if (won) row.wins += 1; else row.losses += 1;
    opponents.set(opponentId, row);
  }
  const wins = matches.filter((match) => match.winnerId === id).length;
  return NextResponse.json({
    matches: matches.map((match) => matchResponse(match, deckNames)),
    record: { wins, losses: matches.length - wins },
    headToHead: [...opponents.values()].sort((a, b) => a.opponentName.localeCompare(b.opponentName)),
  });
}
