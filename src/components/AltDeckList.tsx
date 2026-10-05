import Link from "next/link";
import { useEffect, useRef, type FormEvent, type ReactNode, type Ref } from "react";
import { AltShell } from "./AltShell";
import type { CatalogCard, DeckSummary } from "@/lib/client";
import { parseCommanderNames, resolveCommanderIdentity } from "@/lib/deck-identity";
import { deckRowView, deckSummary, filterDecks } from "@/lib/deck-list-view";
import { AltPageState } from "./AltPageState";
import { DeckCommanderImages } from "./DeckCommanderImages";

/** Searchable owned-legendary picker for the Alt deck creation form. State lives in the caller. */
export function AltCommanderField({ label, query, open, options, clearLabel, placeholder, disabled, describedBy, onQuery, onOpen, onChoose }: { label: ReactNode; query: string; open: boolean; options: string[]; clearLabel: string; placeholder: string; disabled?: boolean; describedBy?: string; onQuery: (value: string) => void; onOpen: (open: boolean) => void; onChoose: (name: string) => void }) {
  return <label className="alt-commander-field"><span>{label}</span>
    <div className="cmd-search">
      <input type="text" value={query} onChange={(e) => onQuery(e.target.value)} onFocus={() => onOpen(true)} onBlur={() => setTimeout(() => onOpen(false), 150)} placeholder={placeholder} autoComplete="off" disabled={disabled} aria-describedby={describedBy} />
      {open && !disabled && <ul className="cmd-dropdown"><li onMouseDown={() => onChoose("")}>{clearLabel}</li>{options.map((name) => <li key={name} onMouseDown={() => onChoose(name)}>{name}</li>)}</ul>}
    </div>
  </label>;
}

// Phosphor-style (regular weight) glyphs, inlined so the app takes no icon dependency.
const ICON_PATHS = {
  search: <><circle cx="112" cy="112" r="80" /><line x1="168.57" y1="168.57" x2="224" y2="224" /></>,
  plus: <><line x1="40" y1="128" x2="216" y2="128" /><line x1="128" y1="40" x2="128" y2="216" /></>,
  pencil: <><path d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z" /><line x1="136" y1="64" x2="192" y2="120" /></>,
  trash: <><line x1="216" y1="56" x2="40" y2="56" /><line x1="104" y1="104" x2="104" y2="168" /><line x1="152" y1="104" x2="152" y2="168" /><path d="M200,56V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V56" /><path d="M168,56V40a16,16,0,0,0-16-16H104A16,16,0,0,0,88,40V56" /></>,
  image: <><rect x="32" y="48" width="192" height="160" rx="8" /><circle cx="92" cy="100" r="16" /><path d="M32,168l50.34-50.34a8,8,0,0,1,11.32,0L176,200" /><path d="M147.31,171.31l20.35-20.35a8,8,0,0,1,11.31,0L224,196" /></>,
};

function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return <svg className="alt-decks-icon" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICON_PATHS[name]}</svg>;
}

/** Modal shell: backdrop click and Escape close, Tab stays inside, first field takes focus. */
export function AltDecksDialog({ labelledBy, describedBy, width, onClose, children, asForm, onSubmit }: { labelledBy: string; describedBy?: string; width?: number; onClose: () => void; children: ReactNode; asForm?: boolean; onSubmit?: (event: FormEvent<HTMLFormElement>) => void }) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const root = panel.current;
    (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab" || !root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!focusable.includes(document.activeElement as HTMLElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, []);
  const props = { className: "alt-decks-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": labelledBy, "aria-describedby": describedBy, tabIndex: -1, style: width ? { width } : undefined, onMouseDown: (event: React.MouseEvent) => event.stopPropagation() } as const;
  return <div className="alt-decks-backdrop" onMouseDown={onClose}>
    {asForm ? <form ref={panel as Ref<HTMLFormElement>} {...props} onSubmit={onSubmit}>{children}</form> : <div ref={panel as Ref<HTMLDivElement>} {...props}>{children}</div>}
  </div>;
}

/** New deck dialog. Fields are passed in so the caller keeps its existing form state and validation. */
export function AltNewDeckDialog({ hint, error, creating, nameField, commanderFields, onClose, onSubmit }: { hint: string; error?: string; creating: boolean; nameField: ReactNode; commanderFields: ReactNode; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <AltDecksDialog asForm labelledBy="alt-new-deck-title" describedBy="alt-commander-hint" onClose={onClose} onSubmit={onSubmit}>
    <div className="alt-decks-dialog-head"><h3 id="alt-new-deck-title">New deck</h3><p id="alt-commander-hint">{hint}</p></div>
    {error && <p className="alt-decks-dialog-error" role="alert">{error}</p>}
    {nameField}
    {commanderFields}
    <div className="alt-decks-dialog-actions">
      <button className="alt-decks-btn alt-decks-btn-ghost" type="button" onClick={onClose}>Cancel</button>
      <button className="alt-decks-btn alt-decks-btn-primary" type="submit" disabled={creating}>{creating ? "Creating…" : "Create deck"}</button>
    </div>
  </AltDecksDialog>;
}

export function AltDeleteDeckDialog({ deckName, onCancel, onConfirm }: { deckName: string; onCancel: () => void; onConfirm: () => void }) {
  return <AltDecksDialog labelledBy="alt-delete-deck-title" describedBy="alt-delete-deck-body" width={380} onClose={onCancel}>
    <div className="alt-decks-dialog-head"><h3 id="alt-delete-deck-title">Delete {deckName}?</h3><p id="alt-delete-deck-body">The deck is removed from league play. Cards stay in the collection.</p></div>
    <div className="alt-decks-dialog-actions">
      <button className="alt-decks-btn alt-decks-btn-ghost" type="button" onClick={onCancel} data-autofocus>Cancel</button>
      <button className="alt-decks-btn alt-decks-btn-secondary" type="button" onClick={onConfirm}>Delete deck</button>
    </div>
  </AltDecksDialog>;
}

function AltDeckRow({ deck, profileId, catalog, onDelete, deleteRef }: { deck: DeckSummary; profileId: string; catalog: readonly CatalogCard[]; onDelete?: (deck: DeckSummary) => void; deleteRef?: (deckId: string, node: HTMLButtonElement | null) => void }) {
  // Identities wait for the catalog so rows don't flash colorless while it loads.
  const identity = catalog.length ? resolveCommanderIdentity(parseCommanderNames(deck.commander), catalog) : undefined;
  const view = deckRowView(deck, identity);
  return <article className="alt-deck-row" title={view.identityLabel ?? undefined}>
    <div className="alt-deck-row-edge" style={view.edge ? { background: view.edge } : undefined} aria-hidden="true" />
    {view.wash && <div className="alt-deck-row-wash" style={{ background: view.wash }} aria-hidden="true" />}
    <div className="alt-deck-row-art">{view.hasCommander ? <DeckCommanderImages commander={deck.commander} catalog={catalog} variant="alt" /> : <div className="alt-deck-row-placeholder"><Icon name="image" /></div>}</div>
    <div className="alt-deck-row-body">
      <div className="alt-deck-row-top">
        <div className="alt-deck-row-titles">
          <span className="alt-deck-row-kicker">{view.kicker}</span>
          <h2>{deck.name}</h2>
          <span className="alt-deck-row-commanders">{view.commanders}</span>
        </div>
        {view.pips.length > 0 && <div className="alt-deck-pips" role="img" aria-label={view.identityLabel ?? undefined}>{view.pips.map((pip) => <span key={pip.key} className="alt-deck-pip" title={pip.label} style={{ "--pip": pip.color } as React.CSSProperties} aria-hidden="true">{pip.key}</span>)}</div>}
      </div>
      <div className="alt-deck-row-progress">
        <div className="alt-deck-row-meta"><span>{view.countLabel}</span><span className="alt-deck-row-status">{view.status}</span></div>
        <div className="alt-deck-row-track"><div style={{ width: view.pct }} /></div>
      </div>
      <div className="alt-deck-row-actions">
        <Link className="alt-decks-btn alt-decks-btn-secondary" href={`/p/${profileId}/decks/${deck.id}`}><Icon name="pencil" />Edit deck</Link>
        {onDelete && <button ref={(node) => deleteRef?.(deck.id, node)} className="alt-decks-btn alt-decks-btn-ghost alt-decks-btn-icon" type="button" aria-label={`Delete ${deck.name}`} onClick={() => onDelete(deck)}><Icon name="trash" /></button>}
      </div>
    </div>
  </article>;
}

export function AltDeckList({ profileId, profileName, profileIcon = null, decks, catalog = [], query = "", onQuery, onNewDeck, onDelete, deleteRef, dialog, error }: { profileId: string; profileName: string; profileIcon?: string | null; decks: DeckSummary[]; catalog?: readonly CatalogCard[]; query?: string; onQuery?: (value: string) => void; onNewDeck?: () => void; onDelete?: (deck: DeckSummary) => void; deleteRef?: (deckId: string, node: HTMLButtonElement | null) => void; dialog?: ReactNode; error?: string }) {
  const shown = filterDecks(decks, query);
  const header = <div className="alt-decks-v2 alt-decks-head">
    <div className="alt-decks-head-text"><h1>{profileName}&apos;s decks</h1><p>{deckSummary(decks)}</p></div>
    <div className="alt-decks-head-controls">
      <label className="alt-decks-filter"><span className="visually-hidden">Filter decks</span><Icon name="search" /><input type="search" value={query} onChange={(event) => onQuery?.(event.target.value)} placeholder="Filter decks" autoComplete="off" /></label>
      <button className="alt-decks-btn alt-decks-btn-primary" type="button" onClick={onNewDeck}><Icon name="plus" />New deck</button>
    </div>
  </div>;
  return <><div className="alt-decks-page-background" inert={dialog ? true : undefined}><AltShell title={header} activeNav="decks" player={{ id: profileId, name: profileName, iconCard: profileIcon }}>
    <div className="alt-decks-v2 alt-decks-body">
      <div className="alt-decks-page-content">
        {error && !dialog && <p className="alt-notice error" role="alert">{error}</p>}
        {decks.length === 0 && <AltPageState title="No decks yet">Use New deck to create one, then add cards from {profileName}&apos;s collection.</AltPageState>}
        {decks.length > 0 && shown.length === 0 && <p className="alt-decks-no-match" role="status">No decks match &ldquo;{query.trim()}&rdquo;.</p>}
        <section className="alt-decks-rows" aria-label={`${profileName}'s decks`}>
          {shown.map((deck) => <AltDeckRow key={deck.id} deck={deck} profileId={profileId} catalog={catalog} onDelete={onDelete} deleteRef={deleteRef} />)}
          <button className="alt-decks-cta" type="button" onClick={onNewDeck}>
            <Icon name="plus" />
            <strong>{decks.length ? "Build another deck" : "Build your first deck"}</strong>
            <span>Up to two legendary commanders from {profileName}&apos;s collection</span>
          </button>
        </section>
      </div>
    </div>
  </AltShell></div>{dialog && <div className="alt-decks-v2">{dialog}</div>}</>;
}
