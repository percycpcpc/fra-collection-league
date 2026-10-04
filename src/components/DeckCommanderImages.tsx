import { cardImage, type CatalogCard } from "@/lib/client";
import { parseCommanderNames } from "@/lib/deck-identity";

export function DeckCommanderImages({ commander, catalog, variant }: { commander: string | null; catalog: readonly CatalogCard[]; variant: "alt" | "classic" }) {
  const names = parseCommanderNames(commander);
  if (names.length === 0) return null;

  const className = variant === "alt" ? "alt-commander-images" : "deck-commander-images";
  return <div className={className}>
    {names.map((name) => <img key={name} src={cardImage(name, catalog.find((card) => card.name === name))} alt={name} loading="lazy" />)}
  </div>;
}
