export function ManaCost({ cost }: { cost: string }) {
  if (!cost) return null;
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (!symbols.length) return null;
  return (
    <span className="mana-cost" aria-label={cost}>
      {symbols.map((sym, i) => <ManaSymbol key={i} sym={sym} />)}
    </span>
  );
}

function ManaSymbol({ sym }: { sym: string }) {
  const s = sym.toUpperCase();
  if (s === "W") return <span className="ms ms-w">W</span>;
  if (s === "U") return <span className="ms ms-u">U</span>;
  if (s === "B") return <span className="ms ms-b">B</span>;
  if (s === "R") return <span className="ms ms-r">R</span>;
  if (s === "G") return <span className="ms ms-g">G</span>;
  if (s === "C") return <span className="ms ms-c">◇</span>;
  if (s === "X") return <span className="ms ms-x">X</span>;
  if (s.includes("/")) {
    const [a] = s.split("/");
    return <span className={`ms ms-${a.toLowerCase()}`}>{sym}</span>;
  }
  return <span className="ms ms-generic">{sym}</span>;
}
