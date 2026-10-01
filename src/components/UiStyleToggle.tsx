export function UiStyleToggle({ onToggle }: { onToggle: () => void }) {
  return <button className="ui-style-toggle" type="button" onClick={onToggle} aria-label="Switch to Alt UI">Alt UI</button>;
}
