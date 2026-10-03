import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  icon?: ReactNode;
  count?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  headingLevel?: 2 | 3 | 4;
};

export function AltCardSection({
  id,
  title,
  icon,
  count,
  collapsed,
  onToggle,
  children,
  headingLevel = 3,
}: Props) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const bodyId = `${id}-body`;

  return (
    <section id={id} className="alt-card-section-root">
      <Heading className="alt-card-section-heading">
        <button
          type="button"
          className="alt-card-section-toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span
            className={`alt-card-section-chevron ${collapsed ? "is-collapsed" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
          {icon && <span className="alt-card-section-icon">{icon}</span>}
          <span className="alt-card-section-label">{title}</span>
          {count && <span className="alt-card-section-count">{count}</span>}
        </button>
      </Heading>
      <div id={bodyId} className="alt-card-section-body" hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
