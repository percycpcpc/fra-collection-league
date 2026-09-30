import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { cleanName, error } from "@/lib/api";
import { matchDeckIds, matchResponse } from "@/lib/matches";
import { getDb } from "@/lib/db";
import { chunksOf } from "@/lib/chunks";
import { decks, matches, profiles } from "@/db/schema";

export async function GET() {
  const db = getDb();
  const rawMatches = await db.select().from(matches)
    .orderBy(desc(matches.createdAt), desc(matches.id)).limit(100);
  const playerIds = [...new Set(rawMatches.flatMap((match) => [match.winnerId, match.loserId]))];
  const playerRows = (await Promise.all(chunksOf(playerIds, 99).map((ids) =>
    db.select({ id: profiles.id, name: profiles.name, iconCard: profiles.iconCard })
      .from(profiles).where(inArray(profiles.id, ids)),
  ))).flat();
  const players = new Map(playerRows.map((profile) => [profile.id, profile]));
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
  return NextResponse.json({ matches: withPlayers.map((match) => matchResponse(match, deckNames)) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
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
  const db = getDb();
  const [profileRows, deckRows] = await Promise.all([
    db.select({ id: profiles.id, name: profiles.name, iconCard: profiles.iconCard })
      .from(profiles).where(inArray(profiles.id, [winnerId, loserId])),
    winnerDeckId || loserDeckId
      ? db.select({ id: decks.id, profileId: decks.profileId }).from(decks)
          .where(inArray(decks.id, [winnerDeckId, loserDeckId].filter((id): id is string => Boolean(id))))
      : Promise.resolve([]),
  ]);
  const players = new Map(profileRows.map((profile) => [profile.id, profile]));
  if (!players.has(winnerId) || !players.has(loserId)) return error("Winner and loser must be existing profiles.");
  const deckOwners = new Map(deckRows.map((deck) => [deck.id, deck.profileId]));
  if (winnerDeckId && deckOwners.get(winnerDeckId) !== winnerId) return error("Winner deck must belong to the winner.");
  if (loserDeckId && deckOwners.get(loserDeckId) !== loserId) return error("Loser deck must belong to the loser.");

  const match = {
    id: crypto.randomUUID(), winnerId, loserId, winnerDeckId, loserDeckId, note,
    createdAt: new Date().toISOString(),
    winner: players.get(winnerId)!, loser: players.get(loserId)!,
  };
  await db.insert(matches).values({
    id: match.id, winnerId, loserId, winnerDeckId, loserDeckId, note, createdAt: match.createdAt,
  });
  const resolvedDeckIds = [winnerDeckId, loserDeckId].filter((id): id is string => Boolean(id));
  const deckNameRows = resolvedDeckIds.length
    ? await db.select({ id: decks.id, name: decks.name }).from(decks).where(inArray(decks.id, resolvedDeckIds))
    : [];
  const deckNames = new Map(deckNameRows.map((deck) => [deck.id, deck.name]));
  return NextResponse.json({ match: matchResponse(match, deckNames) }, { status: 201 });
}
