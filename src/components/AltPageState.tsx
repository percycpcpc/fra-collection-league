import Link from "next/link";

export function AltPageState({ title, children, busy = false, onRetry }: { title: string; children: React.ReactNode; busy?: boolean; onRetry?: () => void }) {
  return <section className="alt-page-section alt-page-state" aria-live="polite" aria-busy={busy}>
    <h2>{title}</h2>
    <p className="alt-field-hint">{children}</p>
    <div className="alt-state-actions">
      {onRetry && <button className="alt-pill alt-primary" type="button" onClick={onRetry} disabled={busy}>Try again</button>}
      <Link className="alt-pill alt-outline" href="/">Back to players</Link>
    </div>
  </section>;
}
