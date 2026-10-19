// The explorer's colours. WebGL can't read CSS variables, so the graph and its legend share
// these fixed values.
import type { WeightedEdge } from "../ranking/synergyCore.ts";

export const ENGINE_COLOURS: Record<string, string> = {
  gate: "#7c3aed",
  banish: "#0f766e",
  runechant: "#c2410c",
  aura: "#2563eb",
  tempo: "#ca8a04",
  usurp: "#be185d",
  none: "#6b7280",
};
export const KIND_COLOURS: Record<WeightedEdge["kind"], string> = {
  rule: "#a78bfa",
  community: "#f59e0b",
  both: "#4c1d95",
};
