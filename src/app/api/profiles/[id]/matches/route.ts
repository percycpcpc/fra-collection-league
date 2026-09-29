import { NextResponse } from "next/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { error } from "@/lib/api";
import { matchDeckIds, matchResponse } from "@/lib/matches";
import { getDb } from "@/lib/db";
import { chunksOf } from "@/lib/chunks";
import { decks, matches, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const db = getDb();
  const profile = await db.select({ id: profiles.id }).from(profiles)
    .where(eq(profiles.id, id)).limit(1).then((rows) => rows[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const rawMatches = await db.select().from(matches)
    .where(or(eq(matches.winnerId, id), eq(matches.loserId, id)))
    .orderBy(desc(matches.createdAt), desc(matches.id));
  const playerIds = [...new Set(rawMatches.flatMap((match) => [match.winnerId, match.loserId]))];
  const playerRows = (await Promise.all(chunksOf(playerIds, 99).map((ids) =>
    db.select({ id: profiles.id, name: profiles.name, iconCard: profiles.iconCard })
      .from(profiles).where(inArray(profiles.id, ids)),
  ))).flat();
  const players = new Map(playerRows.map((player) => [player.id, player]));
  const withPlayers = rawMatches.map((match) => ({
    ...match,
    winner: players.get(match.winnerId) ?? { name: "", iconCard: null },
    loser: players.get(match.loserId) ?? { name: "", iconCard: null },
  }));
  const deckIds = matchDeckIds(withPlayers);
  const deckRows = (await Promise.all(chunksOf(deckIds, 99).map((ids) =>
    db.select({ id: decks.id, name: decks.name }).from(decks).where(inArray(decks.id, ids)),
  ))).flat();
  const deckNames = new Map(deckRows.map((deck) => [deck.id, deck.name]));
  const opponents = new Map<string, {
    opponentId: string; opponentName: string; opponentIconCard: string | null; wins: number; losses: number;
  }>();
  for (const match of withPlayers) {
    const won = match.winnerId === id;
    const opponentId = won ? match.loserId : match.winnerId;
    const opponent = won ? match.loser : match.winner;
    const row = opponents.get(opponentId) ?? {
      opponentId, opponentName: opponent.name, opponentIconCard: opponent.iconCard, wins: 0, losses: 0,
    };
    if (won) row.wins += 1;
    else row.losses += 1;
    opponents.set(opponentId, row);
  }
  const wins = withPlayers.filter((match) => match.winnerId === id).length;
  return NextResponse.json({
    matches: withPlayers.map((match) => matchResponse(match, deckNames)),
    record: { wins, losses: withPlayers.length - wins },
    headToHead: [...opponents.values()].sort((a, b) => a.opponentName.localeCompare(b.opponentName)),
  });
}
