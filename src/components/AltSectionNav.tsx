import type { ReactNode } from "react";

export type AltSectionNavItem = { id: string; label: string; count: number; icon: ReactNode };

type Props = {
  label: string; items: AltSectionNavItem[]; compact: boolean; mode: "jump" | "filter";
  topId?: string; activeId?: string | null; onSelect: (id: string) => void;
};

/** Shared one-row section index. Pass 4 can extend this with filter-mode controls. */
export function AltSectionNav({ label, items, compact, mode, topId, activeId, onSelect }: Props) {
  return <nav className={`alt-section-nav ${compact ? "is-compact" : ""}`} aria-label={label}>
    {items.map((item) => <a key={item.id} className="alt-section-nav-chip" href={mode === "jump" ? `#${item.id}` : "#"} aria-label={`${item.label}, ${item.count} cards`} aria-current={mode === "jump" && activeId === item.id ? "location" : undefined} aria-pressed={mode === "filter" ? activeId === item.id : undefined} title={compact ? `${item.label}, ${item.count} cards` : undefined} onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })} onClick={(event) => { event.preventDefault(); onSelect(item.id); }}>
      <span className="alt-section-nav-icon" aria-hidden="true">{item.icon}</span><span className="alt-section-nav-label">{item.label}</span><span className="alt-section-nav-count" aria-hidden="true">{item.count}</span>
    </a>)}
    {mode === "jump" && topId && <a className="alt-section-nav-chip" href={`#${topId}`} onClick={(event) => { event.preventDefault(); document.getElementById(topId)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span aria-hidden="true">↑</span><span className="alt-section-nav-label">Back to top</span></a>}
  </nav>;
}
