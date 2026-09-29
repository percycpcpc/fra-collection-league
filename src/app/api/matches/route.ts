import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { cleanName, error, parseBody } from "@/lib/api";
import { matchDeckIds, matchResponse } from "@/lib/matches";
import { getDb } from "@/lib/db";
import { decks, matches, profiles } from "@/db/schema";

export async function GET() {
  const db = getDb();

  const rawMatches = await db
    .select()
    .from(matches)
    .orderBy(matches.createdAt)
    .limit(100);
  rawMatches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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

  const deckIds = matchDeckIds(withPlayers);
  const deckRows = deckIds.length
    ? await db
        .select({ id: decks.id, name: decks.name })
        .from(decks)
        .where(inArray(decks.id, deckIds))
    : [];
  const deckNames = new Map(deckRows.map((d) => [d.id, d.name]));

  return NextResponse.json({
    matches: withPlayers.map((m) => matchResponse(m, deckNames)),
  });
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  const winnerId = cleanName(body.winnerId);
  const loserId = cleanName(body.loserId);
  if (!winnerId || !loserId) return error("Winner and loser are required.");
  if (winnerId === loserId) return error("Winner and loser must be different players.");

  const winnerDeckId = body.winnerDeckId == null ? null : cleanName(body.winnerDeckId);
  const loserDeckId = body.loserDeckId == null ? null : cleanName(body.loserDeckId);
  if (
    (body.winnerDeckId != null && !winnerDeckId) ||
    (body.loserDeckId != null && !loserDeckId)
  )
    return error("Deck ids must be non-empty strings or null.");
  if (body.note != null && typeof body.note !== "string") return error("Note must be a string.");
  if (typeof body.note === "string" && body.note.length > 200)
    return error("Note must be 200 characters or fewer.");
  const note = cleanName(body.note) || null;

  const db = getDb();

  const [profileRows, deckRows] = await Promise.all([
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(inArray(profiles.id, [winnerId, loserId])),
    winnerDeckId || loserDeckId
      ? db
          .select({ id: decks.id, profileId: decks.profileId })
          .from(decks)
          .where(
            inArray(
              decks.id,
              [winnerDeckId, loserDeckId].filter((d): d is string =>
                Boolean(d),
              ),
            ),
          )
      : Promise.resolve([]),
  ]);

  const profileIds = new Set(profileRows.map((p) => p.id));
  if (!profileIds.has(winnerId) || !profileIds.has(loserId))
    return error("Winner and loser must be existing profiles.");

  const deckOwners = new Map(deckRows.map((d) => [d.id, d.profileId]));
  if (winnerDeckId && deckOwners.get(winnerDeckId) !== winnerId)
    return error("Winner deck must belong to the winner.");
  if (loserDeckId && deckOwners.get(loserDeckId) !== loserId)
    return error("Loser deck must belong to the loser.");

  const matchId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db
    .insert(matches)
    .values({
      id: matchId,
      winnerId,
      loserId,
      winnerDeckId,
      loserDeckId,
      note,
      createdAt,
    });

  // Build response
  const playerNames = new Map(profileRows.map((p) => [p.id, ""]));
  const allPlayers = await db
    .select({ id: profiles.id, name: profiles.name })
    .from(profiles)
    .where(inArray(profiles.id, [winnerId, loserId]));
  allPlayers.forEach((p) => playerNames.set(p.id, p.name));

  const resolvedDeckIds = [winnerDeckId, loserDeckId].filter((d): d is string =>
    Boolean(d),
  );
  const deckNameRows = resolvedDeckIds.length
    ? await db
        .select({ id: decks.id, name: decks.name })
        .from(decks)
        .where(inArray(decks.id, resolvedDeckIds))
    : [];
  const deckNames = new Map(deckNameRows.map((d) => [d.id, d.name]));

  const match = {
    id: matchId,
    winnerId,
    loserId,
    winnerDeckId,
    loserDeckId,
    note,
    createdAt,
    winner: { name: playerNames.get(winnerId) ?? "" },
    loser: { name: playerNames.get(loserId) ?? "" },
  };

  return NextResponse.json({ match: matchResponse(match, deckNames) }, { status: 201 });
}
