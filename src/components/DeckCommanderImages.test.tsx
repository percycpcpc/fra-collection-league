import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DeckCommanderImages } from "./DeckCommanderImages";

const catalog = [
  { name: "Ajani", qty: 1, img: "https://cards.example/ajani.jpg", colors: "white", rarity: "rare", type: "Legendary Creature", colorIdentity: "w", manaCost: "" },
  { name: "Bruse Tarl", qty: 1, img: "https://cards.example/bruse.jpg", colors: "red,white", rarity: "rare", type: "Legendary Creature", colorIdentity: "rw", manaCost: "" },
];

describe("DeckCommanderImages", () => {
  it("renders nothing when a deck has no commander", () => {
    expect(renderToStaticMarkup(<DeckCommanderImages commander={null} catalog={catalog} variant="classic" />)).toBe("");
  });

  it("renders one classic commander image from the catalog", () => {
    const html = renderToStaticMarkup(<DeckCommanderImages commander="Ajani" catalog={catalog} variant="classic" />);
    expect(html).toContain('class="deck-commander-images"');
    expect(html).toContain('src="https://cards.example/ajani.jpg" alt="Ajani" loading="lazy"');
    expect(html.match(/<img/g)).toHaveLength(1);
  });

  it("renders two classic commander images and falls back to Scryfall", () => {
    const html = renderToStaticMarkup(<DeckCommanderImages commander="Ajani // Tymna the Weaver" catalog={catalog} variant="classic" />);
    expect(html).toContain('src="https://cards.example/ajani.jpg" alt="Ajani" loading="lazy"');
    expect(html).toContain('src="https://api.scryfall.com/cards/named?exact=Tymna%20the%20Weaver&amp;format=image" alt="Tymna the Weaver" loading="lazy"');
    expect(html.match(/<img/g)).toHaveLength(2);
  });
});
