import { AltShell, type AltPlayer } from "./AltShell";
import type { CatalogCard, CollectionCard, DeckCard } from "@/lib/client";

export function AltDeckEditor({ profileId, profileName, players, deckName, cards, collection = [], catalog, commander, status, controls, onQty, onToggleStyle }: { profileId: string; profileName: string; players: AltPlayer[]; deckName: string; cards: DeckCard[]; collection?: CollectionCard[]; catalog: CatalogCard[]; commander: React.ReactNode; status?: string; controls?: React.ReactNode; onQty: (name: string, qty: number) => void; onToggleStyle: () => void }) {
  const catalogMap = new Map(catalog.map((card) => [card.name.toLowerCase(), card]));
  const groups = new Map<string, DeckCard[]>();
  cards.forEach((card) => { const type = catalogMap.get(card.name.toLowerCase())?.type || (card.isBasic ? "Land" : "Other"); const group = type.toLowerCase().includes("creature") ? "Creatures" : type.toLowerCase().includes("land") ? "Lands" : "Other"; groups.set(group, [...(groups.get(group) || []), card]); });
  return <AltShell title={deckName} subtitle={`${profileName} · ${cards.reduce((sum, card) => sum + card.qty, 0)} cards · ${status || "Ready"}`} activeNav="decks" playerId={profileId} players={players} onToggleStyle={onToggleStyle} topRight={controls}>
    <section className="alt-page-section"><h2>Commander &amp; legality</h2><div className="alt-panel">{commander}</div></section>
    {[...groups].map(([group, entries]) => <section className="alt-page-section" key={group}><h2>{group}</h2><div className="alt-card-list">{entries.map((card) => <article key={card.name}><div><strong>{card.name}</strong><small>{catalogMap.get(card.name.toLowerCase())?.rarity || "Basic"}</small></div><div className="alt-stepper"><button type="button" onClick={() => onQty(card.name, Math.max(0, card.qty - 1))}>−</button><b>{card.qty}</b><button type="button" onClick={() => onQty(card.name, card.qty + 1)}>+</button></div></article>)}</div></section>)}
    <section className="alt-page-section"><h2>Add from collection</h2><div className="alt-card-list">{collection.filter((card) => card.owned && !cards.some((entry) => entry.name.toLowerCase() === card.name.toLowerCase())).map((card) => <article key={card.name}><div><strong>{card.name}</strong><small>{card.qty} owned</small></div><button className="alt-pill alt-primary" type="button" onClick={() => onQty(card.name, 1)}>Add</button></article>)}</div></section>
  </AltShell>;
}
