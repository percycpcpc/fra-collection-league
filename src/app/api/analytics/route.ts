import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

const TOTAL_CARDS = 251;

export async function GET() {
  const [catalog, profiles] = await Promise.all([
    getCatalog(),
    prisma.profile.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, cards: { select: { name: true, qty: true, owned: true } } },
    }),
  ]);
  const catalogByName = new Map(catalog.map((card) => [card.name.toLocaleLowerCase(), card]));

  const players = profiles.map((profile) => {
    const byRarity = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
    let ownedCards = 0;
    let ownedQty = 0;
    for (const entry of profile.cards) {
      const card = catalogByName.get(entry.name.toLocaleLowerCase());
      if (!entry.owned || !card) continue;
      ownedCards += 1;
      ownedQty += entry.qty;
      const rarity = card.rarity.toLocaleLowerCase() as keyof typeof byRarity;
      if (rarity in byRarity) byRarity[rarity] += 1;
    }
    return {
      id: profile.id,
      name: profile.name,
      ownedCards,
      ownedQty,
      byRarity,
      completionPct: Number(((ownedCards / TOTAL_CARDS) * 100).toFixed(1)),
    };
  });

  const cards = catalog.map((card) => {
    let owners = 0;
    let totalQty = 0;
    for (const profile of profiles) {
      const entry = profile.cards.find(
        (item) => item.owned && item.name.toLocaleLowerCase() === card.name.toLocaleLowerCase(),
      );
      if (!entry) continue;
      owners += 1;
      totalQty += entry.qty;
    }
    return { name: card.name, rarity: card.rarity, colors: card.colors, img: card.img, owners, totalQty };
  });

  return NextResponse.json({ players, cards });
}
