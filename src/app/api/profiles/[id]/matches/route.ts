import { NextResponse } from "next/server";
import { eq, inArray, or } from "drizzle-orm";
import { error } from "@/lib/api";
import { matchDeckIds, matchResponse } from "@/lib/matches";
import { getDb } from "@/lib/db";
import { decks, matches, profiles } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  const db = getDb();

  const profile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!profile) return error("Profile not found.", 404);

  const rawMatches = await db
    .select()
    .from(matches)
    .where(or(eq(matches.winnerId, id), eq(matches.loserId, id)));
  rawMatches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Resolve player names in one query
  const playerIds = [
    ...new Set(rawMatches.flatMap((m) => [m.winnerId, m.loserId])),
  ];
  const playerRows = playerIds.length
    ? await db
        .select({ id: profiles.id, name: profiles.name })
        .from(profiles)
        .where(inArray(profiles.id, playerIds))
    : [];
  const playerNames = new Map(playerRows.map((p) => [p.id, p.name]));

  const withPlayers = rawMatches.map((m) => ({
    ...m,
    winner: { name: playerNames.get(m.winnerId) ?? "" },
    loser: { name: playerNames.get(m.loserId) ?? "" },
  }));

  // Resolve deck names
  const deckIds = matchDeckIds(withPlayers);
  const deckRows = deckIds.length
    ? await db
        .select({ id: decks.id, name: decks.name })
        .from(decks)
        .where(inArray(decks.id, deckIds))
    : [];
  const deckNames = new Map(deckRows.map((d) => [d.id, d.name]));

  // Build head-to-head record
  const opponents = new Map<
    string,
    { opponentId: string; opponentName: string; wins: number; losses: number }
  >();
  for (const match of withPlayers) {
    const won = match.winnerId === id;
    const opponentId = won ? match.loserId : match.winnerId;
    const opponentName = won ? match.loser.name : match.winner.name;
    const row = opponents.get(opponentId) ?? {
      opponentId,
      opponentName,
      wins: 0,
      losses: 0,
    };
    if (won) row.wins += 1;
    else row.losses += 1;
    opponents.set(opponentId, row);
  }

  const wins = withPlayers.filter((m) => m.winnerId === id).length;
  return NextResponse.json({
    matches: withPlayers.map((m) => matchResponse(m, deckNames)),
    record: { wins, losses: withPlayers.length - wins },
    headToHead: [...opponents.values()].sort((a, b) =>
      a.opponentName.localeCompare(b.opponentName),
    ),
  });
}
