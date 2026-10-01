import Link from "next/link";
import { AltShell } from "./AltShell";
import type { DeckSummary } from "@/lib/client";
import type { DeckBanner } from "@/lib/deck-banner";
import { AltPageState } from "./AltPageState";

/** Searchable owned-legendary picker for the Alt deck creation form. State lives in the caller. */
export function AltCommanderField({ label, query, open, options, clearLabel, placeholder, disabled, describedBy, onQuery, onOpen, onChoose }: { label: string; query: string; open: boolean; options: string[]; clearLabel: string; placeholder: string; disabled?: boolean; describedBy?: string; onQuery: (value: string) => void; onOpen: (open: boolean) => void; onChoose: (name: string) => void }) {
  return <label className="alt-commander-field"><span>{label}</span>
    <div className="cmd-search">
      <input type="text" value={query} onChange={(e) => onQuery(e.target.value)} onFocus={() => onOpen(true)} onBlur={() => setTimeout(() => onOpen(false), 150)} placeholder={placeholder} autoComplete="off" disabled={disabled} aria-describedby={describedBy} />
      {open && !disabled && <ul className="cmd-dropdown"><li onMouseDown={() => onChoose("")}>{clearLabel}</li>{options.map((name) => <li key={name} onMouseDown={() => onChoose(name)}>{name}</li>)}</ul>}
    </div>
  </label>;
}

export function AltDeckList({ profileId, profileName, profileIcon = null, decks, banners, createForm, actions, error, onToggleStyle }: { profileId: string; profileName: string; profileIcon?: string | null; decks: DeckSummary[]; banners?: ReadonlyMap<string, DeckBanner | null>; createForm: React.ReactNode; actions?: (deck: DeckSummary) => React.ReactNode; error?: string; onToggleStyle: () => void }) {
  return <AltShell title={`${profileName}'s decks`} subtitle={`${decks.length} decks ready for league play`} activeNav="decks" player={{ id: profileId, name: profileName, iconCard: profileIcon }} onToggleStyle={onToggleStyle}>
    {error && <p className="alt-notice error" role="alert">{error}</p>}
    <section className="alt-page-section"><h2>New deck</h2>{createForm}</section>
    {decks.length === 0 ? <AltPageState title="No decks yet">Create a deck above, then add cards from {profileName}&apos;s collection.</AltPageState> : <section className="alt-content-grid">{decks.map((deck) => { const banner = banners?.get(deck.id); return <article className={banner ? "alt-panel alt-deck-card has-identity" : "alt-panel alt-deck-card"} key={deck.id} style={banner ? { background: banner.background } : undefined} title={banner?.label}><div><small>Commander</small><h2>{deck.name}</h2><p>{deck.commander || "No commander selected"}</p>{banner && <span className="visually-hidden">{banner.label}</span>}</div><strong>{deck.cardCount} cards</strong><div><Link className="alt-pill alt-primary" href={`/p/${profileId}/decks/${deck.id}`}>Edit deck</Link>{actions?.(deck)}</div></article>; })}</section>}
  </AltShell>;
}
