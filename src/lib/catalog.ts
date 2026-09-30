import catalogData from "../../data/catalog.json";

export type CatalogCard = {
  name: string;
  qty: number;
  img: string;
  colors: string;
  rarity: string;
  type: string;
};

export function getCatalog(): CatalogCard[] {
  return catalogData as CatalogCard[];
}

export function catalogNames(): Map<string, string> {
  return new Map(
    getCatalog().map((card) => [card.name.toLocaleLowerCase(), card.name]),
  );
}
