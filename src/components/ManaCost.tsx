export function ManaCost({ cost }: { cost: string }) {
  if (!cost) return null;
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (!symbols.length) return null;
  return (
    <span className="mana-cost">
      {symbols.map((sym, i) => {
        const cls = sym.toLowerCase().replace("/", "");
        return <i key={i} className={`ms ms-${cls} ms-cost`} aria-hidden="true" />;
      })}
    </span>
  );
}
