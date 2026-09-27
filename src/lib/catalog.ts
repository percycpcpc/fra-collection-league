import { readFile } from "node:fs/promises";
import path from "node:path";

export type CatalogCard = {
  name: string;
  qty: number;
  img: string;
  colors: string;
  rarity: string;
  type: string;
};

let cache: CatalogCard[] | undefined;

export async function getCatalog() {
  if (!cache) {
    const file = path.join(process.cwd(), "data", "catalog.json");
    cache = JSON.parse(await readFile(file, "utf8")) as CatalogCard[];
  }
  return cache;
}

export async function catalogNames() {
  const catalog = await getCatalog();
  return new Map(catalog.map((card) => [card.name.toLocaleLowerCase(), card.name]));
}
