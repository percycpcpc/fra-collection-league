import { memo, useMemo, useState } from "react";
import type { CatalogCard } from "@/lib/client";

// ── Colors ─────────────────────────────────────────────────────────────────

const SYMBOL_COLORS: Record<string, string> = {
  W: "#ede8d5", U: "#4a9ed8", B: "#484848", R: "#e05c47", G: "#4cb86c", C: "#9ca3af",
};
const SYMBOL_ORDER = ["W", "U", "B", "R", "G", "C"] as const;

const TYPE_COLORS: Record<string, string> = {
  Creature: "#4CAF50", Instant: "#2196F3", Sorcery: "#9C27B0",
  Enchantment: "#FF9800", Artifact: "#9E9E9E", Land: "#795548",
  Planeswalker: "#F44336", Other: "#607D8B",
};
const TYPE_ORDER = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Other"] as const;

const CURVE_COLOR_ORDER = ["white", "blue", "black", "red", "green", "multi", "colorless"] as const;
const CURVE_COLOR_MAP: Record<string, string> = {
  white: "#ede8d5", blue: "#4a9ed8", black: "#484848",
  red: "#e05c47", green: "#4cb86c", multi: "#c9a942", colorless: "#9ca3af",
};

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
    if (sym.includes("/")) {
      // Hybrid like {2/W} contributes its highest numeric side, or 1 for pure colored hybrids.
      const nums = sym.split("/").filter(p => /^\d+$/.test(p)).map(Number);
      n += nums.length > 0 ? Math.max(...nums) : 1;
      continue;
    }
    n += 1;
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

// ── Chart 1: Concentric double pie (card symbols outer, land mana inner) ────

function ManaDistChart({ cardSymbols, landSymbols }: { cardSymbols: Slice[]; landSymbols: Slice[] }) {
  return (
    <div className="analysis-chart">
      <p className="analysis-chart-title">Mana distribution</p>
      <div className="analysis-chart-body">
        <svg width="170" height="186" viewBox="0 0 170 186" aria-hidden="true">
          <text x="85" y="11" textAnchor="middle" fontSize="10" fill="#9ca3af">costs</text>
          {ringPath(85, 101, 78, 57, cardSymbols)}
          {ringPath(85, 101, 52, 30, landSymbols)}
          {landSymbols.length > 0 && <text x="85" y="105" textAnchor="middle" fontSize="10" fill="#9ca3af">land</text>}
        </svg>
      </div>
    </div>
  );
}

// ── Chart 2: Card type pie ───────────────────────────────────────────────────

function TypeChart({ slices }: { slices: Slice[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = slices.reduce((s, d) => s + d.value, 0);

  const cx = 70, cy = 70, ro = 62, ri = 32;

  // Pre-compute arc angles once so hover state changes don't re-tally.
  const arcs = useMemo(() => {
    const out: { sl: Slice; a1: number; a2: number }[] = [];
    let a = -Math.PI / 2;
    for (const sl of slices.filter(s => s.value > 0)) {
      const sweep = (sl.value / total) * 2 * Math.PI;
      out.push({ sl, a1: a, a2: a + sweep });
      a += sweep;
    }
    return out;
  }, [slices, total]);

  const paths = arcs.map(({ sl, a1, a2 }) => {
    const lg = a2 - a1 > Math.PI ? 1 : 0;
    const c1 = [Math.cos(a1), Math.sin(a1)];
    const c2 = [Math.cos(a2), Math.sin(a2)];
    const d = [
      `M${cx + ro * c1[0]} ${cy + ro * c1[1]}`,
      `A${ro} ${ro} 0 ${lg} 1 ${cx + ro * c2[0]} ${cy + ro * c2[1]}`,
      `L${cx + ri * c2[0]} ${cy + ri * c2[1]}`,
      `A${ri} ${ri} 0 ${lg} 0 ${cx + ri * c1[0]} ${cy + ri * c1[1]}Z`,
    ].join(" ");
    return (
      <path key={sl.label} d={d} fill={sl.color} stroke="#17191d" strokeWidth="1.5"
        tabIndex={0}
        role="img"
        aria-label={`${sl.label}: ${Math.round(sl.value)} (${Math.round(sl.value / total * 100)}%)`}
        style={{ cursor: "default", outline: "none" }}
        onMouseEnter={() => setHovered(sl.label)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(sl.label)}
        onBlur={() => setHovered(null)}
      />
    );
  });

  // Elbow leader lines with per-side y-deconfliction. In the top/bottom dead
  // zone (|cos| < 0.15) we use a middle-anchored label with no horizontal tick.
  // For left/right labels, we sort by y within each side and enforce a minimum
  // vertical gap so adjacent small slices don't stack their labels on top of
  // each other.
  const elbowR = 72, tickLen = 5, MIN_GAP = 9;
  const labelData = arcs
    .filter(({ a1, a2 }) => a2 - a1 >= 0.18)
    .map(({ sl, a1, a2 }) => {
      const mid = (a1 + a2) / 2;
      const cos = Math.cos(mid), sin = Math.sin(mid);
      const middleZone = Math.abs(cos) < 0.15;
      return {
        sl, cos, sin, middleZone,
        anchorX: cx + (ro + 2) * cos,
        anchorY: cy + (ro + 2) * sin,
        ex: cx + elbowR * cos,
        ey: cy + elbowR * sin,
      };
    });

  // Deconflict left and right sides independently.
  for (const side of [-1, 1] as const) {
    const group = labelData
      .filter(l => !l.middleZone && (side === 1 ? l.cos >= 0 : l.cos < 0))
      .sort((a, b) => a.ey - b.ey);
    for (let i = 1; i < group.length; i++) {
      const gap = group[i].ey - group[i - 1].ey;
      if (gap < MIN_GAP) group[i].ey = group[i - 1].ey + MIN_GAP;
    }
  }

  const labels = labelData.map(({ sl, cos, sin, middleZone, anchorX, anchorY, ex, ey }) => {
    const anchor = middleZone ? "middle" : cos > 0 ? "start" : "end";
    const tx = middleZone ? ex : ex + tickLen * (cos >= 0 ? 1 : -1);
    const textX = middleZone ? tx : tx + (cos >= 0 ? 2 : -2);
    return (
      <g key={`lbl-${sl.label}`}>
        <line x1={anchorX} y1={anchorY} x2={ex} y2={ey}
          stroke="#4b5563" strokeWidth="0.8" />
        {!middleZone && (
          <line x1={ex} y1={ey} x2={tx} y2={ey} stroke="#4b5563" strokeWidth="0.8" />
        )}
        <text x={textX} y={ey + (middleZone ? (sin < 0 ? -3 : 8) : 3)} textAnchor={anchor}
          fontSize="7.5" fill="#d1d5db">{sl.label}</text>
      </g>
    );
  });

  const h = hovered ? slices.find(s => s.label === hovered) : null;

  return (
    <div className="analysis-chart">
      <p className="analysis-chart-title">Card types</p>
      <svg width="186" height="186" viewBox="0 0 140 140" overflow="visible" role="img" aria-label="Card type distribution">
        {paths}
        {labels}
        {h && (
          <>
            <text x="70" y="66" textAnchor="middle" fontSize="9" fill="#e2e8f0">{h.label}</text>
            <text x="70" y="78" textAnchor="middle" fontSize="9" fill="#9ca3af">
              {Math.round(h.value)} · {Math.round(h.value / total * 100)}%
            </text>
          </>
        )}
      </svg>
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
          for (const color of CURVE_COLOR_ORDER) {
            const n = stacks[bucket]?.[color] ?? 0;
            if (n === 0) continue;
            const bh = (n / maxTotal) * ph;
            const y = mt + ph - yOffset - bh;
            rects.push(<rect key={color} x={x} y={y} width={bw} height={bh} fill={CURVE_COLOR_MAP[color]} />);
            yOffset += bh;
          }
          return (
            <g key={bucket}>
              {rects}
              <text x={x + bw / 2} y={H - mb + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">{bucket}</text>
            </g>
          );
        })}
        {/* y-axis labels */}
        <text x={ml - 4} y={mt + 4} textAnchor="end" fontSize="9" fill="#4a5568">{maxTotal}</text>
        <text x={ml - 4} y={mt + ph} textAnchor="end" fontSize="9" fill="#4a5568">0</text>
      </svg>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

function DeckAnalysisImpl({
  cards,
  commanderNames,
  catalogMap,
}: {
  cards: { name: string; qty: number }[];
  commanderNames: string[];
  catalogMap: Map<string, CatalogCard>;
}) {
  const { cardSymSlices, landSymSlices, typeSlices, curveBuckets } = useMemo(() => {
    const commanderSet = new Set(commanderNames.map(n => n.toLowerCase()));
    const all = [
      ...commanderNames.map(n => ({ name: n, qty: 1 })),
      ...cards.filter(c => !commanderSet.has(c.name.toLowerCase())),
    ];

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

      const cmc = cost ? parseCMC(cost) : 0;
      const bucket = cmc >= 6 ? "6+" : String(cmc);
      const colorKey = entry.colors ?? "colorless";
      curveBuckets[bucket][colorKey] = (curveBuckets[bucket][colorKey] ?? 0) + qty;
    }

    const cardSymSlices = SYMBOL_ORDER.filter(s => (cardSymCounts[s] ?? 0) > 0)
      .map(s => ({ label: s, value: cardSymCounts[s], color: SYMBOL_COLORS[s] }));

    const landSymSlices = SYMBOL_ORDER.filter(s => (landSymCounts[s] ?? 0) > 0)
      .map(s => ({ label: s, value: landSymCounts[s], color: SYMBOL_COLORS[s] }));

    const typeSlices = [...TYPE_ORDER, "Land" as const]
      .filter(t => (typeCounts[t] ?? 0) > 0)
      .map(t => ({ label: t, value: typeCounts[t], color: TYPE_COLORS[t] ?? TYPE_COLORS.Other }));

    return { cardSymSlices, landSymSlices, typeSlices, curveBuckets };
  }, [cards, commanderNames, catalogMap]);

  return (
    <div className="deck-analysis">
      <ManaDistChart cardSymbols={cardSymSlices} landSymbols={landSymSlices} />
      <TypeChart slices={typeSlices} />
      <CurveChart stacks={curveBuckets} />
    </div>
  );
}

export const DeckAnalysis = memo(DeckAnalysisImpl);
