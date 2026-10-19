// The synergy graph (README "Phase Two" step 2): a chord layout, with every card on one circle,
// the core together on one arc and the cards most strongly linked to it on the rest, and the
// links between them. Drawing every link in the pool (thousands) would say nothing, so only
// the core's neighbourhood is shown.
import type { WeightedEdge } from "./synergyCore.ts";

export interface GraphNode {
  id: string;
  name: string;
  inCore: boolean;
  /** Radians clockwise from the top of the circle. */
  angle: number;
  /** On the unit circle. */
  x: number;
  y: number;
}

export type GraphLink = Pick<
  WeightedEdge,
  "from" | "to" | "weight" | "kind" | "traverse"
>;

/** How many cards outside the core are shown. */
export const NEAR_CARDS = 10;

export function graphView(input: {
  coreCardIds: string[];
  edges: WeightedEdge[];
  names: Map<string, string>;
  near?: number;
}): { nodes: GraphNode[]; links: GraphLink[] } {
  const core = [...new Set(input.coreCardIds)];
  if (core.length === 0) return { nodes: [], links: [] };
  const inCore = new Set(core);

  // A card's pull towards the core: the sum of its links with core cards, either way round.
  const pull = new Map<string, number>();
  for (const e of input.edges) {
    const other = inCore.has(e.from) ? e.to : inCore.has(e.to) ? e.from : null;
    if (!other || inCore.has(other)) continue;
    pull.set(other, (pull.get(other) ?? 0) + e.weight);
  }
  const near = [...pull]
    .sort(
      ([a, pa], [b, pb]) =>
        pb - pa ||
        (input.names.get(a) ?? a).localeCompare(input.names.get(b) ?? b),
    )
    .slice(0, input.near ?? NEAR_CARDS)
    .map(([id]) => id);

  // One slot of space either side of the core's arc, so the two groups read apart.
  const gaps = near.length > 0 ? 2 : 0;
  const step = (2 * Math.PI) / (core.length + near.length + gaps);
  const place = (id: string, slot: number, inCoreArc: boolean): GraphNode => {
    const angle = slot * step;
    return {
      id,
      name: input.names.get(id) ?? id,
      inCore: inCoreArc,
      angle,
      x: Math.sin(angle),
      y: -Math.cos(angle),
    };
  };
  const nodes = [
    ...core.map((id, i) => place(id, i, true)),
    ...near.map((id, i) => place(id, core.length + 1 + i, false)),
  ];
  const shown = new Set(nodes.map((n) => n.id));

  return {
    nodes,
    links: input.edges
      .filter((e) => shown.has(e.from) && shown.has(e.to))
      .map(({ from, to, weight, kind, traverse }) => ({
        from,
        to,
        weight,
        kind,
        traverse,
      })),
  };
}
