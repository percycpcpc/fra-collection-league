export function ManaCost({ cost }: { cost: string }) {
  if (!cost) return null;
  const faces = cost.split(" // ");
  const parsed = faces.map((face) =>
    [...face.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
  );
  if (parsed[0].length === 0) return null;
  return (
    <span className="mana-cost">
      {parsed.map((symbols, fi) => (
        <span key={fi} className="mana-face">
          {fi > 0 && <span className="mana-sep">//</span>}
          {symbols.map((sym, i) => {
            const cls = sym.toLowerCase().replace("/", "");
            return <i key={i} className={`ms ms-${cls} ms-cost`} aria-hidden="true" />;
          })}
        </span>
      ))}
    </span>
  );
}
