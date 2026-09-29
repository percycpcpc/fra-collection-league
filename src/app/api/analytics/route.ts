import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCatalog } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { collectionCards, profiles } from "@/db/schema";

export async function GET() {
  const db = getDb();

  const [catalog, allProfiles] = await Promise.all([
    getCatalog(db),
    db
      .select({
        id: profiles.id,
        name: profiles.name,
        iconCard: profiles.iconCard,
      })
      .from(profiles)
      .orderBy(profiles.name),
  ]);

  const catalogByName = new Map(
    catalog.map((card) => [card.name.toLocaleLowerCase(), card]),
  );

  // Fetch all collection cards for all profiles in one query
  const allCards = await db
    .select({
      profileId: collectionCards.profileId,
      name: collectionCards.name,
      qty: collectionCards.qty,
      owned: collectionCards.owned,
    })
    .from(collectionCards)
    .where(eq(collectionCards.owned, true));

  // Group cards by profileId
  const cardsByProfile = new Map<string, typeof allCards>();
  for (const card of allCards) {
    const list = cardsByProfile.get(card.profileId) ?? [];
    list.push(card);
    cardsByProfile.set(card.profileId, list);
  }

  const players = allProfiles.map((profile) => {
    const cards = cardsByProfile.get(profile.id) ?? [];
    const byRarity = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
    let ownedCards = 0;
    let ownedQty = 0;
    for (const entry of cards) {
      const card = catalogByName.get(entry.name.toLocaleLowerCase());
      if (!card) continue;
      ownedCards += 1;
      ownedQty += entry.qty;
      const rarity = card.rarity.toLocaleLowerCase() as keyof typeof byRarity;
      if (rarity in byRarity) byRarity[rarity] += 1;
    }
    return {
      id: profile.id,
      name: profile.name,
      iconCard: profile.iconCard,
      ownedCards,
      ownedQty,
      byRarity,
      completionPct: Number(((ownedCards / catalog.length) * 100).toFixed(1)),
    };
  });

  const cards = catalog.map((card) => {
    let owners = 0;
    let totalQty = 0;
    for (const [, profileCards] of cardsByProfile) {
      const entry = profileCards.find(
        (item) =>
          item.name.toLocaleLowerCase() === card.name.toLocaleLowerCase(),
      );
      if (!entry) continue;
      owners += 1;
      totalQty += entry.qty;
    }
    return { name: card.name, rarity: card.rarity, colors: card.colors, img: card.img, owners, totalQty };
  });

  return NextResponse.json({ players, cards });
}
