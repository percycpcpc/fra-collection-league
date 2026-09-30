import type { CatalogCard } from "@/lib/client";

// ── Colors ─────────────────────────────────────────────────────────────────

const SYMBOL_COLORS: Record<string, string> = {
  W: "#ede8d5", U: "#4a9ed8", B: "#8b7355", R: "#e05c47", G: "#4cb86c", C: "#9ca3af",
};
const SYMBOL_ORDER = ["W", "U", "B", "R", "G", "C"] as const;

const TYPE_COLORS: Record<string, string> = {
  Creature: "#4CAF50", Instant: "#2196F3", Sorcery: "#9C27B0",
  Enchantment: "#FF9800", Artifact: "#9E9E9E", Land: "#795548",
  Planeswalker: "#F44336", Other: "#607D8B",
};
const TYPE_ORDER = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Other"] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

type CardType = typeof TYPE_ORDER[number] | "Land";

function cardType(type: string): CardType {
  const t = type.split(" // ")[0];
  if (t.includes("Land")) return "Land";
  if (t.includes("Creature")) return "Creature";
  if (t.includes("Planeswalker")) return "Planeswalker";
  if (t.includes("Instant")) return "Instant";
  if (t.includes("Sorcery")) return "Sorcery";
  if (t.includes("Enchantment")) return "Enchantment";
  if (t.includes("Artifact")) return "Artifact";
  return "Other";
}

function parseCMC(cost: string): number {
  const front = cost.split(" // ")[0];
  let n = 0;
  for (const [, sym] of front.matchAll(/\{([^}]+)\}/g)) {
    if (sym === "X") continue;
    if (/^\d+$/.test(sym)) { n += parseInt(sym); continue; }
    n += sym.includes("/") ? Math.max(...sym.split("/").filter(p => /^\d+$/.test(p)).map(Number), 1) : 1;
  }
  return n;
}

function tallySymbols(cost: string): Partial<Record<string, number>> {
  const front = cost.split(" // ")[0];
  const out: Partial<Record<string, number>> = {};
  for (const [, sym] of front.matchAll(/\{([^}]+)\}/g)) {
    const s = sym.toUpperCase();
    if (SYMBOL_COLORS[s]) { out[s] = (out[s] ?? 0) + 1; continue; }
    if (s.includes("/")) {
      for (const p of s.split("/")) if (SYMBOL_COLORS[p]) out[p] = (out[p] ?? 0) + 0.5;
    }
  }
  return out;
}

// ── SVG pie helpers ─────────────────────────────────────────────────────────

type Slice = { label: string; value: number; color: string };

function ringPath(cx: number, cy: number, ro: number, ri: number, slices: Slice[]): React.ReactNode[] {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];
  let a = -Math.PI / 2;
  return slices.filter(s => s.value > 0).map(sl => {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const a2 = a + sweep;
    const lg = sweep > Math.PI ? 1 : 0;
    const [c1, c2] = [[Math.cos(a), Math.sin(a)], [Math.cos(a2), Math.sin(a2)]];
    const d = [
      `M${cx + ro * c1[0]} ${cy + ro * c1[1]}`,
      `A${ro} ${ro} 0 ${lg} 1 ${cx + ro * c2[0]} ${cy + ro * c2[1]}`,
      `L${cx + ri * c2[0]} ${cy + ri * c2[1]}`,
      `A${ri} ${ri} 0 ${lg} 0 ${cx + ri * c1[0]} ${cy + ri * c1[1]}Z`,
    ].join(" ");
    a = a2;
    return <path key={sl.label} d={d} fill={sl.color} stroke="#17191d" strokeWidth="1.5" />;
  });
}

function Legend({ slices, total }: { slices: Slice[]; total: number }) {
  return (
    <ul className="analysis-legend">
      {slices.filter(s => s.value > 0).map(s => (
        <li key={s.label}>
          <span className="legend-swatch" style={{ background: s.color }} />
          <span className="legend-label">{s.label}</span>
          <span className="legend-count">{Math.round(s.value)}</span>
          <span className="legend-pct">{Math.round(s.value / total * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

// ── Chart 1: Concentric double pie (card symbols outer, land mana inner) ────

function ManaDistChart({ cardSymbols, landSymbols }: { cardSymbols: Slice[]; landSymbols: Slice[] }) {
  const total = cardSymbols.reduce((s, d) => s + d.value, 0);
  return (
    <div className="analysis-chart">
      <p className="analysis-chart-title">Mana distribution</p>
      <div className="analysis-chart-body">
        <svg width="170" height="170" viewBox="0 0 170 170" aria-hidden="true">
          {ringPath(85, 85, 78, 57, cardSymbols)}
          {ringPath(85, 85, 52, 30, landSymbols)}
          <text x="85" y="89" textAnchor="middle" fontSize="9" fill="#9ca3af">land</text>
          <text x="85" y="79" textAnchor="middle" fontSize="9" fill="#9ca3af">cost</text>
        </svg>
        <Legend slices={cardSymbols} total={total} />
      </div>
    </div>
  );
}

// ── Chart 2: Card type pie ───────────────────────────────────────────────────

function TypeChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  return (
    <div className="analysis-chart">
      <p className="analysis-chart-title">Card types</p>
      <div className="analysis-chart-body">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
          {ringPath(70, 70, 62, 32, slices)}
        </svg>
        <Legend slices={slices} total={total} />
      </div>
    </div>
  );
}

// ── Chart 3: Stacked bar mana curve ─────────────────────────────────────────

const CMC_BUCKETS = ["0", "1", "2", "3", "4", "5", "6+"] as const;

function CurveChart({ stacks }: { stacks: Record<string, Record<string, number>> }) {
  const W = 560, H = 160;
  const mt = 8, mb = 22, ml = 22, mr = 8;
  const pw = W - ml - mr, ph = H - mt - mb;

  const totals = CMC_BUCKETS.map(b => Object.values(stacks[b] ?? {}).reduce((s, n) => s + n, 0));
  const maxTotal = Math.max(...totals, 1);
  const barW = pw / CMC_BUCKETS.length;
  const pad = barW * 0.18;

  return (
    <div className="analysis-chart analysis-chart-curve">
      <p className="analysis-chart-title">Mana curve</p>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {/* y gridlines */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const y = mt + ph * (1 - f);
          return <line key={f} x1={ml} y1={y} x2={W - mr} y2={y} stroke="#2d3748" strokeWidth="1" />;
        })}
        {CMC_BUCKETS.map((bucket, bi) => {
          const x = ml + bi * barW + pad;
          const bw = barW - pad * 2;
          let yOffset = 0;
          const rects: React.ReactNode[] = [];
          for (const type of TYPE_ORDER) {
            const n = stacks[bucket]?.[type] ?? 0;
            if (n === 0) continue;
            const bh = (n / maxTotal) * ph;
            const y = mt + ph - yOffset - bh;
            rects.push(<rect key={type} x={x} y={y} width={bw} height={bh} fill={TYPE_COLORS[type]} />);
            yOffset += bh;
          }
          const total = totals[bi];
          return (
            <g key={bucket}>
              {rects}
              {total > 0 && (
                <text x={x + bw / 2} y={mt + ph - yOffset - 3} textAnchor="middle" fontSize="9" fill="#e2e8f0">{total}</text>
              )}
              <text x={x + bw / 2} y={H - mb + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">{bucket}</text>
            </g>
          );
        })}
        {/* y-axis label */}
        <text x={ml - 4} y={mt + ph} textAnchor="end" fontSize="9" fill="#4a5568">{maxTotal}</text>
      </svg>
      <ul className="analysis-legend analysis-legend-row">
        {TYPE_ORDER.map(t => (stacks["0"]?.[t] ?? 0) + (stacks["1"]?.[t] ?? 0) + (stacks["2"]?.[t] ?? 0) +
          (stacks["3"]?.[t] ?? 0) + (stacks["4"]?.[t] ?? 0) + (stacks["5"]?.[t] ?? 0) + (stacks["6+"]?.[t] ?? 0) > 0 ? (
          <li key={t}><span className="legend-swatch" style={{ background: TYPE_COLORS[t] }} /><span className="legend-label">{t}</span></li>
        ) : null)}
      </ul>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function DeckAnalysis({
  cards,
  commanderNames,
  catalogMap,
}: {
  cards: { name: string; qty: number }[];
  commanderNames: string[];
  catalogMap: Map<string, CatalogCard>;
}) {
  const all = [...commanderNames.map(n => ({ name: n, qty: 1 })), ...cards];

  const cardSymCounts: Record<string, number> = {};
  const landSymCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const curveBuckets: Record<string, Record<string, number>> = {};
  for (const b of CMC_BUCKETS) curveBuckets[b] = {};

  for (const { name, qty } of all) {
    const entry = catalogMap.get(name.toLowerCase());
    if (!entry) continue;
    const ct = cardType(entry.type ?? "");
    typeCounts[ct] = (typeCounts[ct] ?? 0) + qty;

    if (ct === "Land") {
      for (const ch of entry.colorIdentity ?? "") {
        if (SYMBOL_COLORS[ch]) landSymCounts[ch] = (landSymCounts[ch] ?? 0) + qty;
      }
      continue; // Lands skip mana curve and card symbols
    }

    const cost = entry.manaCost ?? "";
    if (cost) {
      for (const [sym, cnt] of Object.entries(tallySymbols(cost))) {
        cardSymCounts[sym] = (cardSymCounts[sym] ?? 0) + (cnt ?? 0) * qty;
      }
    }

    if (ct !== "Land") {
      const cmc = cost ? parseCMC(cost) : 0;
      const bucket = cmc >= 6 ? "6+" : String(cmc);
      curveBuckets[bucket][ct] = (curveBuckets[bucket][ct] ?? 0) + qty;
    }
  }

  const cardSymSlices = SYMBOL_ORDER.filter(s => (cardSymCounts[s] ?? 0) > 0)
    .map(s => ({ label: s, value: cardSymCounts[s], color: SYMBOL_COLORS[s] }));

  const landSymSlices = SYMBOL_ORDER.filter(s => (landSymCounts[s] ?? 0) > 0)
    .map(s => ({ label: s, value: landSymCounts[s], color: SYMBOL_COLORS[s] }));

  const typeSlices = [...TYPE_ORDER, "Land" as const]
    .filter(t => (typeCounts[t] ?? 0) > 0)
    .map(t => ({ label: t, value: typeCounts[t], color: TYPE_COLORS[t] ?? TYPE_COLORS.Other }));

  return (
    <div className="deck-analysis">
      <ManaDistChart cardSymbols={cardSymSlices} landSymbols={landSymSlices} />
      <TypeChart slices={typeSlices} />
      <CurveChart stacks={curveBuckets} />
    </div>
  );
}
