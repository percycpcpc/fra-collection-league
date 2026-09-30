import type { CatalogCard } from "@/lib/client";

type Slice = { label: string; value: number; color: string };

const CMC_COLORS: Record<string, string> = {
  "0": "#9b9b9b",
  "1": "#48bb78",
  "2": "#4299e1",
  "3": "#9f7aea",
  "4": "#ed8936",
  "5": "#fc8181",
  "6+": "#e53e3e",
};

const SYMBOL_ORDER = ["W", "U", "B", "R", "G", "C"] as const;
const SYMBOL_COLORS: Record<string, string> = {
  W: "#f0ede0", U: "#2a6db5", B: "#4a3728", R: "#c0392b", G: "#27ae60", C: "#908c8a",
};

function parseCMC(cost: string): number {
  const front = cost.split(" // ")[0];
  let n = 0;
  for (const [, sym] of front.matchAll(/\{([^}]+)\}/g)) {
    if (sym === "X") continue;
    if (/^\d+$/.test(sym)) { n += parseInt(sym); continue; }
    if (sym.includes("/")) {
      const nums = sym.split("/").filter(p => /^\d+$/.test(p)).map(Number);
      n += nums.length > 0 ? Math.max(...nums) : 1;
    } else {
      n += 1;
    }
  }
  return n;
}

function tally(cost: string): Record<string, number> {
  const front = cost.split(" // ")[0];
  const out: Record<string, number> = {};
  for (const [, sym] of front.matchAll(/\{([^}]+)\}/g)) {
    const s = sym.toUpperCase();
    if (SYMBOL_COLORS[s]) {
      out[s] = (out[s] ?? 0) + 1;
    } else if (s.includes("/")) {
      for (const p of s.split("/")) {
        if (SYMBOL_COLORS[p]) out[p] = (out[p] ?? 0) + 0.5;
      }
    }
  }
  return out;
}

function DonutChart({ slices, size = 160 }: { slices: Slice[]; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const ro = size * 0.41, ri = size * 0.22;
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="chart-empty">No data</div>;

  let a = -Math.PI / 2;
  const paths: React.ReactNode[] = [];

  for (const sl of slices) {
    if (sl.value === 0) continue;
    const sweep = (sl.value / total) * 2 * Math.PI;
    const a2 = a + sweep;
    const lg = sweep > Math.PI ? 1 : 0;
    const c1 = [Math.cos(a), Math.sin(a)];
    const c2 = [Math.cos(a2), Math.sin(a2)];
    const d = [
      `M${cx + ro * c1[0]} ${cy + ro * c1[1]}`,
      `A${ro} ${ro} 0 ${lg} 1 ${cx + ro * c2[0]} ${cy + ro * c2[1]}`,
      `L${cx + ri * c2[0]} ${cy + ri * c2[1]}`,
      `A${ri} ${ri} 0 ${lg} 0 ${cx + ri * c1[0]} ${cy + ri * c1[1]}Z`,
    ].join(" ");
    paths.push(<path key={sl.label} d={d} fill={sl.color} stroke="#17191d" strokeWidth="1.5" />);
    a = a2;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {paths}
    </svg>
  );
}

function Chart({ title, slices }: { title: string; slices: Slice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const active = slices.filter(s => s.value > 0);
  return (
    <div className="analysis-chart">
      <p className="analysis-chart-title">{title}</p>
      <div className="analysis-chart-body">
        <DonutChart slices={slices} />
        <ul className="analysis-legend">
          {active.map(s => (
            <li key={s.label}>
              <span className="legend-swatch" style={{ background: s.color }} />
              <span className="legend-label">{s.label}</span>
              <span className="legend-count">{Math.round(s.value)}</span>
              <span className="legend-pct">{Math.round(s.value / total * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

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

  const cmcBuckets: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
  const symCounts: Record<string, number> = {};

  for (const { name, qty } of all) {
    const cost = catalogMap.get(name.toLowerCase())?.manaCost ?? "";
    if (!cost) continue;
    const bucket = Math.min(parseCMC(cost), 6);
    const key = bucket === 6 ? "6+" : String(bucket);
    cmcBuckets[key] = (cmcBuckets[key] ?? 0) + qty;
    for (const [sym, cnt] of Object.entries(tally(cost))) {
      symCounts[sym] = (symCounts[sym] ?? 0) + cnt * qty;
    }
  }

  const cmcSlices: Slice[] = Object.entries(cmcBuckets).map(([k, v]) => ({
    label: k === "0" ? "0" : k,
    value: v,
    color: CMC_COLORS[k],
  }));

  const symSlices: Slice[] = SYMBOL_ORDER.filter(s => (symCounts[s] ?? 0) > 0).map(s => ({
    label: s,
    value: symCounts[s],
    color: SYMBOL_COLORS[s],
  }));

  return (
    <div className="deck-analysis">
      <Chart title="Mana curve" slices={cmcSlices} />
      <Chart title="Mana symbols" slices={symSlices} />
    </div>
  );
}
