export type MatchWithPlayers = {
  id: string;
  winnerId: string;
  loserId: string;
  winnerDeckId: string | null;
  loserDeckId: string | null;
  note: string | null;
  createdAt: string;
  winner: { name: string; iconCard: string | null };
  loser: { name: string; iconCard: string | null };
};

export function matchResponse(match: MatchWithPlayers, deckNames: Map<string, string>) {
  return {
    id: match.id,
    winnerId: match.winnerId,
    winnerName: match.winner.name,
    winnerIconCard: match.winner.iconCard,
    loserId: match.loserId,
    loserName: match.loser.name,
    loserIconCard: match.loser.iconCard,
    winnerDeckName: match.winnerDeckId ? deckNames.get(match.winnerDeckId) ?? null : null,
    loserDeckName: match.loserDeckId ? deckNames.get(match.loserDeckId) ?? null : null,
    note: match.note,
    createdAt: match.createdAt,
  };
}

export function matchDeckIds(matches: MatchWithPlayers[]) {
  return [
    ...new Set(
      matches
        .flatMap((m) => [m.winnerDeckId, m.loserDeckId])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}
